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
import { Button, Form, Row, Col, Spin } from '@douyinfe/semi-ui';
import { API, showError, showSuccess } from '../../../helpers';
import { useTranslation } from 'react-i18next';

export default function SettingsPaymentGatewayAlipayF2F(props) {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [inputs, setInputs] = useState({
    AlipayF2FAppId: '',
    AlipayF2FAppPrivateKey: '',
    AlipayF2FAlipayPublicKey: '',
  });
  const [originInputs, setOriginInputs] = useState({});
  const formApiRef = useRef(null);

  useEffect(() => {
    if (props.options && formApiRef.current) {
      const currentInputs = {
        AlipayF2FAppId: props.options.AlipayF2FAppId || '',
        AlipayF2FAppPrivateKey: props.options.AlipayF2FAppPrivateKey || '',
        AlipayF2FAlipayPublicKey: props.options.AlipayF2FAlipayPublicKey || '',
      };
      setInputs(currentInputs);
      setOriginInputs({ ...currentInputs });
      formApiRef.current.setValues(currentInputs);
    }
  }, [props.options]);

  const handleFormChange = (values) => {
    setInputs(values);
  };

  const submitAlipayF2FSetting = async () => {
    setLoading(true);
    try {
      const options = [];

      if (inputs.AlipayF2FAppId !== '') {
        options.push({ key: 'AlipayF2FAppId', value: inputs.AlipayF2FAppId });
      }
      if (
        inputs.AlipayF2FAppPrivateKey !== undefined &&
        inputs.AlipayF2FAppPrivateKey !== ''
      ) {
        options.push({
          key: 'AlipayF2FAppPrivateKey',
          value: inputs.AlipayF2FAppPrivateKey,
        });
      }
      if (
        inputs.AlipayF2FAlipayPublicKey !== undefined &&
        inputs.AlipayF2FAlipayPublicKey !== ''
      ) {
        options.push({
          key: 'AlipayF2FAlipayPublicKey',
          value: inputs.AlipayF2FAlipayPublicKey,
        });
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
        showSuccess(t('更新当面付设置'));
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
        <Form.Section text={t('当面付设置')}>
          <Row gutter={{ xs: 8, sm: 16, md: 24, lg: 24, xl: 24, xxl: 24 }}>
            <Col xs={24} sm={24} md={8} lg={8} xl={8}>
              <Form.Input
                field='AlipayF2FAppId'
                label={t('当面付 AppID')}
                placeholder={t('例如：2021000000000000')}
              />
            </Col>
            <Col xs={24} sm={24} md={8} lg={8} xl={8}>
              <Form.TextArea
                field='AlipayF2FAppPrivateKey'
                label={t('当面付应用私钥')}
                placeholder={t('仅保存到服务器')}
                autosize
              />
            </Col>
            <Col xs={24} sm={24} md={8} lg={8} xl={8}>
              <Form.TextArea
                field='AlipayF2FAlipayPublicKey'
                label={t('当面付支付宝公钥')}
                placeholder={t('仅保存到服务器')}
                autosize
              />
            </Col>
          </Row>
          <Button onClick={submitAlipayF2FSetting} style={{ marginTop: 16 }}>
            {t('保存当面付设置')}
          </Button>
        </Form.Section>
      </Form>
    </Spin>
  );
}
