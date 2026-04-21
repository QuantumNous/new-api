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
import { Link } from 'react-router-dom';
import SkeletonWrapper from '../components/SkeletonWrapper';
import {
  getHeaderLogoFrameClassName,
  getHeaderLogoImageClassName,
} from './headerLogoStyles';
import { shouldShowHeaderLogoFallback } from './headerLogoState';

const headerText = {
  selfUse: '\u81ea\u7528\u6a21\u5f0f',
  demoSite: '\u6f14\u793a\u7ad9\u70b9',
};

const HeaderLogo = ({
  isMobile,
  isConsoleRoute,
  logo,
  logoLoaded,
  isLoading,
  systemName,
  isSelfUseMode,
  isDemoSiteMode,
  t,
}) => {
  if (isMobile && isConsoleRoute) {
    return null;
  }

  const showBadge = (isSelfUseMode || isDemoSiteMode) && !isLoading;
  const fallbackLabel = systemName?.trim()?.[0]?.toUpperCase() || 'N';
  const hasLogoImage = Boolean(logo && logoLoaded && !isLoading);
  const isDefaultLogo = logo === '/logo.png';
  const showFallbackLabel = shouldShowHeaderLogoFallback({
    hasLogoImage,
    isLoading,
  });

  return (
    <Link
      to='/'
      data-header-brand='true'
      className='text-xl flex shrink-0 items-center gap-3 font-bold tracking-tight text-gray-900'
    >
      <div className={getHeaderLogoFrameClassName({ hasLogoImage })}>
        <SkeletonWrapper loading={isLoading || !logoLoaded} type='image'>
          {showFallbackLabel ? <span>{fallbackLabel}</span> : null}
        </SkeletonWrapper>
        {hasLogoImage ? (
          <img
            src={logo}
            alt='logo'
            className={getHeaderLogoImageClassName({ isDefaultLogo })}
          />
        ) : null}
      </div>
      <div className='flex min-w-0 items-center gap-2'>
        <span className='truncate'>{systemName}</span>
        {showBadge ? (
          <span className='hidden rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] font-bold text-indigo-600 xl:inline-flex'>
            {isSelfUseMode ? t(headerText.selfUse) : t(headerText.demoSite)}
          </span>
        ) : null}
      </div>
    </Link>
  );
};

export default HeaderLogo;
