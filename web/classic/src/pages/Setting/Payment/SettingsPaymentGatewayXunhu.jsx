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
import { Banner, Button, Form, Row, Col, Spin } from '@douyinfe/semi-ui';
import {
  API,
  removeTrailingSlash,
  showError,
  showSuccess,
} from '../../../helpers';
import { useTranslation } from 'react-i18next';
import { BookOpen } from 'lucide-react';

export default function SettingsPaymentGatewayXunhu(props) {
  const { t } = useTranslation();
  const sectionTitle = props.hideSectionTitle ? undefined : t('虎皮椒设置');
  const [loading, setLoading] = useState(false);
  const [inputs, setInputs] = useState({
    XunhuEnabled: false,
    XunhuGatewayUrl: 'https://api.xunhupay.com/payment/do.html',
    XunhuWxAppId: '',
    XunhuWxAppSecret: '',
    XunhuAliAppId: '',
    XunhuAliAppSecret: '',
    XunhuUnitPrice: 1.0,
    XunhuMinTopUp: 1,
  });
  const formApiRef = useRef(null);

  useEffect(() => {
    if (props.options && formApiRef.current) {
      const currentInputs = {
        XunhuEnabled: !!props.options.XunhuEnabled,
        XunhuGatewayUrl:
          props.options.XunhuGatewayUrl ||
          'https://api.xunhupay.com/payment/do.html',
        XunhuWxAppId: props.options.XunhuWxAppId || '',
        XunhuWxAppSecret: '',
        XunhuAliAppId: props.options.XunhuAliAppId || '',
        XunhuAliAppSecret: '',
        XunhuUnitPrice:
          props.options.XunhuUnitPrice !== undefined
            ? parseFloat(props.options.XunhuUnitPrice)
            : 1.0,
        XunhuMinTopUp:
          props.options.XunhuMinTopUp !== undefined
            ? parseFloat(props.options.XunhuMinTopUp)
            : 1,
      };
      setInputs(currentInputs);
      formApiRef.current.setValues(currentInputs);
    }
  }, [props.options]);

  const handleFormChange = (values) => {
    setInputs(values);
  };

  const submitXunhuSetting = async () => {
    setLoading(true);
    try {
      const options = [
        {
          key: 'XunhuEnabled',
          value: inputs.XunhuEnabled ? 'true' : 'false',
        },
        {
          key: 'XunhuGatewayUrl',
          value:
            inputs.XunhuGatewayUrl ||
            'https://api.xunhupay.com/payment/do.html',
        },
        { key: 'XunhuWxAppId', value: inputs.XunhuWxAppId || '' },
        { key: 'XunhuAliAppId', value: inputs.XunhuAliAppId || '' },
        {
          key: 'XunhuUnitPrice',
          value: String(inputs.XunhuUnitPrice ?? 1),
        },
        {
          key: 'XunhuMinTopUp',
          value: String(inputs.XunhuMinTopUp ?? 1),
        },
      ];
      if (inputs.XunhuWxAppSecret) {
        options.push({
          key: 'XunhuWxAppSecret',
          value: inputs.XunhuWxAppSecret,
        });
      }
      if (inputs.XunhuAliAppSecret) {
        options.push({
          key: 'XunhuAliAppSecret',
          value: inputs.XunhuAliAppSecret,
        });
      }

      const results = await Promise.all(
        options.map((opt) =>
          API.put('/api/option/', { key: opt.key, value: opt.value }),
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
        <Form.Section text={sectionTitle}>
          <Banner
            type='info'
            icon={<BookOpen size={16} />}
            description={
              <>
                {t('虎皮椒文档')}：
                <a
                  href='https://www.xunhupay.com/doc/api/pay.html'
                  target='_blank'
                  rel='noreferrer'
                >
                  xunhupay.com
                </a>
                <br />
                {t('回调地址')}：
                {props.options.ServerAddress
                  ? removeTrailingSlash(props.options.ServerAddress)
                  : t('网站地址')}
                /api/xunhu/notify
                <br />
                {t('支付宝凭证留空则不显示支付宝选项')}
              </>
            }
            style={{ marginBottom: 16 }}
          />
          <Row gutter={{ xs: 8, sm: 16, md: 24, lg: 24, xl: 24, xxl: 24 }}>
            <Col xs={24} sm={12}>
              <Form.Switch
                field='XunhuEnabled'
                label={t('启用虎皮椒支付')}
              />
            </Col>
            <Col xs={24} sm={12}>
              <Form.Input
                field='XunhuGatewayUrl'
                label={t('支付网关 URL')}
                placeholder='https://api.xunhupay.com/payment/do.html'
              />
            </Col>
            <Col xs={24} sm={12}>
              <Form.Input field='XunhuWxAppId' label={t('微信 AppID')} />
            </Col>
            <Col xs={24} sm={12}>
              <Form.Input
                field='XunhuWxAppSecret'
                label={t('微信 AppSecret')}
                mode='password'
                placeholder={t('留空则不修改')}
              />
            </Col>
            <Col xs={24} sm={12}>
              <Form.Input field='XunhuAliAppId' label={t('支付宝 AppID')} />
            </Col>
            <Col xs={24} sm={12}>
              <Form.Input
                field='XunhuAliAppSecret'
                label={t('支付宝 AppSecret')}
                mode='password'
                placeholder={t('留空则不修改')}
              />
            </Col>
            <Col xs={24} sm={12}>
              <Form.InputNumber
                field='XunhuUnitPrice'
                label={t('单价（元）')}
                min={0.01}
                step={0.01}
              />
            </Col>
            <Col xs={24} sm={12}>
              <Form.InputNumber
                field='XunhuMinTopUp'
                label={t('最低充值额度')}
                min={1}
                step={1}
              />
            </Col>
          </Row>
          <Button onClick={submitXunhuSetting} style={{ marginTop: 16 }}>
            {t('保存虎皮椒设置')}
          </Button>
        </Form.Section>
      </Form>
    </Spin>
  );
}
