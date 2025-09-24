import React, { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext(null);

const AUTH_TOKEN_KEY = 'pragyashal_auth_token';
const AUTH_USER_KEY = 'pragyashal_user_data';

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    try {
      const storedUser = localStorage.getItem(AUTH_USER_KEY);
      const token = localStorage.getItem(AUTH_TOKEN_KEY);
      
      if (storedUser && token) {
        setUser(JSON.parse(storedUser));
      }
    } catch (error) {
      console.error("Failed to parse user from localStorage", error);
      localStorage.clear(); 
    } finally {
      setLoading(false);
    }
  }, []);

  const login = (userData, token) => {
    if (!userData || !token) {
      console.error("Login function called with invalid data.");
      return;
    }
    localStorage.setItem(AUTH_USER_KEY, JSON.stringify(userData));
    localStorage.setItem(AUTH_TOKEN_KEY, token);
    setUser(userData);
  };

  const logout = () => {
    localStorage.removeItem(AUTH_USER_KEY);
    localStorage.removeItem(AUTH_TOKEN_KEY);
    setUser(null);
  };

  const getToken = () => {
    return localStorage.getItem(AUTH_TOKEN_KEY);
  };

  const value = { user, loading, login, logout, getToken };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  return useContext(AuthContext);
};