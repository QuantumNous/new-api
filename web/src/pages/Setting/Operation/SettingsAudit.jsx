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
  Select,
  Typography,
  Banner,
} from '@douyinfe/semi-ui';
import {
  compareObjects,
  API,
  showError,
  showSuccess,
  showWarning,
} from '../../../helpers';
import { useTranslation } from 'react-i18next';

const { Text } = Typography;

export default function SettingsAudit(props) {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [inputs, setInputs] = useState({
    'audit_setting.mode': 'disabled',
    'audit_setting.remote_endpoint': '',
    'audit_setting.remote_timeout': 30,
    'audit_setting.remote_api_key': '',
    'audit_setting.max_file_size': 10,
    'audit_setting.retention_days': 30,
  });
  const refForm = useRef();
  const [inputsRow, setInputsRow] = useState(inputs);

  const modeOptions = [
    { value: 'disabled', label: t('禁用（不记录）') },
    { value: 'local', label: t('本地存储') },
    { value: 'remote', label: t('远程服务') },
  ];

  function onSubmit() {
    const updateArray = compareObjects(inputs, inputsRow);
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
    Promise.all(requestQueue)
      .then((res) => {
        if (requestQueue.length === 1) {
          if (res.includes(undefined)) return;
        } else if (requestQueue.length > 1) {
          if (res.includes(undefined))
            return showError(t('部分保存失败，请重试'));
        }
        showSuccess(t('保存成功'));
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
    const currentInputs = {};
    for (let key in props.options) {
      if (Object.keys(inputs).includes(key)) {
        currentInputs[key] = props.options[key];
      }
    }
    setInputs(Object.assign(inputs, currentInputs));
    setInputsRow(structuredClone(currentInputs));
    refForm.current.setValues(currentInputs);
  }, [props.options]);

  const isRemoteMode = inputs['audit_setting.mode'] === 'remote';
  const isLocalMode = inputs['audit_setting.mode'] === 'local';

  return (
    <>
      <Spin spinning={loading}>
        <Form
          values={inputs}
          getFormApi={(formAPI) => (refForm.current = formAPI)}
          style={{ marginBottom: 15 }}
        >
          <Form.Section text={t('安全审计设置')}>
            <Banner
              type='info'
              description={t(
                '安全审计功能用于记录所有API请求内容，便于安全审查。启用后可能会增加存储开销。',
              )}
              style={{ marginBottom: 16 }}
            />
            <Row gutter={16}>
              <Col xs={24} sm={12} md={8} lg={8} xl={8}>
                <Form.Select
                  field={'audit_setting.mode'}
                  label={t('审计模式')}
                  optionList={modeOptions}
                  onChange={(value) => {
                    setInputs({
                      ...inputs,
                      'audit_setting.mode': value,
                    });
                  }}
                />
              </Col>
              <Col xs={24} sm={12} md={8} lg={8} xl={8}>
                <Form.InputNumber
                  field={'audit_setting.max_file_size'}
                  label={t('最大文件大小 (MB)')}
                  placeholder='10'
                  min={1}
                  max={100}
                  onChange={(value) => {
                    setInputs({
                      ...inputs,
                      'audit_setting.max_file_size': value,
                    });
                  }}
                />
              </Col>
              <Col xs={24} sm={12} md={8} lg={8} xl={8}>
                <Form.InputNumber
                  field={'audit_setting.retention_days'}
                  label={t('日志保留天数')}
                  placeholder='30'
                  min={1}
                  max={365}
                  onChange={(value) => {
                    setInputs({
                      ...inputs,
                      'audit_setting.retention_days': value,
                    });
                  }}
                />
              </Col>
            </Row>

            {isLocalMode && (
              <Row gutter={16} style={{ marginTop: 16 }}>
                <Col span={24}>
                  <Banner
                    type='warning'
                    description={t(
                      '本地存储模式：审计日志将保存到 logs/audit 目录下，按令牌分组、按日期存储。请确保磁盘空间充足。',
                    )}
                  />
                </Col>
              </Row>
            )}

            {isRemoteMode && (
              <>
                <Row gutter={16} style={{ marginTop: 16 }}>
                  <Col xs={24} sm={24} md={16} lg={16} xl={16}>
                    <Form.Input
                      field={'audit_setting.remote_endpoint'}
                      label={t('远程服务地址')}
                      placeholder='https://audit.example.com'
                      onChange={(value) => {
                        setInputs({
                          ...inputs,
                          'audit_setting.remote_endpoint': value,
                        });
                      }}
                    />
                  </Col>
                  <Col xs={24} sm={12} md={8} lg={8} xl={8}>
                    <Form.InputNumber
                      field={'audit_setting.remote_timeout'}
                      label={t('请求超时 (秒)')}
                      placeholder='30'
                      min={5}
                      max={120}
                      onChange={(value) => {
                        setInputs({
                          ...inputs,
                          'audit_setting.remote_timeout': value,
                        });
                      }}
                    />
                  </Col>
                </Row>
                <Row gutter={16} style={{ marginTop: 16 }}>
                  <Col span={24}>
                    <Form.Input
                      field={'audit_setting.remote_api_key'}
                      label={t('API 密钥（可选）')}
                      placeholder='sk-xxx'
                      mode='password'
                      onChange={(value) => {
                        setInputs({
                          ...inputs,
                          'audit_setting.remote_api_key': value,
                        });
                      }}
                    />
                  </Col>
                </Row>
              </>
            )}

            <Row style={{ marginTop: 16 }}>
              <Button size='default' onClick={onSubmit}>
                {t('保存安全审计设置')}
              </Button>
            </Row>
          </Form.Section>
        </Form>
      </Spin>
    </>
  );
}
