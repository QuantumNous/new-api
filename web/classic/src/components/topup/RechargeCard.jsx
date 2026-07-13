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

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Banner,
  Button,
  Card,
  Form,
  Skeleton,
  Spin,
  Tabs,
  TabPane,
  Tag,
  Tooltip,
  Typography,
} from '@douyinfe/semi-ui';
import { IconGift } from '@douyinfe/semi-icons';
import { SiAlipay, SiStripe, SiWechat } from 'react-icons/si';
import {
  ArrowRight,
  Coins,
  Copy,
  CreditCard,
  Receipt,
  Sparkles,
  Wallet,
} from 'lucide-react';
import { copy as copyText, showSuccess } from '../../helpers';
// import { useMinimumLoadingTime } from '../../hooks/common/useMinimumLoadingTime';
import { getCurrencyConfig } from '../../helpers/render';
import SubscriptionPlansCard from './SubscriptionPlansCard';

const { Text, Title } = Typography;

const RechargeCard = ({
  t,
  enableOnlineTopUp,
  enableStripeTopUp,
  enableAlipayTopUp,
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
  autoRenewSubscription = null,
  reloadSubscriptionSelf,
}) => {
  const onlineFormApiRef = useRef(null);
  const redeemFormApiRef = useRef(null);
  const initialTabSetRef = useRef(false);
  const [activeTab, setActiveTab] = useState('topup');
  const [selectedPayment, setSelectedPayment] = useState('');
  // const showAmountSkeleton = useMinimumLoadingTime(amountLoading, 200);
  const showAmountSkeleton = false;

  const shouldShowSubscription =
    !subscriptionLoading && subscriptionPlans.length > 0;
  const regularPayMethods = useMemo(() => payMethods || [], [payMethods]);

  const isPaymentDisabled = (payMethod) => {
    const minTopupVal = Number(payMethod.min_topup) || 0;
    const isStripe = payMethod.type === 'stripe';
    const isAlipay = payMethod.type === 'alipay';
    const isWaffo =
      typeof payMethod.type === 'string' && payMethod.type.startsWith('waffo:');
    const isWaffoPancake = payMethod.type === 'waffo_pancake';

    return (
      (!enableOnlineTopUp &&
        !isStripe &&
        !isAlipay &&
        !isWaffo &&
        !isWaffoPancake) ||
      (!enableStripeTopUp && isStripe) ||
      (!enableAlipayTopUp && isAlipay) ||
      (!enableWaffoTopUp && isWaffo) ||
      (!enableWaffoPancakeTopUp && isWaffoPancake) ||
      minTopupVal > Number(topUpCount || 0)
    );
  };

  useEffect(() => {
    if (initialTabSetRef.current) return;
    if (subscriptionLoading) return;
    setActiveTab(shouldShowSubscription ? 'subscription' : 'topup');
    initialTabSetRef.current = true;
  }, [shouldShowSubscription, subscriptionLoading]);

  useEffect(() => {
    if (!shouldShowSubscription && activeTab !== 'topup') {
      setActiveTab('topup');
    }
  }, [shouldShowSubscription, activeTab]);

  const handleCopyInviteLink = async () => {
    const affCode = userState?.user?.aff_code;
    if (!affCode) return;
    await copyText(`${window.location.origin}/register?aff=${affCode}`);
    showSuccess(t('邀请链接已复制到剪切板'));
  };

  useEffect(() => {
    if (selectedPayment) {
      const current = regularPayMethods.find(
        (method) => method.type === selectedPayment,
      );
      if (current && !isPaymentDisabled(current)) return;
    }

    const firstAvailable = regularPayMethods.find(
      (method) => !isPaymentDisabled(method),
    );
    setSelectedPayment(firstAvailable?.type || '');
  }, [
    regularPayMethods,
    selectedPayment,
    topUpCount,
    enableOnlineTopUp,
    enableStripeTopUp,
    enableAlipayTopUp,
    enableWaffoTopUp,
    enableWaffoPancakeTopUp,
  ]);

  const renderPaymentIcon = (payMethod) => {
    if (payMethod.type === 'alipay') {
      return <SiAlipay size={18} color='#1677ff' />;
    }
    if (payMethod.type === 'wxpay') {
      return <SiWechat size={18} color='#07c160' />;
    }
    if (payMethod.type === 'stripe') {
      return <SiStripe size={18} color='#635bff' />;
    }
    if (payMethod.icon) {
      return (
        <img
          src={payMethod.icon}
          alt={payMethod.name}
          className='billing-pay-method-img'
        />
      );
    }
    return (
      <CreditCard
        size={18}
        color={payMethod.color || 'var(--semi-color-primary)'}
      />
    );
  };

  const renderPaymentMethod = (payMethod) => {
    const disabled = isPaymentDisabled(payMethod);
    const minTopupVal = Number(payMethod.min_topup) || 0;
    const button = (
      <button
        key={payMethod.type}
        type='button'
        className={`billing-pay-method ${
          selectedPayment === payMethod.type ? 'is-active' : ''
        }`}
        disabled={disabled}
        onClick={() => setSelectedPayment(payMethod.type)}
      >
        {renderPaymentIcon(payMethod)}
        <span>{payMethod.name}</span>
      </button>
    );

    if (disabled && minTopupVal > Number(topUpCount || 0)) {
      return (
        <Tooltip
          content={`${t('此支付方式最低充值金额为')} ${minTopupVal}`}
          key={payMethod.type}
        >
          {button}
        </Tooltip>
      );
    }

    return button;
  };

  const handleCustomAmountChange = async (value) => {
    if (value && value >= 1) {
      setTopUpCount(value);
      setSelectedPreset(null);
      await getAmount(value);
    }
  };

  const handleCustomAmountBlur = (e) => {
    const value = parseInt(e.target.value);
    if (!value || value < 1) {
      setTopUpCount(1);
      getAmount(1);
    }
  };

  const handlePresetClick = (preset) => {
    selectPresetAmount(preset);
    onlineFormApiRef.current?.setValue('topUpCount', preset.value);
  };

  const handleTopUpNow = () => {
    if (!selectedPayment) return;
    preTopUp(selectedPayment);
  };

  const renderPresetCard = (preset, index) => {
    const discount =
      preset.discount || topupInfo?.discount?.[preset.value] || 1;
    const originalPrice = preset.value * priceRatio;
    const discountedPrice = originalPrice * discount;
    const hasDiscount = discount < 1;
    const save = originalPrice - discountedPrice;

    const { symbol, rate, type } = getCurrencyConfig();
    const statusStr = localStorage.getItem('status');
    let usdRate = 7;
    try {
      if (statusStr) {
        const status = JSON.parse(statusStr);
        usdRate = status?.usd_exchange_rate || 7;
      }
    } catch (e) {}

    let displayValue = preset.value;
    let displayActualPay = discountedPrice;
    let displaySave = save;

    if (type === 'USD') {
      displayActualPay = discountedPrice / usdRate;
      displaySave = save / usdRate;
    } else if (type === 'CNY') {
      displayValue = preset.value * usdRate;
    } else if (type === 'CUSTOM') {
      displayValue = preset.value * rate;
      displayActualPay = (discountedPrice / usdRate) * rate;
      displaySave = (save / usdRate) * rate;
    }

    return (
      <button
        key={index}
        type='button'
        className={`billing-amount-option ${
          selectedPreset === preset.value ? 'is-active' : ''
        }`}
        onClick={() => handlePresetClick(preset)}
      >
        <span className='billing-amount-main'>
          {formatLargeNumber(displayValue)} {symbol}
        </span>
        <span className='billing-amount-meta'>
          {t('实付')} {symbol}
          {displayActualPay.toFixed(2)}
        </span>
        {hasDiscount && (
          <Tag color='green' size='small' className='billing-amount-tag'>
            {t('折').includes('off')
              ? ((1 - parseFloat(discount)) * 100).toFixed(1)
              : (discount * 10).toFixed(1)}
            {t('折')}
          </Tag>
        )}
        {hasDiscount && (
          <span className='billing-amount-save'>
            {t('节省')} {symbol}
            {displaySave.toFixed(2)}
          </span>
        )}
      </button>
    );
  };

  const topupContent = (
    <div className='billing-wallet-stack'>
      <Card className='billing-balance-card'>
        <div className='billing-balance-main'>
          <div className='billing-balance-icon'>
            <Wallet size={28} strokeWidth={1.9} />
          </div>
          <div>
            <div className='billing-balance-label'>{t('当前余额')}</div>
            <div className='billing-balance-value'>
              {renderQuota(userState?.user?.quota)}
            </div>
          </div>
        </div>
        <div className='billing-balance-side'>
          <div>
            <span>{t('历史消耗')}</span>
            <strong className='billing-used'>
              {renderQuota(userState?.user?.used_quota)}
            </strong>
          </div>
          <div>
            <span>{t('请求次数')}</span>
            <strong>{userState?.user?.request_count || 0}</strong>
          </div>
        </div>
      </Card>

      <div className='billing-wallet-grid'>
        <Card className='billing-wallet-panel billing-online-panel'>
          <div className='billing-panel-head'>
            <span className='billing-panel-icon'>
              <CreditCard size={18} />
            </span>
            <div>
              <h2>{t('在线充值')}</h2>
              <p>{t('选择支付方式和充值额度')}</p>
            </div>
          </div>

          {statusLoading ? (
            <div className='billing-loading'>
              <Spin size='large' />
            </div>
          ) : enableOnlineTopUp ||
            enableAlipayTopUp ||
            enableStripeTopUp ||
            enableCreemTopUp ||
            enableWaffoTopUp ||
            enableWaffoPancakeTopUp ? (
            <Form
              getFormApi={(api) => (onlineFormApiRef.current = api)}
              initValues={{ topUpCount }}
              className='billing-wallet-form'
            >
              {(enableOnlineTopUp ||
                enableAlipayTopUp ||
                enableStripeTopUp ||
                enableWaffoTopUp ||
                enableWaffoPancakeTopUp) && (
                <Form.Slot label={t('选择支付方式')}>
                  <div className='billing-pay-grid'>
                    {regularPayMethods.map(renderPaymentMethod)}
                  </div>
                </Form.Slot>
              )}

              {(enableOnlineTopUp ||
                enableAlipayTopUp ||
                enableStripeTopUp ||
                enableWaffoTopUp) && (
                <Form.Slot
                  label={t('选择充值额度')}
                >
                  <div className='billing-amount-grid'>
                    {presetAmounts.map(renderPresetCard)}
                  </div>
                </Form.Slot>
              )}

              {(enableOnlineTopUp ||
                enableAlipayTopUp ||
                enableStripeTopUp ||
                enableWaffoTopUp ||
                enableWaffoPancakeTopUp) && (
                <Form.InputNumber
                  field='topUpCount'
                  label={t('充值数量')}
                  placeholder={
                    t('充值数量，最低 ') + renderQuotaWithAmount(minTopUp)
                  }
                  value={topUpCount}
                  min={minTopUp}
                  max={999999999}
                  step={1}
                  precision={0}
                  onChange={handleCustomAmountChange}
                  onBlur={handleCustomAmountBlur}
                  formatter={(value) => (value ? `${value}` : '')}
                  parser={(value) =>
                    value ? parseInt(value.replace(/[^\d]/g, '')) : 0
                  }
                  prefix={<Coins size={16} className='mx-3' />}
                  className='billing-custom-amount'
                  extraText={
                    <Skeleton
                      loading={showAmountSkeleton}
                      active
                      placeholder={
                        <Skeleton.Title
                          style={{ width: 120, height: 20, borderRadius: 6 }}
                        />
                      }
                    >
                      <Text className='billing-payable-text'>
                        {t('实付金额：')}
                        <span>{renderAmount()}</span>
                      </Text>
                    </Skeleton>
                  }
                  style={{ width: '100%' }}
                  size='large'
                />
              )}

              {enableCreemTopUp && creemProducts.length > 0 && (
                <Form.Slot label={t('Creem 充值')}>
                  <div className='billing-creem-grid'>
                    {creemProducts.map((product, index) => (
                      <button
                        key={index}
                        type='button'
                        onClick={() => creemPreTopUp(product)}
                        className='billing-creem-card'
                      >
                        <span>{product.name}</span>
                        <strong>
                          {product.currency === 'EUR' ? '€' : '$'}
                          {product.price}
                        </strong>
                        <small>
                          {t('充值额度')}: {product.quota}
                        </small>
                      </button>
                    ))}
                  </div>
                </Form.Slot>
              )}

              {(enableOnlineTopUp ||
                enableAlipayTopUp ||
                enableStripeTopUp ||
                enableWaffoTopUp ||
                enableWaffoPancakeTopUp) && (
                <Button
                  type='primary'
                  theme='solid'
                  className='billing-primary-action'
                  loading={paymentLoading && payWay === selectedPayment}
                  disabled={!selectedPayment}
                  onClick={handleTopUpNow}
                >
                  <Sparkles size={16} className='mr-[8px]' />
                  {t('立即充值')}
                  <ArrowRight size={16} className='ml-[8px]' />
                </Button>
              )}
            </Form>
          ) : (
            <Banner
              type='info'
              description={t(
                '管理员未开启在线充值功能，请联系管理员开启或使用兑换码充值。',
              )}
              className='billing-banner'
              closeIcon={null}
            />
          )}
        </Card>

        <Card className='billing-wallet-panel billing-redeem-panel'>
          <div className='billing-panel-head'>
            <span className='billing-panel-icon billing-panel-icon-warm'>
              <IconGift />
            </span>
            <div>
              <h2>{t('兑换码充值')}</h2>
              <p>{t('输入兑换码即可到账')}</p>
            </div>
          </div>

          <div className='billing-redeem-callout'>
            <Sparkles size={18} />
            <div>
              <strong>{t('兑换码')}</strong>
              <span>{t('输入有效兑换码，立即领取额度')}</span>
            </div>
          </div>

          <Form
            getFormApi={(api) => (redeemFormApiRef.current = api)}
            initValues={{ redemptionCode }}
            className='billing-wallet-form'
          >
            <Form.Input
              field='redemptionCode'
              label={t('兑换码')}
              placeholder={t('请输入兑换码')}
              value={redemptionCode}
              onChange={(value) => setRedemptionCode(value)}
              prefix={<IconGift className='mx-2' />}
              showClear
              style={{ width: '100%' }}
              extraText={
                topUpLink && (
                  <Text type='tertiary'>
                    {t('在找兑换码？')}
                    <Text
                      type='secondary'
                      underline
                      className='cursor-pointer'
                      onClick={openTopUpLink}
                    >
                      {t('购买兑换码')}
                    </Text>
                  </Text>
                )
              }
            />
            <Button
              type='primary'
              theme='solid'
              onClick={topUp}
              loading={isSubmitting}
              className='billing-redeem-action'
            >
              <IconGift className='mr-[8px]' />
              {t('兑换额度')}
            </Button>
          </Form>
        </Card>
      </div>
    </div>
  );

  return (
    <div className='billing-wallet-page'>
      <div className='billing-wallet-header'>
        <div>
          <Title heading={2} className='billing-wallet-title'>
            {t('钱包管理')}
          </Title>
          <p className='billing-wallet-subtitle'>
            {t('为账户充值额度，查看余额和账单记录')}
          </p>
        </div>
        <div className='billing-wallet-actions'>
          <Button
            icon={<Copy size={16} />}
            theme='outline'
            onClick={handleCopyInviteLink}
            disabled={!userState?.user?.aff_code}
            className='billing-history-button billing-invite-button'
          >
            {t('复制邀请链接')}
          </Button>
          <Button
            icon={<Receipt size={16} />}
            theme='outline'
            onClick={onOpenHistory}
            className='billing-history-button'
          >
            {t('充值账单')}
          </Button>
        </div>
      </div>

      {shouldShowSubscription ? (
        <Tabs
          type='card'
          activeKey={activeTab}
          onChange={setActiveTab}
          className='billing-wallet-tabs'
        >
          <TabPane
            tab={
              <div className='flex items-center gap-2'>
                <Sparkles size={16} />
                {t('订阅套餐')}
              </div>
            }
            itemKey='subscription'
          >
            <div className='billing-subscription-pane'>
              <SubscriptionPlansCard
                t={t}
                loading={subscriptionLoading}
                plans={subscriptionPlans}
                payMethods={payMethods}
                enableAlipayTopUp={enableAlipayTopUp}
                enableOnlineTopUp={enableOnlineTopUp}
                enableStripeTopUp={enableStripeTopUp}
                enableCreemTopUp={enableCreemTopUp}
                billingPreference={billingPreference}
                onChangeBillingPreference={onChangeBillingPreference}
                activeSubscriptions={activeSubscriptions}
                allSubscriptions={allSubscriptions}
                autoRenewSubscription={autoRenewSubscription}
                reloadSubscriptionSelf={reloadSubscriptionSelf}
                withCard={false}
              />
            </div>
          </TabPane>
          <TabPane
            tab={
              <div className='flex items-center gap-2'>
                <Wallet size={16} />
                {t('额度充值')}
              </div>
            }
            itemKey='topup'
          >
            {topupContent}
          </TabPane>
        </Tabs>
      ) : (
        topupContent
      )}
    </div>
  );
};

export default RechargeCard;
