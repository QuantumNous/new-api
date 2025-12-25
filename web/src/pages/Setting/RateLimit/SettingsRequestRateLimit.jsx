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

export default function RequestRateLimit(props) {
  const { t } = useTranslation();

  const DEFAULT_INPUTS = {
    ModelRequestRateLimitEnabled: false,
    ModelRequestRateLimitCount: -1,
    ModelRequestRateLimitSuccessCount: 1000,
    ModelRequestRateLimitDurationMinutes: 1,
    ModelRequestRateLimitGroup: '',
    ModelRequestRateLimitExemptUserIDs: '',
  };

  const [loading, setLoading] = useState(false);
  const [inputs, setInputs] = useState(DEFAULT_INPUTS);
  const refForm = useRef();
  const [inputsRow, setInputsRow] = useState(DEFAULT_INPUTS);

  function normalizeInputsForForm(rawInputs) {
    const nextInputs = { ...DEFAULT_INPUTS, ...(rawInputs || {}) };
    nextInputs.ModelRequestRateLimitEnabled =
      nextInputs.ModelRequestRateLimitEnabled === true ||
      nextInputs.ModelRequestRateLimitEnabled === 'true';
    nextInputs.ModelRequestRateLimitCount = Number(
      nextInputs.ModelRequestRateLimitCount,
    );
    nextInputs.ModelRequestRateLimitSuccessCount = Number(
      nextInputs.ModelRequestRateLimitSuccessCount,
    );
    nextInputs.ModelRequestRateLimitDurationMinutes = Number(
      nextInputs.ModelRequestRateLimitDurationMinutes,
    );
    nextInputs.ModelRequestRateLimitGroup = String(
      nextInputs.ModelRequestRateLimitGroup ?? '',
    );
    nextInputs.ModelRequestRateLimitExemptUserIDs = String(
      nextInputs.ModelRequestRateLimitExemptUserIDs ?? '',
    );
    return nextInputs;
  }

  function normalizeInputsForCompare(rawInputs) {
    const nextInputs = { ...DEFAULT_INPUTS, ...(rawInputs || {}) };
    for (const key of Object.keys(nextInputs)) {
      const value = nextInputs[key];
      if (typeof value === 'boolean') continue;
      if (value === null || value === undefined) {
        nextInputs[key] = '';
        continue;
      }
      let text = String(value);
      if (key === 'ModelRequestRateLimitExemptUserIDs') {
        text = text.replace(/\r\n/g, '\n');
      }
      nextInputs[key] = text;
    }
    nextInputs.ModelRequestRateLimitEnabled =
      nextInputs.ModelRequestRateLimitEnabled === true ||
      nextInputs.ModelRequestRateLimitEnabled === 'true';
    return nextInputs;
  }

  function onSubmit() {
    const normalizedInputs = normalizeInputsForCompare(inputs);
    const normalizedInputsRow = normalizeInputsForCompare(inputsRow);

    const updateArray = compareObjects(normalizedInputs, normalizedInputsRow);
    if (!updateArray.length) return showWarning(t('你似乎并没有修改什么'));
    const requestQueue = updateArray.map((item) => {
      let value = '';
      if (typeof normalizedInputs[item.key] === 'boolean') {
        value = String(normalizedInputs[item.key]);
      } else {
        value = normalizedInputs[item.key];
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

        for (let i = 0; i < res.length; i++) {
          if (!res[i].data.success) {
            return showError(res[i].data.message);
          }
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
    const currentInputs = { ...DEFAULT_INPUTS };

    for (const key of Object.keys(DEFAULT_INPUTS)) {
      if (Object.prototype.hasOwnProperty.call(props.options, key)) {
        currentInputs[key] = props.options[key];
      }
    }

    const normalized = normalizeInputsForForm(currentInputs);
    setInputs(normalized);
    setInputsRow(structuredClone(normalized));
    refForm.current?.setValues(normalized);
  }, [props.options]);

  return (
    <>
      <Spin spinning={loading}>
        <Form
          values={inputs}
          getFormApi={(formAPI) => (refForm.current = formAPI)}
          style={{ marginBottom: 15 }}
        >
          <Form.Section text={t('模型请求速率限制')}>
            <Row gutter={16}>
              <Col xs={24} sm={12} md={8} lg={8} xl={8}>
                <Form.Switch
                  field={'ModelRequestRateLimitEnabled'}
                  label={t('启用用户模型请求速率限制（可能会影响高并发性能）')}
                  size='default'
                  checkedText='｜'
                  uncheckedText='〇'
                  onChange={(value) => {
                    setInputs({
                      ...inputs,
                      ModelRequestRateLimitEnabled: value,
                    });
                  }}
                />
              </Col>
            </Row>
            <Row>
              <Col xs={24} sm={12} md={8} lg={8} xl={8}>
                <Form.InputNumber
                  label={t('限制周期')}
                  step={1}
                  min={0}
                  suffix={t('分钟')}
                  extraText={t('频率限制的周期（分钟）')}
                  field={'ModelRequestRateLimitDurationMinutes'}
                  onChange={(value) =>
                    setInputs({
                      ...inputs,
                      ModelRequestRateLimitDurationMinutes: String(value),
                    })
                  }
                />
              </Col>
            </Row>
            <Row>
              <Col xs={24} sm={12} md={8} lg={8} xl={8}>
                <Form.InputNumber
                  label={t('用户每周期最多请求次数')}
                  step={1}
                  min={0}
                  max={100000000}
                  suffix={t('次')}
                  extraText={t('包括失败请求的次数，0代表不限制')}
                  field={'ModelRequestRateLimitCount'}
                  onChange={(value) =>
                    setInputs({
                      ...inputs,
                      ModelRequestRateLimitCount: String(value),
                    })
                  }
                />
              </Col>
              <Col xs={24} sm={12} md={8} lg={8} xl={8}>
                <Form.InputNumber
                  label={t('用户每周期最多请求完成次数')}
                  step={1}
                  min={1}
                  max={100000000}
                  suffix={t('次')}
                  extraText={t('只包括请求成功的次数')}
                  field={'ModelRequestRateLimitSuccessCount'}
                  onChange={(value) =>
                    setInputs({
                      ...inputs,
                      ModelRequestRateLimitSuccessCount: String(value),
                    })
                  }
                />
              </Col>
            </Row>
            <Row>
              <Col xs={24} sm={16}>
                <Form.TextArea
                  label={t('分组速率限制')}
                  placeholder={t(
                    '{\n  "default": [200, 100],\n  "vip": [0, 1000]\n}',
                  )}
                  field={'ModelRequestRateLimitGroup'}
                  autosize={{ minRows: 5, maxRows: 15 }}
                  trigger='blur'
                  stopValidateWithError
                  rules={[
                    {
                      validator: (rule, value) => verifyJSON(value),
                      message: t('不是合法的 JSON 字符串'),
                    },
                  ]}
                  extraText={
                    <div>
                      <p>{t('说明：')}</p>
                      <ul>
                        <li>
                          {t(
                            '使用 JSON 对象格式，格式为：{"组名": [最多请求次数, 最多请求完成次数]}',
                          )}
                        </li>
                        <li>
                          {t(
                            '示例：{"default": [200, 100], "vip": [0, 1000]}。',
                          )}
                        </li>
                        <li>
                          {t(
                            '[最多请求次数]必须大于等于0，[最多请求完成次数]必须大于等于1。',
                          )}
                        </li>
                        <li>
                          {t(
                            '[最多请求次数]和[最多请求完成次数]的最大值为2147483647。',
                          )}
                        </li>
                        <li>{t('分组速率配置优先级高于全局速率限制。')}</li>
                        <li>{t('限制周期统一使用上方配置的“限制周期”值。')}</li>
                      </ul>
                    </div>
                  }
                  onChange={(value) => {
                    setInputs({ ...inputs, ModelRequestRateLimitGroup: value });
                  }}
                />
              </Col>
            </Row>
            <Row>
              <Col xs={24} sm={16}>
                <Form.TextArea
                  label={t('RPM 豁免用户')}
                  placeholder={t('例如：\n1\n2,3\n10086')}
                  field={'ModelRequestRateLimitExemptUserIDs'}
                  autosize={{ minRows: 3, maxRows: 10 }}
                  extraText={t(
                    '填写 userId 列表（逗号/换行分隔）。命中的用户将跳过“用户模型请求速率限制”，不影响其他限流。',
                  )}
                  onChange={(value) => {
                    setInputs({
                      ...inputs,
                      ModelRequestRateLimitExemptUserIDs: value,
                    });
                  }}
                />
              </Col>
            </Row>
            <Row>
              <Button size='default' onClick={onSubmit}>
                {t('保存模型速率限制')}
              </Button>
            </Row>
          </Form.Section>
        </Form>
      </Spin>
    </>
  );
}
