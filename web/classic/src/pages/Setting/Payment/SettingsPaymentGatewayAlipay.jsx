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
import { Banner, Button, Col, Form, Popconfirm, Row, Spin } from '@douyinfe/semi-ui';
import {
  API,
  removeTrailingSlash,
  showError,
  showSuccess,
} from '../../../helpers';
import { useTranslation } from 'react-i18next';
import { BookOpen, TriangleAlert } from 'lucide-react';
import {
  buildAlipayPendingOrdersWarning,
  buildClearAlipayKeyWarning,
  buildClearAlipayOption,
  shouldWarnBeforeClearingAlipayKey,
} from './alipaySettings';

const toBoolean = (value) => value === true || value === 'true';
const normalizeMinTopUp = (value) => {
  if (value === '' || value === null || value === undefined) {
    return 1;
  }
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) {
    return 1;
  }
  return Math.max(0, Math.floor(numericValue));
};

export default function SettingsPaymentGatewayAlipay(props) {
  const { t } = useTranslation();
  const sectionTitle = props.hideSectionTitle ? undefined : t('Alipay 设置');
  const [loading, setLoading] = useState(false);
  const [inputs, setInputs] = useState({
    AlipayEnabled: false,
    AlipaySandbox: false,
    AlipayAppID: '',
    AlipayPrivateKey: '',
    AlipayPublicKey: '',
    AlipayGateway: '',
    AlipayNotifyURL: '',
    AlipayReturnURL: '',
    AlipaySellerID: '',
    AlipayMinTopUp: 1,
    AlipayPendingOrderCount: 0,
    AlipayCyclePayEnabled: false,
    AlipayCyclePayPersonalProductCode: 'CYCLE_PAY_AUTH_P',
    AlipayCyclePayProductCode: 'GENERAL_WITHHOLDING',
    AlipayCyclePaySignScene: 'INDUSTRY|DEFAULT',
  });
  const formApiRef = useRef(null);

  useEffect(() => {
    if (props.options && formApiRef.current) {
      const currentInputs = {
        AlipayEnabled: toBoolean(props.options.AlipayEnabled),
        AlipaySandbox: toBoolean(props.options.AlipaySandbox),
        AlipayAppID: props.options.AlipayAppID || '',
        AlipayPrivateKey: props.options.AlipayPrivateKey || '',
        AlipayPublicKey: props.options.AlipayPublicKey || '',
        AlipayGateway: props.options.AlipayGateway || '',
        AlipayNotifyURL: props.options.AlipayNotifyURL || '',
        AlipayReturnURL: props.options.AlipayReturnURL || '',
        AlipaySellerID: props.options.AlipaySellerID || '',
        AlipayMinTopUp: normalizeMinTopUp(props.options.AlipayMinTopUp),
        AlipayPendingOrderCount: Number(props.options.AlipayPendingOrderCount) || 0,
        AlipayCyclePayEnabled: toBoolean(props.options.AlipayCyclePayEnabled),
        AlipayCyclePayPersonalProductCode:
          props.options.AlipayCyclePayPersonalProductCode || 'CYCLE_PAY_AUTH_P',
        AlipayCyclePayProductCode:
          props.options.AlipayCyclePayProductCode || 'GENERAL_WITHHOLDING',
        AlipayCyclePaySignScene:
          props.options.AlipayCyclePaySignScene || 'INDUSTRY|DEFAULT',
      };
      setInputs(currentInputs);
      formApiRef.current.setValues(currentInputs);
    }
  }, [props.options]);

  const handleFormChange = (values) => {
    setInputs(values);
  };

  const handleClearOption = async (key, field, label) => {
    setLoading(true);
    try {
      const res = await API.put('/api/option/', buildClearAlipayOption(key));
      if (!res.data.success) {
        showError(res.data.message || t('清空失败，请重试'));
        return;
      }
      const nextInputs = {
        ...inputs,
        [field]: '',
      };
      setInputs(nextInputs);
      formApiRef.current?.setValue(field, '');
      showSuccess(t('{{label}}已清空', { label }));
      props.refresh?.();
    } catch (error) {
      showError(t('清空失败，请重试'));
    } finally {
      setLoading(false);
    }
  };

  const getDangerousClearMessages = () => {
    const messages = [];
    if (!shouldWarnBeforeClearingAlipayKey(inputs.AlipayPendingOrderCount)) {
      return messages;
    }
    const originalOptions = props.options || {};
    if ((originalOptions.AlipayAppID || '') !== '' && (inputs.AlipayAppID || '') === '') {
      messages.push(t('应用 AppID'));
    }
    if ((originalOptions.AlipayGateway || '') !== '' && (inputs.AlipayGateway || '') === '') {
      messages.push(t('网关地址'));
    }
    return messages;
  };

  const submitAlipaySetting = async () => {
    setLoading(true);
    try {
      const normalizedMinTopUp = normalizeMinTopUp(inputs.AlipayMinTopUp);
      const options = [
        { key: 'AlipayEnabled', value: inputs.AlipayEnabled ? 'true' : 'false' },
        { key: 'AlipaySandbox', value: inputs.AlipaySandbox ? 'true' : 'false' },
        { key: 'AlipayAppID', value: inputs.AlipayAppID || '' },
        { key: 'AlipayGateway', value: inputs.AlipayGateway || '' },
        { key: 'AlipayNotifyURL', value: inputs.AlipayNotifyURL || '' },
        { key: 'AlipayReturnURL', value: inputs.AlipayReturnURL || '' },
        { key: 'AlipaySellerID', value: inputs.AlipaySellerID || '' },
        { key: 'AlipayMinTopUp', value: String(normalizedMinTopUp) },
        {
          key: 'AlipayCyclePayEnabled',
          value: inputs.AlipayCyclePayEnabled ? 'true' : 'false',
        },
        {
          key: 'AlipayCyclePayPersonalProductCode',
          value: inputs.AlipayCyclePayPersonalProductCode || '',
        },
        {
          key: 'AlipayCyclePayProductCode',
          value: inputs.AlipayCyclePayProductCode || '',
        },
        {
          key: 'AlipayCyclePaySignScene',
          value: inputs.AlipayCyclePaySignScene || '',
        },
      ];

      if (inputs.AlipayPrivateKey && inputs.AlipayPrivateKey !== '') {
        options.push({ key: 'AlipayPrivateKey', value: inputs.AlipayPrivateKey });
      }
      if (inputs.AlipayPublicKey && inputs.AlipayPublicKey !== '') {
        options.push({ key: 'AlipayPublicKey', value: inputs.AlipayPublicKey });
      }
      const requestQueue = options.map((opt) =>
        API.put('/api/option/', {
          key: opt.key,
          value: opt.value,
        }),
      );

      const results = await Promise.all(requestQueue);
      const errorResults = results.filter((res) => !res.data.success);
      if (errorResults.length > 0) {
        errorResults.forEach((res) => {
          showError(res.data.message);
        });
      } else {
        showSuccess(t('更新成功'));
        props.refresh?.();
      }
    } catch (error) {
      showError(t('更新失败'));
    }
    setLoading(false);
  };

  const pendingOrderCount = Number(inputs.AlipayPendingOrderCount) || 0;
  const clearOnSaveLabels = getDangerousClearMessages();
  const saveNeedsDangerConfirm = clearOnSaveLabels.length > 0;
  const saveDangerContent = t(
    '当前仍有 {{count}} 笔支付宝待处理订单。清空这些关键配置会影响历史订单的回调和补单：{{labels}}。',
    {
      count: pendingOrderCount,
      labels: clearOnSaveLabels.join('、'),
    },
  );
  const serverBase = props.options?.ServerAddress
    ? removeTrailingSlash(props.options.ServerAddress)
    : t('网站地址');
  const defaultTopupNotify = `${serverBase}/api/alipay/notify`;
  const defaultSubscriptionNotify = `${serverBase}/api/subscription/alipay/notify`;

  return (
    <Spin spinning={loading}>
      <Form
        initValues={inputs}
        onValueChange={handleFormChange}
        getFormApi={(api) => (formApiRef.current = api)}
      >
        <Form.Section text={sectionTitle}>
          <Banner
            type='info'
            icon={<BookOpen size={16} />}
            description={
              <>
                {t('支付宝支付请配置页面支付（desktop page.pay）与手机网站支付（mobile wap.pay）。')}
                <br />
                {t('充值异步通知（开放平台需配置）')}：{defaultTopupNotify}
                <br />
                {t('订阅/自动续费异步通知（开放平台需配置）')}：
                {defaultSubscriptionNotify}
                <br />
                {t(
                  '自动续费签约与周期扣款回调固定走订阅通知地址，不受下方可选覆盖影响。',
                )}
              </>
            }
            style={{ marginBottom: 12 }}
          />
          <Banner
            type='warning'
            icon={<TriangleAlert size={16} />}
            description={t('密钥类配置保存后不会回显，留空表示保持当前不变。')}
            style={{ marginBottom: 16 }}
          />
          <Banner
            type='warning'
            icon={<TriangleAlert size={16} />}
            description={
              <>
                {t('关闭支付宝只会阻止新订单，已创建未完成订单仍依赖当前配置处理异步回调和补单。')}
                <br />
                {pendingOrderCount > 0
                  ? t(buildAlipayPendingOrdersWarning(pendingOrderCount))
                  : t('当前没有支付宝待处理订单。')}
              </>
            }
            style={{ marginBottom: 16 }}
          />
          <Row gutter={{ xs: 8, sm: 16, md: 24, lg: 24, xl: 24, xxl: 24 }}>
            <Col xs={24} sm={24} md={8} lg={8} xl={8}>
              <Form.Switch
                field='AlipayEnabled'
                size='default'
                checkedText='｜'
                uncheckedText='〇'
                label={t('启用支付宝支付')}
              />
            </Col>
            <Col xs={24} sm={24} md={8} lg={8} xl={8}>
              <Form.Switch
                field='AlipaySandbox'
                size='default'
                checkedText='｜'
                uncheckedText='〇'
                label={t('启用沙箱环境')}
              />
            </Col>
            <Col xs={24} sm={24} md={8} lg={8} xl={8}>
              <Form.InputNumber
                field='AlipayMinTopUp'
                label={t('最低充值数量')}
                placeholder={t('例如：1')}
                min={0}
                precision={0}
                step={1}
              />
            </Col>
          </Row>
          <Row
            gutter={{ xs: 8, sm: 16, md: 24, lg: 24, xl: 24, xxl: 24 }}
            style={{ marginTop: 16 }}
          >
            <Col xs={24} sm={24} md={8} lg={8} xl={8}>
              <Form.Input
                field='AlipayAppID'
                label={t('应用 AppID')}
                placeholder={t('请输入支付宝应用 AppID')}
              />
            </Col>
            <Col xs={24} sm={24} md={8} lg={8} xl={8}>
              <Form.Input
                field='AlipaySellerID'
                label={t('卖家账户 ID')}
                placeholder={t('例如：2088xxxxxxxxxxxx')}
              />
            </Col>
            <Col xs={24} sm={24} md={8} lg={8} xl={8}>
              <Form.Input
                field='AlipayGateway'
                label={t('网关地址')}
                placeholder={t('例如：https://openapi.alipay.com/gateway.do')}
              />
            </Col>
          </Row>
          <Row
            gutter={{ xs: 8, sm: 16, md: 24, lg: 24, xl: 24, xxl: 24 }}
            style={{ marginTop: 16 }}
          >
            <Col xs={24} sm={24} md={12} lg={12} xl={12}>
              <Form.Input
                field='AlipayNotifyURL'
                label={t('充值异步通知覆盖地址（可选）')}
                placeholder={t('留空使用默认 /api/alipay/notify')}
                extraText={t(
                  '仅影响充值；自动续费固定使用 /api/subscription/alipay/notify',
                )}
              />
            </Col>
            <Col xs={24} sm={24} md={12} lg={12} xl={12}>
              <Form.Input
                field='AlipayReturnURL'
                label={t('同步返回地址')}
                placeholder={t('例如：https://your-domain.com/console/topup')}
              />
            </Col>
          </Row>
          <Banner
            type='info'
            icon={<BookOpen size={16} />}
            description={
              <>
                {t(
                  '自动续费采用「支付并签约」：首期在支付页完成付款并授权周期扣款；之后仅在周期到期时由系统主动扣款。',
                )}
                <br />
                {t(
                  '个人产品码 / 销售产品码 / 签约场景必须与支付宝签约合同一致，默认值为常见样例，上线前请改成你的商户参数。',
                )}
              </>
            }
            style={{ marginTop: 20, marginBottom: 12 }}
          />
          <Row gutter={{ xs: 8, sm: 16, md: 24, lg: 24, xl: 24, xxl: 24 }}>
            <Col xs={24} sm={24} md={8} lg={8} xl={8}>
              <Form.Switch
                field='AlipayCyclePayEnabled'
                size='default'
                checkedText='｜'
                uncheckedText='〇'
                label={t('启用支付宝自动续费（周期扣款）')}
              />
            </Col>
            <Col xs={24} sm={24} md={8} lg={8} xl={8}>
              <Form.Input
                field='AlipayCyclePayPersonalProductCode'
                label={t('周期扣款个人产品码')}
                placeholder='CYCLE_PAY_AUTH_P'
              />
            </Col>
            <Col xs={24} sm={24} md={8} lg={8} xl={8}>
              <Form.Input
                field='AlipayCyclePayProductCode'
                label={t('周期扣款销售产品码')}
                placeholder='GENERAL_WITHHOLDING'
              />
            </Col>
          </Row>
          <Row
            gutter={{ xs: 8, sm: 16, md: 24, lg: 24, xl: 24, xxl: 24 }}
            style={{ marginTop: 16 }}
          >
            <Col xs={24} sm={24} md={12} lg={12} xl={12}>
              <Form.Input
                field='AlipayCyclePaySignScene'
                label={t('周期扣款签约场景')}
                placeholder='INDUSTRY|DEFAULT'
                extraText={t('与支付宝签约场景一致，例如 INDUSTRY|DEFAULT')}
              />
            </Col>
          </Row>
          <Row
            gutter={{ xs: 8, sm: 16, md: 24, lg: 24, xl: 24, xxl: 24 }}
            style={{ marginTop: 16 }}
          >
            <Col xs={24} sm={24} md={12} lg={12} xl={12}>
              <Form.TextArea
                field='AlipayPrivateKey'
                label={t('应用私钥')}
                placeholder={t('请输入应用私钥，留空表示保持当前不变')}
                autosize={{ minRows: 6, maxRows: 12 }}
              />
              <Popconfirm
                title={t('确认清空应用私钥？')}
                content={t(buildClearAlipayKeyWarning(t('应用私钥'), pendingOrderCount))}
                onConfirm={() =>
                  handleClearOption('AlipayPrivateKey', 'AlipayPrivateKey', t('应用私钥'))
                }
              >
                <Button style={{ marginTop: 8 }} type='danger' theme='light'>
                  {t('清空应用私钥')}
                </Button>
              </Popconfirm>
            </Col>
            <Col xs={24} sm={24} md={12} lg={12} xl={12}>
              <Form.TextArea
                field='AlipayPublicKey'
                label={t('支付宝公钥')}
                placeholder={t('请输入支付宝公钥，留空表示保持当前不变')}
                autosize={{ minRows: 6, maxRows: 12 }}
              />
              <Popconfirm
                title={t('确认清空支付宝公钥？')}
                content={t(buildClearAlipayKeyWarning(t('支付宝公钥'), pendingOrderCount))}
                onConfirm={() =>
                  handleClearOption('AlipayPublicKey', 'AlipayPublicKey', t('支付宝公钥'))
                }
              >
                <Button style={{ marginTop: 8 }} type='danger' theme='light'>
                  {t('清空支付宝公钥')}
                </Button>
              </Popconfirm>
            </Col>
          </Row>
          {saveNeedsDangerConfirm ? (
            <Popconfirm
              title={t('确认保存高风险变更？')}
              content={saveDangerContent}
              onConfirm={submitAlipaySetting}
            >
              <Button style={{ marginTop: 24 }}>{t('保存支付宝设置')}</Button>
            </Popconfirm>
          ) : (
            <Button style={{ marginTop: 24 }} onClick={submitAlipaySetting}>
              {t('保存支付宝设置')}
            </Button>
          )}
        </Form.Section>
      </Form>
    </Spin>
  );
}
