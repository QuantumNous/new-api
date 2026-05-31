import { createBrowserRouter, Navigate } from 'react-router'
import { lazy, Suspense } from 'react'
import { AuthLayout } from './components/auth-layout'
import { AppLayout } from './components/app-layout'
import { PublicLayout } from './components/public-layout'
import { AuthGuard, AdminGuard, RootGuard } from './components/auth-guard'

const Home = lazy(() => import('./pages/home').then(m => ({ default: m.Home })))
const SignIn = lazy(() => import('./pages/sign-in').then(m => ({ default: m.SignIn })))
const Register = lazy(() => import('./pages/register').then(m => ({ default: m.Register })))
const ForgotPassword = lazy(() => import('./pages/forgot-password').then(m => ({ default: m.ForgotPassword })))
const ResetPassword = lazy(() => import('./pages/reset-password').then(m => ({ default: m.ResetPassword })))
const Dashboard = lazy(() => import('./pages/dashboard').then(m => ({ default: m.Dashboard })))
const Keys = lazy(() => import('./pages/keys').then(m => ({ default: m.Keys })))
const Wallet = lazy(() => import('./pages/wallet').then(m => ({ default: m.Wallet })))
const UsageLogs = lazy(() => import('./pages/usage-logs').then(m => ({ default: m.UsageLogs })))
const Profile = lazy(() => import('./pages/profile').then(m => ({ default: m.Profile })))
const Playground = lazy(() => import('./pages/playground').then(m => ({ default: m.Playground })))
const Channels = lazy(() => import('./pages/channels').then(m => ({ default: m.Channels })))
const Users = lazy(() => import('./pages/users').then(m => ({ default: m.Users })))
const Models = lazy(() => import('./pages/models').then(m => ({ default: m.Models })))
const RedemptionCodes = lazy(() => import('./pages/redemption-codes').then(m => ({ default: m.RedemptionCodes })))
const Subscriptions = lazy(() => import('./pages/subscriptions').then(m => ({ default: m.Subscriptions })))
const Pricing = lazy(() => import('./pages/pricing').then(m => ({ default: m.Pricing })))
const About = lazy(() => import('./pages/about').then(m => ({ default: m.About })))
const Settings = lazy(() => import('./pages/settings').then(m => ({ default: m.Settings })))
const NotFound = lazy(() => import('./pages/not-found').then(m => ({ default: m.NotFound })))

function Fallback() {
  return <div className="page-loading"><div className="spinner" /></div>
}

export const router = createBrowserRouter([
  {
    element: <PublicLayout />,
    children: [
      { path: '/', element: <Suspense fallback={<Fallback />}><Home /></Suspense> },
      { path: '/about', element: <Suspense fallback={<Fallback />}><About /></Suspense> },
      { path: '/pricing', element: <Suspense fallback={<Fallback />}><Pricing /></Suspense> },
    ],
  },
  {
    element: <AuthLayout />,
    children: [
      { path: '/sign-in', element: <Suspense fallback={<Fallback />}><SignIn /></Suspense> },
      { path: '/register', element: <Suspense fallback={<Fallback />}><Register /></Suspense> },
      { path: '/forgot-password', element: <Suspense fallback={<Fallback />}><ForgotPassword /></Suspense> },
      { path: '/reset', element: <Suspense fallback={<Fallback />}><ResetPassword /></Suspense> },
    ],
  },
  {
    element: <AuthGuard><AppLayout /></AuthGuard>,
    children: [
      { path: '/dashboard', element: <Suspense fallback={<Fallback />}><Dashboard /></Suspense> },
      { path: '/keys', element: <Suspense fallback={<Fallback />}><Keys /></Suspense> },
      { path: '/wallet', element: <Suspense fallback={<Fallback />}><Wallet /></Suspense> },
      { path: '/usage-logs', element: <Suspense fallback={<Fallback />}><UsageLogs /></Suspense> },
      { path: '/profile', element: <Suspense fallback={<Fallback />}><Profile /></Suspense> },
      { path: '/playground', element: <Suspense fallback={<Fallback />}><Playground /></Suspense> },
      { path: '/subscriptions', element: <Suspense fallback={<Fallback />}><Subscriptions /></Suspense> },
    ],
  },
  {
    element: <AdminGuard><AppLayout /></AdminGuard>,
    children: [
      { path: '/channels', element: <Suspense fallback={<Fallback />}><Channels /></Suspense> },
      { path: '/users', element: <Suspense fallback={<Fallback />}><Users /></Suspense> },
      { path: '/models', element: <Suspense fallback={<Fallback />}><Models /></Suspense> },
      { path: '/redemption-codes', element: <Suspense fallback={<Fallback />}><RedemptionCodes /></Suspense> },
    ],
  },
  {
    element: <RootGuard><AppLayout /></RootGuard>,
    children: [
      { path: '/settings/*', element: <Suspense fallback={<Fallback />}><Settings /></Suspense> },
    ],
  },
  { path: '*', element: <Suspense fallback={<Fallback />}><NotFound /></Suspense> },
])
