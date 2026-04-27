/*
Copyright (C) 2025 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/

import React, { useEffect, useState } from 'react';
import { Card, Button, Skeleton, Spinner, Tooltip } from '@heroui/react';
import { SiAlipay, SiWechat, SiStripe } from 'react-icons/si';
import {
  BarChart2,
  CreditCard,
  Coins,
  Gift,
  Receipt,
  Sparkles,
  TrendingUp,
  Wallet,
} from 'lucide-react';
import { useMinimumLoadingTime } from '../../hooks/common/useMinimumLoadingTime';
import { getCurrencyConfig } from '../../helpers/render';
import SubscriptionPlansCard from './SubscriptionPlansCard';

const inputClass =
  'h-10 w-full rounded-xl border border-border bg-background px-3 text-sm text-foreground outline-none transition focus:border-primary disabled:opacity-50';

function FieldLabel({ children }) {
  return (
    <div className='block text-sm font-medium text-foreground'>{children}</div>
  );
}

function InfoBanner({ children }) {
  return (
    <div className='flex items-start gap-2 rounded-xl border border-primary/20 bg-primary/5 px-3 py-2 text-sm text-foreground'>
      <span>{children}</span>
    </div>
  );
}

function StatusChip({ tone = 'green', children }) {
  const cls =
    {
      green: 'bg-success/15 text-success',
      blue: 'bg-primary/15 text-primary',
    }[tone] || 'bg-success/15 text-success';
  return (
    <span
      className={`ml-1 inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${cls}`}
    >
      {children}
    </span>
  );
}

const RechargeCard = ({
  t,
  enableOnlineTopUp,
  enableStripeTopUp,
  enableCreemTopUp,
  creemProducts,
  creemPreTopUp,
  presetAmounts,
  selectedPreset,
  selectPresetAmount,
  formatLargeNumber,
  priceRatio,
  topUpCount,
  minTopUp,
  renderQuotaWithAmount,
  getAmount,
  setTopUpCount,
  setSelectedPreset,
  renderAmount,
  amountLoading,
  payMethods,
  preTopUp,
  paymentLoading,
  payWay,
  redemptionCode,
  setRedemptionCode,
  topUp,
  isSubmitting,
  topUpLink,
  openTopUpLink,
  userState,
  renderQuota,
  statusLoading,
  topupInfo,
  onOpenHistory,
  enableWaffoTopUp,
  enableWaffoPancakeTopUp,
  subscriptionLoading = false,
  subscriptionPlans = [],
  billingPreference,
  onChangeBillingPreference,
  activeSubscriptions = [],
  allSubscriptions = [],
  reloadSubscriptionSelf,
}) => {
  const showAmountSkeleton = useMinimumLoadingTime(amountLoading);
  const [activeTab, setActiveTab] = useState('topup');
  const shouldShowSubscription =
    !subscriptionLoading && subscriptionPlans.length > 0;
  const regularPayMethods = payMethods || [];

  const [initialTabSet, setInitialTabSet] = useState(false);

  useEffect(() => {
    if (initialTabSet) return;
    if (subscriptionLoading) return;
    setActiveTab(shouldShowSubscription ? 'subscription' : 'topup');
    setInitialTabSet(true);
  }, [shouldShowSubscription, subscriptionLoading, initialTabSet]);

  useEffect(() => {
    if (!shouldShowSubscription && activeTab !== 'topup') {
      setActiveTab('topup');
    }
  }, [shouldShowSubscription, activeTab]);

  const renderStatHeader = () => (
    <div
      className='relative h-30'
      style={{
        '--palette-primary-darkerChannel': '37 99 235',
        backgroundImage: `linear-gradient(0deg, rgba(var(--palette-primary-darkerChannel) / 80%), rgba(var(--palette-primary-darkerChannel) / 80%)), url('/cover-4.webp')`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
      }}
    >
      <div className='relative z-10 flex h-full flex-col justify-between p-4'>
        <div className='flex items-center justify-between'>
          <span className='text-base font-semibold text-white'>
            {t('账户统计')}
          </span>
        </div>
        <div className='mt-4 grid grid-cols-3 gap-6'>
          <div className='text-center'>
            <div className='mb-2 text-base font-bold text-white sm:text-2xl'>
              {renderQuota(userState?.user?.quota)}
            </div>
            <div className='flex items-center justify-center gap-1 text-xs text-white/80'>
              <Wallet size={14} />
              <span>{t('当前余额')}</span>
            </div>
          </div>
          <div className='text-center'>
            <div className='mb-2 text-base font-bold text-white sm:text-2xl'>
              {renderQuota(userState?.user?.used_quota)}
            </div>
            <div className='flex items-center justify-center gap-1 text-xs text-white/80'>
              <TrendingUp size={14} />
              <span>{t('历史消耗')}</span>
            </div>
          </div>
          <div className='text-center'>
            <div className='mb-2 text-base font-bold text-white sm:text-2xl'>
              {userState?.user?.request_count || 0}
            </div>
            <div className='flex items-center justify-center gap-1 text-xs text-white/80'>
              <BarChart2 size={14} />
              <span>{t('请求次数')}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  const renderActualPayLine = () => {
    if (showAmountSkeleton) {
      return <Skeleton className='h-5 w-32 rounded-md' />;
    }
    return (
      <div className='text-sm text-muted'>
        {t('实付金额：')}
        <span className='text-danger'>{renderAmount()}</span>
      </div>
    );
  };

  const renderPayMethodButton = (payMethod) => {
    const minTopupVal = Number(payMethod.min_topup) || 0;
    const isStripe = payMethod.type === 'stripe';
    const isWaffo =
      typeof payMethod.type === 'string' && payMethod.type.startsWith('waffo:');
    const isWaffoPancake = payMethod.type === 'waffo_pancake';
    const disabled =
      (!enableOnlineTopUp && !isStripe && !isWaffo && !isWaffoPancake) ||
      (!enableStripeTopUp && isStripe) ||
      (!enableWaffoTopUp && isWaffo) ||
      (!enableWaffoPancakeTopUp && isWaffoPancake) ||
      minTopupVal > Number(topUpCount || 0);

    const startIcon =
      payMethod.type === 'alipay' ? (
        <SiAlipay size={18} color='#1677FF' />
      ) : payMethod.type === 'wxpay' ? (
        <SiWechat size={18} color='#07C160' />
      ) : payMethod.type === 'stripe' ? (
        <SiStripe size={18} color='#635BFF' />
      ) : payMethod.icon ? (
        <img
          src={payMethod.icon}
          alt={payMethod.name}
          className='h-[18px] w-[18px] object-contain'
        />
      ) : payMethod.type === 'waffo_pancake' ? (
        <CreditCard size={18} className='text-primary' />
      ) : (
        <CreditCard
          size={18}
          style={{
            color: payMethod.color || 'var(--app-muted)',
          }}
        />
      );

    const buttonEl = (
      <Button
        key={payMethod.type}
        variant='secondary'
        onPress={() => preTopUp(payMethod.type)}
        isDisabled={disabled}
        isPending={paymentLoading && payWay === payMethod.type}
        className='!rounded-lg !px-4 !py-2'
      >
        {startIcon}
        {payMethod.name}
      </Button>
    );

    if (disabled && minTopupVal > Number(topUpCount || 0)) {
      return (
        <Tooltip
          key={payMethod.type}
          content={t('此支付方式最低充值金额为') + ' ' + minTopupVal}
        >
          {buttonEl}
        </Tooltip>
      );
    }
    return <React.Fragment key={payMethod.type}>{buttonEl}</React.Fragment>;
  };

  const renderPresetGrid = () => (
    <div className='space-y-2'>
      <FieldLabel>
        <div className='flex items-center gap-2'>
          <span>{t('选择充值额度')}</span>
          {(() => {
            const { symbol, rate, type } = getCurrencyConfig();
            if (type === 'USD') return null;
            return (
              <span className='text-xs font-normal text-muted'>
                (1 $ = {rate.toFixed(2)} {symbol})
              </span>
            );
          })()}
        </div>
      </FieldLabel>
      <div className='grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4'>
        {presetAmounts.map((preset, index) => {
          const discount =
            preset.discount || topupInfo?.discount?.[preset.value] || 1.0;
          const originalPrice = preset.value * priceRatio;
          const discountedPrice = originalPrice * discount;
          const hasDiscount = discount < 1.0;
          const actualPay = discountedPrice;
          const save = originalPrice - discountedPrice;

          // Convert displayed amount and price to the active currency
          const { symbol, rate, type } = getCurrencyConfig();
          const statusStr = localStorage.getItem('status');
          let usdRate = 7;
          try {
            if (statusStr) {
              const s = JSON.parse(statusStr);
              usdRate = s?.usd_exchange_rate || 7;
            }
          } catch (e) {}

          let displayValue = preset.value;
          let displayActualPay = actualPay;
          let displaySave = save;

          if (type === 'USD') {
            displayActualPay = actualPay / usdRate;
            displaySave = save / usdRate;
          } else if (type === 'CNY') {
            displayValue = preset.value * usdRate;
          } else if (type === 'CUSTOM') {
            displayValue = preset.value * rate;
            displayActualPay = (actualPay / usdRate) * rate;
            displaySave = (save / usdRate) * rate;
          }

          const selected = selectedPreset === preset.value;

          return (
            <button
              key={index}
              type='button'
              onClick={() => {
                selectPresetAmount(preset);
                setTopUpCount(preset.value);
              }}
              className={`flex w-full cursor-pointer flex-col items-center gap-1 rounded-xl bg-background px-3 py-3 text-center transition-colors hover:border-primary ${
                selected ? 'border-2 border-primary' : 'border border-border'
              }`}
            >
              <div className='flex items-center justify-center gap-1.5 text-base font-semibold text-foreground'>
                <Coins size={18} className='text-primary' />
                <span>
                  {formatLargeNumber(displayValue)} {symbol}
                </span>
                {hasDiscount && (
                  <StatusChip tone='green'>
                    {t('折').includes('off')
                      ? ((1 - parseFloat(discount)) * 100).toFixed(1)
                      : (discount * 10).toFixed(1)}
                    {t('折')}
                  </StatusChip>
                )}
              </div>
              <div className='text-xs text-muted'>
                {t('实付')} {symbol}
                {displayActualPay.toFixed(2)}，
                {hasDiscount
                  ? `${t('节省')} ${symbol}${displaySave.toFixed(2)}`
                  : `${t('节省')} ${symbol}0.00`}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );

  const renderCreemGrid = () => (
    <div className='space-y-2'>
      <FieldLabel>{t('Creem 充值')}</FieldLabel>
      <div className='grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3'>
        {creemProducts.map((product, index) => (
          <button
            key={index}
            type='button'
            onClick={() => creemPreTopUp(product)}
            className='cursor-pointer rounded-2xl border border-border bg-background p-4 text-center transition-all hover:border-foreground/40 hover:shadow-md'
          >
            <div className='mb-2 text-lg font-medium text-foreground'>
              {product.name}
            </div>
            <div className='mb-2 text-sm text-muted'>
              {t('充值额度')}: {product.quota}
            </div>
            <div className='text-lg font-semibold text-primary'>
              {product.currency === 'EUR' ? '€' : '$'}
              {product.price}
            </div>
          </button>
        ))}
      </div>
    </div>
  );

  const renderTopupForm = () => (
    <>
      {(enableOnlineTopUp ||
        enableStripeTopUp ||
        enableWaffoTopUp ||
        enableWaffoPancakeTopUp) && (
        <div className='grid grid-cols-1 gap-3 lg:grid-cols-12'>
          <div className='space-y-2 lg:col-span-5'>
            <FieldLabel>{t('充值数量')}</FieldLabel>
            <input
              type='number'
              value={topUpCount ?? ''}
              min={minTopUp}
              max={999999999}
              step={1}
              disabled={
                !enableOnlineTopUp &&
                !enableStripeTopUp &&
                !enableWaffoTopUp &&
                !enableWaffoPancakeTopUp
              }
              placeholder={
                t('充值数量，最低 ') + renderQuotaWithAmount(minTopUp)
              }
              onChange={async (event) => {
                const raw = event.target.value;
                const value = raw === '' ? '' : parseInt(raw, 10);
                if (value && value >= 1) {
                  setTopUpCount(value);
                  setSelectedPreset(null);
                  await getAmount(value);
                } else {
                  setTopUpCount(value);
                }
              }}
              onBlur={(event) => {
                const value = parseInt(event.target.value, 10);
                if (!value || value < 1) {
                  setTopUpCount(1);
                  getAmount(1);
                }
              }}
              className={inputClass}
            />
            <div className='min-h-[20px]'>{renderActualPayLine()}</div>
          </div>
          {regularPayMethods.length > 0 && (
            <div className='space-y-2 lg:col-span-7'>
              <FieldLabel>{t('选择支付方式')}</FieldLabel>
              <div className='flex flex-wrap items-center gap-2'>
                {regularPayMethods.map(renderPayMethodButton)}
              </div>
            </div>
          )}
        </div>
      )}

      {(enableOnlineTopUp || enableStripeTopUp || enableWaffoTopUp) &&
        renderPresetGrid()}

      {enableCreemTopUp && creemProducts.length > 0 && renderCreemGrid()}
    </>
  );

  const topupContent = (
    <div className='flex w-full flex-col gap-4'>
      {/* 统计数据 */}
      <Card className='!w-full !rounded-xl'>
        {renderStatHeader()}
        <Card.Content className='space-y-6 p-4'>
          {statusLoading ? (
            <div className='flex justify-center py-8'>
              <Spinner color='primary' />
            </div>
          ) : enableOnlineTopUp ||
            enableStripeTopUp ||
            enableCreemTopUp ||
            enableWaffoTopUp ||
            enableWaffoPancakeTopUp ? (
            renderTopupForm()
          ) : (
            <InfoBanner>
              {t(
                '管理员未开启在线充值功能，请联系管理员开启或使用兑换码充值。',
              )}
            </InfoBanner>
          )}
        </Card.Content>
      </Card>

      {/* 兑换码充值 */}
      <Card className='!w-full !rounded-xl'>
        <Card.Content className='space-y-3 p-4'>
          <div className='text-sm font-semibold text-muted'>
            {t('兑换码充值')}
          </div>
          <div className='relative'>
            <Gift
              size={16}
              className='pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted'
            />
            <input
              type='text'
              value={redemptionCode || ''}
              onChange={(event) => setRedemptionCode(event.target.value)}
              placeholder={t('请输入兑换码')}
              className={`${inputClass} pl-9 pr-[120px]`}
            />
            <div className='absolute right-2 top-1/2 -translate-y-1/2'>
              <Button
                color='primary'
                size='sm'
                isPending={isSubmitting}
                onPress={topUp}
              >
                {t('兑换额度')}
              </Button>
            </div>
          </div>
          {topUpLink && (
            <div className='text-xs text-muted'>
              {t('在找兑换码？')}
              <button
                type='button'
                onClick={openTopUpLink}
                className='ml-1 cursor-pointer underline-offset-2 hover:underline'
              >
                {t('购买兑换码')}
              </button>
            </div>
          )}
        </Card.Content>
      </Card>
    </div>
  );

  const tabs = [
    {
      key: 'subscription',
      label: t('订阅套餐'),
      icon: <Sparkles size={16} />,
    },
    {
      key: 'topup',
      label: t('额度充值'),
      icon: <Wallet size={16} />,
    },
  ];

  return (
    <Card className='!rounded-2xl border-0 shadow-sm'>
      <Card.Content className='space-y-4 p-5'>
        {/* 卡片头部 */}
        <div className='flex items-center justify-between'>
          <div className='flex items-center gap-2'>
            <div className='flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-primary shadow-md'>
              <CreditCard size={16} />
            </div>
            <div>
              <div className='text-base font-semibold text-foreground'>
                {t('账户充值')}
              </div>
              <div className='text-xs text-muted'>
                {t('多种充值方式，安全便捷')}
              </div>
            </div>
          </div>
          <Button color='primary' onPress={onOpenHistory}>
            <Receipt size={16} />
            {t('账单')}
          </Button>
        </div>

        {shouldShowSubscription ? (
          <>
            <div className='inline-flex overflow-hidden rounded-xl border border-border'>
              {tabs.map((tab) => {
                const active = tab.key === activeTab;
                return (
                  <button
                    key={tab.key}
                    type='button'
                    onClick={() => setActiveTab(tab.key)}
                    className={`flex items-center gap-2 px-4 py-2 text-sm font-medium transition-colors ${
                      active
                        ? 'bg-foreground text-background'
                        : 'bg-background text-muted hover:bg-surface-secondary'
                    }`}
                  >
                    {tab.icon}
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </div>
            <div className='py-2'>
              {activeTab === 'subscription' ? (
                <SubscriptionPlansCard
                  t={t}
                  loading={subscriptionLoading}
                  plans={subscriptionPlans}
                  payMethods={payMethods}
                  enableOnlineTopUp={enableOnlineTopUp}
                  enableStripeTopUp={enableStripeTopUp}
                  enableCreemTopUp={enableCreemTopUp}
                  billingPreference={billingPreference}
                  onChangeBillingPreference={onChangeBillingPreference}
                  activeSubscriptions={activeSubscriptions}
                  allSubscriptions={allSubscriptions}
                  reloadSubscriptionSelf={reloadSubscriptionSelf}
                  withCard={false}
                />
              ) : (
                topupContent
              )}
            </div>
          </>
        ) : (
          topupContent
        )}
      </Card.Content>
    </Card>
  );
};

export default RechargeCard;
