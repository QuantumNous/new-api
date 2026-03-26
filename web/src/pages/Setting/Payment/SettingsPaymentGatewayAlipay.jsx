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
  Banner,
  Button,
  Col,
  Form,
  Row,
  Spin,
  Typography,
} from '@douyinfe/semi-ui';
import {
  API,
  removeTrailingSlash,
  showError,
  showSuccess,
} from '../../../helpers';
import { useTranslation } from 'react-i18next';

const { Text } = Typography;

export default function SettingsPaymentGatewayAlipay(props) {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [inputs, setInputs] = useState({
    AlipayF2FEnabled: false,
    AlipayF2FAppID: '',
    AlipayF2FPrivateKey: '',
    AlipayF2FPublicKey: '',
    AlipayF2FSandbox: false,
    AlipayF2FNotifyUrl: '',
  });
  const [originInputs, setOriginInputs] = useState({});
  const formApiRef = useRef(null);

  useEffect(() => {
    if (props.options && formApiRef.current) {
      const currentInputs = {
        AlipayF2FEnabled: props.options.AlipayF2FEnabled ?? false,
        AlipayF2FAppID: props.options.AlipayF2FAppID || '',
        AlipayF2FPrivateKey: props.options.AlipayF2FPrivateKey || '',
        AlipayF2FPublicKey: props.options.AlipayF2FPublicKey || '',
        AlipayF2FSandbox: props.options.AlipayF2FSandbox ?? false,
        AlipayF2FNotifyUrl: props.options.AlipayF2FNotifyUrl || '',
      };
      setInputs(currentInputs);
      setOriginInputs({ ...currentInputs });
      formApiRef.current.setValues(currentInputs);
    }
  }, [props.options]);

  const handleFormChange = (values) => {
    setInputs(values);
  };

  const defaultNotifyUrl = props.options.ServerAddress
    ? `${removeTrailingSlash(props.options.ServerAddress)}/api/alipay/notify`
    : '';
  const effectiveNotifyUrl =
    removeTrailingSlash(inputs.AlipayF2FNotifyUrl || '') || defaultNotifyUrl;
  const savedNotifyUrl =
    removeTrailingSlash(originInputs.AlipayF2FNotifyUrl || '') ||
    defaultNotifyUrl;

  const submitAlipaySetting = async () => {
    if (inputs.AlipayF2FEnabled && !effectiveNotifyUrl) {
      showError(t('启用支付宝当面付前请先配置服务器地址或显式回调地址'));
      return;
    }

    const options = [
      {
        key: 'AlipayF2FEnabled',
        value: inputs.AlipayF2FEnabled ? 'true' : 'false',
      },
      {
        key: 'AlipayF2FSandbox',
        value: inputs.AlipayF2FSandbox ? 'true' : 'false',
      },
      {
        key: 'AlipayF2FAppID',
        value: (inputs.AlipayF2FAppID || '').trim(),
      },
      {
        key: 'AlipayF2FNotifyUrl',
        value: removeTrailingSlash(inputs.AlipayF2FNotifyUrl || ''),
      },
    ];

    if (
      inputs.AlipayF2FPrivateKey &&
      inputs.AlipayF2FPrivateKey.trim() !== ''
    ) {
      options.push({
        key: 'AlipayF2FPrivateKey',
        value: inputs.AlipayF2FPrivateKey,
      });
    }
    if (inputs.AlipayF2FPublicKey && inputs.AlipayF2FPublicKey.trim() !== '') {
      options.push({
        key: 'AlipayF2FPublicKey',
        value: inputs.AlipayF2FPublicKey,
      });
    }

    setLoading(true);
    try {
      const results = await Promise.all(
        options.map((opt) =>
          API.put('/api/option/', {
            key: opt.key,
            value: opt.value,
          }),
        ),
      );
      const errorResults = results.filter((res) => !res.data.success);
      if (errorResults.length > 0) {
        errorResults.forEach((res) => showError(res.data.message));
        return;
      }
      showSuccess(t('更新成功'));
      setOriginInputs({ ...inputs });
      props.refresh?.();
    } catch (error) {
      showError(t('更新失败'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Spin spinning={loading}>
      <Form
        initValues={inputs}
        onValueChange={handleFormChange}
        getFormApi={(api) => (formApiRef.current = api)}
      >
        <Form.Section text={t('支付宝当面付设置')}>
          <Text>
            {t(
              '使用支付宝开放平台官方当面付接口，创建二维码订单并在站内新标签页中完成支付。',
            )}
          </Text>
          <Banner
            type={savedNotifyUrl ? 'info' : 'warning'}
            description={
              savedNotifyUrl
                ? `${t('默认回调地址')}：${savedNotifyUrl}`
                : t(
                    '请先配置服务器地址或显式回调地址，否则无法启用支付宝当面付',
                  )
            }
          />
          <Row gutter={{ xs: 8, sm: 16, md: 24, lg: 24, xl: 24, xxl: 24 }}>
            <Col xs={24} sm={24} md={8} lg={8} xl={8}>
              <Form.Switch
                field='AlipayF2FEnabled'
                label={t('启用支付宝当面付')}
                checkedText='开'
                uncheckedText='关'
              />
            </Col>
            <Col xs={24} sm={24} md={8} lg={8} xl={8}>
              <Form.Switch
                field='AlipayF2FSandbox'
                label={t('使用沙盒网关')}
                checkedText='开'
                uncheckedText='关'
              />
            </Col>
            <Col xs={24} sm={24} md={8} lg={8} xl={8}>
              <Form.Input
                field='AlipayF2FAppID'
                label={t('应用 AppID')}
                placeholder={t('请输入支付宝开放平台 AppID')}
              />
            </Col>
          </Row>

          <Row
            gutter={{ xs: 8, sm: 16, md: 24, lg: 24, xl: 24, xxl: 24 }}
            style={{ marginTop: 16 }}
          >
            <Col span={24}>
              <Form.TextArea
                field='AlipayF2FPrivateKey'
                label={t('应用私钥')}
                placeholder={t('请输入 RSA2 应用私钥，敏感信息不会回显')}
                autosize
              />
            </Col>
          </Row>

          <Row
            gutter={{ xs: 8, sm: 16, md: 24, lg: 24, xl: 24, xxl: 24 }}
            style={{ marginTop: 16 }}
          >
            <Col span={24}>
              <Form.TextArea
                field='AlipayF2FPublicKey'
                label={t('支付宝公钥')}
                placeholder={t('请输入支付宝公钥，敏感信息不会回显')}
                autosize
              />
            </Col>
          </Row>

          <Row
            gutter={{ xs: 8, sm: 16, md: 24, lg: 24, xl: 24, xxl: 24 }}
            style={{ marginTop: 16 }}
          >
            <Col span={24}>
              <Form.Input
                field='AlipayF2FNotifyUrl'
                label={t('回调地址')}
                placeholder={
                  defaultNotifyUrl || t('请输入公网可访问的支付宝回调地址')
                }
              />
            </Col>
          </Row>

          <Button onClick={submitAlipaySetting}>
            {t('更新支付宝当面付设置')}
          </Button>
        </Form.Section>
      </Form>
    </Spin>
  );
}
