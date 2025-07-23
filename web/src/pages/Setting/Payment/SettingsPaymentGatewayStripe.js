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
const { Text } = Typography;
import {
  API,
  removeTrailingSlash,
  showError,
  showSuccess,
} from '../../../helpers';
import { useTranslation } from 'react-i18next';

export default function SettingsPaymentGateway(props) {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [inputs, setInputs] = useState({
    StripeApiSecret: '',
    StripeWebhookSecret: '',
    StripePriceId: '',
    StripeUnitPrice: 8.0,
    StripeMinTopUp: 1,
  });
  const [originInputs, setOriginInputs] = useState({});
  const formApiRef = useRef(null);

  useEffect(() => {
    if (props.options && formApiRef.current) {
      const currentInputs = {
        StripeApiSecret: props.options.StripeApiSecret || '',
        StripeWebhookSecret: props.options.StripeWebhookSecret || '',
        StripePriceId: props.options.StripePriceId || '',
        StripeUnitPrice: props.options.StripeUnitPrice !== undefined ? parseFloat(props.options.StripeUnitPrice) : 8.0,
        StripeMinTopUp: props.options.StripeMinTopUp !== undefined ? parseFloat(props.options.StripeMinTopUp) : 1,
      };
      setInputs(currentInputs);
      setOriginInputs({ ...currentInputs });
      formApiRef.current.setValues(currentInputs);
    }
  }, [props.options]);

  const handleFormChange = (values) => {
    setInputs(values);
  };

  const submitStripeSetting = async () => {
    if (props.options.ServerAddress === '') {
      showError(t('请先填写服务器地址'));
      return;
    }

    setLoading(true);
    try {
      const options = []

      if (inputs.StripeApiSecret && inputs.StripeApiSecret !== '') {
        options.push({ key: 'StripeApiSecret', value: inputs.StripeApiSecret });
      }
      if (inputs.StripeWebhookSecret && inputs.StripeWebhookSecret !== '') {
        options.push({ key: 'StripeWebhookSecret', value: inputs.StripeWebhookSecret });
      }
      if (inputs.StripePriceId !== '') {
        options.push({key: 'StripePriceId', value: inputs.StripePriceId,});
      }
      if (inputs.StripeUnitPrice !== undefined && inputs.StripeUnitPrice !== null) {
        options.push({ key: 'StripeUnitPrice', value: inputs.StripeUnitPrice.toString() });
      }
      if (inputs.StripeMinTopUp !== undefined && inputs.StripeMinTopUp !== null) {
        options.push({ key: 'StripeMinTopUp', value: inputs.StripeMinTopUp.toString() });
      }

      // 发送请求
      const requestQueue = options.map(opt =>
        API.put('/api/option/', {
          key: opt.key,
          value: opt.value,
        })
      );

      const results = await Promise.all(requestQueue);

      // 检查所有请求是否成功
      const errorResults = results.filter(res => !res.data.success);
      if (errorResults.length > 0) {
        errorResults.forEach(res => {
          showError(res.data.message);
        });
      } else {
        showSuccess(t('更新成功'));
        // 更新本地存储的原始值
        setOriginInputs({ ...inputs });
        props.refresh?.();
      }
    } catch (error) {
      showError(t('更新失败'));
    }
    setLoading(false);
  };

  return (
    <Spin spinning={loading}>
      <Form
        initValues={inputs}
        onValueChange={handleFormChange}
        getFormApi={(api) => (formApiRef.current = api)}
      >
        <Form.Section text={t('Stripe 设置')}>
          <Text>
            Stripe 密钥、Webhook 等设置请
            <a
                href='https://dashboard.stripe.com/developers'
                target='_blank'
                rel='noreferrer'
            >
              点击此处
            </a>
            进行设置，最好先在
            <a
                href='https://dashboard.stripe.com/test/developers'
                target='_blank'
                rel='noreferrer'
            >
              测试环境
            </a>
            进行测试。

            <br />
          </Text>
          <Banner
              type='info'
              description={`Webhook 填：${props.options.ServerAddress ? removeTrailingSlash(props.options.ServerAddress) : t('网站地址')}/api/stripe/webhook`}
          />
          <Banner
              type='warning'
              description={`需要包含事件：checkout.session.completed 和 checkout.session.expired`}
          />
          <Row
            gutter={{ xs: 8, sm: 16, md: 24, lg: 24, xl: 24, xxl: 24 }}
          >
            <Col xs={24} sm={24} md={8} lg={8} xl={8}>
              <Form.Input
                field='StripeApiSecret'
                label={t('API 密钥')}
                placeholder={t('sk_xxx 或 rk_xxx 的 Stripe 密钥，敏感信息不显示')}
                type='password'
              />
            </Col>
            <Col xs={24} sm={24} md={8} lg={8} xl={8}>
              <Form.Input
                field='StripeWebhookSecret'
                label={t('Webhook 签名密钥')}
                placeholder={t('whsec_xxx 的 Webhook 签名密钥，敏感信息不显示')}
                type='password'
              />
            </Col>
            <Col xs={24} sm={24} md={8} lg={8} xl={8}>
              <Form.Input
                field='StripePriceId'
                label={t('商品价格 ID')}
                placeholder={t('price_xxx 的商品价格 ID，新建产品后可获得')}
              />
            </Col>
          </Row>
          <Row
            gutter={{ xs: 8, sm: 16, md: 24, lg: 24, xl: 24, xxl: 24 }}
            style={{ marginTop: 16 }}
          >
            <Col xs={24} sm={24} md={8} lg={8} xl={8}>
              <Form.InputNumber
                field='StripeUnitPrice'
                precision={2}
                label={t('充值价格（x元/美金）')}
                placeholder={t('例如：7，就是7元/美金')}
              />
            </Col>
            <Col xs={24} sm={24} md={8} lg={8} xl={8}>
              <Form.InputNumber
                field='StripeMinTopUp'
                label={t('最低充值美元数量')}
                placeholder={t('例如：2，就是最低充值2$')}
              />
            </Col>
          </Row>
          <Button onClick={submitStripeSetting}>{t('更新 Stripe 设置')}</Button>
        </Form.Section>
      </Form>
    </Spin>
  );
} 