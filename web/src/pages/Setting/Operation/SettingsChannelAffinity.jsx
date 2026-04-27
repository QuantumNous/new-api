/*
Copyright (C) 2025 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/

import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Button,
  Modal,
  ModalBackdrop,
  ModalBody,
  ModalContainer,
  ModalDialog,
  ModalFooter,
  ModalHeader,
  Spinner,
  Switch,
  useOverlayState,
} from '@heroui/react';
import {
  ChevronDown,
  Code2,
  Edit3,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import {
  API,
  compareObjects,
  showError,
  showSuccess,
  showWarning,
  toBoolean,
  verifyJSON,
} from '../../../helpers';
import {
  CHANNEL_AFFINITY_RULE_TEMPLATES,
  cloneChannelAffinityTemplate,
} from '../../../constants/channel-affinity-template.constants';
import ParamOverrideEditorModal from '../../../components/table/channels/modals/ParamOverrideEditorModal';
import ConfirmDialog from '../../../components/common/ui/ConfirmDialog';

// ----------------------------- helpers -----------------------------

const inputClass =
  'h-10 w-full rounded-xl border border-border bg-background px-3 text-sm text-foreground outline-none transition focus:border-primary disabled:opacity-50';

const textareaClass =
  'w-full rounded-xl border border-border bg-background px-3 py-2 font-mono text-xs text-foreground outline-none transition focus:border-primary';

function FieldLabel({ children, required }) {
  return (
    <label className='block text-sm font-medium text-foreground'>
      {children}
      {required ? <span className='ml-0.5 text-danger'>*</span> : null}
    </label>
  );
}

function FieldHint({ children }) {
  if (!children) return null;
  return <div className='mt-1.5 text-xs text-muted'>{children}</div>;
}

function StatusChip({ tone = 'grey', children, className = '' }) {
  const TONE = {
    green: 'bg-success/15 text-success',
    orange: 'bg-warning/15 text-warning',
    red: 'bg-danger/15 text-danger',
    grey: 'bg-surface-secondary text-muted',
    primary: 'bg-primary/15 text-primary',
  };
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${
        TONE[tone] || TONE.grey
      } ${className}`}
    >
      {children}
    </span>
  );
}

function InfoBanner({ children }) {
  return (
    <div className='flex items-start gap-2 rounded-xl border border-primary/20 bg-primary/5 px-3 py-2 text-sm text-foreground'>
      <span>{children}</span>
    </div>
  );
}

function SwitchRow({ label, hint, value, onChange }) {
  return (
    <div className='space-y-1'>
      <div className='flex items-start justify-between gap-3'>
        <div className='text-sm font-medium text-foreground'>{label}</div>
        <Switch
          isSelected={!!value}
          onValueChange={onChange}
          size='md'
          aria-label={label}
        >
          <Switch.Control>
            <Switch.Thumb />
          </Switch.Control>
        </Switch>
      </div>
      {hint ? <div className='text-xs text-muted'>{hint}</div> : null}
    </div>
  );
}

// ----------------------------- constants -----------------------------

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
    "param_override_template": {
      "operations": [
        { "path": "temperature", "mode": "set", "value": 0.2 }
      ]
    },
    "skip_retry_on_failure": false,
    "include_using_group": true,
    "include_model_name": false,
    "include_rule_name": true
  }
]`;

// ----------------------------- pure helpers -----------------------------

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
    return parsed.map((rule, index) => ({ id: index, ...(rule || {}) }));
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
  if (type === 'gjson') return { type, key: '', path };
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

const parseOptionalObjectJson = (jsonString, label) => {
  const raw = (jsonString || '').trim();
  if (!raw) return { ok: true, value: null };
  if (!verifyJSON(raw)) return { ok: false, message: `${label} JSON 格式不正确` };
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return { ok: false, message: `${label} 必须是 JSON 对象` };
    }
    return { ok: true, value: parsed };
  } catch (error) {
    return { ok: false, message: `${label} JSON 格式不正确` };
  }
};

const buildChannelAffinityRulePayload = ({
  values,
  isEdit,
  editingRuleId,
  rulesLength,
  modelRegex,
  pathRegex,
  keySources,
  userAgentInclude,
  paramOverrideTemplate,
}) => ({
  id: isEdit ? editingRuleId : rulesLength,
  name: (values?.name || '').trim(),
  model_regex: modelRegex,
  path_regex: pathRegex,
  key_sources: keySources,
  value_regex: (values?.value_regex || '').trim(),
  ttl_seconds: Number(values?.ttl_seconds || 0),
  include_using_group: !!values?.include_using_group,
  include_model_name: !!values?.include_model_name,
  include_rule_name: !!values?.include_rule_name,
  skip_retry_on_failure: !!values?.skip_retry_on_failure,
  ...(userAgentInclude.length > 0
    ? { user_agent_include: userAgentInclude }
    : {}),
  ...(paramOverrideTemplate
    ? { param_override_template: paramOverrideTemplate }
    : {}),
});

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
    include_model_name: !!r.include_model_name,
    include_rule_name: r.include_rule_name ?? true,
    param_override_template_json: r.param_override_template
      ? stringifyPretty(r.param_override_template)
      : '',
  };
};

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

// ----------------------------- main -----------------------------

const INITIAL_INPUTS = {
  [KEY_ENABLED]: false,
  [KEY_SWITCH_ON_SUCCESS]: true,
  [KEY_MAX_ENTRIES]: 100000,
  [KEY_DEFAULT_TTL]: 3600,
  [KEY_RULES]: '[]',
};

export default function SettingsChannelAffinity(props) {
  const { t } = useTranslation();

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

  const [inputs, setInputs] = useState(INITIAL_INPUTS);
  const [inputsRow, setInputsRow] = useState(INITIAL_INPUTS);
  const [editMode, setEditMode] = useState('visual');

  const [rules, setRules] = useState([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingRule, setEditingRule] = useState(null);
  const [isEdit, setIsEdit] = useState(false);
  const [modalForm, setModalForm] = useState({});
  const [modalAdvancedOpen, setModalAdvancedOpen] = useState(false);
  const [paramTemplateDraft, setParamTemplateDraft] = useState('');
  const [paramTemplateEditorVisible, setParamTemplateEditorVisible] =
    useState(false);

  // Confirm dialogs
  const [confirmClearAll, setConfirmClearAll] = useState(false);
  const [confirmClearRule, setConfirmClearRule] = useState(null);
  const [confirmAppendTemplates, setConfirmAppendTemplates] = useState(false);

  // Param-template preview modal
  const [previewModalVisible, setPreviewModalVisible] = useState(false);
  const [previewRaw, setPreviewRaw] = useState('');

  const ruleModalState = useOverlayState({
    isOpen: modalVisible,
    onOpenChange: (isOpen) => {
      if (!isOpen) closeRuleModal();
    },
  });

  const previewModalState = useOverlayState({
    isOpen: previewModalVisible,
    onOpenChange: (isOpen) => {
      if (!isOpen) setPreviewModalVisible(false);
    },
  });

  const effectiveDefaultTTLSeconds =
    Number(inputs?.[KEY_DEFAULT_TTL] || 0) > 0
      ? Number(inputs?.[KEY_DEFAULT_TTL] || 0)
      : 3600;

  const setInputsField = (key) => (value) => {
    setInputs((prev) => ({ ...prev, [key]: value }));
  };

  const setModalField = (key) => (value) => {
    setModalForm((prev) => ({ ...prev, [key]: value }));
  };

  const updateParamTemplateDraft = (value) => {
    const next = typeof value === 'string' ? value : '';
    setParamTemplateDraft(next);
    setModalForm((prev) => ({
      ...prev,
      param_override_template_json: next,
    }));
  };

  const formatParamTemplateDraft = () => {
    const raw = (paramTemplateDraft || '').trim();
    if (!raw) return;
    if (!verifyJSON(raw)) {
      showError(t('参数覆盖模板 JSON 格式不正确'));
      return;
    }
    try {
      updateParamTemplateDraft(JSON.stringify(JSON.parse(raw), null, 2));
    } catch (error) {
      showError(t('参数覆盖模板 JSON 格式不正确'));
    }
  };

  const openParamTemplatePreview = (rule) => {
    const raw = rule?.param_override_template;
    if (!raw || typeof raw !== 'object') {
      showWarning(t('该规则未设置参数覆盖模板'));
      return;
    }
    setPreviewRaw(stringifyPretty(raw));
    setPreviewModalVisible(true);
  };

  const paramTemplatePreviewMeta = useMemo(() => {
    const raw = (paramTemplateDraft || '').trim();
    if (!raw) {
      return {
        tagLabel: t('未设置'),
        tagTone: 'grey',
        preview: t('当前规则未设置参数覆盖模板'),
      };
    }
    if (!verifyJSON(raw)) {
      return { tagLabel: t('JSON 无效'), tagTone: 'red', preview: raw };
    }
    try {
      return {
        tagLabel: t('已设置'),
        tagTone: 'orange',
        preview: JSON.stringify(JSON.parse(raw), null, 2),
      };
    } catch (error) {
      return { tagLabel: t('JSON 无效'), tagTone: 'red', preview: raw };
    }
  }, [paramTemplateDraft, t]);

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

  const switchToJsonMode = () => {
    const jsonString = rulesToJson(rules);
    setInputs((prev) => ({ ...prev, [KEY_RULES]: jsonString }));
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
  };

  const doAppendTemplates = () => {
    const existingNames = new Set(
      (rules || [])
        .map((r) => (r?.name || '').trim())
        .filter((x) => x.length > 0),
    );

    const templates = [
      CHANNEL_AFFINITY_RULE_TEMPLATES.codexCli,
      CHANNEL_AFFINITY_RULE_TEMPLATES.claudeCli,
    ].map((tpl) => {
      const baseTemplate = cloneChannelAffinityTemplate(tpl);
      const name = makeUniqueName(existingNames, tpl.name);
      existingNames.add(name);
      return { ...baseTemplate, name };
    });

    const next = [...(rules || []), ...templates].map((r, idx) => ({
      ...(r || {}),
      id: idx,
    }));
    updateRulesState(next);
    showSuccess(t('已填充模版'));
  };

  const handleAppendTemplates = () => {
    if ((rules || []).length === 0) {
      doAppendTemplates();
      return;
    }
    setConfirmAppendTemplates(true);
  };

  function closeRuleModal() {
    setModalVisible(false);
    setEditingRule(null);
    setModalAdvancedOpen(false);
    setParamTemplateDraft('');
    setParamTemplateEditorVisible(false);
  }

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
      include_model_name: false,
      include_rule_name: true,
    };
    setEditingRule(nextRule);
    setIsEdit(false);
    const initValues = buildModalFormValues(nextRule);
    setModalForm(initValues);
    setParamTemplateDraft(initValues.param_override_template_json || '');
    setParamTemplateEditorVisible(false);
    setModalAdvancedOpen(false);
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
    const initValues = buildModalFormValues(nextRule);
    setModalForm(initValues);
    setParamTemplateDraft(initValues.param_override_template_json || '');
    setParamTemplateEditorVisible(false);
    setModalAdvancedOpen(false);
    setModalVisible(true);
  };

  const handleDeleteRule = (id) => {
    const next = (rules || []).filter((r) => r.id !== id);
    updateRulesState(next.map((r, idx) => ({ ...r, id: idx })));
    showSuccess(t('删除成功'));
  };

  const handleModalSave = () => {
    const values = modalForm;
    const modelRegex = normalizeStringList(values.model_regex_text);
    if (!values.name?.trim()) return showError(t('名称不能为空'));
    if (modelRegex.length === 0) return showError(t('模型正则不能为空'));

    const keySourcesValidation = validateKeySources(editingRule?.key_sources);
    if (!keySourcesValidation.ok) {
      return showError(t(keySourcesValidation.message));
    }

    const userAgentInclude = normalizeStringList(values.user_agent_include_text);
    const paramTemplateValidation = parseOptionalObjectJson(
      paramTemplateDraft,
      '参数覆盖模板',
    );
    if (!paramTemplateValidation.ok) {
      return showError(t(paramTemplateValidation.message));
    }

    const rulePayload = buildChannelAffinityRulePayload({
      values,
      isEdit,
      editingRuleId: editingRule?.id,
      rulesLength: rules.length,
      modelRegex,
      pathRegex: normalizeStringList(values.path_regex_text),
      keySources: keySourcesValidation.value,
      userAgentInclude,
      paramOverrideTemplate: paramTemplateValidation.value,
    });

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
    closeRuleModal();
    showSuccess(t('保存成功'));
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
      if (item.key === KEY_RULES) value = compactRules;
      else if (typeof inputs[item.key] === 'boolean')
        value = String(inputs[item.key]);
      else value = String(inputs[item.key] ?? '');
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
    const currentInputs = { ...INITIAL_INPUTS };
    for (const key in props.options) {
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
      if (key === KEY_ENABLED || key === KEY_SWITCH_ON_SUCCESS)
        currentInputs[key] = toBoolean(props.options[key]);
      else if (key === KEY_MAX_ENTRIES || key === KEY_DEFAULT_TTL)
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
    setRules(parseRulesJson(currentInputs[KEY_RULES]));
    refreshCacheStats();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.options]);

  useEffect(() => {
    if (editMode === 'visual') {
      setRules(parseRulesJson(inputs[KEY_RULES]));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inputs[KEY_RULES], editMode]);

  // ESC-to-close for both modals
  useEffect(() => {
    if (!modalVisible && !previewModalVisible) return;
    const onKey = (event) => {
      if (event.key !== 'Escape') return;
      if (previewModalVisible) setPreviewModalVisible(false);
      else if (modalVisible) closeRuleModal();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modalVisible, previewModalVisible]);

  // ----------------------------- render -----------------------------

  const renderRulesTable = () => (
    <div className='overflow-x-auto rounded-xl border border-border'>
      <table className='w-full text-sm'>
        <thead className='bg-surface-secondary text-xs uppercase tracking-wide text-muted'>
          <tr>
            <th className='px-3 py-2 text-left font-medium'>{t('名称')}</th>
            <th className='px-3 py-2 text-left font-medium'>
              {t('模型正则')}
            </th>
            <th className='px-3 py-2 text-left font-medium'>
              {t('路径正则')}
            </th>
            <th className='px-3 py-2 text-left font-medium'>{t('Key 来源')}</th>
            <th className='px-3 py-2 text-left font-medium'>
              {t('TTL（秒）')}
            </th>
            <th className='px-3 py-2 text-left font-medium'>
              {t('失败后是否重试')}
            </th>
            <th className='px-3 py-2 text-left font-medium'>{t('覆盖模板')}</th>
            <th className='px-3 py-2 text-left font-medium'>
              {t('缓存条目数')}
            </th>
            <th className='px-3 py-2 text-left font-medium'>{t('作用域')}</th>
            <th className='px-3 py-2 text-left font-medium'>{t('操作')}</th>
          </tr>
        </thead>
        <tbody className='divide-y divide-border'>
          {(rules || []).length === 0 ? (
            <tr>
              <td
                colSpan={10}
                className='px-4 py-8 text-center text-sm text-muted'
              >
                {t('暂无数据')}
              </td>
            </tr>
          ) : (
            rules.map((record) => {
              const scopeTags = [];
              if (record.include_using_group) scopeTags.push(t('分组'));
              if (record.include_model_name) scopeTags.push(t('模型'));
              if (record.include_rule_name) scopeTags.push(t('规则'));

              const cacheCount =
                record.name && record.include_rule_name
                  ? Number(cacheStats?.by_rule_name?.[record.name] || 0)
                  : null;

              return (
                <tr
                  key={record.id}
                  className='bg-background hover:bg-surface-secondary/60'
                >
                  <td className='px-3 py-2 align-top text-foreground'>
                    {record.name || '-'}
                  </td>
                  <td className='px-3 py-2 align-top'>
                    {(record.model_regex || []).length === 0
                      ? '-'
                      : (record.model_regex || []).slice(0, 3).map((v, idx) => (
                          <StatusChip
                            key={`${v}-${idx}`}
                            className='mr-1'
                          >
                            {v}
                          </StatusChip>
                        ))}
                  </td>
                  <td className='px-3 py-2 align-top'>
                    {(record.path_regex || []).length === 0
                      ? '-'
                      : (record.path_regex || []).slice(0, 2).map((v, idx) => (
                          <StatusChip
                            key={`${v}-${idx}`}
                            className='mr-1'
                          >
                            {v}
                          </StatusChip>
                        ))}
                  </td>
                  <td className='px-3 py-2 align-top'>
                    {(record.key_sources || []).length === 0
                      ? '-'
                      : (record.key_sources || []).slice(0, 3).map((src, idx) => {
                          const s = normalizeKeySource(src);
                          const detail = s.type === 'gjson' ? s.path : s.key;
                          return (
                            <StatusChip
                              key={`${s.type}-${idx}`}
                              className='mr-1'
                            >
                              {s.type}:{detail}
                            </StatusChip>
                          );
                        })}
                  </td>
                  <td className='px-3 py-2 align-top text-foreground'>
                    {Number(record.ttl_seconds || 0) || '-'}
                  </td>
                  <td className='px-3 py-2 align-top'>
                    <StatusChip
                      tone={record.skip_retry_on_failure ? 'orange' : 'green'}
                    >
                      {record.skip_retry_on_failure ? t('不重试') : t('重试')}
                    </StatusChip>
                  </td>
                  <td className='px-3 py-2 align-top'>
                    {record.param_override_template ? (
                      <Button
                        size='sm'
                        variant='light'
                        startContent={<Search size={14} />}
                        onPress={() => openParamTemplatePreview(record)}
                      >
                        {t('预览模板')}
                      </Button>
                    ) : (
                      <span className='text-muted'>-</span>
                    )}
                  </td>
                  <td className='px-3 py-2 align-top text-foreground'>
                    {cacheCount === null ? (
                      <span className='text-muted'>N/A</span>
                    ) : (
                      cacheCount
                    )}
                  </td>
                  <td className='px-3 py-2 align-top'>
                    {scopeTags.length === 0
                      ? '-'
                      : scopeTags.map((x) => (
                          <StatusChip key={x} className='mr-1'>
                            {x}
                          </StatusChip>
                        ))}
                  </td>
                  <td className='px-3 py-2 align-top'>
                    <div className='flex items-center gap-1'>
                      <Button
                        isIconOnly
                        size='sm'
                        variant='light'
                        color='warning'
                        isDisabled={!record.include_rule_name}
                        aria-label={t('清空该规则缓存')}
                        onPress={() => setConfirmClearRule(record)}
                      >
                        <X size={14} />
                      </Button>
                      <Button
                        isIconOnly
                        size='sm'
                        variant='light'
                        aria-label={t('编辑规则')}
                        onPress={() => handleEditRule(record)}
                      >
                        <Edit3 size={14} />
                      </Button>
                      <Button
                        isIconOnly
                        size='sm'
                        variant='light'
                        color='danger'
                        aria-label={t('删除规则')}
                        onPress={() => handleDeleteRule(record.id)}
                      >
                        <Trash2 size={14} />
                      </Button>
                    </div>
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );

  const renderKeySourcesTable = () => (
    <div className='overflow-x-auto rounded-xl border border-border'>
      <table className='w-full text-sm'>
        <thead className='bg-surface-secondary text-xs uppercase tracking-wide text-muted'>
          <tr>
            <th className='w-[180px] px-3 py-2 text-left font-medium'>
              {t('类型')}
            </th>
            <th className='px-3 py-2 text-left font-medium'>
              {t('Key 或 Path')}
            </th>
            <th className='w-[90px] px-3 py-2 text-left font-medium'>
              {t('操作')}
            </th>
          </tr>
        </thead>
        <tbody className='divide-y divide-border'>
          {(editingRule?.key_sources || []).length === 0 ? (
            <tr>
              <td
                colSpan={3}
                className='px-4 py-6 text-center text-sm text-muted'
              >
                {t('暂无数据')}
              </td>
            </tr>
          ) : (
            (editingRule?.key_sources || []).map((src, idx) => {
              const s = normalizeKeySource(src);
              const isGjson = s.type === 'gjson';
              return (
                <tr
                  key={`ks-${idx}`}
                  className='bg-background hover:bg-surface-secondary/60'
                >
                  <td className='px-3 py-2 align-middle'>
                    <select
                      value={s.type || 'gjson'}
                      onChange={(event) =>
                        updateKeySource(idx, { type: event.target.value })
                      }
                      aria-label={t('Key 来源类型')}
                      className={`${inputClass} w-[160px]`}
                    >
                      {KEY_SOURCE_TYPES.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className='px-3 py-2 align-middle'>
                    <input
                      type='text'
                      value={isGjson ? s.path : s.key}
                      onChange={(event) =>
                        updateKeySource(
                          idx,
                          isGjson
                            ? { path: event.target.value }
                            : { key: event.target.value },
                        )
                      }
                      aria-label={t('Key 或 Path')}
                      placeholder={
                        isGjson ? 'metadata.conversation_id' : 'user_id'
                      }
                      className={inputClass}
                    />
                  </td>
                  <td className='px-3 py-2 align-middle'>
                    <Button
                      isIconOnly
                      size='sm'
                      variant='light'
                      color='danger'
                      aria-label={t('删除 Key 来源')}
                      onPress={() => removeKeySource(idx)}
                    >
                      <Trash2 size={14} />
                    </Button>
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );

  return (
    <>
      <div className='relative space-y-4'>
        {loading && (
          <div className='absolute inset-0 z-10 flex items-center justify-center bg-background/60 backdrop-blur-[1px]'>
            <Spinner color='primary' />
          </div>
        )}

        <div className='border-b border-border pb-2 text-base font-semibold text-foreground'>
          {t('渠道亲和性')}
        </div>

        <InfoBanner>
          {t(
            '渠道亲和性会基于从请求上下文或 JSON Body 提取的 Key，优先复用上一次成功的渠道。',
          )}
        </InfoBanner>

        <div className='grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3'>
          <SwitchRow
            label={t('启用')}
            hint={t('启用后将优先复用上一次成功的渠道（粘滞选路）。')}
            value={inputs[KEY_ENABLED]}
            onChange={setInputsField(KEY_ENABLED)}
          />
          <div className='space-y-2'>
            <FieldLabel>{t('最大条目数')}</FieldLabel>
            <input
              type='number'
              min={0}
              value={inputs[KEY_MAX_ENTRIES] ?? 0}
              onChange={(event) => {
                const raw = event.target.value;
                setInputsField(KEY_MAX_ENTRIES)(
                  raw === '' ? 0 : Number(raw),
                );
              }}
              placeholder='例如 100000…'
              className={inputClass}
            />
            <FieldHint>
              {t(
                '内存缓存最大条目数。0 表示使用后端默认容量：100000。',
              )}
            </FieldHint>
          </div>
          <div className='space-y-2'>
            <FieldLabel>{t('默认 TTL（秒）')}</FieldLabel>
            <input
              type='number'
              min={0}
              value={inputs[KEY_DEFAULT_TTL] ?? 0}
              onChange={(event) => {
                const raw = event.target.value;
                setInputsField(KEY_DEFAULT_TTL)(
                  raw === '' ? 0 : Number(raw),
                );
              }}
              placeholder='例如 3600…'
              className={inputClass}
            />
            <FieldHint>
              {t(
                '规则 ttl_seconds 为 0 时使用。0 表示使用后端默认 TTL：3600 秒。',
              )}
            </FieldHint>
          </div>
        </div>

        <div className='grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3'>
          <SwitchRow
            label={t('成功后切换亲和')}
            hint={t(
              '如果亲和到的渠道失败，重试到其他渠道成功后，将亲和更新到成功的渠道。',
            )}
            value={inputs[KEY_SWITCH_ON_SUCCESS]}
            onChange={setInputsField(KEY_SWITCH_ON_SUCCESS)}
          />
        </div>

        <div className='border-t border-border pt-3' />

        {/* Toolbar */}
        <div className='flex flex-wrap items-center gap-2'>
          <div className='inline-flex overflow-hidden rounded-xl border border-border'>
            {[
              { value: 'visual', label: t('可视化') },
              { value: 'json', label: t('JSON 模式') },
            ].map((mode) => {
              const active = mode.value === editMode;
              return (
                <button
                  key={mode.value}
                  type='button'
                  onClick={() => {
                    if (mode.value === 'visual') switchToVisualMode();
                    else switchToJsonMode();
                  }}
                  className={`px-4 py-1.5 text-sm font-medium transition-colors ${
                    active
                      ? 'bg-foreground text-background'
                      : 'bg-background text-muted hover:bg-surface-secondary'
                  }`}
                >
                  {mode.label}
                </button>
              );
            })}
          </div>
          <Button variant='flat' onPress={handleAppendTemplates}>
            {t('填充 Codex CLI / Claude CLI 模版')}
          </Button>
          <Button
            variant='flat'
            startContent={<Plus size={14} />}
            onPress={openAddModal}
          >
            {t('新增规则')}
          </Button>
          <Button color='primary' onPress={onSubmit}>
            {t('保存')}
          </Button>
          <Button
            variant='flat'
            startContent={<RefreshCw size={14} />}
            isPending={cacheLoading}
            onPress={refreshCacheStats}
          >
            {t('刷新缓存统计')}
          </Button>
          <Button color='danger' onPress={() => setConfirmClearAll(true)}>
            {t('清空全部缓存')}
          </Button>
        </div>

        {editMode === 'visual' ? (
          renderRulesTable()
        ) : (
          <div className='space-y-2'>
            <FieldLabel>{t('规则 JSON')}</FieldLabel>
            <textarea
              rows={14}
              value={inputs[KEY_RULES] ?? '[]'}
              onChange={(event) =>
                setInputsField(KEY_RULES)(event.target.value)
              }
              placeholder={RULES_JSON_PLACEHOLDER}
              className={textareaClass}
            />
            <FieldHint>
              {t('规则为 JSON 数组；可视化与 JSON 模式共用同一份数据。')}
            </FieldHint>
          </div>
        )}
      </div>

      {/* Rule edit modal */}
      <Modal state={ruleModalState}>
        <ModalBackdrop variant='blur'>
          <ModalContainer
            size='3xl'
            placement='center'
            className='max-w-[95vw]'
          >
            <ModalDialog className='bg-background/95 backdrop-blur'>
              <ModalHeader className='border-b border-border'>
                <span>{isEdit ? t('编辑规则') : t('新增规则')}</span>
              </ModalHeader>
              <ModalBody className='max-h-[72vh] space-y-4 overflow-y-auto px-6 py-5'>
                <div className='space-y-2'>
                  <FieldLabel required>{t('名称')}</FieldLabel>
                  <input
                    type='text'
                    value={modalForm.name || ''}
                    onChange={(event) => {
                      const v = event.target.value;
                      setModalField('name')(v);
                      setEditingRule((prev) => ({
                        ...(prev || {}),
                        name: v,
                      }));
                    }}
                    placeholder='例如 prefer-by-conversation-id…'
                    className={inputClass}
                  />
                  <FieldHint>
                    {t('规则名称（可读性更好，也会出现在管理侧日志中）。')}
                  </FieldHint>
                </div>

                <div className='grid grid-cols-1 gap-4 sm:grid-cols-2'>
                  <div className='space-y-2'>
                    <FieldLabel required>
                      {t('模型正则（每行一个）')}
                    </FieldLabel>
                    <textarea
                      rows={5}
                      value={modalForm.model_regex_text || ''}
                      onChange={(event) =>
                        setModalField('model_regex_text')(event.target.value)
                      }
                      placeholder={'^gpt-4o.*$\n^claude-3.*$…'}
                      className={textareaClass}
                    />
                    <FieldHint>
                      {t(
                        '必填。对请求的 model 名称进行匹配，任意一条匹配即命中该规则。',
                      )}
                    </FieldHint>
                  </div>
                  <div className='space-y-2'>
                    <FieldLabel>{t('路径正则（每行一个）')}</FieldLabel>
                    <textarea
                      rows={5}
                      value={modalForm.path_regex_text || ''}
                      onChange={(event) =>
                        setModalField('path_regex_text')(event.target.value)
                      }
                      placeholder={'/v1/chat/completions\n/v1/responses…'}
                      className={textareaClass}
                    />
                    <FieldHint>
                      {t(
                        '可选。对请求路径进行匹配；不填表示匹配所有路径。',
                      )}
                    </FieldHint>
                  </div>
                </div>

                <SwitchRow
                  label={t('失败后不重试')}
                  hint={t(
                    '开启后，若该规则命中且请求失败，将不会切换渠道重试。',
                  )}
                  value={modalForm.skip_retry_on_failure}
                  onChange={setModalField('skip_retry_on_failure')}
                />

                {/* 高级设置 */}
                <details
                  className='group rounded-xl border border-border bg-background'
                  open={modalAdvancedOpen}
                  onToggle={(event) =>
                    setModalAdvancedOpen(event.currentTarget.open)
                  }
                >
                  <summary className='flex cursor-pointer items-center justify-between gap-2 px-3 py-2 text-sm font-medium text-foreground'>
                    <span>{t('高级设置')}</span>
                    <ChevronDown
                      size={16}
                      className='text-muted transition-transform group-open:rotate-180'
                    />
                  </summary>
                  <div className='space-y-4 border-t border-border px-3 py-3'>
                    <div className='space-y-2'>
                      <FieldLabel>
                        {t('User-Agent include（每行一个，可不写）')}
                      </FieldLabel>
                      <textarea
                        rows={4}
                        value={modalForm.user_agent_include_text || ''}
                        onChange={(event) =>
                          setModalField('user_agent_include_text')(
                            event.target.value,
                          )
                        }
                        placeholder={'curl\nPostmanRuntime\nMyApp/…'}
                        className={textareaClass}
                      />
                      <FieldHint>
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
                      </FieldHint>
                    </div>

                    <div className='grid grid-cols-1 gap-4 sm:grid-cols-2'>
                      <div className='space-y-2'>
                        <FieldLabel>{t('Value 正则')}</FieldLabel>
                        <input
                          type='text'
                          value={modalForm.value_regex || ''}
                          onChange={(event) =>
                            setModalField('value_regex')(event.target.value)
                          }
                          placeholder='^[-0-9A-Za-z._:]{1,128}$'
                          className={inputClass}
                        />
                        <FieldHint>
                          {t(
                            '可选。对提取到的亲和 Key 做正则校验；不填表示不校验。',
                          )}
                        </FieldHint>
                      </div>
                      <div className='space-y-2'>
                        <FieldLabel>
                          {t('TTL（秒，0 表示默认）')}
                        </FieldLabel>
                        <input
                          type='number'
                          min={0}
                          value={modalForm.ttl_seconds ?? 0}
                          onChange={(event) => {
                            const raw = event.target.value;
                            setModalField('ttl_seconds')(
                              raw === '' ? 0 : Number(raw),
                            );
                          }}
                          placeholder='例如 600…'
                          className={inputClass}
                        />
                        <FieldHint>
                          {t('该规则的缓存保留时长；0 表示使用默认 TTL：')}
                          {effectiveDefaultTTLSeconds}
                          {t(' 秒。')}
                        </FieldHint>
                      </div>
                    </div>

                    <div className='space-y-2'>
                      <div className='text-sm font-medium text-foreground'>
                        {t('参数覆盖模板')}
                      </div>
                      <div className='text-xs text-muted'>
                        {t(
                          '命中该亲和规则后，会把此模板合并到渠道参数覆盖中（同名键由模板覆盖）。',
                        )}
                      </div>
                      <div className='rounded-xl border border-border bg-surface-secondary p-3'>
                        <div className='mb-2 flex flex-wrap items-center justify-between gap-2'>
                          <StatusChip tone={paramTemplatePreviewMeta.tagTone}>
                            {paramTemplatePreviewMeta.tagLabel}
                          </StatusChip>
                          <div className='flex flex-wrap items-center gap-2'>
                            <Button
                              size='sm'
                              color='primary'
                              startContent={<Code2 size={14} />}
                              onPress={() =>
                                setParamTemplateEditorVisible(true)
                              }
                            >
                              {t('可视化编辑')}
                            </Button>
                            <Button
                              size='sm'
                              variant='flat'
                              onPress={formatParamTemplateDraft}
                            >
                              {t('格式化')}
                            </Button>
                            <Button
                              size='sm'
                              variant='light'
                              onPress={() => updateParamTemplateDraft('')}
                            >
                              {t('清空')}
                            </Button>
                          </div>
                        </div>
                        <pre className='m-0 max-h-[220px] overflow-auto whitespace-pre-wrap break-all text-xs leading-relaxed'>
                          {paramTemplatePreviewMeta.preview}
                        </pre>
                      </div>
                    </div>

                    <div className='grid grid-cols-1 gap-4 sm:grid-cols-3'>
                      <SwitchRow
                        label={t('作用域：包含分组')}
                        hint={t(
                          '开启后，using_group 会参与 cache key（不同分组隔离）。',
                        )}
                        value={modalForm.include_using_group}
                        onChange={setModalField('include_using_group')}
                      />
                      <SwitchRow
                        label={t('作用域：包含模型名称')}
                        hint={t(
                          '开启后，模型名称会参与 cache key（不同模型隔离）。',
                        )}
                        value={modalForm.include_model_name}
                        onChange={setModalField('include_model_name')}
                      />
                      <SwitchRow
                        label={t('作用域：包含规则名称')}
                        hint={t(
                          '开启后，规则名称会参与 cache key（不同规则隔离）。',
                        )}
                        value={modalForm.include_rule_name}
                        onChange={setModalField('include_rule_name')}
                      />
                    </div>
                  </div>
                </details>

                <div className='border-t border-border pt-3' />

                <div className='flex flex-wrap items-center gap-2'>
                  <span className='text-sm font-medium text-foreground'>
                    {t('Key 来源')}
                  </span>
                  <Button
                    size='sm'
                    variant='flat'
                    startContent={<Plus size={14} />}
                    onPress={addKeySource}
                  >
                    {t('新增 Key 来源')}
                  </Button>
                </div>
                <FieldHint>
                  {t(
                    'context_int/context_string 从请求上下文读取；gjson 从入口请求的 JSON body 按 gjson path 读取。',
                  )}
                </FieldHint>
                <div className='space-y-2'>
                  <div className='text-xs text-muted'>
                    {t('常用上下文 Key（用于 context_*）')}：
                  </div>
                  <div className='flex flex-wrap gap-1.5'>
                    {CONTEXT_KEY_PRESETS.map((x) => (
                      <StatusChip key={x.key}>{x.label}</StatusChip>
                    ))}
                  </div>
                </div>

                {renderKeySourcesTable()}
              </ModalBody>
              <ModalFooter className='border-t border-border'>
                <Button variant='light' onPress={closeRuleModal}>
                  {t('取消')}
                </Button>
                <Button color='primary' onPress={handleModalSave}>
                  {t('保存')}
                </Button>
              </ModalFooter>
            </ModalDialog>
          </ModalContainer>
        </ModalBackdrop>
      </Modal>

      {/* Param-template preview modal */}
      <Modal state={previewModalState}>
        <ModalBackdrop variant='blur'>
          <ModalContainer
            size='3xl'
            placement='center'
            className='max-w-[95vw]'
          >
            <ModalDialog className='bg-background/95 backdrop-blur'>
              <ModalHeader className='border-b border-border'>
                <span>{t('参数覆盖模板预览')}</span>
              </ModalHeader>
              <ModalBody className='px-6 py-5'>
                <pre className='m-0 max-h-[420px] overflow-auto whitespace-pre-wrap break-all rounded-lg border border-border bg-surface-secondary p-3 text-xs leading-relaxed'>
                  {previewRaw}
                </pre>
              </ModalBody>
            </ModalDialog>
          </ModalContainer>
        </ModalBackdrop>
      </Modal>

      <ParamOverrideEditorModal
        visible={paramTemplateEditorVisible}
        value={paramTemplateDraft || ''}
        onSave={(nextValue) => {
          updateParamTemplateDraft(nextValue || '');
          setParamTemplateEditorVisible(false);
        }}
        onCancel={() => setParamTemplateEditorVisible(false)}
      />

      {/* Confirm dialogs */}
      <ConfirmDialog
        visible={confirmClearAll}
        title={t('确认清空全部渠道亲和性缓存')}
        cancelText={t('取消')}
        confirmText={t('确认')}
        danger
        onCancel={() => setConfirmClearAll(false)}
        onConfirm={async () => {
          setConfirmClearAll(false);
          try {
            const res = await API.delete(
              '/api/option/channel_affinity_cache',
              { params: { all: true } },
            );
            const { success, message } = res.data;
            if (!success) return showError(t(message));
            showSuccess(t('已清空'));
            await refreshCacheStats();
          } catch (error) {
            showError(t('保存失败，请重试'));
          }
        }}
      >
        {t('将删除所有仍在内存中的渠道亲和性缓存条目。')}
      </ConfirmDialog>

      <ConfirmDialog
        visible={!!confirmClearRule}
        title={t('确认清空该规则缓存')}
        cancelText={t('取消')}
        confirmText={t('确认')}
        danger
        onCancel={() => setConfirmClearRule(null)}
        onConfirm={async () => {
          const target = confirmClearRule;
          setConfirmClearRule(null);
          if (!target?.name) return;
          if (!target?.include_rule_name) {
            showWarning(
              t('该规则未启用"作用域：包含规则名称"，无法按规则清空缓存。'),
            );
            return;
          }
          try {
            const res = await API.delete(
              '/api/option/channel_affinity_cache',
              { params: { rule_name: target.name } },
            );
            const { success, message } = res.data;
            if (!success) return showError(t(message));
            showSuccess(t('已清空'));
            await refreshCacheStats();
          } catch (error) {
            showError(t('保存失败，请重试'));
          }
        }}
      >
        {confirmClearRule?.name
          ? `${t('规则')}: ${confirmClearRule.name}`
          : ''}
      </ConfirmDialog>

      <ConfirmDialog
        visible={confirmAppendTemplates}
        title={t('填充 Codex CLI / Claude CLI 模版')}
        cancelText={t('取消')}
        confirmText={t('确认')}
        onCancel={() => setConfirmAppendTemplates(false)}
        onConfirm={() => {
          setConfirmAppendTemplates(false);
          doAppendTemplates();
        }}
      >
        {t('将追加 2 条规则到现有规则列表。')}
      </ConfirmDialog>
    </>
  );
}
