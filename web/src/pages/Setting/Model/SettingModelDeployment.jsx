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
import {
  Button,
  Col,
  Form,
  Row,
  Spin,
  Card,
  Typography,
} from '@douyinfe/semi-ui';
import {
  compareObjects,
  API,
  showError,
  showSuccess,
  showWarning,
} from '../../../helpers';
import { useTranslation } from 'react-i18next';
import { Server, Cloud, Zap, ArrowUpRight } from 'lucide-react';

const { Text } = Typography;

export default function SettingModelDeployment(props) {
  const { t } = useTranslation();

  const [loading, setLoading] = useState(false);
  const [inputs, setInputs] = useState({
    'model_deployment.ionet.api_key': '',
    'model_deployment.ionet.enabled': false,
  });
  const refForm = useRef();
  const [inputsRow, setInputsRow] = useState({
    'model_deployment.ionet.api_key': '',
    'model_deployment.ionet.enabled': false,
  });
  const [testing, setTesting] = useState(false);

  const testApiKey = async () => {
    const apiKey = inputs['model_deployment.ionet.api_key'];

    const getLocalizedMessage = (message) => {
      switch (message) {
        case 'invalid request payload':
          return t('请求参数无效');
        case 'api_key is required':
          return t('请先填写 API Key');
        case 'failed to validate api key':
          return t('API Key 验证失败');
        default:
          return message;
      }
    };

    setTesting(true);
    try {
      const response = await API.post(
        '/api/deployments/settings/test-connection',
        apiKey && apiKey.trim() !== '' ? { api_key: apiKey.trim() } : {},
        {
          skipErrorHandler: true,
        },
      );

      if (response?.data?.success) {
        showSuccess(t('API Key 验证成功！连接到 io.net 服务正常'));
      } else {
        const rawMessage = response?.data?.message;
        const localizedMessage = rawMessage
          ? getLocalizedMessage(rawMessage)
          : t('API Key 验证失败');
        showError(localizedMessage);
      }
    } catch (error) {
      console.error('io.net API test error:', error);

      if (error?.code === 'ERR_NETWORK') {
        showError(t('网络连接失败，请检查网络设置或稍后重试'));
      } else {
        const rawMessage =
          error?.response?.data?.message || error?.message || '';
        const localizedMessage = rawMessage
          ? getLocalizedMessage(rawMessage)
          : t('未知错误');
        showError(t('测试失败：') + localizedMessage);
      }
    } finally {
      setTesting(false);
    }
  };

  function onSubmit() {
    const updateArray = compareObjects(inputs, inputsRow);
    if (!updateArray.length) return showWarning(t('你似乎并没有修改什么'));

    const requestQueue = updateArray.map((item) => {
      let value = String(inputs[item.key]);
      return API.put('/api/option/', {
        key: item.key,
        value,
      });
    });

    setLoading(true);
    Promise.all(requestQueue)
      .then((res) => {
        if (requestQueue.length === 1) {
          if (res.includes(undefined)) return;
        } else if (requestQueue.length > 1) {
          if (res.includes(undefined))
            return showError(t('部分保存失败，请重试'));
        }
        showSuccess(t('保存成功'));
        // 更新 inputsRow 以反映已保存的状态
        setInputsRow(structuredClone(inputs));
        props.refresh();
      })
      .catch(() => {
        showError(t('保存失败，请重试'));
      })
      .finally(() => {
        setLoading(false);
      });
  }

  useEffect(() => {
    if (props.options) {
      const defaultInputs = {
        'model_deployment.ionet.api_key': '',
        'model_deployment.ionet.enabled': false,
      };

      const currentInputs = {};
      for (let key in defaultInputs) {
        if (props.options.hasOwnProperty(key)) {
          currentInputs[key] = props.options[key];
        } else {
          currentInputs[key] = defaultInputs[key];
        }
      }

      setInputs(currentInputs);
      setInputsRow(structuredClone(currentInputs));
      refForm.current?.setValues(currentInputs);
    }
  }, [props.options]);

  return (
    <>
      <Spin spinning={loading}>
        <Form
          values={inputs}
          getFormApi={(formAPI) => (refForm.current = formAPI)}
          style={{ marginBottom: 15 }}
        >
          <Form.Section
            text={
              <div
                style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
              >
                <span>{t('模型部署设置')}</span>
              </div>
            }
          >
            {/*<Text */}
            {/*  type="secondary" */}
            {/*  size="small"*/}
            {/*  style={{ */}
            {/*    display: 'block', */}
            {/*    marginBottom: '20px',*/}
            {/*    color: 'var(--semi-color-text-2)'*/}
            {/*  }}*/}
            {/*>*/}
            {/*  {t('配置模型部署服务提供商的API密钥和启用状态')}*/}
            {/*</Text>*/}

            <Card
              title={
                <div
                  style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
                >
                  <Cloud size={18} />
                  <span>io.net</span>
                </div>
              }
              bodyStyle={{ padding: '20px' }}
              style={{ marginBottom: '16px' }}
            >
              <Row gutter={24}>
                <Col xs={24} lg={14}>
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '16px',
                    }}
                  >
                    <Form.Switch
                      label={t('启用 io.net 部署')}
                      field={'model_deployment.ionet.enabled'}
                      onChange={(value) =>
                        setInputs({
                          ...inputs,
                          'model_deployment.ionet.enabled': value,
                        })
                      }
                      extraText={t('启用后可接入 io.net GPU 资源')}
                    />
                    <Form.Input
                      label={t('API Key')}
                      field={'model_deployment.ionet.api_key'}
                      placeholder={t('请输入 io.net API Key（敏感信息不显示）')}
                      onChange={(value) =>
                        setInputs({
                          ...inputs,
                          'model_deployment.ionet.api_key': value,
                        })
                      }
                      disabled={!inputs['model_deployment.ionet.enabled']}
                      extraText={t('请使用 Project 为 io.cloud 的密钥')}
                      mode='password'
                    />
                    <div style={{ display: 'flex', gap: '12px' }}>
                      <Button
                        type='outline'
                        size='small'
                        icon={<Zap size={16} />}
                        onClick={testApiKey}
                        loading={testing}
                        disabled={!inputs['model_deployment.ionet.enabled']}
                        style={{
                          height: '32px',
                          fontSize: '13px',
                          borderRadius: '6px',
                          fontWeight: '500',
                          borderColor: testing
                            ? 'var(--semi-color-primary)'
                            : 'var(--semi-color-border)',
                          color: testing
                            ? 'var(--semi-color-primary)'
                            : 'var(--semi-color-text-0)',
                        }}
                      >
                        {testing ? t('连接测试中...') : t('测试连接')}
                      </Button>
                    </div>
                  </div>
                </Col>
                <Col xs={24} lg={10}>
                  <div
                    style={{
                      background: 'var(--semi-color-fill-0)',
                      padding: '16px',
                      borderRadius: '8px',
                      border: '1px solid var(--semi-color-border)',
                      height: '100%',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '12px',
                      justifyContent: 'space-between',
                    }}
                  >
                    <div>
                      <Text
                        strong
                        style={{ display: 'block', marginBottom: '8px' }}
                      >
                        {t('获取 io.net API Key')}
                      </Text>
                      <ul
                        style={{
                          margin: 0,
                          paddingLeft: '18px',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '6px',
                          color: 'var(--semi-color-text-2)',
                          fontSize: '13px',
                          lineHeight: 1.6,
                        }}
                      >
                        <li>{t('访问 io.net 控制台的 API Keys 页面')}</li>
                        <li>
                          {t('创建或选择密钥时，将 Project 设置为 io.cloud')}
                        </li>
                        <li>{t('复制生成的密钥并粘贴到此处')}</li>
                      </ul>
                    </div>
                    <Button
                      icon={<ArrowUpRight size={16} />}
                      type='primary'
                      theme='solid'
                      style={{ width: '100%' }}
                      onClick={() =>
                        window.open('https://ai.io.net/ai/api-keys', '_blank')
                      }
                    >
                      {t('前往 io.net API Keys')}
                    </Button>
                  </div>
                </Col>
              </Row>
            </Card>

            <Row>
              <Button size='default' type='primary' onClick={onSubmit}>
                {t('保存设置')}
              </Button>
            </Row>
          </Form.Section>
        </Form>
      </Spin>
    </>
  );
}
