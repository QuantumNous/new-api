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
  Divider,
  Tooltip,
} from '@douyinfe/semi-ui';
import { Crown, CalendarClock, Package } from 'lucide-react';
import { SiStripe } from 'react-icons/si';
import { SiAlipay } from 'react-icons/si';
import { IconCreditCard } from '@douyinfe/semi-icons';
import { renderQuota } from '../../../helpers';
import { getCurrencyConfig } from '../../../helpers/render';
import {
  formatSubscriptionDuration,
  formatSubscriptionResetPeriod,
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
  enableAlipayTopUp = false,
  enableOnlineTopUp = false,
  enableStripeTopUp = false,
  enableCreemTopUp = false,
  purchaseLimitInfo = null,
  onPayAlipay,
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
  const isAutoRenew = plan?.billing_mode === 'auto_renew';
  const providerButtons = [
    !isAutoRenew && enableAlipayTopUp
      ? {
          key: 'alipay',
          label: t('支付宝'),
          icon: <SiAlipay size={14} color='var(--app-accent)' />,
          onClick: onPayAlipay,
          className: 'is-secondary',
        }
      : null,
    enableStripeTopUp &&
    !!(isAutoRenew ? plan?.stripe_recurring_price_id : plan?.stripe_price_id)
      ? {
          key: 'stripe',
          label: 'Stripe',
          icon: <SiStripe size={14} color='var(--app-accent)' />,
          onClick: onPayStripe,
          className: 'is-secondary',
        }
      : null,
    !isAutoRenew && enableCreemTopUp && !!plan?.creem_product_id
      ? {
          key: 'creem',
          label: 'Creem',
          icon: <IconCreditCard />,
          onClick: onPayCreem,
          className: 'is-secondary',
        }
      : null,
  ].filter(Boolean);
  const hasEpay = !isAutoRenew && enableOnlineTopUp && epayMethods.length > 0;
  const hasAnyPayment = providerButtons.length > 0 || hasEpay;
  const purchaseLimit = Number(purchaseLimitInfo?.limit || 0);
  const purchaseCount = Number(purchaseLimitInfo?.count || 0);
  const purchaseLimitReached =
    purchaseLimit > 0 && purchaseCount >= purchaseLimit;

  return (
    <Modal
      className='subscription-purchase-modal'
      title={
        <div className='flex items-center'>
          <Crown className='mr-2' size={18} />
          {t('购买订阅套餐')}
        </div>
      }
      visible={visible}
      onCancel={onCancel}
      footer={null}
      size='small'
      centered
    >
      {plan ? (
        <div className='subscription-purchase-layout space-y-4 pb-10'>
          {/* 套餐信息 */}
          <Card className='subscription-purchase-card !rounded-xl !border-0'>
            <div className='space-y-3'>
              <div className='subscription-purchase-row flex justify-between items-center'>
                <Text strong className='subscription-purchase-label'>
                  {t('套餐名称')}：
                </Text>
                <Typography.Text
                  ellipsis={{ rows: 1, showTooltip: true }}
                  className='subscription-purchase-value'
                  style={{ maxWidth: 200 }}
                >
                  {plan.title}
                </Typography.Text>
              </div>
              {isAutoRenew && (
                <div className='subscription-purchase-row flex justify-between items-center'>
                  <Text strong className='subscription-purchase-label'>
                    {t('计费方式')}:
                  </Text>
                  <Text className='subscription-purchase-value'>
                    {t('自动续费')}
                  </Text>
                </div>
              )}
              <div className='subscription-purchase-row flex justify-between items-center'>
                <Text strong className='subscription-purchase-label'>
                  {t('有效期')}：
                </Text>
                <div className='subscription-purchase-value flex items-center'>
                  <CalendarClock
                    size={14}
                    className='subscription-purchase-inline-icon mr-1'
                  />
                  <Text className='subscription-purchase-value'>
                    {formatSubscriptionDuration(plan, t)}
                  </Text>
                </div>
              </div>
              {formatSubscriptionResetPeriod(plan, t) !== t('不重置') && (
                <div className='subscription-purchase-row flex justify-between items-center'>
                  <Text strong className='subscription-purchase-label'>
                    {t('重置周期')}：
                  </Text>
                  <Text className='subscription-purchase-value'>
                    {formatSubscriptionResetPeriod(plan, t)}
                  </Text>
                </div>
              )}
              <div className='subscription-purchase-row flex justify-between items-center'>
                <Text strong className='subscription-purchase-label'>
                  {t('总额度')}：
                </Text>
                <div className='subscription-purchase-value flex items-center'>
                  <Package
                    size={14}
                    className='subscription-purchase-inline-icon mr-1'
                  />
                  {totalAmount > 0 ? (
                    <Tooltip content={`${t('原生额度')}：${totalAmount}`}>
                      <Text className='subscription-purchase-value'>
                        {renderQuota(totalAmount)}
                      </Text>
                    </Tooltip>
                  ) : (
                    <Text className='subscription-purchase-value'>
                      {t('不限')}
                    </Text>
                  )}
                </div>
              </div>
              {plan?.upgrade_group ? (
                <div className='subscription-purchase-row flex justify-between items-center'>
                  <Text strong className='subscription-purchase-label'>
                    {t('升级分组')}：
                  </Text>
                  <Text className='subscription-purchase-value'>
                    {plan.upgrade_group}
                  </Text>
                </div>
              ) : null}
              <Divider margin={8} />
              <div className='subscription-purchase-row flex justify-between items-center'>
                <Text strong className='subscription-purchase-label'>
                  {t('应付金额')}：
                </Text>
                <Text strong className='subscription-purchase-price'>
                  {symbol}
                  {displayPrice}
                </Text>
              </div>
            </div>
          </Card>

          {/* 支付方式 */}
          {purchaseLimitReached && (
            <Banner
              type='warning'
              description={`${t('已达到购买上限')} (${purchaseCount}/${purchaseLimit})`}
              className='subscription-purchase-banner !rounded-xl'
              closeIcon={null}
            />
          )}

          {hasAnyPayment ? (
            <div className='subscription-purchase-methods space-y-3'>
              <Text
                size='small'
                type='tertiary'
                className='subscription-purchase-section-label'
              >
                {t('选择支付方式')}：
              </Text>

              {providerButtons.length > 0 && (
                <div className='subscription-purchase-provider-row flex gap-2'>
                  {providerButtons.map((provider) => (
                    <Button
                      key={provider.key}
                      theme='light'
                      className={`subscription-purchase-pay-button ${provider.className} flex-1`}
                      icon={provider.icon}
                      onClick={provider.onClick}
                      loading={paying}
                      disabled={purchaseLimitReached}
                    >
                      {provider.label}
                    </Button>
                  ))}
                </div>
              )}

              {/* 易支付 */}
              {hasEpay && (
                <div className='subscription-purchase-provider-row flex gap-2'>
                  <Select
                    value={selectedEpayMethod}
                    onChange={setSelectedEpayMethod}
                    style={{ flex: 1 }}
                    size='default'
                    placeholder={t('选择支付方式')}
                    className='subscription-purchase-select'
                    optionList={epayMethods.map((m) => ({
                      value: m.type,
                      label: m.name || m.type,
                    }))}
                    disabled={purchaseLimitReached}
                  />
                  <Button
                    theme='solid'
                    type='primary'
                    className='subscription-purchase-pay-button is-primary'
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
              className='subscription-purchase-banner !rounded-xl'
              closeIcon={null}
            />
          )}
        </div>
      ) : null}
    </Modal>
  );
};

export default SubscriptionPurchaseModal;
