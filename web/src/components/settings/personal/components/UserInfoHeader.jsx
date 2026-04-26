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
import { Avatar, Card, Tag, Typography } from '@douyinfe/semi-ui';
import {
  isRoot,
  isAdmin,
  renderQuota,
  stringToColor,
} from '../../../../helpers';
import { Coins, BarChart2, Users } from 'lucide-react';

const UserInfoHeader = ({ t, userState }) => {
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

  const profileStats = [
    {
      icon: Coins,
      label: t('当前余额'),
      value: renderQuota(userState?.user?.quota),
    },
    {
      icon: Coins,
      label: t('历史消耗'),
      value: renderQuota(userState?.user?.used_quota),
    },
    {
      icon: BarChart2,
      label: t('请求次数'),
      value: userState.user?.request_count || 0,
    },
    {
      icon: Users,
      label: t('用户分组'),
      value: userState?.user?.group || t('默认'),
    },
  ];

  return (
    <Card
      className='na-personal-profile-card overflow-hidden'
      cover={
        <div className='na-personal-profile-cover'>
          {/* 用户信息内容 */}
          <div className='na-personal-profile-cover-content'>
            <div className='flex items-center'>
              <div className='flex items-stretch gap-3 sm:gap-4 flex-1 min-w-0'>
                <Avatar size='large' color={stringToColor(getUsername())}>
                  {getAvatarText()}
                </Avatar>
                <div className='flex-1 min-w-0 flex flex-col justify-between'>
                  <div
                    className='text-3xl font-bold truncate'
                    style={{ color: 'var(--na-text-primary)' }}
                  >
                    {getUsername()}
                  </div>
                  <div className='flex flex-wrap items-center gap-2'>
                    {isRoot() ? (
                      <Tag
                        size='large'
                        shape='circle'
                        style={{ color: 'var(--na-text-inverse)' }}
                      >
                        {t('超级管理员')}
                      </Tag>
                    ) : isAdmin() ? (
                      <Tag
                        size='large'
                        shape='circle'
                        style={{ color: 'var(--na-text-inverse)' }}
                      >
                        {t('管理员')}
                      </Tag>
                    ) : (
                      <Tag
                        size='large'
                        shape='circle'
                        style={{ color: 'var(--na-text-inverse)' }}
                      >
                        {t('普通用户')}
                      </Tag>
                    )}
                    <Tag size='large' shape='circle'>
                      ID: {userState?.user?.id}
                    </Tag>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      }
    >
      <div className='na-personal-profile-stats'>
        {profileStats.map((item) => {
          const Icon = item.icon;
          return (
            <div className='na-personal-profile-stat' key={item.label}>
              <div className='na-personal-profile-stat-icon'>
                <Icon size={16} />
              </div>
              <div>
                <Typography.Text className='na-personal-profile-stat-label'>
                  {item.label}
                </Typography.Text>
                <div className='na-personal-profile-stat-value'>
                  {item.value}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
};

export default UserInfoHeader;
