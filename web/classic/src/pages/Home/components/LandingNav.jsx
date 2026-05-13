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
import { Button, Typography } from '@douyinfe/semi-ui';
import { IconExternalOpen } from '@douyinfe/semi-icons';
import { Link } from 'react-router-dom';
import { navItems } from '../landingData';

const { Text } = Typography;

const LandingNav = ({ logo, systemName, docsLink, user, isSelfUseMode }) => {
  const primaryPath = user
    ? '/console'
    : isSelfUseMode
      ? '/login'
      : '/register';
  const primaryText = user
    ? '进入控制台'
    : isSelfUseMode
      ? '登录使用'
      : '开始接入';

  return (
    <div className='sticky top-0 z-20 border-b border-semi-color-border bg-semi-color-bg-0 shadow-sm'>
      <div className='mx-auto flex w-full max-w-7xl flex-col gap-3 px-4 py-3 sm:px-6 lg:px-8 xl:flex-row xl:items-center xl:justify-between'>
        <div className='flex min-w-0 items-center gap-3'>
          {logo && (
            <img
              src={logo}
              alt={systemName}
              className='h-9 w-9 flex-shrink-0 rounded-xl object-contain'
            />
          )}
          <div className='min-w-0'>
            <Text className='block truncate !text-base !font-semibold !text-semi-color-text-0'>
              {systemName}
            </Text>
            <Text className='block truncate !text-xs !text-semi-color-text-2'>
              API 中转与模型管理入口
            </Text>
          </div>
        </div>

        <nav className='flex min-w-0 flex-1 items-center gap-1 overflow-x-auto whitespace-nowrap xl:justify-center'>
          {navItems.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className='rounded-full px-3 py-2 text-sm font-medium text-semi-color-text-1 transition-colors hover:bg-semi-color-fill-0 hover:text-semi-color-primary'
            >
              {item.label}
            </a>
          ))}
        </nav>

        <div className='flex flex-shrink-0 items-center gap-2'>
          {docsLink && (
            <Button
              theme='borderless'
              icon={<IconExternalOpen />}
              onClick={() => window.open(docsLink, '_blank')}
            >
              文档
            </Button>
          )}
          {!user && (
            <Link to='/login'>
              <Button>登录</Button>
            </Link>
          )}
          <Link to={primaryPath}>
            <Button theme='solid' type='primary'>
              {primaryText}
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
};

export default LandingNav;
