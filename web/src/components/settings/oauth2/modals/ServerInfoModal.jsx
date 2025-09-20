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

import React, { useState, useEffect } from 'react';
import { Modal, Typography } from '@douyinfe/semi-ui';
import { API, showError } from '../../../../helpers';
import { useTranslation } from 'react-i18next';

const { Text } = Typography;

const ServerInfoModal = ({ visible, onClose }) => {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [serverInfo, setServerInfo] = useState(null);

  const loadServerInfo = async () => {
    setLoading(true);
    try {
      const res = await API.get('/api/oauth/server-info');
      setServerInfo(res.data);
    } catch (error) {
      showError(t('获取服务器信息失败'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (visible) {
      loadServerInfo();
    }
  }, [visible]);

  return (
    <Modal
      title={
        <div className='flex items-center'>
          <span>🖥️</span>
          <Text strong className='ml-2'>
            {t('OAuth2 服务器信息')}
          </Text>
        </div>
      }
      visible={visible}
      onCancel={onClose}
      onOk={onClose}
      cancelText=''
      okText={t('关闭')}
      width={650}
      bodyStyle={{ padding: '20px 24px' }}
      confirmLoading={loading}
    >
      <pre
        style={{
          background: 'var(--semi-color-fill-0)',
          padding: '16px',
          borderRadius: '8px',
          fontSize: '12px',
          maxHeight: '400px',
          overflow: 'auto',
          border: '1px solid var(--semi-color-border)',
          margin: 0,
        }}
      >
        {serverInfo ? JSON.stringify(serverInfo, null, 2) : t('加载中...')}
      </pre>
    </Modal>
  );
};

export default ServerInfoModal;
