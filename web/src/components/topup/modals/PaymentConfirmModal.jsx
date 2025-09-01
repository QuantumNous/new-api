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
}) => {
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
    >
      <div className='space-y-4'>
        <Card className='!rounded-xl !border-0 bg-slate-50 dark:bg-slate-800'>
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
                <Text strong className='font-bold' style={{ color: 'red' }}>
                  {renderAmount()}
                </Text>
              )}
            </div>
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
