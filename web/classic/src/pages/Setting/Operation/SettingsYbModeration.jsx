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
import { Button, Col, Form, Row, Spin, Typography } from '@douyinfe/semi-ui';
import {
  compareObjects,
  API,
  showError,
  showSuccess,
  showWarning,
} from '../../../helpers';
import { useTranslation } from 'react-i18next';

export default function SettingsYbModeration(props) {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [inputs, setInputs] = useState({
    'yb_moderation.enabled': false,
    'yb_moderation.gateway_channel_id': 0,
  });
  const ref = useRef();
  ref.current = inputs;
  const [inputsRow, setInputsRow] = useState(inputs);

  function handleFieldChange(fieldName) {
    return (value) => {
      setInputs((inputs) => ({ ...inputs, [fieldName]: value }));
    };
  }

  function onSubmit() {
    const updateArray = compareObjects(inputs, inputsRow);
    if (!updateArray.length) return showWarning(t('你似乎并没有修改什么'));
    const requestQueue = updateArray.map((item) => {
      let value =
        typeof inputs[item.key] === 'boolean'
          ? String(inputs[item.key])
          : inputs[item.key];
      return API.put('/api/option/', { key: item.key, value });
    });
    setLoading(true);
    Promise.all(requestQueue)
      .then((res) => {
        if (res.includes(undefined)) return showError(t('部分保存失败，请重试'));
        showSuccess(t('保存成功'));
        props.refresh?.();
      })
      .catch(() => showError(t('保存失败，请重试')))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    const current = { ...inputs };
    for (let key in props.options) {
      if (Object.hasOwn(current, key)) {
        current[key] = props.options[key];
      }
    }
    if (typeof current['yb_moderation.gateway_channel_id'] === 'string') {
      current['yb_moderation.gateway_channel_id'] = parseInt(
        current['yb_moderation.gateway_channel_id'],
        10,
      );
    }
    setInputs(current);
    setInputsRow(structuredClone(current));
  }, [props.options]);

  return (
    <Spin spinning={loading}>
      <Form
        values={inputs}
        onValueChange={(v) => setInputs({ ...inputs, ...v })}
      >
        <Form.Section text={t('yb 真人素材审核网关')}>
          <Typography.Text type='tertiary'>
            {t(
              '将 /v1/moderation/face 转发到 yb（yabaoai）渠道，用于真人素材审核后换取 asset://',
            )}
          </Typography.Text>
          <Row gutter={16} style={{ marginTop: 12 }}>
            <Col span={8}>
              <Form.Switch
                field={'yb_moderation.enabled'}
                label={t('启用 yb 真人素材审核 API')}
                onChange={handleFieldChange('yb_moderation.enabled')}
              />
            </Col>
            <Col span={8}>
              <Form.InputNumber
                field={'yb_moderation.gateway_channel_id'}
                label={t('网关渠道 ID')}
                min={0}
                onChange={handleFieldChange('yb_moderation.gateway_channel_id')}
              />
            </Col>
          </Row>
          <Button onClick={onSubmit}>{t('保存 yb 审核设置')}</Button>
        </Form.Section>
      </Form>
    </Spin>
  );
}
