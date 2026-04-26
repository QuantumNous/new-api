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
import { Card, Chip } from '@heroui/react';
import {
  isRoot,
  isAdmin,
  renderQuota,
  stringToColor,
} from '../../../../helpers';
import { Coins, BarChart2, Users, Wallet } from 'lucide-react';

const UserInfoHeader = ({ t, userState }) => {
  // Map our color seed to a tailwind class for the avatar background.
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

  const username = userState?.user?.username || 'null';

  const getAvatarText = () => {
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
    avatarColorClasses[stringToColor(username)] || 'bg-muted';

  const StatItem = ({ icon, label, value }) => (
    <div className='flex items-center gap-2 min-w-0'>
      <span className='text-muted shrink-0'>{icon}</span>
      <span className='text-sm text-muted shrink-0'>{label}</span>
      <span className='text-sm font-semibold text-foreground truncate'>
        {value}
      </span>
    </div>
  );

  return (
    <Card className='overflow-hidden rounded-2xl' shadow='none'>
      {/* Cover header with avatar, username, role and id */}
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
        <div className='relative z-10 flex h-full items-end p-4 sm:p-6'>
          <div className='flex min-w-0 flex-1 items-center gap-3 sm:gap-4'>
            <div
              className={`flex h-16 w-16 shrink-0 items-center justify-center rounded-full text-lg font-semibold text-white shadow-lg ${avatarColorClass}`}
            >
              {getAvatarText()}
            </div>
            <div className='flex min-w-0 flex-1 flex-col gap-1.5'>
              <div className='truncate text-2xl sm:text-3xl font-bold text-white'>
                {username}
              </div>
              <div className='flex flex-wrap items-center gap-1.5'>
                <Chip
                  size='sm'
                  variant='flat'
                  className='!bg-white/20 !text-white backdrop-blur-sm'
                >
                  {roleLabel}
                </Chip>
                <Chip
                  size='sm'
                  variant='flat'
                  className='!bg-white/20 !text-white backdrop-blur-sm'
                >
                  ID: {userState?.user?.id}
                </Chip>
              </div>
            </div>
          </div>
        </div>
      </div>

      <Card.Content className='p-4 sm:p-6'>
        {/* Balance + stats row (stacks on small screens) */}
        <div className='flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between'>
          {/* Current balance */}
          <div className='flex min-w-0 items-center gap-3'>
            <span className='flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary'>
              <Wallet size={18} />
            </span>
            <div className='flex min-w-0 flex-col'>
              <span className='text-xs text-muted'>{t('当前余额')}</span>
              <span className='truncate text-2xl sm:text-3xl font-bold tracking-tight text-foreground'>
                {renderQuota(userState?.user?.quota)}
              </span>
            </div>
          </div>

          {/* Desktop stats inline */}
          <div className='hidden lg:flex items-center gap-4 rounded-xl border border-border bg-surface-secondary/40 px-4 py-2.5'>
            <StatItem
              icon={<Coins size={16} />}
              label={t('历史消耗')}
              value={renderQuota(userState?.user?.used_quota)}
            />
            <span className='h-5 w-px bg-border' aria-hidden />
            <StatItem
              icon={<BarChart2 size={16} />}
              label={t('请求次数')}
              value={userState?.user?.request_count || 0}
            />
            <span className='h-5 w-px bg-border' aria-hidden />
            <StatItem
              icon={<Users size={16} />}
              label={t('用户分组')}
              value={userState?.user?.group || t('默认')}
            />
          </div>
        </div>

        {/* Mobile / tablet stats stacked */}
        <div className='lg:hidden mt-4 rounded-xl border border-border bg-surface-secondary/40 px-4 py-3'>
          <div className='space-y-3'>
            <div className='flex items-center justify-between gap-3'>
              <div className='flex items-center gap-2 text-sm text-muted'>
                <Coins size={16} />
                <span>{t('历史消耗')}</span>
              </div>
              <span className='text-sm font-semibold text-foreground'>
                {renderQuota(userState?.user?.used_quota)}
              </span>
            </div>
            <div className='h-px w-full bg-border' />
            <div className='flex items-center justify-between gap-3'>
              <div className='flex items-center gap-2 text-sm text-muted'>
                <BarChart2 size={16} />
                <span>{t('请求次数')}</span>
              </div>
              <span className='text-sm font-semibold text-foreground'>
                {userState?.user?.request_count || 0}
              </span>
            </div>
            <div className='h-px w-full bg-border' />
            <div className='flex items-center justify-between gap-3'>
              <div className='flex items-center gap-2 text-sm text-muted'>
                <Users size={16} />
                <span>{t('用户分组')}</span>
              </div>
              <span className='text-sm font-semibold text-foreground'>
                {userState?.user?.group || t('默认')}
              </span>
            </div>
          </div>
        </div>
      </Card.Content>
    </Card>
  );
};

export default UserInfoHeader;
