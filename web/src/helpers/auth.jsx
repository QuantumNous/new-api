/*
Copyright (C) 2025 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/

import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';

const LOGIN_REDIRECT_PATH_KEY = 'login_redirect_path';

function isSafeInternalPath(path) {
  return (
    typeof path === 'string' &&
    path.startsWith('/') &&
    !path.startsWith('//') &&
    !path.startsWith('/login') &&
    !path.startsWith('/oauth/')
  );
}

export function getLoginRedirectPath(from, fallback = '/console') {
  if (typeof from === 'string') {
    return isSafeInternalPath(from) ? from : fallback;
  }

  if (from?.pathname) {
    const path = `${from.pathname}${from.search || ''}${from.hash || ''}`;
    return isSafeInternalPath(path) ? path : fallback;
  }

  return fallback;
}

export function saveLoginRedirectPath(path) {
  const redirectPath = getLoginRedirectPath(path, '');
  if (!redirectPath) {
    return;
  }
  sessionStorage.setItem(LOGIN_REDIRECT_PATH_KEY, redirectPath);
}

export function getStoredLoginRedirectPath(fallback = '/console') {
  const redirectPath = sessionStorage.getItem(LOGIN_REDIRECT_PATH_KEY);
  return getLoginRedirectPath(redirectPath, fallback);
}

export function consumeLoginRedirectPath(fallback = '/console') {
  const redirectPath = getStoredLoginRedirectPath(fallback);
  sessionStorage.removeItem(LOGIN_REDIRECT_PATH_KEY);
  return redirectPath;
}

export function clearLoginRedirectPath() {
  sessionStorage.removeItem(LOGIN_REDIRECT_PATH_KEY);
}

export function authHeader() {
  // return authorization header with jwt token
  let user = JSON.parse(localStorage.getItem('user'));

  if (user && user.token) {
    return { Authorization: 'Bearer ' + user.token };
  } else {
    return {};
  }
}

export const AuthRedirect = ({ children }) => {
  const user = localStorage.getItem('user');
  const location = useLocation();

  if (user) {
    return (
      <Navigate
        to={getLoginRedirectPath(
          location.state?.from,
          getStoredLoginRedirectPath('/console'),
        )}
        replace
      />
    );
  }

  return children;
};

function PrivateRoute({ children }) {
  const location = useLocation();

  if (!localStorage.getItem('user')) {
    saveLoginRedirectPath(location);
    return <Navigate to='/login' replace state={{ from: location }} />;
  }
  return children;
}

export function AdminRoute({ children }) {
  const location = useLocation();
  const raw = localStorage.getItem('user');
  if (!raw) {
    saveLoginRedirectPath(location);
    return <Navigate to='/login' replace state={{ from: location }} />;
  }
  try {
    const user = JSON.parse(raw);
    if (user && typeof user.role === 'number' && user.role >= 10) {
      return children;
    }
  } catch (e) {
    // ignore
  }
  return <Navigate to='/forbidden' replace />;
}

export { PrivateRoute };
