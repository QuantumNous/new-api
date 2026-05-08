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
import { Typography } from '@douyinfe/semi-ui';
import { getLogo, getSystemName } from '../../helpers';
import { useTranslation } from 'react-i18next';
import './AuthPage.css';

const { Text } = Typography;

const AuthLayout = ({
  children,
  turnstile,
  variant = 'default',
  subtitle,
}) => {
  const { t } = useTranslation();
  const logo = getLogo();
  const systemName = getSystemName();
  const resolvedSubtitle = subtitle || t('智能 API 网关控制台');

  return (
    <div className={`auth-page auth-page-${variant}`}>
      <div className='auth-page-orb auth-page-orb-primary' />
      <div className='auth-page-orb auth-page-orb-secondary' />
      <div className='auth-page-grid'>
        <header className='auth-brand-header'>
          <div className='auth-brand-row'>
            <div className='auth-brand-mark'>
              <img src={logo} alt='Logo' className='auth-brand-logo' />
            </div>
            <Text className='auth-brand-name'>{systemName}</Text>
          </div>
          <Text className='auth-brand-subtitle'>{resolvedSubtitle}</Text>
        </header>
        <section className='auth-page-panel'>
          {children}
          {turnstile && <div className='auth-page-turnstile'>{turnstile}</div>}
        </section>
      </div>
    </div>
  );
};

export default AuthLayout;
