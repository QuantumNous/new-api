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
import { Button, Col, Form, Row, Spin } from '@douyinfe/semi-ui';
import {
  API,
  compareObjects,
  showError,
  showSuccess,
  showWarning,
} from '../../../helpers';
import { useTranslation } from 'react-i18next';

const XAI_VIOLATION_FEE_DOC_URL =
  'https://docs.x.ai/docs/models#usage-guidelines-violation-fee';

const DEFAULT_GROK_INPUTS = {
  'grok.violation_deduction_enabled': true,
  'grok.violation_deduction_amount': 0.05,
};

export default function SettingGrokModel(props) {
  const { t } = useTranslation();

  const [loading, setLoading] = useState(false);
  const [inputs, setInputs] = useState(DEFAULT_GROK_INPUTS);
  const [inputsRow, setInputsRow] = useState(DEFAULT_GROK_INPUTS);
  const refForm = useRef();

  async function onSubmit() {
    await refForm.current
      .validate()
      .then(() => {
        const updateArray = compareObjects(inputs, inputsRow);
        if (!updateArray.length) return showWarning(t('你似乎并没有修改什么'));

        const requestQueue = updateArray.map((item) => {
          const value = String(inputs[item.key]);
          return API.put('/api/option/', { key: item.key, value });
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
      })
      .catch((error) => {
        console.error('Validation failed:', error);
        showError(t('请检查输入'));
      });
  }

  useEffect(() => {
    const currentInputs = { ...DEFAULT_GROK_INPUTS };
    for (const key of Object.keys(DEFAULT_GROK_INPUTS)) {
      if (props.options[key] !== undefined) {
        currentInputs[key] = props.options[key];
      }
    }

    setInputs(currentInputs);
    setInputsRow(structuredClone(currentInputs));
    if (refForm.current) {
      refForm.current.setValues(currentInputs);
    }
  }, [props.options]);

  return (
    <Spin spinning={loading}>
      <Form
        values={inputs}
        getFormApi={(formAPI) => (refForm.current = formAPI)}
        style={{ marginBottom: 15 }}
      >
        <Form.Section text={t('Grok设置')}>
          <Row>
            <Col xs={24} sm={12} md={8} lg={8} xl={8}>
              <Form.Switch
                label={t('启用违规扣费')}
                field={'grok.violation_deduction_enabled'}
                onChange={(value) =>
                  setInputs({
                    ...inputs,
                    'grok.violation_deduction_enabled': value,
                  })
                }
                extraText={
                  <span>
                    {t('开启后，违规请求将额外扣费。')}{' '}
                    <a
                      href={XAI_VIOLATION_FEE_DOC_URL}
                      target='_blank'
                      rel='noreferrer'
                    >
                      {t('官方说明')}
                    </a>
                  </span>
                }
              />
            </Col>
          </Row>

          <Row>
            <Col xs={24} sm={12} md={8} lg={8} xl={8}>
              <Form.InputNumber
                label={t('违规扣费金额')}
                field={'grok.violation_deduction_amount'}
                min={0}
                step={0.01}
                precision={4}
                disabled={!inputs['grok.violation_deduction_enabled']}
                onChange={(value) =>
                  setInputs({
                    ...inputs,
                    'grok.violation_deduction_amount': value,
                  })
                }
                extraText={
                  <span>
                    {t('这是基础金额，实际扣费 = 基础金额 x 系统分组倍率。')}{' '}
                    <a
                      href={XAI_VIOLATION_FEE_DOC_URL}
                      target='_blank'
                      rel='noreferrer'
                    >
                      {t('官方说明')}
                    </a>
                  </span>
                }
              />
            </Col>
          </Row>

          <Row>
            <Button size='default' onClick={onSubmit}>
              {t('保存')}
            </Button>
          </Row>
        </Form.Section>
      </Form>
    </Spin>
  );
}
