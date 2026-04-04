import React from 'react';
import { Modal, Typography } from '@douyinfe/semi-ui';
import { QRCodeSVG } from 'qrcode.react';

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
}) {
  const payTips = {
    QR_CASHIER: '请使用微信/支付宝/云闪付扫码支付',
    WX_NATIVE: '请使用微信扫码支付',
    ALI_QR: '请使用支付宝扫码支付',
  };

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
