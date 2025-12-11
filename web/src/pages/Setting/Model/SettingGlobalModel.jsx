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
import { Button, Col, Form, Row, Spin, Banner } from '@douyinfe/semi-ui';
import {
  compareObjects,
  API,
  showError,
  showSuccess,
  showWarning,
  verifyJSON,
} from '../../../helpers';
import { useTranslation } from 'react-i18next';

const thinkingExample = JSON.stringify(
  ['moonshotai/kimi-k2-thinking', 'kimi-k2-thinking'],
  null,
  2,
);

const defaultGlobalSettingInputs = {
  'global.pass_through_request_enabled': false,
  'global.thinking_model_blacklist': '[]',
  'general_setting.ping_interval_enabled': false,
  'general_setting.ping_interval_seconds': 60,
};

export default function SettingGlobalModel(props) {
  const { t } = useTranslation();

  const [loading, setLoading] = useState(false);
  const [inputs, setInputs] = useState(defaultGlobalSettingInputs);
  const refForm = useRef();
  const [inputsRow, setInputsRow] = useState(defaultGlobalSettingInputs);

  const normalizeValueBeforeSave = (key, value) => {
    if (key === 'global.thinking_model_blacklist') {
      const text = typeof value === 'string' ? value.trim() : '';
      return text === '' ? '[]' : value;
    }
    return value;
  };

  function onSubmit() {
    const updateArray = compareObjects(inputs, inputsRow);
    if (!updateArray.length) return showWarning(t('你似乎并没有修改什么'));
    const requestQueue = updateArray.map((item) => {
      const normalizedValue = normalizeValueBeforeSave(
        item.key,
        inputs[item.key],
      );
      let value = String(normalizedValue);

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
    for (const key of Object.keys(defaultGlobalSettingInputs)) {
      if (props.options[key] !== undefined) {
        let value = props.options[key];
        if (key === 'global.thinking_model_blacklist') {
          try {
            value =
              value && String(value).trim() !== ''
                ? JSON.stringify(JSON.parse(value), null, 2)
                : defaultGlobalSettingInputs[key];
          } catch (error) {
            value = defaultGlobalSettingInputs[key];
          }
        }
        currentInputs[key] = value;
      } else {
        currentInputs[key] = defaultGlobalSettingInputs[key];
      }
    }

    setInputs(currentInputs);
    setInputsRow(structuredClone(currentInputs));
    if (refForm.current) {
      refForm.current.setValues(currentInputs);
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
          <Form.Section text={t('全局设置')}>
            <Row>
              <Col xs={24} sm={12} md={8} lg={8} xl={8}>
                <Form.Switch
                  label={t('启用请求透传')}
                  field={'global.pass_through_request_enabled'}
                  onChange={(value) =>
                    setInputs({
                      ...inputs,
                      'global.pass_through_request_enabled': value,
                    })
                  }
                  extraText={
                    t('开启后，所有请求将直接透传给上游，不会进行任何处理（重定向和渠道适配也将失效）,请谨慎开启')
                  }
                />
              </Col>
            </Row>
            <Row>
              <Col span={24}>
                <Form.TextArea
                  label={t('禁用思考处理的模型列表')}
                  field={'global.thinking_model_blacklist'}
                  placeholder={
                    t('例如：') +
                    '\n' +
                    thinkingExample
                  }
                  rows={4}
                  rules={[
                    {
                      validator: (rule, value) => {
                        if (!value || value.trim() === '') return true;
                        return verifyJSON(value);
                      },
                      message: t('不是合法的 JSON 字符串'),
                    },
                  ]}
                  extraText={t(
                    '列出的模型将不会自动添加或移除-thinking/-nothinking 后缀',
                  )}
                  onChange={(value) =>
                    setInputs({
                      ...inputs,
                      'global.thinking_model_blacklist': value,
                    })
                  }
                />
              </Col>
            </Row>

            <Form.Section text={t('连接保活设置')}>
              <Row style={{ marginTop: 10 }}>
                <Col span={24}>
                  <Banner
                    type='warning'
                    description={t('警告：启用保活后，如果已经写入保活数据后渠道出错，系统无法重试，如果必须开启，推荐设置尽可能大的Ping间隔')}
                  />
                </Col>
              </Row>
              <Row>
                <Col xs={24} sm={12} md={8} lg={8} xl={8}>
                  <Form.Switch
                    label={t('启用Ping间隔')}
                    field={'general_setting.ping_interval_enabled'}
                    onChange={(value) =>
                      setInputs({
                        ...inputs,
                        'general_setting.ping_interval_enabled': value,
                      })
                    }
                    extraText={t('开启后，将定期发送ping数据保持连接活跃')}
                  />
                </Col>
                <Col xs={24} sm={12} md={8} lg={8} xl={8}>
                  <Form.InputNumber
                    label={t('Ping间隔（秒）')}
                    field={'general_setting.ping_interval_seconds'}
                    onChange={(value) =>
                      setInputs({
                        ...inputs,
                        'general_setting.ping_interval_seconds': value,
                      })
                    }
                    min={1}
                    disabled={!inputs['general_setting.ping_interval_enabled']}
                  />
                </Col>
              </Row>
            </Form.Section>

            <Row>
              <Button size='default' onClick={onSubmit}>
                {t('保存')}
              </Button>
            </Row>
          </Form.Section>
        </Form>
      </Spin>
    </>
  );
}
