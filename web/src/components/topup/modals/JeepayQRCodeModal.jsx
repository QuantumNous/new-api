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
  const [remainingSeconds, setRemainingSeconds] = React.useState(null);

  const payTips = {
    QR_CASHIER: '请使用微信/支付宝/云闪付扫码支付',
    WX_NATIVE: '请使用微信扫码支付',
    ALI_QR: '请使用支付宝扫码支付',
  };

  useEffect(() => {
    if (!visible || !orderId) {
      if (pollTimerRef.current) {
        clearInterval(pollTimerRef.current);
        pollTimerRef.current = null;
      }
      if (countdownTimerRef.current) {
        clearInterval(countdownTimerRef.current);
        countdownTimerRef.current = null;
      }
      pollDeadlineRef.current = null;
      setRemainingSeconds(null);
      return undefined;
    }

    pollDeadlineRef.current = Date.now() + 5 * 60 * 1000;

    if (expiredTime) {
      let leftSeconds = Number(expiredTime) || 0;
      const updateCountdown = () => {
        setRemainingSeconds(Math.max(0, leftSeconds));
        leftSeconds -= 1;
      };
      updateCountdown();
      countdownTimerRef.current = setInterval(updateCountdown, 1000);
    }

    const pollStatus = async () => {
      if (Date.now() > pollDeadlineRef.current) {
        if (pollTimerRef.current) {
          clearInterval(pollTimerRef.current);
          pollTimerRef.current = null;
        }
        Toast.info({ content: t('支付结果处理中，请稍后在充值记录中查看') });
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
        {qrCodeUrl ? (
          <QRCodeSVG value={qrCodeUrl} size={220} includeMargin />
        ) : (
          <Text type='danger'>{t('二维码内容为空')}</Text>
        )}
        {money !== '' && money !== null && money !== undefined ? (
          <Text>{t('实付金额')}：{Number(money).toFixed(2)} {t('元')}</Text>
        ) : null}
        {remainingSeconds !== null ? (
          <Text>{t('支付剩余时间')}：{Math.floor(remainingSeconds / 60)}:{String(remainingSeconds % 60).padStart(2, '0')}</Text>
        ) : null}
        {orderId ? (
          <Text type='tertiary' size='small'>
            {t('订单号')}：{orderId}
          </Text>
        ) : null}
        <Paragraph type='warning' style={{ textAlign: 'center', marginBottom: 0 }}>
          {t('该码只能扫一次，再次扫码需重新下单！')}
        </Paragraph>
      </div>
    </Modal>
  );
}
