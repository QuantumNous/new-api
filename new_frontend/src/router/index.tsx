import { createBrowserRouter, Navigate } from 'react-router-dom';
import { DashboardLayout } from '@/components/templates/DashboardLayout';
import { AuthLayout } from '@/components/templates/AuthLayout';
import { ProtectedRoute } from './ProtectedRoute';

// 懒加载页面组件
import { lazy } from 'react';

// 公共页面
import HomePage from '@/pages/Home';
const ApiDocsPage = lazy(() => import('@/pages/ApiDocs'));
const PricingPage = lazy(() => import('@/pages/Pricing'));

// 认证页面
const LoginPage = lazy(() => import('@/pages/auth/Login'));
const RegisterPage = lazy(() => import('@/pages/auth/Register'));
const ForgotPasswordPage = lazy(() => import('@/pages/auth/ForgotPassword'));
const OAuthCallbackPage = lazy(() => import('@/pages/auth/OAuthCallback'));

// 控制台页面
const DashboardPage = lazy(() => import('@/pages/console/Dashboard'));
const ChannelListPage = lazy(() => import('@/pages/console/channels/ChannelList'));
const ChannelCreatePage = lazy(() => import('@/pages/console/channels/ChannelCreate'));
const ChannelEditPage = lazy(() => import('@/pages/console/channels/ChannelEdit'));
const TokenListPage = lazy(() => import('@/pages/console/tokens/TokenList'));
const TokenCreatePage = lazy(() => import('@/pages/console/tokens/TokenCreate'));
const TokenEditPage = lazy(() => import('@/pages/console/tokens/TokenEdit'));
const UserListPage = lazy(() => import('@/pages/console/users/UserList'));
const UserCreatePage = lazy(() => import('@/pages/console/users/UserCreate'));
const UserEditPage = lazy(() => import('@/pages/console/users/UserEdit'));
const LogListPage = lazy(() => import('@/pages/console/logs/LogList'));
const LogSelfPage = lazy(() => import('@/pages/console/logs/LogSelf'));
const ModelListPage = lazy(() => import('@/pages/console/models/ModelList'));
const ModelSyncPage = lazy(() => import('@/pages/console/models/ModelSync'));
const ModelsShowcasePage = lazy(() => import('@/pages/console/models/Models'));
const ProfileInfoPage = lazy(() => import('@/pages/console/profile/ProfileInfo'));
const SecurityPage = lazy(() => import('@/pages/console/profile/Security'));
const TwoFactorPage = lazy(() => import('@/pages/console/profile/TwoFactor'));
const PasskeyPage = lazy(() => import('@/pages/console/profile/Passkey'));
const BillingPage = lazy(() => import('@/pages/console/profile/Billing'));
const RedemptionListPage = lazy(() => import('@/pages/console/redemptions/RedemptionList'));
const RedemptionCreatePage = lazy(() => import('@/pages/console/redemptions/RedemptionCreate'));
const GeneralSettingsPage = lazy(() => import('@/pages/console/settings/GeneralSettings'));
const OAuthSettingsPage = lazy(() => import('@/pages/console/settings/OAuthSettings'));
const PaymentSettingsPage = lazy(() => import('@/pages/console/settings/PaymentSettings'));
const SecuritySettingsPage = lazy(() => import('@/pages/console/settings/SecuritySettings'));
const ModelSettingsPage = lazy(() => import('@/pages/console/settings/ModelSettings'));
const DeploymentListPage = lazy(() => import('@/pages/console/deployments/DeploymentList'));
const DeploymentCreatePage = lazy(() => import('@/pages/console/deployments/DeploymentCreate'));
const GroupListPage = lazy(() => import('@/pages/console/groups/GroupList'));

// 操练场
const PlaygroundPage = lazy(() => import('@/pages/playground/Chat'));

export const router = createBrowserRouter([
  {
    path: '/',
    element: <HomePage />,
  },
  {
    path: '/pricing',
    element: <PricingPage />,
  },
  {
    path: '/api-docs',
    element: <ApiDocsPage />,
  },
  {
    path: '/auth',
    element: <AuthLayout />,
    children: [
      {
        path: 'login',
        element: <LoginPage />,
      },
      {
        path: 'register',
        element: <RegisterPage />,
      },
      {
        path: 'forgot-password',
        element: <ForgotPasswordPage />,
      },
      {
        index: true,
        element: <Navigate to="/auth/login" replace />,
      },
    ],
  },
  {
    path: '/oauth/:provider',
    element: <OAuthCallbackPage />,
  },
  {
    path: '/models',
    element: <ModelsShowcasePage />,
  },
  {
    path: '/console',
    element: (
      <ProtectedRoute>
        <DashboardLayout />
      </ProtectedRoute>
    ),
    children: [
      {
        index: true,
        element: <Navigate to="/console/dashboard" replace />,
      },
      {
        path: 'dashboard',
        element: <DashboardPage />,
      },
      {
        path: 'channels',
        element: <ChannelListPage />,
      },
      {
        path: 'channels/create',
        element: <ChannelCreatePage />,
      },
      {
        path: 'channels/:id/edit',
        element: <ChannelEditPage />,
      },
      {
        path: 'channels/:id/edit',
        element: <ChannelEditPage />,
      },
      {
        path: 'tokens',
        element: <TokenListPage />,
      },
      {
        path: 'tokens/create',
        element: <TokenCreatePage />,
      },
      {
        path: 'tokens/:id/edit',
        element: <TokenEditPage />,
      },
      {
        path: 'users',
        element: <UserListPage />,
      },
      {
        path: 'users/create',
        element: <UserCreatePage />,
      },
      {
        path: 'users/:id/edit',
        element: <UserEditPage />,
      },
      {
        path: 'logs',
        element: <LogListPage />,
      },
      {
        path: 'logs/self',
        element: <LogSelfPage />,
      },
      {
        path: 'admin/models',
        element: <ModelListPage />,
      },
      {
        path: 'admin/models/sync',
        element: <ModelSyncPage />,
      },
      {
        path: 'redemptions',
        element: <RedemptionListPage />,
      },
      {
        path: 'redemptions/create',
        element: <RedemptionCreatePage />,
      },
      {
        path: 'deployments',
        element: <DeploymentListPage />,
      },
      {
        path: 'deployments/create',
        element: <DeploymentCreatePage />,
      },
      {
        path: 'groups',
        element: <GroupListPage />,
      },
      {
        path: 'settings/general',
        element: <GeneralSettingsPage />,
      },
      {
        path: 'settings/oauth',
        element: <OAuthSettingsPage />,
      },
      {
        path: 'settings/payment',
        element: <PaymentSettingsPage />,
      },
      {
        path: 'settings/security',
        element: <SecuritySettingsPage />,
      },
      {
        path: 'settings/models',
        element: <ModelSettingsPage />,
      },
      {
        path: 'profile/info',
        element: <ProfileInfoPage />,
      },
      {
        path: 'profile/security',
        element: <SecurityPage />,
      },
      {
        path: 'profile/2fa',
        element: <TwoFactorPage />,
      },
      {
        path: 'profile/passkey',
        element: <PasskeyPage />,
      },
      {
        path: 'profile/billing',
        element: <BillingPage />,
      },
      {
        index: true,
        element: <Navigate to="/console/dashboard" replace />,
      },
    ],
  },
  {
    path: '/chat',
    element: (
      <ProtectedRoute>
        <DashboardLayout showSidebar={false} />
      </ProtectedRoute>
    ),
    children: [
      {
        index: true,
        element: <PlaygroundPage />,
      },
    ],
  },
  {
    path: '*',
    element: <Navigate to="/" replace />,
  },
]);
