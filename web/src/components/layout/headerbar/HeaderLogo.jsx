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
import { Typography, Tag } from '@douyinfe/semi-ui';
import SkeletonWrapper from '../components/SkeletonWrapper';

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

  return (
    <Link to='/' className='group flex items-center gap-3 min-w-0 text-inherit no-underline'>
      <div className='relative h-8 w-8 shrink-0 overflow-hidden rounded-full transition-transform duration-200 group-hover:scale-[1.03]'>
        <SkeletonWrapper loading={isLoading || !logoLoaded} type='image' />
        <img
          src={logo}
          alt='logo'
          className={`absolute inset-0 w-full h-full transition-all duration-200 group-hover:scale-110 rounded-full ${!isLoading && logoLoaded ? 'opacity-100' : 'opacity-0'}`}
        />
      </div>
      <div className='hidden min-w-0 md:flex md:flex-col md:items-start md:gap-0.5'>
        <div className='flex items-center gap-2 min-w-0'>
          <SkeletonWrapper
            loading={isLoading}
            type='title'
            width={120}
            height={24}
          >
            <Typography.Title
              heading={4}
              className='!mb-0 !bg-gradient-to-r !from-[#4f46e5] !via-[#6366f1] !to-[#818cf8] !bg-clip-text !text-lg !font-black !tracking-[0.08em] !text-transparent drop-shadow-[0_8px_18px_rgba(99,102,241,0.22)] dark:!from-[#818cf8] dark:!via-[#6366f1] dark:!to-[#a78bfa]'
            >
              {systemName}
            </Typography.Title>
          </SkeletonWrapper>
          {(isSelfUseMode || isDemoSiteMode) && !isLoading && (
            <Tag
              color={isSelfUseMode ? 'purple' : 'blue'}
              className='text-xs px-1.5 py-0.5 rounded whitespace-nowrap shadow-sm'
              size='small'
              shape='circle'
            >
              {isSelfUseMode ? t('自用模式') : t('演示站点')}
            </Tag>
          )}
        </div>
        <span className='text-[11px] uppercase tracking-[0.18em] text-semi-color-text-2'>
          {t('AI模型一站式网关')}
        </span>
      </div>
    </Link>
  );
};

export default HeaderLogo;
