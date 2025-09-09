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
import { Button, Col, Form, Row, Spin, Card, Typography, Divider, Toast } from '@douyinfe/semi-ui';
import {
  compareObjects,
  API,
  showError,
  showSuccess,
  showWarning,
} from '../../../helpers';
import { useTranslation } from 'react-i18next';
import { Server, Cloud, Zap } from 'lucide-react';

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
    if (!apiKey || apiKey.trim() === '') {
      showError(t('请先填写 API Key'));
      return;
    }

    setTesting(true);
    try {
      // 调用 io.net 官方 API 进行测试
      const response = await fetch('https://api.io.solutions/enterprise/v1/io-cloud/caas/hardware/max-gpus-per-container', {
        method: 'GET',
        headers: {
          'X-API-KEY': apiKey,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        
        // 检查响应中是否有错误信息
        if (data.detail) {
          // 如果有 detail 字段，说明有错误
          let errorMessage = t('API Key 验证失败');
          
          if (typeof data.detail === 'string') {
            errorMessage = data.detail;
          } else if (Array.isArray(data.detail) && data.detail.length > 0) {
            // detail 是数组时，取第一个错误信息
            const firstError = data.detail[0];
            if (typeof firstError === 'string') {
              errorMessage = firstError;
            } else if (firstError.msg) {
              errorMessage = firstError.msg;
            } else if (firstError.message) {
              errorMessage = firstError.message;
            }
          }
          
          showError(errorMessage);
        } else if (data.error) {
          // 检查其他可能的错误字段
          showError(data.error.message || data.error || t('API Key 验证失败'));
        } else {
          // 成功获取到数据
          showSuccess(t('API Key 验证成功！连接到 io.net 服务正常'));
        }
      } else {
        // HTTP 状态码不是 2xx
        const errorData = await response.json().catch(() => ({}));
        let errorMessage = t('API Key 验证失败');
        
        if (errorData.detail) {
          if (typeof errorData.detail === 'string') {
            errorMessage = errorData.detail;
          } else if (Array.isArray(errorData.detail) && errorData.detail.length > 0) {
            const firstError = errorData.detail[0];
            errorMessage = firstError.msg || firstError.message || firstError;
          }
        } else {
          // 根据状态码提供友好提示
          switch (response.status) {
            case 401:
              errorMessage = t('API Key 无效或已过期');
              break;
            case 403:
              errorMessage = t('API Key 权限不足，无法访问此功能');
              break;
            case 429:
              errorMessage = t('请求过于频繁，请稍后再试');
              break;
            default:
              errorMessage = `${t('请求失败')} (HTTP ${response.status})`;
          }
        }
        
        showError(errorMessage);
      }
    } catch (error) {
      console.error('io.net API test error:', error);
      
      if (error.name === 'TypeError' && error.message.includes('fetch')) {
        showError(t('网络连接失败，请检查网络设置或稍后重试'));
      } else {
        showError(t('测试失败：') + (error.message || t('未知错误')));
      }
    } finally {
      setTesting(false);
    }
  };

  function onSubmit() {
    // 前置校验：如果启用了 io.net 但没有填写 API Key
    if (inputs['model_deployment.ionet.enabled'] && 
        (!inputs['model_deployment.ionet.api_key'] || inputs['model_deployment.ionet.api_key'].trim() === '')) {
      return showError(t('启用 io.net 部署时必须填写 API Key'));
    }

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
      
      console.log('Setting inputs from props:', currentInputs);
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
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Server size={20} />
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
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Cloud size={18} />
                  <span>io.net</span>
                </div>
              }
              bodyStyle={{ padding: '20px' }}
              style={{ marginBottom: '16px' }}
            >
              <Row gutter={16}>
                <Col xs={24} sm={12} md={12} lg={12} xl={12}>
                  <Form.Switch
                    label={t('启用 io.net 部署')}
                    field={'model_deployment.ionet.enabled'}
                    onChange={(value) =>
                      setInputs({
                        ...inputs,
                        'model_deployment.ionet.enabled': value,
                      })
                    }
                    extraText={t('开启后可以使用 io.net 进行模型部署')}
                  />
                </Col>
                <Col xs={24} sm={12} md={12} lg={12} xl={12}>
                  <Form.Input
                    label={t('API Key')}
                    field={'model_deployment.ionet.api_key'}
                    placeholder={t('请输入 io.net API Key')}
                    onChange={(value) =>
                      setInputs({
                        ...inputs,
                        'model_deployment.ionet.api_key': value,
                      })
                    }
                    disabled={!inputs['model_deployment.ionet.enabled']}
                    extraText={t('从 io.net 控制台获取的 API 密钥，请注意project需要选择 IO Cloud')}
                    mode="password"
                  />
                  <div style={{ marginTop: '12px' }}>
                    <Button
                      type="outline"
                      size="small"
                      icon={<Zap size={16} />}
                      onClick={testApiKey}
                      loading={testing}
                      disabled={!inputs['model_deployment.ionet.enabled'] || !inputs['model_deployment.ionet.api_key'] || inputs['model_deployment.ionet.api_key'].trim() === ''}
                      style={{
                        height: '32px',
                        fontSize: '13px',
                        borderRadius: '6px',
                        fontWeight: '500',
                        borderColor: testing ? 'var(--semi-color-primary)' : 'var(--semi-color-border)',
                        color: testing ? 'var(--semi-color-primary)' : 'var(--semi-color-text-0)'
                      }}
                    >
                      {testing ? t('连接测试中...') : t('测试连接')}
                    </Button>
                  </div>
                </Col>
              </Row>
              
              <Divider margin="16px" />
              
              <div style={{ 
                background: 'var(--semi-color-fill-0)', 
                padding: '12px', 
                borderRadius: '6px',
                border: '1px solid var(--semi-color-border)'
              }}>
                <Text 
                  type="secondary" 
                  size="small"
                  style={{ lineHeight: '1.5' }}
                >
                  <strong>{t('说明：')}</strong>
                  {t('io.net 是一个分布式GPU网络，可以用于部署和运行AI模型。启用后，您可以在模型部署页面中使用 io.net 的GPU资源进行模型部署。')}
                </Text>
              </div>
            </Card>

            <Row>
              <Button size='default' type="primary" onClick={onSubmit}>
                {t('保存设置')}
              </Button>
            </Row>
          </Form.Section>
        </Form>
      </Spin>
    </>
  );
}