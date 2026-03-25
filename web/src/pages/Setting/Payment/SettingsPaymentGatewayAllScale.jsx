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

import React, { useEffect, useState, useRef } from 'react';
import {
  Banner,
  Button,
  Form,
  Row,
  Col,
  Typography,
  Spin,
} from '@douyinfe/semi-ui';
import { API, showError, showSuccess } from '../../../helpers';
import { useTranslation } from 'react-i18next';

const { Text } = Typography;

export default function SettingsPaymentGatewayAllScale(props) {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [inputs, setInputs] = useState({
    AllScaleEnabled: false,
    AllScaleApiKey: '',
    AllScaleApiSecret: '',
    AllScaleBaseURL: 'https://openapi.allscale.io',
    AllScaleUnitPrice: 1,
  });
  const [originInputs, setOriginInputs] = useState({});
  const [hasExistingApiKey, setHasExistingApiKey] = useState(false);
  const [hasExistingApiSecret, setHasExistingApiSecret] = useState(false);
  const formApiRef = useRef(null);

  useEffect(() => {
    if (props.options && formApiRef.current) {
      const currentInputs = {
        AllScaleEnabled:
          props.options.AllScaleEnabled === 'true' ||
          props.options.AllScaleEnabled === true,
        AllScaleApiKey: '',
        AllScaleApiSecret: '',
        AllScaleBaseURL:
          props.options.AllScaleBaseURL || 'https://openapi.allscale.io',
        AllScaleUnitPrice: parseFloat(props.options.AllScaleUnitPrice) || 1,
      };
      setHasExistingApiKey(props.options.AllScaleApiKeySet === 'true');
      setHasExistingApiSecret(props.options.AllScaleApiSecretSet === 'true');
      setInputs(currentInputs);
      setOriginInputs({ ...currentInputs });
      formApiRef.current.setValues(currentInputs);
    }
  }, [props.options]);

  const handleFormChange = (values) => {
    setInputs(values);
  };

  const submitAllScaleSetting = async () => {
    if (inputs.AllScaleEnabled) {
      if (!inputs.AllScaleApiKey.trim() && !hasExistingApiKey) {
        showError(t('启用 AllScale 时，API Key 不能为空'));
        return;
      }
      if (!inputs.AllScaleApiSecret.trim() && !hasExistingApiSecret) {
        showError(t('启用 AllScale 时，API Secret 不能为空'));
        return;
      }
    }
    setLoading(true);
    try {
      // Save credentials and config first, then enable — so AllScale is never
      // active in a broken/unconfigured state if a partial write fails.
      const credentialOptions = [
        {
          key: 'AllScaleBaseURL',
          value: inputs.AllScaleBaseURL || 'https://openapi.allscale.io',
        },
        {
          key: 'AllScaleUnitPrice',
          value: String(parseFloat(inputs.AllScaleUnitPrice) || 1),
        },
      ];

      if (inputs.AllScaleApiKey.trim()) {
        credentialOptions.push({ key: 'AllScaleApiKey', value: inputs.AllScaleApiKey });
      }
      if (inputs.AllScaleApiSecret.trim()) {
        credentialOptions.push({
          key: 'AllScaleApiSecret',
          value: inputs.AllScaleApiSecret,
        });
      }

      const credentialResults = await Promise.all(
        credentialOptions.map((opt) =>
          API.put('/api/option/', { key: opt.key, value: opt.value }),
        ),
      );

      const enableResult = await API.put('/api/option/', {
        key: 'AllScaleEnabled',
        value: inputs.AllScaleEnabled ? 'true' : 'false',
      });

      const results = [...credentialResults, enableResult];

      const errorResults = results.filter((res) => !res.data.success);
      if (errorResults.length > 0) {
        errorResults.forEach((res) => showError(res.data.message));
      } else {
        showSuccess(t('更新成功'));
        if (inputs.AllScaleApiKey.trim()) {
          setHasExistingApiKey(true);
          formApiRef.current?.setValue('AllScaleApiKey', '');
          setInputs((prev) => ({ ...prev, AllScaleApiKey: '' }));
        }
        if (inputs.AllScaleApiSecret.trim()) {
          setHasExistingApiSecret(true);
          formApiRef.current?.setValue('AllScaleApiSecret', '');
          setInputs((prev) => ({ ...prev, AllScaleApiSecret: '' }));
        }
        setOriginInputs({ ...inputs, AllScaleApiKey: '', AllScaleApiSecret: '' });
        props.refresh?.();
      }
    } catch {
      showError(t('更新失败'));
    }
    setLoading(false);
  };

  const serverAddress = props.options?.ServerAddress?.trim();
  const webhookCallbackUrl = serverAddress
    ? `${serverAddress}/api/allscale/webhook`
    : '{your_domain}/api/allscale/webhook';
  const bannerDescription = t(
    '请在 AllScale 后台获取 API Key 和 API Secret，并在回调地址中填写 {your_domain}/api/allscale/webhook。',
  ).replace('{your_domain}/api/allscale/webhook', webhookCallbackUrl);

  return (
    <Spin spinning={loading}>
      <Form
        initValues={inputs}
        onValueChange={handleFormChange}
        getFormApi={(api) => (formApiRef.current = api)}
      >
        <Form.Section text={t('AllScale USDT 设置')}>
          <Text>
            {t('AllScale是一个专注稳定币支付的super app，提供稳定币收单及各类支付产品。')}
            <a
              href='https://docs.allscale.io/allscale-checkout/getting-started/getting-started-with-new-api'
              target='_blank'
              rel='noreferrer'
            >
              {' '}
              AllScale Official Site
            </a>
            <br />
          </Text>
          <Banner
            type='info'
            description={bannerDescription}
          />

          <Row gutter={{ xs: 8, sm: 16, md: 24, lg: 24, xl: 24, xxl: 24 }}>
            <Col xs={24} sm={24} md={8} lg={8} xl={8}>
              <Form.Switch
                field='AllScaleEnabled'
                label={t('启用 AllScale')}
                size='default'
                checkedText='｜'
                uncheckedText='〇'
              />
            </Col>
          </Row>

          <Row gutter={{ xs: 8, sm: 16, md: 24, lg: 24, xl: 24, xxl: 24 }}>
            <Col xs={24} sm={24} md={12} lg={12} xl={12}>
              <Form.Input
                field='AllScaleApiKey'
                label={t('API Key')}
                placeholder={hasExistingApiKey ? '****' : t('AllScale API Key')}
                type='password'
              />
            </Col>
            <Col xs={24} sm={24} md={12} lg={12} xl={12}>
              <Form.Input
                field='AllScaleApiSecret'
                label={t('API Secret')}
                placeholder={hasExistingApiSecret ? '****' : t('AllScale API Secret')}
                type='password'
              />
            </Col>
          </Row>

          <Row gutter={{ xs: 8, sm: 16, md: 24, lg: 24, xl: 24, xxl: 24 }}>
            <Col xs={24} sm={24} md={12} lg={12} xl={12}>
              <Form.Input
                field='AllScaleBaseURL'
                label={t('API Base URL')}
                placeholder='https://openapi.allscale.io'
                extraText={t('默认 https://openapi.allscale.io，无需修改')}
              />
            </Col>
          </Row>

          <Row gutter={{ xs: 8, sm: 16, md: 24, lg: 24, xl: 24, xxl: 24 }}>
            <Col xs={24} sm={24} md={12} lg={12} xl={12}>
              <Form.InputNumber
                field='AllScaleUnitPrice'
                label={t('货币汇率（每 1 美元等于多少货币单位）')}
                placeholder='1'
                min={0.0001}
                precision={4}
                extraText={t('默认为 1，即使用美元。例如填写 10 表示 10 个货币单位 = 1 USD')}
              />
            </Col>
          </Row>

          <Button onClick={submitAllScaleSetting} style={{ marginTop: 16 }}>
            {t('更新 AllScale USDT 设置')}
          </Button>
        </Form.Section>
      </Form>
    </Spin>
  );
}
