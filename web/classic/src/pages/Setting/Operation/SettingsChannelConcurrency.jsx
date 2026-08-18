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
  toBoolean,
} from '../../../helpers';
import { useTranslation } from 'react-i18next';

const BOOL_FIELDS = [
  'channel_concurrency_setting.wait_enabled',
  'channel_concurrency_setting.cooldown_enabled',
  'channel_concurrency_setting.cooldown_on_status_429',
  'channel_concurrency_setting.cooldown_on_message_match',
  'channel_concurrency_setting.load_cache_enabled',
];

const NUMBER_FIELDS = [
  'channel_concurrency_setting.wait_timeout_ms',
  'channel_concurrency_setting.max_waiting_per_channel',
  'channel_concurrency_setting.cooldown_seconds',
];

export default function SettingsChannelConcurrency(props) {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [inputs, setInputs] = useState({
    'channel_concurrency_setting.wait_enabled': true,
    'channel_concurrency_setting.wait_timeout_ms': 5000,
    'channel_concurrency_setting.max_waiting_per_channel': 0,
    'channel_concurrency_setting.cooldown_enabled': true,
    'channel_concurrency_setting.cooldown_seconds': 30,
    'channel_concurrency_setting.cooldown_on_status_429': true,
    'channel_concurrency_setting.cooldown_on_message_match': false,
    'channel_concurrency_setting.load_cache_enabled': true,
  });
  const refForm = useRef();
  const [inputsRow, setInputsRow] = useState(inputs);

  function handleFieldChange(fieldName) {
    return (value) => {
      setInputs((inputs) => ({ ...inputs, [fieldName]: value }));
    };
  }

  function onSubmit() {
    // InputNumber allows clearing the field; a blank or non-finite value must
    // never reach the option store where the runtime would fail to parse it.
    for (const key of NUMBER_FIELDS) {
      const value = inputs[key];
      if (
        value === undefined ||
        value === null ||
        value === '' ||
        !Number.isFinite(Number(value))
      ) {
        return showError(t('请填写有效的渠道并发限制数值'));
      }
    }
    const updateArray = compareObjects(inputs, inputsRow);
    if (!updateArray.length) return showWarning(t('你似乎并没有修改什么'));
    const requestQueue = updateArray.map((item) => {
      return API.put('/api/option/', {
        key: item.key,
        value: String(inputs[item.key]),
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
    // /api/option/ serializes every value as a string; "false" is truthy in
    // JS, so booleans and numbers must be deserialized before hitting the
    // Switch/disabled logic.
    const currentInputs = {};
    for (let key in props.options) {
      if (Object.keys(inputs).includes(key)) {
        const value = props.options[key];
        if (BOOL_FIELDS.includes(key)) {
          currentInputs[key] = toBoolean(value);
        } else if (NUMBER_FIELDS.includes(key)) {
          const parsed = Number(value);
          currentInputs[key] = Number.isFinite(parsed)
            ? parsed
            : inputs[key];
        } else {
          currentInputs[key] = value;
        }
      }
    }
    setInputs((prev) => ({ ...prev, ...currentInputs }));
    setInputsRow((prev) => structuredClone({ ...prev, ...currentInputs }));
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
          <Form.Section text={t('渠道并发限制设置')}>
            <Typography.Text
              type='tertiary'
              style={{ marginBottom: 16, display: 'block' }}
            >
              {t(
                '控制配置了最大并发数的渠道的排队与冷却行为，对未设置并发上限的渠道无影响',
              )}
            </Typography.Text>
            <Row gutter={16}>
              <Col xs={24} sm={12} md={8} lg={8} xl={8}>
                <Form.Switch
                  field={'channel_concurrency_setting.wait_enabled'}
                  label={t('并发满时允许排队')}
                  size='default'
                  checkedText='｜'
                  uncheckedText='〇'
                  onChange={handleFieldChange(
                    'channel_concurrency_setting.wait_enabled',
                  )}
                />
              </Col>
              <Col xs={24} sm={12} md={8} lg={8} xl={8}>
                <Form.InputNumber
                  field={'channel_concurrency_setting.wait_timeout_ms'}
                  label={t('排队超时（毫秒）')}
                  onChange={handleFieldChange(
                    'channel_concurrency_setting.wait_timeout_ms',
                  )}
                  min={0}
                  disabled={!inputs['channel_concurrency_setting.wait_enabled']}
                />
              </Col>
              <Col xs={24} sm={12} md={8} lg={8} xl={8}>
                <Form.InputNumber
                  field={'channel_concurrency_setting.max_waiting_per_channel'}
                  label={t('每渠道排队上限（0 = 等于该渠道并发上限）')}
                  onChange={handleFieldChange(
                    'channel_concurrency_setting.max_waiting_per_channel',
                  )}
                  min={0}
                  disabled={!inputs['channel_concurrency_setting.wait_enabled']}
                />
              </Col>
            </Row>
            <Row gutter={16}>
              <Col xs={24} sm={12} md={8} lg={8} xl={8}>
                <Form.Switch
                  field={'channel_concurrency_setting.cooldown_enabled'}
                  label={t('启用渠道冷却')}
                  size='default'
                  checkedText='｜'
                  uncheckedText='〇'
                  onChange={handleFieldChange(
                    'channel_concurrency_setting.cooldown_enabled',
                  )}
                />
              </Col>
              <Col xs={24} sm={12} md={8} lg={8} xl={8}>
                <Form.InputNumber
                  field={'channel_concurrency_setting.cooldown_seconds'}
                  label={t('冷却时长（秒）')}
                  onChange={handleFieldChange(
                    'channel_concurrency_setting.cooldown_seconds',
                  )}
                  min={1}
                  disabled={
                    !inputs['channel_concurrency_setting.cooldown_enabled']
                  }
                />
              </Col>
            </Row>
            <Row gutter={16}>
              <Col xs={24} sm={12} md={8} lg={8} xl={8}>
                <Form.Switch
                  field={'channel_concurrency_setting.cooldown_on_status_429'}
                  label={t('上游返回 429 时触发冷却')}
                  size='default'
                  checkedText='｜'
                  uncheckedText='〇'
                  onChange={handleFieldChange(
                    'channel_concurrency_setting.cooldown_on_status_429',
                  )}
                  disabled={
                    !inputs['channel_concurrency_setting.cooldown_enabled']
                  }
                />
              </Col>
              <Col xs={24} sm={12} md={8} lg={8} xl={8}>
                <Form.Switch
                  field={
                    'channel_concurrency_setting.cooldown_on_message_match'
                  }
                  label={t('错误消息含限流关键词时触发冷却（易误伤）')}
                  size='default'
                  checkedText='｜'
                  uncheckedText='〇'
                  onChange={handleFieldChange(
                    'channel_concurrency_setting.cooldown_on_message_match',
                  )}
                  disabled={
                    !inputs['channel_concurrency_setting.cooldown_enabled']
                  }
                />
              </Col>
              <Col xs={24} sm={12} md={8} lg={8} xl={8}>
                <Form.Switch
                  field={'channel_concurrency_setting.load_cache_enabled'}
                  label={t('负载快照缓存（降低 Redis 压力）')}
                  size='default'
                  checkedText='｜'
                  uncheckedText='〇'
                  onChange={handleFieldChange(
                    'channel_concurrency_setting.load_cache_enabled',
                  )}
                />
              </Col>
            </Row>
            <Row>
              <Button size='default' onClick={onSubmit}>
                {t('保存渠道并发限制设置')}
              </Button>
            </Row>
          </Form.Section>
        </Form>
      </Spin>
    </>
  );
}
