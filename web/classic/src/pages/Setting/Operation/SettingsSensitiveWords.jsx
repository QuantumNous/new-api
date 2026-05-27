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
import { Button, Col, Form, Row, Spin } from '@douyinfe/semi-ui';
import {
  compareObjects,
  API,
  showError,
  showSuccess,
  showWarning,
  verifyJSON,
} from '../../../helpers';
import { useTranslation } from 'react-i18next';

const EMPTY_SENSITIVE_CHECK_RULES = JSON.stringify(
  {
    version: 1,
    rules: [],
  },
  null,
  2,
);

const SENSITIVE_CHECK_RULES_TEMPLATE = JSON.stringify(
  {
    version: 1,
    rules: [
      {
        id: 'vip-claude-rule',
        name: 'VIP Claude rule',
        enabled: true,
        groups: ['vip'],
        models: ['claude-sonnet-4-5'],
        model_regex: [],
        include_global_words: true,
        words: ['example_sensitive_word'],
      },
    ],
  },
  null,
  2,
);

function normalizeSensitiveCheckRules(value) {
  if (!value || value.trim() === '') {
    return EMPTY_SENSITIVE_CHECK_RULES;
  }
  try {
    return JSON.stringify(JSON.parse(value), null, 2);
  } catch {
    return value;
  }
}

export default function SettingsSensitiveWords(props) {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [inputs, setInputs] = useState({
    CheckSensitiveEnabled: false,
    CheckSensitiveOnPromptEnabled: false,
    SensitiveWords: '',
    SensitiveCheckRules: EMPTY_SENSITIVE_CHECK_RULES,
  });
  const refForm = useRef();
  const [inputsRow, setInputsRow] = useState(inputs);

  function onSubmit() {
    if (
      inputs.SensitiveCheckRules?.trim() &&
      !verifyJSON(inputs.SensitiveCheckRules)
    ) {
      return showError(t('范围屏蔽规则 JSON 格式不正确'));
    }
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
        currentInputs[key] =
          key === 'SensitiveCheckRules'
            ? normalizeSensitiveCheckRules(props.options[key])
            : props.options[key];
      }
    }
    if (
      !Object.prototype.hasOwnProperty.call(
        currentInputs,
        'SensitiveCheckRules',
      )
    ) {
      currentInputs.SensitiveCheckRules = EMPTY_SENSITIVE_CHECK_RULES;
    }
    setInputs(currentInputs);
    setInputsRow(structuredClone(currentInputs));
    refForm.current.setValues(currentInputs);
  }, [props.options]);
  return (
    <>
      <Spin spinning={loading}>
        <Form
          values={inputs}
          getFormApi={(formAPI) => (refForm.current = formAPI)}
          style={{ marginBottom: 15 }}
        >
          <Form.Section text={t('屏蔽词过滤设置')}>
            <Row gutter={16}>
              <Col xs={24}>
                <Form.Switch
                  field={'CheckSensitiveEnabled'}
                  label={t('启用屏蔽词过滤功能')}
                  size='default'
                  checkedText='｜'
                  uncheckedText='〇'
                  onChange={(value) => {
                    setInputs({
                      ...inputs,
                      CheckSensitiveEnabled: value,
                    });
                  }}
                />
              </Col>
              <Col xs={24} sm={12} md={8} lg={8} xl={8}>
                <Form.Switch
                  field={'CheckSensitiveOnPromptEnabled'}
                  label={t('启用 Prompt 检查')}
                  size='default'
                  checkedText='｜'
                  uncheckedText='〇'
                  onChange={(value) =>
                    setInputs({
                      ...inputs,
                      CheckSensitiveOnPromptEnabled: value,
                    })
                  }
                />
              </Col>
            </Row>
            <Row>
              <Col xs={24}>
                <Form.TextArea
                  label={t('范围屏蔽规则')}
                  extraText={t(
                    'JSON 配置。可按用户分组、模型名称或模型正则配置额外屏蔽词；留空或 rules 为空时仅使用上方全局屏蔽词。',
                  )}
                  placeholder={EMPTY_SENSITIVE_CHECK_RULES}
                  field={'SensitiveCheckRules'}
                  onChange={(value) =>
                    setInputs({
                      ...inputs,
                      SensitiveCheckRules: value,
                    })
                  }
                  style={{ fontFamily: 'JetBrains Mono, Consolas' }}
                  autosize={{ minRows: 8, maxRows: 18 }}
                />
                <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
                  <Button
                    size='small'
                    onClick={() => {
                      if (!verifyJSON(inputs.SensitiveCheckRules || '')) {
                        showError(t('范围屏蔽规则 JSON 格式不正确'));
                        return;
                      }
                      const next = JSON.stringify(
                        JSON.parse(inputs.SensitiveCheckRules || '{}'),
                        null,
                        2,
                      );
                      setInputs({
                        ...inputs,
                        SensitiveCheckRules: next,
                      });
                      refForm.current.setValue('SensitiveCheckRules', next);
                    }}
                  >
                    {t('格式化 JSON')}
                  </Button>
                  <Button
                    size='small'
                    onClick={() => {
                      setInputs({
                        ...inputs,
                        SensitiveCheckRules: SENSITIVE_CHECK_RULES_TEMPLATE,
                      });
                      refForm.current.setValue(
                        'SensitiveCheckRules',
                        SENSITIVE_CHECK_RULES_TEMPLATE,
                      );
                    }}
                  >
                    {t('填入示例规则')}
                  </Button>
                  <Button
                    size='small'
                    onClick={() => {
                      setInputs({
                        ...inputs,
                        SensitiveCheckRules: EMPTY_SENSITIVE_CHECK_RULES,
                      });
                      refForm.current.setValue(
                        'SensitiveCheckRules',
                        EMPTY_SENSITIVE_CHECK_RULES,
                      );
                    }}
                  >
                    {t('清空规则')}
                  </Button>
                </div>
              </Col>
            </Row>
            <Row>
              <Col xs={24} sm={12} md={8} lg={8} xl={8}>
                <Form.TextArea
                  label={t('屏蔽词列表')}
                  extraText={t('一行一个屏蔽词，不需要符号分割')}
                  placeholder={t('一行一个屏蔽词，不需要符号分割')}
                  field={'SensitiveWords'}
                  onChange={(value) =>
                    setInputs({
                      ...inputs,
                      SensitiveWords: value,
                    })
                  }
                  style={{ fontFamily: 'JetBrains Mono, Consolas' }}
                  autosize={{ minRows: 6, maxRows: 12 }}
                />
              </Col>
            </Row>
            <Row>
              <Button size='default' onClick={onSubmit}>
                {t('保存屏蔽词过滤设置')}
              </Button>
            </Row>
          </Form.Section>
        </Form>
      </Spin>
    </>
  );
}
