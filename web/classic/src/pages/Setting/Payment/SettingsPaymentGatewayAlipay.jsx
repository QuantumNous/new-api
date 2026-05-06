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

export default function SettingsPaymentGatewayAlipay(props) {
  const { t } = useTranslation();
  const sectionTitle = props.hideSectionTitle
    ? undefined
    : t('支付宝直连设置');
  const [loading, setLoading] = useState(false);
  const [inputs, setInputs] = useState({
    AlipayAppId: '',
    AlipayPrivateKey: '',
    AlipayPublicKey: '',
    AlipayMinTopUp: 1,
    AlipaySandbox: false,
  });
  const [originInputs, setOriginInputs] = useState({});
  const formApiRef = useRef(null);

  useEffect(() => {
    if (props.options && formApiRef.current) {
      const currentInputs = {
        AlipayAppId: props.options.AlipayAppId || '',
        AlipayPrivateKey: '',
        AlipayPublicKey: props.options.AlipayPublicKey || '',
        AlipayMinTopUp:
          props.options.AlipayMinTopUp !== undefined &&
          props.options.AlipayMinTopUp !== ''
            ? parseFloat(props.options.AlipayMinTopUp)
            : 1,
        AlipaySandbox:
          props.options.AlipaySandbox !== undefined
            ? props.options.AlipaySandbox
            : false,
      };
      setInputs(currentInputs);
      setOriginInputs({ ...currentInputs });
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
      if (inputs.AlipayAppId !== undefined) {
        options.push({ key: 'AlipayAppId', value: inputs.AlipayAppId || '' });
      }
      // 私钥仅在非空时提交，留空保持当前不变
      if (inputs.AlipayPrivateKey && inputs.AlipayPrivateKey !== '') {
        options.push({
          key: 'AlipayPrivateKey',
          value: inputs.AlipayPrivateKey,
        });
      }
      if (inputs.AlipayPublicKey !== undefined) {
        options.push({
          key: 'AlipayPublicKey',
          value: inputs.AlipayPublicKey || '',
        });
      }
      if (
        inputs.AlipayMinTopUp !== undefined &&
        inputs.AlipayMinTopUp !== null &&
        inputs.AlipayMinTopUp !== ''
      ) {
        options.push({
          key: 'AlipayMinTopUp',
          value: inputs.AlipayMinTopUp.toString(),
        });
      }
      if (
        originInputs['AlipaySandbox'] !== inputs.AlipaySandbox &&
        inputs.AlipaySandbox !== undefined
      ) {
        options.push({
          key: 'AlipaySandbox',
          value: inputs.AlipaySandbox ? 'true' : 'false',
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
                  '支付宝官方直连（PC 扫码 / 网页跳转），费率约 0.6%。需在',
                )}
                <a
                  href='https://open.alipay.com'
                  target='_blank'
                  rel='noreferrer'
                >
                  {' '}
                  open.alipay.com{' '}
                </a>
                {t(
                  '创建网页&移动应用并开通"电脑网站支付"能力，下载应用私钥（PKCS8）与支付宝公钥。',
                )}
                <br />
                {t('Webhook 回调地址')}：{callbackBase}/api/alipay/notify
                <br />
                {t('订阅 Webhook 回调地址')}：{callbackBase}
                /api/subscription/alipay/notify
              </>
            }
            style={{ marginBottom: 12 }}
          />
          <Banner
            type='warning'
            icon={<TriangleAlert size={16} />}
            description={t(
              '应用私钥与支付宝公钥都是 RSA2 PKCS8 格式，可粘贴含/不含 PEM 头尾的内容。私钥保存后不会回显，留空即保持当前值不变。',
            )}
            style={{ marginBottom: 16 }}
          />
          {inputs.AlipaySandbox && (
            <Banner
              type='warning'
              icon={<TriangleAlert size={16} />}
              description={t(
                '当前已开启沙箱模式：SDK 调用沙箱网关、Webhook 也仅响应沙箱回调，真实用户无法通过此渠道完成支付。适合初次部署/联调。正式上线前请关闭此开关，并把 AppID/私钥/公钥换成正式环境的密钥。',
              )}
              style={{ marginBottom: 16 }}
            />
          )}
          <Row gutter={{ xs: 8, sm: 16, md: 24, lg: 24, xl: 24, xxl: 24 }}>
            <Col xs={24} sm={24} md={8} lg={8} xl={8}>
              <Form.Input
                field='AlipayAppId'
                label={t('应用 AppID')}
                placeholder={t('例如：2021000000000000')}
                extraText={t('支付宝开放平台 → 我的应用 → AppID（16 位数字）')}
              />
            </Col>
            <Col xs={24} sm={24} md={8} lg={8} xl={8}>
              <Form.InputNumber
                field='AlipayMinTopUp'
                label={t('最低充值数量')}
                placeholder={t('例如：1')}
                min={1}
                step={1}
                precision={0}
                extraText={t('用户单次最少可充值的额度数量')}
              />
            </Col>
            <Col xs={24} sm={24} md={8} lg={8} xl={8}>
              <Form.Switch
                field='AlipaySandbox'
                size='default'
                checkedText='｜'
                uncheckedText='〇'
                label={t('沙箱模式')}
                extraText={t(
                  '开启后调用支付宝沙箱网关，需配合沙箱版 AppID/私钥/公钥使用',
                )}
              />
            </Col>
          </Row>
          <Row
            gutter={{ xs: 8, sm: 16, md: 24, lg: 24, xl: 24, xxl: 24 }}
            style={{ marginTop: 16 }}
          >
            <Col xs={24}>
              <Form.TextArea
                field='AlipayPrivateKey'
                label={t('应用私钥')}
                placeholder={t(
                  '留空表示保持当前不变；粘贴 PKCS8 格式应用私钥（含或不含 PEM 头尾均可）',
                )}
                extraText={t(
                  '保存后不会回显，敏感字段。务必不要把支付宝公钥贴到这里。',
                )}
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
                field='AlipayPublicKey'
                label={t('支付宝公钥')}
                placeholder={t(
                  '粘贴支付宝公钥（注意：是支付宝公钥，不是应用公钥）',
                )}
                extraText={t(
                  '用于验签 webhook 回调；可在密钥管理 → 支付宝公钥处获取',
                )}
                style={{ fontFamily: 'JetBrains Mono, Consolas' }}
                autosize={{ minRows: 4, maxRows: 10 }}
              />
            </Col>
          </Row>
          <Button onClick={submit} style={{ marginTop: 16 }}>
            {t('更新支付宝直连设置')}
          </Button>
        </Form.Section>
      </Form>
    </Spin>
  );
}
