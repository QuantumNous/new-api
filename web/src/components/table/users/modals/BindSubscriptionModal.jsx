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

import React, { useEffect, useMemo, useState } from 'react';
import { Modal, Select, Space, Typography } from '@douyinfe/semi-ui';
import { API, showError, showSuccess } from '../../../../helpers';

const { Text } = Typography;

const BindSubscriptionModal = ({ visible, onCancel, user, t, onSuccess }) => {
  const [loading, setLoading] = useState(false);
  const [plans, setPlans] = useState([]);
  const [selectedPlanId, setSelectedPlanId] = useState(null);

  const loadPlans = async () => {
    setLoading(true);
    try {
      const res = await API.get('/api/subscription/admin/plans');
      if (res.data?.success) {
        setPlans(res.data.data || []);
      } else {
        showError(res.data?.message || t('加载失败'));
      }
    } catch (e) {
      showError(t('请求失败'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (visible) {
      setSelectedPlanId(null);
      loadPlans();
    }
  }, [visible]);

  const planOptions = useMemo(() => {
    return (plans || []).map((p) => ({
      label: `${p?.plan?.title || ''} (${p?.plan?.currency || 'USD'} ${Number(p?.plan?.price_amount || 0)})`,
      value: p?.plan?.id,
    }));
  }, [plans]);

  const bind = async () => {
    if (!user?.id) {
      showError(t('用户信息缺失'));
      return;
    }
    if (!selectedPlanId) {
      showError(t('请选择订阅套餐'));
      return;
    }
    setLoading(true);
    try {
      const res = await API.post('/api/subscription/admin/bind', {
        user_id: user.id,
        plan_id: selectedPlanId,
      });
      if (res.data?.success) {
        showSuccess(t('绑定成功'));
        onSuccess?.();
        onCancel?.();
      } else {
        showError(res.data?.message || t('绑定失败'));
      }
    } catch (e) {
      showError(t('请求失败'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      title={t('绑定订阅套餐')}
      visible={visible}
      onCancel={onCancel}
      onOk={bind}
      confirmLoading={loading}
      maskClosable={false}
      centered
    >
      <Space vertical style={{ width: '100%' }} spacing='medium'>
        <div className='text-sm'>
          <Text strong>{t('用户')}：</Text>
          <Text>{user?.username}</Text>
          <Text type='tertiary'> (ID: {user?.id})</Text>
        </div>
        <Select
          placeholder={t('选择订阅套餐')}
          optionList={planOptions}
          value={selectedPlanId}
          onChange={setSelectedPlanId}
          loading={loading}
          filter
          style={{ width: '100%' }}
        />
        <div className='text-xs text-gray-500'>
          {t('绑定后会立即生成用户订阅（无需支付），有效期按套餐配置计算。')}
        </div>
      </Space>
    </Modal>
  );
};

export default BindSubscriptionModal;
