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
import {
  Badge,
  Button,
  Card,
  Divider,
  Modal,
  Select,
  Skeleton,
  Space,
  Tag,
  Tooltip,
  Typography,
} from '@douyinfe/semi-ui';
import { API, showError, showSuccess, renderQuota } from '../../helpers';
import { getCurrencyConfig } from '../../helpers/render';
import {
  ArrowRight,
  CheckCircle2,
  Gauge,
  RefreshCw,
  Sparkles,
} from 'lucide-react';
import SubscriptionPurchaseModal from './modals/SubscriptionPurchaseModal';
import {
  formatSubscriptionDuration,
  formatSubscriptionResetPeriod,
} from '../../helpers/subscriptionFormat';

const { Text } = Typography;

// 过滤易支付方式
function getEpayMethods(payMethods = []) {
  return (payMethods || []).filter(
    (m) => m?.type && m.type !== 'stripe' && m.type !== 'creem',
  );
}

// 提交易支付表单
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
  showMySubscription = true,
  showPlansList = true,
  includeTax = false,
  setIncludeTax = () => {},
  taxRate = 0.06,
}) => {
  const [open, setOpen] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [paying, setPaying] = useState(false);
  const [selectedEpayMethod, setSelectedEpayMethod] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  const epayMethods = useMemo(() => getEpayMethods(payMethods), [payMethods]);
  const sortedPlans = useMemo(
    () =>
      [...(plans || [])].sort((a, b) => {
        const aRecommended = a?.plan?.is_recommended === true ? 1 : 0;
        const bRecommended = b?.plan?.is_recommended === true ? 1 : 0;
        if (aRecommended !== bRecommended) {
          return bRecommended - aRecommended;
        }

        const aPriority = Number(a?.plan?.sort_order || 0);
        const bPriority = Number(b?.plan?.sort_order || 0);
        if (aPriority !== bPriority) {
          return aPriority - bPriority;
        }

        return Number(a?.plan?.id || 0) - Number(b?.plan?.id || 0);
      }),
    [plans],
  );

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

  const cancelSubscription = (subId) => {
    Modal.confirm({
      title: t('确认作废订阅'),
      content: t('作废后订阅将立即失效，已使用额度不退还，确认继续？'),
      okType: 'danger',
      onOk: async () => {
        setCancelling(true);
        try {
          const res = await API.post(`/api/subscription/self/cancel/${subId}`);
          if (res.data?.success) {
            showSuccess(t('已作废'));
            await reloadSubscriptionSelf?.();
          } else {
            const errorMsg =
              typeof res.data?.data === 'string'
                ? res.data.data
                : res.data?.message || t('操作失败');
            showError(errorMsg);
          }
        } catch (e) {
          showError(t('请求失败'));
        } finally {
          setCancelling(false);
        }
      },
    });
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
        include_tax: includeTax,
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
        include_tax: includeTax,
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
        include_tax: includeTax,
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

  // 当前订阅信息 - 支持多个订阅
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

  // 计算单个订阅的剩余天数
  const getRemainingDays = (sub) => {
    if (!sub?.subscription?.end_time) return 0;
    const now = Date.now() / 1000;
    const remaining = sub.subscription.end_time - now;
    return Math.max(0, Math.ceil(remaining / 86400));
  };

  // 计算单个订阅的使用进度
  const getUsagePercent = (sub) => {
    const total = Number(sub?.subscription?.amount_total || 0);
    const used = Number(sub?.subscription?.amount_used || 0);
    if (total <= 0) return 0;
    return Math.round((used / total) * 100);
  };

  const cardContent = (
    <>
      {/* 卡片头部 */}
      {loading ? (
        <div className='space-y-4'>
          {/* 我的订阅骨架屏 */}
          {showMySubscription && (
            <Card
              className='!rounded-xl w-full'
              bodyStyle={{ padding: '12px' }}
            >
              <div className='flex items-center justify-between mb-3'>
                <Skeleton.Title active style={{ width: 100, height: 20 }} />
                <Skeleton.Button active style={{ width: 24, height: 24 }} />
              </div>
              <div className='space-y-2'>
                <Skeleton.Paragraph active rows={2} />
              </div>
            </Card>
          )}
          {/* 套餐列表骨架屏 */}
          {showPlansList && (
            <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-5 w-full px-1'>
              {[1, 2, 3].map((i) => (
                <Card
                  key={i}
                  className='!rounded-xl w-full h-full'
                  bodyStyle={{ padding: 16 }}
                >
                  <Skeleton.Title
                    active
                    style={{ width: '60%', height: 24, marginBottom: 8 }}
                  />
                  <Skeleton.Paragraph
                    active
                    rows={1}
                    style={{ marginBottom: 12 }}
                  />
                  <div className='text-center py-4'>
                    <Skeleton.Title
                      active
                      style={{ width: '40%', height: 32, margin: '0 auto' }}
                    />
                  </div>
                  <Skeleton.Paragraph
                    active
                    rows={3}
                    style={{ marginTop: 12 }}
                  />
                  <Skeleton.Button
                    active
                    block
                    style={{ marginTop: 16, height: 32 }}
                  />
                </Card>
              ))}
            </div>
          )}
        </div>
      ) : (
        <Space vertical style={{ width: '100%' }} spacing={8}>
          {/* 当前订阅状态 */}
          {showMySubscription && (
            <Card
              className='!rounded-xl w-full'
              bodyStyle={{ padding: '12px' }}
            >
              <div className='flex items-center justify-between mb-2 gap-3'>
                <div className='flex items-center gap-2 flex-1 min-w-0'>
                  <Text strong>{t('我的订阅')}</Text>
                  {hasActiveSubscription ? (
                    <Tag
                      color='white'
                      size='small'
                      shape='circle'
                      prefixIcon={<Badge dot type='success' />}
                    >
                      {activeSubscriptions.length} {t('个生效中')}
                    </Tag>
                  ) : (
                    <Tag color='white' size='small' shape='circle'>
                      {t('无生效')}
                    </Tag>
                  )}
                  {allSubscriptions.length > activeSubscriptions.length && (
                    <Tag color='white' size='small' shape='circle'>
                      {allSubscriptions.length - activeSubscriptions.length}{' '}
                      {t('个已过期')}
                    </Tag>
                  )}
                </div>
                <div className='flex items-center gap-2'>
                  <Select
                    value={displayBillingPreference}
                    onChange={onChangeBillingPreference}
                    size='small'
                    optionList={[
                      {
                        value: 'subscription_first',
                        label: disableSubscriptionPreference
                          ? `${t('优先订阅')} (${t('无生效')})`
                          : t('优先订阅'),
                        disabled: disableSubscriptionPreference,
                      },
                      { value: 'wallet_first', label: t('优先钱包') },
                      {
                        value: 'subscription_only',
                        label: disableSubscriptionPreference
                          ? `${t('仅用订阅')} (${t('无生效')})`
                          : t('仅用订阅'),
                        disabled: disableSubscriptionPreference,
                      },
                      { value: 'wallet_only', label: t('仅用钱包') },
                    ]}
                  />
                  <Button
                    size='small'
                    theme='light'
                    type='tertiary'
                    icon={
                      <RefreshCw
                        size={12}
                        className={refreshing ? 'animate-spin' : ''}
                      />
                    }
                    onClick={handleRefresh}
                    loading={refreshing}
                  />
                </div>
              </div>
              {disableSubscriptionPreference && isSubscriptionPreference && (
                <Text type='tertiary' size='small'>
                  {t('已保存偏好为')}
                  {subscriptionPreferenceLabel}
                  {t('，当前无生效订阅，将自动使用钱包')}
                </Text>
              )}

              {hasAnySubscription ? (
                <>
                  <Divider margin={8} />
                  <div className='max-h-64 overflow-y-auto pr-1 semi-table-body'>
                    {allSubscriptions
                      .filter((sub) => {
                        const subscription = sub.subscription;
                        const now = Date.now() / 1000;
                        const endTime = subscription?.end_time || 0;
                        const isExpired = endTime > 0 && endTime < now;
                        const isCancelled =
                          subscription?.status === 'cancelled';
                        return !(
                          (isExpired || isCancelled) &&
                          endTime > 0 &&
                          now - endTime > 7 * 86400
                        );
                      })
                      .map((sub, subIndex, visibleList) => {
                        const isLast = subIndex === visibleList.length - 1;
                        const subscription = sub.subscription;
                        const now = Date.now() / 1000;
                        const endTime = subscription?.end_time || 0;
                        const isExpired = endTime > 0 && endTime < now;
                        const isCancelled =
                          subscription?.status === 'cancelled';
                        const totalAmount = Number(
                          subscription?.amount_total || 0,
                        );
                        const usedAmount = Number(
                          subscription?.amount_used || 0,
                        );
                        const remainAmount =
                          totalAmount > 0
                            ? Math.max(0, totalAmount - usedAmount)
                            : 0;
                        const planTitle =
                          planTitleMap.get(subscription?.plan_id) || '';
                        const remainDays = getRemainingDays(sub);
                        const usagePercent = getUsagePercent(sub);
                        const isActive =
                          subscription?.status === 'active' && !isExpired;

                        return (
                          <div key={subscription?.id || subIndex}>
                            {/* 订阅概要 */}
                            <div className='flex items-center justify-between text-xs mb-2'>
                              <div className='flex items-center gap-2'>
                                <span className='font-medium'>
                                  {planTitle
                                    ? `${planTitle} · ${t('订阅')} #${subscription?.id}`
                                    : `${t('订阅')} #${subscription?.id}`}
                                </span>
                                {isActive ? (
                                  <Tag
                                    color='white'
                                    size='small'
                                    shape='circle'
                                    prefixIcon={<Badge dot type='success' />}
                                  >
                                    {t('生效')}
                                  </Tag>
                                ) : isCancelled ? (
                                  <Tag
                                    color='white'
                                    size='small'
                                    shape='circle'
                                  >
                                    {t('已作废')}
                                  </Tag>
                                ) : (
                                  <Tag
                                    color='white'
                                    size='small'
                                    shape='circle'
                                  >
                                    {t('已过期')}
                                  </Tag>
                                )}
                              </div>
                              {isActive && (
                                <div className='flex items-center gap-2'>
                                  <span className='text-gray-500'>
                                    {t('剩余')} {remainDays} {t('天')}
                                  </span>
                                  <Button
                                    size='small'
                                    type='danger'
                                    theme='solid'
                                    loading={cancelling}
                                    onClick={() =>
                                      cancelSubscription(subscription?.id)
                                    }
                                  >
                                    {t('作废')}
                                  </Button>
                                </div>
                              )}
                            </div>
                            <div className='text-xs text-gray-500 mb-2'>
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
                              <div className='text-xs text-gray-500 mb-2'>
                                {t('下一次重置')}:{' '}
                                {new Date(
                                  subscription.next_reset_time * 1000,
                                ).toLocaleString()}
                              </div>
                            )}
                            <div className='text-xs text-gray-500 mb-2'>
                              {t('本月总额度')}:{' '}
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
                            {!isLast && <Divider margin={12} />}
                          </div>
                        );
                      })}
                  </div>
                </>
              ) : (
                <div className='text-xs text-gray-500'>
                  {t('购买套餐后即可享受模型权益')}
                </div>
              )}
            </Card>
          )}

          {/* 可购买套餐 - 标准定价卡片 */}
          {showPlansList && (
            <>
              {sortedPlans.length > 0 ? (
                <div className='grid grid-cols-1 items-stretch gap-5 px-1 md:grid-cols-2 xl:grid-cols-3'>
                  {sortedPlans.map((p, index) => {
                    const plan = p?.plan;
                    const totalAmount = Number(plan?.total_amount || 0);
                    const { symbol, rate } = getCurrencyConfig();
                    const price = Number(plan?.price_amount || 0);
                    const taxMultiplier = includeTax ? 1 + taxRate : 1;
                    const baseConvertedPrice = price * rate;
                    const convertedPrice = baseConvertedPrice * taxMultiplier;
                    const baseDisplayPrice = baseConvertedPrice.toFixed(
                      Number.isInteger(baseConvertedPrice) ? 0 : 2,
                    );
                    const displayPrice = convertedPrice.toFixed(
                      Number.isInteger(convertedPrice) ? 0 : 2,
                    );
                    const isPopular = plan?.is_recommended === true;
                    const limit = Number(plan?.max_purchase_per_user || 0);
                    const limitLabel =
                      limit > 0 ? `${t('限购')} ${limit}` : null;
                    const upgradeLabel = plan?.upgrade_group
                      ? `${t('升级分组')}: ${plan.upgrade_group}`
                      : null;
                    const resetLabel =
                      formatSubscriptionResetPeriod(plan, t) === t('不重置')
                        ? null
                        : `${t('额度重置')}: ${formatSubscriptionResetPeriod(plan, t)}`;
                    const allowedGroups = String(plan?.allowed_groups || '')
                      .split(',')
                      .map((group) => group.trim())
                      .filter(Boolean);
                    const windowQuotaItems = [
                      {
                        key: '5h',
                        label: t('5小时'),
                        value: Number(plan?.window_limit_5h || 0),
                      },
                      {
                        key: '7d',
                        label: t('7日'),
                        value: Number(plan?.window_limit_7d || 0),
                      },
                      {
                        key: '30d',
                        label: t('30天'),
                        value: Number(plan?.window_limit_30d || 0),
                      },
                    ].filter((item) => item.value > 0);
                    const visibleQuotaItems =
                      windowQuotaItems.length > 0
                        ? windowQuotaItems
                        : [
                            {
                              key: 'total',
                              label: t('30天'),
                              value: totalAmount,
                            },
                          ];
                    const detailItems = [
                      {
                        label: t('有效期'),
                        value: formatSubscriptionDuration(plan, t),
                      },
                      resetLabel
                        ? {
                            label: t('重置'),
                            value: resetLabel.replace(`${t('额度重置')}: `, ''),
                          }
                        : null,
                      {
                        label: t('支持分组'),
                        value:
                          allowedGroups.length > 0 ? allowedGroups : t('不限'),
                      },
                      upgradeLabel
                        ? {
                            label: t('升级至分组'),
                            value: plan.upgrade_group,
                          }
                        : null,
                      limitLabel
                        ? {
                            label: t('购买'),
                            value: limitLabel.replace(`${t('限购')} `, ''),
                          }
                        : null,
                    ].filter(Boolean);

                    const accentPalettes = [
                      {
                        ink: '#1d4ed8',
                        soft: '#dbeafe',
                        tint: '#f7fbff',
                        ring: 'rgba(37, 99, 235, 0.18)',
                        glow: 'rgba(59, 130, 246, 0.20)',
                      },
                      {
                        ink: '#7c3aed',
                        soft: '#ede9fe',
                        tint: '#fbfaff',
                        ring: 'rgba(124, 58, 237, 0.18)',
                        glow: 'rgba(139, 92, 246, 0.22)',
                      },
                      {
                        ink: '#0f766e',
                        soft: '#ccfbf1',
                        tint: '#f6fffd',
                        ring: 'rgba(15, 118, 110, 0.16)',
                        glow: 'rgba(20, 184, 166, 0.18)',
                      },
                      {
                        ink: '#b45309',
                        soft: '#fef3c7',
                        tint: '#fffdf7',
                        ring: 'rgba(180, 83, 9, 0.16)',
                        glow: 'rgba(245, 158, 11, 0.18)',
                      },
                    ];
                    const accent = isPopular
                      ? {
                          ink: '#0f172a',
                          soft: '#f7e7bd',
                          tint: '#fffaf0',
                          ring: 'rgba(176, 141, 87, 0.34)',
                          glow: 'rgba(176, 141, 87, 0.22)',
                        }
                      : accentPalettes[index % accentPalettes.length];
                    const tagList = (plan?.tags || '')
                      .split(',')
                      .map((tag) => tag.trim())
                      .filter(Boolean);

                    return (
                      <Card
                        key={plan?.id}
                        className={`group relative h-full w-full overflow-hidden !rounded-[26px] border transition-all duration-300 hover:-translate-y-0.5 ${
                          isPopular
                            ? 'shadow-2xl shadow-slate-950/15'
                            : 'border-slate-200 bg-white shadow-sm hover:shadow-xl'
                        }`}
                        style={
                          isPopular
                            ? {
                                borderColor: '#111827',
                                background:
                                  'linear-gradient(145deg, #fffdf8 0%, #fbf2df 46%, #eef3f8 100%)',
                                boxShadow:
                                  '0 24px 70px rgba(15, 23, 42, 0.18), inset 0 1px 0 rgba(255, 255, 255, 0.86)',
                              }
                            : undefined
                        }
                        bodyStyle={{
                          padding: 0,
                          height: '100%',
                          width: '100%',
                        }}
                      >
                        {isPopular && (
                          <>
                            <div
                              className='pointer-events-none absolute inset-x-0 top-0 h-1.5'
                              style={{
                                background:
                                  'linear-gradient(90deg, #0f172a 0%, #b08d57 50%, #0f172a 100%)',
                              }}
                            />
                            <div
                              className='pointer-events-none absolute -right-20 -top-20 h-48 w-48 rounded-full blur-3xl'
                              style={{ background: accent.glow }}
                            />
                            <div className='pointer-events-none absolute bottom-0 right-0 h-28 w-28 rounded-tl-full bg-white/35' />
                          </>
                        )}
                        <div className='flex h-full w-full flex-col p-5 sm:p-6'>
                          <div className='mb-4 flex min-h-[30px] items-center justify-between gap-3'>
                            {isPopular ? (
                              <span className='inline-flex items-center gap-1.5 rounded-full bg-slate-950 px-3.5 py-1.5 text-xs font-bold text-amber-100 shadow-lg shadow-slate-950/15 ring-1 ring-amber-200/40'>
                                <Sparkles size={13} />
                                {t('推荐')}
                              </span>
                            ) : (
                              <span />
                            )}
                            <span className='rounded-full bg-slate-50 px-2.5 py-1 text-[11px] font-semibold tracking-[0.14em] text-slate-400 ring-1 ring-slate-200'>
                              #{plan?.id || '-'}
                            </span>
                          </div>

                          <div className='flex flex-1 flex-col'>
                            <div className='mb-5 flex items-start justify-between gap-4'>
                              <div className='min-w-0 flex-1'>
                                <div className='mb-2 flex flex-wrap items-center gap-2'>
                                  {limitLabel && (
                                    <span className='rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-500'>
                                      {limitLabel}
                                    </span>
                                  )}
                                </div>
                                <Typography.Title
                                  heading={5}
                                  className='line-clamp-2 !text-[19px] !font-black !leading-tight !tracking-[-0.03em] !text-slate-950'
                                  style={{ margin: 0 }}
                                >
                                  {plan?.title || t('订阅套餐')}
                                </Typography.Title>
                                {plan?.subtitle && (
                                  <Text
                                    type='tertiary'
                                    size='small'
                                    className='mt-1 line-clamp-2 leading-5'
                                    style={{ display: 'block' }}
                                  >
                                    {plan.subtitle}
                                  </Text>
                                )}
                                {tagList.length > 0 && (
                                  <div className='mt-3 flex flex-wrap gap-1.5'>
                                    {tagList.map((tag, idx) => (
                                      <span
                                        key={idx}
                                        className={`inline-flex max-w-full items-center rounded-full px-2.5 py-1 text-[11px] font-semibold leading-none ring-1 ${
                                          isPopular
                                            ? 'bg-white/70 text-slate-800 ring-amber-200/70'
                                            : 'bg-slate-50 text-slate-600 ring-slate-200'
                                        }`}
                                      >
                                        <span
                                          className='mr-1.5 h-1.5 w-1.5 shrink-0 rounded-full'
                                          style={{
                                            backgroundColor: accent.ink,
                                          }}
                                        />
                                        <span className='truncate'>{tag}</span>
                                      </span>
                                    ))}
                                  </div>
                                )}
                              </div>
                              <div
                                className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${
                                  isPopular
                                    ? 'bg-slate-950 text-amber-100 shadow-lg shadow-slate-950/15'
                                    : 'bg-slate-100 text-slate-700'
                                }`}
                                style={{
                                  border: `1px solid ${accent.ring}`,
                                }}
                              >
                                <Gauge size={18} />
                              </div>
                            </div>

                            <div className='mb-5'>
                              <div className='flex items-end gap-1'>
                                <span className='pb-1 text-2xl font-black leading-none text-slate-400'>
                                  {symbol}
                                </span>
                                <span className='text-6xl font-black leading-none tracking-[-0.08em] text-slate-950'>
                                  {baseDisplayPrice}
                                </span>
                                <span className='pb-2 text-sm font-semibold text-slate-400'>
                                  / {formatSubscriptionDuration(plan, t)}
                                </span>
                              </div>
                              {includeTax && taxRate > 0 && price > 0 && (
                                <div className='mt-3 inline-flex rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-100'>
                                  {t('含税应付')} {symbol}
                                  {displayPrice}
                                </div>
                              )}
                              <div className='mt-4 flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3'>
                                <span className='text-xs font-semibold uppercase tracking-[0.18em] text-slate-400'>
                                  {t('总额度')}
                                </span>
                                <span className='max-w-[52%] truncate text-sm font-black text-slate-950'>
                                  {totalAmount > 0
                                    ? renderQuota(totalAmount)
                                    : t('不限')}
                                </span>
                              </div>
                            </div>

                            <div
                              className='mb-4 grid overflow-hidden rounded-2xl border border-slate-200 bg-white'
                              style={{
                                gridTemplateColumns: `repeat(${visibleQuotaItems.length}, minmax(0, 1fr))`,
                              }}
                            >
                              {visibleQuotaItems.map((item, itemIndex) => (
                                <div
                                  key={item.key}
                                  className={`min-w-0 p-3 ${
                                    itemIndex > 0
                                      ? 'border-l border-slate-200'
                                      : ''
                                  }`}
                                >
                                  <div className='text-[11px] font-semibold text-slate-400'>
                                    {item.label}
                                  </div>
                                  <div className='mt-1 truncate text-sm font-black text-slate-950'>
                                    {item.value > 0
                                      ? renderQuota(item.value)
                                      : t('不限')}
                                  </div>
                                </div>
                              ))}
                            </div>

                            <div className='mb-5 space-y-2'>
                              {detailItems.map((item) => (
                                <div
                                  key={`${item.label}-${item.value}`}
                                  className='flex min-w-0 max-w-full items-center justify-between gap-3 text-sm'
                                >
                                  <span className='inline-flex items-center gap-2 text-slate-500'>
                                    <CheckCircle2
                                      size={14}
                                      className='shrink-0'
                                    />
                                    {item.label}
                                  </span>
                                  <span className='min-w-0 text-right font-semibold text-slate-900'>
                                    {Array.isArray(item.value) ? (
                                      <span className='flex flex-col items-end leading-5'>
                                        {item.value.map((value) => (
                                          <span key={value}>{value}</span>
                                        ))}
                                      </span>
                                    ) : (
                                      item.value
                                    )}
                                  </span>
                                </div>
                              ))}
                            </div>

                            <div className='mt-auto'>
                              {(() => {
                                const count = getPlanPurchaseCount(p?.plan?.id);
                                const reached = limit > 0 && count >= limit;
                                const tip = reached
                                  ? t('已达到购买上限') + ` (${count}/${limit})`
                                  : '';
                                const buttonEl = (
                                  <Button
                                    theme={reached ? 'outline' : 'solid'}
                                    type='primary'
                                    block
                                    disabled={reached}
                                    className='!h-10 !rounded-xl !font-semibold'
                                    style={
                                      reached
                                        ? undefined
                                        : {
                                            backgroundColor: accent.ink,
                                            borderColor: accent.ink,
                                          }
                                    }
                                    onClick={() => {
                                      if (!reached) openBuy(p);
                                    }}
                                  >
                                    <span className='inline-flex items-center justify-center gap-1.5'>
                                      {reached ? t('已达上限') : t('立即订阅')}
                                      {!reached && <ArrowRight size={15} />}
                                    </span>
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
                          </div>
                        </div>
                      </Card>
                    );
                  })}
                </div>
              ) : (
                <div className='text-center text-gray-400 text-sm py-4'>
                  {t('暂无可购买套餐')}
                </div>
              )}
            </>
          )}
        </Space>
      )}
    </>
  );

  return (
    <>
      {withCard ? (
        <Card className='!rounded-2xl shadow-sm border-0'>{cardContent}</Card>
      ) : (
        <div className='space-y-3 w-full'>{cardContent}</div>
      )}

      {/* 购买确认弹窗 */}
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
        includeTax={includeTax}
        setIncludeTax={setIncludeTax}
        taxRate={taxRate}
      />
    </>
  );
};

export default SubscriptionPlansCard;
