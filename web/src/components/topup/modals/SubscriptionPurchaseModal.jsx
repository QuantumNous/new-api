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
  Modal,
  Card,
  Button,
  Tooltip,
  ModalBackdrop,
  ModalBody,
  ModalContainer,
  ModalDialog,
  ModalHeader,
  useOverlayState,
} from '@heroui/react';
import { Crown, CalendarClock, Package, CreditCard } from 'lucide-react';
import { SiStripe } from 'react-icons/si';
import { renderQuota } from '../../../helpers';
import { getCurrencyConfig } from '../../../helpers/render';
import {
  formatSubscriptionDuration,
  formatSubscriptionResetPeriod,
} from '../../../helpers/subscriptionFormat';

const SubscriptionPurchaseModal = ({
  t,
  visible,
  onCancel,
  selectedPlan,
  paying,
  selectedEpayMethod,
  setSelectedEpayMethod,
  epayMethods = [],
  enableOnlineTopUp = false,
  enableStripeTopUp = false,
  enableCreemTopUp = false,
  purchaseLimitInfo = null,
  onPayStripe,
  onPayCreem,
  onPayEpay,
}) => {
  const plan = selectedPlan?.plan;
  const totalAmount = Number(plan?.total_amount || 0);
  const { symbol, rate } = getCurrencyConfig();
  const price = plan ? Number(plan.price_amount || 0) : 0;
  const convertedPrice = price * rate;
  const displayPrice = convertedPrice.toFixed(
    Number.isInteger(convertedPrice) ? 0 : 2,
  );
  // 只有当管理员开启支付网关 AND 套餐配置了对应的支付ID时才显示
  const hasStripe = enableStripeTopUp && !!plan?.stripe_price_id;
  const hasCreem = enableCreemTopUp && !!plan?.creem_product_id;
  const hasEpay = enableOnlineTopUp && epayMethods.length > 0;
  const hasAnyPayment = hasStripe || hasCreem || hasEpay;
  const purchaseLimit = Number(purchaseLimitInfo?.limit || 0);
  const purchaseCount = Number(purchaseLimitInfo?.count || 0);
  const purchaseLimitReached =
    purchaseLimit > 0 && purchaseCount >= purchaseLimit;
  const modalState = useOverlayState({
    isOpen: visible,
    onOpenChange: (isOpen) => {
      if (!isOpen) onCancel();
    },
  });

  return (
    <Modal state={modalState}>
      <ModalBackdrop variant='blur'>
        <ModalContainer size='lg' placement='center' scroll='inside'>
          <ModalDialog className='bg-white/95 backdrop-blur dark:bg-slate-950/95'>
            <ModalHeader className='border-b border-slate-200/80 dark:border-white/10'>
              <div className='flex items-center'>
                <Crown className='mr-2' size={18} />
                {t('购买订阅套餐')}
              </div>
            </ModalHeader>
            <ModalBody className='p-5'>
              {plan ? (
                <div className='space-y-4 pb-4'>
                  <Card className='rounded-2xl border border-slate-200 bg-slate-50/80 p-4 shadow-none dark:border-white/10 dark:bg-slate-900/70'>
                    <div className='space-y-3'>
                      <InfoRow label={`${t('套餐名称')}：`} value={plan.title} />
                      <InfoRow
                        label={`${t('有效期')}：`}
                        value={
                          <span className='flex items-center'>
                            <CalendarClock size={14} className='mr-1 text-slate-500' />
                            {formatSubscriptionDuration(plan, t)}
                          </span>
                        }
                      />
                      {formatSubscriptionResetPeriod(plan, t) !== t('不重置') && (
                        <InfoRow
                          label={`${t('重置周期')}：`}
                          value={formatSubscriptionResetPeriod(plan, t)}
                        />
                      )}
                      <InfoRow
                        label={`${t('总额度')}：`}
                        value={
                          <span className='flex items-center'>
                            <Package size={14} className='mr-1 text-slate-500' />
                            {totalAmount > 0 ? (
                              <Tooltip content={`${t('原生额度')}：${totalAmount}`}>
                                <span>{renderQuota(totalAmount)}</span>
                              </Tooltip>
                            ) : (
                              t('不限')
                            )}
                          </span>
                        }
                      />
                      {plan?.upgrade_group ? (
                        <InfoRow
                          label={`${t('升级分组')}：`}
                          value={plan.upgrade_group}
                        />
                      ) : null}
                      <div className='h-px bg-slate-200 dark:bg-white/10' />
                      <InfoRow
                        label={`${t('应付金额')}：`}
                        value={
                          <span className='text-xl font-bold text-sky-600 dark:text-sky-300'>
                            {symbol}
                            {displayPrice}
                          </span>
                        }
                      />
                    </div>
                  </Card>

                  {purchaseLimitReached && (
                    <NoticeBox tone='warning'>
                      {`${t('已达到购买上限')} (${purchaseCount}/${purchaseLimit})`}
                    </NoticeBox>
                  )}

                  {hasAnyPayment ? (
                    <div className='space-y-3'>
                      <div className='text-sm text-slate-500 dark:text-slate-400'>
                        {t('选择支付方式')}：
                      </div>

                      {(hasStripe || hasCreem) && (
                        <div className='flex gap-2'>
                          {hasStripe && (
                            <Button
                              variant='flat'
                              className='flex-1'
                              startContent={<SiStripe size={14} color='#635BFF' />}
                              onPress={onPayStripe}
                              isLoading={paying}
                              isDisabled={purchaseLimitReached}
                            >
                              Stripe
                            </Button>
                          )}
                          {hasCreem && (
                            <Button
                              variant='flat'
                              className='flex-1'
                              startContent={<CreditCard size={16} />}
                              onPress={onPayCreem}
                              isLoading={paying}
                              isDisabled={purchaseLimitReached}
                            >
                              Creem
                            </Button>
                          )}
                        </div>
                      )}

                      {hasEpay && (
                        <div className='flex gap-2'>
                          <select
                            value={selectedEpayMethod || ''}
                            onChange={(event) =>
                              setSelectedEpayMethod(event.target.value)
                            }
                            disabled={purchaseLimitReached}
                            className='h-10 min-w-0 flex-1 rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-sky-400 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900'
                          >
                            <option value=''>{t('选择支付方式')}</option>
                            {epayMethods.map((method) => (
                              <option key={method.type} value={method.type}>
                                {method.name || method.type}
                              </option>
                            ))}
                          </select>
                          <Button
                            color='primary'
                            onPress={onPayEpay}
                            isLoading={paying}
                            isDisabled={!selectedEpayMethod || purchaseLimitReached}
                          >
                            {t('支付')}
                          </Button>
                        </div>
                      )}
                    </div>
                  ) : (
                    <NoticeBox>
                      {t('管理员未开启在线支付功能，请联系管理员配置。')}
                    </NoticeBox>
                  )}
                </div>
              ) : null}
            </ModalBody>
          </ModalDialog>
        </ModalContainer>
      </ModalBackdrop>
    </Modal>
  );
};

const InfoRow = ({ label, value }) => (
  <div className='flex items-center justify-between gap-4'>
    <span className='shrink-0 text-sm font-semibold text-slate-700 dark:text-slate-200'>
      {label}
    </span>
    <span className='min-w-0 truncate text-right text-sm text-slate-900 dark:text-slate-100'>
      {value}
    </span>
  </div>
);

const NoticeBox = ({ children, tone = 'info' }) => (
  <div
    className={`rounded-2xl border px-4 py-3 text-sm ${
      tone === 'warning'
        ? 'border-warning/30 bg-warning/10 text-warning-700 dark:text-warning-200'
        : 'border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-500/30 dark:bg-sky-500/10 dark:text-sky-200'
    }`}
  >
    {children}
  </div>
);

export default SubscriptionPurchaseModal;
