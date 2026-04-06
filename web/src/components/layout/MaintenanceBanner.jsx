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

import React, { useContext, useMemo } from 'react';
import { Banner, Typography } from '@douyinfe/semi-ui';
import { IconAlertTriangle, IconInfoCircle } from '@douyinfe/semi-icons';
import { StatusContext } from '../../context/Status';
import { UserContext } from '../../context/User';
import { useTranslation } from 'react-i18next';

/**
 * 维护模式 Banner
 * 1. 维护中 → 非管理员看到红色警告 Banner
 * 2. 预告期 → 所有用户看到蓝色提示 Banner
 * 3. 管理员在维护期间看到橙色提示 Banner（提示系统正在维护，但你仍可使用）
 */
export default function MaintenanceBanner () {
  const { t } = useTranslation();
  const [statusState] = useContext(StatusContext);
  const [userState] = useContext(UserContext);

  const maintenance = statusState?.status?.maintenance;

  // 判断用户是否为管理员（role >= 10）
  const isAdmin = useMemo(() => {
    const user = userState?.user;
    return user && user.role >= 10;
  }, [userState?.user]);

  if (!maintenance) return null;

  const { enabled, title, message, notice_enabled, start_at, end_at } = maintenance;

  // 检查维护时间窗口
  const now = Math.floor(Date.now() / 1000);
  const isInMaintenanceWindow =
    enabled &&
    (start_at === 0 || now >= start_at) &&
    (end_at === 0 || now <= end_at);

  // 预告期：enabled=true 但尚未到开始时间，或者 notice_enabled=true
  const isNotice =
    (enabled && start_at > 0 && now < start_at) ||
    (notice_enabled && !isInMaintenanceWindow);

  // 格式化时间显示
  const formatTime = (ts) => {
    if (!ts || ts === 0) return '';
    return new Date(ts * 1000).toLocaleString();
  };

  // 维护进行中
  if (isInMaintenanceWindow) {
    if (isAdmin) {
      // 管理员看到提示性 Banner
      return (
        <Banner
          type='warning'
          icon={<IconAlertTriangle />}
          closeIcon={null}
          description={
            <Typography.Text>
              <Typography.Text strong>{title || t('系统维护中')}</Typography.Text>
              {' — '}
              {t('当前处于维护模式，普通用户无法访问。')}
              {end_at > 0 && ` ${t('预计恢复时间')}: ${formatTime(end_at)}`}
            </Typography.Text>
          }
          style={{
            borderRadius: 0,
            position: 'sticky',
            top: 0,
            zIndex: 1000,
          }}
        />
      );
    }

    // 普通用户看到全屏维护页面
    return (
      <div
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 9999,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'var(--semi-color-bg-0, #fff)',
          padding: 40,
        }}
      >
        <IconAlertTriangle
          size='extra-large'
          style={{ fontSize: 64, color: 'var(--semi-color-warning)', marginBottom: 24 }}
        />
        <Typography.Title heading={2} style={{ marginBottom: 12 }}>
          {title || t('系统维护中')}
        </Typography.Title>
        <Typography.Text
          type='tertiary'
          style={{ maxWidth: 480, textAlign: 'center', fontSize: 16, lineHeight: 1.6 }}
        >
          {message || t('系统正在维护，请稍后再试')}
        </Typography.Text>
        {end_at > 0 && (
          <Typography.Text
            type='secondary'
            style={{ marginTop: 20, fontSize: 14 }}
          >
            {t('预计恢复时间')}: {formatTime(end_at)}
          </Typography.Text>
        )}
      </div>
    );
  }

  // 预告期
  if (isNotice) {
    return (
      <Banner
        type='info'
        icon={<IconInfoCircle />}
        description={
          <Typography.Text>
            <Typography.Text strong>{t('维护预告')}</Typography.Text>
            {' — '}
            {title || t('系统维护中')}
            {start_at > 0 && `. ${t('维护开始时间')}: ${formatTime(start_at)}`}
            {end_at > 0 && `, ${t('预计恢复时间')}: ${formatTime(end_at)}`}
          </Typography.Text>
        }
        style={{
          borderRadius: 0,
          position: 'sticky',
          top: 0,
          zIndex: 1000,
        }}
      />
    );
  }

  return null;
}
