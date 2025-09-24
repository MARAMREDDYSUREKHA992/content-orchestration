# new-co
# Content Orchestration Platform  

## 🚀 Overview
The **Content Orchestration Platform** is a full-stack web application that enables users to log in, upload multiple files (documents, images, videos, etc.), and intelligently process them using AI (Garden Model). The extracted content and metadata are stored in **Google Firestore**, making the files **searchable and filterable** by keywords and file type.  

This platform demonstrates the integration of **Flask (backend)**, **React (frontend)**, and **Google Cloud services** for a seamless, production-ready system.  

---

## ✨ Features
- 🔐 **User Authentication** with JWT & Google Auth.  
- 📂 **Multi-file Uploads** (documents, images, videos).  
- 🤖 **AI Content Extraction** via Garden Model.  
- ☁️ **Google Cloud Storage** for storing user files.  
- 🔎 **Search & Filter** by keywords, metadata, or file type.  
- 📊 **Firestore Database** for metadata storage.  
- 🌐 **Frontend Interface** with ReactJS for smooth user experience.  
- 🚀 **Deployable** on Google Cloud using Docker & Cloud Build.  

---

## 🛠️ Tech Stack
### Backend (Flask)
- Flask  
- Flask-Login  
- Flask-JWT-Extended  
- Flask-CORS  
- google-auth  
- google-cloud-storage  
- firebase-admin  
- python-dotenv  
- gunicorn  

### Frontend (React)
- ReactJS  
- Node.js  
- Material UI / Custom CSS  
- Axios (for API calls)  

### Cloud & Deployment
- Google Cloud Storage  
- Firestore Database  
- Firebase Admin SDK  
- Docker & Cloud Build  

---

## 📂 Project Structure
```bash
content-orchestration/
│
├── backend/                  # Flask backend
│   ├── app.py                 # Main Flask app
│   ├── calculate_keywords.py  # Keyword extraction logic
│   ├── check_path.py          # Path/file checks
│   ├── requirements.txt       # Python dependencies
│   ├── my_credentials.json    # Google service credentials (not pushed to GitHub)
│   └── .env                   # Environment variables (ignored)
│
├── frontend/                 # React frontend
│   ├── public/                # Static files (icons, images, manifest)
│   ├── src/                   # React components & pages
│   ├── package.json           # Node dependencies
│   └── .env                   # Frontend env vars (ignored)
│
├── .gitignore                 # Ignore sensitive files/folders
├── Dockerfile                 # Docker build file
├── cloudbuild.yaml            # GCP Cloud Build config
└── README.md                  # Documentation
