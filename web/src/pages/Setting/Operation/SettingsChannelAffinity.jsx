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
  Collapse,
  Divider,
  Form,
  Input,
  Modal,
  Row,
  Select,
  Space,
  Spin,
  Table,
  Tag,
  Typography,
} from '@douyinfe/semi-ui';
import {
  IconClose,
  IconDelete,
  IconEdit,
  IconPlus,
  IconRefresh,
} from '@douyinfe/semi-icons';
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
const KEY_SWITCH_ON_SUCCESS = 'channel_affinity_setting.switch_on_success';
const KEY_MAX_ENTRIES = 'channel_affinity_setting.max_entries';
const KEY_DEFAULT_TTL = 'channel_affinity_setting.default_ttl_seconds';
const KEY_RULES = 'channel_affinity_setting.rules';

const KEY_SOURCE_TYPES = [
  { label: 'context_int', value: 'context_int' },
  { label: 'context_string', value: 'context_string' },
  { label: 'gjson', value: 'gjson' },
];

const RULE_TEMPLATES = {
  codex: {
    name: 'codex优选',
    model_regex: ['^gpt-.*$'],
    path_regex: ['/v1/responses'],
    key_sources: [{ type: 'gjson', path: 'prompt_cache_key' }],
    value_regex: '',
    ttl_seconds: 0,
    skip_retry_on_failure: false,
    include_using_group: true,
    include_rule_name: true,
  },
  claudeCode: {
    name: 'claude-code优选',
    model_regex: ['^claude-.*$'],
    path_regex: ['/v1/messages'],
    key_sources: [{ type: 'gjson', path: 'metadata.user_id' }],
    value_regex: '',
    ttl_seconds: 0,
    skip_retry_on_failure: false,
    include_using_group: true,
    include_rule_name: true,
  },
};

const CONTEXT_KEY_PRESETS = [
  { key: 'id', label: 'id（用户 ID）' },
  { key: 'token_id', label: 'token_id' },
  { key: 'token_key', label: 'token_key' },
  { key: 'token_group', label: 'token_group' },
  { key: 'group', label: 'group（using_group）' },
  { key: 'username', label: 'username' },
  { key: 'user_group', label: 'user_group' },
  { key: 'user_email', label: 'user_email' },
  { key: 'specific_channel_id', label: 'specific_channel_id' },
];

const RULES_JSON_PLACEHOLDER = `[
  {
    "name": "prefer-by-conversation-id",
    "model_regex": ["^gpt-.*$"],
    "path_regex": ["/v1/chat/completions"],
    "user_agent_include": ["curl", "PostmanRuntime"],
    "key_sources": [
      { "type": "gjson", "path": "metadata.conversation_id" },
      { "type": "context_string", "key": "conversation_id" }
    ],
    "value_regex": "^[-0-9A-Za-z._:]{1,128}$",
    "ttl_seconds": 600,
    "skip_retry_on_failure": false,
    "include_using_group": true,
    "include_rule_name": true
  }
]`;

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

  if (type === 'gjson') {
    return { type, key: '', path };
  }

  return { type, key, path: '' };
};

const makeUniqueName = (existingNames, baseName) => {
  const base = (baseName || '').trim() || 'rule';
  if (!existingNames.has(base)) return base;
  for (let i = 2; i < 1000; i++) {
    const n = `${base}-${i}`;
    if (!existingNames.has(n)) return n;
  }
  return `${base}-${Date.now()}`;
};

const tryParseRulesJsonArray = (jsonString) => {
  const raw = jsonString || '[]';
  if (!verifyJSON(raw)) return { ok: false, message: 'Rules JSON is invalid' };
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed))
      return { ok: false, message: 'Rules JSON must be an array' };
    return { ok: true, value: parsed };
  } catch (e) {
    return { ok: false, message: 'Rules JSON is invalid' };
  }
};

export default function SettingsChannelAffinity(props) {
  const { t } = useTranslation();
  const { Text } = Typography;
  const [loading, setLoading] = useState(false);

  const [cacheLoading, setCacheLoading] = useState(false);
  const [cacheStats, setCacheStats] = useState({
    enabled: false,
    total: 0,
    unknown: 0,
    by_rule_name: {},
    cache_capacity: 0,
    cache_algo: '',
  });

  const [inputs, setInputs] = useState({
    [KEY_ENABLED]: false,
    [KEY_SWITCH_ON_SUCCESS]: true,
    [KEY_MAX_ENTRIES]: 100000,
    [KEY_DEFAULT_TTL]: 3600,
    [KEY_RULES]: '[]',
  });
  const refForm = useRef();
  const [inputsRow, setInputsRow] = useState(inputs);
  const [editMode, setEditMode] = useState('visual');
  const prevEditModeRef = useRef(editMode);

  const [rules, setRules] = useState([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingRule, setEditingRule] = useState(null);
  const [isEdit, setIsEdit] = useState(false);
  const modalFormRef = useRef();
  const [modalInitValues, setModalInitValues] = useState(null);
  const [modalFormKey, setModalFormKey] = useState(0);
  const [modalAdvancedActiveKey, setModalAdvancedActiveKey] = useState([]);

  const effectiveDefaultTTLSeconds =
    Number(inputs?.[KEY_DEFAULT_TTL] || 0) > 0
      ? Number(inputs?.[KEY_DEFAULT_TTL] || 0)
      : 3600;

  const buildModalFormValues = (rule) => {
    const r = rule || {};
    return {
      name: r.name || '',
      model_regex_text: (r.model_regex || []).join('\n'),
      path_regex_text: (r.path_regex || []).join('\n'),
      user_agent_include_text: (r.user_agent_include || []).join('\n'),
      value_regex: r.value_regex || '',
      ttl_seconds: Number(r.ttl_seconds || 0),
      skip_retry_on_failure: !!r.skip_retry_on_failure,
      include_using_group: r.include_using_group ?? true,
      include_rule_name: r.include_rule_name ?? true,
    };
  };

  const refreshCacheStats = async () => {
    try {
      setCacheLoading(true);
      const res = await API.get('/api/option/channel_affinity_cache', {
        disableDuplicate: true,
      });
      const { success, message, data } = res.data;
      if (!success) return showError(t(message));
      setCacheStats(data || {});
    } catch (e) {
      showError(t('刷新缓存统计失败'));
    } finally {
      setCacheLoading(false);
    }
  };

  const confirmClearAllCache = () => {
    Modal.confirm({
      title: t('确认清空全部渠道亲和性缓存'),
      content: (
        <div style={{ lineHeight: '1.6' }}>
          <Text>{t('将删除所有仍在内存中的渠道亲和性缓存条目。')}</Text>
        </div>
      ),
      onOk: async () => {
        const res = await API.delete('/api/option/channel_affinity_cache', {
          params: { all: true },
        });
        const { success, message } = res.data;
        if (!success) {
          showError(t(message));
          return;
        }
        showSuccess(t('已清空'));
        await refreshCacheStats();
      },
    });
  };

  const confirmClearRuleCache = (rule) => {
    const name = (rule?.name || '').trim();
    if (!name) return;
    if (!rule?.include_rule_name) {
      showWarning(
        t('该规则未启用“作用域：包含规则名称”，无法按规则清空缓存。'),
      );
      return;
    }
    Modal.confirm({
      title: t('确认清空该规则缓存'),
      content: (
        <div style={{ lineHeight: '1.6' }}>
          <Text>{t('规则')}：</Text> <Text strong>{name}</Text>
        </div>
      ),
      onOk: async () => {
        const res = await API.delete('/api/option/channel_affinity_cache', {
          params: { rule_name: name },
        });
        const { success, message } = res.data;
        if (!success) {
          showError(t(message));
          return;
        }
        showSuccess(t('已清空'));
        await refreshCacheStats();
      },
    });
  };

  const setRulesJsonToForm = (jsonString) => {
    if (!refForm.current) return;
    // Use setValue instead of setValues. Semi Form's setValues assigns undefined
    // to every registered field not included in the payload, which can wipe other inputs.
    refForm.current.setValue(KEY_RULES, jsonString || '[]');
  };

  const switchToJsonMode = () => {
    // Ensure a stable source of truth when entering JSON mode.
    // Semi Form may ignore setValues() for an unmounted field, so we seed state first.
    const jsonString = rulesToJson(rules);
    setInputs((prev) => ({ ...(prev || {}), [KEY_RULES]: jsonString }));
    setEditMode('json');
  };

  const switchToVisualMode = () => {
    const validation = tryParseRulesJsonArray(inputs[KEY_RULES] || '[]');
    if (!validation.ok) {
      showError(t(validation.message));
      return;
    }
    setEditMode('visual');
  };

  const updateRulesState = (nextRules) => {
    setRules(nextRules);
    const jsonString = rulesToJson(nextRules);
    setInputs((prev) => ({ ...prev, [KEY_RULES]: jsonString }));
    if (refForm.current && editMode === 'json') {
      refForm.current.setValue(KEY_RULES, jsonString);
    }
  };

  const appendCodexAndClaudeCodeTemplates = () => {
    const doAppend = () => {
      const existingNames = new Set(
        (rules || [])
          .map((r) => (r?.name || '').trim())
          .filter((x) => x.length > 0),
      );

      const templates = [RULE_TEMPLATES.codex, RULE_TEMPLATES.claudeCode].map(
        (tpl) => {
          const name = makeUniqueName(existingNames, tpl.name);
          existingNames.add(name);
          return { ...tpl, name };
        },
      );

      const next = [...(rules || []), ...templates].map((r, idx) => ({
        ...(r || {}),
        id: idx,
      }));
      updateRulesState(next);
      showSuccess(t('已填充模版'));
    };

    if ((rules || []).length === 0) {
      doAppend();
      return;
    }

    Modal.confirm({
      title: t('填充 Codex / Claude Code 模版'),
      content: (
        <div style={{ lineHeight: '1.6' }}>
          <Text type='tertiary'>{t('将追加 2 条规则到现有规则列表。')}</Text>
        </div>
      ),
      onOk: doAppend,
    });
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
      title: t('User-Agent include'),
      dataIndex: 'user_agent_include',
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
      title: t('缓存条目数'),
      render: (_, record) => {
        const name = (record?.name || '').trim();
        if (!name || !record?.include_rule_name) {
          return <Text type='tertiary'>N/A</Text>;
        }
        const n = Number(cacheStats?.by_rule_name?.[name] || 0);
        return <Text>{n}</Text>;
      },
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
            icon={<IconClose />}
            theme='borderless'
            type='warning'
            disabled={!record?.include_rule_name}
            title={t('清空该规则缓存')}
            aria-label={t('清空该规则缓存')}
            onClick={() => confirmClearRuleCache(record)}
          />
          <Button
            icon={<IconEdit />}
            theme='borderless'
            title={t('编辑规则')}
            aria-label={t('编辑规则')}
            onClick={() => handleEditRule(record)}
          />
          <Button
            icon={<IconDelete />}
            theme='borderless'
            type='danger'
            title={t('删除规则')}
            aria-label={t('删除规则')}
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
    const nextRule = {
      name: '',
      model_regex: [],
      path_regex: [],
      user_agent_include: [],
      key_sources: [{ type: 'gjson', path: '' }],
      value_regex: '',
      ttl_seconds: 0,
      skip_retry_on_failure: false,
      include_using_group: true,
      include_rule_name: true,
    };
    setEditingRule(nextRule);
    setIsEdit(false);
    modalFormRef.current = null;
    setModalInitValues(buildModalFormValues(nextRule));
    setModalAdvancedActiveKey([]);
    setModalFormKey((k) => k + 1);
    setModalVisible(true);
  };

  const handleEditRule = (rule) => {
    const r = rule || {};
    const nextRule = {
      ...r,
      user_agent_include: Array.isArray(r.user_agent_include)
        ? r.user_agent_include
        : [],
      key_sources: (r.key_sources || []).map(normalizeKeySource),
    };
    setEditingRule(nextRule);
    setIsEdit(true);
    modalFormRef.current = null;
    setModalInitValues(buildModalFormValues(nextRule));
    setModalAdvancedActiveKey([]);
    setModalFormKey((k) => k + 1);
    setModalVisible(true);
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

      const userAgentInclude = normalizeStringList(
        values.user_agent_include_text,
      );

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
        ...(values.skip_retry_on_failure
          ? { skip_retry_on_failure: true }
          : {}),
        ...(userAgentInclude.length > 0
          ? { user_agent_include: userAgentInclude }
          : {}),
      };

      if (!rulePayload.name) return showError(t('名称不能为空'));

      const next = [...(rules || [])];
      if (isEdit) {
        let idx = next.findIndex((r) => r.id === editingRule?.id);
        if (idx < 0 && editingRule?.name) {
          idx = next.findIndex(
            (r) => (r?.name || '').trim() === (editingRule?.name || '').trim(),
          );
        }
        if (idx < 0) return showError(t('规则未找到，请刷新后重试'));
        next[idx] = rulePayload;
      } else {
        next.push(rulePayload);
      }
      updateRulesState(next.map((r, idx) => ({ ...r, id: idx })));
      setModalVisible(false);
      setEditingRule(null);
      setModalInitValues(null);
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
        ![
          KEY_ENABLED,
          KEY_SWITCH_ON_SUCCESS,
          KEY_MAX_ENTRIES,
          KEY_DEFAULT_TTL,
          KEY_RULES,
        ].includes(key)
      )
        continue;
      if (key === KEY_ENABLED)
        currentInputs[key] = toBoolean(props.options[key]);
      else if (key === KEY_SWITCH_ON_SUCCESS)
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
    refreshCacheStats();
  }, [props.options]);

  useEffect(() => {
    const prevEditMode = prevEditModeRef.current;
    prevEditModeRef.current = editMode;

    // On switching from visual -> json, ensure the JSON editor is seeded.
    // Semi Form may ignore setValues() for an unmounted field.
    if (prevEditMode === editMode) return;
    if (editMode !== 'json') return;
    if (!refForm.current) return;
    refForm.current.setValue(KEY_RULES, inputs[KEY_RULES] || '[]');
  }, [editMode, inputs]);

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
                <Text type='tertiary' size='small'>
                  {t('启用后将优先复用上一次成功的渠道（粘滞选路）。')}
                </Text>
              </Col>
              <Col xs={24} sm={12} md={8} lg={8} xl={8}>
                <Form.InputNumber
                  field={KEY_MAX_ENTRIES}
                  label={t('最大条目数')}
                  min={0}
                  placeholder='例如 100000…'
                  extraText={
                    <Text type='tertiary' size='small'>
                      {t(
                        '内存缓存最大条目数。0 表示使用后端默认容量：100000。',
                      )}
                    </Text>
                  }
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
                  placeholder='例如 3600…'
                  extraText={
                    <Text type='tertiary' size='small'>
                      {t(
                        '规则 ttl_seconds 为 0 时使用。0 表示使用后端默认 TTL：3600 秒。',
                      )}
                    </Text>
                  }
                  onChange={(value) =>
                    setInputs({
                      ...inputs,
                      [KEY_DEFAULT_TTL]: Number(value || 0),
                    })
                  }
                />
              </Col>
            </Row>

            <Row gutter={16} style={{ marginTop: 12 }}>
              <Col xs={24} sm={12} md={8} lg={8} xl={8}>
                <Form.Switch
                  field={KEY_SWITCH_ON_SUCCESS}
                  label={t('成功后切换亲和')}
                  checkedText='|'
                  uncheckedText='O'
                  onChange={(value) =>
                    setInputs({ ...inputs, [KEY_SWITCH_ON_SUCCESS]: value })
                  }
                />
                <Text type='tertiary' size='small'>
                  {t(
                    '如果亲和到的渠道失败，重试到其他渠道成功后，将亲和更新到成功的渠道。',
                  )}
                </Text>
              </Col>
            </Row>

            <Divider style={{ marginTop: 12, marginBottom: 12 }} />

            <Space style={{ marginBottom: 10 }}>
              <Button
                type={editMode === 'visual' ? 'primary' : 'tertiary'}
                onClick={switchToVisualMode}
              >
                {t('可视化')}
              </Button>
              <Button
                type={editMode === 'json' ? 'primary' : 'tertiary'}
                onClick={switchToJsonMode}
              >
                {t('JSON 模式')}
              </Button>
              <Button onClick={appendCodexAndClaudeCodeTemplates}>
                {t('填充 Codex / Claude Code 模版')}
              </Button>
              <Button icon={<IconPlus />} onClick={openAddModal}>
                {t('新增规则')}
              </Button>
              <Button theme='solid' onClick={onSubmit}>
                {t('保存')}
              </Button>
              <Button
                icon={<IconRefresh />}
                loading={cacheLoading}
                onClick={refreshCacheStats}
              >
                {t('刷新缓存统计')}
              </Button>
              <Button type='danger' onClick={confirmClearAllCache}>
                {t('清空全部缓存')}
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
                extraText={t(
                  '规则为 JSON 数组；可视化与 JSON 模式共用同一份数据。',
                )}
                placeholder={RULES_JSON_PLACEHOLDER}
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
        onCancel={() => {
          setModalVisible(false);
          setEditingRule(null);
          setModalInitValues(null);
          setModalAdvancedActiveKey([]);
        }}
        onOk={handleModalSave}
        okText={t('保存')}
        cancelText={t('取消')}
        width={720}
      >
        <Form
          key={`channel-affinity-rule-form-${modalFormKey}`}
          initValues={modalInitValues || {}}
          getFormApi={(formAPI) => {
            modalFormRef.current = formAPI;
          }}
        >
          <Form.Input
            field='name'
            label={t('名称')}
            extraText={t('规则名称（可读性更好，也会出现在管理侧日志中）。')}
            placeholder='例如 prefer-by-conversation-id…'
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
                extraText={t(
                  '必填。对请求的 model 名称进行匹配，任意一条匹配即命中该规则。',
                )}
                placeholder={'^gpt-4o.*$\n^claude-3.*$…'}
                autosize={{ minRows: 4, maxRows: 10 }}
                rules={[{ required: true }]}
              />
            </Col>
            <Col xs={24} sm={12}>
              <Form.TextArea
                field='path_regex_text'
                label={t('路径正则（每行一个）')}
                extraText={t(
                  '可选。对请求路径进行匹配；不填表示匹配所有路径。',
                )}
                placeholder={'/v1/chat/completions\n/v1/responses…'}
                autosize={{ minRows: 4, maxRows: 10 }}
              />
            </Col>
          </Row>

          <Collapse
            keepDOM
            activeKey={modalAdvancedActiveKey}
            onChange={(activeKey) => {
              const keys = Array.isArray(activeKey) ? activeKey : [activeKey];
              setModalAdvancedActiveKey(keys.filter(Boolean));
            }}
          >
            <Collapse.Panel header={t('高级设置')} itemKey='advanced'>
              <Row gutter={16}>
                <Col xs={24}>
                  <Form.TextArea
                    field='user_agent_include_text'
                    label={t('User-Agent include（每行一个，可不写）')}
                    extraText={
                      <Text type='tertiary' size='small'>
                        {t(
                          '可选。匹配入口请求的 User-Agent；任意一行作为子串匹配（忽略大小写）即命中。',
                        )}
                        <br />
                        {t(
                          'NewAPI 默认不会将入口请求的 User-Agent 透传到上游渠道；该条件仅用于识别访问本站点的客户端。',
                        )}
                        <br />
                        {t(
                          '为保证匹配准确，请确保客户端直连本站点（避免反向代理/网关改写 User-Agent）。',
                        )}
                      </Text>
                    }
                    placeholder={'curl\nPostmanRuntime\nMyApp/…'}
                    autosize={{ minRows: 3, maxRows: 8 }}
                  />
                </Col>
              </Row>

              <Row gutter={16}>
                <Col xs={24} sm={12}>
                  <Form.Input
                    field='value_regex'
                    label={t('Value 正则')}
                    placeholder='^[-0-9A-Za-z._:]{1,128}$'
                    extraText={t(
                      '可选。对提取到的亲和 Key 做正则校验；不填表示不校验。',
                    )}
                  />
                </Col>
                <Col xs={24} sm={12}>
                  <Form.InputNumber
                    field='ttl_seconds'
                    label={t('TTL（秒，0 表示默认）')}
                    placeholder='例如 600…'
                    min={0}
                    extraText={
                      <Text type='tertiary' size='small'>
                        {t('该规则的缓存保留时长；0 表示使用默认 TTL：')}
                        {effectiveDefaultTTLSeconds}
                        {t(' 秒。')}
                      </Text>
                    }
                  />
                </Col>
              </Row>

              <Row gutter={16}>
                <Col xs={24} sm={12}>
                  <Form.Switch
                    field='include_using_group'
                    label={t('作用域：包含分组')}
                  />
                  <Text type='tertiary' size='small'>
                    {t(
                      '开启后，using_group 会参与 cache key（不同分组隔离）。',
                    )}
                  </Text>
                </Col>
                <Col xs={24} sm={12}>
                  <Form.Switch
                    field='include_rule_name'
                    label={t('作用域：包含规则名称')}
                  />
                  <Text type='tertiary' size='small'>
                    {t('开启后，规则名称会参与 cache key（不同规则隔离）。')}
                  </Text>
                </Col>
              </Row>

              <Row gutter={16}>
                <Col xs={24} sm={12}>
                  <Form.Switch
                    field='skip_retry_on_failure'
                    label={t('失败后不重试')}
                  />
                  <Text type='tertiary' size='small'>
                    {t('开启后，若该规则命中且请求失败，将不会切换渠道重试。')}
                  </Text>
                </Col>
              </Row>
            </Collapse.Panel>
          </Collapse>

          <Divider style={{ marginTop: 12, marginBottom: 12 }} />
          <Space style={{ marginBottom: 10 }}>
            <Text>{t('Key 来源')}</Text>
            <Button icon={<IconPlus />} onClick={addKeySource}>
              {t('新增 Key 来源')}
            </Button>
          </Space>
          <Text type='tertiary' size='small'>
            {t(
              'context_int/context_string 从请求上下文读取；gjson 从入口请求的 JSON body 按 gjson path 读取。',
            )}
          </Text>
          <div style={{ marginTop: 8, marginBottom: 8 }}>
            <Text type='tertiary' size='small'>
              {t('常用上下文 Key（用于 context_*）')}：
            </Text>
            <div style={{ marginTop: 6 }}>
              {(CONTEXT_KEY_PRESETS || []).map((x) => (
                <Tag key={x.key} style={{ marginRight: 6, marginBottom: 6 }}>
                  {x.label}
                </Tag>
              ))}
            </div>
          </div>

          <Table
            columns={[
              {
                title: t('类型'),
                render: (_, __, idx) => (
                  <Select
                    style={{ width: 160 }}
                    optionList={KEY_SOURCE_TYPES}
                    value={(
                      editingRule?.key_sources?.[idx]?.type || 'gjson'
                    ).trim()}
                    aria-label={t('Key 来源类型')}
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
                    <Input
                      placeholder={
                        isGjson ? 'metadata.conversation_id' : 'user_id'
                      }
                      aria-label={t('Key 或 Path')}
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
                    title={t('删除 Key 来源')}
                    aria-label={t('删除 Key 来源')}
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
