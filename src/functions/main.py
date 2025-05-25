# Welcome to Cloud Functions for Firebase for Python!
# To get started, simply uncomment the below code or create your own.
# Deploy with `firebase deploy`

from firebase_functions import https_fn, options # Added options
from firebase_admin import initialize_app, firestore
import logging
import time
import datetime
import os # Added for environment variables
from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build, Resource
from googleapiclient.errors import HttpError as GoogleHttpError
from google.auth.transport.requests import Request as GoogleAuthRequest # Added for token refresh
from google.auth.exceptions import RefreshError as GoogleRefreshError # Added for token refresh

# Initialize Firebase Admin SDK
initialize_app()
DB = firestore.client()

# Configure logging
logger = logging.getLogger(__name__)
logging.basicConfig(level=logging.INFO) # Ensures logs are captured by Cloud Logging

# Set global options for all functions if needed, or per function
# options.set_global_options(region=options.SupportedRegion.EUROPE_WEST1) # Example, adjust to your region

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
                user_doc_ref.update({
                    "searchConsoleAccessToken": new_access_token,
                    "searchConsoleAccessTokenExpiryTime": new_expiry_ms
                    # refresh_token usually remains the same, but some flows might issue a new one.
                    # If credentials.refresh_token changed, update it too.
                    # "searchConsoleRefreshToken": credentials.refresh_token 
                })
                logger.info(f"Successfully refreshed Google access token for user {user_id}. New expiry (ms): {new_expiry_ms}")
                # access_token = new_access_token # Not strictly needed as credentials.token is updated

            except GoogleRefreshError as e:
                # Enhanced logging for GoogleRefreshError
                error_message = str(e)
                error_args = getattr(e, 'args', None)
                logger.error(f"Failed to refresh Google access token for user {user_id}. Error: {error_message}, Args: {error_args}")
                raise https_fn.HttpsError(
                    code=https_fn.FunctionsErrorCode.UNAUTHENTICATED,
                    message="Google API access token has expired, and refresh failed. Please re-authenticate via the application."
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
    timeout_sec=300,
    memory=options.MemoryOption.MB_256,
    cors=options.CorsOptions(
        cors_origins=[
            "http://localhost:5173", # Local development
            "https://indexchecker-534db.web.app", # Deployed app
            "https://indexchecker-534db.firebaseapp.com" # Deployed app
        ],
        cors_methods=["POST", "OPTIONS"] # Allow POST and OPTIONS for preflight
    )
)
def get_site_indexing_status(req: https_fn.CallableRequest) -> dict:
    """
    Checks the indexing status of pages for a given siteUrl using Google Search Console API.
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

    user_ref = DB.collection("users").document(user_id) # Define user_ref for transactions and rollbacks
    site_id_for_pages = None
    try:
        # --- Resolve siteId from siteUrl ---
        site_id_for_pages = None
        try:
            # Assuming 'sites' collection has documents with 'userId' and 'url' fields.
            # 'url' field in 'sites' collection should store the canonical site URL.
            sites_query = DB.collection("sites").where("userId", "==", user_id).where("url", "==", site_url).limit(1)
            
            site_docs_list = list(sites_query.stream()) # Execute and get list

            if site_docs_list:
                site_id_for_pages = site_docs_list[0].id
                logger.info(f"Resolved siteId \'{site_id_for_pages}\' for siteUrl \'{site_url}\' (user: {user_id}).")
            else:
                logger.warning(f"Site not found in \\'sites\\' collection for siteUrl \'{site_url}\' (user: {user_id}). Cannot link pages to a site document.")
                raise https_fn.HttpsError(
                    code=https_fn.FunctionsErrorCode.NOT_FOUND,
                    message=f"The site \'{site_url}\' is not registered under your account. Please add or verify the site configuration."
                )
        except Exception as e:
            logger.error(f"Error resolving siteId for siteUrl \'{site_url}\' (user: {user_id}): {e}", exc_info=True)
            raise https_fn.HttpsError(
                code=https_fn.FunctionsErrorCode.INTERNAL,
                message=f"An internal error occurred while verifying the site: {e}"
            )
        # site_id_for_pages is now set, or function has exited.

        # Initialize credit-related flags and variables
        credits_deducted_successfully = False
        actual_credits_to_deduct = 0

        # --- Get User's Google Auth Details ---
        user_auth_details = _get_user_google_auth_details(user_id)
        if not user_auth_details:
            # No credits deducted yet, so no rollback needed here.
            raise https_fn.HttpsError(
                code=https_fn.FunctionsErrorCode.FAILED_PRECONDITION,
                message="Google API authentication details (searchConsoleAccessToken, searchConsoleAccessTokenExpiryTime) not found or incomplete in your user profile. Please ensure your Google Account is connected and tokens are up-to-date."
            )

        # --- Initialize Google Search Console API ---
        try:
            search_console = _get_authenticated_gsc_client(user_auth_details, user_id)
        except https_fn.HttpsError as e: # Catch HttpsError from _get_authenticated_gsc_client
            logger.error(f"Failed to initialize Search Console client for user {user_id}: {e.message}")
            # No credits deducted yet.
            raise e # Re-raise
        except Exception as e: # Catch any other unexpected error during client init
            logger.error(f"Unexpected error initializing Search Console client for user {user_id}: {e}")
            # No credits deducted yet.
            raise https_fn.HttpsError(code=https_fn.FunctionsErrorCode.INTERNAL, message=f"Unexpected error initializing GSC client: {e}")


        # --- Fetch Sitemaps and Inspect URLs ---
        total_pages_identified_for_inspection = 0 # Renamed for clarity from total_pages_inspected at this stage
        indexed_pages_count = 0
        urls_to_inspect = []
        api_message = "Process initiated."
        urls_to_inspect_dict = {} # Will store {url: verdict}

        try:
            logger.info(f"Fetching sitemaps/analytics for site: {site_url}, user: {user_id}")
            
            # Option 1: Use Search Analytics to get recent/popular URLs (often more practical than full sitemap parsing)
            three_months_ago = datetime.date.today() - datetime.timedelta(days=90)
            start_date_str = three_months_ago.strftime("%Y-%m-%d")
            current_date_str = datetime.date.today().strftime("%Y-%m-%d")

            request_body = {
                "startDate": start_date_str,
                "endDate": current_date_str,
                "dimensions": ["page"]
            }
            analytics_query = search_console.searchanalytics().query(siteUrl=site_url, body=request_body).execute()

            logger.info("analytics_query response: %s", analytics_query)
            
            if analytics_query and 'rows' in analytics_query and len(analytics_query['rows']) > 0:
                for row in analytics_query['rows']:
                    if row.get('keys') and row['keys'][0]:
                        page_url_from_analytics = row['keys'][0]
                        if page_url_from_analytics not in urls_to_inspect_dict: # Ensure unique URLs
                            urls_to_inspect.append(page_url_from_analytics)
                            urls_to_inspect_dict[page_url_from_analytics] = '' # Initialize verdict placeholder
                total_pages_identified_for_inspection = len(urls_to_inspect)
                logger.info(f"Found {total_pages_identified_for_inspection} URLs from search analytics for {site_url} to inspect.")
            else:
                logger.info(f"No page data returned from search analytics query for {site_url}. Checking sitemaps as fallback.")
                # Fallback or alternative: List sitemaps and try to get URLs from there (more complex)
                # For simplicity, we'll rely on analytics for now. If no URLs, inspection won't run.
                # If you need sitemap parsing, that would be an additional, more involved step.
                sitemaps_list = search_console.sitemaps().list(siteUrl=site_url).execute()
                if sitemaps_list and sitemaps_list.get('sitemap'):
                     api_message = f"Found {len(sitemaps_list.get('sitemap'))} sitemap entries. URLs for inspection are sourced from recent search analytics. If analytics is empty, no URLs will be inspected from sitemaps directly by this version."
                     logger.info(api_message)
                else:
                    api_message = "No pages found via search analytics and no sitemaps registered in GSC. URL inspection cannot proceed."
                    logger.warn(api_message + f" for site {site_url}")

            # Determine credits based on the number of unique URLs found
            actual_credits_to_deduct = len(urls_to_inspect)
            logger.info(f"Identified {actual_credits_to_deduct} unique URLs for inspection for site {site_url}.")

            # --- Credit Check & Deduction (Moved and Modified) ---
            if actual_credits_to_deduct > 0:
                try:
                    transaction = DB.transaction()
                    _deduct_credits_in_transaction(transaction, user_ref, actual_credits_to_deduct, user_id)
                    credits_deducted_successfully = True
                    logger.info(f"Successfully prepared deduction of {actual_credits_to_deduct} credits for user {user_id} for inspecting {len(urls_to_inspect)} URLs.")
                except https_fn.HttpsError as e: # Catch HttpsError from _deduct_credits_in_transaction
                    logger.error(f"Credit deduction HttpsError for user {user_id}: {e.message}")
                    raise e # Re-raise the specific HttpsError
                except Exception as e:
                    logger.error(f"Generic credit deduction failed for user {user_id}: {e}")
                    raise https_fn.HttpsError(code=https_fn.FunctionsErrorCode.INTERNAL, message=f"Failed to process credits: {e}")
            else:
                logger.info(f"No URLs to inspect for site {site_url}, so no credits will be deducted for user {user_id}.")


            if urls_to_inspect:
                logger.info(f"Inspecting {len(urls_to_inspect)} URLs for site: {site_url}")
                for url_to_inspect in urls_to_inspect:
                    try:
                        time.sleep(0.2)  # Small delay to respect QPS limits

                        inspection_result = search_console.urlInspection().index().inspect(
                            body={"inspectionUrl": url_to_inspect, "siteUrl": site_url}
                        ).execute()
                        
                        verdict = inspection_result.get("inspectionResult", {}).get("indexStatusResult", {}).get("verdict")

                        urls_to_inspect_dict[url_to_inspect] = verdict  # Store the verdict for each URL

                        if verdict in ["PASS", "NEUTRAL"]: # Consider NEUTRAL as indexed or on its way
                            indexed_pages_count += 1
                    except GoogleHttpError as inspect_error:
                        logger.error(f"Google API Error inspecting URL {url_to_inspect} for site {site_url}: {inspect_error}")
                        # Optionally collect these errors. For now, continue.
                    except Exception as e:
                        logger.error(f"Generic error inspecting URL {url_to_inspect} for site {site_url}: {e}")

                api_message = f"Checked {len(urls_to_inspect)} URLs. Found {indexed_pages_count} indexed or neutral."
                logger.info(f"Inspection complete for {site_url}. Indexed: {indexed_pages_count}/{len(urls_to_inspect)}")
            elif total_pages_identified_for_inspection == 0 and api_message == "Process initiated.": # No URLs from analytics, and sitemap check didn't change message
                 api_message = "Could not retrieve any URLs to inspect from recent search analytics. Ensure site has recent activity or check GSC."

            # --- 5. Store Inspected Pages in Firestore (with duplicate check) ---
            if urls_to_inspect_dict: # This dict contains url:verdict for all URLs attempted
                batch = DB.batch()
                site_pages_collection_ref = DB.collection("pages")
                current_timestamp = datetime.datetime.now(datetime.timezone.utc)
                pages_batched_count = 0

                for page_url, status_verdict in urls_to_inspect_dict.items():
                    # Query for an existing page document
                    page_query = site_pages_collection_ref.where("userId", "==", user_id) \
                                                         .where("siteId", "==", site_id_for_pages) \
                                                         .where("pageUrl", "==", page_url) \
                                                         .limit(1)
                    existing_page_docs = list(page_query.stream())

                    page_data_to_store = {
                        "userId": user_id,
                        "siteUrl": site_url,
                        "siteId": site_id_for_pages,
                        "pageUrl": page_url,
                        "status": status_verdict if status_verdict else "UNKNOWN", # Ensure status is not empty
                        "lastCheckedAt": current_timestamp,
                    }

                    if existing_page_docs:
                        # Update existing document
                        existing_page_doc_ref = existing_page_docs[0].reference
                        batch.update(existing_page_doc_ref, page_data_to_store)
                        logger.info(f"Updating existing page record for {page_url} (Site: {site_url}, User: {user_id}).")
                    else:
                        # Create new document
                        new_page_doc_ref = site_pages_collection_ref.document()
                        batch.set(new_page_doc_ref, page_data_to_store)
                        logger.info(f"Creating new page record for {page_url} (Site: {site_url}, User: {user_id}).")
                    
                    pages_batched_count += 1
                
                if pages_batched_count > 0:
                    try:
                        batch.commit()
                        logger.info(f"Successfully committed/updated {pages_batched_count} page inspection results to Firestore for site {site_url}, user {user_id}.")
                    except Exception as e:
                        logger.error(f"Error committing batch of {pages_batched_count} pages for user {user_id}, site {site_url}: {e}")
                        # If storage fails, credits should ideally be rolled back if they were for this action.
                        # The main exception handlers below will catch this and attempt rollback if credits_deducted_successfully is true.
                        raise https_fn.HttpsError(
                            code=https_fn.FunctionsErrorCode.INTERNAL,
                            message=f"Successfully checked pages with Google, but failed to store results: {e}. Please try again or contact support if the issue persists."
                        )
                else:
                    # This case should ideally not be hit if urls_to_inspect_dict is not empty,
                    # as pages_batched_count would increment.
                    logger.info(f"No page inspection results to store in Firestore for site {site_url}, user {user_id}, despite urls_to_inspect_dict having items. This indicates an issue in looping or batching logic.")
            else:
                logger.info(f"urls_to_inspect_dict was empty. No page inspection results to store for site {site_url}, user {user_id}.")


            return {
                "indexedPages": indexed_pages_count,
                "totalPages": len(urls_to_inspect), # Number of URLs identified for inspection
                "creditsUsed": actual_credits_to_deduct, # Actual credits deducted
                "message": api_message,
                "urlsInspected": urls_to_inspect # List of URLs we attempted to inspect
                "urlsInspectedDetails": urls_to_inspect_dict,  # Contains URL and its inspection verdict
                "siteUrl": site_url,
            }

        except GoogleHttpError as e:
            logger.error(f"Google API Error during GSC interaction for site {site_url} (user {user_id}): {e.resp.status} - {e._get_reason()}")
            error_content = e.content.decode('utf-8') if e.content else "{}"
            logger.error(f"Google API Error content: {error_content}")
            if credits_deducted_successfully: # Check if credits were actually deducted
                user_ref.update({"credits": firestore.Increment(actual_credits_to_deduct)}) # Rollback dynamic amount
                logger.info(f"Rolled back {actual_credits_to_deduct} credits for user {user_id} due to GSC API error.")
            
            # Try to parse Google's error for a better message
            import json
            try:
                gsc_error_details = json.loads(error_content)
                err_msg = gsc_error_details.get("error", {}).get("message", "Unknown GSC API error.")
                err_code = gsc_error_details.get("error", {}).get("code", e.resp.status)
                raise https_fn.HttpsError(
                    code=https_fn.FunctionsErrorCode.INTERNAL, # Or map GSC codes if possible
                    message=f"Google Search Console API Error: {err_msg} (Code: {err_code})"
                )
            except (json.JSONDecodeError, AttributeError):
                 raise https_fn.HttpsError(
                code=https_fn.FunctionsErrorCode.INTERNAL,
                message=f"Google Search Console API Error (Status {e.resp.status}): {e._get_reason()}"
            )

        except Exception as e:
            logger.error(f"Unexpected error during GSC API interaction for site {site_url} (user {user_id}): {e}", exc_info=True)
            if credits_deducted_successfully: # Check if credits were actually deducted
                user_ref.update({"credits": firestore.Increment(actual_credits_to_deduct)}) # Rollback dynamic amount
                logger.info(f"Rolled back {actual_credits_to_deduct} credits for user {user_id} due to unexpected GSC API error.")
            raise https_fn.HttpsError(
                code=https_fn.FunctionsErrorCode.INTERNAL,
                message=f"Failed to get site indexing status from Google Search Console: {e}"
            )