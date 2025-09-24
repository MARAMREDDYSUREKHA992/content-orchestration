# --- Standard Library Imports ---
import os  # Used for interacting with the operating system, like reading environment variables and path manipulation.
import json  # Used for working with JSON data.
import logging  # Used for logging application events for debugging and monitoring.
import uuid  # Used for generating unique IDs (UUIDs) for new users.
import io  # Used to handle in-memory binary streams, for file downloads.
import zipfile  # Used for creating and reading ZIP archives, for multi-file downloads.
from datetime import timedelta  # Used to set the expiration time for JWTs.

# --- Third-party Library Imports ---
from flask import Flask, request, jsonify, Blueprint, current_app, render_template, send_from_directory, send_file  # Core components of the Flask web framework.
from flask_cors import CORS  # Handles Cross-Origin Resource Sharing (CORS) to allow requests from the frontend.
from dotenv import load_dotenv  # Loads environment variables from a .env file for local development.
from werkzeug.security import generate_password_hash, check_password_hash  # Used for securely hashing and verifying user passwords.
from google.cloud import storage  # Google Cloud Storage client for file storage.
from google.cloud import firestore  # Google Cloud Firestore client for NoSQL database interactions.
from google.cloud.firestore_v1.base_query import FieldFilter # Used for creating complex queries in Firestore.
from flask_jwt_extended import create_access_token, get_jwt_identity, jwt_required, JWTManager  # Handles JSON Web Tokens (JWT) for authentication.
from google.oauth2 import id_token  # Verifies Google OAuth2 ID tokens.
from google.auth.transport import requests as google_requests  # Used to make requests for Google authentication.


# --- Conditional .env Loading for Local Development ---
# This checks if the app is running in a Google Cloud Run environment.
# If not, it assumes local development and loads the .env file.
if os.environ.get('K_SERVICE') is None:
    load_dotenv()
    print("Running locally - .env file loaded.")


# --- Global Setup ---
# Configure basic logging to output informational messages.
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


# --- Flask App Initialization ---
# Determines the directory paths to serve the frontend React application build files.
# This setup is crucial for a monorepo structure where frontend and backend are in the same project.
current_dir = os.path.dirname(os.path.abspath(__file__))
parent_dir = os.path.join(current_dir, '..')
frontend_build_dir = os.path.join(parent_dir, 'frontend', 'build')

# Initialize the Flask app, pointing to the static and template files of the React build.
app = Flask(__name__,
            static_folder=os.path.join(frontend_build_dir, 'static'),
            template_folder=frontend_build_dir)



# --- JWT Configuration ---
# Set the secret key for signing JWTs. This should be a long, random, and secret string.
app.config["JWT_SECRET_KEY"] = os.getenv('JWT_SECRET_KEY')
# Set the duration for which an access token is valid.
app.config["JWT_ACCESS_TOKEN_EXPIRES"] = timedelta(hours=24)
# Initialize the JWT manager with the Flask app.
jwt = JWTManager(app)


# --- Other Configurations from Environment Variables ---
# Loads various configuration values from environment variables.
app.config['GOOGLE_CLIENT_ID'] = os.getenv('GOOGLE_CLIENT_ID')
app.config['GCS_BUCKET_NAME'] = os.getenv('GCS_BUCKET_NAME')
app.config['PROJECT_ID'] = os.getenv('PROJECT_ID')
app.config['CONTENT_METADATA_DATABASE_ID'] = os.getenv('CONTENT_METADATA_DATABASE_ID')
app.config['CONTENT_METADATA_COLLECTION_NAME'] = os.getenv('CONTENT_METADATA_COLLECTION_NAME')
app.config['GEMINI_API_KEY'] = os.getenv('GEMINI_API_KEY')
app.config['USER_DATABASE_ID'] = os.getenv('USER_DATABASE_ID')



# --- CORS Configuration ---
# Configures CORS to allow the frontend application to make requests to this backend.
# The origin is fetched from an environment variable, with a fallback for local development.
cors_origins = [os.getenv('REACT_APP_FRONTEND_URL', 'http://localhost:3000')]
if os.getenv('REACT_APP_FRONTEND_URL'):
    cors_origins.append(os.getenv('REACT_APP_FRONTEND_URL'))
CORS(app, resources={r"/*": {"origins": cors_origins}}, supports_credentials=True)



# --- Initialize Google Cloud Clients ---
# These clients are initialized once when the application starts.
db = firestore.Client(database=app.config['USER_DATABASE_ID'])
users_collection = db.collection('co-user-credentials')
content_metadata_db = firestore.Client(database=app.config['CONTENT_METADATA_DATABASE_ID'])
gcs_client = storage.Client()
logger.info("Successfully initialized all Google Cloud clients.")


# --- User Model ---
class User():
    """Represents a user in the system."""
    def __init__(self, id, email, username=None, google_id=None, profile_pic_url=None, password_hash=None):
        """
        Initializes a User object.

        Args:
            id (str): The unique identifier for the user.
            email (str): The user's email address.
            username (str, optional): The user's display name. Defaults to the part of the email before the '@'.
            google_id (str, optional): The user's unique Google ID if they signed in with Google.
            profile_pic_url (str, optional): URL to the user's profile picture.
            password_hash (str, optional): The hashed password for email-based login.
        """
        self.id = id
        self.email = email
        self.username = username or email.split('@')[0]
        self.google_id = google_id
        self.profile_pic_url = profile_pic_url
        self.password_hash = password_hash

    def to_dict(self):
        """
        Converts the User object to a dictionary, suitable for Firestore.

        Returns:
            dict: A dictionary representation of the user.
        """
        return {
            'id': self.id,
            'email': self.email,
            'username': self.username,
            'google_id': self.google_id,
            'profile_pic_url': self.profile_pic_url,
            'password_hash': self.password_hash
        }

    def set_password(self, password):
        """
        Hashes and sets the user's password.

        Args:
            password (str): The plaintext password to hash.
        """
        self.password_hash = generate_password_hash(password)

    def check_password(self, password):
        """
        Verifies a password against the stored hash.

        Args:
            password (str): The plaintext password to check.

        Returns:
            bool: True if the password is correct, False otherwise.
        """
        if self.password_hash:
            return check_password_hash(self.password_hash, password)
        return False



# --- Firestore Helper Functions (for user credentials) ---
def get_user_from_db(user_id=None, email=None, google_id=None):
    """
    Retrieves a user from the Firestore database by ID, email, or Google ID.

    Args:
        user_id (str, optional): The user's unique ID.
        email (str, optional): The user's email.
        google_id (str, optional): The user's Google ID.

    Returns:
        User or None: The User object if found, otherwise None.
    """
    if not db:
        logger.error("Firestore DB (user credentials) not initialized. Cannot retrieve user.")
        return None
    try:
        # Prioritize fetching by the unique user ID if provided.
        if user_id:
            doc_ref = users_collection.document(str(user_id))
            doc = doc_ref.get()
            if doc.exists:
                return User(**doc.to_dict())
            return None

        # Build a query based on email or Google ID.
        query_ref = None
        if email:
            query_ref = users_collection.where(filter=FieldFilter('email', '==', email)).limit(1)
        elif google_id:
            query_ref = users_collection.where(filter=FieldFilter('google_id', '==', google_id)).limit(1)

        # Execute the query and return the user if found.
        if query_ref:
            docs = list(query_ref.stream())
            if docs:
                return User(**docs[0].to_dict())

    except Exception as e:
        logger.error(f"FATAL ERROR in get_user_from_db: {e}", exc_info=True)
    return None


@jwt.user_lookup_loader
def user_lookup_callback(_jwt_header, jwt_data):
    """
    This function is called whenever a protected endpoint is accessed,
    and it loads the user object from the database into the context.

    Args:
        _jwt_header (dict): The header of the JWT.
        jwt_data (dict): The payload of the JWT.

    Returns:
        User or None: The user object corresponding to the JWT identity.
    """
    identity = jwt_data["sub"]
    return get_user_from_db(user_id=identity)


def save_user_to_db(user):
    """
    Saves or updates a user's data in the Firestore database.

    Args:
        user (User): The User object to save.
    """
    if not db:
        logger.error("Firestore DB (user credentials) not initialized. Cannot save user.")
        return
    try:
        doc_ref = users_collection.document(user.id)
        doc_ref.set(user.to_dict())
        logger.info(f"User {user.email} saved/updated in Firestore with ID {user.id}.")
    except Exception as e:
        logger.error(f"Error saving user to Firestore (user credentials): {e}", exc_info=True)
        return


# --- Google Cloud Storage Helper Functions ---
def get_gcs_client():
    """
    Returns the initialized Google Cloud Storage client.

    Raises:
        RuntimeError: If the GCS client has not been initialized.

    Returns:
        storage.Client: The GCS client instance.
    """
    if gcs_client:
        return gcs_client
    else:
        raise RuntimeError("GCS client not initialized.")


def create_user_gcs_folders(user_email, bucket_name):
    """
    Creates the necessary folder structure for a new user in GCS.
    Folders are created for different file types (images, videos, etc.).

    Args:
        user_email (str): The user's email, used to create a root folder.
        bucket_name (str): The name of the GCS bucket.
    """
    logger.info(f"Creating GCS folders for {user_email} in {bucket_name}")
    try:
        storage_client = get_gcs_client()
        bucket = storage_client.bucket(bucket_name)
        # Create a placeholder object to represent a folder for each type.
        for folder_type in ["images", "videos", "audios", "others"]:
            blob = bucket.blob(f"{user_email}/{folder_type}/")
            if not blob.exists():
                blob.upload_from_string('', content_type='application/x-directory')
        logger.info(f"GCS folders created/verified for {user_email}.")
    except Exception as e:
        logger.error(f"Failed to create GCS folders for {user_email}: {e}", exc_info=True)


# --- Main Route for serving the frontend ---
@app.route('/', defaults={'path': ''})
@app.route('/<path:path>')
def serve_react_app(path):
    """
    Serves the React frontend.

    This catch-all route ensures that any request not matching a specific API endpoint
    is handled by the React app, allowing for client-side routing.

    Args:
        path (str): The path requested by the client.

    Returns:
        Response: The `index.html` of the React app or a specific static file if it exists.
    """
    if path != "" and os.path.exists(os.path.join(app.static_folder, '..', path)):
        return send_from_directory(os.path.join(app.static_folder, '..'), path)
    else:
        return render_template('index.html')



# --- Authentication Routes ---
# A Blueprint is used to group related authentication routes together.
auth_bp = Blueprint('auth_bp', __name__)


@auth_bp.route('/google_login', methods=['POST'])
def google_login():
    """
    Handles user login/signup via Google Sign-In.
    It verifies the Google ID token, finds or creates a user in the database,
    and returns a JWT access token.

    Request Body (JSON):
        { "token": "google_id_token_string" }

    Returns:
        JSON: A success or error message, along with user data and an access token on success.
    """
    if not db:
        return jsonify(success=False, error="Server database service for user credentials is not available."), 503

    token = request.json.get('token')
    if not token:
        return jsonify(success=False, error="No token provided"), 400

    try:
        # Verify the token with Google's servers.
        google_request_obj = google_requests.Request()
        idinfo = id_token.verify_oauth2_token(token, google_request_obj, current_app.config['GOOGLE_CLIENT_ID'])

        email, name, picture = idinfo.get('email'), idinfo.get('name'), idinfo.get('picture')
        google_user_id = idinfo['sub']

        # Check if a user with this Google ID already exists.
        user = get_user_from_db(google_id=google_user_id)

        # If no user with Google ID, check if a user with the same email exists (e.g., from email signup).
        if not user:
            user = get_user_from_db(email=email)
            if user:
                # Link the Google account to the existing email account.
                user.google_id = google_user_id
                user.profile_pic_url = picture
                save_user_to_db(user)

        # If still no user, create a new user account.
        if not user:
            new_id = str(uuid.uuid4())
            user = User(id=new_id, email=email, username=name, google_id=google_user_id, profile_pic_url=picture)
            save_user_to_db(user)
            # Create the necessary GCS folders for the new user.
            create_user_gcs_folders(email, app.config['GCS_BUCKET_NAME'])

        # Create a JWT for the user session.
        access_token = create_access_token(identity=user.id)
        return jsonify(
            success=True,
            user={'email': user.email, 'name': user.username, 'picture': user.profile_pic_url},
            access_token=access_token
        )
    except Exception as e:
        logger.error(f"Error during Google login: {e}", exc_info=True)
        return jsonify(success=False, error='Server error during Google Login.'), 500


@auth_bp.route('/email_login', methods=['POST'])
def email_login():
    """
    Handles user login with email and password.
    It verifies credentials and returns a JWT access token if they are valid.

    Request Body (JSON):
        { "email": "user@example.com", "password": "user_password" }

    Returns:
        JSON: A success or error message, along with user data and an access token on success.
    """
    if not db:
        return jsonify(success=False, error="Server database service for user credentials is not available."), 503
    
    email = request.json.get('email')
    password = request.json.get('password')
    if not email or not password:
        return jsonify(success=False, error="Email and password are required."), 400

    user = get_user_from_db(email=email)
    # Check if the user exists and the password is correct.
    if user and user.check_password(password):
        access_token = create_access_token(identity=user.id)
        return jsonify(
            success=True,
            user={'email': user.email, 'name': user.username, 'picture': user.profile_pic_url},
            access_token=access_token
        )
    return jsonify(success=False, error="Invalid email or password."), 401


# Register the authentication blueprint with the main Flask app.
app.register_blueprint(auth_bp, url_prefix='/auth')


# --- Protected File Upload Route ---
@app.route('/upload_files', methods=['POST'])
@jwt_required()
def upload_files():
    """
    Handles file uploads from authenticated users.
    Files are stored in Google Cloud Storage in a user-specific folder.
    This endpoint is protected and requires a valid JWT.

    Request:
        Multipart/form-data with one or more files under the key 'file'.

    Returns:
        JSON: A success or error message, with a list of uploaded file names on success.
    """
    # Get the user ID from the JWT.
    current_user_id = get_jwt_identity()
    user = get_user_from_db(user_id=current_user_id)
    if not user:
        return jsonify(success=False, error="User not found in database."), 401

    if 'file' not in request.files:
        return jsonify(success=False, error='No files provided in the request'), 400

    files = request.files.getlist('file')
    if not files or all(f.filename == '' for f in files):
        return jsonify(success=False, error='No selected files'), 400

    storage_client = get_gcs_client()
    bucket = storage_client.bucket(app.config['GCS_BUCKET_NAME'])
    uploaded_file_names = []

    for file in files:
        if file.filename == '': continue

        # Determine the correct subfolder based on the file's MIME type.
        mime_type = file.content_type
        if mime_type.startswith('image/'): subfolder_gcs = 'images/'
        elif mime_type.startswith('video/'): subfolder_gcs = 'videos/'
        elif mime_type.startswith('audio/'): subfolder_gcs = 'audios/'
        else: subfolder_gcs = 'others/'

        # Handle potential filename conflicts by appending a counter.
        original_filename = os.path.basename(file.filename)
        name, extension = os.path.splitext(original_filename)
        gcs_path_prefix = f"{user.email}/{subfolder_gcs}"
        destination_blob_name = f"{gcs_path_prefix}{original_filename}"
        counter = 1
        while bucket.blob(destination_blob_name).exists():
            new_filename = f"{name}({counter}){extension}"
            destination_blob_name = f"{gcs_path_prefix}{new_filename}"
            counter += 1

        # Upload the file to GCS.
        blob = bucket.blob(destination_blob_name)
        file.seek(0)  # Rewind the file pointer to the beginning.
        blob.upload_from_file(file, content_type=mime_type)
        uploaded_file_names.append(os.path.basename(destination_blob_name))

    return jsonify(success=True, message=f'{len(uploaded_file_names)} file(s) uploaded successfully.', uploaded_files=uploaded_file_names), 200


# --- Search Route ---
@app.route('/search_files', methods=['GET'])
@jwt_required()
def search_files():
    """
    Searches for a user's files based on a query text.
    The search is performed against filenames and keywords in the content metadata Firestore database.

    Query Parameters:
        searchQuery (str): The text to search for.

    Returns:
        JSON: A list of matching file metadata, including a public URL for each file.
    """
    current_user_id = get_jwt_identity()
    user = get_user_from_db(user_id=current_user_id)
    if not user:
        return jsonify(success=False, error="User not found in database."), 404

    query_text = request.args.get('searchQuery', '').strip().lower()
    if not query_text:
        return jsonify(success=False, error="Search query is required."), 400

    matching_docs = {}
    categories = ['images', 'videos', 'audios', 'others']
    # Iterate through all possible content categories.
    for category in categories:
        collection_ref = content_metadata_db.collection_group(category)
        
        # Search in both filenames and extracted keywords (summaryContent).
        for query_type in ['filename', 'keywords']:
            # Base query filtered by the current user's email.
            q = collection_ref.where(filter=FieldFilter('enrichedMetadata.userId', '==', user.email))
            if query_type == 'filename':
                q = q.where(filter=FieldFilter('enrichedMetadata.originalFileName', '==', query_text))
            else: # 'keywords'
                q = q.where(filter=FieldFilter('enrichedMetadata.summaryContent', 'array_contains', query_text))
            
            # Add matching documents to a dictionary to avoid duplicates.
            for doc in q.stream():
                if doc.id not in matching_docs:
                    doc_dict = doc.to_dict()
                    gcs_path_raw = doc_dict.get('enrichedMetadata', {}).get('gcsPath')
                    if gcs_path_raw:
                        # Construct a public URL for the file.
                        cleaned_gcs_path = gcs_path_raw.replace(f"gs://{app.config['GCS_BUCKET_NAME']}/", '', 1)
                        doc_dict['publicUrl'] = f"https://storage.googleapis.com/{app.config['GCS_BUCKET_NAME']}/{cleaned_gcs_path}"
                    matching_docs[doc.id] = doc_dict
    
    results = list(matching_docs.values())
    return jsonify(success=True, results=results, count=len(results)), 200


# --- Frequent Keywords Route ---
@app.route('/frequent_keywords', methods=['GET'])
@jwt_required()
def get_frequent_keywords():
    """
    Retrieves the most frequently used keywords for the authenticated user.
    This is used to provide search suggestions to the user.

    Returns:
        JSON: A list of the top 12 most frequent keywords and their counts.
    """
    user_id = get_jwt_identity()
    # The keywords are stored in a subcollection under the user's document.
    keywords_ref = db.collection('co-user-credentials').document(user_id).collection('keyword_counts')
    query = keywords_ref.order_by('count', direction=firestore.Query.DESCENDING).limit(12)
    results = query.stream()
    frequent_keywords = [{'name': doc.id, 'count': doc.to_dict().get('count', 0)} for doc in results]
    return jsonify(success=True, keywords=frequent_keywords), 200


# --- Download Routes ---
@app.route('/download_single_file', methods=['POST'])
@jwt_required()
def download_single_file():
    """
    Downloads a single file from GCS for the authenticated user.

    Request Body (JSON):
        {
            "fileUrl": "https://storage.googleapis.com/...",
            "originalFileName": "example.jpg"
        }

    Returns:
        File: The requested file as an attachment.
    """
    data = request.get_json()
    file_url = data.get('fileUrl')
    original_filename = data.get('originalFileName')
    if not file_url or not original_filename:
        return jsonify(success=False, error="File URL and filename are required."), 400
    
    storage_client = get_gcs_client()
    bucket_name = app.config['GCS_BUCKET_NAME']
    # Ensure the URL is a valid GCS public URL for the configured bucket.
    if f"https://storage.googleapis.com/{bucket_name}/" in file_url:
        blob_name = file_url.split(f"https://storage.googleapis.com/{bucket_name}/", 1)[1]
        bucket = storage_client.bucket(bucket_name)
        blob = bucket.blob(blob_name)
        file_content = blob.download_as_bytes()
        # Send the file content back to the client.
        return send_file(io.BytesIO(file_content), mimetype=blob.content_type, as_attachment=True, download_name=original_filename)
    return jsonify(success=False, error="Invalid file URL provided."), 400


@app.route('/download_selected_files', methods=['POST'])
@jwt_required()
def download_selected_files():
    """
    Downloads multiple selected files as a single ZIP archive.

    Request Body (JSON):
        { "fileUrls": ["url1", "url2", ...] }

    Returns:
        File: A ZIP file containing the requested files.
    """
    file_urls = request.json.get('fileUrls', [])
    if not file_urls:
        return jsonify(success=False, error="No file URLs provided."), 400

    # Use an in-memory binary stream to build the ZIP file without writing to disk.
    memory_file = io.BytesIO()
    storage_client = get_gcs_client()
    bucket_name = app.config['GCS_BUCKET_NAME']
    bucket = storage_client.bucket(bucket_name)

    with zipfile.ZipFile(memory_file, 'w', zipfile.ZIP_DEFLATED) as zf:
        for url in file_urls:
            if f"https://storage.googleapis.com/{bucket_name}/" in url:
                try:
                    # Download each file and add it to the ZIP archive.
                    blob_name = url.split(f"https://storage.googleapis.com/{bucket_name}/", 1)[1]
                    blob = bucket.blob(blob_name)
                    file_content = blob.download_as_bytes()
                    zf.writestr(os.path.basename(blob_name), file_content)
                except Exception as e:
                    logger.error(f"Failed to add {url} to zip: {e}")
    
    memory_file.seek(0) # Rewind the memory file to the beginning before sending.
    return send_file(memory_file, mimetype='application/zip', as_attachment=True, download_name='search_results.zip')


# --- Delete File Route ---
@app.route('/delete_file', methods=['DELETE'])
@jwt_required()
def delete_file():
    """
    Deletes a file from GCS and its corresponding metadata from Firestore.

    Request Body (JSON):
        { "filename": "example.jpg" }

    Returns:
        JSON: A success or error message.
    """
    current_user_id = get_jwt_identity()
    user = get_user_from_db(user_id=current_user_id)
    if not user:
        return jsonify(success=False, error="User not found."), 404

    filename_to_delete = request.json.get('filename')
    if not filename_to_delete:
        return jsonify(success=False, error="Filename is required."), 400

    doc_ref_to_delete, gcs_path = None, None
    # Find the file's metadata document in Firestore to get its GCS path.
    categories = ['images', 'videos', 'audios', 'others']
    for category in categories:
        query = content_metadata_db.collection_group(category) \
            .where(filter=FieldFilter('enrichedMetadata.userId', '==', user.email)) \
            .where(filter=FieldFilter('enrichedMetadata.originalFileName', '==', filename_to_delete)).limit(1)
        docs = list(query.stream())
        if docs:
            doc_snapshot = docs[0]
            doc_ref_to_delete = doc_snapshot.reference
            gcs_path = doc_snapshot.to_dict().get('enrichedMetadata', {}).get('gcsPath')
            break
    
    if not doc_ref_to_delete or not gcs_path:
        return jsonify(success=False, error="File not found or permission denied."), 404

    # Delete the file from Google Cloud Storage.
    storage_client = get_gcs_client()
    bucket_name = app.config['GCS_BUCKET_NAME']
    blob_name = gcs_path.replace(f'gs://{bucket_name}/', '')
    bucket = storage_client.bucket(bucket_name)
    blob = bucket.blob(blob_name)
    if blob.exists():
        blob.delete()
    
    # Delete the metadata document from Firestore.
    doc_ref_to_delete.delete()
    return jsonify(success=True, message=f"File '{filename_to_delete}' deleted successfully."), 200


# --- Main Entry Point ---
# This block ensures that the Flask development server runs only when the script is executed directly.
# It is not run when the file is imported as a module by another script (e.g., by a WSGI server like Gunicorn).
if __name__ == '__main__':
    # The port is fetched from an environment variable, which is standard for cloud deployments.
    app.run(debug=True, host='0.0.0.0', port=int(os.environ.get("PORT", 8080)))
