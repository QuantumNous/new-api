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
import {
  API,
  removeTrailingSlash,
  showError,
  showSuccess,
} from '../../../helpers';
import { useTranslation } from 'react-i18next';
import { BookOpen, TriangleAlert } from 'lucide-react';

export default function SettingsPaymentGatewayWxpay(props) {
  const { t } = useTranslation();
  const sectionTitle = props.hideSectionTitle
    ? undefined
    : t('微信支付直连设置');
  const [loading, setLoading] = useState(false);
  const [inputs, setInputs] = useState({
    WxpayAppId: '',
    WxpayMchId: '',
    WxpayPrivateKey: '',
    WxpayApiV3Key: '',
    WxpayCertSerial: '',
    WxpayPublicKey: '',
    WxpayPublicKeyId: '',
    WxpayMinTopUp: 1,
  });
  const formApiRef = useRef(null);

  useEffect(() => {
    if (props.options && formApiRef.current) {
      const currentInputs = {
        WxpayAppId: props.options.WxpayAppId || '',
        WxpayMchId: props.options.WxpayMchId || '',
        WxpayPrivateKey: '',
        WxpayApiV3Key: '',
        WxpayCertSerial: props.options.WxpayCertSerial || '',
        WxpayPublicKey: props.options.WxpayPublicKey || '',
        WxpayPublicKeyId: props.options.WxpayPublicKeyId || '',
        WxpayMinTopUp:
          props.options.WxpayMinTopUp !== undefined &&
          props.options.WxpayMinTopUp !== ''
            ? parseFloat(props.options.WxpayMinTopUp)
            : 1,
      };
      setInputs(currentInputs);
      formApiRef.current.setValues(currentInputs);
    }
  }, [props.options]);

  const handleFormChange = (values) => {
    setInputs(values);
  };

  const submit = async () => {
    if (!props.options.ServerAddress) {
      showError(t('请先填写服务器地址'));
      return;
    }
    setLoading(true);
    try {
      const options = [];
      // 普通字段：始终下发，允许清空
      [
        'WxpayAppId',
        'WxpayMchId',
        'WxpayCertSerial',
        'WxpayPublicKey',
        'WxpayPublicKeyId',
      ].forEach((k) => {
        if (inputs[k] !== undefined) {
          options.push({ key: k, value: inputs[k] || '' });
        }
      });
      // 敏感字段：仅在非空时提交，留空保持当前不变
      ['WxpayPrivateKey', 'WxpayApiV3Key'].forEach((k) => {
        if (inputs[k] && inputs[k] !== '') {
          options.push({ key: k, value: inputs[k] });
        }
      });
      if (
        inputs.WxpayMinTopUp !== undefined &&
        inputs.WxpayMinTopUp !== null &&
        inputs.WxpayMinTopUp !== ''
      ) {
        options.push({
          key: 'WxpayMinTopUp',
          value: inputs.WxpayMinTopUp.toString(),
        });
      }

      const results = await Promise.all(
        options.map((opt) =>
          API.put('/api/option/', { key: opt.key, value: opt.value }),
        ),
      );
      const errs = results.filter((r) => !r.data.success);
      if (errs.length > 0) {
        errs.forEach((r) => showError(r.data.message));
      } else {
        showSuccess(t('更新成功'));
        props.refresh?.();
      }
    } catch (e) {
      showError(t('更新失败'));
    }
    setLoading(false);
  };

  const callbackBase = props.options.ServerAddress
    ? removeTrailingSlash(props.options.ServerAddress)
    : t('网站地址');

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
                {t(
                  '微信支付官方直连（PC Native 扫码），费率约 0.6%。需在',
                )}
                <a
                  href='https://pay.weixin.qq.com'
                  target='_blank'
                  rel='noreferrer'
                >
                  {' '}
                  pay.weixin.qq.com{' '}
                </a>
                {t(
                  '注册商户号、绑定 AppID、开通"Native 支付"产品，并在 API 安全里申请商户证书与 APIv3 密钥、下载微信支付平台公钥。',
                )}
                <br />
                {t('Webhook 回调地址')}：{callbackBase}/api/wxpay/notify
                <br />
                {t('订阅 Webhook 回调地址')}：{callbackBase}
                /api/subscription/wxpay/notify
              </>
            }
            style={{ marginBottom: 12 }}
          />
          <Banner
            type='warning'
            icon={<TriangleAlert size={16} />}
            description={t(
              '本实现使用"微信支付平台公钥"模式（2024 年 10 月后新商户必须使用，老商户也建议升级）。商户 API 私钥与 APIv3 密钥保存后不会回显，留空即保持当前值不变。',
            )}
            style={{ marginBottom: 16 }}
          />
          <Row gutter={{ xs: 8, sm: 16, md: 24, lg: 24, xl: 24, xxl: 24 }}>
            <Col xs={24} sm={24} md={8} lg={8} xl={8}>
              <Form.Input
                field='WxpayAppId'
                label={t('AppID')}
                placeholder={t('例如：wxxxxxxxxxxxxxxxxx')}
                extraText={t('微信公众平台/开放平台 → AppID（以 wx 开头）')}
              />
            </Col>
            <Col xs={24} sm={24} md={8} lg={8} xl={8}>
              <Form.Input
                field='WxpayMchId'
                label={t('商户号 MchID')}
                placeholder={t('例如：1900000000')}
                extraText={t('商户平台 → 账户中心 → 商户号')}
              />
            </Col>
            <Col xs={24} sm={24} md={8} lg={8} xl={8}>
              <Form.InputNumber
                field='WxpayMinTopUp'
                label={t('最低充值数量')}
                placeholder={t('例如：1')}
                min={1}
                step={1}
                precision={0}
                extraText={t('用户单次最少可充值的额度数量')}
              />
            </Col>
          </Row>
          <Row
            gutter={{ xs: 8, sm: 16, md: 24, lg: 24, xl: 24, xxl: 24 }}
            style={{ marginTop: 16 }}
          >
            <Col xs={24} sm={24} md={12} lg={12} xl={12}>
              <Form.Input
                field='WxpayCertSerial'
                label={t('商户证书序列号')}
                placeholder={t('例如：5157F09EFDC096DE15EBE81A47057A7232F1B8E1')}
                extraText={t('商户平台 → API 安全 → 证书序列号')}
              />
            </Col>
            <Col xs={24} sm={24} md={12} lg={12} xl={12}>
              <Form.Input
                field='WxpayPublicKeyId'
                label={t('微信支付公钥 ID')}
                placeholder={t('例如：PUB_KEY_ID_xxxxxxxxxxxx')}
                extraText={t(
                  '商户平台 → API 安全 → 微信支付公钥 → 公钥 ID',
                )}
              />
            </Col>
          </Row>
          <Row
            gutter={{ xs: 8, sm: 16, md: 24, lg: 24, xl: 24, xxl: 24 }}
            style={{ marginTop: 16 }}
          >
            <Col xs={24} sm={24} md={12} lg={12} xl={12}>
              <Form.Input
                field='WxpayApiV3Key'
                label={t('APIv3 密钥')}
                placeholder={t(
                  '32 位字符串；留空表示保持当前不变',
                )}
                extraText={t(
                  '用于解密 webhook 回调，敏感字段，保存后不会回显',
                )}
                type='password'
              />
            </Col>
          </Row>
          <Row
            gutter={{ xs: 8, sm: 16, md: 24, lg: 24, xl: 24, xxl: 24 }}
            style={{ marginTop: 16 }}
          >
            <Col xs={24}>
              <Form.TextArea
                field='WxpayPrivateKey'
                label={t('商户 API 私钥（apiclient_key.pem）')}
                placeholder={t(
                  '留空表示保持当前不变；粘贴 apiclient_key.pem 全文（含或不含 PEM 头尾均可）',
                )}
                extraText={t('敏感字段，保存后不会回显')}
                style={{ fontFamily: 'JetBrains Mono, Consolas' }}
                autosize={{ minRows: 4, maxRows: 10 }}
              />
            </Col>
          </Row>
          <Row
            gutter={{ xs: 8, sm: 16, md: 24, lg: 24, xl: 24, xxl: 24 }}
            style={{ marginTop: 16 }}
          >
            <Col xs={24}>
              <Form.TextArea
                field='WxpayPublicKey'
                label={t('微信支付平台公钥')}
                placeholder={t(
                  '粘贴微信支付平台公钥（含或不含 PEM 头尾均可）',
                )}
                extraText={t(
                  '用于验签 webhook，注意是"平台公钥"，不是商户证书里的公钥',
                )}
                style={{ fontFamily: 'JetBrains Mono, Consolas' }}
                autosize={{ minRows: 4, maxRows: 10 }}
              />
            </Col>
          </Row>
          <Button onClick={submit} style={{ marginTop: 16 }}>
            {t('更新微信支付直连设置')}
          </Button>
        </Form.Section>
      </Form>
    </Spin>
  );
}
