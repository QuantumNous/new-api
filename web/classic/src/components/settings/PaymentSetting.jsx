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

import React, { useEffect, useState } from 'react';
import { Card, Spin, Tabs } from '@douyinfe/semi-ui';
import SettingsGeneralPayment from '../../pages/Setting/Payment/SettingsGeneralPayment';
import SettingsPaymentGateway from '../../pages/Setting/Payment/SettingsPaymentGateway';
import SettingsPaymentGatewayStripe from '../../pages/Setting/Payment/SettingsPaymentGatewayStripe';
import SettingsPaymentGatewayCreem from '../../pages/Setting/Payment/SettingsPaymentGatewayCreem';
import SettingsPaymentGatewayWaffo from '../../pages/Setting/Payment/SettingsPaymentGatewayWaffo';
import SettingsPaymentGatewayWaffoPancake from '../../pages/Setting/Payment/SettingsPaymentGatewayWaffoPancake';
import SettingsPaymentGatewayAlipay from '../../pages/Setting/Payment/SettingsPaymentGatewayAlipay';
import SettingsPaymentGatewayWxpay from '../../pages/Setting/Payment/SettingsPaymentGatewayWxpay';
import SettingsPaymentBankTransfer from '../../pages/Setting/Payment/SettingsPaymentBankTransfer';
import { API, showError, toBoolean } from '../../helpers';
import { useTranslation } from 'react-i18next';

const PaymentSetting = () => {
  const { t } = useTranslation();
  let [inputs, setInputs] = useState({
    ServerAddress: '',
    PayAddress: '',
    EpayId: '',
    EpayKey: '',
    Price: 7.3,
    MinTopUp: 1,
    TopupGroupRatio: '',
    CustomCallbackAddress: '',
    PayMethods: '',
    AmountOptions: '',
    AmountDiscount: '',

    StripeApiSecret: '',
    StripeWebhookSecret: '',
    StripePriceId: '',
    StripeUnitPrice: 8.0,
    StripeMinTopUp: 1,
    StripePromotionCodesEnabled: false,

    WaffoPancakeEnabled: false,
    WaffoPancakeSandbox: false,
    WaffoPancakeMerchantID: '',
    WaffoPancakePrivateKey: '',
    WaffoPancakeStoreID: '',
    WaffoPancakeProductID: '',
    WaffoPancakeReturnURL: '',
    WaffoPancakeCurrency: 'USD',
    WaffoPancakeUnitPrice: 1.0,
    WaffoPancakeMinTopUp: 1,

    AlipayAppId: '',
    AlipayPrivateKey: '',
    AlipayPublicKey: '',
    AlipayMinTopUp: 1,
    AlipaySandbox: false,

    WxpayAppId: '',
    WxpayMchId: '',
    WxpayPrivateKey: '',
    WxpayApiV3Key: '',
    WxpayCertSerial: '',
    WxpayPublicKey: '',
    WxpayPublicKeyId: '',
    WxpayMinTopUp: 1,

    BankTransferEnabled: false,
    BankTransferCompanyName: '',
    BankTransferPayeeName: '',
    BankTransferAccountNumber: '',
    BankTransferBankName: '',
    BankTransferMinAmountFen: 0,
    BankTransferTips: '',
  });

  let [loading, setLoading] = useState(false);

  const getOptions = async () => {
    const res = await API.get('/api/option/');
    const { success, message, data } = res.data;
    if (success) {
      let newInputs = {};
      data.forEach((item) => {
        switch (item.key) {
          case 'TopupGroupRatio':
            try {
              newInputs[item.key] = JSON.stringify(
                JSON.parse(item.value),
                null,
                2,
              );
            } catch (error) {
              newInputs[item.key] = item.value;
            }
            break;
          case 'payment_setting.amount_options':
            try {
              newInputs['AmountOptions'] = JSON.stringify(
                JSON.parse(item.value),
                null,
                2,
              );
            } catch (error) {
              newInputs['AmountOptions'] = item.value;
            }
            break;
          case 'payment_setting.amount_discount':
            try {
              newInputs['AmountDiscount'] = JSON.stringify(
                JSON.parse(item.value),
                null,
                2,
              );
            } catch (error) {
              newInputs['AmountDiscount'] = item.value;
            }
            break;
          case 'Price':
          case 'MinTopUp':
          case 'StripeUnitPrice':
          case 'StripeMinTopUp':
          case 'WaffoPancakeUnitPrice':
          case 'WaffoPancakeMinTopUp':
          case 'AlipayMinTopUp':
          case 'WxpayMinTopUp':
            newInputs[item.key] = parseFloat(item.value);
            break;
          case 'WaffoPancakeMerchantID':
          case 'WaffoPancakePrivateKey':
          case 'WaffoPancakeStoreID':
          case 'WaffoPancakeProductID':
          case 'WaffoPancakeReturnURL':
          case 'WaffoPancakeCurrency':
            newInputs[item.key] = item.value;
            break;
          case 'WaffoPancakeSandbox':
          case 'AlipaySandbox':
            newInputs[item.key] = toBoolean(item.value);
            break;
          case 'bank_transfer_setting.enabled':
            newInputs['BankTransferEnabled'] = toBoolean(item.value);
            break;
          case 'bank_transfer_setting.company_name':
            newInputs['BankTransferCompanyName'] = item.value;
            break;
          case 'bank_transfer_setting.payee_name':
            newInputs['BankTransferPayeeName'] = item.value;
            break;
          case 'bank_transfer_setting.account_number':
            newInputs['BankTransferAccountNumber'] = item.value;
            break;
          case 'bank_transfer_setting.bank_name':
            newInputs['BankTransferBankName'] = item.value;
            break;
          case 'bank_transfer_setting.min_amount_fen':
            newInputs['BankTransferMinAmountFen'] =
              parseInt(item.value, 10) || 0;
            break;
          case 'bank_transfer_setting.tips':
            newInputs['BankTransferTips'] = item.value;
            break;
          default:
            if (item.key.endsWith('Enabled')) {
              newInputs[item.key] = toBoolean(item.value);
            } else {
              newInputs[item.key] = item.value;
            }
            break;
        }
      });

      setInputs((prev) => ({ ...prev, ...newInputs }));
    } else {
      showError(t(message));
    }
  };

  async function onRefresh() {
    try {
      setLoading(true);
      await getOptions();
    } catch (error) {
      showError(t('刷新失败'));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    onRefresh();
  }, []);

  return (
    <>
      <Spin spinning={loading} size='large'>
        <Card style={{ marginTop: '10px' }}>
          <Tabs
            type='card'
            defaultActiveKey='general'
            contentStyle={{ paddingTop: 24 }}
          >
            <Tabs.TabPane tab={t('通用设置')} itemKey='general'>
              <SettingsGeneralPayment
                options={inputs}
                refresh={onRefresh}
                hideSectionTitle
              />
            </Tabs.TabPane>
            <Tabs.TabPane tab={t('易支付设置')} itemKey='epay'>
              <SettingsPaymentGateway
                options={inputs}
                refresh={onRefresh}
                hideSectionTitle
              />
            </Tabs.TabPane>
            <Tabs.TabPane tab={t('Stripe 设置')} itemKey='stripe'>
              <SettingsPaymentGatewayStripe
                options={inputs}
                refresh={onRefresh}
                hideSectionTitle
              />
            </Tabs.TabPane>
            <Tabs.TabPane tab={t('Creem 设置')} itemKey='creem'>
              <SettingsPaymentGatewayCreem
                options={inputs}
                refresh={onRefresh}
                hideSectionTitle
              />
            </Tabs.TabPane>
            <Tabs.TabPane tab={t('Waffo 设置')} itemKey='waffo'>
              <SettingsPaymentGatewayWaffo
                options={inputs}
                refresh={onRefresh}
                hideSectionTitle
              />
            </Tabs.TabPane>
            <Tabs.TabPane tab={t('支付宝直连')} itemKey='alipay-direct'>
              <SettingsPaymentGatewayAlipay
                options={inputs}
                refresh={onRefresh}
                hideSectionTitle
              />
            </Tabs.TabPane>
            <Tabs.TabPane tab={t('微信支付直连')} itemKey='wxpay-direct'>
              <SettingsPaymentGatewayWxpay
                options={inputs}
                refresh={onRefresh}
                hideSectionTitle
              />
            </Tabs.TabPane>
            <Tabs.TabPane tab={t('对公转账')} itemKey='bank-transfer'>
              <SettingsPaymentBankTransfer
                options={inputs}
                refresh={onRefresh}
                hideSectionTitle
              />
            </Tabs.TabPane>
            {/*<Tabs.TabPane tab={t('Waffo Pancake 设置')} itemKey='waffo-pancake'>*/}
            {/*  <SettingsPaymentGatewayWaffoPancake*/}
            {/*    options={inputs}*/}
            {/*    refresh={onRefresh}*/}
            {/*    hideSectionTitle*/}
            {/*  />*/}
            {/*</Tabs.TabPane>*/}
          </Tabs>
        </Card>
      </Spin>
    </>
  );
};

export default PaymentSetting;
