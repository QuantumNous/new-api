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

export default function SettingsPrivacyFilter(props) {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [inputs, setInputs] = useState({
    'privacy_filter_setting.enabled': false,
    'privacy_filter_setting.gitleaks_toml': '',
  });
  const refForm = useRef();
  const [inputsRow, setInputsRow] = useState(inputs);

  function handleFieldChange(fieldName) {
    return (value) => {
      setInputs((inputs) => ({ ...inputs, [fieldName]: value }));
    };
  }

  function onSubmit() {
    const normalizedInputs = {
      ...inputs,
      'privacy_filter_setting.gitleaks_toml': String(
        inputs['privacy_filter_setting.gitleaks_toml'] || '',
      ).trim(),
    };
    const normalizedInputsRow = {
      ...inputsRow,
      'privacy_filter_setting.gitleaks_toml': String(
        inputsRow['privacy_filter_setting.gitleaks_toml'] || '',
      ).trim(),
    };
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
    const currentInputs = {
      'privacy_filter_setting.enabled': false,
      'privacy_filter_setting.gitleaks_toml': '',
    };
    for (let key in props.options) {
      if (Object.keys(inputs).includes(key)) {
        currentInputs[key] = props.options[key];
      }
    }
    setInputs(currentInputs);
    setInputsRow(structuredClone(currentInputs));
    refForm.current?.setValues(currentInputs);
  }, [props.options]);

  return (
    <>
      <Spin spinning={loading}>
        <Form
          values={inputs}
          getFormApi={(formAPI) => (refForm.current = formAPI)}
          style={{ marginBottom: 15 }}
        >
          <Form.Section text={t('隐私过滤器')}>
            <Row gutter={16}>
              <Col xs={24} sm={12} md={8} lg={8} xl={8}>
                <Form.Switch
                  field={'privacy_filter_setting.enabled'}
                  label={t('启用隐私过滤器')}
                  extraText={t(
                    '在请求转发到上游之前，对中继请求中的密钥和个人数据进行脱敏',
                  )}
                  size='default'
                  checkedText='｜'
                  uncheckedText='〇'
                  onChange={handleFieldChange('privacy_filter_setting.enabled')}
                />
              </Col>
            </Row>
            <Row gutter={16}>
              <Col xs={24} sm={24} md={16} lg={16} xl={16}>
                <Form.Input
                  field={'privacy_filter_setting.gitleaks_toml'}
                  label={t('Gitleaks TOML 路径')}
                  extraText={t(
                    '留空将使用内置备用规则。Docker 中请填写容器内路径，而不是宿主机路径',
                  )}
                  placeholder='/app/privacy-filter-rules/gitleaks.toml'
                  onChange={handleFieldChange(
                    'privacy_filter_setting.gitleaks_toml',
                  )}
                  showClear
                />
              </Col>
            </Row>
            <Row>
              <Button size='default' onClick={onSubmit}>
                {t('保存隐私过滤器设置')}
              </Button>
            </Row>
          </Form.Section>
        </Form>
      </Spin>
    </>
  );
}
