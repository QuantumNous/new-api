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
import { Banner, Button, Col, Form, Row, Spin } from '@douyinfe/semi-ui';
import { BookOpen, TriangleAlert } from 'lucide-react';
import {
  API,
  removeTrailingSlash,
  showError,
  showSuccess,
} from '../../../helpers';
import { useTranslation } from 'react-i18next';

export default function SettingsPaymentGatewayAlipay(props) {
  const { t } = useTranslation();
  const sectionTitle = props.hideSectionTitle ? undefined : t('支付宝设置');
  const [loading, setLoading] = useState(false);
  const [inputs, setInputs] = useState({
    AlipayAppId: '',
    AlipayPrivateKey: '',
    AlipayPublicKey: '',
    AlipayAppCertPublicKey: '',
    AlipayRootCert: '',
    AlipayPublicCert: '',
    AlipaySandbox: false,
    AlipayMinTopUp: 1,
    DirectPayAlipayEnabled: false,
  });
  const formApiRef = useRef(null);

  useEffect(() => {
    if (props.options && formApiRef.current) {
      const currentInputs = {
        AlipayAppId: props.options.AlipayAppId || '',
        AlipayPrivateKey: props.options.AlipayPrivateKey || '',
        AlipayPublicKey: props.options.AlipayPublicKey || '',
        AlipayAppCertPublicKey: props.options.AlipayAppCertPublicKey || '',
        AlipayRootCert: props.options.AlipayRootCert || '',
        AlipayPublicCert: props.options.AlipayPublicCert || '',
        AlipaySandbox: Boolean(props.options.AlipaySandbox),
        DirectPayAlipayEnabled: Boolean(props.options.DirectPayAlipayEnabled),
        AlipayMinTopUp:
          props.options.AlipayMinTopUp !== undefined
            ? parseFloat(props.options.AlipayMinTopUp)
            : 1,
      };
      setInputs(currentInputs);
      formApiRef.current.setValues(currentInputs);
    }
  }, [props.options]);

  const submitAlipaySetting = async () => {
    if (props.options.ServerAddress === '') {
      showError(t('请先填写服务器地址'));
      return;
    }

    setLoading(true);
    try {
      const options = [
        { key: 'AlipayAppId', value: inputs.AlipayAppId || '' },
        { key: 'AlipaySandbox', value: String(Boolean(inputs.AlipaySandbox)) },
        {
          key: 'DirectPayAlipayEnabled',
          value: String(Boolean(inputs.DirectPayAlipayEnabled)),
        },
        { key: 'AlipayMinTopUp', value: String(inputs.AlipayMinTopUp || 1) },
      ];

      if (inputs.AlipayPrivateKey) {
        options.push({
          key: 'AlipayPrivateKey',
          value: inputs.AlipayPrivateKey,
        });
      }
      if (inputs.AlipayPublicKey) {
        options.push({ key: 'AlipayPublicKey', value: inputs.AlipayPublicKey });
      }
      if (inputs.AlipayAppCertPublicKey) {
        options.push({
          key: 'AlipayAppCertPublicKey',
          value: inputs.AlipayAppCertPublicKey,
        });
      }
      if (inputs.AlipayRootCert) {
        options.push({ key: 'AlipayRootCert', value: inputs.AlipayRootCert });
      }
      if (inputs.AlipayPublicCert) {
        options.push({
          key: 'AlipayPublicCert',
          value: inputs.AlipayPublicCert,
        });
      }

      const results = await Promise.all(
        options.map((opt) => API.put('/api/option/', opt)),
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
        onValueChange={setInputs}
        getFormApi={(api) => (formApiRef.current = api)}
      >
        <Form.Section text={sectionTitle}>
          <Banner
            type='info'
            icon={<BookOpen size={16} />}
            description={
              <>
                {t('支付宝异步回调地址')}：
                {props.options.ServerAddress
                  ? removeTrailingSlash(props.options.ServerAddress)
                  : t('网站地址')}
                /api/user/direct-pay/alipay/notify
              </>
            }
            style={{ marginBottom: 12 }}
          />
          <Banner
            type='warning'
            icon={<TriangleAlert size={16} />}
            description={t(
              '支持普通公钥模式或证书模式。证书模式需同时填写应用公钥证书、支付宝根证书和支付宝公钥证书。',
            )}
            style={{ marginBottom: 16 }}
          />

          <Row gutter={{ xs: 8, sm: 16, md: 24, lg: 24, xl: 24, xxl: 24 }}>
            <Col xs={24} sm={24} md={8} lg={8} xl={8}>
              <Form.Input field='AlipayAppId' label='AppID' />
            </Col>
            <Col xs={24} sm={24} md={8} lg={8} xl={8}>
              <Form.InputNumber
                field='AlipayMinTopUp'
                label={t('最低充值数量')}
                min={1}
                precision={0}
              />
            </Col>
            <Col xs={24} sm={24} md={8} lg={8} xl={8}>
              <Form.Switch field='AlipaySandbox' label={t('沙箱模式')} />
            </Col>
            <Col xs={24} sm={24} md={8} lg={8} xl={8}>
              <Form.Switch
                field='DirectPayAlipayEnabled'
                label={t('启用支付宝直连支付')}
              />
            </Col>
          </Row>

          <Row style={{ marginTop: 16 }}>
            <Col span={24}>
              <Form.TextArea
                field='AlipayPrivateKey'
                label={t('应用私钥')}
                placeholder={t('留空表示保持当前不变')}
                autosize={{ minRows: 4, maxRows: 8 }}
              />
            </Col>
          </Row>
          <Row style={{ marginTop: 16 }}>
            <Col span={24}>
              <Form.TextArea
                field='AlipayPublicKey'
                label={t('支付宝公钥')}
                placeholder={t('普通公钥模式填写，留空表示保持当前不变')}
                autosize={{ minRows: 4, maxRows: 8 }}
              />
            </Col>
          </Row>
          <Row style={{ marginTop: 16 }}>
            <Col span={24}>
              <Form.TextArea
                field='AlipayAppCertPublicKey'
                label={t('应用公钥证书')}
                placeholder={t('证书模式填写，留空表示保持当前不变')}
                autosize={{ minRows: 3, maxRows: 6 }}
              />
            </Col>
          </Row>
          <Row style={{ marginTop: 16 }}>
            <Col span={24}>
              <Form.TextArea
                field='AlipayRootCert'
                label={t('支付宝根证书')}
                placeholder={t('证书模式填写，留空表示保持当前不变')}
                autosize={{ minRows: 3, maxRows: 6 }}
              />
            </Col>
          </Row>
          <Row style={{ marginTop: 16 }}>
            <Col span={24}>
              <Form.TextArea
                field='AlipayPublicCert'
                label={t('支付宝公钥证书')}
                placeholder={t('证书模式填写，留空表示保持当前不变')}
                autosize={{ minRows: 3, maxRows: 6 }}
              />
            </Col>
          </Row>

          <Button onClick={submitAlipaySetting} style={{ marginTop: 16 }}>
            {t('更新支付宝设置')}
          </Button>
        </Form.Section>
      </Form>
    </Spin>
  );
}
