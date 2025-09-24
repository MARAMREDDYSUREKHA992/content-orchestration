#calculate_keywords.py

""" This script aggrage keywords usage per user based on the content metadata stored in firestore.
    It connects to two firestore databases:
      1. Content Metadata Database - contains enriched metadata for uploaded files 
        (images, videos, audios, others).
      2. User Database - stores user credentials and information. 

    Workflow:
    - Query content metadata collections to extract keywords associated with each user.
    - Aggregate keyword counts per user across all their uploaded content.
    - Save the aggregated keyword counts into a dedicated subcollection 
      (`keyword_counts`) under each user's document in the user database. 

    Use Case:
    This helps in building user-specific analytics, personalization, and recommendations by understanding 
    the keywords most associated with their uploaded content. 

    Environment Variables (loaded via .env):
    - GOOGLE_APPLICATION_CREDENTIALS_PATH: Path to GCP service account credentials file.
    - USER_DATABASE_ID: Firestore database ID for user credentials.
    - CONTENT_METADATA_DATABASE_ID: Firestore database ID for content metadata."""

import os
import logging  # For logging info, warnings, and errors
from collections import Counter, defaultdict  # For keyword frequency counting
# --- Google Cloud Firestore Imports ---
from google.cloud import firestore
from google.cloud.firestore_v1.base_query import FieldFilter
# --- Google Cloud Authentication ---
from google.oauth2.service_account import Credentials as ServiceAccountCredentials # Loads service account credentials for Firestore access
# --- Environment Variable Management ---
from dotenv import load_dotenv

# --- Setup ---
load_dotenv()  # Load environment variables from .env file
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# --- Configuration ---
CREDENTIALS_PATH = os.getenv('GOOGLE_APPLICATION_CREDENTIALS')
USER_DB_ID = os.getenv('USER_DATABASE_ID')
CONTENT_DB_ID = os.getenv('CONTENT_METADATA_DATABASE_ID')

# Firestore collection groups to scan for content metadata
COLLECTION_GROUPS_TO_QUERY = ['images', 'videos', 'audios', 'others']

# Subcollection under each user document to store keyword counts
TARGET_SUBCOLLECTION_NAME = 'keyword_counts'

def aggregate_keywords_per_user():
    """
    Aggregate keyword counts per user and store them in Firestore.

    Process:
    - Connects to Firestore using service account credentials.
    - Queries content metadata collections (images, videos, audios, others).
    - Extracts keywords from 'enrichedMetadata.summaryContent' and groups them by user email.
    - Counts keyword frequency per user.
    - Saves results in each user's 'keyword_counts' subcollection.

    Note:
        Requires:
        - 'enrichedMetadata.userId' (user email) and 
          'enrichedMetadata.summaryContent' (list of keywords) in content documents.
        - User records in 'co-user-credentials' collection with 'email' field.

    Returns:
        None. Results are written to Firestore and shows the most frequent keywords in user interface .
    """

    # Ensure all required environment variables are set
    if not all([CREDENTIALS_PATH, USER_DB_ID, CONTENT_DB_ID]):
        logger.error("FATAL: Ensure CREDENTIALS_PATH, USER_DB_ID, and CONTENT_DB_ID are set in .env")
        return

    logger.info("Initializing Firestore clients for both user and content databases...")
    try: 
        creds = ServiceAccountCredentials.from_service_account_file(CREDENTIALS_PATH)
        user_db = firestore.Client(credentials=creds, database=USER_DB_ID)
        content_db = firestore.Client(credentials=creds, database=CONTENT_DB_ID)
        logger.info("Successfully connected to both Firestore databases.")
    except Exception as e:
        logger.error(f"FATAL: Could not connect to Firestore. Error: {e}", exc_info=True)
        return

    # 1. Count keywords per user email from the content metadata
    # Use defaultdict to easily create a new Counter for each new user
    user_keyword_counters = defaultdict(Counter)
    total_files_processed = 0

    for group in COLLECTION_GROUPS_TO_QUERY:
        logger.info(f"--- Querying collection group: '{group}' ---")
        docs = content_db.collection_group(group).stream()
        for doc in docs:
            total_files_processed += 1
            data = doc.to_dict()
            
            enriched_metadata = data.get('enrichedMetadata', {})
            # Your search code confirms userId is stored as the user's email
            user_email = enriched_metadata.get('userId')
            keywords = enriched_metadata.get('summaryContent', [])

            if user_email and isinstance(keywords, list) and keywords:
                # Add counts to the specific user's counter
                user_keyword_counters[user_email].update(keywords)
    
    logger.info(f"=== Processed {total_files_processed} files across {len(user_keyword_counters)} users. ===")

    if not user_keyword_counters:
        logger.warning("No keywords found to process.")
        return

    # 2. Save the aggregated counts into each user's subcollection
    logger.info("Saving aggregated counts to user-specific subcollections...")
    users_ref = user_db.collection('co-user-credentials')

    for user_email, counter in user_keyword_counters.items():
        # Find the user's document ID from their email
        user_query = users_ref.where(filter=FieldFilter('email', '==', user_email)).limit(1).stream()
        user_doc_list = list(user_query)

        if not user_doc_list:
            logger.warning(f"Could not find user document for email: {user_email}. Skipping.")
            continue
        
        user_doc_id = user_doc_list[0].id
        logger.info(f"Updating keyword counts for user: {user_email} (ID: {user_doc_id})")

        # Create a batch write for this specific user's subcollection
        batch = user_db.batch()
        user_keywords_subcollection_ref = users_ref.document(user_doc_id).collection(TARGET_SUBCOLLECTION_NAME)

        for keyword, count in counter.items():
            doc_id = keyword.replace('/', '_')  # Replace '/' to avoid Firestore doc ID conflicts
            doc_ref = user_keywords_subcollection_ref.document(doc_id)
            batch.set(doc_ref, {'keyword': keyword, 'count': count})
        
        batch.commit() # Commit batch updates

    logger.info("User-specific aggregation complete!")

if __name__ == '__main__':
    aggregate_keywords_per_user()
