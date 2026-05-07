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

import React from 'react';
import { Modal, Typography, Card, Skeleton } from '@douyinfe/semi-ui';
import { SiAlipay, SiWechat, SiStripe } from 'react-icons/si';
import { CreditCard } from 'lucide-react';
import { getCurrencyConfig } from '../../../helpers/render';

const { Text } = Typography;

const PaymentConfirmModal = ({
  t,
  open,
  onlineTopUp,
  handleCancel,
  confirmLoading,
  topUpCount,
  renderQuotaWithAmount,
  amountLoading,
  renderAmount,
  payWay,
  payMethods,
  // 新增：用于显示折扣明细
  amountNumber,
  discountRate,
}) => {
  const { symbol } = getCurrencyConfig();
  const hasDiscount =
    discountRate && discountRate > 0 && discountRate < 1 && amountNumber > 0;
  const originalAmount = hasDiscount ? amountNumber / discountRate : 0;
  const discountAmount = hasDiscount ? originalAmount - amountNumber : 0;
  return (
    <Modal
      className='payment-confirm-modal'
      title={
        <div className='flex items-center'>
          <CreditCard className='mr-2' size={18} />
          {t('充值确认')}
        </div>
      }
      visible={open}
      onOk={onlineTopUp}
      onCancel={handleCancel}
      maskClosable={false}
      size='small'
      centered
      confirmLoading={confirmLoading}
    >
      <div className='payment-confirm-layout space-y-4'>
        <Card className='payment-confirm-card !rounded-xl !border-0'>
          <div className='space-y-3'>
            <div className='payment-confirm-row flex justify-between items-center'>
              <Text strong className='payment-confirm-label'>
                {t('充值数量')}：
              </Text>
              <Text className='payment-confirm-value'>
                {renderQuotaWithAmount(topUpCount)}
              </Text>
            </div>
            <div className='payment-confirm-row flex justify-between items-center'>
              <Text strong className='payment-confirm-label'>
                {t('实付金额')}：
              </Text>
              {amountLoading ? (
                <Skeleton.Title style={{ width: '60px', height: '16px' }} />
              ) : (
                <div className='payment-confirm-price-group flex items-baseline space-x-2'>
                  <Text strong className='payment-confirm-price'>
                    {renderAmount()}
                  </Text>
                  {hasDiscount && (
                    <Text
                      size='small'
                      className='payment-confirm-discount-rate'
                    >
                      {Math.round(discountRate * 100)}%
                    </Text>
                  )}
                </div>
              )}
            </div>
            {hasDiscount && !amountLoading && (
              <>
                <div className='payment-confirm-row flex justify-between items-center'>
                  <Text className='payment-confirm-hint'>{t('原价')}：</Text>
                  <Text delete className='payment-confirm-hint'>
                    {`${originalAmount.toFixed(2)} ${t('元')}`}
                  </Text>
                </div>
                <div className='payment-confirm-row flex justify-between items-center'>
                  <Text className='payment-confirm-hint'>{t('优惠')}：</Text>
                  <Text className='payment-confirm-savings'>
                    {`- ${discountAmount.toFixed(2)} ${t('元')}`}
                  </Text>
                </div>
              </>
            )}
            <div className='payment-confirm-row flex justify-between items-center'>
              <Text strong className='payment-confirm-label'>
                {t('支付方式')}：
              </Text>
              <div className='payment-confirm-method flex items-center'>
                {(() => {
                  const payMethod = payMethods.find(
                    (method) => method.type === payWay,
                  );
                  if (payMethod) {
                    return (
                      <>
                        {payMethod.type === 'alipay' ? (
                          <SiAlipay
                            className='mr-2'
                            size={16}
                            color='#1677FF'
                          />
                        ) : payMethod.type === 'wxpay' ? (
                          <SiWechat
                            className='mr-2'
                            size={16}
                            color='#07C160'
                          />
                        ) : payMethod.type === 'stripe' ? (
                          <SiStripe
                            className='mr-2'
                            size={16}
                            color='var(--app-accent)'
                          />
                        ) : payMethod.icon ? (
                          <img
                            src={payMethod.icon}
                            alt={payMethod.name}
                            className='mr-2'
                            style={{
                              width: 16,
                              height: 16,
                              objectFit: 'contain',
                            }}
                          />
                        ) : (
                          <CreditCard
                            className='mr-2'
                            size={16}
                            color={
                              payMethod.color || 'var(--semi-color-text-2)'
                            }
                          />
                        )}
                        <Text className='payment-confirm-value'>
                          {payMethod.name}
                        </Text>
                      </>
                    );
                  } else {
                    // 默认充值方式
                    if (payWay === 'alipay') {
                      return (
                        <>
                          <SiAlipay
                            className='mr-2'
                            size={16}
                            color='#1677FF'
                          />
                          <Text className='payment-confirm-value'>
                            {t('支付宝')}
                          </Text>
                        </>
                      );
                    } else if (payWay === 'stripe') {
                      return (
                        <>
                          <SiStripe
                            className='mr-2'
                            size={16}
                            color='var(--app-accent)'
                          />
                          <Text className='payment-confirm-value'>Stripe</Text>
                        </>
                      );
                    } else {
                      return (
                        <>
                          <SiWechat
                            className='mr-2'
                            size={16}
                            color='#07C160'
                          />
                          <Text className='payment-confirm-value'>
                            {t('微信')}
                          </Text>
                        </>
                      );
                    }
                  }
                })()}
              </div>
            </div>
          </div>
        </Card>
      </div>
    </Modal>
  );
};

export default PaymentConfirmModal;
