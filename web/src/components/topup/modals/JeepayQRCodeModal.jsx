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
}) {
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
        <Text strong>
          {t('请使用')} {t(wayCodeLabelMap[wayCode] || '扫码方式')} {t('完成支付')}
        </Text>
        {qrCodeUrl ? (
          <QRCodeSVG value={qrCodeUrl} size={220} includeMargin />
        ) : (
          <Text type='danger'>{t('二维码内容为空')}</Text>
        )}
        <Paragraph type='secondary' style={{ textAlign: 'center', marginBottom: 0 }}>
          {t('支付完成后，系统将依赖 Jeepay 异步通知自动更新充值状态。')}
        </Paragraph>
        {orderId ? (
          <Text type='tertiary' size='small'>
            {t('订单号')}：{orderId}
          </Text>
        ) : null}
      </div>
    </Modal>
  );
}
