import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';

const AuthRoute = ({ children }) => {
  const location = useLocation();
  const user = localStorage.getItem('user');
  if (!user) {
    return <Navigate to='/login' state={{ from: location }} replace />;
  }
  return children;
};

export default AuthRoute;
