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
import {
  Banner,
  Button,
  Col,
  Divider,
  Form,
  Modal,
  Row,
  Space,
  Spin,
  Table,
  Tag,
  Typography,
} from '@douyinfe/semi-ui';
import { IconDelete, IconEdit, IconPlus } from '@douyinfe/semi-icons';
import {
  API,
  compareObjects,
  showError,
  showSuccess,
  showWarning,
  toBoolean,
  verifyJSON,
} from '../../../helpers';
import { useTranslation } from 'react-i18next';

const KEY_ENABLED = 'channel_affinity_setting.enabled';
const KEY_MAX_ENTRIES = 'channel_affinity_setting.max_entries';
const KEY_DEFAULT_TTL = 'channel_affinity_setting.default_ttl_seconds';
const KEY_RULES = 'channel_affinity_setting.rules';

const KEY_SOURCE_TYPES = [
  { label: 'context_int', value: 'context_int' },
  { label: 'context_string', value: 'context_string' },
  { label: 'gjson', value: 'gjson' },
];

const normalizeStringList = (text) => {
  if (!text) return [];
  return text
    .split('\n')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
};

const stringifyPretty = (v) => JSON.stringify(v, null, 2);
const stringifyCompact = (v) => JSON.stringify(v);

const parseRulesJson = (jsonString) => {
  try {
    const parsed = JSON.parse(jsonString || '[]');
    if (!Array.isArray(parsed)) return [];
    return parsed.map((rule, index) => ({
      id: index,
      ...(rule || {}),
    }));
  } catch (e) {
    return [];
  }
};

const rulesToJson = (rules) => {
  const payload = (rules || []).map((r) => {
    const { id, ...rest } = r || {};
    return rest;
  });
  return stringifyPretty(payload);
};

const normalizeKeySource = (src) => {
  const type = (src?.type || '').trim();
  const key = (src?.key || '').trim();
  const path = (src?.path || '').trim();
  return { type, key, path };
};

export default function SettingsChannelAffinity(props) {
  const { t } = useTranslation();
  const { Text } = Typography;
  const [loading, setLoading] = useState(false);

  const [inputs, setInputs] = useState({
    [KEY_ENABLED]: false,
    [KEY_MAX_ENTRIES]: 100000,
    [KEY_DEFAULT_TTL]: 3600,
    [KEY_RULES]: '[]',
  });
  const refForm = useRef();
  const [inputsRow, setInputsRow] = useState(inputs);
  const [editMode, setEditMode] = useState('visual');

  const [rules, setRules] = useState([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingRule, setEditingRule] = useState(null);
  const [isEdit, setIsEdit] = useState(false);
  const modalFormRef = useRef();

  const updateRulesState = (nextRules) => {
    setRules(nextRules);
    const jsonString = rulesToJson(nextRules);
    setInputs((prev) => ({ ...prev, [KEY_RULES]: jsonString }));
    if (refForm.current && editMode === 'json') {
      refForm.current.setValues({ [KEY_RULES]: jsonString });
    }
  };

  const ruleColumns = [
    {
      title: t('名称'),
      dataIndex: 'name',
      render: (text) => <Text>{text || '-'}</Text>,
    },
    {
      title: t('模型正则'),
      dataIndex: 'model_regex',
      render: (list) =>
        (list || []).length > 0
          ? (list || []).slice(0, 3).map((v, idx) => (
              <Tag key={`${v}-${idx}`} style={{ marginRight: 4 }}>
                {v}
              </Tag>
            ))
          : '-',
    },
    {
      title: t('路径正则'),
      dataIndex: 'path_regex',
      render: (list) =>
        (list || []).length > 0
          ? (list || []).slice(0, 2).map((v, idx) => (
              <Tag key={`${v}-${idx}`} style={{ marginRight: 4 }}>
                {v}
              </Tag>
            ))
          : '-',
    },
    {
      title: t('Key 来源'),
      dataIndex: 'key_sources',
      render: (list) => {
        const xs = list || [];
        if (xs.length === 0) return '-';
        return xs.slice(0, 3).map((src, idx) => {
          const s = normalizeKeySource(src);
          const detail = s.type === 'gjson' ? s.path : s.key;
          return (
            <Tag key={`${s.type}-${idx}`} style={{ marginRight: 4 }}>
              {s.type}:{detail}
            </Tag>
          );
        });
      },
    },
    {
      title: t('TTL（秒）'),
      dataIndex: 'ttl_seconds',
      render: (v) => <Text>{Number(v || 0) || '-'}</Text>,
    },
    {
      title: t('作用域'),
      render: (_, record) => {
        const tags = [];
        if (record?.include_using_group) tags.push('分组');
        if (record?.include_rule_name) tags.push('规则');
        if (tags.length === 0) return '-';
        return tags.map((x) => (
          <Tag key={x} style={{ marginRight: 4 }}>
            {x}
          </Tag>
        ));
      },
    },
    {
      title: t('操作'),
      render: (_, record) => (
        <Space>
          <Button
            icon={<IconEdit />}
            theme='borderless'
            onClick={() => handleEditRule(record)}
          />
          <Button
            icon={<IconDelete />}
            theme='borderless'
            type='danger'
            onClick={() => handleDeleteRule(record.id)}
          />
        </Space>
      ),
    },
  ];

  const validateKeySources = (keySources) => {
    const xs = (keySources || []).map(normalizeKeySource).filter((x) => x.type);
    if (xs.length === 0) return { ok: false, message: 'Key 来源不能为空' };
    for (const x of xs) {
      if (x.type === 'context_int' || x.type === 'context_string') {
        if (!x.key) return { ok: false, message: 'Key 不能为空' };
      } else if (x.type === 'gjson') {
        if (!x.path) return { ok: false, message: 'Path 不能为空' };
      } else {
        return { ok: false, message: 'Key 来源类型不合法' };
      }
    }
    return { ok: true, value: xs };
  };

  const openAddModal = () => {
    setEditingRule({
      name: '',
      model_regex: [],
      path_regex: [],
      key_sources: [{ type: 'gjson', path: '' }],
      value_regex: '',
      ttl_seconds: 0,
      include_using_group: true,
      include_rule_name: true,
    });
    setIsEdit(false);
    setModalVisible(true);
    setTimeout(() => {
      if (!modalFormRef.current) return;
      modalFormRef.current.setValues({
        name: '',
        model_regex_text: '',
        path_regex_text: '',
        value_regex: '',
        ttl_seconds: 0,
        include_using_group: true,
        include_rule_name: true,
      });
    }, 80);
  };

  const handleEditRule = (rule) => {
    const r = rule || {};
    setEditingRule({
      ...r,
      key_sources: (r.key_sources || []).map(normalizeKeySource),
    });
    setIsEdit(true);
    setModalVisible(true);
    setTimeout(() => {
      if (!modalFormRef.current) return;
      modalFormRef.current.setValues({
        name: r.name || '',
        model_regex_text: (r.model_regex || []).join('\n'),
        path_regex_text: (r.path_regex || []).join('\n'),
        value_regex: r.value_regex || '',
        ttl_seconds: Number(r.ttl_seconds || 0),
        include_using_group: !!r.include_using_group,
        include_rule_name: !!r.include_rule_name,
      });
    }, 80);
  };

  const handleDeleteRule = (id) => {
    const next = (rules || []).filter((r) => r.id !== id);
    updateRulesState(next.map((r, idx) => ({ ...r, id: idx })));
    showSuccess(t('删除成功'));
  };

  const handleModalSave = async () => {
    try {
      const values = await modalFormRef.current.validate();
      const modelRegex = normalizeStringList(values.model_regex_text);
      if (modelRegex.length === 0) return showError(t('模型正则不能为空'));

      const keySourcesValidation = validateKeySources(editingRule?.key_sources);
      if (!keySourcesValidation.ok)
        return showError(t(keySourcesValidation.message));

      const rulePayload = {
        id: isEdit ? editingRule.id : rules.length,
        name: (values.name || '').trim(),
        model_regex: modelRegex,
        path_regex: normalizeStringList(values.path_regex_text),
        key_sources: keySourcesValidation.value,
        value_regex: (values.value_regex || '').trim(),
        ttl_seconds: Number(values.ttl_seconds || 0),
        include_using_group: !!values.include_using_group,
        include_rule_name: !!values.include_rule_name,
      };

      if (!rulePayload.name) return showError(t('名称不能为空'));

      const next = [...(rules || [])];
      if (isEdit) {
        const idx = next.findIndex((r) => r.id === editingRule.id);
        if (idx >= 0) next[idx] = rulePayload;
      } else {
        next.push(rulePayload);
      }
      updateRulesState(next.map((r, idx) => ({ ...r, id: idx })));
      setModalVisible(false);
      setEditingRule(null);
      showSuccess(t('保存成功'));
    } catch (e) {
      showError(t('请检查输入'));
    }
  };

  const updateKeySource = (index, patch) => {
    const next = [...(editingRule?.key_sources || [])];
    next[index] = normalizeKeySource({
      ...(next[index] || {}),
      ...(patch || {}),
    });
    setEditingRule((prev) => ({ ...(prev || {}), key_sources: next }));
  };

  const addKeySource = () => {
    const next = [...(editingRule?.key_sources || [])];
    next.push({ type: 'gjson', path: '' });
    setEditingRule((prev) => ({ ...(prev || {}), key_sources: next }));
  };

  const removeKeySource = (index) => {
    const next = [...(editingRule?.key_sources || [])].filter(
      (_, i) => i !== index,
    );
    setEditingRule((prev) => ({ ...(prev || {}), key_sources: next }));
  };

  async function onSubmit() {
    const updateArray = compareObjects(inputs, inputsRow);
    if (!updateArray.length) return showWarning(t('你似乎并没有修改什么'));

    if (!verifyJSON(inputs[KEY_RULES] || '[]'))
      return showError(t('规则 JSON 格式不正确'));
    let compactRules;
    try {
      compactRules = stringifyCompact(JSON.parse(inputs[KEY_RULES] || '[]'));
    } catch (e) {
      return showError(t('规则 JSON 格式不正确'));
    }

    const requestQueue = updateArray.map((item) => {
      let value = '';
      if (item.key === KEY_RULES) {
        value = compactRules;
      } else if (typeof inputs[item.key] === 'boolean') {
        value = String(inputs[item.key]);
      } else {
        value = String(inputs[item.key] ?? '');
      }
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
      .catch(() => showError(t('保存失败，请重试')))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    const currentInputs = { ...inputs };
    for (let key in props.options) {
      if (
        ![KEY_ENABLED, KEY_MAX_ENTRIES, KEY_DEFAULT_TTL, KEY_RULES].includes(
          key,
        )
      )
        continue;
      if (key === KEY_ENABLED)
        currentInputs[key] = toBoolean(props.options[key]);
      else if (key === KEY_MAX_ENTRIES)
        currentInputs[key] = Number(props.options[key] || 0) || 0;
      else if (key === KEY_DEFAULT_TTL)
        currentInputs[key] = Number(props.options[key] || 0) || 0;
      else if (key === KEY_RULES) {
        try {
          const obj = JSON.parse(props.options[key] || '[]');
          currentInputs[key] = stringifyPretty(obj);
        } catch (e) {
          currentInputs[key] = props.options[key] || '[]';
        }
      }
    }
    setInputs(currentInputs);
    setInputsRow(structuredClone(currentInputs));
    if (refForm.current) refForm.current.setValues(currentInputs);
    setRules(parseRulesJson(currentInputs[KEY_RULES]));
  }, [props.options]);

  useEffect(() => {
    if (editMode === 'visual') {
      setRules(parseRulesJson(inputs[KEY_RULES]));
    }
  }, [inputs[KEY_RULES], editMode]);

  const banner = (
    <Banner
      fullMode={false}
      type='info'
      description={t(
        '渠道亲和性会基于从请求上下文或 JSON Body 提取的 Key，优先复用上一次成功的渠道。',
      )}
    />
  );

  return (
    <>
      <Spin spinning={loading}>
        <Form
          values={inputs}
          getFormApi={(formAPI) => (refForm.current = formAPI)}
          style={{ marginBottom: 15 }}
        >
          <Form.Section text={t('渠道亲和性')}>
            {banner}
            <Divider style={{ marginTop: 12, marginBottom: 12 }} />
            <Row gutter={16}>
              <Col xs={24} sm={12} md={8} lg={8} xl={8}>
                <Form.Switch
                  field={KEY_ENABLED}
                  label={t('启用')}
                  checkedText='|'
                  uncheckedText='O'
                  onChange={(value) =>
                    setInputs({ ...inputs, [KEY_ENABLED]: value })
                  }
                />
              </Col>
              <Col xs={24} sm={12} md={8} lg={8} xl={8}>
                <Form.InputNumber
                  field={KEY_MAX_ENTRIES}
                  label={t('最大条目数')}
                  min={0}
                  onChange={(value) =>
                    setInputs({
                      ...inputs,
                      [KEY_MAX_ENTRIES]: Number(value || 0),
                    })
                  }
                />
              </Col>
              <Col xs={24} sm={12} md={8} lg={8} xl={8}>
                <Form.InputNumber
                  field={KEY_DEFAULT_TTL}
                  label={t('默认 TTL（秒）')}
                  min={0}
                  onChange={(value) =>
                    setInputs({
                      ...inputs,
                      [KEY_DEFAULT_TTL]: Number(value || 0),
                    })
                  }
                />
              </Col>
            </Row>

            <Divider style={{ marginTop: 12, marginBottom: 12 }} />

            <Space style={{ marginBottom: 10 }}>
              <Button
                type={editMode === 'visual' ? 'primary' : 'tertiary'}
                onClick={() => setEditMode('visual')}
              >
                {t('可视化')}
              </Button>
              <Button
                type={editMode === 'json' ? 'primary' : 'tertiary'}
                onClick={() => setEditMode('json')}
              >
                {t('JSON 模式')}
              </Button>
              <Button icon={<IconPlus />} onClick={openAddModal}>
                {t('新增规则')}
              </Button>
              <Button theme='solid' onClick={onSubmit}>
                {t('保存')}
              </Button>
            </Space>

            {editMode === 'visual' ? (
              <Table
                columns={ruleColumns}
                dataSource={rules}
                rowKey='id'
                pagination={false}
                size='small'
              />
            ) : (
              <Form.TextArea
                field={KEY_RULES}
                label={t('规则 JSON')}
                style={{ width: '100%' }}
                autosize={{ minRows: 10, maxRows: 28 }}
                rules={[
                  {
                    validator: (rule, value) => verifyJSON(value || '[]'),
                  },
                ]}
                onChange={(value) =>
                  setInputs({ ...inputs, [KEY_RULES]: value })
                }
              />
            )}
          </Form.Section>
        </Form>
      </Spin>

      <Modal
        title={isEdit ? t('编辑规则') : t('新增规则')}
        visible={modalVisible}
        onCancel={() => setModalVisible(false)}
        onOk={handleModalSave}
        okText={t('保存')}
        cancelText={t('取消')}
        width={720}
      >
        <Form getFormApi={(formAPI) => (modalFormRef.current = formAPI)}>
          <Form.Input
            field='name'
            label={t('名称')}
            rules={[{ required: true }]}
            onChange={(value) =>
              setEditingRule((prev) => ({ ...(prev || {}), name: value }))
            }
          />

          <Row gutter={16}>
            <Col xs={24} sm={12}>
              <Form.TextArea
                field='model_regex_text'
                label={t('模型正则（每行一个）')}
                autosize={{ minRows: 4, maxRows: 10 }}
                rules={[{ required: true }]}
              />
            </Col>
            <Col xs={24} sm={12}>
              <Form.TextArea
                field='path_regex_text'
                label={t('路径正则（每行一个）')}
                autosize={{ minRows: 4, maxRows: 10 }}
              />
            </Col>
          </Row>

          <Row gutter={16}>
            <Col xs={24} sm={12}>
              <Form.Input
                field='value_regex'
                label={t('Value 正则')}
                placeholder='^[-0-9A-Za-z._:]{1,128}$'
              />
            </Col>
            <Col xs={24} sm={12}>
              <Form.InputNumber
                field='ttl_seconds'
                label={t('TTL（秒，0 表示默认）')}
                min={0}
              />
            </Col>
          </Row>

          <Row gutter={16}>
            <Col xs={24} sm={12}>
              <Form.Switch
                field='include_using_group'
                label={t('作用域：包含分组')}
              />
            </Col>
            <Col xs={24} sm={12}>
              <Form.Switch
                field='include_rule_name'
                label={t('作用域：包含规则名称')}
              />
            </Col>
          </Row>

          <Divider style={{ marginTop: 12, marginBottom: 12 }} />
          <Space style={{ marginBottom: 10 }}>
            <Text>{t('Key 来源')}</Text>
            <Button icon={<IconPlus />} onClick={addKeySource}>
              {t('新增 Key 来源')}
            </Button>
          </Space>

          <Table
            columns={[
              {
                title: t('类型'),
                render: (_, __, idx) => (
                  <Form.Select
                    field={`ks_type_${idx}`}
                    style={{ width: 160 }}
                    optionList={KEY_SOURCE_TYPES}
                    value={(
                      editingRule?.key_sources?.[idx]?.type || 'gjson'
                    ).trim()}
                    onChange={(value) => updateKeySource(idx, { type: value })}
                  />
                ),
              },
              {
                title: t('Key 或 Path'),
                render: (_, __, idx) => {
                  const src = normalizeKeySource(
                    editingRule?.key_sources?.[idx],
                  );
                  const isGjson = src.type === 'gjson';
                  return (
                    <Form.Input
                      field={`ks_value_${idx}`}
                      placeholder={isGjson ? 'metadata.conversation_id' : 'id'}
                      value={isGjson ? src.path : src.key}
                      onChange={(value) =>
                        updateKeySource(
                          idx,
                          isGjson ? { path: value } : { key: value },
                        )
                      }
                    />
                  );
                },
              },
              {
                title: t('操作'),
                width: 90,
                render: (_, __, idx) => (
                  <Button
                    icon={<IconDelete />}
                    theme='borderless'
                    type='danger'
                    onClick={() => removeKeySource(idx)}
                  />
                ),
              },
            ]}
            dataSource={(editingRule?.key_sources || []).map((x, idx) => ({
              id: idx,
              ...x,
            }))}
            rowKey='id'
            pagination={false}
            size='small'
          />
        </Form>
      </Modal>
    </>
  );
}
