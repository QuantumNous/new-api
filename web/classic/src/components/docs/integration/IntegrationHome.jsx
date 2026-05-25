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
import { Card, Typography } from '@douyinfe/semi-ui';
import { ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import DocCallout from './DocCallout';
import { DocInlineCode } from './DocCodeBlock';
import {
  FACEAPI_BASE_URL,
  FACEAPI_BRAND,
  FACEAPI_WEBSITE,
  INTEGRATION_NAV_ITEMS,
} from './constants';

const IntegrationHome = () => {
  const { t } = useTranslation();

  return (
    <article>
      <header style={{ marginBottom: '32px' }}>
        <Typography.Title heading={2} style={{ marginBottom: '12px' }}>
          {t('FaceCloud Integration Guides')}
        </Typography.Title>
        <Typography.Paragraph type='secondary' style={{ fontSize: '16px', lineHeight: 1.7 }}>
          {t(
            'Learn how to connect FaceCloud to popular AI coding tools and IDEs. FaceCloud acts as a unified API gateway so you can use one API key across multiple providers.',
          )}
        </Typography.Paragraph>
      </header>

      <DocCallout title={t('Before you start')} style={{ marginBottom: '32px' }}>
        {t('You need a FaceCloud API key. Create one in the dashboard, then replace')}{' '}
        <DocInlineCode>sk-xxxx</DocInlineCode>{' '}
        {t('in the examples below with your real key. API base URL:')}{' '}
        <DocInlineCode>{FACEAPI_BASE_URL}</DocInlineCode>
      </DocCallout>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
          gap: '16px',
          marginBottom: '32px',
        }}
      >
        {INTEGRATION_NAV_ITEMS.map((item) => {
          const Icon = item.icon;

          return (
            <Link key={item.id} to={item.path} style={{ textDecoration: 'none' }}>
              <Card
                shadows='hover'
                style={{ height: '100%' }}
                bodyStyle={{ padding: '20px' }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                  <div
                    style={{
                      width: '40px',
                      height: '40px',
                      borderRadius: '8px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: 'var(--semi-color-primary-light-default)',
                      color: 'var(--semi-color-primary)',
                    }}
                  >
                    <Icon size={20} aria-hidden='true' />
                  </div>
                  <Typography.Text strong>{t(item.titleKey)}</Typography.Text>
                </div>
                <Typography.Paragraph type='secondary' style={{ marginBottom: '16px', lineHeight: 1.6 }}>
                  {t(item.descriptionKey)}
                </Typography.Paragraph>
                <Typography.Text link style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                  {t('View guide')}
                  <ArrowRight size={14} />
                </Typography.Text>
              </Card>
            </Link>
          );
        })}
      </div>

      <Typography.Text type='secondary' size='small'>
        {t('Powered by')}{' '}
        <a href={FACEAPI_WEBSITE} target='_blank' rel='noopener noreferrer'>
          {FACEAPI_BRAND}
        </a>
        . {t('For model availability and pricing, visit the pricing page or dashboard.')}
      </Typography.Text>
    </article>
  );
};

export default IntegrationHome;
