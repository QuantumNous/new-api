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

import React, { lazy, Suspense, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import Loading from './components/common/ui/Loading';
import SetupCheck from './components/layout/SetupCheck';
import { HomePage, isLightweightRoute } from './routeConfig';

const PageLayout = lazy(() => import('./components/layout/PageLayout'));

const RootRouter = () => {
  const location = useLocation();
  const isHomeRoute = isLightweightRoute(location.pathname);

  useEffect(() => {
    document.body.classList.toggle('home-route', isHomeRoute);
    return () => {
      document.body.classList.remove('home-route');
    };
  }, [isHomeRoute]);

  return (
    <Suspense fallback={<Loading />}>
      {isHomeRoute ? (
        <SetupCheck>
          <HomePage />
        </SetupCheck>
      ) : (
        <PageLayout />
      )}
    </Suspense>
  );
};

export default RootRouter;
