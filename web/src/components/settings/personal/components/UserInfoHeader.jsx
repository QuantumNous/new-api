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
import { Avatar, Button, Card, Tag } from '@douyinfe/semi-ui';
import { IconCopy } from '@douyinfe/semi-icons';
import {
  copy,
  isAdmin,
  isRoot,
  renderQuota,
  showSuccess,
  stringToColor,
  timestamp2string,
} from '../../../../helpers';
import { Wallet, BarChart3, UserRound } from 'lucide-react';

const UserInfoHeader = ({ t, userState, onTopUp }) => {
  const user = userState?.user || {};

  const getUsername = () => user?.username || 'null';

  const getAvatarText = () => {
    const username = getUsername();
    if (username && username.length > 0) {
      return username.slice(0, 1).toUpperCase();
    }
    return 'NA';
  };

  const getRoleLabel = () => {
    if (isRoot()) {
      return t('超级管理员');
    }
    if (isAdmin()) {
      return t('管理员');
    }
    return t('普通用户');
  };

  const handleCopy = async (value) => {
    if (!value) {
      return;
    }
    const copied = await copy(String(value));
    if (copied) {
      showSuccess(t('已复制到剪贴板'));
    }
  };

  const requestCount = Number(user?.request_count || 0);
  const requestBarWidth =
    requestCount > 0
      ? `${Math.min(100, Math.max(12, Math.log10(requestCount + 1) * 22))}%`
      : '10%';

  const profileRows = [
    { label: t('用户名'), value: getUsername() },
    { label: t('用户 ID'), value: user?.id, copyable: true },
    { label: t('邮箱'), value: user?.email || t('未绑定') },
    { label: t('用户分组'), value: user?.group || t('默认') },
    // {
    //   label: t('注册时间'),
    //   value: user?.created_at
    //     ? timestamp2string(user.created_at)
    //     : t('暂无数据'),
    // },
  ];

  return (
    <Card className='personal-settings-surface personal-settings-overview'>
      <div className='personal-settings-card-head'>
        <div className='personal-settings-card-title-row'>
          <span className='personal-settings-card-icon'>
            <UserRound size={16} strokeWidth={2.1} />
          </span>
          <div>
            <h2 className='personal-settings-card-title'>{t('账户概览')}</h2>
            <p className='personal-settings-card-subtitle'>
              {t('集中查看账号资料、额度和使用状态')}
            </p>
          </div>
        </div>
        <Tag shape='circle' size='large' className='personal-settings-role-tag'>
          {getRoleLabel()}
        </Tag>
      </div>

      <div className='personal-settings-overview-grid'>
        <div className='personal-settings-profile-panel'>
          <div className='personal-settings-profile-top'>
            <Avatar
              size='large'
              color={stringToColor(getUsername())}
              className='personal-settings-profile-avatar'
            >
              {getAvatarText()}
            </Avatar>
            <div className='personal-settings-profile-copy'>
              <div className='personal-settings-profile-name'>
                {getUsername()}
              </div>
              <div className='personal-settings-profile-meta'>
                <span>{user?.email || t('未绑定邮箱')}</span>
                <span className='personal-settings-profile-dot' />
                <span>{user?.group || t('默认分组')}</span>
              </div>
            </div>
          </div>

          <div className='personal-settings-detail-list'>
            {profileRows.map((item) => (
              <div key={item.label} className='personal-settings-detail-row'>
                <span className='personal-settings-detail-label'>
                  {item.label}
                </span>
                <div className='personal-settings-detail-value-wrap'>
                  <span className='personal-settings-detail-value'>
                    {item.value}
                  </span>
                  {item.copyable && item.value ? (
                    <button
                      type='button'
                      className='personal-settings-copy-button'
                      onClick={() => handleCopy(item.value)}
                    >
                      <IconCopy />
                    </button>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className='personal-settings-quota-panel'>
          <div className='personal-settings-quota-label'>{t('额度信息')}</div>
          <div className='personal-settings-metric-grid'>
            <div className='personal-settings-metric-card personal-settings-metric-balance'>
              <div className='personal-settings-metric-top'>
                <span>{t('余额')}</span>
                <Wallet size={16} strokeWidth={2} />
              </div>
              <div className='personal-settings-metric-value'>
                {renderQuota(user?.quota || 0)}
              </div>
            </div>

            <div className='personal-settings-metric-card personal-settings-metric-used'>
              <div className='personal-settings-metric-top'>
                <span>{t('已用')}</span>
                <BarChart3 size={16} strokeWidth={2} />
              </div>
              <div className='personal-settings-metric-value'>
                {renderQuota(user?.used_quota || 0)}
              </div>
            </div>
          </div>

          <div className='personal-settings-requests-card'>
            <div className='personal-settings-requests-top'>
              <span>{t('请求次数')}</span>
              <strong>{requestCount}</strong>
            </div>
            <div className='personal-settings-requests-track'>
              <span
                className='personal-settings-requests-fill'
                style={{ width: requestBarWidth }}
              />
            </div>
          </div>

          <Button
            type='primary'
            theme='solid'
            onClick={onTopUp}
            className='personal-settings-primary-button personal-settings-cta-button'
          >
            {t('前往充值')}
          </Button>
        </div>
      </div>
    </Card>
  );
};

export default UserInfoHeader;
