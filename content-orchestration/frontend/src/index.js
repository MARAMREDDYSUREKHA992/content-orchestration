    // frontend/src/index.js
    // This is the entry point of your React application.
    import React from 'react';
    import ReactDOM from 'react-dom/client'; // For React 18+
    import App from './App';
    import './index.css'; // Import global styles

    // Create a root and render the App component into the 'root' div in public/index.html
    const root = ReactDOM.createRoot(document.getElementById('root'));
    root.render(
      <React.StrictMode>
        <App />
      </React.StrictMode>
    );
    