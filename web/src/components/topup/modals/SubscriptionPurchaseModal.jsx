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
  Banner,
  Modal,
  Typography,
  Card,
  Button,
  Select,
  Tooltip,
} from '@douyinfe/semi-ui';
import { Crown, CalendarClock, Package } from 'lucide-react';
import { SiStripe } from 'react-icons/si';
import { IconCreditCard } from '@douyinfe/semi-icons';
import { renderQuota } from '../../../helpers';
import { getCurrencyConfig } from '../../../helpers/render';
import {
  formatSubscriptionDuration,
  formatSubscriptionResetPeriod,
  getSubscriptionWindowLimitItems,
} from '../../../helpers/subscriptionFormat';

const { Text } = Typography;

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
  includeTax = false,
  setIncludeTax = () => {},
  taxRate = 0.06,
}) => {
  const plan = selectedPlan?.plan;
  const totalAmount = Number(plan?.total_amount || 0);
  const { symbol, rate } = getCurrencyConfig();
  const price = plan ? Number(plan.price_amount || 0) : 0;
  const convertedPrice = price * rate;
  const taxMultiplier = includeTax ? 1 + taxRate : 1;
  const displayPrice = (convertedPrice * taxMultiplier).toFixed(
    Number.isInteger(convertedPrice * taxMultiplier) ? 0 : 2,
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
  const windowQuotas = getSubscriptionWindowLimitItems(plan, t, 'quota');

  return (
    <Modal
      title={
        <div className='flex items-center'>
          <Crown className='mr-2' size={18} />
          {t('购买订阅套餐')}
        </div>
      }
      visible={visible}
      onCancel={onCancel}
      footer={null}
      size='medium'
      centered
      className='subscription-purchase-modal'
      bodyStyle={{ padding: 0 }}
    >
      {plan ? (
        <div
          className='overflow-hidden rounded-3xl'
          style={{
            background:
              'radial-gradient(circle at 12% 0%, rgba(14, 165, 233, 0.14), transparent 35%), var(--console-card-gradient-soft)',
          }}
        >
          <div className='px-6 pb-6 pt-5'>
            <div className='subscription-purchase-section subscription-purchase-summary mb-4 p-5'>
              <div className='text-xs font-bold uppercase tracking-[0.18em]'>
                {t('订阅套餐')}
              </div>
              <div className='mt-2 flex items-end justify-between gap-4'>
                <div className='min-w-0'>
                  <div className='truncate text-2xl font-black tracking-tight'>
                    {plan.title}
                  </div>
                  <div className='mt-2 flex items-center gap-2 text-sm'>
                    <CalendarClock size={15} />
                    {formatSubscriptionDuration(plan, t)}
                  </div>
                </div>
                <div className='text-right'>
                  <div className='text-xs'>{t('应付金额')}</div>
                  <div className='text-3xl font-black'>
                    {symbol}
                    {displayPrice}
                  </div>
                </div>
              </div>
            </div>

            {/* 套餐信息 */}
            <Card className='subscription-purchase-section !border-0'>
              <div className='space-y-3'>
                <div className='flex justify-between items-center'>
                  <Text strong className='text-slate-700 dark:text-slate-200'>
                    {t('套餐名称')}：
                  </Text>
                  <Typography.Text
                    className='text-slate-900 dark:text-slate-100'
                    style={{ wordBreak: 'break-all' }}
                  >
                    {plan.title}
                  </Typography.Text>
                </div>
                <div className='flex justify-between items-center'>
                  <Text strong className='text-slate-700 dark:text-slate-200'>
                    {t('有效期')}：
                  </Text>
                  <div className='flex items-center'>
                    <CalendarClock size={14} className='mr-1 text-slate-500' />
                    <Text className='text-slate-900 dark:text-slate-100'>
                      {formatSubscriptionDuration(plan, t)}
                    </Text>
                  </div>
                </div>
                {formatSubscriptionResetPeriod(plan, t) !== t('不重置') && (
                  <div className='flex justify-between items-center'>
                    <Text strong className='text-slate-700 dark:text-slate-200'>
                      {t('重置周期')}：
                    </Text>
                    <Text className='text-slate-900 dark:text-slate-100'>
                      {formatSubscriptionResetPeriod(plan, t)}
                    </Text>
                  </div>
                )}
                {windowQuotas.map((item) => (
                  <div
                    key={item.label}
                    className='flex justify-between items-center'
                  >
                    <Text strong className='text-slate-700 dark:text-slate-200'>
                      {item.label}：
                    </Text>
                    <Tooltip content={`${t('原生额度')}：${item.value}`}>
                      <Text className='text-slate-900 dark:text-slate-100'>
                        {renderQuota(item.value)}
                      </Text>
                    </Tooltip>
                  </div>
                ))}
                <div className='flex justify-between items-center'>
                  <Text strong className='text-slate-700 dark:text-slate-200'>
                    {t('重置周期额度')}：
                  </Text>
                  <div className='flex items-center'>
                    <Package size={14} className='mr-1 text-slate-500' />
                    {totalAmount > 0 ? (
                      <Text className='text-slate-900 dark:text-slate-100'>
                        {renderQuota(totalAmount)}
                      </Text>
                    ) : (
                      <Text className='text-slate-900 dark:text-slate-100'>
                        {t('不限')}
                      </Text>
                    )}
                  </div>
                </div>
                {plan?.upgrade_group ? (
                  <div className='flex justify-between items-center'>
                    <Text strong className='text-slate-700 dark:text-slate-200'>
                      {t('升级分组')}：
                    </Text>
                    <Text className='text-slate-900 dark:text-slate-100'>
                      {plan.upgrade_group}
                    </Text>
                  </div>
                ) : null}
                {plan?.allowed_groups ? (
                  <div className='flex justify-between items-center'>
                    <Text strong className='text-slate-700 dark:text-slate-200'>
                      {t('限制分组')}：
                    </Text>
                    <Text className='text-slate-900 dark:text-slate-100'>
                      {typeof plan.allowed_groups === 'string'
                        ? plan.allowed_groups
                        : Array.isArray(plan.allowed_groups)
                          ? plan.allowed_groups.join(', ')
                          : String(plan.allowed_groups)}
                    </Text>
                  </div>
                ) : null}
              </div>
            </Card>

            {/* 税费类型 */}
            <div className='subscription-purchase-section mt-4 px-4 py-3'>
              <div className='flex items-center justify-between'>
                <Text strong size='small'>
                  {t('税费类型')}
                </Text>
                <div
                  className='grid grid-cols-2 gap-1.5 rounded-2xl bg-white p-1.5 shadow-sm dark:bg-slate-800'
                  style={{ border: '1px solid var(--console-border-strong)' }}
                >
                  {[
                    { value: false, label: t('不含税') },
                    { value: true, label: t('含税') },
                  ].map((opt) => {
                    const active = includeTax === opt.value;
                    return (
                      <div
                        key={String(opt.value)}
                        className='min-w-[92px] cursor-pointer select-none rounded-xl px-4 py-2.5 text-center text-sm font-bold transition-all duration-200'
                        style={{
                          background: active ? '#0f766e' : 'transparent',
                          color: active ? '#fff' : 'var(--console-text-muted)',
                          boxShadow: active
                            ? '0 8px 20px rgba(15, 118, 110, 0.22)'
                            : 'none',
                        }}
                        onClick={() => setIncludeTax(opt.value)}
                        onMouseEnter={(event) => {
                          if (!active) {
                            event.currentTarget.style.backgroundColor =
                              'rgba(20, 184, 166, 0.12)';
                            event.currentTarget.style.color =
                              'var(--semi-color-success)';
                          }
                        }}
                        onMouseLeave={(event) => {
                          if (!active) {
                            event.currentTarget.style.backgroundColor =
                              'transparent';
                            event.currentTarget.style.color =
                              'var(--console-text-muted)';
                          }
                        }}
                      >
                        {opt.label}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* 支付方式 */}
            {purchaseLimitReached && (
              <Banner
                type='warning'
                description={`${t('已达到购买上限')} (${purchaseCount}/${purchaseLimit})`}
                className='!rounded-xl'
                closeIcon={null}
              />
            )}

            {hasAnyPayment ? (
              <div className='subscription-purchase-section mt-4 space-y-3 p-4'>
                <Text
                  size='small'
                  type='tertiary'
                  style={{ display: 'block', fontWeight: 700 }}
                >
                  {t('选择支付方式')}
                </Text>

                {/* Stripe / Creem */}
                {(hasStripe || hasCreem) && (
                  <div className='flex gap-2'>
                    {hasStripe && (
                      <Button
                        theme='light'
                        className='flex-1 !h-11 !rounded-2xl'
                        icon={<SiStripe size={14} color='#635BFF' />}
                        onClick={onPayStripe}
                        loading={paying}
                        disabled={purchaseLimitReached}
                      >
                        Stripe
                      </Button>
                    )}
                    {hasCreem && (
                      <Button
                        theme='light'
                        className='flex-1 !h-11 !rounded-2xl'
                        icon={<IconCreditCard />}
                        onClick={onPayCreem}
                        loading={paying}
                        disabled={purchaseLimitReached}
                      >
                        Creem
                      </Button>
                    )}
                  </div>
                )}

                {/* 易支付 */}
                {hasEpay && (
                  <div className='flex flex-col gap-3 sm:flex-row sm:items-center'>
                    <Select
                      value={selectedEpayMethod}
                      onChange={setSelectedEpayMethod}
                      className='subscription-purchase-pay-select'
                      style={{ flex: 1 }}
                      size='default'
                      placeholder={t('选择支付方式')}
                      optionList={epayMethods.map((m) => ({
                        value: m.type,
                        label: m.name || m.type,
                      }))}
                      disabled={purchaseLimitReached}
                    />
                    <Button
                      theme='solid'
                      type='primary'
                      className='subscription-purchase-pay-button !font-semibold'
                      style={{
                        background: '#0f766e',
                        borderColor: '#0f766e',
                      }}
                      onClick={onPayEpay}
                      loading={paying}
                      disabled={!selectedEpayMethod || purchaseLimitReached}
                    >
                      {t('支付')}
                    </Button>
                  </div>
                )}
              </div>
            ) : (
              <Banner
                type='info'
                description={t('管理员未开启在线支付功能，请联系管理员配置。')}
                className='!rounded-xl'
                closeIcon={null}
              />
            )}
          </div>
        </div>
      ) : null}
    </Modal>
  );
};

export default SubscriptionPurchaseModal;
