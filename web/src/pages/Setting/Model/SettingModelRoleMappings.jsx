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

import React, { useEffect, useMemo, useState } from 'react';
import { Banner, Button, Col, Form, Row, Spin } from '@douyinfe/semi-ui';
import { API, showError, showSuccess } from '../../../helpers';
import { useTranslation } from 'react-i18next';

const OPTION_KEY = 'ModelRoleMappings';

const ROLE_WHITELIST = new Set([
  'system',
  'user',
  'assistant',
  'developer',
  'tool',
]);

const exampleJSON =
  '{"gpt-4o":{"system":"developer"},"claude-3":{"developer":"system"}}';

function isPlainObject(value) {
  return (
    value !== null &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    Object.prototype.toString.call(value) === '[object Object]'
  );
}

function formatPath(parts) {
  if (!parts || parts.length === 0) return '$';
  return '$' + parts.map((p) => `.${p}`).join('');
}

function validateModelRoleMappingsJSONString(jsonText) {
  const trimmed = (jsonText ?? '').trim();
  if (trimmed === '') {
    return { ok: true, normalized: '{}', errors: [] };
  }

  let parsed;
  try {
    parsed = JSON.parse(trimmed);
  } catch (e) {
    return {
      ok: false,
      normalized: null,
      errors: [
        {
          path: '$',
          message: `JSON 解析失败: ${e?.message || String(e)}`,
        },
      ],
    };
  }

  const errors = [];

  if (!isPlainObject(parsed)) {
    errors.push({
      path: '$',
      message:
        '顶层必须是对象：{ [modelPrefix: string]: { [fromRole: string]: toRole } }',
    });
    return { ok: false, normalized: null, errors };
  }

  for (const [modelPrefix, roleMap] of Object.entries(parsed)) {
    const modelPath = ['' + modelPrefix];
    if ((modelPrefix ?? '').trim() === '') {
      errors.push({
        path: formatPath(modelPath),
        message: 'model 前缀不能为空字符串',
      });
      continue;
    }

    if (!isPlainObject(roleMap)) {
      errors.push({
        path: formatPath(modelPath),
        message: '该模型前缀的映射必须是对象',
      });
      continue;
    }

    for (const [fromRoleRaw, toRoleRaw] of Object.entries(roleMap)) {
      const fromRole = String(fromRoleRaw ?? '').trim();
      const toRole = String(toRoleRaw ?? '').trim();
      const rolePath = [String(modelPrefix), String(fromRoleRaw)];

      if (fromRole === '' || toRole === '') {
        errors.push({
          path: formatPath(rolePath),
          message: 'role 映射的 from/to 不能为空字符串',
        });
        continue;
      }

      if (!ROLE_WHITELIST.has(fromRole)) {
        errors.push({
          path: formatPath(rolePath),
          message: `fromRole 不在白名单: ${fromRole}（允许: ${Array.from(ROLE_WHITELIST).join(
            '/',
          )}）`,
        });
      }

      if (!ROLE_WHITELIST.has(toRole)) {
        errors.push({
          path: formatPath(rolePath),
          message: `toRole 不在白名单: ${toRole}（允许: ${Array.from(ROLE_WHITELIST).join(
            '/',
          )}）`,
        });
      }
    }
  }

  if (errors.length > 0) {
    return { ok: false, normalized: null, errors };
  }

  return { ok: true, normalized: JSON.stringify(parsed, null, 2), errors: [] };
}

export default function SettingModelRoleMappings(props) {
  const { t } = useTranslation();

  const [loading, setLoading] = useState(false);
  const [jsonText, setJsonText] = useState('{}');
  const [validationErrors, setValidationErrors] = useState([]);

  const rawOptionValue = useMemo(() => {
    const v = props?.options?.[OPTION_KEY];
    return v === undefined || v === null ? '' : String(v);
  }, [props?.options]);

  useEffect(() => {
    const trimmed = rawOptionValue.trim();
    if (trimmed === '') {
      setJsonText('{}');
      setValidationErrors([]);
      return;
    }

    try {
      const parsed = JSON.parse(trimmed);
      setJsonText(JSON.stringify(parsed, null, 2));
    } catch {
      setJsonText(trimmed);
    }
    setValidationErrors([]);
  }, [rawOptionValue]);

  const runValidate = () => {
    const result = validateModelRoleMappingsJSONString(jsonText);
    if (!result.ok) {
      setValidationErrors(result.errors);
      return false;
    }

    setValidationErrors([]);
    if (result.normalized && result.normalized !== jsonText) {
      setJsonText(result.normalized);
    }
    return true;
  };

  const onSave = async () => {
    const ok = runValidate();
    if (!ok) {
      showError(t('校验未通过，请先修正 JSON'));
      return;
    }

    try {
      setLoading(true);
      const res = await API.put('/api/option/', {
        key: OPTION_KEY,
        value: jsonText.trim() === '' ? '{}' : jsonText,
      });
      if (!res?.data?.success) {
        showError(res?.data?.message || t('保存失败，请重试'));
        return;
      }
      showSuccess(t('保存成功'));
      props?.refresh?.();
    } catch (e) {
      showError(t('保存失败，请重试'));
    } finally {
      setLoading(false);
    }
  };

  const onValidateClick = () => {
    const ok = runValidate();
    if (ok) {
      showSuccess(t('校验通过'));
    } else {
      showError(t('校验失败，请查看错误提示'));
    }
  };

  return (
    <>
      <Spin spinning={loading}>
        <Form style={{ marginBottom: 15 }}>
          <Form.Section text={t('模型 role 映射配置')}>
            <Row gutter={16} style={{ marginBottom: 10 }}>
              <Col span={24}>
                <Banner
                  type='info'
                  description={
                    <div>
                      <div>
                        {t(
                          '说明：按“模型名称前缀”进行最长前缀匹配，未命中则不生效。',
                        )}
                      </div>
                      <div style={{ marginTop: 6 }}>
                        {t('示例：')}
                        <code style={{ marginLeft: 6 }}>{exampleJSON}</code>
                      </div>
                    </div>
                  }
                />
              </Col>
            </Row>

            <Row gutter={16}>
              <Col xs={24} sm={20} md={18} lg={16} xl={16}>
                <Form.TextArea
                  label={t('ModelRoleMappings (JSON)')}
                  field={OPTION_KEY}
                  value={jsonText}
                  placeholder={'{}'}
                  autosize={{ minRows: 10, maxRows: 24 }}
                  onChange={(value) => setJsonText(value)}
                />
              </Col>
            </Row>

            {validationErrors.length > 0 && (
              <Row style={{ marginTop: 10 }}>
                <Col span={24}>
                  <Banner
                    type='danger'
                    description={
                      <div>
                        <div style={{ marginBottom: 6 }}>
                          {t('校验失败：')}
                        </div>
                        <ul style={{ paddingLeft: 18, margin: 0 }}>
                          {validationErrors.slice(0, 20).map((e, idx) => (
                            <li key={`${e.path}-${idx}`}>
                              <code>{e.path}</code>: {e.message}
                            </li>
                          ))}
                        </ul>
                        {validationErrors.length > 20 && (
                          <div style={{ marginTop: 6 }}>
                            {t('仅展示前 20 条错误，请继续修正后重试。')}
                          </div>
                        )}
                      </div>
                    }
                  />
                </Col>
              </Row>
            )}

            <Row style={{ marginTop: 12 }} gutter={12}>
              <Col>
                <Button onClick={onValidateClick}>{t('校验')}</Button>
              </Col>
              <Col>
                <Button theme='solid' onClick={onSave}>
                  {t('保存')}
                </Button>
              </Col>
            </Row>
          </Form.Section>
        </Form>
      </Spin>
    </>
  );
}