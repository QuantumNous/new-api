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

import React, { useEffect, useRef, useState } from 'react';
import {
  Typography,
  Tag,
  Card,
  Button,
  Banner,
  Skeleton,
  Form,
  Spin,
  Tooltip,
  Input,
} from '@douyinfe/semi-ui';
import { SiAlipay, SiWechat, SiStripe } from 'react-icons/si';
import {
  CreditCard,
  Coins,
  Wallet,
  BarChart2,
  TrendingUp,
  AlertTriangle,
  FileText,
  Info,
} from 'lucide-react';
import { useMinimumLoadingTime } from '../../hooks/common/useMinimumLoadingTime';
import { getCurrencyConfig } from '../../helpers/render';
import SubscriptionPlansCard from './SubscriptionPlansCard';

const { Text } = Typography;

// Payment method icon resolver
const getPayMethodIcon = (method) => {
  if (method.type === 'alipay') {
    return <SiAlipay size={24} color='#1677FF' />;
  }
  if (method.type === 'wxpay') {
    return <SiWechat size={24} color='#07C160' />;
  }
  if (method.type === 'stripe') {
    return <SiStripe size={24} color='#635BFF' />;
  }
  if (method.icon) {
    return (
      <img
        src={method.icon}
        alt={method.name}
        style={{ width: 24, height: 24, objectFit: 'contain' }}
      />
    );
  }
  if (method.type === 'waffo_pancake') {
    return <CreditCard size={24} color='var(--semi-color-primary)' />;
  }
  return (
    <CreditCard
      size={24}
      color={method.color || 'var(--semi-color-text-2)'}
    />
  );
};

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
  enableWaffoTopUp,
  enableWaffoPancakeTopUp,
  subscriptionLoading = false,
  subscriptionPlans = [],
  billingPreference,
  onChangeBillingPreference,
  activeSubscriptions = [],
  allSubscriptions = [],
  reloadSubscriptionSelf,
  redemptionEnabled = true,
  redemptionAllowedGroups = [],
  includeTax = false,
  setIncludeTax,
  taxRate = 0.06,
}) => {
  const onlineFormApiRef = useRef(null);
  const redeemFormApiRef = useRef(null);
  const showAmountSkeleton = useMinimumLoadingTime(amountLoading);
  const shouldShowSubscription =
    !subscriptionLoading && subscriptionPlans.length > 0;
  const regularPayMethods = payMethods || [];

  // Selected payment method state
  const [selectedPayMethod, setSelectedPayMethod] = useState('');

  // Auto-select first payment method
  useEffect(() => {
    if (regularPayMethods.length > 0 && !selectedPayMethod) {
      setSelectedPayMethod(regularPayMethods[0].type);
    }
  }, [regularPayMethods, selectedPayMethod]);

  // Redemption visibility
  const userGroup = userState?.user?.group || '';
  const showRedemption =
    redemptionEnabled &&
    (redemptionAllowedGroups.length === 0 ||
      redemptionAllowedGroups.includes(userGroup));

  const hasOnlineTopUp =
    enableOnlineTopUp ||
    enableStripeTopUp ||
    enableCreemTopUp ||
    enableWaffoTopUp ||
    enableWaffoPancakeTopUp;

  // Currency info for summary
  const { symbol: currencySymbol, rate: currencyRate, type: currencyType } = getCurrencyConfig();

  // Get USD exchange rate from status
  let usdRate = 7;
  try {
    const statusStr = localStorage.getItem('status');
    if (statusStr) {
      const s = JSON.parse(statusStr);
      usdRate = s?.usd_exchange_rate || 7;
    }
  } catch (e) {}

  // Calculate display currency name (for payment, always CNY since backend Price converts to CNY)
  const getCurrencyName = () => {
    const { type, symbol } = getCurrencyConfig();
    if (type === 'USD') return 'USD';
    if (type === 'CNY') return 'CNY';
    if (type === 'CUSTOM') return symbol;
    return 'CNY';
  };

  // Calculate exchange rate display
  const getExchangeRate = () => {
    const { rate, type } = getCurrencyConfig();
    if (type === 'USD') return '1:1';
    return `1:${rate.toFixed(2)}`;
  };

  // Calculate payment amount in local currency
  const getPayAmount = () => {
    if (amountLoading) return '...';
    const { symbol, rate, type } = getCurrencyConfig();
    const amountStr = renderAmount();
    const match = amountStr.match(/[\d.]+/);
    if (!match) return '0';
    const amountVal = parseFloat(match[0]);
    if (type === 'USD') {
      // Convert from internal USD to display USD
      const statusStr = localStorage.getItem('status');
      let localUsdRate = 7;
      try {
        if (statusStr) {
          const s = JSON.parse(statusStr);
          localUsdRate = s?.usd_exchange_rate || 7;
        }
      } catch (e) {}
      return symbol + (amountVal / localUsdRate).toFixed(2);
    }
    return symbol + amountVal.toFixed(2);
  };

  // Handle payment from sidebar
  const handlePayFromSidebar = () => {
    if (!selectedPayMethod) return;
    preTopUp(selectedPayMethod);
  };

  // Check if selected pay method is disabled
  const isPayMethodDisabled = (methodType) => {
    const payMethod = regularPayMethods.find((m) => m.type === methodType);
    if (!payMethod) return true;
    const minTopupVal = Number(payMethod.min_topup) || 0;
    const isStripe = payMethod.type === 'stripe';
    const isWaffo =
      typeof payMethod.type === 'string' &&
      payMethod.type.startsWith('waffo:');
    const isWaffoPancake = payMethod.type === 'waffo_pancake';
    return (
      (!enableOnlineTopUp && !isStripe && !isWaffo && !isWaffoPancake) ||
      (!enableStripeTopUp && isStripe) ||
      (!enableWaffoTopUp && isWaffo) ||
      (!enableWaffoPancakeTopUp && isWaffoPancake) ||
      minTopupVal > Number(topUpCount || 0)
    );
  };

  // ─── Account Statistics Bar ────────────────────────────────────
  const statsBar = (
    <div
      className='relative rounded-2xl overflow-hidden mb-6'
      style={{
        '--palette-primary-darkerChannel': '37 99 235',
        backgroundImage: `linear-gradient(0deg, rgba(var(--palette-primary-darkerChannel) / 80%), rgba(var(--palette-primary-darkerChannel) / 80%)), url('/cover-4.webp')`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
      }}
    >
      <div className='relative z-10 flex flex-col justify-between p-5'>
        <div className='flex justify-between items-center mb-4'>
          <Text strong style={{ color: 'white', fontSize: '16px' }}>
            {t('账户统计')}
          </Text>
        </div>
        <div className='grid grid-cols-3 gap-6'>
          <div className='text-center'>
            <div
              className='text-base sm:text-2xl font-bold mb-2'
              style={{ color: 'white' }}
            >
              {renderQuota(userState?.user?.quota)}
            </div>
            <div className='flex items-center justify-center text-sm'>
              <Wallet
                size={14}
                className='mr-1'
                style={{ color: 'rgba(255,255,255,0.8)' }}
              />
              <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: '12px' }}>
                {t('当前余额')}
              </Text>
            </div>
          </div>
          <div className='text-center'>
            <div
              className='text-base sm:text-2xl font-bold mb-2'
              style={{ color: 'white' }}
            >
              {renderQuota(userState?.user?.used_quota)}
            </div>
            <div className='flex items-center justify-center text-sm'>
              <TrendingUp
                size={14}
                className='mr-1'
                style={{ color: 'rgba(255,255,255,0.8)' }}
              />
              <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: '12px' }}>
                {t('历史消耗')}
              </Text>
            </div>
          </div>
          <div className='text-center'>
            <div
              className='text-base sm:text-2xl font-bold mb-2'
              style={{ color: 'white' }}
            >
              {userState?.user?.request_count || 0}
            </div>
            <div className='flex items-center justify-center text-sm'>
              <BarChart2
                size={14}
                className='mr-1'
                style={{ color: 'rgba(255,255,255,0.8)' }}
              />
              <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: '12px' }}>
                {t('请求次数')}
              </Text>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  // ─── Payment Method Card ───────────────────────────────────────
  const renderPayMethodCard = (method) => {
    // 非交互提示信息（type: fail），渲染为 Banner 而非支付卡片
    if (method.type === 'fail') {
      const rawName = method.name || '';
      // 从 name 中分离出纯文本和 URL（如 "提示：https://..."）
      const urlMatch = rawName.match(/https?:\/\/\S+/);
      const url = urlMatch ? urlMatch[0] : '';
      const text = urlMatch
        ? rawName.substring(0, rawName.indexOf(url)).replace(/[：:]\s*$/, '')
        : rawName;
      const msg = t(text);
      return (
        <div
          key={method.type}
          className='rounded-xl px-4 py-3'
          style={{
            background: 'rgba(245, 158, 11, 0.06)',
            border: '1px solid rgba(245, 158, 11, 0.2)',
            fontSize: 13,
          }}
        >
          <div className='flex items-start gap-2'>
            <AlertTriangle size={16} style={{ marginTop: 1, flexShrink: 0 }} />
            <span>
              {msg}
              {url && (
                <>
                  {' '}
                  <a
                    href={url}
                    target='_blank'
                    rel='noreferrer'
                    style={{ color: 'var(--semi-color-primary)', textDecoration: 'underline' }}
                  >
                    {url}
                  </a>
                </>
              )}
            </span>
          </div>
        </div>
      );
    }

    const isSelected = selectedPayMethod === method.type;
    const minTopupVal = Number(method.min_topup) || 0;
    const disabled = isPayMethodDisabled(method.type);
    const needsMinTooltip = minTopupVal > Number(topUpCount || 0);

    const card = (
      <div
        key={method.type}
        className='flex items-center justify-between px-4 py-3.5 rounded-xl border-2 transition-all cursor-pointer select-none'
        onClick={() => {
          if (!disabled) setSelectedPayMethod(method.type);
        }}
        style={{
          minHeight: 56,
          ...(disabled
            ? { opacity: 0.5, cursor: 'not-allowed' }
            : isSelected
              ? {
                  borderColor: '#3b82f6',
                  backgroundColor: 'rgba(59, 130, 246, 0.08)',
                  boxShadow: '0 0 0 2px rgba(59, 130, 246, 0.2)',
                }
              : {
                  borderColor: 'var(--semi-color-border)',
                }),
        }}
      >
        <div className='flex items-center gap-3'>
          {/* Radio indicator */}
          {isSelected ? (
            <div
              style={{
                width: 22,
                height: 22,
                borderRadius: '50%',
                backgroundColor: '#3b82f6',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                boxShadow: '0 0 0 3px rgba(59, 130, 246, 0.25)',
              }}
            >
              <svg width='12' height='12' viewBox='0 0 12 12' fill='none'>
                <path
                  d='M2.5 6L5 8.5L9.5 3.5'
                  stroke='white'
                  strokeWidth='2'
                  strokeLinecap='round'
                  strokeLinejoin='round'
                />
              </svg>
            </div>
          ) : (
            <div
              style={{
                width: 22,
                height: 22,
                borderRadius: '50%',
                border: '2px solid var(--semi-color-border)',
                flexShrink: 0,
              }}
            />
          )}
          <span
            className='font-medium text-sm'
            style={{
              color: isSelected ? '#2563eb' : 'var(--semi-color-text-0)',
              fontWeight: isSelected ? 600 : 500,
            }}
          >
            {t(method.name)}
          </span>
        </div>
        <div className='flex-shrink-0'>{getPayMethodIcon(method)}</div>
      </div>
    );

    if (disabled && needsMinTooltip) {
      return (
        <Tooltip
          content={t('此支付方式最低充值金额为') + ' ' + minTopupVal}
          key={method.type}
        >
          {card}
        </Tooltip>
      );
    }
    return card;
  };

  // ─── Payment Summary Sidebar ───────────────────────────────────
  const paymentSummary = (
    <div className='w-full lg:w-[320px] flex-shrink-0'>
      <div
        className='rounded-2xl p-6 lg:sticky lg:top-20'
        style={{ background: 'var(--semi-color-fill-0)' }}
      >
        <div className='space-y-4'>
          <div className='flex justify-between items-center'>
            <Text type='tertiary' size='small'>
              {t('充值金额')}
            </Text>
            <Text strong style={{ fontSize: 15 }}>
              {currencySymbol}{topUpCount || 0}
            </Text>
          </div>
          <div className='flex justify-between items-center'>
            <span className='flex items-center gap-1'>
              <Text type='tertiary' size='small'>
                {t('服务费')}
              </Text>
              {includeTax && (
                <Tooltip content={t('包含票面产生的赋税、财务开票业务费用等')}>
                  <Info size={14} style={{ color: 'var(--semi-color-text-2)', cursor: 'pointer' }} />
                </Tooltip>
              )}
            </span>
            <Text strong style={{ fontSize: 15 }}>
              {includeTax ? `${parseFloat((taxRate * 100).toFixed(2))}%` : '0%'}
            </Text>
          </div>
          <div className='flex justify-between items-center'>
            <Text type='tertiary' size='small'>
              {t('开票额')}
            </Text>
            <Text strong style={{ fontSize: 15 }}>
              {includeTax ? `${t('等值')}${currencySymbol}${topUpCount || 0}` : `${currencySymbol}0`}
            </Text>
          </div>

          <div
            style={{
              borderTop: '2px dashed var(--semi-color-border)',
              margin: '8px 0',
            }}
          />

          <div className='flex justify-between items-center'>
            <Text strong>{t('支付金额')}</Text>
            {showAmountSkeleton ? (
              <Skeleton.Title
                style={{ width: 80, height: 20, borderRadius: 6 }}
              />
            ) : (
              <Text strong style={{ fontSize: 16 }}>
                {getPayAmount()}
              </Text>
            )}
          </div>

          <Button
            theme='solid'
            size='large'
            block
            loading={paymentLoading && payWay === selectedPayMethod}
            disabled={
              !hasOnlineTopUp ||
              !selectedPayMethod ||
              isPayMethodDisabled(selectedPayMethod)
            }
            onClick={handlePayFromSidebar}
            style={{
              marginTop: 8,
              background: 'var(--semi-color-text-0)',
              borderColor: 'var(--semi-color-text-0)',
              borderRadius: 12,
              height: 48,
              fontSize: 16,
              fontWeight: 600,
            }}
          >
            {t('支付')}
          </Button>
        </div>
      </div>
    </div>
  );

  // ─── Main Content: Online Recharge ─────────────────────────────
  const onlineRechargeContent = (
    <Card
      className='!rounded-2xl !border-0 shadow-sm'
      bodyStyle={{ padding: '24px' }}
    >
      <Typography.Title heading={4} style={{ marginBottom: 20 }}>
        {t('在线充值')}
      </Typography.Title>

      {statusLoading ? (
        <div className='py-8 flex justify-center'>
          <Spin size='large' />
        </div>
      ) : hasOnlineTopUp ? (
        <Form
          getFormApi={(api) => (onlineFormApiRef.current = api)}
          initValues={{ topUpCount: topUpCount }}
        >
          <div className='space-y-5'>
            {/* Payment Methods Grid */}
            {regularPayMethods.length > 0 && (
              <div className='grid grid-cols-1 sm:grid-cols-2 gap-3'>
                {regularPayMethods.map((method) =>
                  renderPayMethodCard(method),
                )}
              </div>
            )}

            {/* Warning Banner */}
            <Banner
              type='warning'
              icon={<AlertTriangle size={16} />}
              description={t('充值成功后不支持退款，请确认后再操作。')}
              className='!rounded-xl'
              closeIcon={null}
            />

            {/* Tax Type Toggle */}
            <div
              className='rounded-xl px-4 py-3'
              style={{ background: 'var(--semi-color-fill-0)' }}
            >
              <div className='flex items-center justify-between'>
                <div className='flex items-center gap-2'>
                  <FileText size={16} style={{ color: 'var(--semi-color-text-2)' }} />
                  <Text strong size='small'>
                    {t('税费类型')}
                  </Text>
                </div>
                <div className='flex rounded-lg overflow-hidden' style={{ border: '1px solid var(--semi-color-border)' }}>
                  {[
                    { value: false, label: t('不含税') },
                    { value: true, label: t('含税') },
                  ].map((opt) => (
                    <div
                      key={String(opt.value)}
                      className='cursor-pointer select-none transition-all'
                      style={{
                        padding: '6px 16px',
                        fontSize: 13,
                        fontWeight: includeTax === opt.value ? 600 : 400,
                        backgroundColor: includeTax === opt.value ? '#3b82f6' : 'transparent',
                        color: includeTax === opt.value ? '#fff' : 'var(--semi-color-text-0)',
                      }}
                      onClick={() => setIncludeTax(opt.value)}
                    >
                      {opt.label}
                    </div>
                  ))}
                </div>
              </div>
              <div
                className='flex items-center gap-1.5 mt-2'
                style={{
                  padding: '8px 12px',
                  borderRadius: 8,
                  backgroundColor: includeTax
                    ? 'rgba(59, 130, 246, 0.06)'
                    : 'rgba(245, 158, 11, 0.06)',
                  border: includeTax
                    ? '1px solid rgba(59, 130, 246, 0.15)'
                    : '1px solid rgba(245, 158, 11, 0.15)',
                }}
              >
                <Text
                  size='small'
                  style={{
                    color: includeTax
                      ? 'var(--semi-color-primary)'
                      : 'var(--semi-color-warning)',
                    fontSize: 12,
                  }}
                >
                  {includeTax
                    ? t('已选择含税支付，支付完成后可在充值记录中申请开具发票。')
                    : t('选择不含税支付，本订单将无法开具发票。如需开票，请选择含税支付方式。2026年05月01日 00:00:00（UTC+0）前的充值订单如需开票，请联系站长处理；此后的订单请按照页面指引自助申请开票。')}
                </Text>
              </div>
            </div>

            {/* Amount Input */}
            {(enableOnlineTopUp ||
              enableStripeTopUp ||
              enableWaffoTopUp ||
              enableWaffoPancakeTopUp) && (
              <div>
                <Form.InputNumber
                  field='topUpCount'
                  label={t('充值金额')}
                  disabled={
                    !enableOnlineTopUp &&
                    !enableStripeTopUp &&
                    !enableWaffoTopUp &&
                    !enableWaffoPancakeTopUp
                  }
                  placeholder={'0'}
                  value={topUpCount}
                  min={0}
                  max={999999999}
                  step={1}
                  precision={0}
                  prefix={currencySymbol}
                  onChange={async (value) => {
                    if (value && value >= 1) {
                      setTopUpCount(value);
                      setSelectedPreset(null);
                      await getAmount(value);
                    }
                  }}
                  onBlur={(e) => {
                    const value = parseInt(e.target.value);
                    if (!value || value < 1) {
                      setTopUpCount(1);
                      getAmount(1);
                    }
                  }}
                  formatter={(value) => (value ? `${value}` : '')}
                  parser={(value) =>
                    value ? parseInt(value.replace(/[^\d]/g, '')) : 0
                  }
                  extraText={
                    <Text type='tertiary' size='small'>
                      {t('金额需要')} {'>'}= {currencySymbol}{minTopUp}
                    </Text>
                  }
                  style={{ width: '100%' }}
                />
              </div>
            )}

            {/* Preset Amounts */}
            {(enableOnlineTopUp ||
              enableStripeTopUp ||
              enableWaffoTopUp) &&
              presetAmounts.length > 0 && (
                <div>
                  <div className='flex items-center gap-2 mb-3'>
                    <Text strong size='small'>
                      {t('选择充值额度')}
                    </Text>
                    {(() => {
                      const { symbol, rate, type } = getCurrencyConfig();
                      if (type === 'USD') return null;
                      return (
                        <Text
                          type='tertiary'
                          size='small'
                        >
                          (1 $ = {rate.toFixed(2)} {symbol})
                        </Text>
                      );
                    })()}
                  </div>
                  <div className='grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2'>
                    {presetAmounts.map((preset, index) => {
                      const discount =
                        preset.discount ||
                        topupInfo?.discount?.[preset.value] ||
                        1.0;
                      const originalPrice = preset.value * priceRatio;
                      const discountedPrice = originalPrice * discount;
                      const hasDiscount = discount < 1.0;
                      const actualPay = discountedPrice;
                      const save = originalPrice - discountedPrice;
                      const { symbol, rate, type } = getCurrencyConfig();
                      const statusStr = localStorage.getItem('status');
                      let localUsdRate = 7;
                      try {
                        if (statusStr) {
                          const s = JSON.parse(statusStr);
                          localUsdRate = s?.usd_exchange_rate || 7;
                        }
                      } catch (e) {}
                      let displayValue = preset.value;
                      let displayActualPay = actualPay;
                      let displaySave = save;
                      if (type === 'USD') {
                        displayActualPay = actualPay / localUsdRate;
                        displaySave = save / localUsdRate;
                      } else if (type === 'CNY') {
                        displayValue = preset.value * localUsdRate;
                      } else if (type === 'CUSTOM') {
                        displayValue = preset.value * rate;
                        displayActualPay = (actualPay / localUsdRate) * rate;
                        displaySave = (save / localUsdRate) * rate;
                      }

                      // 含税时加上税费
                      if (includeTax) {
                        displayActualPay = displayActualPay * (1 + taxRate);
                      }

                      return (
                        <div
                          key={index}
                          className='text-center rounded-xl p-3 border-2 cursor-pointer transition-all'
                          style={
                            selectedPreset === preset.value
                              ? {
                                  borderColor: '#3b82f6',
                                  backgroundColor: 'rgba(59, 130, 246, 0.08)',
                                  boxShadow: '0 0 0 2px rgba(59, 130, 246, 0.2)',
                                }
                              : {
                                  borderColor: 'var(--semi-color-border)',
                                }
                          }
                          onClick={() => {
                            selectPresetAmount(preset);
                            onlineFormApiRef.current?.setValue(
                              'topUpCount',
                              preset.value,
                            );
                          }}
                        >
                          <Typography.Title
                            heading={6}
                            style={{ margin: '0 0 4px 0' }}
                          >
                            <Coins size={14} className='mr-1' />
                            {formatLargeNumber(displayValue)} {symbol}
                            {hasDiscount && (
                              <Tag
                                style={{ marginLeft: 4 }}
                                color='green'
                                size='small'
                              >
                                {t('折').includes('off')
                                  ? (
                                      (1 - parseFloat(discount)) *
                                      100
                                    ).toFixed(1)
                                  : (discount * 10).toFixed(1)}
                                {t('折')}
                              </Tag>
                            )}
                          </Typography.Title>
                          <Text
                            type='tertiary'
                            size='small'
                            style={{ fontSize: 11 }}
                          >
                            {t('实付')} {symbol}
                            {displayActualPay.toFixed(2)}
                            {hasDiscount &&
                              `，${t('节省')} ${symbol}${displaySave.toFixed(2)}`}
                          </Text>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

            {/* Creem Section */}
            {enableCreemTopUp && creemProducts.length > 0 && (
              <div>
                <Text strong size='small' style={{ marginBottom: 12, display: 'block' }}>
                  {t('Creem 充值')}
                </Text>
                <div className='grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3'>
                  {creemProducts.map((product, index) => (
                    <Card
                      key={index}
                      onClick={() => creemPreTopUp(product)}
                      className='cursor-pointer !rounded-2xl transition-all hover:shadow-md border-gray-200 hover:border-gray-300'
                      bodyStyle={{ textAlign: 'center', padding: '16px' }}
                    >
                      <div className='font-medium text-lg mb-2'>
                        {product.name}
                      </div>
                      <div className='text-sm text-gray-600 mb-2'>
                        {t('充值额度')}: {product.quota}
                      </div>
                      <div className='text-lg font-semibold text-blue-600'>
                        {product.currency === 'EUR' ? '\u20AC' : '$'}
                        {product.price}
                      </div>
                    </Card>
                  ))}
                </div>
              </div>
            )}
          </div>
        </Form>
      ) : (
        <Banner
          type='info'
          description={t(
            '管理员未开启在线充值功能，请联系管理员开启或使用兑换码充值。',
          )}
          className='!rounded-xl'
          closeIcon={null}
        />
      )}
    </Card>
  );

  // ─── Card Redemption ───────────────────────────────────────────
  const redemptionContent = showRedemption ? (
    <Card
      className='!rounded-2xl !border-0 shadow-sm'
      bodyStyle={{ padding: '24px' }}
    >
      <Typography.Title heading={4} style={{ marginBottom: 16 }}>
        {t('卡密充值')}
      </Typography.Title>
      <Form
        getFormApi={(api) => (redeemFormApiRef.current = api)}
        initValues={{ redemptionCode: redemptionCode }}
      >
        <div className='flex gap-3 items-center'>
          <div className='flex-1'>
            <Input
              placeholder={t('兑换码')}
              value={redemptionCode}
              onChange={(value) => setRedemptionCode(value)}
              showClear
              style={{ width: '100%' }}
              size='large'
            />
          </div>
          <Button
            theme='solid'
            size='large'
            onClick={topUp}
            loading={isSubmitting}
            style={{
              background: 'var(--semi-color-text-0)',
              borderColor: 'var(--semi-color-text-0)',
              borderRadius: 8,
              paddingLeft: 24,
              paddingRight: 24,
            }}
          >
            {t('兑换')}
          </Button>
        </div>
        {topUpLink && (
          <div className='mt-2'>
            <Text type='tertiary' size='small'>
              {t('在找兑换码？')}
              <Text
                type='secondary'
                underline
                className='cursor-pointer'
                onClick={openTopUpLink}
                size='small'
              >
                {t('购买兑换码')}
              </Text>
            </Text>
          </div>
        )}
      </Form>
    </Card>
  ) : null;

  // ─── Main Render ───────────────────────────────────────────────
  return (
    <div className='space-y-6'>
      {/* Account Statistics */}
      {statsBar}

      {/* Two-column layout: Form + Summary */}
      <div className='flex flex-col lg:flex-row gap-6'>
        {/* Left column */}
        <div className='flex-1 space-y-6 min-w-0'>
          {onlineRechargeContent}
          {redemptionContent}
        </div>

        {/* Right column - Payment Summary */}
        {hasOnlineTopUp && !statusLoading && paymentSummary}
      </div>

      {/* Subscription Plans */}
      {shouldShowSubscription && (
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
          includeTax={includeTax}
          setIncludeTax={setIncludeTax}
          taxRate={taxRate}
        />
      )}
    </div>
  );
};

export default RechargeCard;
