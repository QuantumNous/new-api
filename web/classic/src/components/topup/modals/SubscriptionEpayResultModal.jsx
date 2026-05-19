import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Button, Modal, Space, Spin, Typography } from '@douyinfe/semi-ui';
import { API, showSuccess } from '../../../helpers';
import {
  clearSubscriptionEpayCheckout,
  readSubscriptionEpayCheckout,
  submitSubscriptionEpayCheckout,
} from '../../../helpers/subscriptionEpayCheckout';

const { Text, Title } = Typography;

const POLL_INTERVAL_MS = 2500;
const POLL_TIMEOUT_MS = 5 * 60 * 1000;

const getStatusText = (status, t) => {
  switch (status) {
    case 'paid':
      return t('支付成功');
    case 'failed':
      return t('支付失败');
    case 'expired':
      return t('订单已过期');
    case 'timeout':
      return t('支付仍在确认中');
    default:
      return t('等待支付');
  }
};

const getStatusDescription = (status, t) => {
  switch (status) {
    case 'paid':
      return t('订阅已开通，窗口即将关闭');
    case 'failed':
      return t('支付未完成，请重新发起订单');
    case 'expired':
      return t('该支付订单已过期，请重新发起订单');
    case 'timeout':
      return t('如果已经支付，请稍后刷新订阅状态');
    default:
      return t('扫码或在支付页完成付款，本页面会自动更新');
  }
};

const SubscriptionEpayResultModal = ({
  t,
  visible,
  tradeNo,
  onClose,
  onPaid,
}) => {
  const [checkout, setCheckout] = useState(null);
  const [status, setStatus] = useState('checking');
  const [lastMessage, setLastMessage] = useState('');
  const [lastCheckedAt, setLastCheckedAt] = useState(null);
  const submittedTradeNoRef = useRef('');
  const closeTimerRef = useRef(null);
  const iframeName = useMemo(
    () => `subscription-epay-checkout-${tradeNo || 'empty'}`,
    [tradeNo],
  );

  useEffect(() => {
    if (!visible || !tradeNo) return;
    setCheckout(readSubscriptionEpayCheckout(tradeNo));
    setStatus('checking');
    setLastMessage('');
    setLastCheckedAt(null);
    submittedTradeNoRef.current = '';
  }, [tradeNo, visible]);

  useEffect(() => {
    if (!visible || !checkout || submittedTradeNoRef.current === checkout.tradeNo) {
      return;
    }
    submitSubscriptionEpayCheckout(checkout, iframeName);
    submittedTradeNoRef.current = checkout.tradeNo;
  }, [checkout, iframeName, visible]);

  const pollOrderStatus = useCallback(async () => {
    if (!tradeNo) return;

    try {
      const res = await API.get('/api/subscription/order/status', {
        params: { outTradeNo: tradeNo },
      });
      if (!res.data?.success || !res.data?.data) {
        setLastMessage(res.data?.message || t('暂时无法查询支付状态'));
        return;
      }

      const nextStatus = res.data.data.status || 'pending';
      setStatus(nextStatus);
      setLastMessage('');
      setLastCheckedAt(new Date());

      if (nextStatus === 'paid') {
        clearSubscriptionEpayCheckout(tradeNo);
        showSuccess(t('支付成功'));
        await onPaid?.();
        if (!closeTimerRef.current) {
          closeTimerRef.current = window.setTimeout(() => {
            onClose?.();
          }, 1500);
        }
      }
    } catch (e) {
      setLastMessage(t('暂时无法查询支付状态'));
    }
  }, [onClose, onPaid, t, tradeNo]);

  useEffect(() => {
    if (!visible || !tradeNo || status === 'paid') return;

    const startedAt = Date.now();
    pollOrderStatus();
    const intervalId = window.setInterval(() => {
      if (Date.now() - startedAt >= POLL_TIMEOUT_MS) {
        setStatus('timeout');
        window.clearInterval(intervalId);
        return;
      }
      pollOrderStatus();
    }, POLL_INTERVAL_MS);

    return () => window.clearInterval(intervalId);
  }, [pollOrderStatus, status, tradeNo, visible]);

  useEffect(() => {
    return () => {
      if (closeTimerRef.current) {
        window.clearTimeout(closeTimerRef.current);
      }
    };
  }, []);

  const openCheckoutWindow = () => {
    if (!checkout) return;
    submitSubscriptionEpayCheckout(checkout, '_blank');
  };

  const statusText = getStatusText(status, t);
  const statusDescription = getStatusDescription(status, t);

  return (
    <Modal
      title={t('订阅支付')}
      visible={visible}
      onCancel={onClose}
      footer={null}
      width={920}
      maskClosable={false}
      centered
    >
      <div className='grid grid-cols-1 lg:grid-cols-[1fr_260px] gap-4'>
        <div>
          {checkout && status !== 'paid' ? (
            <iframe
              className='w-full min-h-[520px] rounded-lg border border-gray-200'
              name={iframeName}
              title={t('支付页面')}
            />
          ) : (
            <div className='w-full min-h-[520px] rounded-lg border border-gray-200 flex items-center justify-center'>
              <Space vertical align='center'>
                {status === 'checking' || status === 'pending' ? <Spin /> : null}
                <Title heading={5}>{statusText}</Title>
                <Text type='tertiary'>{statusDescription}</Text>
              </Space>
            </div>
          )}
        </div>
        <Space vertical align='start' className='w-full'>
          <Title heading={5}>{statusText}</Title>
          <Text type='tertiary'>{statusDescription}</Text>
          <Text size='small' copyable>
            {tradeNo || t('无订单号')}
          </Text>
          {lastCheckedAt ? (
            <Text type='tertiary' size='small'>
              {t('上次检查')}: {lastCheckedAt.toLocaleTimeString()}
            </Text>
          ) : null}
          {lastMessage ? (
            <Text type='warning' size='small'>
              {lastMessage}
            </Text>
          ) : null}
          <Button theme='solid' type='primary' onClick={pollOrderStatus}>
            {t('刷新状态')}
          </Button>
          {checkout ? (
            <Button theme='light' onClick={openCheckoutWindow}>
              {t('在新窗口打开支付页')}
            </Button>
          ) : null}
        </Space>
      </div>
    </Modal>
  );
};

export default SubscriptionEpayResultModal;
