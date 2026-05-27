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

import React, { useEffect, useState, useContext, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  API,
  showError,
  showInfo,
  showSuccess,
  renderQuota,
  renderQuotaWithAmount,
  copy,
  getQuotaPerUnit,
} from '../../helpers';
import { Modal, Toast } from '@douyinfe/semi-ui';
import { useTranslation } from 'react-i18next';
import { UserContext } from '../../context/User';
import { StatusContext } from '../../context/Status';

import RechargeCard from './RechargeCard';
import InvitationCard from './InvitationCard';
import TransferModal from './modals/TransferModal';
import PaymentConfirmModal from './modals/PaymentConfirmModal';
import TopupHistoryModal from './modals/TopupHistoryModal';
import {
  getBillingDisplayText,
  isPublicWelfareBillingDisplay,
} from '../../helpers/billingDisplay';

const parseJsonArray = (value) => {
  if (Array.isArray(value)) {
    return value;
  }
  if (typeof value !== 'string' || value.trim() === '') {
    return [];
  }
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    return [];
  }
};

const parseJsonObject = (value) => {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value;
  }
  if (typeof value !== 'string' || value.trim() === '') {
    return {};
  }
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? parsed
      : {};
  } catch (e) {
    return {};
  }
};

const normalizePayMethods = (rawMethods, data = {}) =>
  parseJsonArray(rawMethods)
    .filter((method) => method?.name && method?.type)
    .map((method) => {
      const normalized = { ...method };
      const normalizedMinTopup = Number(normalized.min_topup);
      normalized.min_topup = Number.isFinite(normalizedMinTopup)
        ? normalizedMinTopup
        : 0;

      if (
        normalized.type === 'stripe' &&
        (!normalized.min_topup || normalized.min_topup <= 0)
      ) {
        const stripeMin = Number(data.stripe_min_topup);
        if (Number.isFinite(stripeMin)) {
          normalized.min_topup = stripeMin;
        }
      }

      if (!normalized.color) {
        if (normalized.type === 'alipay') {
          normalized.color = 'rgba(var(--semi-blue-5), 1)';
        } else if (normalized.type === 'wxpay') {
          normalized.color = 'rgba(var(--semi-green-5), 1)';
        } else if (normalized.type === 'stripe') {
          normalized.color = 'rgba(var(--semi-purple-5), 1)';
        } else if (normalized.type === 'creem') {
          normalized.color = 'rgba(var(--semi-teal-5), 1)';
        } else {
          normalized.color = 'rgba(var(--semi-primary-5), 1)';
        }
      }

      return normalized;
    });

const normalizePaymentMethodsByScene = (rawMethodsByScene, data = {}) => {
  const methodsByScene = parseJsonObject(rawMethodsByScene);
  return Object.keys(methodsByScene).reduce((result, scene) => {
    result[scene] = normalizePayMethods(methodsByScene[scene], data);
    return result;
  }, {});
};

const isEnabled = (value, fallback = false) =>
  value === undefined || value === null ? fallback : value !== false;

// Reject non-navigable schemes (e.g. javascript:, data:) and relative URLs.
// Only http / https are allowed for backend-provided redirect targets.
// Mirrors isSafeHttpCheckoutUrl in the default frontend's
// features/wallet/hooks/use-waffo-pancake-payment.ts.
function isSafeHttpCheckoutUrl(value) {
  const trimmed = (value || '').trim();
  if (!trimmed) {
    return false;
  }
  try {
    const u = new URL(trimmed);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}

const TopUp = () => {
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const [userState, userDispatch] = useContext(UserContext);
  const [statusState] = useContext(StatusContext);

  const [redemptionCode, setRedemptionCode] = useState('');
  const [amount, setAmount] = useState(0.0);
  const [minTopUp, setMinTopUp] = useState(statusState?.status?.min_topup || 1);
  const [topUpCount, setTopUpCount] = useState(
    statusState?.status?.min_topup || 1,
  );
  const [topUpLink, setTopUpLink] = useState('');
  const [enableOnlineTopUp, setEnableOnlineTopUp] = useState(
    statusState?.status?.enable_online_topup || false,
  );
  const [priceRatio, setPriceRatio] = useState(statusState?.status?.price || 1);

  const [enableStripeTopUp, setEnableStripeTopUp] = useState(
    statusState?.status?.enable_stripe_topup || false,
  );
  const [statusLoading, setStatusLoading] = useState(true);

  // Creem 相关状态
  const [creemProducts, setCreemProducts] = useState([]);
  const [enableCreemTopUp, setEnableCreemTopUp] = useState(false);
  const [creemOpen, setCreemOpen] = useState(false);
  const [selectedCreemProduct, setSelectedCreemProduct] = useState(null);

  // Waffo 相关状态
  const [enableWaffoTopUp, setEnableWaffoTopUp] = useState(false);
  const [waffoPayMethods, setWaffoPayMethods] = useState([]);
  const [waffoMinTopUp, setWaffoMinTopUp] = useState(1);
  const [enableWaffoPancakeTopUp, setEnableWaffoPancakeTopUp] = useState(false);
  const [waffoPancakeMinTopUp, setWaffoPancakeMinTopUp] = useState(1);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [open, setOpen] = useState(false);
  const [payWay, setPayWay] = useState('');
  const [amountLoading, setAmountLoading] = useState(false);
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [confirmLoading, setConfirmLoading] = useState(false);
  const [payMethods, setPayMethods] = useState([]);

  const affFetchedRef = useRef(false);

  // 邀请相关状态
  const [affLink, setAffLink] = useState('');
  const [openTransfer, setOpenTransfer] = useState(false);
  const [transferAmount, setTransferAmount] = useState(0);

  // 账单Modal状态
  const [openHistory, setOpenHistory] = useState(false);

  // 订阅相关
  const [subscriptionPlans, setSubscriptionPlans] = useState([]);
  const [subscriptionLoading, setSubscriptionLoading] = useState(true);
  const [billingPreference, setBillingPreference] =
    useState('subscription_first');
  const [activeSubscriptions, setActiveSubscriptions] = useState([]);
  const [allSubscriptions, setAllSubscriptions] = useState([]);
  const [subscriptionPayMethods, setSubscriptionPayMethods] = useState([]);
  const [enableSubscriptionPurchase, setEnableSubscriptionPurchase] =
    useState(true);
  const [enableEpaySubscription, setEnableEpaySubscription] = useState(false);
  const [enableStripeSubscription, setEnableStripeSubscription] =
    useState(false);
  const [enableCreemSubscription, setEnableCreemSubscription] = useState(false);

  // 预设充值额度选项
  const [presetAmounts, setPresetAmounts] = useState([]);
  const [selectedPreset, setSelectedPreset] = useState(null);

  // 充值配置信息
  const [topupInfo, setTopupInfo] = useState({
    amount_options: [],
    discount: {},
    display: {
      public_welfare_text_enabled: false,
      invitation_panel_enabled: true,
    },
    enable_redemption: true,
    features: {},
    payment_compliance_confirmed: true,
  });
  const [topupInfoLoaded, setTopupInfoLoaded] = useState(false);
  const invitationPanelEnabled =
    topupInfo.display?.invitation_panel_enabled !== false;
  const publicWelfareTextEnabled = isPublicWelfareBillingDisplay(
    topupInfo.display,
  );
  const walletTopupEnabled = topupInfo.features?.wallet_topup !== false;

  const confirmPayMethods = [
    ...payMethods,
    ...waffoPayMethods.map((method, index) => ({
      ...method,
      type: `waffo:${index}`,
      min_topup: waffoMinTopUp,
      color: method.color || 'rgba(var(--semi-primary-5), 1)',
    })),
  ];
  const hasWalletPaymentMethods = confirmPayMethods.length > 0;
  const canCalculateWalletAmount =
    walletTopupEnabled &&
    hasWalletPaymentMethods &&
    (enableOnlineTopUp ||
      enableStripeTopUp ||
      enableWaffoTopUp ||
      enableWaffoPancakeTopUp);

  const getPayMethodConfig = (payment) =>
    confirmPayMethods.find((method) => method.type === payment);

  const getPaymentMinTopUp = (payment) => {
    const configuredMinTopUp = Number(getPayMethodConfig(payment)?.min_topup);
    return Number.isFinite(configuredMinTopUp) && configuredMinTopUp > 0
      ? configuredMinTopUp
      : minTopUp;
  };

  const requestAmountByPayment = async (payment, value) => {
    if (payment === 'stripe') {
      return getStripeAmount(value);
    }
    if (payment === 'waffo_pancake') {
      return getWaffoPancakeAmount(value);
    }
    if (typeof payment === 'string' && payment.startsWith('waffo:')) {
      return getWaffoAmount(value);
    }
    return getAmount(value);
  };

  const topUp = async () => {
    if (redemptionCode === '') {
      showInfo(t('请输入兑换码！'));
      return;
    }
    setIsSubmitting(true);
    try {
      const res = await API.post('/api/user/topup', {
        key: redemptionCode,
      });
      const { success, message, data } = res.data;
      if (success) {
        showSuccess(t('兑换成功！'));
        Modal.success({
          title: t('兑换成功！'),
          content:
            getBillingDisplayText(
              'redeemQuota',
              t,
              publicWelfareTextEnabled,
            ) +
            '：' +
            renderQuota(data),
          centered: true,
        });
        if (userState.user) {
          const updatedUser = {
            ...userState.user,
            quota: userState.user.quota + data,
          };
          userDispatch({ type: 'login', payload: updatedUser });
        }
        setRedemptionCode('');
      } else {
        showError(message);
      }
    } catch (err) {
      showError(t('请求失败'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const openTopUpLink = () => {
    if (!topUpLink) {
      showError(t('超级管理员未设置支持链接！'));
      return;
    }
    window.open(topUpLink, '_blank');
  };

  const preTopUp = async (payment) => {
    if (payment === 'stripe') {
      if (!enableStripeTopUp) {
        showError(t('管理员未开启 Stripe 支付！'));
        return;
      }
    } else if (payment === 'waffo_pancake') {
      if (!enableWaffoPancakeTopUp) {
        showError(t('管理员未开启 Waffo Pancake 支付！'));
        return;
      }
    } else if (payment.startsWith('waffo:')) {
      if (!enableWaffoTopUp) {
        showError(t('管理员未开启 Waffo 支付！'));
        return;
      }
    } else {
      if (!enableOnlineTopUp) {
        showError(t('管理员未开启在线支付！'));
        return;
      }
    }

    setPayWay(payment);
    setPaymentLoading(true);
    try {
      const selectedMinTopUp = getPaymentMinTopUp(payment);
      await requestAmountByPayment(payment);

      if (topUpCount < selectedMinTopUp) {
        showError(
          getBillingDisplayText(
            'topupAmount',
            t,
            publicWelfareTextEnabled,
          ) +
            t('不能小于') +
            selectedMinTopUp,
        );
        return;
      }
      setOpen(true);
    } catch (error) {
      showError(t('获取金额失败'));
    } finally {
      setPaymentLoading(false);
    }
  };

  const onlineTopUp = async () => {
    if (payWay === 'waffo_pancake') {
      setConfirmLoading(true);
      try {
        await waffoPancakeTopUp();
      } finally {
        setOpen(false);
        setConfirmLoading(false);
      }
      return;
    }

    if (payWay.startsWith('waffo:')) {
      const payMethodIndex = Number(payWay.split(':')[1]);
      setConfirmLoading(true);
      try {
        await waffoTopUp(Number.isFinite(payMethodIndex) ? payMethodIndex : 0);
      } finally {
        setOpen(false);
        setConfirmLoading(false);
      }
      return;
    }

    if (payWay === 'stripe') {
      // Stripe 支付处理
      if (amount === 0) {
        await getStripeAmount();
      }
    } else {
      // 普通支付处理
      if (amount === 0) {
        await getAmount();
      }
    }

    if (topUpCount < minTopUp) {
      showError(
        getBillingDisplayText(
          'topupAmount',
          t,
          publicWelfareTextEnabled,
        ) +
          t('不能小于') +
          minTopUp,
      );
      return;
    }
    setConfirmLoading(true);
    try {
      let res;
      if (payWay === 'stripe') {
        // Stripe 支付请求
        res = await API.post('/api/user/stripe/pay', {
          amount: parseInt(topUpCount),
          payment_method: 'stripe',
        });
      } else {
        // 普通支付请求
        res = await API.post('/api/user/pay', {
          amount: parseInt(topUpCount),
          payment_method: payWay,
        });
      }

      if (res !== undefined) {
        const { message, data } = res.data;
        if (message === 'success') {
          if (payWay === 'stripe') {
            // Stripe 支付回调处理
            window.open(data.pay_link, '_blank');
          } else {
            // 普通支付表单提交
            let params = data;
            let url = res.data.url;
            let form = document.createElement('form');
            form.action = url;
            form.method = 'POST';
            let isSafari =
              navigator.userAgent.indexOf('Safari') > -1 &&
              navigator.userAgent.indexOf('Chrome') < 1;
            if (!isSafari) {
              form.target = '_blank';
            }
            for (let key in params) {
              let input = document.createElement('input');
              input.type = 'hidden';
              input.name = key;
              input.value = params[key];
              form.appendChild(input);
            }
            document.body.appendChild(form);
            form.submit();
            document.body.removeChild(form);
          }
        } else {
          const errorMsg =
            typeof data === 'string' ? data : message || t('支付失败');
          showError(errorMsg);
        }
      } else {
        showError(res);
      }
    } catch (err) {
      showError(t('支付请求失败'));
    } finally {
      setOpen(false);
      setConfirmLoading(false);
    }
  };

  const creemPreTopUp = async (product) => {
    if (!enableCreemTopUp) {
      showError(t('管理员未开启 Creem 支付！'));
      return;
    }
    setSelectedCreemProduct(product);
    setCreemOpen(true);
  };

  const onlineCreemTopUp = async () => {
    if (!selectedCreemProduct) {
      showError(t('请选择产品'));
      return;
    }
    // Validate product has required fields
    if (!selectedCreemProduct.productId) {
      showError(t('产品配置错误，请联系管理员'));
      return;
    }
    setConfirmLoading(true);
    try {
      const res = await API.post('/api/user/creem/pay', {
        product_id: selectedCreemProduct.productId,
        payment_method: 'creem',
      });
      if (res !== undefined) {
        const { message, data } = res.data;
        if (message === 'success') {
          processCreemCallback(data);
        } else {
          const errorMsg =
            typeof data === 'string' ? data : message || t('支付失败');
          showError(errorMsg);
        }
      } else {
        showError(res);
      }
    } catch (err) {
      showError(t('支付请求失败'));
    } finally {
      setCreemOpen(false);
      setConfirmLoading(false);
    }
  };

  const waffoTopUp = async (payMethodIndex) => {
    try {
      if (topUpCount < waffoMinTopUp) {
        showError(
          getBillingDisplayText(
            'topupAmount',
            t,
            publicWelfareTextEnabled,
          ) +
            t('不能小于') +
            waffoMinTopUp,
        );
        return;
      }
      setPaymentLoading(true);
      const requestBody = {
        amount: parseInt(topUpCount),
      };
      if (payMethodIndex != null) {
        requestBody.pay_method_index = payMethodIndex;
      }
      const res = await API.post('/api/user/waffo/pay', requestBody);
      if (res !== undefined) {
        const { message, data } = res.data;
        if (message === 'success' && data?.payment_url) {
          window.open(data.payment_url, '_blank');
        } else {
          showError(data || t('支付请求失败'));
        }
      } else {
        showError(res);
      }
    } catch (e) {
      showError(t('支付请求失败'));
    } finally {
      setPaymentLoading(false);
    }
  };

  const getWaffoAmount = async (value) => {
    if (value === undefined) {
      value = topUpCount;
    }
    setAmountLoading(true);
    try {
      const res = await API.post('/api/user/waffo/amount', {
        amount: parseInt(value),
      });
      if (res !== undefined) {
        const { message, data } = res.data;
        if (message === 'success') {
          setAmount(parseFloat(data));
        } else {
          setAmount(0);
          Toast.error({ content: '错误：' + data, id: 'getAmount' });
        }
      } else {
        showError(res);
      }
    } catch (err) {
      // amount fetch failed silently
    } finally {
      setAmountLoading(false);
    }
  };

  const waffoPancakeTopUp = async () => {
    const minTopUpValue = Number(waffoPancakeMinTopUp || 1);
    if (topUpCount < minTopUpValue) {
      showError(
        getBillingDisplayText(
          'topupAmount',
          t,
          publicWelfareTextEnabled,
        ) +
          t('不能小于') +
          minTopUpValue,
      );
      return;
    }

    setPaymentLoading(true);
    try {
      const res = await API.post('/api/user/waffo-pancake/pay', {
        amount: parseInt(topUpCount),
      });
      if (res !== undefined) {
        const { message, data } = res.data;
        if (message === 'success') {
          const checkoutUrl = data?.checkout_url || '';
          if (checkoutUrl && isSafeHttpCheckoutUrl(checkoutUrl)) {
            // In-tab redirect (not window.open) — popup blocker fires after
            // the await loses user-gesture context.
            window.location.href = checkoutUrl;
          } else if (checkoutUrl) {
            showError(t('支付跳转地址不安全'));
          } else {
            showError(t('支付请求失败'));
          }
        } else {
          const errorMsg =
            typeof data === 'string' ? data : message || t('支付请求失败');
          showError(errorMsg);
        }
      } else {
        showError(res);
      }
    } catch (e) {
      showError(t('支付请求失败'));
    } finally {
      setPaymentLoading(false);
    }
  };

  const getWaffoPancakeAmount = async (value) => {
    if (value === undefined) {
      value = topUpCount;
    }
    setAmountLoading(true);
    try {
      const res = await API.post('/api/user/waffo-pancake/amount', {
        amount: parseInt(value),
      });
      if (res !== undefined) {
        const { message, data } = res.data;
        if (message === 'success') {
          setAmount(parseFloat(data));
        } else {
          setAmount(0);
          Toast.error({ content: '错误：' + data, id: 'getAmount' });
        }
      } else {
        showError(res);
      }
    } catch (err) {
      // amount fetch failed silently
    } finally {
      setAmountLoading(false);
    }
  };

  const processCreemCallback = (data) => {
    // 与 Stripe 保持一致的实现方式
    window.open(data.checkout_url, '_blank');
  };

  const getUserQuota = async () => {
    let res = await API.get(`/api/user/self`);
    const { success, message, data } = res.data;
    if (success) {
      userDispatch({ type: 'login', payload: data });
    } else {
      showError(message);
    }
  };

  const getSubscriptionPlans = async () => {
    setSubscriptionLoading(true);
    try {
      const res = await API.get('/api/subscription/plans');
      if (res.data?.success) {
        setSubscriptionPlans(res.data.data || []);
      }
    } catch (e) {
      setSubscriptionPlans([]);
    } finally {
      setSubscriptionLoading(false);
    }
  };

  const getSubscriptionSelf = async () => {
    try {
      const res = await API.get('/api/subscription/self');
      if (res.data?.success) {
        setBillingPreference(
          res.data.data?.billing_preference || 'subscription_first',
        );
        // Active subscriptions
        const activeSubs = res.data.data?.subscriptions || [];
        setActiveSubscriptions(activeSubs);
        // All subscriptions (including expired)
        const allSubs = res.data.data?.all_subscriptions || [];
        setAllSubscriptions(allSubs);
      }
    } catch (e) {
      // ignore
    }
  };

  const updateBillingPreference = async (pref) => {
    const previousPref = billingPreference;
    setBillingPreference(pref);
    try {
      const res = await API.put('/api/subscription/self/preference', {
        billing_preference: pref,
      });
      if (res.data?.success) {
        showSuccess(t('更新成功'));
        const normalizedPref =
          res.data?.data?.billing_preference || pref || previousPref;
        setBillingPreference(normalizedPref);
      } else {
        showError(res.data?.message || t('更新失败'));
        setBillingPreference(previousPref);
      }
    } catch (e) {
      showError(t('请求失败'));
      setBillingPreference(previousPref);
    }
  };

  // 获取充值配置信息
  const getTopupInfo = async () => {
    try {
      const res = await API.get('/api/user/topup/info');
      const { message, data, success } = res.data;
      if (success) {
        const methodsByScene = normalizePaymentMethodsByScene(
          data.payment_methods_by_scene,
          data,
        );
        const walletPayMethods = normalizePayMethods(
          methodsByScene.wallet_topup || data.pay_methods || [],
          data,
        );
        const subscriptionMethods = normalizePayMethods(
          methodsByScene.subscription_purchase ||
            data.subscription_payment_methods ||
            data.pay_methods ||
            [],
          data,
        );
        const features = parseJsonObject(data.features);
        const walletTopUpFeatureEnabled = features.wallet_topup !== false;
        const amountOptions = parseJsonArray(data.amount_options)
          .map((item) => Number(item))
          .filter((item) => Number.isFinite(item) && item > 0);
        const discount =
          typeof data.discount === 'string'
            ? parseJsonObject(data.discount)
            : data.discount || {};
        const enableStripeTopUp = isEnabled(data.enable_stripe_topup);
        const enableOnlineTopUp = isEnabled(data.enable_online_topup);
        const enableCreemTopUp = isEnabled(data.enable_creem_topup);
        const enableWaffoTopUp = isEnabled(data.enable_waffo_topup);
        const enableWaffoPancakeTopUp = isEnabled(
          data.enable_waffo_pancake_topup,
        );
        const subscriptionPurchaseEnabled = isEnabled(
          data.enable_subscription_purchase,
          true,
        );
        const epaySubscriptionEnabled =
          subscriptionPurchaseEnabled &&
          isEnabled(data.enable_epay_subscription, enableOnlineTopUp);
        const stripeSubscriptionEnabled =
          subscriptionPurchaseEnabled &&
          isEnabled(data.enable_stripe_subscription, enableStripeTopUp);
        const creemSubscriptionEnabled =
          subscriptionPurchaseEnabled &&
          isEnabled(data.enable_creem_subscription, enableCreemTopUp);
        const minTopUpValue = enableOnlineTopUp
          ? data.min_topup
          : enableStripeTopUp
            ? data.stripe_min_topup
            : enableWaffoTopUp
              ? data.waffo_min_topup
              : enableWaffoPancakeTopUp
                ? data.waffo_pancake_min_topup
                : 1;

        setTopupInfo({
          amount_options: amountOptions,
          discount,
          display: {
            public_welfare_text_enabled:
              data.display?.public_welfare_text_enabled === true,
            invitation_panel_enabled:
              data.display?.invitation_panel_enabled !== false,
          },
          enable_redemption: data.enable_redemption !== false,
          enable_subscription_purchase: subscriptionPurchaseEnabled,
          features,
          payment_compliance_confirmed:
            data.payment_compliance_confirmed !== false,
          payment_compliance_terms_version:
            data.payment_compliance_terms_version || '',
        });
        setPayMethods(walletPayMethods);
        setSubscriptionPayMethods(subscriptionMethods);
        setEnableOnlineTopUp(enableOnlineTopUp);
        setEnableStripeTopUp(enableStripeTopUp);
        setEnableCreemTopUp(enableCreemTopUp);
        setEnableWaffoTopUp(enableWaffoTopUp);
        setWaffoPayMethods(parseJsonArray(data.waffo_pay_methods));
        setWaffoMinTopUp(data.waffo_min_topup || 1);
        setEnableWaffoPancakeTopUp(enableWaffoPancakeTopUp);
        setWaffoPancakeMinTopUp(data.waffo_pancake_min_topup || 1);
        setEnableSubscriptionPurchase(subscriptionPurchaseEnabled);
        setEnableEpaySubscription(epaySubscriptionEnabled);
        setEnableStripeSubscription(stripeSubscriptionEnabled);
        setEnableCreemSubscription(creemSubscriptionEnabled);
        setMinTopUp(minTopUpValue);
        setTopUpCount(minTopUpValue);
        setTopUpLink(data.topup_link || '');
        setCreemProducts(parseJsonArray(data.creem_products));

        if (amountOptions.length > 0) {
          setPresetAmounts(
            amountOptions.map((amount) => ({
              value: amount,
              discount: discount[amount] || 1.0,
            })),
          );
        } else {
          setPresetAmounts(generatePresetAmounts(minTopUpValue));
        }

        const standardWalletEnabled =
          walletTopUpFeatureEnabled &&
          walletPayMethods.length > 0 &&
          (enableOnlineTopUp ||
            enableStripeTopUp ||
            enableWaffoTopUp ||
            enableWaffoPancakeTopUp);
        if (standardWalletEnabled) {
          const defaultWalletMethod = walletPayMethods[0]?.type;
          if (defaultWalletMethod === 'stripe') {
            getStripeAmount(minTopUpValue);
          } else if (defaultWalletMethod === 'waffo_pancake') {
            getWaffoPancakeAmount(minTopUpValue);
          } else {
            getAmount(minTopUpValue);
          }
        } else {
          setAmount(0);
        }
      } else {
        showError(data || t('获取支付配置失败'));
      }
    } catch (error) {
      showError(t('获取支付配置异常'));
    } finally {
      setTopupInfoLoaded(true);
    }
  };

  // 获取邀请链接
  const getAffLink = async () => {
    const res = await API.get('/api/user/aff');
    const { success, message, data } = res.data;
    if (success) {
      let link = `${window.location.origin}/register?aff=${data}`;
      setAffLink(link);
    } else {
      showError(message);
    }
  };

  // 划转邀请额度
  const transfer = async () => {
    if (transferAmount < getQuotaPerUnit()) {
      showError(t('划转金额最低为') + ' ' + renderQuota(getQuotaPerUnit()));
      return;
    }
    const res = await API.post(`/api/user/aff_transfer`, {
      quota: transferAmount,
    });
    const { success, message } = res.data;
    if (success) {
      showSuccess(message);
      setOpenTransfer(false);
      getUserQuota().then();
    } else {
      showError(message);
    }
  };

  // 复制邀请链接
  const handleAffLinkClick = async () => {
    await copy(affLink);
    showSuccess(t('邀请链接已复制到剪切板'));
  };

  // URL 参数自动打开账单弹窗（支付回跳时触发）
  useEffect(() => {
    if (searchParams.get('show_history') === 'true') {
      setOpenHistory(true);
      searchParams.delete('show_history');
      setSearchParams(searchParams, { replace: true });
    }
  }, []);

  useEffect(() => {
    // 始终获取最新用户数据，确保余额等统计信息准确
    getUserQuota().then();
    setTransferAmount(getQuotaPerUnit());
  }, []);

  useEffect(() => {
    if (!topupInfoLoaded || !invitationPanelEnabled || affFetchedRef.current) {
      return;
    }
    affFetchedRef.current = true;
    getAffLink().then();
  }, [topupInfoLoaded, invitationPanelEnabled]);

  useEffect(() => {
    if (!invitationPanelEnabled && openTransfer) {
      setOpenTransfer(false);
    }
  }, [invitationPanelEnabled, openTransfer]);

  // 在 statusState 可用时获取充值信息
  useEffect(() => {
    getTopupInfo().then();
    getSubscriptionPlans().then();
    getSubscriptionSelf().then();
  }, []);

  useEffect(() => {
    if (statusState?.status) {
      // const minTopUpValue = statusState.status.min_topup || 1;
      // setMinTopUp(minTopUpValue);
      // setTopUpCount(minTopUpValue);
      setPriceRatio(statusState.status.price || 1);

      setStatusLoading(false);
    }
  }, [statusState?.status]);

  const renderAmount = () => {
    return amount + ' ' + t('元');
  };

  const getAmount = async (value) => {
    if (value === undefined) {
      value = topUpCount;
    }
    setAmountLoading(true);
    try {
      const res = await API.post('/api/user/amount', {
        amount: parseFloat(value),
      });
      if (res !== undefined) {
        const { message, data } = res.data;
        if (message === 'success') {
          setAmount(parseFloat(data));
        } else {
          setAmount(0);
          Toast.error({ content: '错误：' + data, id: 'getAmount' });
        }
      } else {
        showError(res);
      }
    } catch (err) {
      // amount fetch failed silently
    }
    setAmountLoading(false);
  };

  const getStripeAmount = async (value) => {
    if (value === undefined) {
      value = topUpCount;
    }
    setAmountLoading(true);
    try {
      const res = await API.post('/api/user/stripe/amount', {
        amount: parseFloat(value),
      });
      if (res !== undefined) {
        const { message, data } = res.data;
        if (message === 'success') {
          setAmount(parseFloat(data));
        } else {
          setAmount(0);
          Toast.error({ content: '错误：' + data, id: 'getAmount' });
        }
      } else {
        showError(res);
      }
    } catch (err) {
      // amount fetch failed silently
    } finally {
      setAmountLoading(false);
    }
  };

  const handleCancel = () => {
    setOpen(false);
  };

  const handleTransferCancel = () => {
    setOpenTransfer(false);
  };

  const handleOpenHistory = () => {
    setOpenHistory(true);
  };

  const handleHistoryCancel = () => {
    setOpenHistory(false);
  };

  const handleCreemCancel = () => {
    setCreemOpen(false);
    setSelectedCreemProduct(null);
  };

  // 选择预设充值额度
  const selectPresetAmount = (preset) => {
    setTopUpCount(preset.value);
    setSelectedPreset(preset.value);

    if (!canCalculateWalletAmount) {
      setAmount(0);
      return;
    }

    // 计算实际支付金额，考虑折扣
    const discount = preset.discount || topupInfo.discount[preset.value] || 1.0;
    const discountedAmount = preset.value * priceRatio * discount;
    setAmount(discountedAmount);
  };

  // 格式化大数字显示
  const formatLargeNumber = (num) => {
    return num.toString();
  };

  // 根据最小充值金额生成预设充值额度选项
  const generatePresetAmounts = (minAmount) => {
    const multipliers = [1, 5, 10, 30, 50, 100, 300, 500];
    return multipliers.map((multiplier) => ({
      value: minAmount * multiplier,
    }));
  };

  return (
    <div className='w-full max-w-7xl mx-auto relative min-h-screen lg:min-h-0 mt-[60px] px-2'>
      {/* 划转模态框 */}
      {invitationPanelEnabled && (
        <TransferModal
          t={t}
          openTransfer={openTransfer}
          transfer={transfer}
          handleTransferCancel={handleTransferCancel}
          userState={userState}
          renderQuota={renderQuota}
          getQuotaPerUnit={getQuotaPerUnit}
          transferAmount={transferAmount}
          setTransferAmount={setTransferAmount}
          publicWelfareTextEnabled={publicWelfareTextEnabled}
        />
      )}

      {/* 支付确认模态框 */}
      <PaymentConfirmModal
        t={t}
        open={open}
        onlineTopUp={onlineTopUp}
        handleCancel={handleCancel}
        confirmLoading={confirmLoading}
        topUpCount={topUpCount}
        renderQuotaWithAmount={renderQuotaWithAmount}
        amountLoading={amountLoading}
        renderAmount={renderAmount}
        payWay={payWay}
        payMethods={confirmPayMethods}
        amountNumber={amount}
        discountRate={topupInfo?.discount?.[topUpCount] || 1.0}
        publicWelfareTextEnabled={publicWelfareTextEnabled}
      />

      {/* 支持记录模态框 */}
      <TopupHistoryModal
        visible={openHistory}
        onCancel={handleHistoryCancel}
        t={t}
        publicWelfareTextEnabled={publicWelfareTextEnabled}
      />

      {/* Creem 支付确认模态框 */}
      <Modal
        title={t('确认支付 $')}
        visible={creemOpen}
        onOk={onlineCreemTopUp}
        onCancel={handleCreemCancel}
        maskClosable={false}
        size='small'
        centered
        confirmLoading={confirmLoading}
      >
        {selectedCreemProduct && (
          <>
            <p>
              {t('产品名称')}：{selectedCreemProduct.name}
            </p>
            <p>
              {t('价格')}：{selectedCreemProduct.currency === 'EUR' ? '€' : '$'}
              {selectedCreemProduct.price}
            </p>
            <p>
              {getBillingDisplayText('quota', t, publicWelfareTextEnabled)}：
              {selectedCreemProduct.quota}
            </p>
            <p>{t('是否确认支付？')}</p>
          </>
        )}
      </Modal>

      {/* 主布局区域 */}
      <div
        className={
          invitationPanelEnabled
            ? 'grid grid-cols-1 lg:grid-cols-2 gap-6'
            : 'grid grid-cols-1 gap-6'
        }
      >
        <RechargeCard
          t={t}
          enableOnlineTopUp={enableOnlineTopUp}
          enableStripeTopUp={enableStripeTopUp}
          enableCreemTopUp={enableCreemTopUp}
          creemProducts={creemProducts}
          creemPreTopUp={creemPreTopUp}
          enableWaffoTopUp={enableWaffoTopUp}
          enableWaffoPancakeTopUp={enableWaffoPancakeTopUp}
          presetAmounts={presetAmounts}
          selectedPreset={selectedPreset}
          selectPresetAmount={selectPresetAmount}
          formatLargeNumber={formatLargeNumber}
          priceRatio={priceRatio}
          topUpCount={topUpCount}
          minTopUp={minTopUp}
          renderQuotaWithAmount={renderQuotaWithAmount}
          getAmount={getAmount}
          setTopUpCount={setTopUpCount}
          setSelectedPreset={setSelectedPreset}
          renderAmount={renderAmount}
          amountLoading={amountLoading}
          payMethods={confirmPayMethods}
          preTopUp={preTopUp}
          paymentLoading={paymentLoading}
          payWay={payWay}
          redemptionCode={redemptionCode}
          setRedemptionCode={setRedemptionCode}
          topUp={topUp}
          isSubmitting={isSubmitting}
          topUpLink={topUpLink}
          openTopUpLink={openTopUpLink}
          userState={userState}
          renderQuota={renderQuota}
          statusLoading={statusLoading}
          topupInfo={topupInfo}
          onOpenHistory={handleOpenHistory}
          subscriptionLoading={subscriptionLoading}
          subscriptionPlans={subscriptionPlans}
          billingPreference={billingPreference}
          onChangeBillingPreference={updateBillingPreference}
          activeSubscriptions={activeSubscriptions}
          allSubscriptions={allSubscriptions}
          reloadSubscriptionSelf={getSubscriptionSelf}
          subscriptionPayMethods={subscriptionPayMethods}
          enableSubscriptionPurchase={enableSubscriptionPurchase}
          enableEpaySubscription={enableEpaySubscription}
          enableStripeSubscription={enableStripeSubscription}
          enableCreemSubscription={enableCreemSubscription}
          enableRedemption={topupInfo.enable_redemption !== false}
          publicWelfareTextEnabled={publicWelfareTextEnabled}
        />
        {invitationPanelEnabled && (
          <InvitationCard
            t={t}
            userState={userState}
            renderQuota={renderQuota}
            setOpenTransfer={setOpenTransfer}
            affLink={affLink}
            handleAffLinkClick={handleAffLinkClick}
            complianceConfirmed={
              topupInfo.payment_compliance_confirmed !== false
            }
            publicWelfareTextEnabled={publicWelfareTextEnabled}
          />
        )}
      </div>
    </div>
  );
};

export default TopUp;
