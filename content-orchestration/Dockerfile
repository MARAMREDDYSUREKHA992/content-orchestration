# ---- STAGE 1: Frontend Build ----
# Use an official Node.js image to build the React application
FROM node:20-alpine AS frontend-builder

# Set the working directory for the frontend code
WORKDIR /app/frontend

# Declare build arguments for both client ID and backend URL
ARG REACT_APP_GOOGLE_CLIENT_ID
ARG REACT_APP_FLASK_BACKEND_URL

# Set them as environment variables for the build process
ENV REACT_APP_GOOGLE_CLIENT_ID=$REACT_APP_GOOGLE_CLIENT_ID
ENV REACT_APP_FLASK_BACKEND_URL=$REACT_APP_FLASK_BACKEND_URL

# Copy the frontend package files and install dependencies
COPY frontend/package.json frontend/package-lock.json ./
RUN npm install

# Copy the entire frontend source code and run the build command
COPY frontend/ ./
RUN npm run build


# ---- STAGE 2: Backend Runtime ----
# Use a Python image for the Flask backend
FROM python:3.9-slim AS final

# Set the working directory for the entire application
WORKDIR /app

# Copy the backend's requirements.txt and install dependencies
COPY backend/requirements.txt ./backend/
RUN pip install --no-cache-dir -r backend/requirements.txt

# Copy the backend code
COPY backend/ ./backend/

# Copy the built frontend static files from the builder stage into the final image
COPY --from=frontend-builder /app/frontend/build ./frontend/build

# Expose the port that the container will listen on
ENV PORT 8080
EXPOSE $PORT

# Define the command to run the Flask application with Gunicorn
# It will run the 'app' callable from the 'app.py' file inside the 'backend' directory.
CMD exec gunicorn --bind :$PORT --workers 1 --threads 8 --timeout 0 backend.app:app
