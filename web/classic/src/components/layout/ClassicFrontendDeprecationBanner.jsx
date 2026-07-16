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

import React, { useContext, useState } from 'react';
import { Banner, Button, Modal } from '@douyinfe/semi-ui';
import { IconAlertTriangle, IconClose } from '@douyinfe/semi-icons';
import { useTranslation } from 'react-i18next';
import { UserContext } from '../../context/User';
import { confirmSwitchToDefaultFrontend } from '../../helpers';

const DISMISS_STORAGE_KEY = 'classic_frontend_deprecation_notice_dismissed_v1';

const ClassicFrontendDeprecationBanner = () => {
  const { t } = useTranslation();
  const [userState] = useContext(UserContext);
  const [switching, setSwitching] = useState(false);
  const [visible, setVisible] = useState(() => {
    try {
      return localStorage.getItem(DISMISS_STORAGE_KEY) !== '1';
    } catch (_) {
      return true;
    }
  });

  if (!visible) {
    return null;
  }

  const isRootUser = userState?.user?.role >= 100;

  const confirmClose = () => {
    Modal.confirm({
      title: t('确认关闭提示'),
      content: t(
        '关闭后将不再显示此提示（仅对当前浏览器生效）。确定要关闭吗？',
      ),
      okText: t('关闭提示'),
      cancelText: t('取消'),
      okButtonProps: {
        type: 'danger',
      },
      onOk: () => {
        try {
          localStorage.setItem(DISMISS_STORAGE_KEY, '1');
        } catch (_) {}
        setVisible(false);
      },
    });
  };

  const switchFrontend = () => {
    confirmSwitchToDefaultFrontend(t, {
      onLoadingChange: setSwitching,
    });
  };

  return (
    <div className='classic-frontend-deprecation-banner'>
      <div className='classic-frontend-deprecation-banner-inner'>
        <Banner
          type='warning'
          closeIcon={null}
          icon={
            <IconAlertTriangle
              size='large'
              style={{ color: 'var(--semi-color-warning)' }}
            />
          }
          title={t('旧版前端即将停止维护')}
          description={
            <div className='classic-frontend-deprecation-body'>
              <span>
                {isRootUser
                  ? t(
                      '你正在使用旧版前端，该版本即将停止维护，部分功能可能无法使用。建议切换到新版前端以获得完整体验。',
                    )
                  : t(
                      '你正在使用旧版前端，该版本即将停止维护，部分功能可能无法使用。请联系管理员切换到新版前端。',
                    )}
              </span>
              {isRootUser ? (
                <Button
                  type='warning'
                  theme='solid'
                  size='small'
                  loading={switching}
                  onClick={switchFrontend}
                >
                  {t('切换到新版前端')}
                </Button>
              ) : null}
            </div>
          }
        />
        <Button
          theme='borderless'
          size='small'
          type='tertiary'
          icon={<IconClose aria-hidden={true} />}
          onClick={confirmClose}
          className='classic-frontend-deprecation-close'
          aria-label={t('关闭')}
        />
      </div>
    </div>
  );
};

export default ClassicFrontendDeprecationBanner;
