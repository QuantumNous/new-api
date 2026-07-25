import React from 'react';
import { createBrowserRouter } from 'react-router-dom';

import Root from './Root';
import AuthRoute from './components/AuthRoute';
import TabLayout from './layouts/TabLayout';
import Audio from './pages/Audio';
import Chat from './pages/Chat';
import Experience from './pages/Experience';
import Home from './pages/Home';
import ImagePage from './pages/Image';
import Login from './pages/Login';
import Logs from './pages/Logs';
import Models from './pages/Models';
import Music from './pages/Music';
import Profile from './pages/Profile';
import Register from './pages/Register';
import Setting from './pages/Setting';
import TicketDetail from './pages/TicketDetail';
import Tickets from './pages/Tickets';
import Tokens from './pages/Tokens';
import Video from './pages/Video';
import AdminEnterprise from './pages/admin/AdminEnterprise';
import AdminInvoices from './pages/admin/AdminInvoices';
import AdminKyc from './pages/admin/AdminKyc';
import AdminTicketDetail from './pages/admin/AdminTicketDetail';
import AdminTickets from './pages/admin/AdminTickets';
import AdminTransfers from './pages/admin/AdminTransfers';

const guarded = (element) => <AuthRoute>{element}</AuthRoute>;

const router = createBrowserRouter(
  [
    {
      element: <Root />,
      children: [
        { path: '/login', element: <Login /> },
        { path: '/register', element: <Register /> },
        {
          element: guarded(<TabLayout />),
          children: [
            { path: '/', element: <Home /> },
            { path: '/experience', element: <Experience /> },
            { path: '/profile', element: <Profile /> },
          ],
        },
        { path: '/models', element: guarded(<Models />) },
        { path: '/tokens', element: guarded(<Tokens />) },
        { path: '/logs', element: guarded(<Logs />) },
        { path: '/setting', element: guarded(<Setting />) },
        { path: '/tickets', element: guarded(<Tickets />) },
        { path: '/tickets/:id', element: guarded(<TicketDetail />) },
        { path: '/admin/tickets', element: guarded(<AdminTickets />) },
        { path: '/admin/tickets/:id', element: guarded(<AdminTicketDetail />) },
        { path: '/admin/kyc', element: guarded(<AdminKyc />) },
        { path: '/admin/enterprise', element: guarded(<AdminEnterprise />) },
        { path: '/admin/transfers', element: guarded(<AdminTransfers />) },
        { path: '/admin/invoices', element: guarded(<AdminInvoices />) },
        { path: '/chat', element: guarded(<Chat />) },
        { path: '/video', element: guarded(<Video />) },
        { path: '/music', element: guarded(<Music />) },
        { path: '/audio', element: guarded(<Audio />) },
        { path: '/image', element: guarded(<ImagePage />) },
      ],
    },
  ],
  { basename: '/m' },
);

export default router;
