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
import { Banner, Button, Form, Row, Col, Typography, Spin, Select } from '@douyinfe/semi-ui';
const { Text } = Typography;
import { API, removeTrailingSlash, showError, showSuccess } from '../../../helpers';
import { useTranslation } from 'react-i18next';

export default function SettingsPaymentGatewayXunhu(props) {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [inputs, setInputs] = useState({
    XunhuPayAppId: '',
    XunhuPayAppSecret: '',
    XunhuPayGateway: '',
    XunhuPayMethod: 'both',
  });
  const [originInputs, setOriginInputs] = useState({});
  const formApiRef = useRef(null);

  useEffect(() => {
    if (props.options && formApiRef.current) {
      const currentInputs = {
        XunhuPayAppId: props.options.XunhuPayAppId || '',
        XunhuPayAppSecret: props.options.XunhuPayAppSecret || '',
        XunhuPayGateway: props.options.XunhuPayGateway || '',
        XunhuPayMethod: props.options.XunhuPayMethod || 'both',
      };
      setInputs(currentInputs);
      setOriginInputs({ ...currentInputs });
      formApiRef.current.setValues(currentInputs);
    }
  }, [props.options]);

  const handleFormChange = (values) => {
    setInputs(values);
  };

  const submitXunhuPaySetting = async () => {
    if (!props.options.ServerAddress) {
      showError(t('请先填写服务器地址'));
      return;
    }

    setLoading(true);
    try {
      const options = [];

      if (inputs.XunhuPayAppId !== '') {
        options.push({ key: 'XunhuPayAppId', value: inputs.XunhuPayAppId });
      }
      if (inputs.XunhuPayAppSecret !== '') {
        options.push({ key: 'XunhuPayAppSecret', value: inputs.XunhuPayAppSecret });
      }
      if (inputs.XunhuPayGateway !== '') {
        options.push({
          key: 'XunhuPayGateway',
          value: removeTrailingSlash(inputs.XunhuPayGateway),
        });
      }
      // 支付方式选择始终保存
      options.push({ key: 'XunhuPayMethod', value: inputs.XunhuPayMethod || 'both' });

      if (options.length === 0) {
        showError(t('没有需要更新的内容'));
        setLoading(false);
        return;
      }

      const requestQueue = options.map((opt) =>
        API.put('/api/option/', { key: opt.key, value: opt.value }),
      );
      const results = await Promise.all(requestQueue);
      const errorResults = results.filter((res) => !res.data.success);
      if (errorResults.length > 0) {
        errorResults.forEach((res) => showError(res.data.message));
      } else {
        showSuccess(t('更新成功'));
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
        <Form.Section text={t('虎皮椒支付设置')}>
          <Text>
            {t('虎皮椒（xunhupay）个人微信/支付宝收款接口。请前往')}
            <a
              href='https://admin.xunhupay.com'
              target='_blank'
              rel='noreferrer'
            >
              {t('虎皮椒商户后台')}
            </a>
            {t('获取 AppID 和 AppSecret。')}
          </Text>
          <Banner
            type='info'
            style={{ marginTop: 12, marginBottom: 4 }}
            description={`异步回调地址（notify_url）：${
              props.options.CustomCallbackAddress ||
              (props.options.ServerAddress
                ? removeTrailingSlash(props.options.ServerAddress)
                : t('网站地址'))
            }/api/user/xunhupay/notify`}
          />
          <Banner
            type='warning'
            style={{ marginBottom: 12 }}
            description={t(
              '填写了虎皮椒配置后，充值页面的微信/支付宝支付按钮将通过虎皮椒渠道拉起收款，易支付配置可留空。',
            )}
          />
          <Row gutter={{ xs: 8, sm: 16, md: 24, lg: 24, xl: 24, xxl: 24 }}>
            <Col xs={24} sm={24} md={8} lg={8} xl={8}>
              <Form.Input
                field='XunhuPayAppId'
                label={t('虎皮椒 AppID')}
                placeholder={t('例如：20146122002')}
              />
            </Col>
            <Col xs={24} sm={24} md={8} lg={8} xl={8}>
              <Form.Input
                field='XunhuPayAppSecret'
                label={t('虎皮椒 AppSecret')}
                placeholder={t('敏感信息不会发送到前端显示')}
                type='password'
              />
            </Col>
            <Col xs={24} sm={24} md={8} lg={8} xl={8}>
              <Form.Input
                field='XunhuPayGateway'
                label={t('虎皮椒网关地址')}
                placeholder={t('例如：https://api.xunhupay.com')}
              />
            </Col>
          </Row>
          <Row gutter={{ xs: 8, sm: 16, md: 24, lg: 24, xl: 24, xxl: 24 }} style={{ marginTop: 12 }}>
            <Col xs={24} sm={24} md={12} lg={8} xl={8}>
              <Form.Slot label={t('展示给用户的支付方式')}>
                <Select
                  value={inputs.XunhuPayMethod || 'both'}
                  onChange={(val) => {
                    setInputs({ ...inputs, XunhuPayMethod: val });
                    formApiRef.current?.setValue('XunhuPayMethod', val);
                  }}
                  style={{ width: '100%' }}
                  optionList={[
                    { value: 'both',   label: t('微信 + 支付宝（两者都显示）') },
                    { value: 'wxpay',  label: t('仅微信') },
                    { value: 'alipay', label: t('仅支付宝') },
                  ]}
                />
              </Form.Slot>
            </Col>
          </Row>
          <Button onClick={submitXunhuPaySetting} style={{ marginTop: 8 }}>
            {t('更新虎皮椒设置')}
          </Button>
        </Form.Section>
      </Form>
    </Spin>
  );
}
