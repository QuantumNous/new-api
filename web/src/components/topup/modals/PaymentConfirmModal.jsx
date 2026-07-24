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
import { Gift, CreditCard } from 'lucide-react';
import { quotaToDisplayAmount } from '../../../helpers/quota';

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
  includeTax,
  taxRate,
  giftAmount = 0,
}) => {
  const hasDiscount =
    discountRate && discountRate > 0 && discountRate < 1 && amountNumber > 0;
  const originalAmount = hasDiscount ? amountNumber / discountRate : 0;
  const discountAmount = hasDiscount ? originalAmount - amountNumber : 0;

  // 含税明细
  const hasTax = includeTax && taxRate > 0 && amountNumber > 0;
  const preTaxAmount = hasTax ? amountNumber / (1 + taxRate) : 0;
  const taxAmount = hasTax ? amountNumber - preTaxAmount : 0;
  return (
    <Modal
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
      className='wallet-payment-confirm-modal'
      bodyStyle={{ padding: 0 }}
      okButtonProps={{
        style: {
          borderRadius: 14,
          background: '#0f766e',
          borderColor: '#0f766e',
        },
      }}
      cancelButtonProps={{ style: { borderRadius: 14 } }}
    >
      <div
        className='rounded-3xl p-5'
        style={{
          background:
            'radial-gradient(circle at 10% 0%, rgba(20,184,166,0.14), transparent 36%), var(--console-card-gradient-soft)',
        }}
      >
        <div className='mb-4 rounded-3xl bg-slate-950 p-5 text-white shadow-2xl shadow-slate-950/15'>
          <div className='text-xs font-bold uppercase tracking-[0.22em] text-emerald-200/80'>
            {t('充值确认')}
          </div>
          <div className='mt-3 flex items-end justify-between gap-4'>
            <div>
              <div className='text-sm text-slate-300'>{t('充值数量')}</div>
              <div className='mt-1 text-xl font-black'>
                {renderQuotaWithAmount(topUpCount)}
              </div>
            </div>
            <div className='text-right'>
              <div className='text-sm text-slate-300'>{t('实付金额')}</div>
              <div className='mt-1 text-3xl font-black text-emerald-200'>
                {amountLoading ? '...' : renderAmount()}
              </div>
            </div>
          </div>
          {giftAmount > 0 && (
            <div className='mt-3 rounded-xl bg-emerald-500/15 px-4 py-2.5'>
              <div className='flex items-center gap-2'>
                <Gift size={16} className='text-emerald-300' />
                <span className='text-sm text-emerald-200'>
                  {t('充值赠送')}：$ {Number(quotaToDisplayAmount(giftAmount).toFixed(2))}
                </span>
              </div>
            </div>
          )}
        </div>
        <Card className='!rounded-3xl !border-0 bg-white/85 shadow-sm ring-1 ring-slate-200/80 dark:!bg-slate-900/80 dark:ring-slate-700/80'>
          <div className='space-y-3'>
            <div className='flex justify-between items-center'>
              <Text strong className='text-slate-700 dark:text-slate-200'>
                {t('充值数量')}：
              </Text>
              <Text className='text-slate-900 dark:text-slate-100'>
                {renderQuotaWithAmount(topUpCount)}
              </Text>
            </div>
            <div className='flex justify-between items-center'>
              <Text strong className='text-slate-700 dark:text-slate-200'>
                {t('实付金额')}：
              </Text>
              {amountLoading ? (
                <Skeleton.Title style={{ width: '60px', height: '16px' }} />
              ) : (
                <div className='flex items-baseline space-x-2'>
                  <Text strong className='font-bold' style={{ color: 'red' }}>
                    {renderAmount()}
                  </Text>
                  {hasDiscount && (
                    <Text size='small' className='text-rose-500'>
                      {Math.round(discountRate * 100)}%
                    </Text>
                  )}
                </div>
              )}
            </div>
            {giftAmount > 0 && (
              <div className='flex justify-between items-center'>
                <Text strong className='text-slate-700 dark:text-slate-200'>
                  {t('充值赠送')}：
                </Text>
                <Text className='font-bold' style={{ color: 'var(--semi-color-success)' }}>
                  $ {Number(quotaToDisplayAmount(giftAmount).toFixed(2))}
                </Text>
              </div>
            )}
            {hasDiscount && !amountLoading && (
              <>
                <div className='flex justify-between items-center'>
                  <Text className='text-slate-500 dark:text-slate-400'>
                    {t('原价')}：
                  </Text>
                  <Text delete className='text-slate-500 dark:text-slate-400'>
                    {`${originalAmount.toFixed(2)} ${t('元')}`}
                  </Text>
                </div>
                <div className='flex justify-between items-center'>
                  <Text className='text-slate-500 dark:text-slate-400'>
                    {t('优惠')}：
                  </Text>
                  <Text className='text-emerald-600 dark:text-emerald-400'>
                    {`- ${discountAmount.toFixed(2)} ${t('元')}`}
                  </Text>
                </div>
              </>
            )}
            {hasTax && !amountLoading && (
              <>
                <div className='flex justify-between items-center'>
                  <Text className='text-slate-500 dark:text-slate-400'>
                    {t('商品金额')}：
                  </Text>
                  <Text className='text-slate-500 dark:text-slate-400'>
                    {`${preTaxAmount.toFixed(2)} ${t('元')}`}
                  </Text>
                </div>
                <div className='flex justify-between items-center'>
                  <Text className='text-slate-500 dark:text-slate-400'>
                    {t('服务费')}（{parseFloat((taxRate * 100).toFixed(2))}%）：
                  </Text>
                  <Text className='text-slate-500 dark:text-slate-400'>
                    {`+ ${taxAmount.toFixed(2)} ${t('元')}`}
                  </Text>
                </div>
              </>
            )}
            <div className='flex justify-between items-center'>
              <Text strong className='text-slate-700 dark:text-slate-200'>
                {t('支付方式')}：
              </Text>
              <div className='flex items-center'>
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
                            color='#635BFF'
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
                        <Text className='text-slate-900 dark:text-slate-100'>
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
                          <Text className='text-slate-900 dark:text-slate-100'>
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
                            color='#635BFF'
                          />
                          <Text className='text-slate-900 dark:text-slate-100'>
                            Stripe
                          </Text>
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
                          <Text className='text-slate-900 dark:text-slate-100'>
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
