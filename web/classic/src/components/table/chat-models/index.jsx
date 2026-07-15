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

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Button,
  Card,
  Checkbox,
  Form,
  Input,
  Modal,
  Select,
  Space,
  Switch,
  Table,
  Tag,
  Typography,
} from '@douyinfe/semi-ui';
import {
  IconDelete,
  IconEdit,
  IconPlus,
  IconRefresh,
  IconSearch,
} from '@douyinfe/semi-icons';
import { useTranslation } from 'react-i18next';
import { API, showError, showSuccess } from '../../../helpers';

const { Text } = Typography;

const PAGE_SIZE = 20;
const DEFAULT_API_FORMAT = 'openai-completions';
const CHAT_MODEL_API_FORMATS = [
  'openai-completions',
  'openai-responses',
  'anthropic-messages',
];
const CHAT_MODEL_INPUT_TYPES = ['text', 'image', 'video', 'audio'];
const COMMON_THINKING_LEVELS = [
  'off',
  'minimal',
  'low',
  'medium',
  'high',
  'xhigh',
];

const emptyForm = {
  model: '',
  name: '',
  input: ['text'],
  api: DEFAULT_API_FORMAT,
  contextWindow: 0,
  contextTokens: 0,
  maxTokens: 0,
  reasoning: false,
  thinkingLevels: [],
  thinkingDefault: '',
  supportsFastMode: false,
  enabled: true,
  is_auto: false,
  sort: 0,
};

function normalizeInputTypes(input) {
  const normalized = ['text'];
  for (const inputType of CHAT_MODEL_INPUT_TYPES.slice(1)) {
    if (Array.isArray(input) && input.includes(inputType)) {
      normalized.push(inputType);
    }
  }
  return normalized;
}

function normalizeApiFormat(api) {
  return CHAT_MODEL_API_FORMATS.includes(api) ? api : DEFAULT_API_FORMAT;
}

function isValidTokenLimit(value) {
  return Number.isInteger(value) && value >= 0;
}

function normalizeThinkingLevels(values) {
  const levels = [];
  const seen = new Set();
  for (const rawLevel of Array.isArray(values) ? values : []) {
    const level = rawLevel.trim().toLowerCase();
    if (level && !seen.has(level)) {
      seen.add(level);
      levels.push(level);
    }
  }
  return levels;
}

function formatPrice(price) {
  const value = Number(price);
  if (!Number.isFinite(value) || value <= 0) {
    return '-';
  }
  return `$${new Intl.NumberFormat(undefined, {
    maximumFractionDigits: 6,
  }).format(value)}`;
}

const ChatModelsTable = () => {
  const { t } = useTranslation();
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [keyword, setKeyword] = useState('');
  const [enabledFilter, setEnabledFilter] = useState('all');
  const [availableFilter, setAvailableFilter] = useState('all');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [formVersion, setFormVersion] = useState(0);
  const chatModelFormApiRef = useRef(null);
  const [candidates, setCandidates] = useState([]);
  const [knownThinkingLevels, setKnownThinkingLevels] = useState([]);
  const [batchVisible, setBatchVisible] = useState(false);
  const [batchKeyword, setBatchKeyword] = useState('');
  const [selectedBatchModels, setSelectedBatchModels] = useState([]);
  const [batchSaving, setBatchSaving] = useState(false);

  const loadModels = async (nextPage = page, overrides = {}) => {
    setLoading(true);
    try {
      const nextKeyword =
        overrides.keyword !== undefined ? overrides.keyword : keyword;
      const nextEnabledFilter =
        overrides.enabledFilter !== undefined
          ? overrides.enabledFilter
          : enabledFilter;
      const nextAvailableFilter =
        overrides.availableFilter !== undefined
          ? overrides.availableFilter
          : availableFilter;
      const params = {
        p: nextPage,
        page_size: PAGE_SIZE,
      };
      if (nextKeyword.trim()) {
        params.keyword = nextKeyword.trim();
      }
      if (nextEnabledFilter !== 'all') {
        params.enabled = nextEnabledFilter === 'enabled';
      }
      if (nextAvailableFilter !== 'all') {
        params.available = nextAvailableFilter === 'available';
      }
      const res = await API.get('/api/chat-models/', { params });
      const { success, message, data } = res.data || {};
      if (!success) {
        showError(message || t('获取对话模型列表失败'));
        return;
      }
      const rows = data?.items || [];
      setItems(Array.isArray(rows) ? rows : []);
      setTotal(data?.total || 0);
      setPage(data?.page || nextPage);
    } catch (error) {
      showError(error.response?.data?.message || t('获取对话模型列表失败'));
    } finally {
      setLoading(false);
    }
  };

  const loadCandidates = async () => {
    try {
      const res = await API.get('/api/chat-models/candidates');
      const { success, data } = res.data || {};
      if (success) {
        setCandidates(Array.isArray(data?.items) ? data.items : []);
      }
    } catch (_) {}
  };

  const loadThinkingLevels = async () => {
    try {
      const res = await API.get('/api/chat-models/thinking-levels');
      const { success, data } = res.data || {};
      if (success) {
        setKnownThinkingLevels(
          normalizeThinkingLevels(Array.isArray(data?.items) ? data.items : []),
        );
      }
    } catch (_) {}
  };

  useEffect(() => {
    loadModels(1);
    loadCandidates();
    loadThinkingLevels();
  }, []);

  const candidateOptions = useMemo(
    () =>
      candidates.map((candidate) => ({
        value: candidate.model,
        label: `${candidate.model} · ${formatPrice(candidate.price)}${
          candidate.configured ? ` · ${t('已配置')}` : ''
        }`,
      })),
    [candidates, t],
  );
  const modelOptions = useMemo(() => {
    const editingModel = editing?.model;
    if (
      !editingModel ||
      candidateOptions.some((option) => option.value === editingModel)
    ) {
      return candidateOptions;
    }
    return [
      {
        value: editingModel,
        label:
          editing.name && editing.name !== editingModel
            ? `${editingModel} · ${editing.name}`
            : editingModel,
      },
      ...candidateOptions,
    ];
  }, [candidateOptions, editing]);
  const batchCandidates = useMemo(() => {
    const normalizedKeyword = batchKeyword.trim().toLowerCase();
    return candidates.filter((candidate) => {
      if (candidate.configured) return false;
      if (!normalizedKeyword) return true;
      return String(candidate.model || '')
        .toLowerCase()
        .includes(normalizedKeyword);
    });
  }, [batchKeyword, candidates]);
  const selectedBatchModelSet = useMemo(
    () => new Set(selectedBatchModels),
    [selectedBatchModels],
  );
  const inputTypeOptions = useMemo(
    () => [
      { value: 'text', label: t('文本'), disabled: true },
      { value: 'image', label: t('图片') },
      { value: 'video', label: t('视频') },
      { value: 'audio', label: t('音频') },
    ],
    [t],
  );
  const apiFormatOptions = useMemo(
    () => CHAT_MODEL_API_FORMATS.map((api) => ({ value: api, label: api })),
    [],
  );
  const thinkingLevelOptions = useMemo(
    () =>
      normalizeThinkingLevels([
        ...COMMON_THINKING_LEVELS,
        ...knownThinkingLevels,
        ...form.thinkingLevels,
      ]).map((level) => ({ value: level, label: level })),
    [form.thinkingLevels, knownThinkingLevels],
  );
  const thinkingDefaultOptions = useMemo(
    () => form.thinkingLevels.map((level) => ({ value: level, label: level })),
    [form.thinkingLevels],
  );
  const recommendedContextTokens = useMemo(() => {
    const contextWindow = Number(form.contextWindow);
    if (!Number.isInteger(contextWindow) || contextWindow <= 0) {
      return null;
    }
    return {
      min: new Intl.NumberFormat().format(Math.floor(contextWindow * 0.75)),
      max: new Intl.NumberFormat().format(Math.floor(contextWindow * 0.8)),
    };
  }, [form.contextWindow]);

  const openCreate = () => {
    setEditing(null);
    setForm({ ...emptyForm });
    setFormVersion((version) => version + 1);
    setModalVisible(true);
    loadCandidates();
    loadThinkingLevels();
  };

  const openBatchCreate = () => {
    setSelectedBatchModels([]);
    setBatchKeyword('');
    setBatchVisible(true);
    loadCandidates();
  };

  const openEdit = (record) => {
    setEditing(record);
    setForm({
      model: record.model || '',
      name: record.name || '',
      input: normalizeInputTypes(record.input),
      api: normalizeApiFormat(record.api),
      contextWindow: record.contextWindow ?? 0,
      contextTokens: record.contextTokens ?? 0,
      maxTokens: record.maxTokens ?? 0,
      reasoning: Boolean(record.reasoning),
      thinkingLevels: normalizeThinkingLevels(record.thinkingLevels),
      thinkingDefault: record.thinkingDefault || '',
      supportsFastMode: Boolean(record.supportsFastMode),
      enabled: Boolean(record.enabled),
      is_auto: Boolean(record.is_auto),
      sort: record.sort ?? 0,
    });
    setFormVersion((version) => version + 1);
    setModalVisible(true);
    loadCandidates();
    loadThinkingLevels();
  };

  const updateForm = (key, value) => {
    setForm((current) => ({
      ...current,
      [key]: value,
    }));
  };

  const submit = async () => {
    const modelName = String(form.model || '').trim();
    if (!modelName) {
      showError(t('请选择模型'));
      return;
    }
    const contextWindow = Number(form.contextWindow);
    const contextTokens = Number(form.contextTokens);
    const maxTokens = Number(form.maxTokens);
    if (
      !isValidTokenLimit(contextWindow) ||
      !isValidTokenLimit(contextTokens) ||
      !isValidTokenLimit(maxTokens)
    ) {
      showError(t('Token 限制必须是非负整数'));
      return;
    }
    if (contextWindow > 0 && contextTokens > contextWindow) {
      showError(t('上下文预算不能大于上下文窗口'));
      return;
    }
    if (contextWindow > 0 && maxTokens > contextWindow) {
      showError(t('最大输出 Token 不能大于上下文窗口'));
      return;
    }
    const thinkingLevels = normalizeThinkingLevels(form.thinkingLevels);
    const thinkingDefault = String(form.thinkingDefault || '')
      .trim()
      .toLowerCase();
    if (thinkingDefault && !thinkingLevels.includes(thinkingDefault)) {
      showError(t('默认思考深度必须包含在思考深度列表中'));
      return;
    }

    setSaving(true);
    try {
      const payload = {
        model: modelName,
        name: String(form.name || '').trim(),
        input: normalizeInputTypes(form.input),
        api: normalizeApiFormat(form.api),
        contextWindow,
        contextTokens,
        maxTokens,
        reasoning: Boolean(form.reasoning),
        thinkingLevels,
        thinkingDefault,
        supportsFastMode: Boolean(form.supportsFastMode),
        enabled: Boolean(form.enabled),
        is_auto: Boolean(form.is_auto),
        sort: Number.isFinite(Number(form.sort)) ? Number(form.sort) : 0,
      };
      const res = editing
        ? await API.patch(`/api/chat-models/${editing.id}`, payload)
        : await API.post('/api/chat-models/', payload);
      const { success, message } = res.data || {};
      if (!success) {
        showError(message || t('操作失败'));
        return;
      }
      showSuccess(editing ? t('对话模型已更新') : t('对话模型已创建'));
      setModalVisible(false);
      await loadModels(editing ? page : 1);
      await loadCandidates();
      await loadThinkingLevels();
    } catch (error) {
      showError(error.response?.data?.message || t('操作失败'));
    } finally {
      setSaving(false);
    }
  };

  const quickUpdate = async (record, payload) => {
    try {
      const res = await API.patch(`/api/chat-models/${record.id}`, payload);
      const { success, message } = res.data || {};
      if (!success) {
        showError(message || t('更新失败'));
        return;
      }
      showSuccess(t('对话模型已更新'));
      await loadModels(page);
      await loadCandidates();
    } catch (error) {
      showError(error.response?.data?.message || t('更新失败'));
    }
  };

  const toggleBatchModel = (modelName, checked) => {
    setSelectedBatchModels((current) => {
      if (checked) {
        return current.includes(modelName) ? current : [...current, modelName];
      }
      return current.filter((item) => item !== modelName);
    });
  };

  const getCheckboxChecked = (event) =>
    Boolean(event?.target?.checked ?? event?.checked ?? event);

  const selectFilteredBatchModels = () => {
    const filteredModels = batchCandidates.map((candidate) => candidate.model);
    setSelectedBatchModels((current) => [
      ...current,
      ...filteredModels.filter((modelName) => !current.includes(modelName)),
    ]);
  };

  const selectAllBatchModels = () => {
    setSelectedBatchModels(
      candidates
        .filter((candidate) => !candidate.configured)
        .map((candidate) => candidate.model),
    );
  };

  const clearFilteredBatchModels = () => {
    const filteredModels = new Set(
      batchCandidates.map((candidate) => candidate.model),
    );
    setSelectedBatchModels((current) =>
      current.filter((modelName) => !filteredModels.has(modelName)),
    );
  };

  const submitBatch = async () => {
    if (selectedBatchModels.length === 0) {
      showError(t('请至少选择一个模型'));
      return;
    }

    setBatchSaving(true);
    try {
      const res = await API.post('/api/chat-models/batch', {
        models: selectedBatchModels,
      });
      const { success, message, data } = res.data || {};
      if (!success) {
        showError(message || t('批量添加对话模型失败'));
        return;
      }
      showSuccess(
        t('批量添加 {{created}} 个对话模型，跳过 {{skipped}} 个', {
          created: data?.created_count || 0,
          skipped: data?.skipped_count || 0,
        }),
      );
      setBatchVisible(false);
      setSelectedBatchModels([]);
      setBatchKeyword('');
      await loadModels(1);
      await loadCandidates();
    } catch (error) {
      showError(error.response?.data?.message || t('批量添加对话模型失败'));
    } finally {
      setBatchSaving(false);
    }
  };

  const remove = (record) => {
    Modal.confirm({
      title: t('删除对话模型'),
      content: t('确认删除 {{name}}？', { name: record.name || record.model }),
      okText: t('删除'),
      cancelText: t('取消'),
      okButtonProps: { type: 'danger' },
      onOk: async () => {
        try {
          const res = await API.delete(`/api/chat-models/${record.id}`);
          const { success, message } = res.data || {};
          if (!success) {
            showError(message || t('删除失败'));
            return;
          }
          showSuccess(t('对话模型已删除'));
          await loadModels(page);
          await loadCandidates();
        } catch (error) {
          showError(error.response?.data?.message || t('删除失败'));
        }
      },
    });
  };

  const columns = [
    {
      title: t('模型'),
      dataIndex: 'model',
      render: (value) => (
        <Text code copyable={{ content: value }}>
          {value}
        </Text>
      ),
    },
    {
      title: t('展示名称'),
      dataIndex: 'name',
    },
    {
      title: t('价格'),
      dataIndex: 'price',
      render: (value) => formatPrice(value),
    },
    {
      title: t('状态'),
      dataIndex: 'enabled',
      render: (value, record) => (
        <Space>
          <Switch
            size='small'
            checked={Boolean(value)}
            onChange={(checked) => quickUpdate(record, { enabled: checked })}
          />
          <Tag color={record.available ? 'green' : 'red'} shape='circle'>
            {record.available ? t('可用') : t('不可用')}
          </Tag>
        </Space>
      ),
    },
    {
      title: 'Auto',
      dataIndex: 'is_auto',
      render: (value, record) => (
        <Switch
          size='small'
          checked={Boolean(value)}
          disabled={!record.available}
          onChange={(checked) => quickUpdate(record, { is_auto: checked })}
        />
      ),
    },
    {
      title: t('排序'),
      dataIndex: 'sort',
      width: 90,
    },
    {
      title: t('操作'),
      dataIndex: 'operate',
      width: 130,
      render: (_, record) => (
        <Space>
          <Button
            size='small'
            theme='borderless'
            icon={<IconEdit />}
            onClick={() => openEdit(record)}
          />
          <Button
            size='small'
            theme='borderless'
            type='danger'
            icon={<IconDelete />}
            onClick={() => remove(record)}
          />
        </Space>
      ),
    },
  ];

  return (
    <>
      <Card className='!rounded-lg' bordered>
        <div className='flex flex-col gap-3'>
          <div className='flex flex-col md:flex-row justify-between gap-2'>
            <Space wrap>
              <Input
                prefix={<IconSearch />}
                value={keyword}
                placeholder={t('搜索对话模型')}
                onChange={(value) => setKeyword(value)}
                onEnterPress={() => loadModels(1)}
                style={{ width: 220 }}
              />
              <Select
                value={enabledFilter}
                onChange={(value) => {
                  setEnabledFilter(value);
                  loadModels(1, { enabledFilter: value });
                }}
                style={{ width: 130 }}
              >
                <Select.Option value='all'>{t('全部状态')}</Select.Option>
                <Select.Option value='enabled'>{t('已启用')}</Select.Option>
                <Select.Option value='disabled'>{t('已禁用')}</Select.Option>
              </Select>
              <Select
                value={availableFilter}
                onChange={(value) => {
                  setAvailableFilter(value);
                  loadModels(1, { availableFilter: value });
                }}
                style={{ width: 140 }}
              >
                <Select.Option value='all'>{t('全部可用性')}</Select.Option>
                <Select.Option value='available'>{t('可用')}</Select.Option>
                <Select.Option value='unavailable'>{t('不可用')}</Select.Option>
              </Select>
              <Button icon={<IconSearch />} onClick={() => loadModels(1)}>
                {t('搜索')}
              </Button>
            </Space>
            <Space>
              <Button
                icon={<IconRefresh />}
                onClick={() => {
                  loadModels(page);
                  loadCandidates();
                }}
              >
                {t('刷新')}
              </Button>
              <Button icon={<IconPlus />} onClick={openBatchCreate}>
                {t('批量添加')}
              </Button>
              <Button theme='solid' icon={<IconPlus />} onClick={openCreate}>
                {t('添加对话模型')}
              </Button>
            </Space>
          </div>
          <Table
            rowKey='id'
            columns={columns}
            dataSource={items}
            loading={loading}
            pagination={{
              currentPage: page,
              pageSize: PAGE_SIZE,
              total,
              onPageChange: (nextPage) => loadModels(nextPage),
            }}
          />
        </div>
      </Card>

      <Modal
        visible={modalVisible}
        title={editing ? t('编辑对话模型') : t('添加对话模型')}
        onCancel={() => setModalVisible(false)}
        onOk={submit}
        confirmLoading={saving}
        okText={editing ? t('保存') : t('创建')}
        cancelText={t('取消')}
        width={700}
        bodyStyle={{ maxHeight: '72vh', overflowY: 'auto' }}
      >
        <Form
          key={formVersion}
          initValues={form}
          getFormApi={(api) => (chatModelFormApiRef.current = api)}
          labelPosition='left'
          labelWidth={120}
        >
          <Form.Select
            field='model'
            label={t('模型')}
            optionList={modelOptions}
            filter
            onChange={(value) => {
              const selected = candidates.find((item) => item.model === value);
              const shouldSyncName = !form.name || form.name === form.model;
              const nextName = shouldSyncName
                ? selected?.name || value || ''
                : form.name;
              setForm((current) => ({
                ...current,
                model: value,
                name: nextName,
              }));
              if (shouldSyncName) {
                chatModelFormApiRef.current?.setValue('name', nextName);
              }
            }}
            placeholder={t('请选择模型')}
            style={{ width: '100%' }}
          />
          <Form.Input
            field='name'
            label={t('展示名称')}
            onChange={(value) => updateForm('name', value)}
          />
          <Form.Select
            field='api'
            label={t('API 格式')}
            optionList={apiFormatOptions}
            onChange={(value) => updateForm('api', normalizeApiFormat(value))}
            style={{ width: '100%' }}
          />
          <Form.Select
            field='input'
            label={t('输入类型')}
            optionList={inputTypeOptions}
            multiple
            onChange={(value) => {
              const normalized = normalizeInputTypes(value);
              updateForm('input', normalized);
              chatModelFormApiRef.current?.setValue('input', normalized);
            }}
            extraText={t('文本输入为必选，其他类型可多选')}
            style={{ width: '100%' }}
          />
          <Form.InputNumber
            field='contextWindow'
            label={t('上下文窗口')}
            min={0}
            precision={0}
            onChange={(value) => updateForm('contextWindow', Number(value))}
            extraText={t(
              '建议按模型官方公布的原生上下文窗口填写；0 表示未配置',
            )}
          />
          <Form.InputNumber
            field='contextTokens'
            label={t('有效上下文上限')}
            min={0}
            precision={0}
            onChange={(value) => updateForm('contextTokens', Number(value))}
            extraText={
              recommendedContextTokens
                ? t(
                    '这是 Token 容量，不是价格；建议为原生窗口的 75%–80%（{{min}}–{{max}} Token）；0 表示不额外限制',
                    recommendedContextTokens,
                  )
                : t(
                    '这是 Token 容量，不是价格；建议为原生窗口的 75%–80%；0 表示不额外限制',
                  )
            }
          />
          <Form.InputNumber
            field='maxTokens'
            label={t('最大输出 Token')}
            min={0}
            precision={0}
            onChange={(value) => updateForm('maxTokens', Number(value))}
            extraText={t('建议按模型官方公布的最大输出填写；0 表示未配置')}
          />
          <Form.Select
            field='thinkingLevels'
            label={t('思考深度')}
            placeholder={t('请选择，或输入新档位后按 Enter')}
            multiple
            filter
            allowCreate
            optionList={thinkingLevelOptions}
            onChange={(value) => {
              const thinkingLevels = normalizeThinkingLevels(value);
              const thinkingDefault = thinkingLevels.includes(
                form.thinkingDefault,
              )
                ? form.thinkingDefault
                : '';
              setForm((current) => ({
                ...current,
                thinkingLevels,
                thinkingDefault,
              }));
              chatModelFormApiRef.current?.setValue(
                'thinkingLevels',
                thinkingLevels,
              );
              if (!thinkingDefault) {
                chatModelFormApiRef.current?.setValue('thinkingDefault', '');
              }
            }}
            extraText={t(
              '从常用档位或已有配置中多选；Provider 有新档位时可输入并按 Enter 添加。留空时沿用“推理模型”开关',
            )}
          />
          <Form.Select
            field='thinkingDefault'
            label={t('默认思考深度')}
            placeholder={t('请选择默认深度')}
            optionList={thinkingDefaultOptions}
            showClear
            disabled={form.thinkingLevels.length === 0}
            onChange={(value) => updateForm('thinkingDefault', value || '')}
            extraText={t('默认值只能从已选择的思考深度中设置')}
          />
          <Form.InputNumber
            field='sort'
            label={t('排序')}
            onChange={(value) => updateForm('sort', value)}
          />
          <Form.Switch
            field='enabled'
            label={t('启用')}
            onChange={(checked) => updateForm('enabled', checked)}
          />
          <Form.Switch
            field='is_auto'
            label='Auto'
            onChange={(checked) => updateForm('is_auto', checked)}
          />
          <Form.Switch
            field='reasoning'
            label={t('推理模型')}
            onChange={(checked) => updateForm('reasoning', checked)}
          />
          <Form.Switch
            field='supportsFastMode'
            label={t('支持快速模式')}
            onChange={(checked) => updateForm('supportsFastMode', checked)}
          />
        </Form>
      </Modal>

      <Modal
        visible={batchVisible}
        title={t('批量添加对话模型')}
        onCancel={() => setBatchVisible(false)}
        onOk={submitBatch}
        confirmLoading={batchSaving}
        okText={t('添加为禁用')}
        cancelText={t('取消')}
        okButtonProps={{ disabled: selectedBatchModels.length === 0 }}
        width={720}
      >
        <div className='flex flex-col gap-3'>
          <Text type='tertiary'>{t('选中的对话模型会以禁用状态添加。')}</Text>
          <div className='flex flex-col md:flex-row justify-between gap-2'>
            <Input
              prefix={<IconSearch />}
              value={batchKeyword}
              placeholder={t('搜索可用模型')}
              onChange={(value) => setBatchKeyword(value)}
              style={{ width: 240 }}
            />
            <Space>
              <Button
                onClick={selectAllBatchModels}
                disabled={candidates.every((candidate) => candidate.configured)}
              >
                {t('全选')}
              </Button>
              <Button
                onClick={selectFilteredBatchModels}
                disabled={batchCandidates.length === 0}
              >
                {t('选择过滤结果')}
              </Button>
              <Button
                onClick={clearFilteredBatchModels}
                disabled={batchCandidates.length === 0}
              >
                {t('清空过滤结果')}
              </Button>
            </Space>
          </div>
          <div
            className='overflow-auto rounded-md bg-gray-50/70 p-1'
            style={{ maxHeight: 360 }}
          >
            {batchCandidates.length === 0 ? (
              <div className='py-12 text-center'>
                <Text type='tertiary'>{t('所有可用对话模型都已配置。')}</Text>
              </div>
            ) : (
              batchCandidates.map((candidate) => {
                const checked = selectedBatchModelSet.has(candidate.model);
                return (
                  <div
                    key={candidate.model}
                    role='checkbox'
                    aria-checked={checked}
                    tabIndex={0}
                    className='flex items-center gap-3 rounded-md px-3 py-2 cursor-pointer hover:bg-white'
                    onClick={() => toggleBatchModel(candidate.model, !checked)}
                    onKeyDown={(event) => {
                      if (event.key !== 'Enter' && event.key !== ' ') return;
                      event.preventDefault();
                      toggleBatchModel(candidate.model, !checked);
                    }}
                  >
                    <span
                      onClick={(event) => event.stopPropagation()}
                      onKeyDown={(event) => event.stopPropagation()}
                    >
                      <Checkbox
                        checked={checked}
                        onChange={(event) =>
                          toggleBatchModel(
                            candidate.model,
                            getCheckboxChecked(event),
                          )
                        }
                      />
                    </span>
                    <div className='min-w-0 flex-1'>
                      <div className='truncate font-mono text-xs'>
                        {candidate.model}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
          <Text type='tertiary'>
            {t('已选择 {{count}} 个模型', {
              count: selectedBatchModels.length,
            })}
          </Text>
        </div>
      </Modal>
    </>
  );
};

export default ChatModelsTable;
