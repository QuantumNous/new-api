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

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import dayjs from 'dayjs';
import {
  Banner,
  Button,
  Card,
  Checkbox,
  Divider,
  Input,
  Modal,
  Popconfirm,
  Select,
  Space,
  Spin,
  Table,
  Tag,
  Typography,
} from '@douyinfe/semi-ui';
import {
  IconDownload,
  IconRefresh,
  IconSave,
  IconSearch,
} from '@douyinfe/semi-icons';
import { API, showError, showSuccess } from '../../../helpers';
import CostReportSpreadsheetPreview from './CostReportSpreadsheetPreview';

const API_BASE = '/api/cost_reports';
const DATE_FORMAT = 'YYYY-MM-DD';
const CELL_KEY_SEPARATOR = '\u001f';

const FIELD_KEY_RE = /^[a-z][a-z0-9_]{0,63}$/;

const FIELD_KIND_OPTIONS = [
  { label: '手动填写', value: 'manual' },
  { label: '公式计算', value: 'formula' },
  { label: '统计字段', value: 'metric' },
  { label: '维度字段', value: 'dimension' },
];

const VALUE_TYPE_OPTIONS = [
  { label: '文本', value: 'string' },
  { label: '整数', value: 'integer' },
  { label: '小数', value: 'decimal' },
  { label: '金额', value: 'currency' },
  { label: '百分比', value: 'percent' },
  { label: '日期', value: 'date' },
];

const DIMENSION_SOURCE_OPTIONS = [
  { label: '序号', value: 'generated.row_index' },
  { label: '报表日期', value: 'period.date' },
  { label: '客户名称', value: 'log.username' },
  { label: '用户 ID', value: 'log.user_id' },
  { label: '渠道 ID', value: 'log.channel_id' },
  { label: '模型名称', value: 'log.model_name' },
  { label: '分组', value: 'log.group' },
  { label: '渠道分类', value: 'classification.output' },
  { label: '渠道名称', value: 'channel.name' },
  { label: '渠道类型', value: 'channel.type' },
  { label: '用户显示名', value: 'user.display_name' },
];

const METRIC_SOURCE_OPTIONS = [
  { label: '日志时间', value: 'log.created_at' },
  { label: '原始额度', value: 'log.quota' },
  { label: '折算额度', value: 'log.quota_per_unit' },
  { label: '提示词 Tokens', value: 'log.prompt_tokens' },
  { label: '补全 Tokens', value: 'log.completion_tokens' },
  { label: '总 Tokens', value: 'log.total_tokens' },
  { label: '请求数', value: 'log.request_count' },
];

const AGGREGATE_OPTIONS = [
  { label: '求和', value: 'sum' },
  { label: '计数', value: 'count' },
  { label: '平均', value: 'avg' },
  { label: '最小', value: 'min' },
  { label: '最大', value: 'max' },
];

const FORMULA_MODE_OPTIONS = [
  { label: '普通公式', value: 'standard' },
  { label: '连续余额公式', value: 'running' },
];

const getResponseData = (res, fallbackMessage) => {
  if (!res?.data?.success) {
    throw new Error(res?.data?.message || fallbackMessage || '请求失败');
  }
  return res.data.data;
};

const toDateInput = (value) => dayjs(value).format(DATE_FORMAT);

const defaultPeriod = () => {
  const today = dayjs();
  return {
    startDate: today.startOf('month').format(DATE_FORMAT),
    endDate: today.format(DATE_FORMAT),
    periodKey: today.format('YYYY-MM'),
  };
};

const buildPeriodPayload = ({ startDate, endDate, periodKey }) => {
  const start = dayjs(startDate).startOf('day');
  const end = dayjs(endDate).add(1, 'day').startOf('day');
  return {
    period_start: start.unix(),
    period_end: end.unix(),
    period_key:
      periodKey?.trim() ||
      (start.isSame(dayjs(endDate), 'day')
        ? start.format(DATE_FORMAT)
        : `${start.format(DATE_FORMAT)}_${dayjs(endDate).format(DATE_FORMAT)}`),
  };
};

const sortedFields = (config, visibleOnly = true) => {
  const fields = Array.isArray(config?.fields) ? config.fields : [];
  return fields
    .filter((field) => !visibleOnly || field.visible !== false)
    .slice()
    .sort((a, b) => (a.order || 0) - (b.order || 0));
};

const isEditableField = (field) =>
  field?.kind === 'manual' || (field?.kind === 'formula' && field?.manual_override);

const manualDraftKey = (rowKey, fieldKey) => `${rowKey}${CELL_KEY_SEPARATOR}${fieldKey}`;

const splitManualDraftKey = (key) => {
  const [rowKey, fieldKey] = key.split(CELL_KEY_SEPARATOR);
  return { rowKey, fieldKey };
};

const formatValue = (value, field) => {
  if (value === null || value === undefined || value === '') return '';
  if (field?.value_type === 'date') {
    if (typeof value === 'number') return dayjs.unix(value).format('YYYY-MM-DD HH:mm:ss');
    return String(value);
  }
  if (['currency', 'decimal'].includes(field?.value_type)) {
    const n = Number(value);
    return Number.isFinite(n) ? n.toLocaleString(undefined, { maximumFractionDigits: 6 }) : String(value);
  }
  if (field?.value_type === 'percent') {
    const n = Number(value);
    return Number.isFinite(n) ? `${(n * 100).toFixed(2)}%` : String(value);
  }
  return String(value);
};

const fieldKindLabel = (kind) => {
  const labels = {
    dimension: '维度',
    metric: '统计',
    manual: '手动填写',
    formula: '公式计算',
  };
  return labels[kind] || kind || '-';
};

const valueTypeLabel = (type) => {
  const labels = {
    string: '文本',
    integer: '整数',
    decimal: '小数',
    currency: '金额',
    percent: '百分比',
    date: '日期',
  };
  return labels[type] || type || '-';
};

const cloneConfig = (config) => JSON.parse(JSON.stringify(config || {}));

const normalizeFieldOrders = (fields) =>
  fields.map((field, index) => ({ ...field, order: (index + 1) * 10 }));

const emptyFieldDraft = (order = 10) => ({
  key: '',
  label: '',
  kind: 'manual',
  value_type: 'string',
  source: '',
  aggregate: 'sum',
  expression: '',
  initial_expression: '',
  formula_mode: 'standard',
  visible: true,
  exportable: true,
  manual_override: false,
  order,
});

const normalizeFieldForSave = (draft) => {
  const field = {
    key: String(draft.key || '').trim(),
    label: String(draft.label || '').trim(),
    kind: draft.kind || 'manual',
    value_type: draft.value_type || 'string',
    visible: draft.visible !== false,
    exportable: draft.exportable !== false,
    order: Number(draft.order) || 0,
  };
  if (field.kind === 'dimension') {
    field.source = draft.source || 'log.username';
  }
  if (field.kind === 'metric') {
    field.source = draft.source || 'log.quota_per_unit';
    field.aggregate = draft.aggregate || 'sum';
  }
  if (field.kind === 'formula') {
    field.expression = String(draft.expression || '').trim();
    field.formula_mode = draft.formula_mode || 'standard';
    if (field.formula_mode === 'running') {
      field.initial_expression = String(draft.initial_expression || '').trim();
    }
    if (draft.manual_override) {
      field.manual_override = true;
    }
  }
  if (draft.generated) {
    field.generated = true;
  }
  return field;
};

const buildDraftsFromRows = (rows, fields) => {
  const drafts = {};
  rows.forEach((row) => {
    fields.filter(isEditableField).forEach((field) => {
      const value = row?.values?.[field.key];
      drafts[manualDraftKey(row.row_key, field.key)] = value === undefined || value === null ? '' : String(value);
    });
  });
  return drafts;
};

const CostReportsPage = () => {
  const initialPeriod = useMemo(defaultPeriod, []);
  const [loading, setLoading] = useState(false);
  const [templateLoading, setTemplateLoading] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [manualSaving, setManualSaving] = useState(false);
  const [runSaving, setRunSaving] = useState(false);
  const [templates, setTemplates] = useState([]);
  const [templateDetail, setTemplateDetail] = useState(null);
  const [snapshotConfig, setSnapshotConfig] = useState(null);
  const [period, setPeriod] = useState(initialPeriod);
  const [maxLogs, setMaxLogs] = useState('');
  const [preview, setPreview] = useState(null);
  const [selectedRun, setSelectedRun] = useState(null);
  const [runs, setRuns] = useState([]);
  const [runTotal, setRunTotal] = useState(0);
  const [manualDrafts, setManualDrafts] = useState({});
  const [dirtyManualKeys, setDirtyManualKeys] = useState(new Set());
  const [configDraft, setConfigDraft] = useState(null);
  const [configDirty, setConfigDirty] = useState(false);
  const [fieldModalVisible, setFieldModalVisible] = useState(false);
  const [previewModalVisible, setPreviewModalVisible] = useState(false);
  const [fieldSectionExpanded, setFieldSectionExpanded] = useState(false);
  const [editingFieldKey, setEditingFieldKey] = useState('');
  const [fieldDraft, setFieldDraft] = useState(emptyFieldDraft());

  const currentTemplate = templateDetail?.template;
  const currentVersion = templateDetail?.current_version;
  const parsedConfig = useMemo(
    () => snapshotConfig || configDraft || templateDetail?.config || null,
    [configDraft, snapshotConfig, templateDetail?.config],
  );
  const visibleFields = useMemo(() => sortedFields(parsedConfig, true), [parsedConfig]);
  const allFields = useMemo(() => sortedFields(parsedConfig, false), [parsedConfig]);
  const editableFields = useMemo(() => visibleFields.filter(isEditableField), [visibleFields]);

  const setTemplate = useCallback((detail) => {
    setTemplateDetail(detail);
    setConfigDraft(cloneConfig(detail?.config || {}));
    setConfigDirty(false);
    setSnapshotConfig(null);
  }, []);

  const loadTemplates = useCallback(async () => {
    const data = getResponseData(
      await API.get(`${API_BASE}/templates`, { params: { page_size: 100 }, disableDuplicate: true }),
      '加载模板列表失败',
    );
    const items = data?.items || [];
    setTemplates(items);
    return items;
  }, []);

  const loadRuns = useCallback(
    async (templateId = currentTemplate?.id, nextPeriodKey = period.periodKey) => {
      if (!templateId) return;
      const data = getResponseData(
        await API.get(`${API_BASE}/runs`, {
          params: {
            template_id: templateId,
            period_key: nextPeriodKey || undefined,
            page_size: 20,
          },
          disableDuplicate: true,
        }),
        '加载历史快照失败',
      );
      setRuns(data?.items || []);
      setRunTotal(data?.total || 0);
    },
    [currentTemplate?.id, period.periodKey],
  );

  const ensureDefaultTemplate = useCallback(async () => {
    setTemplateLoading(true);
    try {
      const detail = getResponseData(
        await API.post(`${API_BASE}/templates/default`, {}),
        '初始化默认模板失败',
      );
      setTemplate(detail);
      await loadTemplates();
      await loadRuns(detail?.template?.id, period.periodKey);
      showSuccess('默认模板已更新');
    } catch (error) {
      showError(error);
    } finally {
      setTemplateLoading(false);
    }
  }, [loadRuns, loadTemplates, period.periodKey, setTemplate]);

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      try {
        const items = await loadTemplates();
        if (items.length > 0) {
          const detail = getResponseData(
            await API.get(`${API_BASE}/templates/${items[0].template.id}`),
            '加载模板失败',
          );
          setTemplate(detail);
          await loadRuns(detail?.template?.id, initialPeriod.periodKey);
        } else {
          await ensureDefaultTemplate();
        }
      } catch (error) {
        showError(error);
      } finally {
        setLoading(false);
      }
    };
    init();
  }, []);

  const selectTemplate = async (templateId) => {
    setTemplateLoading(true);
    try {
      const detail = getResponseData(
        await API.get(`${API_BASE}/templates/${templateId}`),
        '加载模板失败',
      );
      setTemplate(detail);
      setPreview(null);
      setSelectedRun(null);
      await loadRuns(templateId, period.periodKey);
    } catch (error) {
      showError(error);
    } finally {
      setTemplateLoading(false);
    }
  };

  const applyConfigFields = (updater) => {
    if (selectedRun) {
      showError('当前正在查看历史快照，不能修改模板字段');
      return;
    }
    const base = cloneConfig(configDraft || templateDetail?.config || {});
    const fields = sortedFields(base, false);
    const nextFields = normalizeFieldOrders(updater(fields));
    const fieldKeys = new Set(nextFields.map((field) => field.key));
    base.fields = nextFields;
    base.grouping = (base.grouping || []).filter((key) => fieldKeys.has(key));
    base.sort = (base.sort || []).filter((rule) => fieldKeys.has(rule.field));
    setConfigDraft(base);
    setConfigDirty(true);
    setPreview(null);
    setSelectedRun(null);
    setManualDrafts({});
    setDirtyManualKeys(new Set());
  };

  const openAddField = () => {
    const nextOrder = ((allFields[allFields.length - 1]?.order || allFields.length * 10) + 10);
    setEditingFieldKey('');
    setFieldDraft(emptyFieldDraft(nextOrder));
    setFieldModalVisible(true);
  };

  const openEditField = (field) => {
    setEditingFieldKey(field.key);
    setFieldDraft({
      ...emptyFieldDraft(field.order || 10),
      ...field,
      formula_mode: field.formula_mode || 'standard',
      aggregate: field.aggregate || 'sum',
      visible: field.visible !== false,
      exportable: field.exportable !== false,
      manual_override: !!field.manual_override,
    });
    setFieldModalVisible(true);
  };

  const saveFieldDraft = () => {
    const field = normalizeFieldForSave(fieldDraft);
    if (!FIELD_KEY_RE.test(field.key)) {
      showError('字段标识必须以小写字母开头，只能包含小写字母、数字和下划线');
      return;
    }
    if (!field.label) {
      showError('请填写字段名称');
      return;
    }
    if (field.kind === 'formula' && !field.expression) {
      showError('公式字段必须填写计算公式');
      return;
    }
    if (field.kind === 'formula' && field.formula_mode === 'running' && !field.initial_expression) {
      showError('连续余额公式必须填写初始公式');
      return;
    }
    const duplicate = allFields.some((item) => item.key === field.key && item.key !== editingFieldKey);
    if (duplicate) {
      showError('字段标识已存在');
      return;
    }
    applyConfigFields((fields) => {
      if (editingFieldKey) {
        return fields.map((item) => (item.key === editingFieldKey ? { ...field, order: item.order } : item));
      }
      return [...fields, field];
    });
    setFieldModalVisible(false);
  };

  const deleteField = (fieldKey) => {
    applyConfigFields((fields) => fields.filter((field) => field.key !== fieldKey));
  };

  const moveField = (fieldKey, direction) => {
    applyConfigFields((fields) => {
      const index = fields.findIndex((field) => field.key === fieldKey);
      const targetIndex = index + direction;
      if (index < 0 || targetIndex < 0 || targetIndex >= fields.length) {
        return fields;
      }
      const next = fields.slice();
      [next[index], next[targetIndex]] = [next[targetIndex], next[index]];
      return next;
    });
  };

  const saveTemplateDraft = async () => {
    if (!currentTemplate?.id) return;
    if (!configDirty) {
      showSuccess('字段配置没有修改');
      return;
    }
    setTemplateLoading(true);
    try {
      const detail = getResponseData(
        await API.put(`${API_BASE}/templates/${currentTemplate.id}`, {
          key: currentTemplate.key,
          name: currentTemplate.name,
          description: currentTemplate.description,
          status: currentTemplate.status || 1,
          config: configDraft,
        }),
        '保存字段配置失败',
      );
      setTemplate(detail);
      await loadTemplates();
      showSuccess('字段配置已保存为模板新版本');
    } catch (error) {
      showError(error);
    } finally {
      setTemplateLoading(false);
    }
  };

  const previewReport = async () => {
    if (!currentTemplate?.id) {
      showError('请先初始化或选择模板');
      return;
    }
    setPreviewLoading(true);
    try {
      const periodPayload = buildPeriodPayload(period);
      const data = getResponseData(
        await API.post(`${API_BASE}/preview`, {
          template_id: currentTemplate.id,
          template_version_id: currentVersion?.id || 0,
          config: configDirty ? configDraft : undefined,
          ...periodPayload,
          include_manual: true,
          max_logs: maxLogs ? Number(maxLogs) : undefined,
        }),
        '预览报表失败',
      );
      setPreview(data);
      setSelectedRun(null);
      setSnapshotConfig(null);
      setPeriod((prev) => ({ ...prev, periodKey: data.period_key || periodPayload.period_key }));
      setManualDrafts(buildDraftsFromRows(data?.rows || [], sortedFields(configDraft || templateDetail?.config, true)));
      setDirtyManualKeys(new Set());
      setPreviewModalVisible(true);
      await loadRuns(currentTemplate.id, data.period_key || periodPayload.period_key);
      showSuccess('预览已生成');
    } catch (error) {
      showError(error);
    } finally {
      setPreviewLoading(false);
    }
  };

  const updateManualDraft = useCallback((rowKey, fieldKey, value) => {
    const key = manualDraftKey(rowKey, fieldKey);
    setManualDrafts((prev) => ({ ...prev, [key]: value }));
    setDirtyManualKeys((prev) => {
      const next = new Set(prev);
      next.add(key);
      return next;
    });
  }, []);

  const saveManualCells = async () => {
    if (!currentTemplate?.id || !preview?.period_key) {
      showError('请先生成预览');
      return;
    }
    if (dirtyManualKeys.size === 0) {
      showSuccess('没有需要保存的手动单元格');
      return;
    }
    setManualSaving(true);
    try {
      const fieldsByKey = Object.fromEntries(allFields.map((field) => [field.key, field]));
      for (const key of dirtyManualKeys) {
        const { rowKey, fieldKey } = splitManualDraftKey(key);
        const field = fieldsByKey[fieldKey];
        if (!field) continue;
        getResponseData(
          await API.post(`${API_BASE}/manual_cells`, {
            template_id: currentTemplate.id,
            period_key: preview.period_key,
            row_key: rowKey,
            field_key: fieldKey,
            value_type: field.value_type || 'string',
            value_text: manualDrafts[key] ?? '',
          }),
          '保存手动单元格失败',
        );
      }
      setDirtyManualKeys(new Set());
      showSuccess('手动单元格已保存');
      await previewReport();
    } catch (error) {
      showError(error);
    } finally {
      setManualSaving(false);
    }
  };

  const saveRun = async () => {
    if (!currentTemplate?.id) return;
    if (configDirty) {
      showError('字段配置有未保存修改，请先保存字段配置后再保存快照');
      return;
    }
    if (dirtyManualKeys.size > 0) {
      showError('当前有未保存的手动单元格，请先保存手动单元格后再保存快照');
      return;
    }
    setRunSaving(true);
    try {
      const periodPayload = buildPeriodPayload(period);
      const data = getResponseData(
        await API.post(`${API_BASE}/runs`, {
          template_id: currentTemplate.id,
          template_version_id: currentVersion?.id || 0,
          ...periodPayload,
          include_manual: true,
          max_logs: maxLogs ? Number(maxLogs) : undefined,
        }),
        '保存快照失败',
      );
      showSuccess(`快照已保存，行数：${data?.row_count || 0}`);
      setSelectedRun(data?.run || null);
      await loadRuns(currentTemplate.id, periodPayload.period_key);
    } catch (error) {
      showError(error);
    } finally {
      setRunSaving(false);
    }
  };

  const viewRun = async (runId) => {
    setPreviewLoading(true);
    try {
      const detail = getResponseData(await API.get(`${API_BASE}/runs/${runId}`), '读取快照失败');
      setSelectedRun(detail.run);
      setPreview({
        template_id: detail.run.template_id,
        template_version_id: detail.run.template_version_id,
        period_start: detail.run.period_start,
        period_end: detail.run.period_end,
        period_key: detail.run.period_key,
        timezone: detail.run.timezone,
        rows: detail.rows || [],
        warnings: [],
      });
      setSnapshotConfig(detail.config || null);
      setPeriod({
        startDate: dayjs.unix(detail.run.period_start).format(DATE_FORMAT),
        endDate: dayjs.unix(detail.run.period_end).subtract(1, 'second').format(DATE_FORMAT),
        periodKey: detail.run.period_key,
      });
      setManualDrafts(buildDraftsFromRows(detail?.rows || [], sortedFields(detail.config, true)));
      setDirtyManualKeys(new Set());
      setPreviewModalVisible(true);
      showSuccess('已载入历史快照');
    } catch (error) {
      showError(error);
    } finally {
      setPreviewLoading(false);
    }
  };

  const exportRun = async (runId) => {
    if (!runId) {
      showError('请先选择或保存快照');
      return;
    }
    try {
      const res = await API.get(`${API_BASE}/runs/${runId}/export`, {
        responseType: 'blob',
        disableDuplicate: true,
      });
      const disposition = res.headers?.['content-disposition'] || '';
      const filenameMatch = disposition.match(/filename\*=UTF-8''([^;]+)/);
      const filename = filenameMatch ? decodeURIComponent(filenameMatch[1]) : `成本报表-${runId}.xlsx`;
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      showSuccess('导出已开始');
    } catch (error) {
      showError(error);
    }
  };

  const previewRows = useMemo(
    () =>
      (preview?.rows || []).map((row, index) => ({
        ...row,
        key: row.row_key || `${index}`,
      })),
    [preview?.rows],
  );

  const hasPreview = !!preview;

  const templateOptions = templates.map((item) => ({
    label: `${item.template?.name || item.template?.key}（v${item.current_version?.version || '-'}）`,
    value: item.template?.id,
  }));

  return (
    <Spin spinning={loading}>
      <div className='flex flex-col gap-4'>
        <Card>
          <div className='flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3'>
            <div>
              <Typography.Title heading={4} style={{ margin: 0 }}>
                成本报表
              </Typography.Title>
              <Typography.Text type='secondary'>
                生成成本报表、编辑手动字段、保存快照并导出 Excel。
              </Typography.Text>
            </div>
            <Space wrap>
              <Select
                style={{ width: 280 }}
                placeholder='选择模板'
                value={currentTemplate?.id}
                optionList={templateOptions}
                onChange={selectTemplate}
                loading={templateLoading}
              />
              <Button icon={<IconRefresh />} loading={templateLoading} onClick={ensureDefaultTemplate}>
                更新默认模板
              </Button>
            </Space>
          </div>
        </Card>

        <Card>
          <div className='flex flex-col gap-4'>
            <div className='flex flex-col lg:flex-row lg:items-start lg:justify-between gap-3'>
              <div>
                <Typography.Title heading={5} style={{ margin: 0 }}>
                  生成报表
                </Typography.Title>
                <Typography.Text type='secondary'>
                  选择统计周期后生成预览；预览表格里可直接填写打款、单价、供货折扣等手动字段。
                </Typography.Text>
              </div>
              <Space wrap>
                <Button type='primary' icon={<IconSearch />} loading={previewLoading} onClick={previewReport}>
                  {previewLoading ? '生成中' : hasPreview ? '重新生成预览' : '生成预览'}
                </Button>
                {hasPreview && (
                  <Button onClick={() => setPreviewModalVisible(true)}>
                    打开预览
                  </Button>
                )}
                {dirtyManualKeys.size > 0 && !selectedRun && (
                  <Button icon={<IconSave />} loading={manualSaving} onClick={saveManualCells}>
                    保存手动字段（{dirtyManualKeys.size}）
                  </Button>
                )}
                {hasPreview && !selectedRun && (
                  <Button icon={<IconSave />} loading={runSaving} onClick={saveRun}>
                    保存快照
                  </Button>
                )}
                {selectedRun?.id && (
                  <Button icon={<IconDownload />} onClick={() => exportRun(selectedRun?.id)}>
                    导出快照 XLSX
                  </Button>
                )}
              </Space>
            </div>
            <div className='grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-3'>
              <div>
                <div className='mb-1 font-semibold'>开始日期</div>
                <Input
                  type='date'
                  value={period.startDate}
                  onChange={(value) => setPeriod((prev) => ({ ...prev, startDate: toDateInput(value) }))}
                />
              </div>
              <div>
                <div className='mb-1 font-semibold'>结束日期</div>
                <Input
                  type='date'
                  value={period.endDate}
                  onChange={(value) => setPeriod((prev) => ({ ...prev, endDate: toDateInput(value) }))}
                />
              </div>
              <div>
                <div className='mb-1 font-semibold'>期间 Key</div>
                <Input
                  value={period.periodKey}
                  placeholder='如 2026-06'
                  onChange={(value) => setPeriod((prev) => ({ ...prev, periodKey: value }))}
                />
              </div>
              <div>
                <div className='mb-1 font-semibold'>最大日志数（可选）</div>
                <Input
                  value={maxLogs}
                  placeholder='留空为全部'
                  onChange={setMaxLogs}
                />
              </div>
              <div>
                <div className='mb-1 font-semibold'>模板版本</div>
                <Input disabled value={currentVersion?.version ? `v${currentVersion.version}` : '-'} />
              </div>
            </div>
            {editableFields.length > 0 && (
              <Typography.Text type='tertiary'>
                手动字段以文本保存；金额/小数/百分比请按数值格式输入，例如百分比 3% 输入 0.03。
              </Typography.Text>
            )}
          </div>
        </Card>

        <Card>
          <div className='flex flex-col gap-3'>
            <div className='flex flex-col lg:flex-row lg:items-start lg:justify-between gap-3'>
              <div>
                <Typography.Title heading={5} style={{ margin: 0 }}>
                  字段配置（高级）
                </Typography.Title>
                <Typography.Text type='secondary'>
                  当前模板 {allFields.length} 个字段，{editableFields.length} 个字段可在 Excel 预览中填写或覆盖。
                </Typography.Text>
                {selectedRun && (
                  <Typography.Text type='tertiary' className='block'>
                    当前正在查看历史快照，字段配置不可编辑。
                  </Typography.Text>
                )}
              </div>
              <Space wrap>
                {configDirty && <Tag color='orange'>字段配置未保存</Tag>}
                {configDirty && (
                  <Button type='primary' icon={<IconSave />} loading={templateLoading} disabled={!!selectedRun} onClick={saveTemplateDraft}>
                    保存字段配置
                  </Button>
                )}
                <Button onClick={() => setFieldSectionExpanded((prev) => !prev)}>
                  {fieldSectionExpanded ? '收起字段配置' : '展开字段配置'}
                </Button>
                {fieldSectionExpanded && (
                  <Button disabled={!!selectedRun} onClick={openAddField}>新增字段</Button>
                )}
              </Space>
            </div>
            {!fieldSectionExpanded && editableFields.length > 0 && (
              <Space wrap>
                {editableFields.slice(0, 8).map((field) => (
                  <Tag key={field.key} color='blue'>
                    {field.label || field.key}
                  </Tag>
                ))}
                {editableFields.length > 8 && <Tag>+{editableFields.length - 8}</Tag>}
              </Space>
            )}
            {fieldSectionExpanded && (
              <>
                {editableFields.length > 0 && (
                  <Space wrap>
                    {editableFields.map((field) => (
                      <Tag key={field.key} color='blue'>
                        {field.label || field.key}
                      </Tag>
                    ))}
                  </Space>
                )}
                <Table
                  size='small'
                  pagination={false}
                  dataSource={allFields.map((field) => ({ ...field, key: field.key }))}
                  columns={[
                    { title: '字段名称', dataIndex: 'label', width: 150 },
                    { title: '字段标识', dataIndex: 'key', width: 150 },
                    {
                      title: '字段类型',
                      width: 110,
                      render: (_text, record) => fieldKindLabel(record.kind),
                    },
                    {
                      title: '值类型',
                      width: 100,
                      render: (_text, record) => valueTypeLabel(record.value_type),
                    },
                    {
                      title: '来源/计算方式',
                      width: 320,
                      render: (_text, record) => record.source || record.expression || record.initial_expression || '手动填写',
                    },
                    {
                      title: '是否可编辑',
                      width: 110,
                      render: (_text, record) => (isEditableField(record) ? <Tag color='green'>可编辑</Tag> : <Tag>自动</Tag>),
                    },
                    {
                      title: '操作',
                      width: 300,
                      fixed: 'right',
                      render: (_text, record, index) => (
                        <div className='flex items-center gap-1 whitespace-nowrap'>
                          <Button size='small' theme='borderless' disabled={!!selectedRun} onClick={() => openEditField(record)}>编辑</Button>
                          <Button size='small' theme='borderless' disabled={!!selectedRun || index === 0} onClick={() => moveField(record.key, -1)}>上移</Button>
                          <Button size='small' theme='borderless' disabled={!!selectedRun || index === allFields.length - 1} onClick={() => moveField(record.key, 1)}>下移</Button>
                          <Popconfirm title={`确定删除字段「${record.label || record.key}」吗？`} onConfirm={() => deleteField(record.key)}>
                            <Button size='small' theme='borderless' type='danger' disabled={!!selectedRun}>删除</Button>
                          </Popconfirm>
                        </div>
                      ),
                    },
                  ]}
                  scroll={{ x: 1250, y: 320 }}
                />
              </>
            )}
          </div>
        </Card>

        {preview?.warnings?.length > 0 && (
          <Banner
            type='warning'
            description={preview.warnings.join('；')}
            closeIcon={null}
          />
        )}

        <Modal
          title={selectedRun ? `Excel 快照预览 #${selectedRun.id}` : 'Excel 预览'}
          visible={previewModalVisible}
          onCancel={() => setPreviewModalVisible(false)}
          footer={null}
          width='98vw'
          style={{ top: 12 }}
          bodyStyle={{ padding: 12 }}
        >
          <div className='mb-2 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-2 border-b border-gray-100 pb-2'>
            <div className='leading-5'>
              <Typography.Text type='secondary'>
                {preview?.period_key || '-'} · {previewRows.length} 行 · {visibleFields.length} 列 · 可编辑 {editableFields.length} 列
              </Typography.Text>

            </div>
            <Space wrap>
              <Button type='primary' icon={<IconSave />} loading={manualSaving} disabled={!preview || selectedRun} onClick={saveManualCells}>
                保存手动字段{dirtyManualKeys.size > 0 ? `（${dirtyManualKeys.size}）` : ''}
              </Button>
              <Button icon={<IconSave />} loading={runSaving} disabled={!currentTemplate?.id} onClick={saveRun}>
                保存快照
              </Button>
              <Button icon={<IconDownload />} disabled={!selectedRun?.id} onClick={() => exportRun(selectedRun?.id)}>
                导出快照 XLSX
              </Button>
            </Space>
          </div>
          {previewModalVisible && (
            <CostReportSpreadsheetPreview
              fields={visibleFields}
              rows={previewRows}
              manualDrafts={manualDrafts}
              selectedRun={selectedRun}
              manualDraftKey={manualDraftKey}
              isEditableField={isEditableField}
              onManualDraftChange={updateManualDraft}
            />
          )}
        </Modal>

        <Card>
          <div className='flex items-center justify-between mb-3'>
            <div>
              <Typography.Title heading={5} style={{ margin: 0 }}>
                历史快照
              </Typography.Title>
              <Typography.Text type='secondary'>
                当前期间共 {runTotal} 条快照；可选择快照查看或导出。
              </Typography.Text>
            </div>
            <Button icon={<IconRefresh />} onClick={() => loadRuns()}>
              刷新历史
            </Button>
          </div>
          <Table
            size='small'
            pagination={false}
            dataSource={runs.map((run) => ({ ...run, key: run.id }))}
            columns={[
              { title: 'ID', dataIndex: 'id', width: 80 },
              { title: '期间', dataIndex: 'period_key', width: 140 },
              { title: '行数', dataIndex: 'row_count', width: 90 },
              {
                title: '创建时间',
                dataIndex: 'created_at',
                width: 180,
                render: (value) => (value ? dayjs.unix(value).format('YYYY-MM-DD HH:mm:ss') : '-'),
              },
              {
                title: '操作',
                width: 180,
                render: (_text, record) => (
                  <Space>
                    <Button size='small' onClick={() => viewRun(record.id)}>
                      查看
                    </Button>
                    <Button size='small' icon={<IconDownload />} onClick={() => exportRun(record.id)}>
                      导出
                    </Button>
                  </Space>
                ),
              },
            ]}
          />
        </Card>

        <Modal
          title={editingFieldKey ? '编辑字段' : '新增字段'}
          visible={fieldModalVisible}
          onOk={saveFieldDraft}
          onCancel={() => setFieldModalVisible(false)}
          okText='确认'
          cancelText='取消'
          width={720}
        >
          <div className='grid grid-cols-1 md:grid-cols-2 gap-3'>
            <div>
              <div className='mb-1 font-semibold'>字段标识</div>
              <Input
                value={fieldDraft.key}
                disabled={!!editingFieldKey}
                placeholder='例如 custom_cost'
                onChange={(value) => setFieldDraft((prev) => ({ ...prev, key: value }))}
              />
              <Typography.Text type='tertiary'>保存后作为公式引用名，编辑已有字段时不可修改。</Typography.Text>
            </div>
            <div>
              <div className='mb-1 font-semibold'>字段名称</div>
              <Input
                value={fieldDraft.label}
                placeholder='例如 自定义成本'
                onChange={(value) => setFieldDraft((prev) => ({ ...prev, label: value }))}
              />
            </div>
            <div>
              <div className='mb-1 font-semibold'>字段类型</div>
              <Select
                value={fieldDraft.kind}
                optionList={FIELD_KIND_OPTIONS}
                onChange={(value) => setFieldDraft((prev) => ({ ...prev, kind: value }))}
              />
            </div>
            <div>
              <div className='mb-1 font-semibold'>值类型</div>
              <Select
                value={fieldDraft.value_type}
                optionList={VALUE_TYPE_OPTIONS}
                onChange={(value) => setFieldDraft((prev) => ({ ...prev, value_type: value }))}
              />
            </div>
            {fieldDraft.kind === 'dimension' && (
              <div className='md:col-span-2'>
                <div className='mb-1 font-semibold'>数据来源</div>
                <Select
                  value={fieldDraft.source || 'log.username'}
                  optionList={DIMENSION_SOURCE_OPTIONS}
                  onChange={(value) => setFieldDraft((prev) => ({ ...prev, source: value }))}
                />
              </div>
            )}
            {fieldDraft.kind === 'metric' && (
              <>
                <div>
                  <div className='mb-1 font-semibold'>统计来源</div>
                  <Select
                    value={fieldDraft.source || 'log.quota_per_unit'}
                    optionList={METRIC_SOURCE_OPTIONS}
                    onChange={(value) => setFieldDraft((prev) => ({ ...prev, source: value }))}
                  />
                </div>
                <div>
                  <div className='mb-1 font-semibold'>统计方式</div>
                  <Select
                    value={fieldDraft.aggregate || 'sum'}
                    optionList={AGGREGATE_OPTIONS}
                    onChange={(value) => setFieldDraft((prev) => ({ ...prev, aggregate: value }))}
                  />
                </div>
              </>
            )}
            {fieldDraft.kind === 'formula' && (
              <>
                <div>
                  <div className='mb-1 font-semibold'>公式模式</div>
                  <Select
                    value={fieldDraft.formula_mode || 'standard'}
                    optionList={FORMULA_MODE_OPTIONS}
                    onChange={(value) => setFieldDraft((prev) => ({ ...prev, formula_mode: value }))}
                  />
                </div>
                <div className='flex items-end'>
                  <Checkbox
                    checked={!!fieldDraft.manual_override}
                    onChange={(e) => setFieldDraft((prev) => ({ ...prev, manual_override: e.target.checked }))}
                  >
                    允许在报表中手动覆盖
                  </Checkbox>
                </div>
                {fieldDraft.formula_mode === 'running' && (
                  <div className='md:col-span-2'>
                    <div className='mb-1 font-semibold'>初始公式</div>
                    <Input
                      value={fieldDraft.initial_expression || ''}
                      placeholder='例如 payment - receivable'
                      onChange={(value) => setFieldDraft((prev) => ({ ...prev, initial_expression: value }))}
                    />
                  </div>
                )}
                <div className='md:col-span-2'>
                  <div className='mb-1 font-semibold'>计算公式</div>
                  <Input
                    value={fieldDraft.expression || ''}
                    placeholder='例如 actual_consumption * supply_discount'
                    onChange={(value) => setFieldDraft((prev) => ({ ...prev, expression: value }))}
                  />
                  <Typography.Text type='tertiary'>可以引用字段标识，例如 actual_consumption、payment、receivable。</Typography.Text>
                </div>
              </>
            )}
            <div className='md:col-span-2'>
              <Space wrap>
                <Checkbox
                  checked={fieldDraft.visible !== false}
                  onChange={(e) => setFieldDraft((prev) => ({ ...prev, visible: e.target.checked }))}
                >
                  在页面显示
                </Checkbox>
                <Checkbox
                  checked={fieldDraft.exportable !== false}
                  onChange={(e) => setFieldDraft((prev) => ({ ...prev, exportable: e.target.checked }))}
                >
                  导出到 Excel
                </Checkbox>
              </Space>
            </div>
          </div>
        </Modal>

        <Divider margin='12px' />
      </div>
    </Spin>
  );
};

export default CostReportsPage;
