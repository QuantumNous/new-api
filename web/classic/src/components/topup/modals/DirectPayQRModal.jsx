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

import React, { useEffect, useRef, useState } from 'react';
import { Modal, Typography, Space, Tag } from '@douyinfe/semi-ui';
import { QRCodeSVG } from 'qrcode.react';
import { SiAlipay, SiWechat } from 'react-icons/si';

const { Text, Title } = Typography;

const EXPIRE_SECONDS = 15 * 60; // 15 minutes

const DirectPayQRModal = ({
  t,
  open,
  onClose,
  payType,
  qrCode,
  payMoney,
  onSuccess,
  onExpired,
}) => {
  const [secondsLeft, setSecondsLeft] = useState(EXPIRE_SECONDS);
  const timerRef = useRef(null);
  const countdownRef = useRef(null);

  const isAlipay = payType === 'alipay_direct';
  const icon = isAlipay ? (
    <SiAlipay size={20} color='#1677FF' />
  ) : (
    <SiWechat size={20} color='#07C160' />
  );
  const label = isAlipay ? t('支付宝扫码支付') : t('微信扫码支付');
  const qrColor = isAlipay ? '#1677FF' : '#07C160';

  const mm = String(Math.floor(secondsLeft / 60)).padStart(2, '0');
  const ss = String(secondsLeft % 60).padStart(2, '0');

  useEffect(() => {
    if (!open) {
      clearInterval(timerRef.current);
      clearInterval(countdownRef.current);
      setSecondsLeft(EXPIRE_SECONDS);
      return;
    }

    setSecondsLeft(EXPIRE_SECONDS);

    countdownRef.current = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          clearInterval(countdownRef.current);
          onExpired && onExpired();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      clearInterval(countdownRef.current);
    };
  }, [open]);

  // Wrap close (X / mask click) with a confirmation prompt to prevent
  // accidental dismissal — closing means the user has to wait for a fresh
  // QR (server has to call alipay precreate again, ~3-5s).
  const handleClose = () => {
    Modal.confirm({
      title: t('关闭支付二维码？'),
      content: t('关闭后当前订单将作废，需要重新生成二维码。'),
      okText: t('确认关闭'),
      cancelText: t('继续支付'),
      onOk: () => onClose && onClose(),
    });
  };

  return (
    <Modal
      title={
        <div className='flex items-center gap-2'>
          {icon}
          <span>{label}</span>
        </div>
      }
      visible={open}
      onCancel={handleClose}
      footer={null}
      width={340}
      centered
    >
      <Space vertical align='center' style={{ width: '100%' }}>
        {qrCode ? (
          <div
            style={{
              padding: 12,
              background: '#fff',
              borderRadius: 8,
              display: 'inline-block',
              border: `2px solid ${qrColor}`,
            }}
          >
            <QRCodeSVG value={qrCode} size={200} fgColor={qrColor} />
          </div>
        ) : null}

        {payMoney != null && (
          <Text style={{ fontSize: 16 }}>
            {t('实付金额：')}
            <span style={{ color: 'red', fontWeight: 600 }}>
              ¥{payMoney.toFixed(2)}
            </span>
          </Text>
        )}

        <Tag color={secondsLeft > 60 ? 'green' : 'red'} size='large'>
          {t('剩余时间：')} {mm}:{ss}
        </Tag>

        <Text type='secondary' size='small'>
          {t('请使用对应 App 扫描上方二维码完成支付')}
        </Text>
      </Space>
    </Modal>
  );
};

export default DirectPayQRModal;
