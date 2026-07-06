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

import React, { useState } from 'react';
import {
  Avatar,
  Card,
  Tag,
  Typography,
  Button,
  Toast,
} from '@douyinfe/semi-ui';
import { isRoot, isAdmin, stringToColor } from '../../../../helpers';
import { API } from '../../../../helpers';
import {
  ArrowUpRight,
  Crown,
  KeyRound,
  Mail,
  ShieldCheck,
  UserRound,
  Users,
} from 'lucide-react';

const UserInfoHeader = ({ t, userState, passkeyStatus, onRefresh }) => {
  const [upgrading, setUpgrading] = useState(false);
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

  const handleUpgradeVIP = async () => {
    setUpgrading(true);
    try {
      const res = await API.post('/api/user/upgrade-vip');
      const { success, message } = res.data;
      if (success) {
        Toast.success(message);
        if (onRefresh) onRefresh();
      } else {
        Toast.warning({ content: message, duration: 5 });
      }
    } catch (e) {
      Toast.error(t('操作失败，请重试'));
    }
    setUpgrading(false);
  };

  const isVIP =
    userState?.user?.group === 'vip' || userState?.user?.group === 'svip';
  const canUpgradeVIP = userState?.user?.group === 'default';
  const roleLabel = isRoot()
    ? t('超级管理员')
    : isAdmin()
      ? t('管理员')
      : t('普通用户');
  const emailBound = Boolean(userState.user?.email);
  const passkeyEnabled = Boolean(passkeyStatus?.enabled);

  const renderMetricRow = (Icon, label, value, options = {}) => (
    <div
      className='console-finance-hero-metric-row'
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 18,
        padding: '22px 24px',
        borderBottom: options.last
          ? 0
          : '1px solid var(--console-border-strong)',
      }}
    >
      <div>
        <div
          className='console-finance-hero-metric-label'
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 9,
            marginBottom: 8,
            color: 'var(--console-text)',
            fontSize: 14,
            fontWeight: 800,
          }}
        >
          <Icon size={16} />
          {label}
        </div>
        <div
          className='console-finance-hero-metric-value'
          style={{
            color: options.accent
              ? 'var(--semi-color-success)'
              : 'var(--console-text-strong)',
            fontSize: 31,
            lineHeight: 1,
            fontWeight: 900,
            letterSpacing: '-0.055em',
          }}
        >
          {value}
        </div>
      </div>
      <ArrowUpRight size={18} style={{ color: '#cbd5e1' }} />
    </div>
  );

  return (
    <Card
      className='console-finance-hero-card'
      bodyStyle={{ padding: 0 }}
      style={{
        marginBottom: 26,
        borderRadius: 30,
        overflow: 'hidden',
        border: '1px solid var(--console-border)',
        background: 'var(--console-card-bg)',
        boxShadow: 'var(--console-shadow)',
      }}
    >
      <div
        className='console-finance-hero-grid'
        style={{
          display: 'grid',
          gridTemplateColumns:
            'repeat(auto-fit, minmax(min(100%, 360px), 1fr))',
          minHeight: 276,
        }}
      >
        <div
          className='console-finance-hero-main'
          style={{
            padding: '34px 36px 32px',
            borderRight: '1px solid var(--console-border)',
            background: 'var(--console-card-gradient)',
          }}
        >
          <div
            className='console-finance-hero-head'
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 18,
              marginBottom: 30,
            }}
          >
            <div>
              <div
                className='console-finance-hero-eyebrow'
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  marginBottom: 14,
                  color: 'var(--console-text-strong)',
                  fontSize: 15,
                  fontWeight: 800,
                  letterSpacing: '-0.02em',
                }}
              >
                <UserRound size={18} />
                {t('账号身份总览')}
              </div>
              <div
                className='console-finance-hero-title'
                style={{
                  color: 'var(--console-text-strong)',
                  fontSize: 44,
                  lineHeight: 1.05,
                  letterSpacing: '-0.07em',
                  fontWeight: 900,
                  wordBreak: 'break-word',
                }}
              >
                {getUsername()}
              </div>
            </div>
            <div className='console-finance-hero-icon console-finance-hero-avatar'>
              <Avatar
                size='small'
                color={stringToColor(getUsername())}
                style={{ flexShrink: 0 }}
              >
                {getAvatarText()}
              </Avatar>
            </div>
          </div>

          <Typography.Text
            className='console-finance-hero-desc'
            style={{
              display: 'block',
              maxWidth: 540,
              color: 'var(--console-text)',
              fontSize: 16,
              lineHeight: 1.7,
              letterSpacing: '-0.02em',
            }}
          >
            {t('管理账号绑定、安全验证、通知偏好与控制台个性化设置。')}
          </Typography.Text>

          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: 8,
              marginTop: 32,
            }}
          >
            <Tag color='teal' shape='circle' size='large'>
              {roleLabel}
            </Tag>
            <Tag color='grey' shape='circle' size='large'>
              ID: {userState?.user?.id}
            </Tag>
            {canUpgradeVIP && (
              <Button
                theme='solid'
                type='warning'
                size='small'
                icon={<Crown size={14} />}
                loading={upgrading}
                onClick={handleUpgradeVIP}
                className='console-primary-action !rounded-full !font-bold'
              >
                {t('升级VIP')}
              </Button>
            )}
          </div>
        </div>

        <div
          className='console-finance-hero-metrics'
          style={{
            display: 'grid',
            background: 'var(--console-card-muted-bg)',
            padding: 12,
          }}
        >
          <div
            style={{
              display: 'grid',
              gridTemplateRows: '1fr 1fr 1fr',
              background: 'var(--console-card-bg)',
            }}
          >
            {renderMetricRow(ShieldCheck, t('账号角色'), roleLabel, {
              accent: isAdmin() || isRoot(),
            })}
            {renderMetricRow(
              Users,
              t('用户分组'),
              userState?.user?.group || t('默认'),
            )}
            {renderMetricRow(
              emailBound ? Mail : KeyRound,
              t('安全绑定'),
              emailBound
                ? t('邮箱已绑定')
                : passkeyEnabled
                  ? t('Passkey 已启用')
                  : t('待完善'),
              { last: true, accent: emailBound || passkeyEnabled },
            )}
          </div>
        </div>
      </div>
    </Card>
  );
};

export default UserInfoHeader;
