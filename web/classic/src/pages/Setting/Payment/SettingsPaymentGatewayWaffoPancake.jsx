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
import { BookOpen } from 'lucide-react';

const defaultInputs = {
  WaffoPancakeMerchantID: '',
  WaffoPancakePrivateKey: '',
  WaffoPancakeReturnURL: '',
};

export default function SettingsPaymentGatewayWaffoPancake(props) {
  const { t } = useTranslation();
  const sectionTitle = props.hideSectionTitle
    ? undefined
    : t('Waffo Pancake 设置');
  const [loading, setLoading] = useState(false);
  const [inputs, setInputs] = useState(defaultInputs);
  const formApiRef = useRef(null);

  useEffect(() => {
    if (!props.options || !formApiRef.current) return;

    const currentInputs = {
      WaffoPancakeMerchantID: props.options.WaffoPancakeMerchantID || '',
      WaffoPancakePrivateKey: props.options.WaffoPancakePrivateKey || '',
      WaffoPancakeReturnURL: props.options.WaffoPancakeReturnURL || '',
    };

    setInputs(currentInputs);
    formApiRef.current.setValues(currentInputs);
  }, [props.options]);

  const handleFormChange = (values) => {
    setInputs(values);
  };

  const submitWaffoPancakeSetting = async () => {
    const values = {
      ...inputs,
      ...(formApiRef.current?.getValues?.() || {}),
    };

    setLoading(true);
    try {
      // Classic admin only persists the three operator-typed fields.
      // Store/Product binding is handled exclusively by the default
      // frontend's catalog flow (see waffo-pancake-settings-section.tsx)
      // because picking entities from a live catalog needs the Select +
      // dependent-dropdown UX that the classic Semi-UI page doesn't have.
      const options = [
        {
          key: 'WaffoPancakeMerchantID',
          value: values.WaffoPancakeMerchantID || '',
        },
        {
          key: 'WaffoPancakeReturnURL',
          value: removeTrailingSlash(values.WaffoPancakeReturnURL || ''),
        },
      ];

      if ((values.WaffoPancakePrivateKey || '').trim()) {
        options.push({
          key: 'WaffoPancakePrivateKey',
          value: values.WaffoPancakePrivateKey,
        });
      }

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
        <Form.Section text={sectionTitle}>
          <Banner
            type='info'
            icon={<BookOpen size={16} />}
            description={
              <>
                Waffo Pancake 商户 ID 与私钥请在
                <a
                  href='https://pancake.waffo.ai/merchant/dashboard'
                  target='_blank'
                  rel='noreferrer'
                >
                  Waffo Pancake 控制台
                </a>
                获取，保存后系统会自动在该商户名下创建 Store + Product，无需手动配置；
                环境（test / 生产）由你粘贴的 API 私钥本身决定。
                请在 Pancake 控制台把下面两个回调地址分别注册到 Test Mode 和 Production Mode
                两个 webhook 位置，分开走避免测试流量污染生产数据：
                <br />
                {t('Test 回调地址')}：
                {props.options.ServerAddress
                  ? removeTrailingSlash(props.options.ServerAddress)
                  : t('网站地址')}
                /api/waffo-pancake/webhook/test
                <br />
                {t('Production 回调地址')}：
                {props.options.ServerAddress
                  ? removeTrailingSlash(props.options.ServerAddress)
                  : t('网站地址')}
                /api/waffo-pancake/webhook/prod
              </>
            }
            style={{ marginBottom: 12 }}
          />
          <Row
            gutter={{ xs: 8, sm: 16, md: 24, lg: 24, xl: 24, xxl: 24 }}
            style={{ marginTop: 16 }}
          >
            <Col xs={24} sm={24} md={12} lg={12} xl={12}>
              <Form.Input
                field='WaffoPancakeMerchantID'
                label={t('商户 ID')}
                placeholder={t('例如：MER_xxx')}
              />
            </Col>
            <Col xs={24} sm={24} md={12} lg={12} xl={12}>
              <Form.Input
                field='WaffoPancakeReturnURL'
                label={t('支付返回地址')}
                placeholder={t('例如：https://example.com/console/topup')}
              />
            </Col>
          </Row>

          <Row
            gutter={{ xs: 8, sm: 16, md: 24, lg: 24, xl: 24, xxl: 24 }}
            style={{ marginTop: 16 }}
          >
            <Col xs={24}>
              <Form.TextArea
                field='WaffoPancakePrivateKey'
                label={t('API 私钥')}
                placeholder={t('填写后覆盖当前私钥，留空表示保持当前不变')}
                extraText={t('⚠ 测试 / 生产环境由你粘进来的 API 私钥本身决定——集成阶段用 Test Key，正式上线时再换成 Production Key')}
                type='password'
                autosize={{ minRows: 4, maxRows: 8 }}
              />
            </Col>
          </Row>

          <Button onClick={submitWaffoPancakeSetting}>
            {t('更新 Waffo Pancake 设置')}
          </Button>
        </Form.Section>
      </Form>
    </Spin>
  );
}
