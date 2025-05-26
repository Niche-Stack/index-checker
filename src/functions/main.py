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

    # --- Resolve siteId from siteUrl ---
    site_id_for_pages = None
    try:
        # Assuming 'sites' collection has documents with 'userId' and 'url' fields.
        # 'url' field in 'sites' collection should store the canonical site URL.
        sites_query = DB.collection("sites").where("userId", "==", user_id).where("gscProperty", "==", site_url).limit(1)
        
        site_docs_list = list(sites_query.stream()) # Execute and get list

        if site_docs_list:
            site_id_for_pages = site_docs_list[0].id
            logger.info(f"Resolved siteId \'{site_id_for_pages}\' for siteUrl \'{site_url}\' (user: {user_id}).")
        else:
            logger.warning(f"Site not found in 'sites' collection for siteUrl '{site_url}' (user: {user_id}). Cannot link pages to a site document.")
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

    # --- 1. Credit Check & Deduction ---
    credits_to_use = 10  # Define cost for this operation
    user_ref = DB.collection("users").document(user_id)
    credits_deducted_successfully = False

    try:
        transaction = DB.transaction()
        _deduct_credits_in_transaction(transaction, user_ref, credits_to_use, user_id)
        # The transaction.commit() happens implicitly when the @firestore.transactional function returns,
        # or explicitly if you run transaction.commit()
        # For this setup, the transaction is committed if _deduct_credits_in_transaction doesn't raise an error.
        credits_deducted_successfully = True # Assume success if no exception from transactional function
        logger.info(f"Successfully deducted {credits_to_use} credits for user {user_id}.")
    except https_fn.HttpsError as e: # Catch HttpsError from _deduct_credits_in_transaction
        logger.error(f"Credit deduction HttpsError for user {user_id}: {e.message}")
        raise e # Re-raise the specific HttpsError
    except Exception as e:
        logger.error(f"Generic credit deduction failed for user {user_id}: {e}")
        raise https_fn.HttpsError(code=https_fn.FunctionsErrorCode.INTERNAL, message=f"Failed to process credits: {e}")


    # --- 2. Get User's Google Auth Details ---
    user_auth_details = _get_user_google_auth_details(user_id)
    if not user_auth_details:
        if credits_deducted_successfully: # Rollback credits
            user_ref.update({"credits": firestore.Increment(credits_to_use)})
            logger.info(f"Rolled back {credits_to_use} credits for user {user_id} due to missing Google auth details.")
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.FAILED_PRECONDITION,
            message="Google API authentication details (searchConsoleAccessToken, searchConsoleAccessTokenExpiryTime) not found or incomplete in your user profile. Please ensure your Google Account is connected and tokens are up-to-date."
        )

    # --- 3. Initialize Google Search Console API ---
    try:
        search_console = _get_authenticated_gsc_client(user_auth_details, user_id)
    except https_fn.HttpsError as e: # Catch HttpsError from _get_authenticated_gsc_client (e.g. token expired)
        logger.error(f"Failed to initialize Search Console client for user {user_id}: {e.message}")
        if credits_deducted_successfully: # Rollback credits
            user_ref.update({"credits": firestore.Increment(credits_to_use)})
            logger.info(f"Rolled back {credits_to_use} credits for user {user_id} due to auth client init failure.")
        raise e # Re-raise
    except Exception as e: # Catch any other unexpected error during client init
        logger.error(f"Unexpected error initializing Search Console client for user {user_id}: {e}")
        if credits_deducted_successfully:
            user_ref.update({"credits": firestore.Increment(credits_to_use)})
            logger.info(f"Rolled back {credits_to_use} credits for user {user_id} due to unexpected auth client init failure.")
        raise https_fn.HttpsError(code=https_fn.FunctionsErrorCode.INTERNAL, message=f"Unexpected error initializing GSC client: {e}")


    # --- 4. Fetch Sitemaps and Inspect URLs ---
    total_pages_inspected = 0
    indexed_pages_count = 0
    urls_to_inspect = []
    api_message = "Process initiated."
    urls_to_inspect_dict = {}

    try:
        # Use a set to automatically handle duplicates from different sources
        unique_urls_to_inspect = set()
        analytics_urls_count = 0
        sitemap_urls_count = 0

        logger.info(f"Fetching URLs from Search Analytics and Sitemaps for site: {site_url}, user: {user_id}")

        # 1. Fetch from Search Analytics (provides recently active/discovered URLs)
        try:
            analytics_request_body = {"dimensions": ["page"]} # Defaults to last 90 days
            analytics_query_result = search_console.searchanalytics().query(siteUrl=site_url, body=analytics_request_body).execute()
            # logger.info("Search Analytics query response: %s", analytics_query_result) # Can be very verbose
            
            if analytics_query_result and 'rows' in analytics_query_result:
                for row in analytics_query_result['rows']:
                    if row.get('keys') and row['keys'][0]:
                        page_url = row['keys'][0]
                        if page_url not in unique_urls_to_inspect:
                            unique_urls_to_inspect.add(page_url)
                            analytics_urls_count +=1
                logger.info(f"Added {analytics_urls_count} URLs from search analytics for {site_url}.")
            else:
                logger.info(f"No page data returned from search analytics query for {site_url}.")
        except GoogleHttpError as ghe:
            logger.error(f"Google API Error fetching search analytics for {site_url}: {ghe}. Proceeding with sitemaps.")
        except Exception as e:
            logger.error(f"Error fetching search analytics for {site_url}: {e}. Proceeding with sitemaps.")

        # 2. Fetch from Sitemaps (primary source for "all pages" intended by site owner)
        sitemaps_processed_count = 0
        try:
            sitemaps_list_response = search_console.sitemaps().list(siteUrl=site_url).execute()
            if sitemaps_list_response and sitemaps_list_response.get('sitemap'):
                sitemap_entries = sitemaps_list_response.get('sitemap')
                logger.info(f"Found {len(sitemap_entries)} sitemap(s) listed in GSC for {site_url}.")
                for sitemap_meta in sitemap_entries:
                    feedpath = sitemap_meta.get('path')
                    if not feedpath:
                        logger.warning(f"Sitemap entry found without a path for {site_url}: {sitemap_meta}")
                        continue
                    
                    sitemaps_processed_count += 1
                    logger.info(f"Processing sitemap: {feedpath} for {site_url}")
                    try:
                        sitemap_details = search_console.sitemaps().get(siteUrl=site_url, feedpath=feedpath).execute()
                        
                        if sitemap_details and sitemap_details.get('contents'):
                            current_sitemap_urls_added = 0
                            for content_entry in sitemap_details.get('contents'):
                                # Assuming 'path' in 'contents' are page URLs.
                                # A more robust solution would check content_entry.get('type') for 'sitemap' (index) and recurse.
                                page_url = content_entry.get('path')
                                if page_url:
                                    if page_url not in unique_urls_to_inspect:
                                        unique_urls_to_inspect.add(page_url)
                                        sitemap_urls_count += 1
                                        current_sitemap_urls_added +=1
                            if current_sitemap_urls_added > 0:
                                logger.info(f"Added {current_sitemap_urls_added} new URLs from sitemap: {feedpath}")
                        else:
                            logger.info(f"Sitemap {feedpath} has no 'contents' field or could not be processed. It might be empty, pending, or an index file not expanded by this version.")
                            if sitemap_details and sitemap_details.get('isSitemapsIndex'):
                                logger.warning(f"Sitemap {feedpath} is a sitemap index. This version does not recursively parse sitemap indexes. URLs from its sub-sitemaps might be missed if they are not also listed individually or processed by GSC into a flat list for .get().")
                    except GoogleHttpError as ghe_sitemap:
                        logger.error(f"Google API Error processing sitemap {feedpath} for {site_url}: {ghe_sitemap}")
                    except Exception as e_sitemap:
                        logger.error(f"Error processing sitemap {feedpath} for {site_url}: {e_sitemap}")
            else:
                logger.info(f"No sitemaps found or listed for {site_url} in GSC.")
        except GoogleHttpError as ghe_sitemaps_list:
            logger.error(f"Google API Error listing sitemaps for {site_url}: {ghe_sitemaps_list}")
        except Exception as e_sitemaps_list:
            logger.error(f"Error listing sitemaps for {site_url}: {e_sitemaps_list}")

        urls_to_inspect = list(unique_urls_to_inspect)
        urls_to_inspect_dict = {url: "" for url in urls_to_inspect} 
        total_pages_inspected = len(urls_to_inspect)

        if not urls_to_inspect:
            api_message = "Could not retrieve any URLs to inspect from Search Analytics or Sitemaps. Ensure the site has GSC activity, sitemaps are registered and processed, or check GSC for errors."
            logger.warning(f"{api_message} (User: {user_id}, Site: {site_url})")
        else:
            api_message = f"Collected {total_pages_inspected} unique URLs for inspection ({analytics_urls_count} from analytics, {sitemap_urls_count} new from sitemaps)."
            logger.info(api_message + f" (User: {user_id}, Site: {site_url})")

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
        elif total_pages_inspected == 0 and api_message == "Process initiated.": # No URLs from analytics, and sitemap check didn't change message
             api_message = "Could not retrieve any URLs to inspect from recent search analytics. Ensure site has recent activity or check GSC."

        # --- 5. Store Inspected Pages in Firestore ---
        if urls_to_inspect_dict:
            batch = DB.batch()
            site_pages_collection_ref = DB.collection("pages")
            current_timestamp = datetime.datetime.now(datetime.timezone.utc)
            pages_batched_count = 0 # Counter for pages added to the batch

            for page_url, status_verdict in urls_to_inspect_dict.items():
                # All pages for which an inspection was attempted (i.e., in urls_to_inspect_dict) will be recorded.
                # If status_verdict is None or empty, it indicates an issue with fetching the verdict for that specific URL,
                # or that the inspection for this particular URL failed, but we still record the attempt.
                if not status_verdict:
                    logger.info(f"Storing page {page_url} for site {site_url} with an empty/null verdict: '{status_verdict}'.")
                # else: # Optionally, log when a valid verdict is found too
                #    logger.info(f"Storing page {page_url} for site {site_url} with verdict: '{status_verdict}'.")

                # Create a unique ID for the document, e.g., combining userId, siteUrl, and pageUrl hash
                # For simplicity, we can use pageUrl as part of ID if it's unique enough per site/user context
                # or let Firestore auto-generate an ID if preferred.
                # Using a composite key or a hashed URL might be better for querying.
                # For now, let's use an auto-generated ID and store fields for querying.
                page_doc_ref = site_pages_collection_ref.document() # Auto-generate ID
                page_data = {
                    "userId": user_id,
                    "siteUrl": site_url, # The parent site's URL
                    "siteId": site_id_for_pages, # FK to the 'sites' document
                    "pageUrl": page_url, # The specific URL inspected
                    "status": status_verdict,
                    "lastCheckedAt": current_timestamp,
                    # "domain": site_url.split("://")[-1].split("/")[0] # Optional: for easier querying by domain
                }
                batch.set(page_doc_ref, page_data)
                pages_batched_count += 1
            
            if pages_batched_count > 0:
                try:
                    batch.commit()
                    logger.info(f"Successfully committed {pages_batched_count} page inspection results to Firestore for site {site_url}, user {user_id}.")
                except Exception as e:
                    logger.error(f"Error committing batch of {pages_batched_count} pages for user {user_id}, site {site_url}: {e}")
                    # Propagate an error indicating storage failure.
                    raise https_fn.HttpsError(
                        code=https_fn.FunctionsErrorCode.INTERNAL,
                        message=f"Successfully checked pages with Google, but failed to store results: {e}. Please try again or contact support if the issue persists."
                    )
            else:
                logger.info(f"No pages with valid verdicts to store in Firestore for site {site_url}, user {user_id}. Total URLs considered in urls_to_inspect_dict: {len(urls_to_inspect_dict)}.")
        else:
            logger.info(f"urls_to_inspect_dict was empty. No page inspection results to store for site {site_url}, user {user_id}.")


        return {
            "indexedPages": indexed_pages_count,
            "totalPages": total_pages_inspected, # Reflects URLs actually processed
            "creditsUsed": credits_to_use,
            "message": api_message,
            "urlsInspected": urls_to_inspect,
            "urlsInspectedDetails": urls_to_inspect_dict,  # Contains URL and its inspection verdict
            "siteUrl": site_url,
        }

    except GoogleHttpError as e:
        logger.error(f"Google API Error during GSC interaction for site {site_url} (user {user_id}): {e.resp.status} - {e._get_reason()}")
        error_content = e.content.decode('utf-8') if e.content else "{}"
        logger.error(f"Google API Error content: {error_content}")
        if credits_deducted_successfully:
            user_ref.update({"credits": firestore.Increment(credits_to_use)})
            logger.info(f"Rolled back {credits_to_use} credits for user {user_id} due to GSC API error.")
        
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
        if credits_deducted_successfully:
            user_ref.update({"credits": firestore.Increment(credits_to_use)})
            logger.info(f"Rolled back {credits_to_use} credits for user {user_id} due to unexpected GSC API error.")
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.INTERNAL,
            message=f"Failed to get site indexing status from Google Search Console: {e}"
        )