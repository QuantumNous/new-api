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

import React, { lazy, Suspense, useContext, useMemo } from 'react';
import { Route, Routes, useLocation, useParams } from 'react-router-dom';
import Loading from './components/common/ui/Loading';
import { AuthRedirect, PrivateRoute, AdminRoute } from './helpers/auth';
import { StatusContext } from './context/Status';
import SetupCheck from './components/layout/SetupCheck';

const Home = lazy(() => import('./pages/Home'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const About = lazy(() => import('./pages/About'));
const UserAgreement = lazy(() => import('./pages/UserAgreement'));
const PrivacyPolicy = lazy(() => import('./pages/PrivacyPolicy'));
const Setup = lazy(() => import('./pages/Setup'));
const User = lazy(() => import('./pages/User'));
const Setting = lazy(() => import('./pages/Setting'));
const Channel = lazy(() => import('./pages/Channel'));
const Token = lazy(() => import('./pages/Token'));
const Redemption = lazy(() => import('./pages/Redemption'));
const TopUp = lazy(() => import('./pages/TopUp'));
const Log = lazy(() => import('./pages/Log'));
const Chat = lazy(() => import('./pages/Chat'));
const Chat2Link = lazy(() => import('./pages/Chat2Link'));
const Midjourney = lazy(() => import('./pages/Midjourney'));
const Pricing = lazy(() => import('./pages/Pricing'));
const Task = lazy(() => import('./pages/Task'));
const ErrorLog = lazy(() => import('./pages/ErrorLog'));
const ModelPage = lazy(() => import('./pages/Model'));
const ModelDeploymentPage = lazy(() => import('./pages/ModelDeployment'));
const Playground = lazy(() => import('./pages/Playground'));
const Subscription = lazy(() => import('./pages/Subscription'));
const NotFound = lazy(() => import('./pages/NotFound'));
const Forbidden = lazy(() => import('./pages/Forbidden'));
const PersonalSetting = lazy(
  () => import('./components/settings/PersonalSetting'),
);
const LoginForm = lazy(() => import('./components/auth/LoginForm'));
const RegisterForm = lazy(() => import('./components/auth/RegisterForm'));
const PasswordResetForm = lazy(
  () => import('./components/auth/PasswordResetForm'),
);
const PasswordResetConfirm = lazy(
  () => import('./components/auth/PasswordResetConfirm'),
);
const OAuth2Callback = lazy(() => import('./components/auth/OAuth2Callback'));

function DynamicOAuth2Callback() {
  const { provider } = useParams();
  return <OAuth2Callback type={provider} />;
}

function LazyRoute({ children }) {
  const location = useLocation();
  return (
    <Suspense fallback={<Loading />} key={location.pathname}>
      {children}
    </Suspense>
  );
}

function App() {
  const [statusState] = useContext(StatusContext);

  // 获取模型广场权限配置
  const pricingRequireAuth = useMemo(() => {
    const headerNavModulesConfig = statusState?.status?.HeaderNavModules;
    if (headerNavModulesConfig) {
      try {
        const modules = JSON.parse(headerNavModulesConfig);

        // 处理向后兼容性：如果pricing是boolean，默认不需要登录
        if (typeof modules.pricing === 'boolean') {
          return false; // 默认不需要登录鉴权
        }

        // 如果是对象格式，使用requireAuth配置
        return modules.pricing?.requireAuth === true;
      } catch (error) {
        console.error('解析顶栏模块配置失败:', error);
        return false; // 默认不需要登录
      }
    }
    return false; // 默认不需要登录
  }, [statusState?.status?.HeaderNavModules]);

  return (
    <SetupCheck>
      <Routes>
        <Route
          path='/'
          element={
            <LazyRoute>
              <Home />
            </LazyRoute>
          }
        />
        <Route
          path='/setup'
          element={
            <LazyRoute>
              <Setup />
            </LazyRoute>
          }
        />
        <Route
          path='/forbidden'
          element={
            <LazyRoute>
              <Forbidden />
            </LazyRoute>
          }
        />
        <Route
          path='/console/models'
          element={
            <AdminRoute>
              <LazyRoute>
                <ModelPage />
              </LazyRoute>
            </AdminRoute>
          }
        />
        <Route
          path='/console/deployment'
          element={
            <AdminRoute>
              <LazyRoute>
                <ModelDeploymentPage />
              </LazyRoute>
            </AdminRoute>
          }
        />
        <Route
          path='/console/subscription'
          element={
            <AdminRoute>
              <LazyRoute>
                <Subscription />
              </LazyRoute>
            </AdminRoute>
          }
        />
        <Route
          path='/console/channel'
          element={
            <AdminRoute>
              <LazyRoute>
                <Channel />
              </LazyRoute>
            </AdminRoute>
          }
        />
        <Route
          path='/console/token'
          element={
            <PrivateRoute>
              <LazyRoute>
                <Token />
              </LazyRoute>
            </PrivateRoute>
          }
        />
        <Route
          path='/console/playground'
          element={
            <PrivateRoute>
              <LazyRoute>
                <Playground />
              </LazyRoute>
            </PrivateRoute>
          }
        />
        <Route
          path='/console/redemption'
          element={
            <AdminRoute>
              <LazyRoute>
                <Redemption />
              </LazyRoute>
            </AdminRoute>
          }
        />
        <Route
          path='/console/user'
          element={
            <AdminRoute>
              <LazyRoute>
                <User />
              </LazyRoute>
            </AdminRoute>
          }
        />
        <Route
          path='/user/reset'
          element={
            <LazyRoute>
              <PasswordResetConfirm />
            </LazyRoute>
          }
        />
        <Route
          path='/login'
          element={
            <LazyRoute>
              <AuthRedirect>
                <LoginForm />
              </AuthRedirect>
            </LazyRoute>
          }
        />
        <Route
          path='/register'
          element={
            <LazyRoute>
              <AuthRedirect>
                <RegisterForm />
              </AuthRedirect>
            </LazyRoute>
          }
        />
        <Route
          path='/reset'
          element={
            <LazyRoute>
              <PasswordResetForm />
            </LazyRoute>
          }
        />
        <Route
          path='/oauth/github'
          element={
            <LazyRoute>
              <OAuth2Callback type='github' />
            </LazyRoute>
          }
        />
        <Route
          path='/oauth/discord'
          element={
            <LazyRoute>
              <OAuth2Callback type='discord' />
            </LazyRoute>
          }
        />
        <Route
          path='/oauth/oidc'
          element={
            <LazyRoute>
              <OAuth2Callback type='oidc' />
            </LazyRoute>
          }
        />
        <Route
          path='/oauth/linuxdo'
          element={
            <LazyRoute>
              <OAuth2Callback type='linuxdo' />
            </LazyRoute>
          }
        />
        <Route
          path='/oauth/:provider'
          element={
            <LazyRoute>
              <DynamicOAuth2Callback />
            </LazyRoute>
          }
        />
        <Route
          path='/console/setting'
          element={
            <AdminRoute>
              <LazyRoute>
                <Setting />
              </LazyRoute>
            </AdminRoute>
          }
        />
        <Route
          path='/console/personal'
          element={
            <PrivateRoute>
              <LazyRoute>
                <PersonalSetting />
              </LazyRoute>
            </PrivateRoute>
          }
        />
        <Route
          path='/console/topup'
          element={
            <PrivateRoute>
              <LazyRoute>
                <TopUp />
              </LazyRoute>
            </PrivateRoute>
          }
        />
        <Route
          path='/console/log'
          element={
            <PrivateRoute>
              <LazyRoute>
                <Log />
              </LazyRoute>
            </PrivateRoute>
          }
        />
        <Route
          path='/console'
          element={
            <PrivateRoute>
              <LazyRoute>
                <Dashboard />
              </LazyRoute>
            </PrivateRoute>
          }
        />
        <Route
          path='/console/midjourney'
          element={
            <PrivateRoute>
              <LazyRoute>
                <Midjourney />
              </LazyRoute>
            </PrivateRoute>
          }
        />
        <Route
          path='/console/task'
          element={
            <PrivateRoute>
              <LazyRoute>
                <Task />
              </LazyRoute>
            </PrivateRoute>
          }
        />
        <Route
          path='/console/error-logs'
          element={
            <AdminRoute>
              <LazyRoute>
                <ErrorLog />
              </LazyRoute>
            </AdminRoute>
          }
        />
        <Route
          path='/pricing'
          element={
            pricingRequireAuth ? (
              <PrivateRoute>
                <LazyRoute>
                  <Pricing />
                </LazyRoute>
              </PrivateRoute>
            ) : (
              <LazyRoute>
                <Pricing />
              </LazyRoute>
            )
          }
        />
        <Route
          path='/about'
          element={
            <LazyRoute>
              <About />
            </LazyRoute>
          }
        />
        <Route
          path='/user-agreement'
          element={
            <LazyRoute>
              <UserAgreement />
            </LazyRoute>
          }
        />
        <Route
          path='/privacy-policy'
          element={
            <LazyRoute>
              <PrivacyPolicy />
            </LazyRoute>
          }
        />
        <Route
          path='/console/chat/:id?'
          element={
            <LazyRoute>
              <Chat />
            </LazyRoute>
          }
        />
        {/* 方便使用chat2link直接跳转聊天... */}
        <Route
          path='/chat2link'
          element={
            <PrivateRoute>
              <LazyRoute>
                <Chat2Link />
              </LazyRoute>
            </PrivateRoute>
          }
        />
        <Route
          path='*'
          element={
            <LazyRoute>
              <NotFound />
            </LazyRoute>
          }
        />
      </Routes>
    </SetupCheck>
  );
}

export default App;
