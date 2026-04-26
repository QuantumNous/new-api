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

import React, { useMemo, useState } from 'react';
import { Badge, Button, Card, Chip, Separator, Tooltip } from '@heroui/react';
import { API, showError, showSuccess, renderQuota } from '../../helpers';
import { getCurrencyConfig } from '../../helpers/render';
import { RefreshCw, Sparkles } from 'lucide-react';
import SubscriptionPurchaseModal from './modals/SubscriptionPurchaseModal';
import {
  formatSubscriptionDuration,
  formatSubscriptionResetPeriod,
} from '../../helpers/subscriptionFormat';

// Filter EPay methods.
function getEpayMethods(payMethods = []) {
  return (payMethods || []).filter(
    (m) => m?.type && m.type !== 'stripe' && m.type !== 'creem',
  );
}

// Submit EPay form.
function submitEpayForm({ url, params }) {
  const form = document.createElement('form');
  form.action = url;
  form.method = 'POST';
  const isSafari =
    navigator.userAgent.indexOf('Safari') > -1 &&
    navigator.userAgent.indexOf('Chrome') < 1;
  if (!isSafari) form.target = '_blank';
  Object.keys(params || {}).forEach((key) => {
    const input = document.createElement('input');
    input.type = 'hidden';
    input.name = key;
    input.value = params[key];
    form.appendChild(input);
  });
  document.body.appendChild(form);
  form.submit();
  document.body.removeChild(form);
}

const SubscriptionPlansCard = ({
  t,
  loading = false,
  plans = [],
  payMethods = [],
  enableOnlineTopUp = false,
  enableStripeTopUp = false,
  enableCreemTopUp = false,
  billingPreference,
  onChangeBillingPreference,
  activeSubscriptions = [],
  allSubscriptions = [],
  reloadSubscriptionSelf,
  withCard = true,
}) => {
  const [open, setOpen] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [paying, setPaying] = useState(false);
  const [selectedEpayMethod, setSelectedEpayMethod] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const epayMethods = useMemo(() => getEpayMethods(payMethods), [payMethods]);

  const openBuy = (p) => {
    setSelectedPlan(p);
    setSelectedEpayMethod(epayMethods?.[0]?.type || '');
    setOpen(true);
  };

  const closeBuy = () => {
    setOpen(false);
    setSelectedPlan(null);
    setPaying(false);
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await reloadSubscriptionSelf?.();
    } finally {
      setRefreshing(false);
    }
  };

  const payStripe = async () => {
    if (!selectedPlan?.plan?.stripe_price_id) {
      showError(t('该套餐未配置 Stripe'));
      return;
    }
    setPaying(true);
    try {
      const res = await API.post('/api/subscription/stripe/pay', {
        plan_id: selectedPlan.plan.id,
      });
      if (res.data?.message === 'success') {
        window.open(res.data.data?.pay_link, '_blank');
        showSuccess(t('已打开支付页面'));
        closeBuy();
      } else {
        const errorMsg =
          typeof res.data?.data === 'string'
            ? res.data.data
            : res.data?.message || t('支付失败');
        showError(errorMsg);
      }
    } catch (e) {
      showError(t('支付请求失败'));
    } finally {
      setPaying(false);
    }
  };

  const payCreem = async () => {
    if (!selectedPlan?.plan?.creem_product_id) {
      showError(t('该套餐未配置 Creem'));
      return;
    }
    setPaying(true);
    try {
      const res = await API.post('/api/subscription/creem/pay', {
        plan_id: selectedPlan.plan.id,
      });
      if (res.data?.message === 'success') {
        window.open(res.data.data?.checkout_url, '_blank');
        showSuccess(t('已打开支付页面'));
        closeBuy();
      } else {
        const errorMsg =
          typeof res.data?.data === 'string'
            ? res.data.data
            : res.data?.message || t('支付失败');
        showError(errorMsg);
      }
    } catch (e) {
      showError(t('支付请求失败'));
    } finally {
      setPaying(false);
    }
  };

  const payEpay = async () => {
    if (!selectedEpayMethod) {
      showError(t('请选择支付方式'));
      return;
    }
    setPaying(true);
    try {
      const res = await API.post('/api/subscription/epay/pay', {
        plan_id: selectedPlan.plan.id,
        payment_method: selectedEpayMethod,
      });
      if (res.data?.message === 'success') {
        submitEpayForm({ url: res.data.url, params: res.data.data });
        showSuccess(t('已发起支付'));
        closeBuy();
      } else {
        const errorMsg =
          typeof res.data?.data === 'string'
            ? res.data.data
            : res.data?.message || t('支付失败');
        showError(errorMsg);
      }
    } catch (e) {
      showError(t('支付请求失败'));
    } finally {
      setPaying(false);
    }
  };

  const SkeletonLine = ({ className = '' }) => (
    <div className={`animate-pulse rounded bg-surface-secondary ${className}`} />
  );

  const StatusChip = ({ children, tone = 'default', dot = false }) => {
    const colorMap = {
      default: 'default',
      success: 'success',
      purple: 'secondary',
    };

    return (
      <Chip size='sm' color={colorMap[tone] || 'default'} variant='secondary'>
        {dot ? <Badge dot type='success' className='mr-1' /> : null}
        {children}
      </Chip>
    );
  };

  const SectionSeparator = ({ className = '' }) => (
    <Separator className={`my-3 ${className}`} />
  );

  // Current subscription info, supports multiple subscriptions.
  const hasActiveSubscription = activeSubscriptions.length > 0;
  const hasAnySubscription = allSubscriptions.length > 0;
  const disableSubscriptionPreference = !hasActiveSubscription;
  const isSubscriptionPreference =
    billingPreference === 'subscription_first' ||
    billingPreference === 'subscription_only';
  const displayBillingPreference =
    disableSubscriptionPreference && isSubscriptionPreference
      ? 'wallet_first'
      : billingPreference;
  const subscriptionPreferenceLabel =
    billingPreference === 'subscription_only' ? t('仅用订阅') : t('优先订阅');

  const planPurchaseCountMap = useMemo(() => {
    const map = new Map();
    (allSubscriptions || []).forEach((sub) => {
      const planId = sub?.subscription?.plan_id;
      if (!planId) return;
      map.set(planId, (map.get(planId) || 0) + 1);
    });
    return map;
  }, [allSubscriptions]);

  const planTitleMap = useMemo(() => {
    const map = new Map();
    (plans || []).forEach((p) => {
      const plan = p?.plan;
      if (!plan?.id) return;
      map.set(plan.id, plan.title || '');
    });
    return map;
  }, [plans]);

  const getPlanPurchaseCount = (planId) =>
    planPurchaseCountMap.get(planId) || 0;

  // Calculate remaining days for one subscription.
  const getRemainingDays = (sub) => {
    if (!sub?.subscription?.end_time) return 0;
    const now = Date.now() / 1000;
    const remaining = sub.subscription.end_time - now;
    return Math.max(0, Math.ceil(remaining / 86400));
  };

  // Calculate usage progress for one subscription.
  const getUsagePercent = (sub) => {
    const total = Number(sub?.subscription?.amount_total || 0);
    const used = Number(sub?.subscription?.amount_used || 0);
    if (total <= 0) return 0;
    return Math.round((used / total) * 100);
  };

  const cardContent = (
    <>
      {/* Card content */}
      {loading ? (
        <div className='space-y-4'>
          {/* My subscription skeleton */}
          <Card className='!rounded-xl w-full'>
            <Card.Content className='p-3'>
            <div className='flex items-center justify-between mb-3'>
              <SkeletonLine className='h-5 w-24' />
              <SkeletonLine className='h-6 w-6 rounded-full' />
            </div>
            <div className='space-y-2'>
              <SkeletonLine className='h-4 w-full' />
              <SkeletonLine className='h-4 w-2/3' />
            </div>
            </Card.Content>
          </Card>
          {/* Plan list skeleton */}
          <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-5 w-full px-1'>
            {[1, 2, 3].map((i) => (
              <Card key={i} className='!rounded-xl w-full h-full'>
                <Card.Content className='p-4'>
                <SkeletonLine className='mb-2 h-6 w-3/5' />
                <SkeletonLine className='mb-3 h-4 w-4/5' />
                <div className='text-center py-4'>
                  <SkeletonLine className='mx-auto h-8 w-2/5' />
                </div>
                <div className='mt-3 space-y-2'>
                  <SkeletonLine className='h-4 w-full' />
                  <SkeletonLine className='h-4 w-4/5' />
                  <SkeletonLine className='h-4 w-2/3' />
                </div>
                <SkeletonLine className='mt-4 h-8 w-full' />
                </Card.Content>
              </Card>
            ))}
          </div>
        </div>
      ) : (
        <div className='flex w-full flex-col gap-2'>
          {/* Current subscription status */}
          <Card className='!rounded-xl w-full'>
            <Card.Content className='p-3'>
            <div className='flex items-center justify-between mb-2 gap-3'>
              <div className='flex items-center gap-2 flex-1 min-w-0'>
                <span className='font-semibold text-foreground'>
                  {t('我的订阅')}
                </span>
                {hasActiveSubscription ? (
                  <StatusChip tone='success' dot>
                    {activeSubscriptions.length} {t('个生效中')}
                  </StatusChip>
                ) : (
                  <StatusChip>{t('无生效')}</StatusChip>
                )}
                {allSubscriptions.length > activeSubscriptions.length && (
                  <StatusChip>
                    {allSubscriptions.length - activeSubscriptions.length}{' '}
                    {t('个已过期')}
                  </StatusChip>
                )}
              </div>
              <div className='flex items-center gap-2'>
                <select
                  value={displayBillingPreference}
                  onChange={(event) =>
                    onChangeBillingPreference?.(event.target.value)
                  }
                  className='h-8 rounded-lg border border-border bg-background px-2 text-xs text-foreground outline-none transition focus:border-accent'
                >
                  <option
                    value='subscription_first'
                    disabled={disableSubscriptionPreference}
                  >
                    {disableSubscriptionPreference
                      ? `${t('优先订阅')} (${t('无生效')})`
                      : t('优先订阅')}
                  </option>
                  <option value='wallet_first'>{t('优先钱包')}</option>
                  <option
                    value='subscription_only'
                    disabled={disableSubscriptionPreference}
                  >
                    {disableSubscriptionPreference
                      ? `${t('仅用订阅')} (${t('无生效')})`
                      : t('仅用订阅')}
                  </option>
                  <option value='wallet_only'>{t('仅用钱包')}</option>
                </select>
                <Button
                  isIconOnly
                  size='sm'
                  variant='ghost'
                  onPress={handleRefresh}
                  isPending={refreshing}
                  aria-label={t('刷新')}
                >
                  <RefreshCw
                    size={12}
                    className={refreshing ? 'animate-spin' : ''}
                  />
                </Button>
              </div>
            </div>
            {disableSubscriptionPreference && isSubscriptionPreference && (
              <span className='text-sm text-muted'>
                {t('已保存偏好为')}
                {subscriptionPreferenceLabel}
                {t('，当前无生效订阅，将自动使用钱包')}
              </span>
            )}

            {hasAnySubscription ? (
              <>
                <SectionSeparator className='my-2' />
                <div className='max-h-64 overflow-y-auto pr-1 semi-table-body'>
                  {allSubscriptions.map((sub, subIndex) => {
                    const isLast = subIndex === allSubscriptions.length - 1;
                    const subscription = sub.subscription;
                    const totalAmount = Number(subscription?.amount_total || 0);
                    const usedAmount = Number(subscription?.amount_used || 0);
                    const remainAmount =
                      totalAmount > 0
                        ? Math.max(0, totalAmount - usedAmount)
                        : 0;
                    const planTitle =
                      planTitleMap.get(subscription?.plan_id) || '';
                    const remainDays = getRemainingDays(sub);
                    const usagePercent = getUsagePercent(sub);
                    const now = Date.now() / 1000;
                    const isExpired = (subscription?.end_time || 0) < now;
                    const isCancelled = subscription?.status === 'cancelled';
                    const isActive =
                      subscription?.status === 'active' && !isExpired;

                    return (
                      <div key={subscription?.id || subIndex}>
                        {/* Subscription summary */}
                        <div className='flex items-center justify-between text-xs mb-2'>
                          <div className='flex items-center gap-2'>
                            <span className='font-medium'>
                              {planTitle
                                ? `${planTitle} · ${t('订阅')} #${subscription?.id}`
                                : `${t('订阅')} #${subscription?.id}`}
                            </span>
                            {isActive ? (
                              <StatusChip tone='success' dot>
                                {t('生效')}
                              </StatusChip>
                            ) : isCancelled ? (
                              <StatusChip>{t('已作废')}</StatusChip>
                            ) : (
                              <StatusChip>{t('已过期')}</StatusChip>
                            )}
                          </div>
                          {isActive && (
                            <span className='text-muted'>
                              {t('剩余')} {remainDays} {t('天')}
                            </span>
                          )}
                        </div>
                        <div className='text-xs text-muted mb-2'>
                          {isActive
                            ? t('至')
                            : isCancelled
                              ? t('作废于')
                              : t('过期于')}{' '}
                          {new Date(
                            (subscription?.end_time || 0) * 1000,
                          ).toLocaleString()}
                        </div>
                        {isActive && subscription?.next_reset_time > 0 && (
                          <div className='text-xs text-muted mb-2'>
                            {t('下一次重置')}:{' '}
                            {new Date(
                              subscription.next_reset_time * 1000,
                            ).toLocaleString()}
                          </div>
                        )}
                        <div className='text-xs text-muted mb-2'>
                          {t('总额度')}:{' '}
                          {totalAmount > 0 ? (
                            <Tooltip
                              content={`${t('原生额度')}：${usedAmount}/${totalAmount} · ${t('剩余')} ${remainAmount}`}
                            >
                              <span>
                                {renderQuota(usedAmount)}/
                                {renderQuota(totalAmount)} · {t('剩余')}{' '}
                                {renderQuota(remainAmount)}
                              </span>
                            </Tooltip>
                          ) : (
                            t('不限')
                          )}
                          {totalAmount > 0 && (
                            <span className='ml-2'>
                              {t('已用')} {usagePercent}%
                            </span>
                          )}
                        </div>
                        {!isLast && <SectionSeparator />}
                      </div>
                    );
                  })}
                </div>
              </>
            ) : (
              <div className='text-xs text-muted'>
                {t('购买套餐后即可享受模型权益')}
              </div>
            )}
            </Card.Content>
          </Card>

          {/* Purchasable plans */}
          {plans.length > 0 ? (
            <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-5 w-full px-1'>
              {plans.map((p, index) => {
                const plan = p?.plan;
                const totalAmount = Number(plan?.total_amount || 0);
                const { symbol, rate } = getCurrencyConfig();
                const price = Number(plan?.price_amount || 0);
                const convertedPrice = price * rate;
                const displayPrice = convertedPrice.toFixed(
                  Number.isInteger(convertedPrice) ? 0 : 2,
                );
                const isPopular = index === 0 && plans.length > 1;
                const limit = Number(plan?.max_purchase_per_user || 0);
                const limitLabel = limit > 0 ? `${t('限购')} ${limit}` : null;
                const totalLabel =
                  totalAmount > 0
                    ? `${t('总额度')}: ${renderQuota(totalAmount)}`
                    : `${t('总额度')}: ${t('不限')}`;
                const upgradeLabel = plan?.upgrade_group
                  ? `${t('升级分组')}: ${plan.upgrade_group}`
                  : null;
                const resetLabel =
                  formatSubscriptionResetPeriod(plan, t) === t('不重置')
                    ? null
                    : `${t('额度重置')}: ${formatSubscriptionResetPeriod(plan, t)}`;
                const planBenefits = [
                  {
                    label: `${t('有效期')}: ${formatSubscriptionDuration(plan, t)}`,
                  },
                  resetLabel ? { label: resetLabel } : null,
                  totalAmount > 0
                    ? {
                        label: totalLabel,
                        tooltip: `${t('原生额度')}：${totalAmount}`,
                      }
                    : { label: totalLabel },
                  limitLabel ? { label: limitLabel } : null,
                  upgradeLabel ? { label: upgradeLabel } : null,
                ].filter(Boolean);

                return (
                  <Card
                    key={plan?.id}
                    className={`!rounded-xl transition-all hover:shadow-lg w-full h-full ${
                      isPopular ? 'ring-2 ring-purple-500' : ''
                    }`}
                  >
                    <Card.Content className='p-4 h-full flex flex-col'>
                      {/* Recommended label */}
                      {isPopular && (
                        <div className='mb-2'>
                          <StatusChip tone='purple'>
                            <Sparkles size={10} className='mr-1' />
                            {t('推荐')}
                          </StatusChip>
                        </div>
                      )}
                      {/* Plan name */}
                      <div className='mb-3'>
                        <h5 className='m-0 truncate text-xl font-semibold text-foreground'>
                          {plan?.title || t('订阅套餐')}
                        </h5>
                        {plan?.subtitle && (
                          <span className='block truncate text-sm text-muted'>
                            {plan.subtitle}
                          </span>
                        )}
                      </div>

                      {/* Price */}
                      <div className='py-2'>
                        <div className='flex items-baseline justify-start'>
                          <span className='text-xl font-bold text-purple-600'>
                            {symbol}
                          </span>
                          <span className='text-3xl font-bold text-purple-600'>
                            {displayPrice}
                          </span>
                        </div>
                      </div>

                      {/* Plan benefits */}
                      <div className='flex flex-col items-start gap-1 pb-2'>
                        {planBenefits.map((item) => {
                          const content = (
                            <div className='flex items-center gap-2 text-xs text-muted'>
                              <Badge dot type='tertiary' />
                              <span>{item.label}</span>
                            </div>
                          );
                          if (!item.tooltip) {
                            return (
                              <div
                                key={item.label}
                                className='w-full flex justify-start'
                              >
                                {content}
                              </div>
                            );
                          }
                          return (
                            <Tooltip key={item.label} content={item.tooltip}>
                              <div className='w-full flex justify-start'>
                                {content}
                              </div>
                            </Tooltip>
                          );
                        })}
                      </div>

                      <div className='mt-auto'>
                        <SectionSeparator />

                        {/* Purchase button */}
                        {(() => {
                          const count = getPlanPurchaseCount(p?.plan?.id);
                          const reached = limit > 0 && count >= limit;
                          const tip = reached
                            ? t('已达到购买上限') + ` (${count}/${limit})`
                            : '';
                          const buttonEl = (
                            <Button
                              variant='outline'
                              fullWidth
                              isDisabled={reached}
                              onPress={() => {
                                if (!reached) openBuy(p);
                              }}
                            >
                              {reached ? t('已达上限') : t('立即订阅')}
                            </Button>
                          );
                          return reached ? (
                            <Tooltip content={tip} position='top'>
                              {buttonEl}
                            </Tooltip>
                          ) : (
                            buttonEl
                          );
                        })()}
                      </div>
                    </Card.Content>
                  </Card>
                );
              })}
            </div>
          ) : (
            <div className='text-center text-muted text-sm py-4'>
              {t('暂无可购买套餐')}
            </div>
          )}
        </div>
      )}
    </>
  );

  return (
    <>
      {withCard ? (
        <Card className='!rounded-2xl shadow-sm border-0'>{cardContent}</Card>
      ) : (
        <div className='space-y-3'>{cardContent}</div>
      )}

      {/* Purchase confirmation modal */}
      <SubscriptionPurchaseModal
        t={t}
        visible={open}
        onCancel={closeBuy}
        selectedPlan={selectedPlan}
        paying={paying}
        selectedEpayMethod={selectedEpayMethod}
        setSelectedEpayMethod={setSelectedEpayMethod}
        epayMethods={epayMethods}
        enableOnlineTopUp={enableOnlineTopUp}
        enableStripeTopUp={enableStripeTopUp}
        enableCreemTopUp={enableCreemTopUp}
        purchaseLimitInfo={
          selectedPlan?.plan?.id
            ? {
                limit: Number(selectedPlan?.plan?.max_purchase_per_user || 0),
                count: getPlanPurchaseCount(selectedPlan?.plan?.id),
              }
            : null
        }
        onPayStripe={payStripe}
        onPayCreem={payCreem}
        onPayEpay={payEpay}
      />
    </>
  );
};

export default SubscriptionPlansCard;
