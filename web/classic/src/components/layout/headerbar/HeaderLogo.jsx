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
  showSubtitle = false,
  t,
}) => {
  if (isMobile && isConsoleRoute) {
    return null;
  }

  return (
    <Link to='/' className='group flex items-center gap-2'>
      <div className='relative w-8 h-8 md:w-8 md:h-8'>
        <SkeletonWrapper loading={isLoading || !logoLoaded} type='image' />
        <img
          src={logo}
          alt='logo'
          className={`absolute inset-0 w-full h-full transition-all duration-200 group-hover:scale-110 rounded-full ${!isLoading && logoLoaded ? 'opacity-100' : 'opacity-0'}`}
        />
      </div>
      <div className='hidden md:flex min-w-0 items-center gap-2'>
        <div
          className={
            showSubtitle
              ? 'flex min-w-0 flex-col justify-center gap-0.5'
              : 'flex min-w-0 items-center gap-2'
          }
        >
          <SkeletonWrapper
            loading={isLoading}
            type='title'
            width={120}
            height={24}
          >
            <Typography.Title
              heading={4}
              className='!text-lg !font-semibold !mb-0'
            >
              {systemName}
            </Typography.Title>
          </SkeletonWrapper>
          {showSubtitle && !isLoading && (
            <span className='hidden whitespace-nowrap text-xs leading-none text-semi-color-text-2 lg:inline'>
              API 中转与模型管理入口
            </span>
          )}
        </div>
        <div className='flex shrink-0 items-center gap-2'>
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
      </div>
    </Link>
  );
};

export default HeaderLogo;
