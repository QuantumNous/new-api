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
import { Modal } from '@douyinfe/semi-ui';
import { API } from './api';
import { showError, showSuccess } from './utils';

export function confirmSwitchToDefaultFrontend(t, options = {}) {
  const { onLoadingChange } = options;

  Modal.confirm({
    title: t('切换到新版前端'),
    content: React.createElement(
      'div',
      null,
      React.createElement(
        'div',
        { style: { marginBottom: 8 } },
        t('切换后页面会自动刷新，并进入新版前端。是否继续？'),
      ),
      React.createElement(
        'div',
        { style: { color: 'var(--semi-color-text-1)' } },
        t('提示：如果切换后页面无法正常渲染，请清空浏览器缓存后重试。'),
      ),
    ),
    okText: t('确认切换'),
    cancelText: t('取消'),
    onOk: async () => {
      try {
        onLoadingChange?.(true);
        const res = await API.put('/api/option/', {
          key: 'theme.frontend',
          value: 'default',
        });
        const { success, message } = res.data;
        if (!success) {
          showError(message);
          return;
        }
        showSuccess(t('已切换到新版前端，正在跳转首页'));
        setTimeout(() => {
          window.location.replace('/');
        }, 600);
      } catch (error) {
        console.error('切换新版前端失败', error);
        showError(t('切换失败，请稍后重试'));
      } finally {
        onLoadingChange?.(false);
      }
    },
  });
}
