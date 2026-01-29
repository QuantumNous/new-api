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

import React, { useEffect, useState } from 'react';
import { Modal, Typography, Button } from '@douyinfe/semi-ui';
import { QRCodeCanvas } from 'qrcode.react';

const { Text } = Typography;

const AlipayQRCodeModal = ({
  t,
  visible,
  onCancel,
  qrCode,
  tradeNo,
  onRetry,
  retryLoading,
  timeoutMs = 2 * 60 * 1000,
}) => {
  const [expired, setExpired] = useState(false);
  const [remainingMs, setRemainingMs] = useState(timeoutMs);

  useEffect(() => {
    if (!visible || !qrCode) {
      setExpired(false);
      setRemainingMs(timeoutMs);
      return;
    }
    setExpired(false);
    setRemainingMs(timeoutMs);
    const timer = setTimeout(() => {
      setExpired(true);
    }, timeoutMs);
    const ticker = setInterval(() => {
      setRemainingMs((prev) => Math.max(prev - 1000, 0));
    }, 1000);
    return () => {
      clearTimeout(timer);
      clearInterval(ticker);
    };
  }, [visible, qrCode, timeoutMs]);

  return (
    <Modal
      title={t('支付宝当面付')}
      visible={visible}
      onCancel={onCancel}
      maskClosable={false}
      size='small'
      centered
      footer={null}
    >
      <div className='flex flex-col items-center gap-3 py-2'>
        {qrCode ? (
          <QRCodeCanvas value={qrCode} size={220} includeMargin />
        ) : (
          <Text>{t('二维码生成失败')}</Text>
        )}
        {tradeNo && <Text type='tertiary'>{t('订单号')}：{tradeNo}</Text>}
        <Text type='secondary'>{t('请使用支付宝扫码完成支付')}</Text>
        {!expired && (
          <Text type='secondary'>
            {t('二维码将在 {{seconds}} 秒后过期', {
              seconds: Math.ceil(remainingMs / 1000),
            })}
          </Text>
        )}
        {expired && (
          <Text type='danger'>{t('二维码已过期，请重新发起支付')}</Text>
        )}
        {expired && (
          <Button
            type='primary'
            theme='solid'
            onClick={onRetry}
            loading={retryLoading}
            disabled={!onRetry}
          >
            {t('重新发起支付')}
          </Button>
        )}
        <Button onClick={onCancel}>{t('关闭')}</Button>
      </div>
    </Modal>
  );
};

export default AlipayQRCodeModal;
