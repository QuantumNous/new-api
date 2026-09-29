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
import { RefreshCw, Sparkles } from 'lucide-react';
import SubscriptionPurchaseModal from './modals/SubscriptionPurchaseModal';
import {
  formatSubscriptionDuration,
  formatSubscriptionResetPeriod,
} from '../../helpers/subscriptionFormat';
import { getSubscriptionStatus } from '../../helpers/subscriptionDisplay';
import { useSubscriptionDisplay } from '../../hooks/subscriptions/useSubscriptionDisplay';
import SubscriptionList from './SubscriptionList';

const { Text } = Typography;
const EMPTY_SUBSCRIPTIONS = [];

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
  allSubscriptions = EMPTY_SUBSCRIPTIONS,
  reloadSubscriptionSelf,
  walletQuota = 0,
  quotaPerUnit = 0,
  reloadUserQuota,
  maxPurchaseQuantity,
  withCard = true,
  hideSubscriptions = false,
  hidePlans = false,
}) => {
  const [open, setOpen] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [paying, setPaying] = useState(false);
  const [selectedEpayMethod, setSelectedEpayMethod] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [walletPayingPlanId, setWalletPayingPlanId] = useState(null);
  const [purchaseMode, setPurchaseMode] = useState('concurrent');
  const [purchaseQuantity, setPurchaseQuantity] = useState(1);

  const epayMethods = useMemo(() => getEpayMethods(payMethods), [payMethods]);

  const openBuy = (p) => {
    setSelectedPlan(p);
    setSelectedEpayMethod(epayMethods?.[0]?.type || '');
    setPurchaseMode('concurrent');
    setPurchaseQuantity(1);
    setOpen(true);
  };

  const closeBuy = () => {
    setOpen(false);
    setSelectedPlan(null);
    setPaying(false);
    setPurchaseMode('concurrent');
    setPurchaseQuantity(1);
  };

  const hasActiveSamePlan = (planId) => {
    if (!planId) return false;
    const now = Date.now() / 1000;
    return (activeSubscriptions || []).some((sub) => {
      const subscription = sub?.subscription;
      return (
        subscription?.plan_id === planId &&
        subscription?.status === 'active' &&
        (subscription?.end_time || 0) > now
      );
    });
  };
  // 数量上限：管理员配置 与 剩余可购份数 取小，防止超限/超付
  const getMaxQuantity = (planRecord) => {
    const configMax = Math.max(1, Number(maxPurchaseQuantity) || 10);
    const limit = Number(planRecord?.plan?.max_purchase_per_user || 0);
    if (limit <= 0) return configMax;
    const count = getPlanPurchaseCount(planRecord?.plan?.id);
    return Math.max(1, Math.min(configMax, Math.max(0, limit - count)));
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await reloadSubscriptionSelf?.();
      await reloadUserQuota?.();
    } finally {
      setRefreshing(false);
    }
  };

  const getRequiredQuota = (planRecord) => {
    const requiredQuotaFromApi = Number(planRecord?.required_quota);
    if (Number.isFinite(requiredQuotaFromApi) && requiredQuotaFromApi >= 0) {
      return requiredQuotaFromApi;
    }
    const plan = planRecord?.plan;
    const priceAmount = Number(plan?.price_amount || 0);
    const quotaUnit = Number(quotaPerUnit || 0);
    if (priceAmount <= 0 || quotaUnit <= 0) {
      return 0;
    }
    return Math.max(0, Math.round(priceAmount * quotaUnit));
  };

  const payWallet = (planRecord) => {
    const plan = planRecord?.plan;
    if (!plan?.id) {
      return;
    }
    let walletPurchaseMode = 'concurrent';
    const showPurchaseMode = hasActiveSamePlan(plan.id);
    const requiredQuota = getRequiredQuota(planRecord);
    const currentWalletQuota = Number(walletQuota || 0);
    const maxQuantity = getMaxQuantity(planRecord);
    if (purchaseQuantity > maxQuantity) {
      setPurchaseQuantity(1);
      return;
    }
    const totalDeduction = requiredQuota * purchaseQuantity;
    if (totalDeduction > currentWalletQuota) {
      showError(
        t('余额不足，当前余额 {{current}}，所需 {{required}}', {
          current: renderQuota(currentWalletQuota),
          required: renderQuota(totalDeduction),
        }),
      );
      return;
    }
    const walletQuantityRef = { current: purchaseQuantity };
    const QuantityBox = () => {
      const [qty, setQty] = useState(purchaseQuantity);
      walletQuantityRef.current = qty;
      const total = requiredQuota * qty;
      return (
        <>
          <p>
            <Text>{t('购买份数')}：</Text>
            <Select
              value={qty}
              onChange={(v) => setQty(Number(v) || 1)}
              optionList={Array.from({ length: maxQuantity }, (_, i) => ({
                value: i + 1,
                label: String(i + 1),
              }))}
              style={{ width: 120 }}
            />
          </p>
          <p>
            <Text>{t('本次扣减')}：</Text>
            <Text strong>{renderQuota(total)}</Text>
            {total > currentWalletQuota && (
              <Text type='danger' style={{ marginLeft: 8 }}>
                {t('余额不足')}
              </Text>
            )}
          </p>
        </>
      );
    };
    Modal.confirm({
      title: t('确认余额购买订阅'),
      content: (
        <div style={{ lineHeight: '1.8' }}>
          <p>
            <Text>{t('套餐')}：</Text>
            <Text strong>{plan.title || t('订阅套餐')}</Text>
          </p>
          <p>
            <Text>{t('当前余额')}：</Text>
            <Text strong>{renderQuota(currentWalletQuota)}</Text>
          </p>
          <QuantityBox />
          {requiredQuota === 0 && (
            <Text type='tertiary'>
              {t('该套餐价格为 0，本次不会扣减钱包余额，但会创建订阅订单记录')}
            </Text>
          )}
          {showPurchaseMode && (
            <p>
              <Text>{t('购买方式')}：</Text>
              <Select
                defaultValue='concurrent'
                onChange={(value) => {
                  walletPurchaseMode = value || 'concurrent';
                }}
                optionList={[
                  { value: 'concurrent', label: t('同时使用') },
                  { value: 'renew', label: t('续期') },
                ]}
                style={{ width: 160 }}
              />
            </p>
          )}
        </div>
      ),
      onOk: async () => {
        setWalletPayingPlanId(plan.id);
        try {
          const res = await API.post('/api/subscription/wallet/pay', {
            plan_id: plan.id,
            purchase_mode: walletPurchaseMode,
            quantity: walletQuantityRef.current,
          });
          if (res.data?.success) {
            showSuccess(t('余额购买成功'));
            await reloadSubscriptionSelf?.();
            await reloadUserQuota?.();
          } else {
            showError(res.data?.message || t('余额购买失败'));
          }
        } catch (error) {
          showError(t('余额购买失败'));
        } finally {
          setWalletPayingPlanId(null);
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
        purchase_mode: purchaseMode,
        quantity: purchaseQuantity,
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
        purchase_mode: purchaseMode,
        quantity: purchaseQuantity,
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
        purchase_mode: purchaseMode,
        quantity: purchaseQuantity,
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
  const display = useSubscriptionDisplay(allSubscriptions);
  const activeSubscriptions = display.active;
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
    const remaining = sub.subscription.end_time - display.now;
    return Math.max(0, Math.ceil(remaining / 86400));
  };

  // 计算单个订阅的使用进度
  const getUsagePercent = (sub) => {
    const total = Number(sub?.subscription?.amount_total || 0);
    const used = Number(sub?.subscription?.amount_used || 0);
    if (total <= 0) return 0;
    return Math.round((used / total) * 100);
  };

  const parseAllowedModels = (value) => {
    if (typeof value !== 'string' || value.trim() === '') {
      return [];
    }
    try {
      const parsed = JSON.parse(value);
      if (!Array.isArray(parsed)) {
        return [];
      }
      return parsed.map((item) => String(item || '').trim()).filter(Boolean);
    } catch (error) {
      return [];
    }
  };

  const getModelRestrictionMeta = (plan) => {
    const mode = plan?.model_restrict_mode || '';
    if (!mode) {
      return null;
    }
    if (mode === 'group') {
      const restrictGroup = String(plan?.model_restrict_group || '').trim();
      const upgradeGroup = String(plan?.upgrade_group || '').trim();
      const displayGroup = restrictGroup || upgradeGroup;
      return {
        label: displayGroup
          ? `${t('模型限制')}: ${t('按分组')} (${displayGroup})`
          : `${t('模型限制')}: ${t('按分组')}`,
        tooltip: restrictGroup
          ? t('仅允许使用所选限制分组可用的模型')
          : upgradeGroup
            ? t('未单独指定限制分组时，使用升级分组可用的模型')
            : t('未单独指定限制分组时，按当前用户分组可用模型自动判定'),
      };
    }
    const allowedModels = parseAllowedModels(plan?.allowed_models);
    const modeLabel = t('自定义模型限制');
    const countSuffix =
      allowedModels.length > 0 ? ` (${allowedModels.length})` : '';
    return {
      label: `${t('模型限制')}: ${modeLabel}${countSuffix}`,
      tooltip:
        allowedModels.length > 0
          ? allowedModels.join(', ')
          : t('当前未配置允许模型'),
    };
  };

  const getQuotaWindowItems = (plan, subscription) => {
    const definitions = [
      {
        label: t('日限额'),
        limit: Number(plan?.daily_quota_limit || 0),
        used: Number(subscription?.daily_window_used || 0),
      },
      {
        label: t('周限额'),
        limit: Number(plan?.weekly_quota_limit || 0),
        used: Number(subscription?.weekly_window_used || 0),
      },
      {
        label: t('月限额'),
        limit: Number(plan?.monthly_quota_limit || 0),
        used: Number(subscription?.monthly_window_used || 0),
      },
    ];
    return definitions
      .filter((item) => item.limit > 0)
      .map((item) => ({
        label: subscription
          ? `${item.label}: ${renderQuota(item.used)}/${renderQuota(item.limit)}`
          : `${item.label}: ${renderQuota(item.limit)}`,
      }));
  };

  const cardContent = (
    <>
      {/* 卡片头部 */}
      {loading ? (
        <div className='space-y-4'>
          {/* 我的订阅骨架屏 */}
          {!hideSubscriptions && (
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
          {!hidePlans && (
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
          {!hideSubscriptions && (
            <Card
              className={`!rounded-xl w-full ${
                hidePlans ? 'topup-my-subscriptions-card' : ''
              }`}
              bodyStyle={{ padding: '12px' }}
            >
              <div
                className={hidePlans ? 'topup-my-subscriptions-content' : ''}
              >
                <div className='flex items-center justify-between mb-2 gap-3'>
                  <div className='flex flex-wrap items-center gap-2 flex-1 min-w-0'>
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
                    {display.pending.length > 0 && (
                      <Tag color='white' size='small' shape='circle'>
                        {display.pending.length} {t('待生效')}
                      </Tag>
                    )}
                    {display.expired.length > 0 && (
                      <Tag color='white' size='small' shape='circle'>
                        {display.expired.length} {t('个已过期')}
                      </Tag>
                    )}
                    {display.cancelled.length > 0 && (
                      <Tag color='white' size='small' shape='circle'>
                        {display.cancelled.length} {t('已作废')}
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
                    <div
                      className={`overflow-y-auto pr-1 semi-table-body ${
                        hidePlans ? 'topup-my-subscriptions-list' : 'max-h-64'
                      }`}
                    >
                      <SubscriptionList
                        current={display.current}
                        history={display.history}
                        renderSubscription={(sub) => {
                          const subscription = sub.subscription;
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
                            sub?.plan?.title ||
                            planTitleMap.get(subscription?.plan_id) ||
                            '';
                          const remainDays = getRemainingDays(sub);
                          const usagePercent = getUsagePercent(sub);
                          const status = getSubscriptionStatus(
                            subscription,
                            display.now,
                          );
                          const isCancelled = status === 'cancelled';
                          const isPending = status === 'pending';
                          const isActive = status === 'active';
                          const planInfo = sub?.plan;
                          const modelRestrictionMeta =
                            getModelRestrictionMeta(planInfo);
                          const windowUsageItems = getQuotaWindowItems(
                            planInfo,
                            subscription,
                          );

                          return (
                            <div key={subscription.id}>
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
                                  ) : isPending ? (
                                    <Tag
                                      color='white'
                                      size='small'
                                      shape='circle'
                                    >
                                      {t('待生效')}
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
                                  <span className='text-gray-500'>
                                    {t('剩余')} {remainDays} {t('天')}
                                  </span>
                                )}
                              </div>
                              <div className='text-xs text-gray-500 mb-2'>
                                {isActive || isPending
                                  ? t('至')
                                  : isCancelled
                                    ? t('作废于')
                                    : t('过期于')}{' '}
                                {new Date(
                                  (subscription?.end_time || 0) * 1000,
                                ).toLocaleString()}
                              </div>
                              {isActive &&
                                subscription?.next_reset_time > 0 && (
                                  <div className='text-xs text-gray-500 mb-2'>
                                    {t('下一次重置')}:{' '}
                                    {new Date(
                                      subscription.next_reset_time * 1000,
                                    ).toLocaleString()}
                                  </div>
                                )}
                              <div className='text-xs text-gray-500 mb-2'>
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
                              {modelRestrictionMeta && (
                                <div className='text-xs text-gray-500 mb-2'>
                                  <Tooltip
                                    content={modelRestrictionMeta.tooltip}
                                  >
                                    <span>{modelRestrictionMeta.label}</span>
                                  </Tooltip>
                                </div>
                              )}
                              {windowUsageItems.map((item) => (
                                <div
                                  key={`${subscription.id}-${item.label}`}
                                  className='text-xs text-gray-500 mb-2'
                                >
                                  {item.label}
                                </div>
                              ))}
                            </div>
                          );
                        }}
                      />
                    </div>
                  </>
                ) : (
                  <div className='text-xs text-gray-500'>
                    {t('购买套餐后即可享受模型权益')}
                  </div>
                )}
              </div>
            </Card>
          )}

          {/* 可购买套餐 - 标准定价卡片 */}
          {!hidePlans && plans.length > 0 ? (
            <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-5 w-full px-1 items-stretch'>
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
                const hasOnlinePurchase =
                  enableOnlineTopUp || enableStripeTopUp || enableCreemTopUp;
                const limitLabel = limit > 0 ? `${t('限购')} ${limit}` : null;
                const modelRestrictionMeta = getModelRestrictionMeta(plan);
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
                const windowLimitItems = getQuotaWindowItems(plan);
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
                  modelRestrictionMeta
                    ? {
                        label: modelRestrictionMeta.label,
                        tooltip: modelRestrictionMeta.tooltip,
                      }
                    : null,
                  ...windowLimitItems,
                  upgradeLabel ? { label: upgradeLabel } : null,
                ].filter(Boolean);

                return (
                  <Card
                    key={plan?.id}
                    className={`!rounded-xl transition-all hover:shadow-lg w-full h-full min-h-[390px] max-h-[430px] overflow-hidden ${
                      isPopular ? 'ring-2 ring-purple-500' : ''
                    }`}
                    bodyStyle={{ padding: 0 }}
                  >
                    <div className='p-4 h-full min-h-[390px] max-h-[430px] flex flex-col'>
                      {/* 推荐标签 */}
                      {isPopular && (
                        <div className='mb-2'>
                          <Tag color='purple' shape='circle' size='small'>
                            <Sparkles size={10} className='mr-1' />
                            {t('推荐')}
                          </Tag>
                        </div>
                      )}
                      {/* 套餐名称 */}
                      <div className='mb-3'>
                        <Typography.Title
                          heading={5}
                          ellipsis={{ rows: 1, showTooltip: true }}
                          style={{ margin: 0 }}
                        >
                          {plan?.title || t('订阅套餐')}
                        </Typography.Title>
                        {plan?.subtitle && (
                          <Text
                            type='tertiary'
                            size='small'
                            ellipsis={{ rows: 1, showTooltip: true }}
                            style={{ display: 'block' }}
                          >
                            {plan.subtitle}
                          </Text>
                        )}
                      </div>

                      {/* 价格区域 */}
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

                      {/* 套餐权益描述 */}
                      <div className='flex min-h-[120px] max-h-[140px] flex-col items-start gap-1 overflow-y-auto pr-1 pb-2'>
                        {planBenefits.map((item) => {
                          const content = (
                            <div className='flex items-center gap-2 text-xs text-gray-500'>
                              <Badge dot type='tertiary' />
                              <span className='min-w-0 break-words leading-relaxed'>
                                {item.label}
                              </span>
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
                        <Divider margin={12} />

                        {/* 购买按钮 */}
                        {(() => {
                          const count = getPlanPurchaseCount(p?.plan?.id);
                          const reached = limit > 0 && count >= limit;
                          const tip = reached
                            ? t('已达到购买上限') + ` (${count}/${limit})`
                            : '';
                          const buttonEl = (
                            <div className='flex flex-col gap-2'>
                              <Button
                                type='primary'
                                block
                                loading={walletPayingPlanId === p?.plan?.id}
                                disabled={reached}
                                onClick={() => {
                                  if (!reached) payWallet(p);
                                }}
                              >
                                {reached
                                  ? t('已达上限')
                                  : Number(plan?.price_amount || 0) > 0
                                    ? t('余额购买')
                                    : t('0 元领取')}
                              </Button>
                              {hasOnlinePurchase && (
                                <Button
                                  theme='outline'
                                  type='primary'
                                  block
                                  disabled={reached}
                                  onClick={() => {
                                    if (!reached) openBuy(p);
                                  }}
                                >
                                  {reached ? t('已达上限') : t('在线订阅')}
                                </Button>
                              )}
                            </div>
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
                  </Card>
                );
              })}
            </div>
          ) : !hidePlans ? (
            <div className='text-center text-gray-400 text-sm py-4'>
              {t('暂无可购买套餐')}
            </div>
          ) : null}
        </Space>
      )}
    </>
  );

  return (
    <>
      {withCard ? (
        <Card className='!rounded-2xl shadow-sm border-0'>{cardContent}</Card>
      ) : (
        <div
          className={`space-y-3 ${
            hidePlans ? 'topup-subscription-card-container' : ''
          }`}
        >
          {cardContent}
        </div>
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
        purchaseMode={purchaseMode}
        purchaseQuantity={purchaseQuantity}
        setPurchaseQuantity={setPurchaseQuantity}
        maxQuantity={getMaxQuantity(selectedPlan)}
        setPurchaseMode={setPurchaseMode}
        showPurchaseMode={hasActiveSamePlan(selectedPlan?.plan?.id)}
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
