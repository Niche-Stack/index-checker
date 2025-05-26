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

# Initialize Firebase Admin SDK
initialize_app()
DB = firestore.client()

# Configure logging
logger = logging.getLogger(__name__)
logging.basicConfig(level=logging.INFO)

# --- Configuration Constants ---
CREDIT_PER_URL = 1  # Cost per URL inspection
PUBSUB_TOPIC_ID = "site-indexing-tasks" # REPLACE with your Pub/Sub topic name

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
        logger.error(f"User document not found for user {user_id_for_logging} during credit transaction.")
        # This error might not be catchable by the main try-except if transaction commit fails outside.
        # It's better to ensure user_doc_ref is valid before starting transaction if possible,
        # but for atomicity, check inside is also good.
        raise https_fn.HttpsError(code=https_fn.FunctionsErrorCode.NOT_FOUND, message="User record not found.")

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
            "https://indexchecker-534db.firebaseapp.com"
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
            update_payload = {
                "creditsUsed": firestore.Increment(credits_to_deduct) if credits_to_deduct > 0 else 0,
                "status": status,
                "message": message,
                "updatedAt": firestore.SERVER_TIMESTAMP
            }
            if additional_data:
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
                 update_indexing_history(indexing_history_id, "pending", f"Successfully deducted {credits_to_deduct} credits. Starting GSC processing.", {"actualCreditsUsed": credits_to_deduct if credits_to_deduct > 0 else 0})

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
            update_indexing_history(indexing_history_id, "pending", "No credits to deduct. Starting GSC processing.", {"actualCreditsUsed": 0})


    # --- 2. Initialize Google Search Console API ---
    search_console = None
    try:
        search_console = _get_authenticated_gsc_client(user_auth_details, user_id)
    except https_fn.HttpsError as e:
        logger.error(f"Failed to initialize Search Console client for user {user_id} (site {site_url}): {e.message}")
        if credits_deducted_successfully and credits_to_deduct > 0:
            user_ref.update({"credits": firestore.Increment(credits_to_deduct)})
            logger.info(f"Rolled back {credits_to_deduct} credits for user {user_id} due to GSC client init failure for site {site_url}.")
        update_indexing_history(indexing_history_id, "failed", f"GSC client initialization failed: {e.message}", {"completedAt": firestore.SERVER_TIMESTAMP, "creditsRolledBack": credits_to_deduct if credits_deducted_successfully and credits_to_deduct > 0 else 0})
        return # Stop processing
    except Exception as e:
        logger.error(f"Unexpected error initializing GSC client for user {user_id} (site {site_url}): {e}", exc_info=True)
        if credits_deducted_successfully and credits_to_deduct > 0:
            user_ref.update({"credits": firestore.Increment(credits_to_deduct)})
            logger.info(f"Rolled back {credits_to_deduct} credits for user {user_id} due to unexpected GSC client init failure for site {site_url}.")
        update_indexing_history(indexing_history_id, "failed", f"Unexpected GSC client initialization error: {str(e)}", {"completedAt": firestore.SERVER_TIMESTAMP, "creditsRolledBack": credits_deducted_successfully and credits_to_deduct > 0})
        return # Stop processing

    # Define current_timestamp here, after successful GSC client init and before processing
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