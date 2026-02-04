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

const DEFAULT_CODEX_INPUTS = {
  'codex.non_stream_adapter_enabled': true,
};

export default function SettingCodexModel(props) {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [inputs, setInputs] = useState(DEFAULT_CODEX_INPUTS);
  const [inputsRow, setInputsRow] = useState(DEFAULT_CODEX_INPUTS);
  const refForm = useRef();

  function onSubmit() {
    const updateArray = compareObjects(inputs, inputsRow);
    if (!updateArray.length) return showWarning(t('你似乎并没有修改什么'));
    const requestQueue = updateArray.map((item) =>
      API.put('/api/option/', {
        key: item.key,
        value: String(inputs[item.key]),
      }),
    );
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
    const currentInputs = { ...DEFAULT_CODEX_INPUTS };
    for (let key in props.options) {
      if (Object.prototype.hasOwnProperty.call(DEFAULT_CODEX_INPUTS, key)) {
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
    <>
      <Spin spinning={loading}>
        <Form
          values={inputs}
          getFormApi={(formAPI) => (refForm.current = formAPI)}
          style={{ marginBottom: 15 }}
        >
          <Form.Section text={t('Codex设置')}>
            <Row>
              <Col span={16}>
                <Form.Switch
                  label={t('非流式请求适配')}
                  field={'codex.non_stream_adapter_enabled'}
                  extraText={t(
                    '/codex/responses不支持非流式请求，打开后将在本地缓冲流式请求后构造非流响应以适配非流式请求',
                  )}
                  onChange={(value) =>
                    setInputs({
                      ...inputs,
                      'codex.non_stream_adapter_enabled': value,
                    })
                  }
                />
              </Col>
            </Row>
          </Form.Section>

          <Row>
            <Button size='default' onClick={onSubmit}>
              {t('保存')}
            </Button>
          </Row>
        </Form>
      </Spin>
    </>
  );
}
