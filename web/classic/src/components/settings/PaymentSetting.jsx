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
import { Banner, Button, Card, Spin, Tabs } from '@douyinfe/semi-ui';
import SettingsGeneralPayment from '../../pages/Setting/Payment/SettingsGeneralPayment';
import SettingsPaymentGateway from '../../pages/Setting/Payment/SettingsPaymentGateway';
import SettingsPaymentGatewayStripe from '../../pages/Setting/Payment/SettingsPaymentGatewayStripe';
import SettingsPaymentGatewayCreem from '../../pages/Setting/Payment/SettingsPaymentGatewayCreem';
import SettingsPaymentGatewayWaffo from '../../pages/Setting/Payment/SettingsPaymentGatewayWaffo';
import SettingsPaymentGatewayWaffoPancake from '../../pages/Setting/Payment/SettingsPaymentGatewayWaffoPancake';
import { API, showError, showSuccess, toBoolean } from '../../helpers';
import { useTranslation } from 'react-i18next';
import RiskAcknowledgementModal from '../common/modals/RiskAcknowledgementModal';

const CURRENT_COMPLIANCE_TERMS_VERSION = 'v1';

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
    'payment_setting.compliance_confirmed': false,
    'payment_setting.compliance_terms_version': '',
    'payment_setting.compliance_confirmed_at': 0,
    'payment_setting.compliance_confirmed_by': 0,
  });

  let [loading, setLoading] = useState(false);
  const [complianceVisible, setComplianceVisible] = useState(false);

  const complianceStatements = [
    t('你已合法取得所接入模型 API、账号、密钥和额度的授权；'),
    t(
      '你承诺仅在已取得上游服务商、模型服务提供方或相关权利方合法授权的范围内使用其 API、账号、密钥、额度及服务能力，不进行未经授权的转售、倒卖、分销或其他违规商业化使用。',
    ),
    t(
      '如向中华人民共和国境内公众提供生成式人工智能服务，你将依法履行备案登记、安全评估、内容安全、投诉举报、生成合成内容标识、日志留存、个人信息保护等合规义务；',
    ),
    t(
      '你承诺不会利用本系统实施、协助实施或变相实施违反适用法律法规、监管要求、平台规则、社会公共利益或第三方合法权益的行为。',
    ),
    t('你理解并自行承担部署、运营和收费行为产生的法律责任。'),
    t(
      '你理解本合规提醒仅用于风险提示，不构成法律意见、合规审查结论或对你使用本系统行为合法性的保证；你应根据实际业务场景自行咨询专业法律或合规顾问。',
    ),
  ];
  const requiredComplianceText = t(
    '我已阅读并理解上述合规提醒，知悉相关法律风险，并确认自行承担部署、运营和收费行为产生的法律责任',
  );
  const requiredComplianceTextParts = [
    {
      type: 'input',
      text: t('我已阅读并理解上述合规提醒'),
    },
    { type: 'static', text: t('，') },
    {
      type: 'input',
      text: t('知悉相关法律风险'),
    },
    { type: 'static', text: t('，') },
    {
      type: 'input',
      text: t('并确认自行承担部署'),
    },
    { type: 'static', text: t('、') },
    {
      type: 'input',
      text: t('运营和收费行为产生的法律责任'),
    },
  ];
  const complianceConfirmed =
    inputs['payment_setting.compliance_confirmed'] &&
    inputs['payment_setting.compliance_terms_version'] ===
      CURRENT_COMPLIANCE_TERMS_VERSION;

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
          case 'payment_setting.compliance_confirmed':
            newInputs[item.key] = toBoolean(item.value);
            break;
          case 'payment_setting.compliance_confirmed_at':
          case 'payment_setting.compliance_confirmed_by':
            newInputs[item.key] = parseInt(item.value) || 0;
            break;
          case 'payment_setting.compliance_terms_version':
            newInputs[item.key] = item.value;
            break;
          case 'Price':
          case 'MinTopUp':
          case 'StripeUnitPrice':
          case 'StripeMinTopUp':
          case 'WaffoPancakeUnitPrice':
          case 'WaffoPancakeMinTopUp':
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
            newInputs[item.key] = toBoolean(item.value);
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

  const confirmCompliance = async () => {
    try {
      const res = await API.post('/api/option/payment_compliance', {
        confirmed: true,
      });
      if (res.data.success) {
        showSuccess(t('合规声明确认成功'));
        setComplianceVisible(false);
        await onRefresh();
      } else {
        showError(res.data.message || t('确认失败'));
      }
    } catch (error) {
      showError(t('确认失败'));
    }
  };

  return (
    <>
      <Spin spinning={loading} size='large'>
        <Card style={{ marginTop: '10px' }}>
          {!complianceConfirmed ? (
            <Banner
              type='warning'
              title={t('需要确认合规声明')}
              description={
                <div className='flex flex-col gap-2'>
                  <span>
                    {t(
                      '确认前，支付、兑换码、订阅计划和邀请返利功能将保持锁定。',
                    )}
                  </span>
                  <Button
                    type='warning'
                    theme='solid'
                    onClick={() => setComplianceVisible(true)}
                  >
                    {t('确认合规声明')}
                  </Button>
                </div>
              }
              closeIcon={null}
              style={{ marginBottom: 16 }}
              fullMode={false}
            />
          ) : (
            <Banner
              type='success'
              title={t('合规声明已确认')}
              description={t('确认时间：{{time}}，确认用户：#{{userId}}', {
                time: inputs['payment_setting.compliance_confirmed_at']
                  ? new Date(
                      inputs['payment_setting.compliance_confirmed_at'] * 1000,
                    ).toLocaleString()
                  : '-',
                userId:
                  inputs['payment_setting.compliance_confirmed_by'] || '-',
              })}
              closeIcon={null}
              style={{ marginBottom: 16 }}
              fullMode={false}
            />
          )}
          <div
            style={
              complianceConfirmed
                ? undefined
                : { opacity: 0.4, pointerEvents: 'none' }
            }
          >
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
              {/*<Tabs.TabPane tab={t('Waffo Pancake 设置')} itemKey='waffo-pancake'>*/}
              {/*  <SettingsPaymentGatewayWaffoPancake*/}
              {/*    options={inputs}*/}
              {/*    refresh={onRefresh}*/}
              {/*    hideSectionTitle*/}
              {/*  />*/}
              {/*</Tabs.TabPane>*/}
            </Tabs>
          </div>
        </Card>
        <RiskAcknowledgementModal
          visible={complianceVisible}
          title={t('确认合规声明')}
          markdownContent={t(
            '该操作将启用支付、兑换码、订阅计划和邀请返利相关功能。请仔细阅读并确认以下声明。',
          )}
          checklist={complianceStatements}
          inputPrompt={t('请输入以下文字以确认:')}
          requiredText={requiredComplianceText}
          requiredTextParts={requiredComplianceTextParts}
          inputPlaceholder={t('请输入确认文案')}
          mismatchText={t('输入内容与要求文案不一致')}
          cancelText={t('取消')}
          confirmText={t('确认并启用')}
          onCancel={() => setComplianceVisible(false)}
          onConfirm={confirmCompliance}
        />
      </Spin>
    </>
  );
};

export default PaymentSetting;
