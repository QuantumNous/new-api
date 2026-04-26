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
import {
  Button,
  Card,
  Modal,
  ModalBackdrop,
  ModalBody,
  ModalContainer,
  ModalDialog,
  ModalFooter,
  ModalHeader,
  Skeleton,
  useOverlayState,
} from '@heroui/react';
import { SiAlipay, SiWechat, SiStripe } from 'react-icons/si';
import { CreditCard } from 'lucide-react';

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
  const hasDiscount =
    discountRate && discountRate > 0 && discountRate < 1 && amountNumber > 0;
  const originalAmount = hasDiscount ? amountNumber / discountRate : 0;
  const discountAmount = hasDiscount ? originalAmount - amountNumber : 0;
  const modalState = useOverlayState({
    isOpen: open,
    onOpenChange: (isOpen) => {
      if (!isOpen) handleCancel();
    },
  });

  const payMethod = payMethods.find((method) => method.type === payWay);
  const iconColor = payMethod?.color || 'currentColor';
  const methodName =
    payMethod?.name ||
    (payWay === 'alipay' ? t('支付宝') : payWay === 'stripe' ? 'Stripe' : t('微信'));
  const methodIcon = payMethod ? (
    payMethod.type === 'alipay' ? (
      <SiAlipay size={16} color='#1677FF' />
    ) : payMethod.type === 'wxpay' ? (
      <SiWechat size={16} color='#07C160' />
    ) : payMethod.type === 'stripe' ? (
      <SiStripe size={16} color='#635BFF' />
    ) : payMethod.icon ? (
      <img
        src={payMethod.icon}
        alt={payMethod.name}
        className='h-4 w-4 object-contain'
      />
    ) : (
      <CreditCard size={16} color={iconColor} />
    )
  ) : payWay === 'alipay' ? (
    <SiAlipay size={16} color='#1677FF' />
  ) : payWay === 'stripe' ? (
    <SiStripe size={16} color='#635BFF' />
  ) : (
    <SiWechat size={16} color='#07C160' />
  );

  return (
    <Modal state={modalState}>
      <ModalBackdrop isDismissable={false} variant='blur'>
        <ModalContainer size='sm' placement='center'>
          <ModalDialog className='bg-white/95 backdrop-blur dark:bg-slate-950/95'>
            <ModalHeader className='border-b border-slate-200/80 dark:border-white/10'>
              <div className='flex items-center gap-2'>
                <CreditCard size={18} />
                {t('充值确认')}
              </div>
            </ModalHeader>
            <ModalBody className='px-6 py-5'>
              <Card className='rounded-2xl border border-slate-200 bg-slate-50/80 p-4 shadow-none dark:border-white/10 dark:bg-slate-900/70'>
                <div className='space-y-3'>
                  <InfoRow
                    label={`${t('充值数量')}：`}
                    value={renderQuotaWithAmount(topUpCount)}
                  />
                  <InfoRow
                    label={`${t('实付金额')}：`}
                    value={
                      amountLoading ? (
                        <Skeleton className='h-4 w-16 rounded-md' />
                      ) : (
                        <div className='flex items-baseline gap-2'>
                          <span className='font-semibold text-rose-600 dark:text-rose-300'>
                            {renderAmount()}
                          </span>
                          {hasDiscount ? (
                            <span className='text-xs text-rose-500'>
                              {Math.round(discountRate * 100)}%
                            </span>
                          ) : null}
                        </div>
                      )
                    }
                  />
                  {hasDiscount && !amountLoading ? (
                    <>
                      <InfoRow
                        label={`${t('原价')}：`}
                        value={
                          <span className='text-slate-500 line-through dark:text-slate-400'>
                            {`${originalAmount.toFixed(2)} ${t('元')}`}
                          </span>
                        }
                      />
                      <InfoRow
                        label={`${t('优惠')}：`}
                        value={
                          <span className='text-emerald-600 dark:text-emerald-400'>
                            {`- ${discountAmount.toFixed(2)} ${t('元')}`}
                          </span>
                        }
                      />
                    </>
                  ) : null}
                  <InfoRow
                    label={`${t('支付方式')}：`}
                    value={
                      <span className='flex items-center gap-2'>
                        {methodIcon}
                        {methodName}
                      </span>
                    }
                  />
                </div>
              </Card>
            </ModalBody>
            <ModalFooter className='border-t border-slate-200/80 dark:border-white/10'>
              <Button variant='ghost' onPress={handleCancel}>
                {t('取消')}
              </Button>
              <Button
                variant='primary'
                onPress={onlineTopUp}
                isPending={confirmLoading}
              >
                {t('确定')}
              </Button>
            </ModalFooter>
          </ModalDialog>
        </ModalContainer>
      </ModalBackdrop>
    </Modal>
  );
};

function InfoRow({ label, value }) {
  return (
    <div className='flex items-center justify-between gap-4 text-sm'>
      <span className='font-medium text-slate-700 dark:text-slate-200'>
        {label}
      </span>
      <span className='text-right text-slate-900 dark:text-slate-100'>
        {value}
      </span>
    </div>
  );
}

export default PaymentConfirmModal;
