import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Button, Modal, Space, Spin, Typography } from '@douyinfe/semi-ui';
import { API, showSuccess } from '../../../helpers';
import {
  clearSubscriptionEpayCheckout,
  markSubscriptionEpayCheckoutOpened,
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
  const checkoutOpeningRef = useRef(false);
  const closeTimerRef = useRef(null);

  useEffect(() => {
    if (!visible || !tradeNo) return;
    setCheckout(readSubscriptionEpayCheckout(tradeNo));
    setStatus('checking');
    setLastMessage('');
    setLastCheckedAt(null);
    checkoutOpeningRef.current = false;
  }, [tradeNo, visible]);

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
    if (checkout.openedAt) return;
    if (checkoutOpeningRef.current) return;

    checkoutOpeningRef.current = true;
    if (!submitSubscriptionEpayCheckout(checkout, '_blank')) {
      checkoutOpeningRef.current = false;
      return;
    }
    const nextCheckout =
      markSubscriptionEpayCheckoutOpened(checkout.tradeNo) || {
        ...checkout,
        openedAt: Date.now(),
      };
    setCheckout(nextCheckout);
  };

  const statusText = getStatusText(status, t);
  const statusDescription = getStatusDescription(status, t);
  const hasCheckout = !!checkout && status !== 'paid';
  const checkoutDescription = checkout?.openedAt
    ? t('支付页已在新窗口打开，请在新窗口完成付款，本页面会自动检测')
    : t('点击打开支付页，在新窗口完成付款，本页面会自动检测');

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
          <div className='w-full min-h-[520px] rounded-lg border border-gray-200 flex items-center justify-center p-6 text-center'>
            <Space vertical align='center'>
              {status === 'checking' || status === 'pending' ? <Spin /> : null}
              <Title heading={5}>{statusText}</Title>
              <Text type='tertiary'>
                {hasCheckout ? checkoutDescription : statusDescription}
              </Text>
              {hasCheckout && !checkout?.openedAt ? (
                <Button theme='solid' type='primary' onClick={openCheckoutWindow}>
                  {t('打开支付页')}
                </Button>
              ) : null}
            </Space>
          </div>
        </div>
        <Space vertical align='start' className='w-full'>
          <Title heading={5}>{statusText}</Title>
          <Text type='tertiary'>
            {hasCheckout ? checkoutDescription : statusDescription}
          </Text>
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
          {hasCheckout && !checkout?.openedAt ? (
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
