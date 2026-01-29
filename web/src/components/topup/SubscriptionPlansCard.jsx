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
  Avatar,
  Button,
  Card,
  Divider,
  Select,
  Skeleton,
  Space,
  Tag,
  Typography,
} from '@douyinfe/semi-ui';
import { API, showError, showSuccess } from '../../helpers';
import { CalendarClock, Check, Crown, RefreshCw, Sparkles } from 'lucide-react';
import SubscriptionPurchaseModal from './modals/SubscriptionPurchaseModal';

const { Text } = Typography;

// 格式化有效期显示
function formatDuration(plan, t) {
  const unit = plan?.duration_unit || 'month';
  const value = plan?.duration_value || 1;
  const unitLabels = {
    year: t('年'),
    month: t('个月'),
    day: t('天'),
    hour: t('小时'),
    custom: t('自定义'),
  };
  if (unit === 'custom') {
    const seconds = plan?.custom_seconds || 0;
    if (seconds >= 86400) return `${Math.floor(seconds / 86400)} ${t('天')}`;
    if (seconds >= 3600) return `${Math.floor(seconds / 3600)} ${t('小时')}`;
    return `${seconds} ${t('秒')}`;
  }
  return `${value} ${unitLabels[unit] || unit}`;
}

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

// 获取货币符号
function getCurrencySymbol(currency) {
  const symbols = { USD: '$', EUR: '€', CNY: '¥', GBP: '£', JPY: '¥' };
  return symbols[currency] || currency + ' ';
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
        showError(res.data?.data || res.data?.message || t('支付失败'));
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
        showError(res.data?.data || res.data?.message || t('支付失败'));
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
        showError(res.data?.data || res.data?.message || t('支付失败'));
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

  // 计算单个订阅的剩余天数
  const getRemainingDays = (sub) => {
    if (!sub?.subscription?.end_time) return 0;
    const now = Date.now() / 1000;
    const remaining = sub.subscription.end_time - now;
    return Math.max(0, Math.ceil(remaining / 86400));
  };

  // 计算单个订阅的使用进度
  const getUsagePercent = (sub) => {
    const items = sub?.items || [];
    if (items.length === 0) return 0;
    let totalUsed = 0;
    let totalAmount = 0;
    items.forEach((it) => {
      totalUsed += Number(it.amount_used || 0);
      totalAmount += Number(it.amount_total || 0);
    });
    if (totalAmount === 0) return 0;
    return Math.round((totalUsed / totalAmount) * 100);
  };

  return (
    <Card className='!rounded-2xl shadow-sm border-0'>
      {/* 卡片头部 */}
      <div className='flex items-center justify-between mb-3'>
        <div className='flex items-center'>
          <Avatar size='small' color='violet' className='mr-3 shadow-md'>
            <Crown size={16} />
          </Avatar>
          <div>
            <Text className='text-lg font-medium'>
              {t('订阅套餐')}
            </Text>
            <div className='text-xs'>{t('购买订阅获得模型额度/次数')}</div>
          </div>
        </div>
        {/* 扣费策略 - 右上角 */}
        <Select
          value={billingPreference}
          onChange={onChangeBillingPreference}
          size='small'
          optionList={[
            { value: 'subscription_first', label: t('优先订阅') },
            { value: 'wallet_first', label: t('优先钱包') },
            { value: 'subscription_only', label: t('仅用订阅') },
            { value: 'wallet_only', label: t('仅用钱包') },
          ]}
        />
      </div>

      {loading ? (
        <div className='space-y-4'>
          {/* 我的订阅骨架屏 */}
          <Card className='!rounded-xl w-full' bodyStyle={{ padding: '12px' }}>
            <div className='flex items-center justify-between mb-3'>
              <Skeleton.Title active style={{ width: 100, height: 20 }} />
              <Skeleton.Button active style={{ width: 24, height: 24 }} />
            </div>
            <div className='space-y-2'>
              <Skeleton.Paragraph active rows={2} />
            </div>
          </Card>
          {/* 套餐列表骨架屏 */}
          <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4'>
            {[1, 2, 3].map((i) => (
              <Card key={i} className='!rounded-xl' bodyStyle={{ padding: 16 }}>
                <Skeleton.Title active style={{ width: '60%', height: 24, marginBottom: 8 }} />
                <Skeleton.Paragraph active rows={1} style={{ marginBottom: 12 }} />
                <div className='text-center py-4'>
                  <Skeleton.Title active style={{ width: '40%', height: 32, margin: '0 auto' }} />
                </div>
                <Skeleton.Paragraph active rows={3} style={{ marginTop: 12 }} />
                <Skeleton.Button active block style={{ marginTop: 16, height: 32 }} />
              </Card>
            ))}
          </div>
        </div>
      ) : (
        <Space vertical style={{ width: '100%' }} spacing={8}>
          {/* 当前订阅状态 */}
          <Card className='!rounded-xl w-full' bodyStyle={{ padding: '12px' }}>
            <div className='flex items-center justify-between mb-2'>
              <div className='flex items-center gap-2'>
                <Text strong>{t('我的订阅')}</Text>
                {hasActiveSubscription ? (
                  <Tag color='green' size='small' shape='circle'>
                    {activeSubscriptions.length} {t('个生效中')}
                  </Tag>
                ) : (
                  <Tag color='grey' size='small' shape='circle'>{t('无生效')}</Tag>
                )}
                {allSubscriptions.length > activeSubscriptions.length && (
                  <Tag color='grey' size='small' shape='circle' type='light'>
                    {allSubscriptions.length - activeSubscriptions.length} {t('个已过期')}
                  </Tag>
                )}
              </div>
              <Button
                size='small'
                theme='borderless'
                icon={<RefreshCw size={12} className={refreshing ? 'animate-spin' : ''} />}
                onClick={handleRefresh}
                loading={refreshing}
              />
            </div>

            {hasAnySubscription ? (
              <div className='space-y-3 max-h-64 overflow-y-auto'>
                {allSubscriptions.map((sub, subIndex) => {
                  const subscription = sub.subscription;
                  const items = sub.items || [];
                  const remainDays = getRemainingDays(sub);
                  const usagePercent = getUsagePercent(sub);
                  const now = Date.now() / 1000;
                  const isExpired = (subscription?.end_time || 0) < now;
                  const isActive = subscription?.status === 'active' && !isExpired;

                  return (
                    <div
                      key={subscription?.id || subIndex}
                      className={`p-2 rounded-lg ${isActive ? 'bg-green-50' : 'bg-gray-100 opacity-70'}`}
                    >
                      {/* 订阅概要 */}
                      <div className='flex items-center justify-between text-xs mb-2'>
                        <div className='flex items-center gap-2'>
                          <span className='font-medium'>
                            {t('订阅')} #{subscription?.id}
                          </span>
                          {isActive ? (
                            <Tag color='green' size='small' shape='circle'>{t('生效')}</Tag>
                          ) : (
                            <Tag color='grey' size='small' shape='circle'>{t('已过期')}</Tag>
                          )}
                        </div>
                        {isActive && (
                          <span className='text-gray-500'>
                            {t('剩余')} {remainDays} {t('天')} · {t('已用')} {usagePercent}%
                          </span>
                        )}
                      </div>
                      <div className='text-xs text-gray-500 mb-2'>
                        {isActive ? t('至') : t('过期于')} {new Date((subscription?.end_time || 0) * 1000).toLocaleString()}
                      </div>
                      {/* 权益列表 */}
                      {items.length > 0 && (
                        <div className='flex flex-wrap gap-1'>
                          {items.slice(0, 4).map((it) => {
                            const used = Number(it.amount_used || 0);
                            const total = Number(it.amount_total || 0);
                            const remain = total - used;
                            const percent = total > 0 ? Math.round((used / total) * 100) : 0;
                            const label = it.quota_type === 1 ? t('次') : '';

                            return (
                              <Tag
                                key={`${it.id}-${it.model_name}`}
                                size='small'
                                color={isActive ? (percent > 80 ? 'red' : 'blue') : 'grey'}
                                type='light'
                                shape='circle'
                              >
                                {it.model_name}: {remain}{label}
                              </Tag>
                            );
                          })}
                          {items.length > 4 && (
                            <Tag size='small' color='grey' type='light' shape='circle'>
                              +{items.length - 4}
                            </Tag>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className='text-xs text-gray-500'>
                {t('购买套餐后即可享受模型权益')}
              </div>
            )}
          </Card>

          {/* 可购买套餐 - 标准定价卡片 */}
          {plans.length > 0 ? (
            <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4'>
              {plans.map((p, index) => {
                const plan = p?.plan;
                const planItems = p?.items || [];
                const currency = getCurrencySymbol(plan?.currency || 'USD');
                const price = Number(plan?.price_amount || 0);
                const isPopular = index === 0 && plans.length > 1;

                return (
                  <Card
                    key={plan?.id}
                    className={`!rounded-xl transition-all hover:shadow-lg ${isPopular ? 'ring-2 ring-purple-500' : ''
                      }`}
                    bodyStyle={{ padding: 0 }}
                  >
                    <div className='p-4'>
                      {/* 推荐标签 */}
                      {isPopular && (
                        <div className='text-center mb-2'>
                          <Tag color='purple' shape='circle' size='small'>
                            <Sparkles size={10} className='mr-1' />
                            {t('推荐')}
                          </Tag>
                        </div>
                      )}
                      {/* 套餐名称 */}
                      <div className='text-center mb-3'>
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
                      <div className='text-center py-2'>
                        <div className='flex items-baseline justify-center'>
                          <span className='text-xl font-bold text-purple-600'>
                            {currency}
                          </span>
                          <span className='text-3xl font-bold text-purple-600'>
                            {price.toFixed(price % 1 === 0 ? 0 : 2)}
                          </span>
                        </div>
                        <div className='text-sm text-gray-500 mt-1'>
                          <CalendarClock size={12} className='inline mr-1' />
                          {formatDuration(plan, t)}
                        </div>
                      </div>

                      <Divider margin={12} />

                      {/* 权益列表 */}
                      <div className='space-y-2 mb-4'>
                        {planItems.slice(0, 5).map((it, idx) => (
                          <div
                            key={idx}
                            className='flex items-center text-sm'
                          >
                            <Check
                              size={14}
                              className='text-green-500 mr-2 flex-shrink-0'
                            />
                            <span className='truncate flex-1'>{it.model_name}</span>
                            <Tag size='small' color='blue' shape='circle' type='light'>
                              {it.amount_total}
                              {it.quota_type === 1 ? t('次') : ''}
                            </Tag>
                          </div>
                        ))}
                        {planItems.length > 5 && (
                          <div className='text-xs text-gray-400 text-center'>
                            +{planItems.length - 5} {t('项更多权益')}
                          </div>
                        )}
                        {planItems.length === 0 && (
                          <div className='text-xs text-gray-400 text-center py-2'>
                            {t('暂无权益配置')}
                          </div>
                        )}
                      </div>

                      {/* 购买按钮 */}
                      <Button
                        theme='solid'
                        type='primary'
                        block
                        onClick={() => openBuy(p)}
                        className={isPopular ? '!bg-purple-600 hover:!bg-purple-700' : ''}
                      >
                        {t('立即订阅')}
                      </Button>
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
        </Space>
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
        onPayStripe={payStripe}
        onPayCreem={payCreem}
        onPayEpay={payEpay}
      />
    </Card>
  );
};

export default SubscriptionPlansCard;

