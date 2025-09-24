/*This code sets up a React app with "routing and authentication" using react-router-dom and a custom AuthProvider.
It protects the /dashboard route, redirecting users to the home page (/). */
import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './AuthContext'; // Import AuthProvider and useAuth
import HomePage from './HomePage'; // Import the new HomePage component
import Dashboard from './Dashboard';   // Import Dashboard component

// Component to handle routing based on authentication status
const AppRoutes = () => {
  const { user, loading } = useAuth(); // Access authentication state

  if (loading) {
    // Show a loading indicator while authentication state is being determined
    return (
      <div className="flex items-center justify-center min-h-screen text-xl text-gray-700">
        {/* Loading... can be added here if desired */}
      </div>
    );
  }

  return (
    <Routes>
      {/* Route for the home page, which now includes the login form */}
      <Route path="/" element={<HomePage />} />

      {/* Route for dashboard: If user is not logged in, redirect to the homepage */}
      <Route path="/dashboard" element={user ? <Dashboard /> : <Navigate to="/" />} />

      {/* Catch-all route: Redirects any other path to the home page */}
      <Route path="*" element={<Navigate to="/" />} />
    </Routes>
  );
};

// Main App component that sets up the Router and AuthProvider
const App = () => {
  return (
    <div className="font-sans antialiased text-gray-900 bg-gray-100 min-h-screen">
      <Router>
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      </Router>
    </div>
  );
};

export default App;