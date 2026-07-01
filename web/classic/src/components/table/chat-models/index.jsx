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

const emptyForm = {
  model: '',
  name: '',
  enabled: true,
  is_auto: false,
  sort: 0,
};

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
  const [candidates, setCandidates] = useState([]);
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

  useEffect(() => {
    loadModels(1);
    loadCandidates();
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

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setModalVisible(true);
    loadCandidates();
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
      model: record.model,
      name: record.name,
      enabled: record.enabled,
      is_auto: record.is_auto,
      sort: record.sort,
    });
    setModalVisible(true);
    loadCandidates();
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

    setSaving(true);
    try {
      const payload = {
        model: modelName,
        name: String(form.name || '').trim(),
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
      >
        <Form labelPosition='left' labelWidth={90}>
          <Form.Select
            field='model'
            label={t('模型')}
            value={form.model}
            optionList={candidateOptions}
            filter
            onChange={(value) => {
              const selected = candidates.find((item) => item.model === value);
              setForm((current) => ({
                ...current,
                model: value,
                name:
                  !current.name || current.name === current.model
                    ? selected?.name || value || ''
                    : current.name,
              }));
            }}
            placeholder={t('请选择模型')}
          />
          <Form.Input
            field='name'
            label={t('展示名称')}
            value={form.name}
            onChange={(value) => updateForm('name', value)}
          />
          <Form.InputNumber
            field='sort'
            label={t('排序')}
            value={form.sort}
            onChange={(value) => updateForm('sort', value)}
          />
          <Form.Switch
            field='enabled'
            label={t('启用')}
            checked={form.enabled}
            onChange={(checked) => updateForm('enabled', checked)}
          />
          <Form.Switch
            field='is_auto'
            label='Auto'
            checked={form.is_auto}
            onChange={(checked) => updateForm('is_auto', checked)}
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
