import React, { useState, useEffect } from 'react';
import {
  Modal,
  Input,
  InputNumber,
  Toast,
  Typography,
  Banner,
} from '@douyinfe/semi-ui';
import { API, getQuotaPerUnit } from '../../../helpers';

const { Text } = Typography;

const RefundModal = ({ visible, topUp, onCancel, onSuccess, t }) => {
  const [loading, setLoading] = useState(false);
  const [alreadyRefunded, setAlreadyRefunded] = useState(0);
  const [refundAmount, setRefundAmount] = useState(0);
  const [quotaDeduction, setQuotaDeduction] = useState(0);
  const [reason, setReason] = useState('');

  const remaining = topUp ? Math.max(topUp.money - alreadyRefunded, 0) : 0;

  useEffect(() => {
    if (visible && topUp) {
      API.get(`/api/user/topup/${topUp.id}/refunds`).then((res) => {
        if (res.data.success) {
          const refunds = res.data.data || [];
          const total = refunds
            .filter((r) => r.status === 'success')
            .reduce((sum, r) => sum + r.refund_amount, 0);
          setAlreadyRefunded(total);
          setRefundAmount(parseFloat(Math.max(topUp.money - total, 0).toFixed(2)));
        }
      });
      setQuotaDeduction(Math.round((topUp.amount || 0) * getQuotaPerUnit()));
      setReason('');
    }
  }, [visible, topUp]);

  const handleSubmit = async () => {
    if (refundAmount <= 0) {
      Toast.error({ content: t('退款金额必须大于 0') });
      return;
    }
    if (refundAmount > remaining + 0.001) {
      Toast.error({ content: t('退款金额超出可退余额') });
      return;
    }
    setLoading(true);
    try {
      const res = await API.post('/api/user/topup/refund', {
        topup_id: topUp.id,
        refund_amount: refundAmount,
        quota_deduction: quotaDeduction,
        reason: reason,
      });
      const { success, message } = res.data;
      if (success) {
        Toast.success({ content: t('退款申请已提交，等待 Waffo 处理') });
        onSuccess();
      } else {
        Toast.error({ content: message || t('退款失败') });
      }
    } catch (e) {
      Toast.error({ content: t('退款请求失败') });
    } finally {
      setLoading(false);
    }
  };

  if (!topUp) return null;

  return (
    <Modal
      title={t('发起退款')}
      visible={visible}
      onCancel={onCancel}
      onOk={handleSubmit}
      okText={t('确认退款')}
      cancelText={t('取消')}
      okButtonProps={{ type: 'danger', loading }}
    >
      <Banner
        type='warning'
        description={t('退款成功后将自动扣减用户指定额度，请谨慎操作')}
        style={{ marginBottom: 16 }}
      />
      <div style={{ marginBottom: 12 }}>
        <Text type='secondary'>{t('订单号')}：</Text>
        <Text>{topUp.trade_no}</Text>
      </div>
      <div style={{ marginBottom: 12 }}>
        <Text type='secondary'>{t('原始金额')}：</Text>
        <Text>${topUp.money?.toFixed(2)}</Text>
        {'  '}
        <Text type='secondary'>{t('已退款')}：</Text>
        <Text type='danger'>${alreadyRefunded.toFixed(2)}</Text>
        {'  '}
        <Text type='secondary'>{t('可退余额')}：</Text>
        <Text type='success'>${remaining.toFixed(2)}</Text>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div>
          <div style={{ marginBottom: 4 }}><Text>{t('退款金额 ($)')}</Text></div>
          <InputNumber
            value={refundAmount}
            onChange={setRefundAmount}
            min={0.01}
            max={remaining}
            precision={2}
            style={{ width: '100%' }}
          />
        </div>
        <div>
          <div style={{ marginBottom: 4 }}><Text>{t('扣减额度 (Token)')}</Text></div>
          <InputNumber
            value={quotaDeduction}
            onChange={setQuotaDeduction}
            min={0}
            style={{ width: '100%' }}
          />
        </div>
        <div>
          <div style={{ marginBottom: 4 }}><Text>{t('退款原因（可选）')}</Text></div>
          <Input
            value={reason}
            onChange={(v) => setReason(v)}
            placeholder={t('请输入退款原因')}
            style={{ width: '100%' }}
          />
        </div>
      </div>
    </Modal>
  );
};

export default RefundModal;
