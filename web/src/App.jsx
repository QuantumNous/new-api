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
import { AuthRedirect, PrivateRoute, AdminRoute } from './helpers';
import { StatusContext } from './context/Status';
import SetupCheck from './components/layout/SetupCheck';

const Home = lazy(() => import('./pages/Home'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Docs = lazy(() => import('./pages/Docs'));
const UserAgreement = lazy(() => import('./pages/UserAgreement'));
const PrivacyPolicy = lazy(() => import('./pages/PrivacyPolicy'));
const User = lazy(() => import('./pages/User'));
const RegisterForm = lazy(() => import('./components/auth/RegisterForm'));
const LoginForm = lazy(() => import('./components/auth/LoginForm'));
const NotFound = lazy(() => import('./pages/NotFound'));
const Forbidden = lazy(() => import('./pages/Forbidden'));
const Setting = lazy(() => import('./pages/Setting'));
const PasswordResetForm = lazy(() => import('./components/auth/PasswordResetForm'));
const PasswordResetConfirm = lazy(() => import('./components/auth/PasswordResetConfirm'));
const Channel = lazy(() => import('./pages/Channel'));
const Token = lazy(() => import('./pages/Token'));
const Redemption = lazy(() => import('./pages/Redemption'));
const TopUp = lazy(() => import('./pages/TopUp'));
const Log = lazy(() => import('./pages/Log'));
const Midjourney = lazy(() => import('./pages/Midjourney'));
const Pricing = lazy(() => import('./pages/Pricing'));
const Task = lazy(() => import('./pages/Task'));
const ModelPage = lazy(() => import('./pages/Model'));
const ModelDeploymentPage = lazy(() => import('./pages/ModelDeployment'));
const Playground = lazy(() => import('./pages/Playground'));
const Subscription = lazy(() => import('./pages/Subscription'));
const OAuth2Callback = lazy(() => import('./components/auth/OAuth2Callback'));
const PersonalSetting = lazy(() => import('./components/settings/PersonalSetting'));
const Setup = lazy(() => import('./pages/Setup'));

function DynamicOAuth2Callback() {
  const { provider } = useParams();
  return <OAuth2Callback type={provider} />;
}

function App() {
  const location = useLocation();
  const [statusState] = useContext(StatusContext);
  const withSuspense = (element) => (
    <Suspense fallback={<Loading></Loading>} key={location.pathname}>
      {element}
    </Suspense>
  );

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
        <Route path='/' element={withSuspense(<Home />)} />
        <Route path='/setup' element={withSuspense(<Setup />)} />
        <Route path='/forbidden' element={withSuspense(<Forbidden />)} />
        <Route
          path='/console/models'
          element={
            <AdminRoute>
              {withSuspense(<ModelPage />)}
            </AdminRoute>
          }
        />
        <Route
          path='/console/deployment'
          element={
            <AdminRoute>
              {withSuspense(<ModelDeploymentPage />)}
            </AdminRoute>
          }
        />
        <Route
          path='/console/subscription'
          element={
            <AdminRoute>
              {withSuspense(<Subscription />)}
            </AdminRoute>
          }
        />
        <Route
          path='/console/channel'
          element={
            <AdminRoute>
              {withSuspense(<Channel />)}
            </AdminRoute>
          }
        />
        <Route
          path='/console/token'
          element={
            <PrivateRoute>
              {withSuspense(<Token />)}
            </PrivateRoute>
          }
        />
        <Route
          path='/console/playground'
          element={
            <PrivateRoute>
              {withSuspense(<Playground />)}
            </PrivateRoute>
          }
        />
        <Route
          path='/console/redemption'
          element={
            <AdminRoute>
              {withSuspense(<Redemption />)}
            </AdminRoute>
          }
        />
        <Route
          path='/console/user'
          element={
            <AdminRoute>
              {withSuspense(<User />)}
            </AdminRoute>
          }
        />
        <Route
          path='/user/reset'
          element={withSuspense(<PasswordResetConfirm />)}
        />
        <Route
          path='/login'
          element={
            withSuspense(
              <AuthRedirect>
                <LoginForm />
              </AuthRedirect>
            )
          }
        />
        <Route
          path='/register'
          element={
            withSuspense(
              <AuthRedirect>
                <RegisterForm />
              </AuthRedirect>
            )
          }
        />
        <Route
          path='/reset'
          element={withSuspense(<PasswordResetForm />)}
        />
        <Route
          path='/oauth/github'
          element={withSuspense(<OAuth2Callback type='github'></OAuth2Callback>)}
        />
        <Route
          path='/oauth/discord'
          element={withSuspense(<OAuth2Callback type='discord'></OAuth2Callback>)}
        />
        <Route
          path='/oauth/oidc'
          element={withSuspense(<OAuth2Callback type='oidc'></OAuth2Callback>)}
        />
        <Route
          path='/oauth/linuxdo'
          element={withSuspense(<OAuth2Callback type='linuxdo'></OAuth2Callback>)}
        />
        <Route
          path='/oauth/:provider'
          element={withSuspense(<DynamicOAuth2Callback />)}
        />
        <Route
          path='/console/setting'
          element={
            <AdminRoute>
              {withSuspense(<Setting />)}
            </AdminRoute>
          }
        />
        <Route
          path='/console/personal'
          element={
            <PrivateRoute>
              {withSuspense(<PersonalSetting />)}
            </PrivateRoute>
          }
        />
        <Route
          path='/console/topup'
          element={
            <PrivateRoute>
              {withSuspense(<TopUp />)}
            </PrivateRoute>
          }
        />
        <Route
          path='/console/log'
          element={
            <PrivateRoute>
              {withSuspense(<Log />)}
            </PrivateRoute>
          }
        />
        <Route
          path='/console'
          element={
            <PrivateRoute>
              {withSuspense(<Dashboard />)}
            </PrivateRoute>
          }
        />
        <Route
          path='/console/midjourney'
          element={
            <PrivateRoute>
              {withSuspense(<Midjourney />)}
            </PrivateRoute>
          }
        />
        <Route
          path='/console/task'
          element={
            <PrivateRoute>
              {withSuspense(<Task />)}
            </PrivateRoute>
          }
        />
        <Route
          path='/pricing'
          element={
            pricingRequireAuth ? (
              <PrivateRoute>{withSuspense(<Pricing />)}</PrivateRoute>
            ) : (
              withSuspense(<Pricing />)
            )
          }
        />
        <Route path='/docs' element={withSuspense(<Docs />)} />
        <Route
          path='/user-agreement'
          element={withSuspense(<UserAgreement />)}
        />
        <Route
          path='/privacy-policy'
          element={withSuspense(<PrivacyPolicy />)}
        />
        <Route path='*' element={withSuspense(<NotFound />)} />
      </Routes>
    </SetupCheck>
  );
}

export default App;
