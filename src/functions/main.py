# Welcome to Cloud Functions for Firebase for Python!
# To get started, simply uncomment the below code or create your own.
# Deploy with `firebase deploy`

from firebase_functions import https_fn, options, pubsub_fn # Added pubsub_fn
from firebase_admin import initialize_app, firestore
import logging
import time
import datetime
import os
import json # For Pub/Sub message payload
import base64 # For decoding Pub/Sub message data
from google.cloud import pubsub_v1 # For Pub/Sub publisher client
from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build, Resource
from googleapiclient.errors import HttpError as GoogleHttpError
from google.auth.transport.requests import Request as GoogleAuthRequest
from google.auth.exceptions import RefreshError as GoogleRefreshError
import razorpay # Added for Razorpay integration

# Initialize Firebase Admin SDK
initialize_app()
DB = firestore.client()

# Configure logging
logger = logging.getLogger(__name__)
logging.basicConfig(level=logging.INFO)

# --- Configuration Constants ---
CREDIT_PER_URL = 1  # Cost per URL inspection
PUBSUB_TOPIC_ID = "site-indexing-tasks" # REPLACE with your Pub/Sub topic name
REINDEX_PUBSUB_TOPIC_ID = "site-reindexing-tasks" # New Pub/Sub topic for re-indexing
CREDIT_PER_REINDEX_URL = 5 # Cost per URL re-index request

# Razorpay Configuration - Ideally use environment variables for keys
RAZORPAY_KEY_ID = os.environ.get("RAZORPAY_KEY_ID", "rzp_test_Bf4FkxNP2NXdZC") # Replace with your actual key ID or env var name
RAZORPAY_KEY_SECRET = os.environ.get("RAZORPAY_KEY_SECRET", "TBF0856B5o1xQV5ONGk83Cg6") # Replace with your actual key secret or env var name

if RAZORPAY_KEY_ID == "YOUR_RAZORPAY_KEY_ID" or RAZORPAY_KEY_SECRET == "YOUR_RAZORPAY_KEY_SECRET":
    logger.warning("Razorpay Key ID or Key Secret is not configured. Payment functions will not work.")

razorpay_client = razorpay.Client(auth=(RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET))


# Helper to get project ID
def get_project_id():
    project_id = os.environ.get("GCP_PROJECT") # Firebase sets this
    if not project_id:
        project_id = "indexchecker-534db" # Fallback
    if not project_id:
        logger.error("Google Cloud Project ID could not be determined. Pub/Sub publishing will likely fail.")
        # Depending on strictness, you might raise an error or allow to proceed with a warning.
    return project_id

# --- Interfaces (as Pydantic models or TypedDicts for clarity, optional for runtime) ---
# For simplicity, we'll use dictionaries and rely on runtime checks or comments.

# Expected structure for Google API auth details from user's document.
# interface UserGoogleAuthDetails:
#   searchConsoleAccessToken: str
#   searchConsoleAccessTokenExpiryTime: int  # Timestamp (milliseconds since epoch)
#   searchConsoleRefreshToken: str # Added for token refresh

# --- Helper Functions ---

def _get_user_google_auth_details(user_id: str) -> dict | None:
    """
    Retrieves the user's Google API auth details from their document in the 'users' collection.
    Ensures 'searchConsoleAccessTokenExpiryTime' is an integer.
    Also fetches 'searchConsoleRefreshToken'.
    """
    user_doc_ref = DB.collection("users").document(user_id)
    user_doc = user_doc_ref.get()

    if not user_doc.exists:
        logger.warning(f"User document not found for user {user_id} at users/{user_id}")
        return None

    data = user_doc.to_dict()
    if not data:
        logger.error(f"User document data is empty for user {user_id}.")
        return None

    access_token = data.get("searchConsoleAccessToken")
    expiry_time_raw = data.get("searchConsoleAccessTokenExpiryTime")
    refresh_token = data.get("searchConsoleRefreshToken") # Added for token refresh

    if not access_token:
        logger.error(
            f"Missing 'searchConsoleAccessToken' in user document for {user_id}. Data: {data}"
        )
        return None

    if expiry_time_raw is None: # Explicitly check for None
        logger.error(
            f"Missing 'searchConsoleAccessTokenExpiryTime' in user document for {user_id}. Data: {data}"
        )
        return None
    
    # It's good practice to also check for refresh_token, though its absence might not always be an immediate error
    # if the access token is still valid. However, for refresh capability, it's essential.
    if not refresh_token:
        logger.warning(
            f"Missing 'searchConsoleRefreshToken' in user document for {user_id}. Token refresh will not be possible. Data: {data}"
        )
        # Depending on strictness, you might return None here or let it proceed if access token is valid.
        # For now, we'll allow it to proceed and handle refresh failure later if access token is expired.

    if isinstance(expiry_time_raw, datetime.datetime):
        expiry_time_int = int(expiry_time_raw.timestamp() * 1000)
        logger.info(f"Converted searchConsoleAccessTokenExpiryTime from datetime to int for user {user_id}.")
    elif isinstance(expiry_time_raw, (int, float)):
        expiry_time_int = int(expiry_time_raw)
    elif isinstance(expiry_time_raw, str):
        try:
            expiry_time_int = int(expiry_time_raw)
        except ValueError:
            logger.error(
                f"'searchConsoleAccessTokenExpiryTime' in user document for {user_id} is a string but not a valid integer: '{expiry_time_raw}'. Data: {data}"
            )
            return None
    else:
        logger.error(
            f"'searchConsoleAccessTokenExpiryTime' in user document for {user_id} is not a recognizable type (datetime, int, float, or string convertible to int). Type: {type(expiry_time_raw)}. Data: {data}"
        )
        return None

    return {
        "searchConsoleAccessToken": access_token,
        "searchConsoleAccessTokenExpiryTime": expiry_time_int,
        "searchConsoleRefreshToken": refresh_token # Added
    }

def _get_authenticated_gsc_client(auth_details: dict, user_id: str) -> Resource:
    """
    Creates a Google Search Console API client using the provided access token.
    Checks for token expiration and attempts to refresh if necessary.
    """
    access_token = auth_details.get("searchConsoleAccessToken")
    expiry_date_ms = auth_details.get("searchConsoleAccessTokenExpiryTime")
    refresh_token = auth_details.get("searchConsoleRefreshToken")

    if not access_token or not isinstance(expiry_date_ms, int): # refresh_token can be None initially if not fetched/stored
        logger.error(f"Invalid auth_details for GSC client for user {user_id}: {auth_details}")
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.FAILED_PRECONDITION,
            message="Internal error: Invalid Google authentication details provided for API client setup."
        )

    # Define client_id, client_secret, and token_uri.
    # These are needed for the Credentials object if a refresh might occur.
    # Using hardcoded values as per the original code structure.
    # Ideally, these should come from a secure configuration or environment variables.
    client_id = "146812028648-rr5q1301sdp1r8g6pjlcd26r8cnv6gf2.apps.googleusercontent.com"
    client_secret = "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"
    token_uri = 'https://oauth2.googleapis.com/token' # Standard token URI

    # Initialize credentials with all necessary information for potential refresh
    credentials = Credentials(
        token=access_token,
        refresh_token=refresh_token,
        token_uri=token_uri,
        client_id=client_id,
        client_secret=client_secret
    )

    # Check token expiry (expiry_date_ms is from Firestore)
    safety_margin_ms = 5 * 60 * 1000  # 5 minutes safety margin
    current_time_ms = int(datetime.datetime.now(datetime.timezone.utc).timestamp() * 1000)

    if expiry_date_ms < (current_time_ms + safety_margin_ms):
        logger.warning(
            f"Google access token for user {user_id} is expired or will expire shortly. Expiry (ms): {expiry_date_ms}, Current (ms): {current_time_ms}."
        )
        if credentials.refresh_token: # refresh_token was passed to Credentials constructor
            logger.info(f"Attempting to refresh Google access token for user {user_id}.")
            try:
                # Ensure client_id and client_secret are available (they are, from definitions above)
                if not client_id or not client_secret: # This check is against the defined values
                    logger.error(f"Server configuration error: Google OAuth client_id or client_secret is missing for user {user_id}.")
                    raise https_fn.HttpsError(
                        code=https_fn.FunctionsErrorCode.INTERNAL,
                        message="Server configuration error: Google OAuth client credentials not set."
                    )

                # The credentials object is already configured. Perform the refresh.
                credentials.refresh(GoogleAuthRequest())

                # Update Firestore with the new token and expiry
                new_access_token = credentials.token
                new_expiry_datetime = credentials.expiry # credentials.expiry is a datetime object
                new_expiry_ms = int(new_expiry_datetime.timestamp() * 1000)

                user_doc_ref = DB.collection("users").document(user_id)
                update_data = {
                    "searchConsoleAccessToken": new_access_token,
                    "searchConsoleAccessTokenExpiryTime": new_expiry_ms
                    # refresh_token usually remains the same, but some flows might issue a new one.
                    # If credentials.refresh_token changed, update it too.
                    # "searchConsoleRefreshToken": credentials.refresh_token 
                }
                # If a new refresh token was issued (rare for Google, but possible), update it too.
                if credentials.refresh_token != refresh_token: # Check if it changed
                    update_data["searchConsoleRefreshToken"] = credentials.refresh_token
                    logger.info(f"Google refresh token was updated for user {user_id}.")

                user_doc_ref.update(update_data)
                logger.info(f"Successfully refreshed Google access token for user {user_id}. New expiry (ms): {new_expiry_ms}")
                # Update auth_details in memory for the current operation if it's mutable and passed by reference,
                # or rely on the updated credentials object.
                auth_details["searchConsoleAccessToken"] = new_access_token
                auth_details["searchConsoleAccessTokenExpiryTime"] = new_expiry_ms
                if "searchConsoleRefreshToken" in update_data:
                     auth_details["searchConsoleRefreshToken"] = update_data["searchConsoleRefreshToken"]


            except GoogleRefreshError as e:
                error_message_str = str(e) # For logging
                error_args_tuple = getattr(e, 'args', None) # For logging and inspection

                logger.error(f"Failed to refresh Google access token for user {user_id}. Error: {error_message_str}, Args: {error_args_tuple}")

                user_facing_message = "Google API access token has expired, and refresh failed. Please re-authenticate via the application."
                
                # Check for 'invalid_grant' in the error details
                # Based on the log, e.args might be a tuple like:
                # ('description_string', {'error': 'invalid_grant', ...})
                if error_args_tuple and isinstance(error_args_tuple, tuple):
                    is_invalid_grant = False
                    # Check in the first element (string description)
                    if len(error_args_tuple) > 0 and isinstance(error_args_tuple[0], str) and 'invalid_grant' in error_args_tuple[0].lower():
                        is_invalid_grant = True
                    # Check in the second element (dict with error details)
                    if not is_invalid_grant and len(error_args_tuple) > 1 and isinstance(error_args_tuple[1], dict):
                        if error_args_tuple[1].get('error') == 'invalid_grant':
                            is_invalid_grant = True
                    
                    if is_invalid_grant:
                        user_facing_message = "Your authorization with Google is no longer valid. This can happen if access was revoked or the token has expired. Please re-authenticate via the application to continue."

                raise https_fn.HttpsError(
                    code=https_fn.FunctionsErrorCode.UNAUTHENTICATED,
                    message=user_facing_message
                )
            except Exception as e: # Catch any other errors during refresh
                logger.error(f"Unexpected error during token refresh for user {user_id}: {e}", exc_info=True) # Add exc_info=True for detailed traceback
                raise https_fn.HttpsError(
                    code=https_fn.FunctionsErrorCode.INTERNAL,
                    message=f"An unexpected error occurred while trying to refresh Google access token: {e}"
                )
        else:
            logger.warning(f"Google access token for user {user_id} is expired, and no refresh token is available.")
            raise https_fn.HttpsError(
                code=https_fn.FunctionsErrorCode.UNAUTHENTICATED,
                message="Google API access token has expired. No refresh token available. Please re-authenticate via the application."
            )
    
    # If token was valid or successfully refreshed, build the service
    try:
        # Use the potentially refreshed credentials object
        search_console_service = build('searchconsole', 'v1', credentials=credentials, cache_discovery=False)
        return search_console_service
    except Exception as e:
        logger.error(f"Failed to build Google Search Console client for user {user_id} after token check/refresh: {e}")
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.INTERNAL,
            message=f"Failed to initialize Google Search Console API client: {e}"
        )

@firestore.transactional
def _deduct_credits_in_transaction(transaction: firestore.Transaction, user_doc_ref: firestore.DocumentReference, amount_to_deduct: int, user_id_for_logging: str):
    """
    Deducts credits from a user's account within a Firestore transaction.
    Raises HttpsError if user not found or insufficient credits.
    """
    user_snapshot = user_doc_ref.get(transaction=transaction)
    if not user_snapshot.exists:
        logger.error(f"User document not found for user {user_id_for_logging} during credit deduction.") # Added log
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.NOT_FOUND,
            message="User record not found for credit deduction."
        )

    current_credits = user_snapshot.get('credits') or 0
    if current_credits < amount_to_deduct:
        logger.warning(f"Insufficient credits for user {user_id_for_logging}. Has: {current_credits}, Needs: {amount_to_deduct}")
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.RESOURCE_EXHAUSTED,
            message=f"Insufficient credits. This action requires {amount_to_deduct} credits, but you have {current_credits}."
        )
    transaction.update(user_doc_ref, {'credits': firestore.Increment(-amount_to_deduct)})
    logger.info(f"Successfully prepared deduction of {amount_to_deduct} credits for user {user_id_for_logging} in transaction.")


# --- Callable Function: getSiteIndexingStatus ---
@https_fn.on_call(
    timeout_sec=60, # Reduced timeout as it's now just queueing
    memory=options.MemoryOption.MB_256,
    cors=options.CorsOptions(
        cors_origins=[
            "http://localhost:5173",
            "https://indexchecker-534db.web.app",
            "https://indexchecker-534db.firebaseapp.com",
            "https://fea86b333f27.ngrok.app"
        ],
        cors_methods=["POST", "OPTIONS"]
    )
)
def get_site_indexing_status(req: https_fn.CallableRequest) -> dict:
    """
    Initiates the indexing status check for a siteUrl by publishing a task to Pub/Sub.
    """
    logger.info(f"get_site_indexing_status called with data: {req.data}, by user: {req.auth.uid if req.auth else 'No auth'}")

    if not req.auth:
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.UNAUTHENTICATED,
            message="The function must be called while authenticated."
        )
    user_id = req.auth.uid
    
    site_url = req.data.get("siteUrl")
    if not site_url:
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.INVALID_ARGUMENT,
            message="The function must be called with a \\'siteUrl\\' argument."
        )

    # --- Resolve siteId from siteUrl ---
    site_id_for_pages = None
    try:
        sites_query = DB.collection("sites").where("userId", "==", user_id).where("gscProperty", "==", site_url).limit(1)
        site_docs_list = list(sites_query.stream())
        if site_docs_list:
            site_id_for_pages = site_docs_list[0].id
            logger.info(f"Resolved siteId \'{site_id_for_pages}\' for siteUrl \'{site_url}\' (user: {user_id}).")
        else:
            logger.warning(f"Site not found for siteUrl '{site_url}' (user: {user_id}).")
            raise https_fn.HttpsError(
                code=https_fn.FunctionsErrorCode.NOT_FOUND,
                message=f"The site \'{site_url}\' is not registered under your account."
            )
    except Exception as e:
        logger.error(f"Error resolving siteId for siteUrl \'{site_url}\' (user: {user_id}): {e}", exc_info=True)
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.INTERNAL,
            message=f"An internal error occurred while verifying the site: {e}"
        )

    # --- Get User's Google Auth Details ---
    user_auth_details = _get_user_google_auth_details(user_id)
    if not user_auth_details:
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.FAILED_PRECONDITION,
            message="Google API authentication details not found or incomplete. Please reconnect your Google Account."
        )

    # --- Initialize Google Search Console API ---
    try:
        search_console = _get_authenticated_gsc_client(user_auth_details, user_id)
    except https_fn.HttpsError as e:
        logger.error(f"Failed to initialize Search Console client for user {user_id}: {e.message}")
        raise e
    except Exception as e:
        logger.error(f"Unexpected error initializing Search Console client for user {user_id}: {e}")
        raise https_fn.HttpsError(code=https_fn.FunctionsErrorCode.INTERNAL, message=f"Unexpected error initializing GSC client: {e}")

    # --- Fetch Sitemaps and Analytics URLs (to determine number of URLs) ---
    urls_to_inspect = []
    try:
        unique_urls_to_inspect = set()
        analytics_urls_count = 0
        sitemap_urls_count = 0
        logger.info(f"Fetching URLs from Search Analytics and Sitemaps for site: {site_url}, user: {user_id}")
        
        # 1. Fetch from Search Analytics
        try:
            end_date = datetime.date.today()
            start_date = end_date - datetime.timedelta(days=180)
            analytics_request_body = {
                "dimensions": ["page"],
                "startDate": start_date.strftime("%Y-%m-%d"),
                "endDate": end_date.strftime("%Y-%m-%d")
            }
            analytics_query_result = search_console.searchanalytics().query(siteUrl=site_url, body=analytics_request_body).execute()
            if analytics_query_result and 'rows' in analytics_query_result:
                for row in analytics_query_result['rows']:
                    if row.get('keys') and row['keys'][0]:
                        page_url = row['keys'][0]
                        if page_url not in unique_urls_to_inspect:
                            unique_urls_to_inspect.add(page_url)
                            analytics_urls_count +=1
                logger.info(f"Added {analytics_urls_count} URLs from search analytics for {site_url}.")
        except GoogleHttpError as ghe:
            logger.warning(f"Google API Error fetching search analytics for {site_url}: {ghe}. Proceeding with sitemaps.")
        except Exception as e:
            logger.warning(f"Error fetching search analytics for {site_url}: {e}. Proceeding with sitemaps.")

        # 2. Fetch from Sitemaps
        try:
            sitemaps_list_response = search_console.sitemaps().list(siteUrl=site_url).execute()
            if sitemaps_list_response and sitemaps_list_response.get('sitemap'):
                for sitemap_meta in sitemaps_list_response.get('sitemap'):
                    feedpath = sitemap_meta.get('path')
                    if not feedpath: continue
                    try:
                        sitemap_details = search_console.sitemaps().get(siteUrl=site_url, feedpath=feedpath).execute()
                        if sitemap_details and sitemap_details.get('contents'):
                            for content_entry in sitemap_details.get('contents'):
                                page_url = content_entry.get('path')
                                if page_url and page_url not in unique_urls_to_inspect:
                                    unique_urls_to_inspect.add(page_url)
                                    sitemap_urls_count += 1
                    except Exception as e_sitemap:
                        logger.error(f"Error processing sitemap {feedpath} for {site_url}: {e_sitemap}")
        except Exception as e_sitemaps_list:
            logger.warning(f"Error listing/processing sitemaps for {site_url}: {e_sitemaps_list}")
        
        urls_to_inspect = list(unique_urls_to_inspect)
        logger.info(f"Collected {len(urls_to_inspect)} unique URLs for {site_url} ({analytics_urls_count} from analytics, {sitemap_urls_count} new from sitemaps).")

    except GoogleHttpError as e:
        logger.error(f"Google API Error during URL collection for {site_url} (user {user_id}): {e}")
        raise https_fn.HttpsError(code=https_fn.FunctionsErrorCode.INTERNAL, message=f"GSC API Error during URL collection: {e._get_reason()}")
    except Exception as e:
        logger.error(f"Unexpected error during URL collection for {site_url} (user {user_id}): {e}", exc_info=True)
        raise https_fn.HttpsError(code=https_fn.FunctionsErrorCode.INTERNAL, message=f"Failed to collect URLs: {e}")

    if not urls_to_inspect:
        return {
            "status": "no_urls_found",
            "message": "No URLs found to inspect from Search Analytics or Sitemaps. Ensure the site has GSC activity or registered sitemaps.",
            "siteUrl": site_url,
        }

    # --- Pre-check Credits & Prepare for Background Task ---
    estimated_credits_to_use = len(urls_to_inspect) * CREDIT_PER_URL
    user_ref = DB.collection("users").document(user_id)
    
    try:
        user_doc = user_ref.get()
        if not user_doc.exists:
            raise https_fn.HttpsError(code=https_fn.FunctionsErrorCode.NOT_FOUND, message="User record not found for credit check.")
        current_credits = user_doc.to_dict().get('credits', 0)
        if current_credits < estimated_credits_to_use:
            raise https_fn.HttpsError(
                code=https_fn.FunctionsErrorCode.RESOURCE_EXHAUSTED,
                message=f"Insufficient credits. This action requires {estimated_credits_to_use} credits, but you have {current_credits}."
            )
    except https_fn.HttpsError:
        raise # Re-raise HttpsError
    except Exception as e:
        logger.error(f"Error during credit pre-check for user {user_id}: {e}")
        raise https_fn.HttpsError(code=https_fn.FunctionsErrorCode.INTERNAL, message="Failed to verify credits.")

    # --- Create Indexing History Record ---
    indexing_history_ref = DB.collection("indexingHistory").document()
    indexing_history_id = indexing_history_ref.id
    try:
        history_data = {
            "userId": user_id,
            "siteId": site_id_for_pages, # site_id_for_pages resolved earlier
            "siteUrl": site_url,
            "status": "pending", # This is fine, matches TS type
            "action": "check", # Added action field
            "pageId": "", # Added pageId for site-wide check
            "timestamp": firestore.SERVER_TIMESTAMP, # Use server timestamp
            "urlsToInspectCount": len(urls_to_inspect),
            "estimatedCredits": estimated_credits_to_use,
            "message": f"Indexing task for {len(urls_to_inspect)} URLs initiated."
        }
        indexing_history_ref.set(history_data)
        logger.info(f"Created indexingHistory record {indexing_history_id} for user {user_id}, site {site_url}.")
    except Exception as e:
        logger.error(f"Failed to create indexingHistory record for user {user_id}, site {site_url}: {e}", exc_info=True)
        # Proceed with Pub/Sub publish, but log this failure. The task won't have a history entry if this fails.
        # Depending on requirements, you might want to raise an error here.


    # --- Publish to Pub/Sub ---
    project_id = get_project_id()
    if not project_id:
         raise https_fn.HttpsError(code=https_fn.FunctionsErrorCode.INTERNAL, message="Project ID not configured for Pub/Sub.")

    publisher = pubsub_v1.PublisherClient()
    topic_path = publisher.topic_path(project_id, PUBSUB_TOPIC_ID)
    
    message_payload = {
        "userId": user_id,
        "siteUrl": site_url,
        "siteIdForPages": site_id_for_pages,
        "urlsToInspect": urls_to_inspect,
        "userAuthDetails": user_auth_details, # Contains tokens
        "creditsToDeduct": estimated_credits_to_use,
        "indexingHistoryId": indexing_history_id # Add indexingHistoryId
    }
    
    try:
        message_bytes = json.dumps(message_payload).encode("utf-8")
        future = publisher.publish(topic_path, data=message_bytes)
        future.result() # Wait for publish to complete
        logger.info(f"Successfully published indexing task for user {user_id}, site {site_url} with {len(urls_to_inspect)} URLs.")
    except Exception as e:
        logger.error(f"Failed to publish Pub/Sub message for user {user_id}, site {site_url}: {e}", exc_info=True)
        # Do not refund here as no credits were deducted yet.
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.INTERNAL,
            message=f"Failed to initiate indexing task: {e}"
        )

    return {
        "status": "pending",
        "message": f"Site indexing process for {len(urls_to_inspect)} URLs has been initiated. This will use approximately {estimated_credits_to_use} credits.",
        "siteUrl": site_url,
        "urlsQueued": len(urls_to_inspect),
        "estimatedCredits": estimated_credits_to_use
    }


# --- Callable Function: requestSiteReindexing ---
@https_fn.on_call(
    timeout_sec=60,
    memory=options.MemoryOption.MB_256,
    cors=options.CorsOptions(
        cors_origins=[
            "http://localhost:5173",
            "https://indexchecker-534db.web.app",
            "https://indexchecker-534db.firebaseapp.com",
            "https://fea86b333f27.ngrok.app"
        ],
        cors_methods=["POST", "OPTIONS"]
    )
)
def request_site_reindexing(req: https_fn.CallableRequest) -> dict:
    """
    Initiates a re-indexing request for non-indexed pages of a site by publishing a task to Pub/Sub.
    """
    logger.info(f"request_site_reindexing called with data: {req.data}, by user: {req.auth.uid if req.auth else 'No auth'}")

    if not req.auth:
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.UNAUTHENTICATED,
            message="The function must be called while authenticated."
        )
    user_id = req.auth.uid
    
    site_url_from_req = req.data.get("siteUrl")
    if not site_url_from_req:
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.INVALID_ARGUMENT,
            message="The function must be called with a \\'siteUrl\\' argument."
        )

    # --- Resolve siteId from siteUrl ---
    site_id_for_pages = None
    try:
        sites_query = DB.collection("sites").where("userId", "==", user_id).where("gscProperty", "==", site_url_from_req).limit(1)
        site_docs_list = list(sites_query.stream())
        if site_docs_list:
            site_id_for_pages = site_docs_list[0].id
            logger.info(f"Resolved siteId '{site_id_for_pages}' for siteUrl '{site_url_from_req}' (user: {user_id})")
        else:
            logger.warning(f"No site found for gscProperty '{site_url_from_req}' and user '{user_id}'. Cannot determine siteId.")
            raise https_fn.HttpsError(
                code=https_fn.FunctionsErrorCode.NOT_FOUND,
                message=f"Site with URL '{site_url_from_req}' not found or not associated with your account."
            )
    except Exception as e:
        logger.error(f"Error resolving siteId for siteUrl '{site_url_from_req}' (user: {user_id}): {e}", exc_info=True)
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.INTERNAL,
            message=f"An internal error occurred while verifying the site: {e}"
        )

    # --- Fetch Non-Indexed URLs for the Site ---
    urls_to_reindex = []
    try:
        logger.info(f"Fetching non-indexed pages for siteId '{site_id_for_pages}', user '{user_id}'.")
        # GSC Verdicts: PASS, FAIL, NEUTRAL, PARTIAL, UNKNOWN_VERDICT
        # We consider pages that are not 'PASS' as candidates for re-indexing.
        # Also exclude pages where inspection itself failed (e.g., ERROR_GSC_API, ERROR_INSPECTION_GENERIC)
        # as re-requesting indexing for them might not be useful without fixing the underlying issue.
        pages_query = DB.collection("pages").where("userId", "==", user_id).where("siteId", "==", site_id_for_pages)
        
        non_indexed_pages_docs = [
            doc for doc in pages_query.stream() 
            if doc.to_dict().get("status") not in ["PASS", "REINDEX_REQUESTED"] and not str(doc.to_dict().get("status", "")).startswith("ERROR_")
        ]

        if non_indexed_pages_docs:
            urls_to_reindex = [doc.to_dict()["pageUrl"] for doc in non_indexed_pages_docs if "pageUrl" in doc.to_dict()]
            logger.info(f"Found {len(urls_to_reindex)} non-indexed URLs for siteId '{site_id_for_pages}'.")
        else:
            logger.info(f"No non-indexed URLs found for siteId '{site_id_for_pages}' that require re-indexing.")
            return {
                "status": "no_urls_to_reindex",
                "message": "No pages found that require a re-indexing request for this site.",
                "siteUrl": site_url_from_req,
            }
    except Exception as e:
        logger.error(f"Error fetching non-indexed pages for siteId '{site_id_for_pages}' (user: {user_id}): {e}", exc_info=True)
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.INTERNAL,
            message=f"Failed to retrieve page list for re-indexing: {e}"
        )

    if not urls_to_reindex:
        return {
            "status": "no_urls_found", # Consistent with get_site_indexing_status
            "message": "No URLs found requiring a re-indexing request for this site.",
            "siteUrl": site_url_from_req,
        }

    # --- Get User's Google Auth Details (needed for Pub/Sub worker) ---
    user_auth_details = _get_user_google_auth_details(user_id)
    if not user_auth_details: # This check is also in _get_authenticated_gsc_client but good to have early
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.FAILED_PRECONDITION,
            message="Google API authentication details not found or incomplete. Please reconnect your Google Account."
        )
        
    # --- Pre-check Credits ---
    estimated_credits_to_use = len(urls_to_reindex) * CREDIT_PER_REINDEX_URL
    user_ref = DB.collection("users").document(user_id)
    
    if estimated_credits_to_use > 0: # Only check if there's a cost
        try:
            user_doc = user_ref.get()
            if not user_doc.exists:
                raise https_fn.HttpsError(code=https_fn.FunctionsErrorCode.NOT_FOUND, message="User record not found for credit check.")
            current_credits = user_doc.to_dict().get('credits', 0)
            if current_credits < estimated_credits_to_use:
                raise https_fn.HttpsError(
                    code=https_fn.FunctionsErrorCode.RESOURCE_EXHAUSTED,
                    message=f"Insufficient credits. This action requires {estimated_credits_to_use} credits, but you have {current_credits}."
                )
        except https_fn.HttpsError:
            raise 
        except Exception as e:
            logger.error(f"Error during credit pre-check for user {user_id} (re-indexing): {e}")
            raise https_fn.HttpsError(code=https_fn.FunctionsErrorCode.INTERNAL, message="Failed to verify credits for re-indexing.")

    # --- Create Indexing History Record ---
    indexing_history_ref = DB.collection("indexingHistory").document()
    indexing_history_id = indexing_history_ref.id
    try:
        history_data = {
            "userId": user_id,
            "siteId": site_id_for_pages,
            "siteUrl": site_url_from_req, # Use the gscProperty URL
            "status": "pending",
            "action": "reindex", # New action type
            "pageId": "", # Not applicable for multi-URL reindex request
            "timestamp": firestore.SERVER_TIMESTAMP,
            "urlsToProcessCount": len(urls_to_reindex), # Renamed for clarity
            "estimatedCredits": estimated_credits_to_use,
            "message": f"Re-indexing task for {len(urls_to_reindex)} URLs initiated."
        }
        indexing_history_ref.set(history_data)
        logger.info(f"Created indexingHistory record {indexing_history_id} for re-indexing (user {user_id}, site {site_url_from_req}).")
    except Exception as e:
        logger.error(f"Failed to create indexingHistory record for re-indexing (user {user_id}, site {site_url_from_req}): {e}", exc_info=True)
        # Proceed, but log. Task won't have history if this fails.

    # --- Publish to Pub/Sub ---
    project_id = get_project_id()
    if not project_id:
         raise https_fn.HttpsError(code=https_fn.FunctionsErrorCode.INTERNAL, message="Project ID not configured for Pub/Sub.")

    publisher = pubsub_v1.PublisherClient()
    topic_path = publisher.topic_path(project_id, REINDEX_PUBSUB_TOPIC_ID) # Use new topic
    
    message_payload = {
        "userId": user_id,
        "siteUrl": site_url_from_req, # gscProperty
        "siteIdForPages": site_id_for_pages,
        "urlsToReindex": urls_to_reindex,
        "userAuthDetails": user_auth_details,
        "creditsToDeduct": estimated_credits_to_use,
        "indexingHistoryId": indexing_history_id
    }
    
    try:
        message_bytes = json.dumps(message_payload).encode("utf-8")
        future = publisher.publish(topic_path, data=message_bytes)
        future.result() 
        logger.info(f"Successfully published re-indexing task for user {user_id}, site {site_url_from_req} with {len(urls_to_reindex)} URLs.")
    except Exception as e:
        logger.error(f"Failed to publish Pub/Sub message for re-indexing (user {user_id}, site {site_url_from_req}): {e}", exc_info=True)
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.INTERNAL,
            message=f"Failed to initiate re-indexing task: {e}"
        )

    return {
        "status": "pending",
        "message": f"Re-indexing request for {len(urls_to_reindex)} URLs has been initiated. This will use approximately {estimated_credits_to_use} credits.",
        "siteUrl": site_url_from_req,
        "urlsQueued": len(urls_to_reindex),
        "estimatedCredits": estimated_credits_to_use
    }


# --- Callable Function: createRazorpayOrder ---
@https_fn.on_call(
    cors=options.CorsOptions(
        cors_origins=[
            "http://localhost:5173",
            "https://indexchecker-534db.web.app",
            "https://indexchecker-534db.firebaseapp.com",
            "https://fea86b333f27.ngrok.app" # Add your ngrok or other dev URLs
        ],
        cors_methods=["POST", "OPTIONS"]
    )
)
def create_razorpay_order(req: https_fn.CallableRequest) -> dict:
    """
    Creates a Razorpay order for purchasing credits.
    Expects: { amount: float, currency: str (e.g., "USD"), packageId: str, packageName: str }
    """
    if not req.auth:
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.UNAUTHENTICATED,
            message="The function must be called while authenticated."
        )
    user_id = req.auth.uid

    amount = req.data.get("amount") # Amount in the smallest currency unit (e.g., cents for USD)
    currency = req.data.get("currency")
    package_id = req.data.get("packageId") # For receipt and tracking
    package_name = req.data.get("packageName") # For receipt

    if not isinstance(amount, (int, float)) or amount <= 0:
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.INVALID_ARGUMENT,
            message="Invalid 'amount' provided."
        )
    if currency != "USD": # Example: Enforce USD, or make configurable
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.INVALID_ARGUMENT,
            message="Invalid 'currency' provided. Only USD is supported currently."
        )
    if not package_id or not package_name:
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.INVALID_ARGUMENT,
            message="Missing 'packageId' or 'packageName'."
        )

    # Convert amount to paise (or cents) as Razorpay expects the smallest currency unit
    # For USD, amount should be in cents.
    amount_in_smallest_unit = int(amount * 100)

    order_data = {
        "amount": amount_in_smallest_unit,
        "currency": currency,
        "notes": {
            "userId": user_id,
            "packageId": package_id,
            "packageName": package_name,
            "originalAmount": amount, # Store original amount for clarity
        }
    }

    try:
        logger.info(f"Creating Razorpay order for user {user_id} with data: {order_data}")
        order = razorpay_client.order.create(data=order_data)
        logger.info(f"Razorpay order created successfully for user {user_id}: {order['id']}")
        return {
            "success": True,
            "orderId": order["id"],
            "amount": order["amount"], # Amount in smallest unit
            "currency": order["currency"],
            "razorpayKeyId": RAZORPAY_KEY_ID # Send key ID to client for Razorpay SDK
        }
    except Exception as e:
        logger.error(f"Error creating Razorpay order for user {user_id}: {e}", exc_info=True)
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.INTERNAL,
            message=f"Failed to create Razorpay order: {str(e)}"
        )

# --- Callable Function: verifyRazorpayPayment ---
@https_fn.on_call(
    cors=options.CorsOptions(
        cors_origins=[
            "http://localhost:5173",
            "https://indexchecker-534db.web.app",
            "https://indexchecker-534db.firebaseapp.com",
            "https://fea86b333f27.ngrok.app" # Add your ngrok or other dev URLs
        ],
        cors_methods=["POST", "OPTIONS"]
    )
)
def verify_razorpay_payment(req: https_fn.CallableRequest) -> dict:
    """
    Verifies a Razorpay payment and adds credits to the user's account.
    Expects: {
        razorpay_payment_id: str,
        razorpay_order_id: str,
        razorpay_signature: str,
        packageId: str, // To fetch package details for credits
        creditsToAdd: int, // Number of credits to add
        amountPaid: float // Amount paid in major currency unit (e.g., USD)
    }
    """
    if not req.auth:
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.UNAUTHENTICATED,
            message="The function must be called while authenticated."
        )
    user_id = req.auth.uid

    payment_id = req.data.get("razorpay_payment_id")
    order_id = req.data.get("razorpay_order_id")
    signature = req.data.get("razorpay_signature")
    package_id = req.data.get("packageId")
    credits_to_add = req.data.get("creditsToAdd")
    amount_paid = req.data.get("amountPaid") # e.g. 10 for $10

    if not all([payment_id, order_id, signature, package_id, credits_to_add, amount_paid]):
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.INVALID_ARGUMENT,
            message="Missing required payment verification details."
        )
    
    if not isinstance(credits_to_add, int) or credits_to_add <= 0:
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.INVALID_ARGUMENT,
            message="Invalid 'creditsToAdd' provided."
        )
    
    if not isinstance(amount_paid, (int, float)) or amount_paid <= 0:
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.INVALID_ARGUMENT,
            message="Invalid 'amountPaid' provided."
        )

    params_dict = {
        'razorpay_order_id': order_id,
        'razorpay_payment_id': payment_id,
        'razorpay_signature': signature
    }

    try:
        logger.info(f"Verifying Razorpay payment for user {user_id}, order {order_id}, payment {payment_id}")
        razorpay_client.utility.verify_payment_signature(params_dict)
        logger.info(f"Razorpay payment signature verified successfully for user {user_id}, order {order_id}")

        # Signature is verified, now add credits and record transaction
        user_ref = DB.collection("users").document(user_id)
        
        # Use a transaction to ensure atomicity
        transaction = DB.transaction()

        @firestore.transactional
        def _update_credits_and_log_transaction(trans: firestore.Transaction, user_doc_ref: firestore.DocumentReference):
            user_snapshot = user_doc_ref.get(transaction=trans)
            if not user_snapshot.exists:
                logger.error(f"User document not found for user {user_id} during credit update.")
                # This case should ideally not happen if user is authenticated and exists
                raise Exception("User record not found for credit update.")

            # Add credits
            trans.update(user_doc_ref, {"credits": firestore.Increment(credits_to_add)})

            # Log the credit transaction
            transaction_ref = DB.collection("creditTransactions").document()
            trans.set(transaction_ref, {
                "userId": user_id,
                "credits": credits_to_add,
                "timestamp": firestore.SERVER_TIMESTAMP,
                "type": "purchase",
                "reason": f"Purchased package: {package_id}",
                "packageId": package_id,
                "paymentId": payment_id, # Razorpay payment ID
                "orderId": order_id,     # Razorpay order ID
                "amount": amount_paid,   # Amount in major currency unit (e.g., USD)
                "currency": "USD"        # Assuming USD
            })
            logger.info(f"Successfully prepared credit update and transaction log for user {user_id} in transaction.")

        _update_credits_and_log_transaction(transaction, user_ref)
        
        logger.info(f"Successfully added {credits_to_add} credits to user {user_id} for package {package_id}.")
        return {"success": True, "message": "Payment verified and credits added successfully."}

    except razorpay.errors.SignatureVerificationError as sve:
        logger.error(f"Razorpay signature verification failed for user {user_id}, order {order_id}: {sve}")
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.UNAUTHENTICATED, # Or PERMISSION_DENIED
            message="Payment verification failed: Invalid signature."
        )
    except Exception as e:
        logger.error(f"Error verifying Razorpay payment or updating credits for user {user_id}: {e}", exc_info=True)
        # Potentially, if signature was verified but Firestore update failed, this needs careful handling (e.g., manual check)
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.INTERNAL,
            message=f"Failed to verify payment or update credits: {str(e)}"
        )


# --- Pub/Sub Triggered Function: execute_site_indexing ---
@pubsub_fn.on_message_published(
    topic=PUBSUB_TOPIC_ID,
    timeout_sec=540, # Max timeout for Pub/Sub triggered functions
    memory=options.MemoryOption.MB_512, # Adjust as needed for GSC client and processing
    # region="your-region" # Specify if not default
)
def execute_site_indexing(event: pubsub_fn.CloudEvent[pubsub_fn.MessagePublishedData]) -> None:
    """
    Background function to process site indexing tasks from Pub/Sub.
    """
    try:
        message_data_bytes = event.data.message.data
        message_data_str = base64.b64decode(message_data_bytes).decode('utf-8')
        payload = json.loads(message_data_str)
        
        user_id = payload["userId"]
        site_url = payload["siteUrl"]
        site_id_for_pages = payload["siteIdForPages"]
        urls_to_inspect = payload["urlsToInspect"]
        user_auth_details = payload["userAuthDetails"] # Contains tokens
        credits_to_deduct = payload["creditsToDeduct"]
        indexing_history_id = payload.get("indexingHistoryId") # Get indexingHistoryId

        logger.info(f"execute_site_indexing started for user {user_id}, site {site_url}. URLs: {len(urls_to_inspect)}, Credits: {credits_to_deduct}, HistoryID: {indexing_history_id}")

    except Exception as e:
        logger.error(f"Failed to parse Pub/Sub message: {e}", exc_info=True)
        # Cannot easily notify user or refund if basic payload parsing fails.
        return # Stop processing if payload is malformed

    user_ref = DB.collection("users").document(user_id)
    credits_deducted_successfully = False

    # --- Update Indexing History Helper ---
    def update_indexing_history(history_id: str | None, status: str, message: str, additional_data: dict | None = None):
        if not history_id:
            logger.warning(f"No indexingHistoryId provided, cannot update history for user {user_id}, site {site_url}.")
            return
        try:
            history_ref = DB.collection("indexingHistory").document(history_id)
            # Corrected logic: Initialize payload without creditsUsed, add it only if explicitly passed.
            update_payload = {
                "status": status,
                "message": message,
                "updatedAt": firestore.SERVER_TIMESTAMP
            }
            if additional_data:
                if "creditsUsed" in additional_data and additional_data["creditsUsed"] is not None:
                    update_payload["creditsUsed"] = additional_data.pop("creditsUsed")
                
                # Merge any other relevant fields from additional_data
                update_payload.update(additional_data)
            
            history_ref.update(update_payload)
            logger.info(f"Updated indexingHistory {history_id} to status {status} for user {user_id}, site {site_url}.")
        except Exception as e_hist:
            logger.error(f"Failed to update indexingHistory {history_id} for user {user_id}, site {site_url}: {e_hist}", exc_info=True)

    # --- 1. Credit Deduction ---
    if credits_to_deduct > 0: # Only deduct if there's a cost
        try:
            transaction = DB.transaction()
            _deduct_credits_in_transaction(transaction, user_ref, credits_to_deduct, user_id)
            # Transaction is committed automatically if _deduct_credits_in_transaction doesn't raise.
            credits_deducted_successfully = True
            logger.info(f"Successfully deducted {credits_to_deduct} credits for user {user_id} for site {site_url}.")
            # Update history after successful deduction (or if no deduction needed)
            if indexing_history_id: # Check if ID exists
                 update_indexing_history(indexing_history_id, "pending", f"Successfully deducted {credits_to_deduct} credits. Starting GSC processing.", {"creditsUsed": credits_to_deduct if credits_to_deduct > 0 else 0})

        except https_fn.HttpsError as e:
            logger.error(f"Credit deduction HttpsError for user {user_id}, site {site_url}: {e.message}. Task will not proceed.")
            update_indexing_history(indexing_history_id, "failed", f"Credit deduction failed: {e.message}", {"completedAt": firestore.SERVER_TIMESTAMP})
            return # Stop processing
        except Exception as e:
            logger.error(f"Generic credit deduction failed for user {user_id}, site {site_url}: {e}", exc_info=True)
            update_indexing_history(indexing_history_id, "failed", f"Credit deduction failed: {str(e)}", {"completedAt": firestore.SERVER_TIMESTAMP})
            return # Stop processing
    else:
        logger.info(f"No credits to deduct for user {user_id}, site {site_url} (credits_to_deduct={credits_to_deduct}).")
        credits_deducted_successfully = True # Effectively, as no deduction was needed.
        if indexing_history_id: # Check if ID exists
            update_indexing_history(indexing_history_id, "pending", "No credits to deduct. Starting GSC processing.", {"creditsUsed": 0})


    # --- 2. Initialize Google Search Console API ---
    search_console = None
    try:
        search_console = _get_authenticated_gsc_client(user_auth_details, user_id)
    except https_fn.HttpsError as e:
        logger.error(f"Failed to initialize Search Console client for user {user_id} (site {site_url}): {e.message}")
        if credits_deducted_successfully and credits_to_deduct > 0:
            user_ref.update({"credits": firestore.Increment(credits_to_deduct)})
            logger.info(f"Rolled back {credits_to_deduct} credits for user {user_id} due to GSC client init failure for site {site_url}.")
        update_indexing_history(indexing_history_id, "failed", f"GSC client initialization failed: {e.message}", {"completedAt": firestore.SERVER_TIMESTAMP, "creditsRolledBack": credits_deducted_successfully and credits_to_deduct > 0})
        return # Stop processing
    except Exception as e:
        logger.error(f"Unexpected error initializing GSC client for user {user_id} (site {site_url}): {e}", exc_info=True)
        if credits_deducted_successfully and credits_to_deduct > 0:
            user_ref.update({"credits": firestore.Increment(credits_to_deduct)})
            logger.info(f"Rolled back {credits_to_deduct} credits for user {user_id} due to unexpected GSC client init failure for site {site_url}.")
        update_indexing_history(indexing_history_id, "failed", f"Unexpected GSC client initialization error: {str(e)}", {"completedAt": firestore.SERVER_TIMESTAMP, "creditsRolledBack": credits_deducted_successfully and credits_to_deduct > 0})
        return # Stop processing

    current_timestamp = datetime.datetime.now(datetime.timezone.utc)

    # --- 3. Inspect URLs & Store Results ---
    total_pages_inspected_count = 0 # Renamed from total_pages_inspected to avoid confusion
    indexed_pages_count = 0
    urls_inspection_details = {} # Stores URL -> verdict

    if not urls_to_inspect:
        logger.info(f"No URLs to inspect were provided in the payload for user {user_id}, site {site_url}.")
        # Potentially update a task status in Firestore to 'completed_no_urls'
        update_indexing_history(indexing_history_id, "successful", "No URLs were provided in the payload to inspect.", {"completedAt": firestore.SERVER_TIMESTAMP, "urlsInspectedCount": 0, "indexedPagesCount": 0})
        return

    logger.info(f"Inspecting {len(urls_to_inspect)} URLs for site: {site_url}, user: {user_id}")
    for url_to_inspect in urls_to_inspect:
        try:
            time.sleep(0.25) # Slightly increased delay, QPS is per project/user for GSC API.
            inspection_result = search_console.urlInspection().index().inspect(
                body={"inspectionUrl": url_to_inspect, "siteUrl": site_url}
            ).execute()
            verdict = inspection_result.get("inspectionResult", {}).get("indexStatusResult", {}).get("verdict", "UNKNOWN_VERDICT")
            urls_inspection_details[url_to_inspect] = verdict
            if verdict in ["PASS"]:
                indexed_pages_count += 1
            total_pages_inspected_count +=1 # Count URLs for which inspection was attempted
        except GoogleHttpError as inspect_error:
            logger.error(f"Google API Error inspecting URL {url_to_inspect} for site {site_url} (user {user_id}): {inspect_error}")
            urls_inspection_details[url_to_inspect] = f"ERROR_GSC_API: {inspect_error.resp.status}"
        except Exception as e:
            logger.error(f"Generic error inspecting URL {url_to_inspect} for site {site_url} (user {user_id}): {e}", exc_info=True)
            urls_inspection_details[url_to_inspect] = "ERROR_INSPECTION_GENERIC"
    
    logger.info(f"Inspection complete for {site_url} (user {user_id}). Attempted: {total_pages_inspected_count}, Indexed/Neutral: {indexed_pages_count}/{len(urls_to_inspect)}")

    # --- 4. Store Inspected Pages in Firestore ---
    if urls_inspection_details:
        batch = DB.batch()
        site_pages_collection_ref = DB.collection("pages")
        # current_timestamp = datetime.datetime.now(datetime.timezone.utc) # MOVED
        pages_batched_count = 0

        for page_url, status_verdict in urls_inspection_details.items():
            page_doc_ref = site_pages_collection_ref.document() # Auto-generate ID
            page_data = {
                "userId": user_id,
                "siteUrl": site_url,
                "siteId": site_id_for_pages,
                "pageUrl": page_url,
                "status": status_verdict, # This now includes error statuses for specific URLs
                "lastCheckedAt": current_timestamp,
            }
            batch.set(page_doc_ref, page_data)
            pages_batched_count += 1
        
        if pages_batched_count > 0:
            try:
                batch.commit()
                logger.info(f"Successfully committed {pages_batched_count} page inspection results to Firestore for site {site_url}, user {user_id}.")
                # Potentially update a task status in Firestore to 'completed_success'
            except Exception as e:
                logger.error(f"Error committing batch of {pages_batched_count} pages for user {user_id}, site {site_url}: {e}", exc_info=True)
                # Credits are NOT rolled back here as GSC work was done. This is a data storage failure.
                # Potentially update a task status in Firestore to 'completed_storage_failure'
                # Update indexing history to reflect storage failure but GSC work done
                update_indexing_history(
                    indexing_history_id, 
                    "failed", 
                    f"Inspection completed ({indexed_pages_count}/{total_pages_inspected_count} indexed), but failed to store all page details: {str(e)}",
                    {
                        "completedAt": firestore.SERVER_TIMESTAMP,
                        "urlsInspectedCount": total_pages_inspected_count,
                        "indexedPagesCount": indexed_pages_count
                    }
                )
        else:
            logger.info(f"No page inspection results to store in Firestore for site {site_url}, user {user_id} (urls_inspection_details was populated but no pages batched).")
    else:
        logger.info(f"urls_inspection_details was empty. No page inspection results to store for site {site_url}, user {user_id}.")
        # This case implies urls_to_inspect might have been non-empty, but all inspections failed before populating urls_inspection_details,
        # or urls_to_inspect was empty from the start (handled earlier).
        # If total_pages_inspected_count is 0 and urls_to_inspect was not, it means all attempts failed.
        if total_pages_inspected_count == 0 and len(urls_to_inspect) > 0:
             update_indexing_history(
                indexing_history_id, 
                "failed", 
                f"All {len(urls_to_inspect)} URL inspections failed. No results to store.",
                {
                    "completedAt": firestore.SERVER_TIMESTAMP,
                    "urlsInspectedCount": 0,
                    "indexedPagesCount": 0
                }
            )
        # If urls_to_inspect was empty, it's already handled. If some were inspected but none had details (unlikely), it's a partial success.

    # --- 5. Update the parent Site Document ---
    if site_id_for_pages: # site_id_for_pages comes from the Pub/Sub message payload
        site_doc_ref = DB.collection("sites").document(site_id_for_pages)
        try:
            num_requested_urls = len(urls_to_inspect)
            num_actually_inspected = total_pages_inspected_count # URLs for which GSC API call was made

            final_status_for_site_doc = "successful"
            scan_message = ""

            history_status_update = "successful" # Default for history

            if num_actually_inspected == 0 and num_requested_urls > 0:
                final_status_for_site_doc = "error" 
                scan_message = f"Scan failed: Could not inspect any of the {num_requested_urls} URLs."
                history_status_update = "failed"
            elif any("ERROR_" in str(status_val) for status_val in urls_inspection_details.values()):
                final_status_for_site_doc = "completed_with_errors"
                scan_message = f"Scan completed with errors: {indexed_pages_count}/{num_actually_inspected} indexed. Some URL inspections failed."
                history_status_update = "failed"
            elif num_actually_inspected < num_requested_urls: 
                final_status_for_site_doc = "completed_partial_inspection"
                scan_message = f"Scan partially completed: {indexed_pages_count}/{num_actually_inspected} indexed. Only {num_actually_inspected}/{num_requested_urls} URLs processed."
                history_status_update = "failed"
            else: 
                final_status_for_site_doc = "completed"
                if num_actually_inspected == 0 : 
                     scan_message = "Scan completed: No URLs to inspect."
                     history_status_update = "successful" # Matches completed_no_urls logic
                else:
                     scan_message = f"Scan completed: {indexed_pages_count}/{num_actually_inspected} pages indexed/neutral."
                     history_status_update = "successful"
            
            site_update_data = {
                "indexedPages": indexed_pages_count,
                "totalPages": num_actually_inspected,
                "lastScan": current_timestamp, # Use the timestamp defined earlier
                "lastScanStatus": final_status_for_site_doc,
                "lastScanMessage": scan_message
            }
            
            site_doc_ref.update(site_update_data)
            logger.info(f"Successfully updated site document '{site_id_for_pages}' for user '{user_id}' with final scan results: Status '{final_status_for_site_doc}'.")
            
            # Update indexingHistory with the final status from site document logic
            update_indexing_history(
                indexing_history_id,
                history_status_update, # Use the mapped status
                scan_message, # Detailed message from site update logic
                {
                    "completedAt": firestore.SERVER_TIMESTAMP, # Use the same timestamp as site doc if possible, or new one
                    "urlsInspectedCount": num_actually_inspected,
                    "indexedPagesCount": indexed_pages_count,
                    # "totalPagesForSite": num_actually_inspected # This is total pages *inspected in this run*
                }
            )

        except Exception as e:
            logger.error(f"Error updating site document '{site_id_for_pages}' for user '{user_id}': {e}", exc_info=True)
            # Update indexing history to reflect site update failure
            update_indexing_history(
                indexing_history_id,
                "failed",
                f"Inspections done ({indexed_pages_count}/{total_pages_inspected_count} indexed), but failed to update site summary: {str(e)}",
                {
                    "completedAt": firestore.SERVER_TIMESTAMP,
                    "urlsInspectedCount": total_pages_inspected_count, # Assuming total_pages_inspected_count is accurate
                    "indexedPagesCount": indexed_pages_count
                }
            )
    else:
        logger.warning(f"site_id_for_pages was missing or empty in the payload. Cannot update parent site document stats for user '{user_id}', siteUrl '{site_url}'.")
        # If site_id_for_pages is missing, we can still update indexingHistory if ID is present
        if indexing_history_id:
            # Determine a status based on inspection results if site update is skipped
            final_history_status_mapped = "failed" # Default to failed
            final_history_message = f"Scan processed {total_pages_inspected_count} URLs ({indexed_pages_count} indexed/neutral). Site summary not updated as siteId was missing."
            
            if total_pages_inspected_count == 0 and len(urls_to_inspect) > 0:
                final_history_status_mapped = "failed"
                final_history_message = f"All {len(urls_to_inspect)} URL inspections failed. Site summary not updated (siteId missing)."
            elif any("ERROR_" in str(status_val) for status_val in urls_inspection_details.values()):
                final_history_status_mapped = "failed"
                # Keep message as is, or specialize for "completed_with_errors"
            elif total_pages_inspected_count > 0 :
                final_history_status_mapped = "successful"
            # If final_history_status was "unknown", it defaults to "failed" here.
            
            update_indexing_history(
                indexing_history_id,
                final_history_status_mapped,
                final_history_message,
                {
                    "completedAt": firestore.SERVER_TIMESTAMP,
                    "urlsInspectedCount": total_pages_inspected_count,
                    "indexedPagesCount": indexed_pages_count
                }
            )


    # Final log for the background task
    logger.info(f"execute_site_indexing finished for user {user_id}, site {site_url}. Processed {total_pages_inspected_count} of {len(urls_to_inspect)} URLs. Indexed/Neutral: {indexed_pages_count}.")
    # Note: The original return structure with detailed counts is no longer directly returned to the HTTP caller.
    # This information is now logged by the background function and stored in Firestore.
    # If you need to communicate completion status back to the user, consider writing to a 'tasks' collection in Firestore
    # that the frontend can monitor, or use another notification mechanism.


# --- Pub/Sub Triggered Function: execute_site_reindexing ---
@pubsub_fn.on_message_published(
    topic=REINDEX_PUBSUB_TOPIC_ID, # New topic
    timeout_sec=540, 
    memory=options.MemoryOption.MB_256, # Likely less memory needed than full inspection
)
def execute_site_reindexing(event: pubsub_fn.CloudEvent[pubsub_fn.MessagePublishedData]) -> None:
    """
    Background function to process site re-indexing tasks from Pub/Sub.
    Uses the Google Indexing API to request re-indexing.
    """
    try:
        message_data_bytes = event.data.message.data
        message_data_str = base64.b64decode(message_data_bytes).decode('utf-8')
        payload = json.loads(message_data_str)
        
        user_id = payload["userId"]
        site_url = payload["siteUrl"] # This is gscProperty
        site_id_for_pages = payload["siteIdForPages"]
        urls_to_reindex = payload["urlsToReindex"]
        user_auth_details = payload["userAuthDetails"] # Contains tokens
        credits_to_deduct = payload["creditsToDeduct"]
        indexing_history_id = payload.get("indexingHistoryId")

        logger.info(f"execute_site_reindexing started for user {user_id}, site {site_url}. URLs: {len(urls_to_reindex)}, Credits: {credits_to_deduct}, HistoryID: {indexing_history_id}")

    except Exception as e:
        logger.error(f"Failed to parse Pub/Sub message for re-indexing: {e}", exc_info=True)
        return 

    user_ref = DB.collection("users").document(user_id)
    credits_deducted_successfully = False

    # --- Update Indexing History Helper (specific for re-indexing or adapt existing one) ---
    def update_reindex_history(history_id: str | None, status: str, message: str, additional_data: dict | None = None):
        if not history_id:
            logger.warning(f"No indexingHistoryId provided, cannot update re-index history for user {user_id}, site {site_url}.")
            return
        try:
            history_ref = DB.collection("indexingHistory").document(history_id)
            update_payload = {
                "status": status,
                "message": message,
                "updatedAt": firestore.SERVER_TIMESTAMP
            }
            if additional_data: # Ensure creditsUsed is handled correctly
                if "creditsUsed" in additional_data and additional_data["creditsUsed"] is not None :
                     # If credits_to_deduct was 0, this ensures creditsUsed is set to 0 not an Increment object
                    update_payload["creditsUsed"] = additional_data.pop("creditsUsed")

                update_payload.update(additional_data)
            
            history_ref.update(update_payload)
            logger.info(f"Updated re-indexing history {history_id} to status {status} for user {user_id}, site {site_url}.")
        except Exception as e_hist:
            logger.error(f"Failed to update re-indexing history {history_id} for user {user_id}, site {site_url}: {e_hist}", exc_info=True)

    # --- 1. Credit Deduction (if applicable) ---
    if credits_to_deduct > 0:
        try:
            transaction = DB.transaction()
            _deduct_credits_in_transaction(transaction, user_ref, credits_to_deduct, user_id)
            credits_deducted_successfully = True
            logger.info(f"Successfully deducted {credits_to_deduct} credits for user {user_id} for re-indexing site {site_url}.")
            update_reindex_history(indexing_history_id, "processing", f"Successfully deducted {credits_to_deduct} credits. Preparing for Indexing API calls.", {"creditsUsed": credits_to_deduct})
        except https_fn.HttpsError as e:
            logger.error(f"Credit deduction HttpsError for re-indexing (user {user_id}, site {site_url}): {e.message}.")
            update_reindex_history(indexing_history_id, "failed", f"Credit deduction failed: {e.message}", {"completedAt": firestore.SERVER_TIMESTAMP, "creditsUsed": 0})
            return
        except Exception as e:
            logger.error(f"Generic credit deduction failed for re-indexing (user {user_id}, site {site_url}): {e}", exc_info=True)
            update_reindex_history(indexing_history_id, "failed", f"Credit deduction failed: {str(e)}", {"completedAt": firestore.SERVER_TIMESTAMP, "creditsUsed": 0})
            return
    else:
        logger.info(f"No credits to deduct for re-indexing (user {user_id}, site {site_url}).")
        credits_deducted_successfully = True # Effectively true
        update_reindex_history(indexing_history_id, "processing", "No credits to deduct. Preparing for Indexing API calls.", {"creditsUsed": 0})

    # --- 2. Initialize Google Indexing API Client ---
    indexing_service = None
    try:
        # Extract token details from user_auth_details
        access_token = user_auth_details.get("searchConsoleAccessToken")
        refresh_token = user_auth_details.get("searchConsoleRefreshToken")
        # Expiry time is not directly used here for building, but was checked by _get_authenticated_gsc_client
        # For Indexing API, we need to ensure the token is valid or refreshable.
        
        if not access_token:
            raise ValueError("Access token is missing from user_auth_details.")

        # These should ideally come from a secure configuration or environment variables.
        # Using the same ones as in _get_authenticated_gsc_client for consistency
        client_id = "146812028648-rr5q1301sdp1r8g6pjlcd26r8cnv6gf2.apps.googleusercontent.com"
        client_secret = "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"
        token_uri = 'https://oauth2.googleapis.com/token'

        credentials = Credentials(
            token=access_token,
            refresh_token=refresh_token,
            token_uri=token_uri,
            client_id=client_id,
            client_secret=client_secret,
            scopes=['https://www.googleapis.com/auth/indexing'] # Crucial scope for Indexing API
        )

        # Attempt to refresh the token if it might be stale or to ensure validity
        # The Google API client library often handles this automatically if refresh_token is present
        # but an explicit check/refresh can be done if needed, similar to _get_authenticated_gsc_client.
        # For simplicity here, we rely on the client library's auto-refresh if configured.
        # If token is expired and no refresh token, this will fail.
        if credentials.expired and credentials.refresh_token:
            try:
                credentials.refresh(GoogleAuthRequest())
                logger.info(f"Successfully refreshed Indexing API token for user {user_id}.")
                # NOTE: The refreshed token (credentials.token, credentials.refresh_token if changed)
                # should ideally be saved back to Firestore for this user.
                # This is a common pattern missing here which _get_authenticated_gsc_client handles.
            except GoogleRefreshError as re:
                logger.error(f"Failed to refresh Indexing API token for user {user_id}: {re}", exc_info=True)
                error_details = str(re).lower()
                is_invalid_grant = "invalid_grant" in error_details

                failure_message = f"Google API token refresh failed: {re}"
                history_status = "failed" # Generic failure status for indexingHistory

                if is_invalid_grant:
                    failure_message = "Google API authentication failed because the token grant is invalid. This usually means the app's access was revoked or the refresh token expired. Please go to your account settings, disconnect, and then reconnect your Google Account."
                    history_status = "failed_authentication" # Specific status for UI/user
                    logger.warn(f"Invalid grant for user {user_id}. Refresh token is invalid or revoked. User needs to re-authenticate.")
                    # Future enhancement: Consider clearing tokens from user_ref or setting a flag
                    # e.g., user_ref.update({"searchConsoleAccessToken": None, "searchConsoleRefreshToken": None, "googleAuthInvalid": True, "searchConsoleAccessTokenExpiryTime": 0})

                # Refund credits if they were deducted
                if credits_deducted_successfully and credits_to_deduct > 0:
                    try:
                        user_ref.update({"credits": firestore.Increment(credits_to_deduct)})
                        logger.info(f"Rolled back {credits_to_deduct} credits for user {user_id} due to token refresh failure for site {site_url}.")
                    except Exception as refund_err:
                        logger.error(f"Failed to roll back credits for user {user_id} after token refresh failure: {refund_err}", exc_info=True)
                
                update_reindex_history(
                    indexing_history_id,
                    history_status,
                    failure_message,
                    {
                        "completedAt": firestore.SERVER_TIMESTAMP,
                        "creditsRolledBack": credits_deducted_successfully and credits_to_deduct > 0
                    }
                )
                return # Stop processing for this task. Do not re-raise to cause Pub/Sub retries for auth errors.

        indexing_service = build('indexing', 'v3', credentials=credentials, cache_discovery=False)
        logger.info(f"Successfully initialized Google Indexing API client for user {user_id}.")

    except Exception as e:
        logger.error(f"Failed to initialize Indexing API client for user {user_id} (site {site_url}): {e}", exc_info=True)
        if credits_deducted_successfully and credits_to_deduct > 0:
            user_ref.update({"credits": firestore.Increment(credits_to_deduct)}) # Refund
            logger.info(f"Rolled back {credits_to_deduct} credits for user {user_id} (Indexing API client init fail).")
        update_reindex_history(indexing_history_id, "failed", f"Indexing API client initialization failed: {str(e)}", {"completedAt": firestore.SERVER_TIMESTAMP, "creditsRolledBack": credits_deducted_successfully and credits_to_deduct > 0})
        return

    current_timestamp = datetime.datetime.now(datetime.timezone.utc)
    urls_reindex_succeeded_count = 0
    urls_reindex_failed_details = {} # Store details of failed API calls

    # --- 3. Request Re-indexing via Google Indexing API & Update Page Statuses ---
    if not urls_to_reindex:
        logger.info(f"No URLs provided in payload for re-indexing (user {user_id}, site {site_url}).")
        update_reindex_history(indexing_history_id, "successful", "No URLs were provided in the payload to re-index.", {"completedAt": firestore.SERVER_TIMESTAMP, "urlsProcessedCount": 0, "urlsSucceededCount": 0})
        return

    logger.info(f"Requesting re-indexing for {len(urls_to_reindex)} URLs for site: {site_url}, user: {user_id} via Indexing API.")
    
    batch = DB.batch()
    pages_collection_ref = DB.collection("pages")
    updated_page_ids_for_logging = []
    processed_urls_count = 0

    for url_to_reindex_item in urls_to_reindex:
        processed_urls_count += 1
        try:
            # Indexing API endpoint: https://indexing.googleapis.com/v3/urlNotifications:publish
            # Body: { "url": "URL_TO_SUBMIT", "type": "URL_UPDATED" } or "URL_DELETED"
            api_request_body = {
                'url': url_to_reindex_item,
                'type': 'URL_UPDATED' # For re-indexing existing or new content
            }
            indexing_service.urlNotifications().publish(body=api_request_body).execute()
            
            logger.info(f"Successfully submitted URL {url_to_reindex_item} to Indexing API for site {site_url} (user {user_id}).")
            urls_reindex_succeeded_count += 1

            # Find and update page document to 'REINDEX_REQUESTED'
            page_query = pages_collection_ref.where("userId", "==", user_id).where("siteId", "==", site_id_for_pages).where("pageUrl", "==", url_to_reindex_item).limit(1)
            page_docs = list(page_query.stream())
            if page_docs:
                page_doc_ref = page_docs[0].reference
                batch.update(page_doc_ref, {
                    "status": "REINDEX_REQUESTED", 
                    "lastReindexRequestedAt": current_timestamp,
                    "lastReindexApiStatus": "SUCCESS"
                })
                updated_page_ids_for_logging.append(page_doc_ref.id)
            else:
                logger.warning(f"Page document not found for user {user_id}, site {site_url}, URL {url_to_reindex_item}.")

        except GoogleHttpError as e:
            logger.error(f"Google API error re-indexing URL {url_to_reindex_item} for site {site_url} (user {user_id}): {e}")
            urls_reindex_failed_details[url_to_reindex_item] = f"ERROR_GSC_API: {e.resp.status}"
        except Exception as e:
            logger.error(f"Unexpected error re-indexing URL {url_to_reindex_item} for site {site_url} (user {user_id}): {e}", exc_info=True)
            urls_reindex_failed_details[url_to_reindex_item] = "ERROR_REINDEXING_GENERIC"

    # Commit batch updates for page statuses
    if updated_page_ids_for_logging:
        try:
            batch.commit()
            logger.info(f"Successfully updated {len(updated_page_ids_for_logging)} page documents to REINDEX_REQUESTED status for site {site_url}, user {user_id}.")
        except Exception as e:
            logger.error(f"Error committing batch update of page documents for re-indexing (user {user_id}, site {site_url}): {e}", exc_info=True)
            # Handle batch commit error (e.g., partial failure)
            # Decide on rollback strategy: manual inspection, automated rollback, or alerting
            update_reindex_history(
                indexing_history_id,
                "partial_success",
                f"Re-indexing request succeeded for {urls_reindex_succeeded_count} URLs, but updating page statuses encountered an error: {str(e)}",
                {
                    "completedAt": firestore.SERVER_TIMESTAMP,
                    "urlsProcessedCount": processed_urls_count,
                    "urlsSucceededCount": urls_reindex_succeeded_count,
                    "urlsFailedCount": len(urls_reindex_failed_details),
                    "failureDetails": urls_reindex_failed_details
                }
            )
            return # Consider stopping further processing if critical failure
    else:
        logger.info(f"No page status updates were needed for re-indexing for site {site_url}, user {user_id}.")

    # --- 4. Update Indexing History ---
    try:
        if urls_reindex_failed_details and len(urls_reindex_failed_details) == len(urls_to_reindex):
            # All URLs failed
            update_reindex_history(
                indexing_history_id,
                "failed",
                f"Re-indexing request processed, but all {len(urls_to_reindex)} URLs failed. No URLs were successfully re-indexed.",
                {
                    "completedAt": firestore.SERVER_TIMESTAMP,
                    "urlsProcessedCount": len(urls_to_reindex),
                    "urlsSucceededCount": 0,
                    "urlsFailedCount": len(urls_reindex_failed_details),
                    "failureDetails": urls_reindex_failed_details
                }
            )
        elif urls_reindex_succeeded_count > 0:
            # Some URLs succeeded
            update_reindex_history(
                indexing_history_id,
                "successful",
                f"Re-indexing request processed. Successfully re-indexed {urls_reindex_succeeded_count} URLs.",
                {
                    "completedAt": firestore.SERVER_TIMESTAMP,
                    "urlsProcessedCount": processed_urls_count,
                    "urlsSucceededCount": urls_reindex_succeeded_count,
                    "urlsFailedCount": len(urls_reindex_failed_details),
                    "failureDetails": urls_reindex_failed_details
                }
            )
        else:
            # No URLs processed (unlikely, but just in case)
            update_reindex_history(
                indexing_history_id,
                "info",
                "Re-indexing request processed, but no URLs were found to re-index.",
                {
                    "completedAt": firestore.SERVER_TIMESTAMP,
                    "urlsProcessedCount": 0,
                    "urlsSucceededCount": 0,
                    "urlsFailedCount": 0
                }
            )
    except Exception as e:
        logger.error(f"Error updating re-indexing history for user {user_id}, site {site_url}: {e}", exc_info=True)
        # Final fallback: if history update fails, there's not much we can do in this context.
        # Consider alerting, retrying, or manual intervention based on criticality and monitoring setup.


    logger.info(f"execute_site_reindexing finished for user {user_id}, site {site_url}. Processed {processed_urls_count} URLs. Succeeded: {urls_reindex_succeeded_count}, Failed: {len(urls_reindex_failed_details)}.")
    # Consider adding a summary log of succeeded/failed URLs if needed for quick monitoring.