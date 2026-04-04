import React, { useEffect, useRef } from 'react';
import { Modal, Toast, Typography } from '@douyinfe/semi-ui';
import { QRCodeSVG } from 'qrcode.react';
import { API, showError } from '../../../helpers';

const { Text, Paragraph } = Typography;

const wayCodeLabelMap = {
  QR_CASHIER: '聚合扫码',
  WX_NATIVE: '微信扫码',
  ALI_QR: '支付宝扫码',
};

export default function JeepayQRCodeModal({
  t,
  visible,
  onCancel,
  qrCodeUrl,
  orderId,
  wayCode,
  money,
  expiredTime,
  onPaid,
}) {
  const pollTimerRef = useRef(null);
  const pollDeadlineRef = useRef(null);
  const countdownTimerRef = useRef(null);
  const expireAtRef = useRef(null);
  const [remainingSeconds, setRemainingSeconds] = React.useState(null);
  const [isExpired, setIsExpired] = React.useState(false);

  const payTips = {
    QR_CASHIER: '请使用微信/支付宝/云闪付扫码支付',
    WX_NATIVE: '请使用微信扫码支付',
    ALI_QR: '请使用支付宝扫码支付',
  };

  useEffect(() => {
    if (pollTimerRef.current) {
      clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    }
    if (countdownTimerRef.current) {
      clearInterval(countdownTimerRef.current);
      countdownTimerRef.current = null;
    }

    if (!visible || !orderId) {
      pollDeadlineRef.current = null;
      expireAtRef.current = null;
      setRemainingSeconds(null);
      setIsExpired(false);
      return undefined;
    }

    pollDeadlineRef.current = Date.now() + 5 * 60 * 1000;
    expireAtRef.current = Date.now() + (Number(expiredTime) || 0) * 1000;
    setIsExpired(false);

    const markExpired = () => {
      setIsExpired(true);
      setRemainingSeconds(0);
      if (countdownTimerRef.current) {
        clearInterval(countdownTimerRef.current);
        countdownTimerRef.current = null;
      }
      if (pollTimerRef.current) {
        clearInterval(pollTimerRef.current);
        pollTimerRef.current = null;
      }
    };

    const updateCountdown = () => {
      const currentLeft = Math.max(
        0,
        Math.ceil((expireAtRef.current - Date.now()) / 1000),
      );
      setRemainingSeconds(currentLeft);
      if (currentLeft <= 0) {
        markExpired();
      }
    };

    updateCountdown();
    countdownTimerRef.current = setInterval(updateCountdown, 1000);

    const pollStatus = async () => {
      if (Date.now() > pollDeadlineRef.current || Date.now() > expireAtRef.current) {
        markExpired();
        return;
      }

      try {
        const res = await API.get(`/api/user/jeepay/status/${encodeURIComponent(orderId)}`);
        if (!res?.data?.success) {
          return;
        }
        const status = res.data?.data?.status;
        if (status === 'success') {
          if (pollTimerRef.current) {
            clearInterval(pollTimerRef.current);
            pollTimerRef.current = null;
          }
          Toast.success({ content: t('支付成功') });
          onPaid?.();
        } else if (status === 'failed' || status === 'expired') {
          if (pollTimerRef.current) {
            clearInterval(pollTimerRef.current);
            pollTimerRef.current = null;
          }
          showError(t('订单状态已变更，请重新下单'));
        }
      } catch (error) {
        // ignore transient polling errors
      }
    };

    pollStatus();
    pollTimerRef.current = setInterval(pollStatus, 3000);

    return () => {
      if (pollTimerRef.current) {
        clearInterval(pollTimerRef.current);
        pollTimerRef.current = null;
      }
      if (countdownTimerRef.current) {
        clearInterval(countdownTimerRef.current);
        countdownTimerRef.current = null;
      }
    };
  }, [visible, orderId, expiredTime, onPaid, t]);

  return (
    <Modal
      title={t('扫码支付')}
      visible={visible}
      footer={null}
      onCancel={onCancel}
      maskClosable={false}
      centered
    >
      <div className='flex flex-col items-center gap-3 py-2'>
        <Text strong>{t(payTips[wayCode] || '请使用扫码支付')}</Text>

        {money !== '' && money !== null && money !== undefined ? (
          <div className='flex flex-col items-center gap-1'>
            <Text type='secondary'>{t('实付金额')}</Text>
            <Text strong style={{ fontSize: 24, color: '#ef4444' }}>
              {Number(money).toFixed(2)} {t('元')}
            </Text>
          </div>
        ) : null}

        {isExpired ? (
          <div
            style={{
              width: 220,
              height: 220,
              borderRadius: 12,
              background: 'var(--semi-color-fill-0)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexDirection: 'column',
              gap: 8,
              color: 'var(--semi-color-text-2)',
              border: '1px dashed var(--semi-color-border)',
            }}
          >
            <Text strong>{t('二维码已过期')}</Text>
            <Text type='secondary'>{t('请重新下单获取新的支付码')}</Text>
          </div>
        ) : qrCodeUrl ? (
          <QRCodeSVG value={qrCodeUrl} size={220} includeMargin />
        ) : (
          <Text type='danger'>{t('二维码内容为空')}</Text>
        )}

        <div className='flex flex-col items-center gap-1'>
          {orderId ? (
            <Text type='tertiary' size='small'>
              {t('订单号')}：{orderId}
            </Text>
          ) : null}
          {remainingSeconds !== null ? (
            <Text type='secondary' size='small'>
              {t('支付剩余时间')}：{Math.floor(remainingSeconds / 60)}:{String(remainingSeconds % 60).padStart(2, '0')}
            </Text>
          ) : null}
        </div>

        <Paragraph type='warning' style={{ textAlign: 'center', marginBottom: 0 }}>
          {t('该码只能扫一次，再次扫码需重新下单！')}
        </Paragraph>
      </div>
    </Modal>
  );
}
