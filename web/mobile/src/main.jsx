import React from 'react';
import ReactDOM from 'react-dom/client';
import { RouterProvider } from 'react-router-dom';

import { StatusProvider } from '@classic/context/Status';
import { UserProvider } from '@classic/context/User';

import './i18n';
import router from './router';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <StatusProvider>
      <UserProvider>
        <RouterProvider router={router} />
      </UserProvider>
    </StatusProvider>
  </React.StrictMode>,
);
