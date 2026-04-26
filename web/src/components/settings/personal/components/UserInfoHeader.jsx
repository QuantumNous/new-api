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
import { Card, Badge } from '@heroui/react';
import {
  isRoot,
  isAdmin,
  renderQuota,
  stringToColor,
} from '../../../../helpers';
import { Coins, BarChart2, Users } from 'lucide-react';

const UserInfoHeader = ({ t, userState }) => {
  const avatarColorClasses = {
    amber: 'bg-amber-500',
    blue: 'bg-blue-500',
    cyan: 'bg-cyan-500',
    green: 'bg-green-500',
    grey: 'bg-muted',
    indigo: 'bg-indigo-500',
    'light-blue': 'bg-sky-500',
    lime: 'bg-lime-500',
    orange: 'bg-orange-500',
    pink: 'bg-pink-500',
    purple: 'bg-purple-500',
    red: 'bg-red-500',
    teal: 'bg-teal-500',
    violet: 'bg-violet-500',
    yellow: 'bg-yellow-500',
  };

  const getUsername = () => {
    if (userState.user) {
      return userState.user.username;
    } else {
      return 'null';
    }
  };

  const getAvatarText = () => {
    const username = getUsername();
    if (username && username.length > 0) {
      return username.slice(0, 2).toUpperCase();
    }
    return 'NA';
  };

  const roleLabel = isRoot()
    ? t('超级管理员')
    : isAdmin()
      ? t('管理员')
      : t('普通用户');
  const avatarColorClass =
    avatarColorClasses[stringToColor(getUsername())] || 'bg-muted';

  const StatLabel = ({ children }) => (
    <span className='text-sm text-muted'>{children}</span>
  );

  const StatValue = ({ children }) => (
    <span className='text-sm font-semibold text-muted'>{children}</span>
  );

  const Divider = ({ className = '' }) => (
    <div className={`bg-border ${className}`} />
  );

  return (
    <Card className='overflow-hidden rounded-2xl'>
      <div
        className='relative h-32'
        style={{
          '--palette-primary-darkerChannel': '0 75 80',
          backgroundImage: `linear-gradient(0deg, rgba(var(--palette-primary-darkerChannel) / 80%), rgba(var(--palette-primary-darkerChannel) / 80%)), url('/cover-4.webp')`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat',
        }}
      >
        {/* User info content */}
        <div className='relative z-10 flex h-full flex-col justify-end p-6'>
          <div className='flex items-center'>
            <div className='flex min-w-0 flex-1 items-stretch gap-3 sm:gap-4'>
              <div
                className={`flex h-16 w-16 shrink-0 items-center justify-center rounded-full text-lg font-semibold text-white shadow-lg ${avatarColorClass}`}
              >
                {getAvatarText()}
              </div>
              <div className='flex min-w-0 flex-1 flex-col justify-between'>
                <div className='truncate text-3xl font-bold text-white'>
                  {getUsername()}
                </div>
                <div className='flex flex-wrap items-center gap-2'>
                  <span className='rounded-full bg-white/20 px-3 py-1 text-sm font-medium text-white backdrop-blur'>
                    {roleLabel}
                  </span>
                  <span className='rounded-full bg-white/20 px-3 py-1 text-sm font-medium text-white backdrop-blur'>
                    ID: {userState?.user?.id}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <Card.Content className='p-6'>
      {/* Current balance and desktop stats */}
      <div className='flex items-start justify-between gap-6'>
        {/* Current balance */}
        <Badge count={t('当前余额')} position='rightTop' type='danger'>
          <div className='text-2xl sm:text-3xl md:text-4xl font-bold tracking-wide'>
            {renderQuota(userState?.user?.quota)}
          </div>
        </Badge>

        {/* Desktop stats */}
        <div className='hidden lg:block flex-shrink-0'>
          <div className='rounded-xl border border-border bg-background px-4 py-3'>
            <div className='flex items-center gap-4'>
              <div className='flex items-center gap-2'>
                <Coins size={16} />
                <StatLabel>{t('历史消耗')}</StatLabel>
                <StatValue>{renderQuota(userState?.user?.used_quota)}</StatValue>
              </div>
              <Divider className='h-6 w-px' />
              <div className='flex items-center gap-2'>
                <BarChart2 size={16} />
                <StatLabel>{t('请求次数')}</StatLabel>
                <StatValue>{userState.user?.request_count || 0}</StatValue>
              </div>
              <Divider className='h-6 w-px' />
              <div className='flex items-center gap-2'>
                <Users size={16} />
                <StatLabel>{t('用户分组')}</StatLabel>
                <StatValue>{userState?.user?.group || t('默认')}</StatValue>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile and tablet stats */}
      <div className='lg:hidden mt-2'>
        <div className='rounded-xl border border-border bg-background px-4 py-3'>
          <div className='space-y-3'>
            <div className='flex items-center justify-between'>
              <div className='flex items-center gap-2'>
                <Coins size={16} />
                <StatLabel>{t('历史消耗')}</StatLabel>
              </div>
              <StatValue>{renderQuota(userState?.user?.used_quota)}</StatValue>
            </div>
            <Divider className='h-px w-full' />
            <div className='flex items-center justify-between'>
              <div className='flex items-center gap-2'>
                <BarChart2 size={16} />
                <StatLabel>{t('请求次数')}</StatLabel>
              </div>
              <StatValue>{userState.user?.request_count || 0}</StatValue>
            </div>
            <Divider className='h-px w-full' />
            <div className='flex items-center justify-between'>
              <div className='flex items-center gap-2'>
                <Users size={16} />
                <StatLabel>{t('用户分组')}</StatLabel>
              </div>
              <StatValue>{userState?.user?.group || t('默认')}</StatValue>
            </div>
          </div>
        </div>
      </div>
      </Card.Content>
    </Card>
  );
};

export default UserInfoHeader;
