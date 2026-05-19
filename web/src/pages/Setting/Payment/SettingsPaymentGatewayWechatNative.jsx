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

export default function SettingsPaymentGatewayWechatNative(props) {
  const { t } = useTranslation();
  const sectionTitle = props.hideSectionTitle
    ? undefined
    : t('微信支付 Native 设置');
  const [loading, setLoading] = useState(false);
  const [inputs, setInputs] = useState({
    WechatNativeAppId: '',
    WechatNativeMchId: '',
    WechatNativeApiV3Key: '',
    WechatNativeMerchantSerialNo: '',
    WechatNativeMerchantPrivateKey: '',
    WechatNativePlatformCert: '',
    WechatNativeMinTopUp: 1,
    DirectPayWechatEnabled: false,
  });
  const formApiRef = useRef(null);

  useEffect(() => {
    if (props.options && formApiRef.current) {
      const currentInputs = {
        WechatNativeAppId: props.options.WechatNativeAppId || '',
        WechatNativeMchId: props.options.WechatNativeMchId || '',
        WechatNativeApiV3Key: props.options.WechatNativeApiV3Key || '',
        WechatNativeMerchantSerialNo:
          props.options.WechatNativeMerchantSerialNo || '',
        WechatNativeMerchantPrivateKey:
          props.options.WechatNativeMerchantPrivateKey || '',
        WechatNativePlatformCert: props.options.WechatNativePlatformCert || '',
        WechatNativeMinTopUp:
          props.options.WechatNativeMinTopUp !== undefined
            ? parseFloat(props.options.WechatNativeMinTopUp)
            : 1,
        DirectPayWechatEnabled: Boolean(props.options.DirectPayWechatEnabled),
      };
      setInputs(currentInputs);
      formApiRef.current.setValues(currentInputs);
    }
  }, [props.options]);

  const submitWechatNativeSetting = async () => {
    if (props.options.ServerAddress === '') {
      showError(t('请先填写服务器地址'));
      return;
    }

    setLoading(true);
    try {
      const options = [
        { key: 'WechatNativeAppId', value: inputs.WechatNativeAppId || '' },
        { key: 'WechatNativeMchId', value: inputs.WechatNativeMchId || '' },
        {
          key: 'WechatNativeMerchantSerialNo',
          value: inputs.WechatNativeMerchantSerialNo || '',
        },
        {
          key: 'WechatNativeMinTopUp',
          value: String(inputs.WechatNativeMinTopUp || 1),
        },
        {
          key: 'DirectPayWechatEnabled',
          value: String(Boolean(inputs.DirectPayWechatEnabled)),
        },
      ];

      if (inputs.WechatNativeApiV3Key) {
        options.push({
          key: 'WechatNativeApiV3Key',
          value: inputs.WechatNativeApiV3Key,
        });
      }
      if (inputs.WechatNativeMerchantPrivateKey) {
        options.push({
          key: 'WechatNativeMerchantPrivateKey',
          value: inputs.WechatNativeMerchantPrivateKey,
        });
      }
      if (inputs.WechatNativePlatformCert) {
        options.push({
          key: 'WechatNativePlatformCert',
          value: inputs.WechatNativePlatformCert,
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
                {t('微信支付 Native 下单和回调地址')}：
                {props.options.ServerAddress
                  ? removeTrailingSlash(props.options.ServerAddress)
                  : t('网站地址')}
                /api/user/direct-pay/wechat-native/notify
              </>
            }
            style={{ marginBottom: 12 }}
          />
          <Banner
            type='warning'
            icon={<TriangleAlert size={16} />}
            description={t(
              '需在微信商户平台配置 APIv3 密钥、商户 API 证书，并填写微信支付平台证书 PEM 用于回调验签。',
            )}
            style={{ marginBottom: 16 }}
          />

          <Row gutter={{ xs: 8, sm: 16, md: 24, lg: 24, xl: 24, xxl: 24 }}>
            <Col xs={24} sm={24} md={8} lg={8} xl={8}>
              <Form.Input field='WechatNativeAppId' label='AppID' />
            </Col>
            <Col xs={24} sm={24} md={8} lg={8} xl={8}>
              <Form.Input field='WechatNativeMchId' label={t('商户号')} />
            </Col>
            <Col xs={24} sm={24} md={8} lg={8} xl={8}>
              <Form.Input
                field='WechatNativeMerchantSerialNo'
                label={t('商户证书序列号')}
              />
            </Col>
          </Row>

          <Row
            gutter={{ xs: 8, sm: 16, md: 24, lg: 24, xl: 24, xxl: 24 }}
            style={{ marginTop: 16 }}
          >
            <Col xs={24} sm={24} md={8} lg={8} xl={8}>
              <Form.Input
                field='WechatNativeApiV3Key'
                label='APIv3 Key'
                type='password'
                placeholder={t('32 位 APIv3 密钥，留空表示保持当前不变')}
              />
            </Col>
            <Col xs={24} sm={24} md={8} lg={8} xl={8}>
              <Form.InputNumber
                field='WechatNativeMinTopUp'
                label={t('最低充值数量')}
                min={1}
                precision={0}
              />
            </Col>
            <Col xs={24} sm={24} md={8} lg={8} xl={8}>
              <Form.Switch
                field='DirectPayWechatEnabled'
                label={t('启用微信直连支付')}
              />
            </Col>
          </Row>

          <Row style={{ marginTop: 16 }}>
            <Col span={24}>
              <Form.TextArea
                field='WechatNativeMerchantPrivateKey'
                label={t('商户私钥 PEM')}
                placeholder={t('apiclient_key.pem 内容，留空表示保持当前不变')}
                autosize={{ minRows: 4, maxRows: 8 }}
              />
            </Col>
          </Row>
          <Row style={{ marginTop: 16 }}>
            <Col span={24}>
              <Form.TextArea
                field='WechatNativePlatformCert'
                label={t('微信支付平台证书 PEM')}
                placeholder={t(
                  '用于验证微信支付回调签名，留空表示保持当前不变',
                )}
                autosize={{ minRows: 4, maxRows: 8 }}
              />
            </Col>
          </Row>

          <Button onClick={submitWechatNativeSetting} style={{ marginTop: 16 }}>
            {t('更新微信支付 Native 设置')}
          </Button>
        </Form.Section>
      </Form>
    </Spin>
  );
}
