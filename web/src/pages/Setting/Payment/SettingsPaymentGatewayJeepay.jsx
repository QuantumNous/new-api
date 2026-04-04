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
import { Button, Col, Form, Row, Spin, Typography } from '@douyinfe/semi-ui';
import { API, showError, showSuccess } from '../../../helpers';
import { useTranslation } from 'react-i18next';

const { Text } = Typography;

export default function SettingsPaymentGatewayJeepay(props) {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [inputs, setInputs] = useState({
    JeepayBaseURL: '',
    JeepayMchNo: '',
    JeepayAppID: '',
    JeepayAPIKey: '',
    JeepayWayCode: 'WEB_CASHIER',
    JeepayNotifyURL: '',
    JeepayReturnURL: '',
    JeepayMinTopUp: 1,
  });
  const formApiRef = useRef(null);

  useEffect(() => {
    if (props.options && formApiRef.current) {
      const currentInputs = {
        JeepayBaseURL: props.options.JeepayBaseURL || '',
        JeepayMchNo: props.options.JeepayMchNo || '',
        JeepayAppID: props.options.JeepayAppID || '',
        JeepayAPIKey: props.options.JeepayAPIKey || '',
        JeepayWayCode: props.options.JeepayWayCode || 'WEB_CASHIER',
        JeepayNotifyURL: props.options.JeepayNotifyURL || '',
        JeepayReturnURL: props.options.JeepayReturnURL || '',
        JeepayMinTopUp: parseInt(props.options.JeepayMinTopUp) || 1,
      };
      setInputs(currentInputs);
      formApiRef.current.setValues(currentInputs);
    }
  }, [props.options]);

  const handleFormChange = (values) => {
    setInputs(values);
  };

  const submitJeepaySetting = async () => {
    setLoading(true);
    try {
      const options = [
        { key: 'JeepayBaseURL', value: inputs.JeepayBaseURL || '' },
        { key: 'JeepayMchNo', value: inputs.JeepayMchNo || '' },
        { key: 'JeepayAppID', value: inputs.JeepayAppID || '' },
        { key: 'JeepayAPIKey', value: inputs.JeepayAPIKey || '' },
        { key: 'JeepayWayCode', value: inputs.JeepayWayCode || 'WEB_CASHIER' },
        { key: 'JeepayNotifyURL', value: inputs.JeepayNotifyURL || '' },
        { key: 'JeepayReturnURL', value: inputs.JeepayReturnURL || '' },
        { key: 'JeepayMinTopUp', value: String(inputs.JeepayMinTopUp || 1) },
      ];

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
      } else {
        showSuccess(t('更新成功'));
        props.refresh?.();
      }
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
        <Form.Section text={t('Jeepay 支付')}>
          <Text>{t('用于按现有 top_up 链路拉起 Jeepay 收银台并接收异步通知。')}</Text>
          <Row gutter={{ xs: 8, sm: 16, md: 24, lg: 24, xl: 24, xxl: 24 }}>
            <Col xs={24} sm={24} md={12}>
              <Form.Input
                field='JeepayBaseURL'
                label={t('Jeepay 服务地址')}
                placeholder={t('例如：https://pay.example.com')}
              />
            </Col>
            <Col xs={24} sm={24} md={12}>
              <Form.Input
                field='JeepayMchNo'
                label={t('商户号')}
                placeholder={t('Jeepay mchNo')}
              />
            </Col>
          </Row>
          <Row
            gutter={{ xs: 8, sm: 16, md: 24, lg: 24, xl: 24, xxl: 24 }}
            style={{ marginTop: 16 }}
          >
            <Col xs={24} sm={24} md={12}>
              <Form.Input
                field='JeepayAppID'
                label={t('应用 ID')}
                placeholder={t('Jeepay appId')}
              />
            </Col>
            <Col xs={24} sm={24} md={12}>
              <Form.Input
                field='JeepayAPIKey'
                label={t('API 密钥')}
                placeholder={t('敏感信息不会发送到前端显示')}
                type='password'
              />
            </Col>
          </Row>
          <Row
            gutter={{ xs: 8, sm: 16, md: 24, lg: 24, xl: 24, xxl: 24 }}
            style={{ marginTop: 16 }}
          >
            <Col xs={24} sm={24} md={8}>
              <Form.Input
                field='JeepayWayCode'
                label={t('支付方式编码')}
                placeholder='WEB_CASHIER'
              />
            </Col>
            <Col xs={24} sm={24} md={8}>
              <Form.InputNumber
                field='JeepayMinTopUp'
                label={t('最小充值数量')}
                min={1}
              />
            </Col>
          </Row>
          <Row
            gutter={{ xs: 8, sm: 16, md: 24, lg: 24, xl: 24, xxl: 24 }}
            style={{ marginTop: 16 }}
          >
            <Col xs={24} sm={24} md={12}>
              <Form.Input
                field='JeepayNotifyURL'
                label={t('异步通知地址')}
                placeholder={t('留空则使用系统回调地址')}
              />
            </Col>
            <Col xs={24} sm={24} md={12}>
              <Form.Input
                field='JeepayReturnURL'
                label={t('支付返回地址')}
                placeholder={t('留空则返回充值页')}
              />
            </Col>
          </Row>
          <Button
            style={{ marginTop: 16 }}
            type='primary'
            onClick={submitJeepaySetting}
          >
            {t('保存 Jeepay 设置')}
          </Button>
        </Form.Section>
      </Form>
    </Spin>
  );
}
