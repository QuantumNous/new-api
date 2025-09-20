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
import { Modal } from '@douyinfe/semi-ui';
import { API, showError } from '../../../../helpers';
import { useTranslation } from 'react-i18next';
import CodeViewer from '../../../common/ui/CodeViewer';

const JWKSInfoModal = ({ visible, onClose }) => {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [jwksInfo, setJwksInfo] = useState(null);

  const loadJWKSInfo = async () => {
    setLoading(true);
    try {
      const res = await API.get('/api/oauth/jwks');
      setJwksInfo(res.data);
    } catch (error) {
      showError(t('获取JWKS失败'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (visible) {
      loadJWKSInfo();
    }
  }, [visible]);

  return (
    <Modal
      title={t('JWKS 信息')}
      visible={visible}
      onCancel={onClose}
      onOk={onClose}
      cancelText=''
      okText={t('关闭')}
      width={650}
      bodyStyle={{ padding: '20px 24px' }}
      confirmLoading={loading}
    >
      <CodeViewer
        content={jwksInfo ? JSON.stringify(jwksInfo, null, 2) : t('加载中...')}
        title={t('JWKS 密钥集')}
        language='json'
      />
    </Modal>
  );
};

export default JWKSInfoModal;
