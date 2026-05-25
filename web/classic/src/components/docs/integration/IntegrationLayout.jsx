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
import { Button, SideSheet, Typography } from '@douyinfe/semi-ui';
import { IconMenu } from '@douyinfe/semi-icons';
import { Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useIsMobile } from '../../../hooks/common/useIsMobile';
import {
  FACEAPI_BRAND,
  FACEAPI_WEBSITE,
  INTEGRATION_HOME_PATH,
  INTEGRATION_NAV_ITEMS,
} from './constants';

const navLinkStyle = (active) => ({
  display: 'flex',
  alignItems: 'flex-start',
  gap: '8px',
  padding: '8px 12px',
  borderRadius: '6px',
  textDecoration: 'none',
  fontSize: '14px',
  fontWeight: active ? 600 : 400,
  color: active ? 'var(--semi-color-primary)' : 'var(--semi-color-text-1)',
  backgroundColor: active ? 'var(--semi-color-primary-light-default)' : 'transparent',
  marginBottom: '4px',
});

const IntegrationSidebar = ({ onNavigate }) => {
  const { t } = useTranslation();
  const { pathname } = useLocation();

  return (
    <nav aria-label={t('Integration guides')}>
      <Link
        to={INTEGRATION_HOME_PATH}
        onClick={onNavigate}
        style={navLinkStyle(pathname === INTEGRATION_HOME_PATH)}
      >
        {t('Overview')}
      </Link>
      {INTEGRATION_NAV_ITEMS.map((item) => {
        const Icon = item.icon;
        const isActive = pathname === item.path;

        return (
          <Link
            key={item.id}
            to={item.path}
            onClick={onNavigate}
            style={navLinkStyle(isActive)}
          >
            <Icon size={16} style={{ marginTop: '2px', flexShrink: 0 }} aria-hidden='true' />
            <span>{t(item.titleKey)}</span>
          </Link>
        );
      })}
    </nav>
  );
};

const IntegrationLayout = ({ children }) => {
  const { t } = useTranslation();
  const isMobile = useIsMobile();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div
      style={{
        maxWidth: '1152px',
        margin: '0 auto',
        padding: isMobile ? '80px 16px 48px' : '96px 24px 64px',
      }}
    >
      {isMobile ? (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '24px',
            paddingBottom: '12px',
            borderBottom: '1px solid var(--semi-color-border)',
          }}
        >
          <div>
            <Typography.Text strong>{FACEAPI_BRAND}</Typography.Text>
            <Typography.Text type='secondary' size='small' style={{ display: 'block' }}>
              {t('Integration')}
            </Typography.Text>
          </div>
          <Button
            icon={<IconMenu />}
            theme='light'
            aria-label={t('Open menu')}
            onClick={() => setMobileOpen(true)}
          />
          <SideSheet
            title={t('Integration guides')}
            visible={mobileOpen}
            onCancel={() => setMobileOpen(false)}
            width={280}
            placement='left'
          >
            <IntegrationSidebar onNavigate={() => setMobileOpen(false)} />
          </SideSheet>
        </div>
      ) : null}

      <div
        style={{
          display: 'flex',
          gap: '40px',
          alignItems: 'flex-start',
        }}
      >
        {!isMobile ? (
          <aside style={{ width: '224px', flexShrink: 0, position: 'sticky', top: '88px' }}>
            <Typography.Text
              type='tertiary'
              size='small'
              strong
              style={{ display: 'block', marginBottom: '8px', letterSpacing: '0.05em' }}
            >
              {FACEAPI_BRAND}
            </Typography.Text>
            <Typography.Title heading={5} style={{ marginBottom: '4px' }}>
              {t('Integration')}
            </Typography.Title>
            <a
              href={FACEAPI_WEBSITE}
              target='_blank'
              rel='noopener noreferrer'
              style={{ color: 'var(--semi-color-primary)', fontSize: '13px' }}
            >
              {FACEAPI_WEBSITE}
            </a>
            <div style={{ marginTop: '24px' }}>
              <IntegrationSidebar />
            </div>
          </aside>
        ) : null}

        <main style={{ flex: 1, minWidth: 0 }}>{children}</main>
      </div>
    </div>
  );
};

export default IntegrationLayout;
