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
import {
  Banner,
  Button,
  Col,
  Form,
  Row,
  Space,
  Spin,
  Typography,
} from '@douyinfe/semi-ui';
import { useTranslation } from 'react-i18next';
import {
  API,
  compareObjects,
  showError,
  showSuccess,
  showWarning,
} from '../../../helpers';

const { Text } = Typography;

const defaultInputs = {
  SMSEnabled: false,
  SMSProvider: 'smsbao',
  SMSBaoEndpoint: 'https://api.smsbao.com/sms',
  SMSBaoQueryEndpoint: 'https://www.smsbao.com/query',
  SMSBaoUsername: '',
  SMSBaoCredential: '',
  SMSBaoCredentialMode: 'api_key',
  SMSBaoProductID: '',
  SMSCodeValidMinutes: '10',
  SMSCodeCooldownSeconds: '60',
  SMSSignature: '',
  SMSSignatureReviewStatus: 'pending',
  SMSProductName: '',
  SMSRegisterTemplate: '',
  SMSLoginTemplate: '',
  SMSBindTemplate: '',
  SMSChangeTemplate: '',
  SMSResetPasswordTemplate: '',
  SMSRateLimitEnabled: false,
  SMSRateLimitWindowSeconds: '60',
  SMSRateLimitPhoneCount: '1',
  SMSRateLimitIPCount: '10',
  SMSRateLimitAccountCount: '5',
  SMSRateLimitSceneCount: '100',
};

const defaultTestInput = {
  phone: '',
  scene: 'register',
  code: '',
};

export default function SettingsSMS(props) {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [testLoading, setTestLoading] = useState(false);
  const [statusLoading, setStatusLoading] = useState(false);
  const [inputs, setInputs] = useState(defaultInputs);
  const [inputsRow, setInputsRow] = useState(defaultInputs);
  const [testInput, setTestInput] = useState(defaultTestInput);
  const [statusInfo, setStatusInfo] = useState(null);
  const refForm = useRef();

  function handleFieldChange(fieldName) {
    return (value) => {
      setInputs((current) => ({ ...current, [fieldName]: value }));
    };
  }

  function handleNumberChange(fieldName) {
    return (value) => {
      setInputs((current) => ({ ...current, [fieldName]: String(value ?? '') }));
    };
  }

  function handleTestFieldChange(fieldName) {
    return (value) => {
      setTestInput((current) => ({ ...current, [fieldName]: value }));
    };
  }

  async function onSubmit() {
    const updateArray = compareObjects(inputs, inputsRow).filter(
      (item) => item.key !== 'SMSBaoCredential' || inputs.SMSBaoCredential,
    );
    if (!updateArray.length) return showWarning(t('你似乎并没有修改什么'));

    const requestQueue = updateArray.map((item) => {
      let value = '';
      if (typeof inputs[item.key] === 'boolean') {
        value = String(inputs[item.key]);
      } else {
        value = inputs[item.key];
      }
      return API.put('/api/option/', {
        key: item.key,
        value,
      });
    });

    setLoading(true);
    try {
      const results = await Promise.all(requestQueue);
      const errorResults = results.filter((res) => !res.data.success);
      if (errorResults.length > 0) {
        errorResults.forEach((res) => showError(res.data.message));
        return;
      }
      showSuccess(t('保存成功'));
      setInputs((current) => ({ ...current, SMSBaoCredential: '' }));
      props.refresh();
    } catch (error) {
      showError(t('保存失败，请重试'));
    } finally {
      setLoading(false);
    }
  }

  async function sendTestSMS() {
    setTestLoading(true);
    try {
      const res = await API.post('/api/option/sms/test', testInput);
      if (!res.data.success) {
        showError(res.data.message);
        return;
      }
      const data = res.data.data || {};
      showSuccess(
        t('测试短信发送成功：{{phone}}，返回码 {{code}}', {
          phone: data.phone_masked || '-',
          code: data.provider_code || '-',
        }),
      );
    } catch (error) {
      showError(t('测试短信发送失败'));
    } finally {
      setTestLoading(false);
    }
  }

  async function fetchSMSStatus() {
    setStatusLoading(true);
    try {
      const res = await API.get('/api/option/sms/status');
      if (!res.data.success) {
        showError(res.data.message);
        return;
      }
      setStatusInfo(res.data.data || null);
      showSuccess(t('短信状态查询成功'));
    } catch (error) {
      showError(t('短信状态查询失败'));
    } finally {
      setStatusLoading(false);
    }
  }

  useEffect(() => {
    const currentInputs = { ...defaultInputs };
    for (let key in props.options) {
      if (Object.keys(currentInputs).includes(key)) {
        currentInputs[key] = props.options[key];
      }
    }
    currentInputs.SMSBaoCredential = '';
    setInputs(currentInputs);
    setInputsRow(structuredClone(currentInputs));
    refForm.current?.setValues(currentInputs);
  }, [props.options]);

  return (
    <Spin spinning={loading}>
      <Form
        values={inputs}
        getFormApi={(formAPI) => (refForm.current = formAPI)}
        style={{ marginBottom: 15 }}
      >
        <Form.Section text={t('短信设置')}>
          <Banner
            type='info'
            closeIcon={null}
            className='!rounded-lg mb-3'
            description={t(
              '短信宝凭据不会从后端回显；留空表示保留原值，填写后才会覆盖保存。',
            )}
          />
          <Row gutter={16}>
            <Col xs={24} sm={12} md={8} lg={8} xl={8}>
              <Form.Switch
                field='SMSEnabled'
                label={t('启用短信')}
                checkedText='｜'
                uncheckedText='〇'
                onChange={handleFieldChange('SMSEnabled')}
              />
            </Col>
            <Col xs={24} sm={12} md={8} lg={8} xl={8}>
              <Form.Select
                field='SMSProvider'
                label={t('短信服务商')}
                onChange={handleFieldChange('SMSProvider')}
              >
                <Form.Select.Option value='smsbao'>SMSBao</Form.Select.Option>
              </Form.Select>
            </Col>
            <Col xs={24} sm={12} md={8} lg={8} xl={8}>
              <Form.Select
                field='SMSSignatureReviewStatus'
                label={t('签名审核状态')}
                extraText={t('只有 approved 状态才允许发送短信')}
                onChange={handleFieldChange('SMSSignatureReviewStatus')}
              >
                <Form.Select.Option value='pending'>
                  {t('待审核')}
                </Form.Select.Option>
                <Form.Select.Option value='approved'>
                  {t('已通过')}
                </Form.Select.Option>
                <Form.Select.Option value='rejected'>
                  {t('已驳回')}
                </Form.Select.Option>
              </Form.Select>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col xs={24} sm={12} md={8} lg={8} xl={8}>
              <Form.Input
                field='SMSBaoEndpoint'
                label={t('短信宝发送 Endpoint')}
                onChange={handleFieldChange('SMSBaoEndpoint')}
              />
            </Col>
            <Col xs={24} sm={12} md={8} lg={8} xl={8}>
              <Form.Input
                field='SMSBaoQueryEndpoint'
                label={t('短信宝查询 Endpoint')}
                onChange={handleFieldChange('SMSBaoQueryEndpoint')}
              />
            </Col>
            <Col xs={24} sm={12} md={8} lg={8} xl={8}>
              <Form.Input
                field='SMSBaoProductID'
                label={t('专用通道产品 ID')}
                placeholder={t('可选')}
                onChange={handleFieldChange('SMSBaoProductID')}
              />
            </Col>
          </Row>
          <Row gutter={16}>
            <Col xs={24} sm={12} md={8} lg={8} xl={8}>
              <Form.Input
                field='SMSBaoUsername'
                label={t('短信宝账号')}
                onChange={handleFieldChange('SMSBaoUsername')}
              />
            </Col>
            <Col xs={24} sm={12} md={8} lg={8} xl={8}>
              <Form.Input
                field='SMSBaoCredential'
                label={t('短信宝凭据')}
                type='password'
                placeholder={t('留空表示不修改')}
                onChange={handleFieldChange('SMSBaoCredential')}
              />
            </Col>
            <Col xs={24} sm={12} md={8} lg={8} xl={8}>
              <Form.Select
                field='SMSBaoCredentialMode'
                label={t('凭据模式')}
                onChange={handleFieldChange('SMSBaoCredentialMode')}
              >
                <Form.Select.Option value='api_key'>
                  {t('API Key')}
                </Form.Select.Option>
                <Form.Select.Option value='md5_password'>
                  {t('MD5 密码')}
                </Form.Select.Option>
              </Form.Select>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col xs={24} sm={12} md={8} lg={8} xl={8}>
              <Form.Input
                field='SMSSignature'
                label={t('短信签名')}
                placeholder={t('例如：NewAPI')}
                onChange={handleFieldChange('SMSSignature')}
              />
            </Col>
            <Col xs={24} sm={12} md={8} lg={8} xl={8}>
              <Form.Input
                field='SMSProductName'
                label={t('短信产品名')}
                placeholder={t('用于 {product} 模板变量')}
                onChange={handleFieldChange('SMSProductName')}
              />
            </Col>
            <Col xs={24} sm={12} md={8} lg={8} xl={8}>
              <Form.InputNumber
                field='SMSCodeValidMinutes'
                label={t('验证码有效期')}
                min={1}
                step={1}
                suffix={t('分钟')}
                onChange={handleNumberChange('SMSCodeValidMinutes')}
              />
            </Col>
          </Row>
          <Row gutter={16}>
            <Col xs={24} sm={12} md={8} lg={8} xl={8}>
              <Form.InputNumber
                field='SMSCodeCooldownSeconds'
                label={t('验证码冷却时间')}
                min={0}
                step={1}
                suffix={t('秒')}
                onChange={handleNumberChange('SMSCodeCooldownSeconds')}
              />
            </Col>
          </Row>
          <Row gutter={16}>
            <Col xs={24} sm={12} md={8} lg={8} xl={8}>
              <Form.TextArea
                field='SMSRegisterTemplate'
                label={t('注册模板')}
                autosize
                placeholder='{product} 注册验证码 {code}，{minutes} 分钟内有效。'
                onChange={handleFieldChange('SMSRegisterTemplate')}
              />
            </Col>
            <Col xs={24} sm={12} md={8} lg={8} xl={8}>
              <Form.TextArea
                field='SMSLoginTemplate'
                label={t('登录模板')}
                autosize
                placeholder='{product} 登录验证码 {code}，{minutes} 分钟内有效。'
                onChange={handleFieldChange('SMSLoginTemplate')}
              />
            </Col>
            <Col xs={24} sm={12} md={8} lg={8} xl={8}>
              <Form.TextArea
                field='SMSBindTemplate'
                label={t('绑定手机号模板')}
                autosize
                placeholder='{product} 绑定手机号验证码 {code}，{minutes} 分钟内有效。'
                onChange={handleFieldChange('SMSBindTemplate')}
              />
            </Col>
          </Row>
          <Row gutter={16}>
            <Col xs={24} sm={12} md={8} lg={8} xl={8}>
              <Form.TextArea
                field='SMSChangeTemplate'
                label={t('换绑手机号模板')}
                autosize
                placeholder='{product} 换绑手机号验证码 {code}，{minutes} 分钟内有效。'
                onChange={handleFieldChange('SMSChangeTemplate')}
              />
            </Col>
            <Col xs={24} sm={12} md={8} lg={8} xl={8}>
              <Form.TextArea
                field='SMSResetPasswordTemplate'
                label={t('重置密码模板')}
                autosize
                placeholder='{product} 重置密码验证码 {code}，{minutes} 分钟内有效。'
                onChange={handleFieldChange('SMSResetPasswordTemplate')}
              />
            </Col>
          </Row>
        </Form.Section>
        <Form.Section text={t('短信限流')}>
          <Row gutter={16}>
            <Col xs={24} sm={12} md={8} lg={8} xl={8}>
              <Form.Switch
                field='SMSRateLimitEnabled'
                label={t('启用短信限流')}
                checkedText='｜'
                uncheckedText='〇'
                onChange={handleFieldChange('SMSRateLimitEnabled')}
              />
            </Col>
            <Col xs={24} sm={12} md={8} lg={8} xl={8}>
              <Form.InputNumber
                field='SMSRateLimitWindowSeconds'
                label={t('限流窗口')}
                min={1}
                step={1}
                suffix={t('秒')}
                onChange={handleNumberChange('SMSRateLimitWindowSeconds')}
              />
            </Col>
          </Row>
          <Row gutter={16}>
            <Col xs={24} sm={12} md={6} lg={6} xl={6}>
              <Form.InputNumber
                field='SMSRateLimitPhoneCount'
                label={t('手机号阈值')}
                min={0}
                step={1}
                extraText={t('0 表示关闭该维度')}
                onChange={handleNumberChange('SMSRateLimitPhoneCount')}
              />
            </Col>
            <Col xs={24} sm={12} md={6} lg={6} xl={6}>
              <Form.InputNumber
                field='SMSRateLimitIPCount'
                label={t('IP 阈值')}
                min={0}
                step={1}
                extraText={t('0 表示关闭该维度')}
                onChange={handleNumberChange('SMSRateLimitIPCount')}
              />
            </Col>
            <Col xs={24} sm={12} md={6} lg={6} xl={6}>
              <Form.InputNumber
                field='SMSRateLimitAccountCount'
                label={t('账号阈值')}
                min={0}
                step={1}
                extraText={t('0 表示关闭该维度')}
                onChange={handleNumberChange('SMSRateLimitAccountCount')}
              />
            </Col>
            <Col xs={24} sm={12} md={6} lg={6} xl={6}>
              <Form.InputNumber
                field='SMSRateLimitSceneCount'
                label={t('场景阈值')}
                min={0}
                step={1}
                extraText={t('0 表示关闭该维度')}
                onChange={handleNumberChange('SMSRateLimitSceneCount')}
              />
            </Col>
          </Row>
        </Form.Section>
      </Form>
      <Button size='default' onClick={onSubmit}>
        {t('保存短信设置')}
      </Button>

      <div style={{ marginTop: 20 }}>
        <Form values={testInput}>
          <Form.Section text={t('测试发送与状态检查')}>
            <Row gutter={16}>
              <Col xs={24} sm={12} md={8} lg={8} xl={8}>
                <Form.Input
                  field='phone'
                  label={t('测试手机号')}
                  placeholder='13800138000'
                  onChange={handleTestFieldChange('phone')}
                />
              </Col>
              <Col xs={24} sm={12} md={8} lg={8} xl={8}>
                <Form.Select
                  field='scene'
                  label={t('测试场景')}
                  onChange={handleTestFieldChange('scene')}
                >
                  <Form.Select.Option value='register'>
                    {t('注册')}
                  </Form.Select.Option>
                  <Form.Select.Option value='login'>
                    {t('登录')}
                  </Form.Select.Option>
                  <Form.Select.Option value='bind_phone'>
                    {t('绑定手机号')}
                  </Form.Select.Option>
                  <Form.Select.Option value='change_phone'>
                    {t('换绑手机号')}
                  </Form.Select.Option>
                  <Form.Select.Option value='reset_password'>
                    {t('重置密码')}
                  </Form.Select.Option>
                </Form.Select>
              </Col>
              <Col xs={24} sm={12} md={8} lg={8} xl={8}>
                <Form.Input
                  field='code'
                  label={t('测试验证码')}
                  placeholder={t('例如：123456')}
                  onChange={handleTestFieldChange('code')}
                />
              </Col>
            </Row>
            <Space>
              <Button loading={testLoading} onClick={sendTestSMS}>
                {t('发送测试短信')}
              </Button>
              <Button loading={statusLoading} onClick={fetchSMSStatus}>
                {t('查询短信宝状态')}
              </Button>
              {statusInfo && (
                <Text type='secondary'>
                  {t('已发送 {{sent}} 条，剩余 {{remaining}} 条，返回码 {{code}}', {
                    sent: statusInfo.sent_count ?? '-',
                    remaining: statusInfo.remaining_count ?? '-',
                    code: statusInfo.provider_code ?? '-',
                  })}
                </Text>
              )}
            </Space>
          </Form.Section>
        </Form>
      </div>
    </Spin>
  );
}
