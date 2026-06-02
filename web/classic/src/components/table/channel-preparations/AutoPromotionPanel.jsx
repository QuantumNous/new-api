import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Banner,
  Button,
  Input,
  InputNumber,
  Modal,
  Select,
  Space,
  Spin,
  Switch,
  Table,
  Tag,
  Typography,
} from '@douyinfe/semi-ui';
import { IconPlus, IconRefresh, IconSave } from '@douyinfe/semi-icons';
import { API, showError, showSuccess, showWarning } from '../../../helpers';
import { CHANNEL_OPTIONS } from '../../../constants/channel.constants';

const SETTING_PREFIX = 'channel_preparation_auto_promotion_setting.';
const DEFAULT_STRATEGY = 'priority_weighted';

const DEFAULT_SETTINGS = {
  scheduler_enabled: false,
  interval_minutes: 10,
  max_promotions_per_run: 10,
  rules: [],
};

function parseBool(value, fallback = false) {
  if (typeof value === 'boolean') return value;
  if (value === 'true') return true;
  if (value === 'false') return false;
  return fallback;
}

function parseNumber(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizeRule(rule = {}) {
  return {
    id: String(
      rule.id || `rule-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    ),
    enabled: parseBool(rule.enabled, true),
    group: rule.group || 'default',
    type: Number(rule.type || 14),
    threshold_usd: parseNumber(rule.threshold_usd, 1),
    strategy: rule.strategy || DEFAULT_STRATEGY,
  };
}

function optionsToSettings(options = []) {
  const map = {};
  options.forEach((item) => {
    map[item.key] = item.value;
  });

  let rules = [];
  try {
    rules = JSON.parse(map[`${SETTING_PREFIX}rules`] || '[]');
    if (!Array.isArray(rules)) rules = [];
  } catch (error) {
    rules = [];
  }

  return {
    scheduler_enabled: parseBool(
      map[`${SETTING_PREFIX}scheduler_enabled`],
      DEFAULT_SETTINGS.scheduler_enabled,
    ),
    interval_minutes: parseNumber(
      map[`${SETTING_PREFIX}interval_minutes`],
      DEFAULT_SETTINGS.interval_minutes,
    ),
    max_promotions_per_run: parseNumber(
      map[`${SETTING_PREFIX}max_promotions_per_run`],
      DEFAULT_SETTINGS.max_promotions_per_run,
    ),
    rules: rules.map(normalizeRule),
  };
}

function buildOptionUpdates(settings) {
  return [
    ['scheduler_enabled', String(!!settings.scheduler_enabled)],
    ['interval_minutes', String(settings.interval_minutes || 10)],
    ['max_promotions_per_run', String(settings.max_promotions_per_run || 10)],
    ['rules', JSON.stringify((settings.rules || []).map(normalizeRule))],
  ].map(([key, value]) => ({
    key: `${SETTING_PREFIX}${key}`,
    value,
  }));
}

function formatUSD(value) {
  const numeric = Number(value || 0);
  return numeric.toFixed(4);
}

const AutoPromotionPanel = ({ t, refreshPreparations }) => {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [running, setRunning] = useState(false);
  const [canConfigure, setCanConfigure] = useState(true);
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [lastSummary, setLastSummary] = useState(null);

  const updateSettings = useCallback((patch) => {
    setSettings((prev) => ({ ...prev, ...patch }));
  }, []);

  const updateRule = useCallback((ruleId, patch) => {
    setSettings((prev) => ({
      ...prev,
      rules: prev.rules.map((rule) =>
        rule.id === ruleId ? { ...rule, ...patch } : rule,
      ),
    }));
  }, []);

  const addRule = useCallback(() => {
    setSettings((prev) => ({
      ...prev,
      rules: [
        ...prev.rules,
        normalizeRule({
          enabled: true,
          group: 'default',
          type: 14,
          threshold_usd: 1,
          strategy: DEFAULT_STRATEGY,
        }),
      ],
    }));
  }, []);

  const removeRule = useCallback((ruleId) => {
    setSettings((prev) => ({
      ...prev,
      rules: prev.rules.filter((rule) => rule.id !== ruleId),
    }));
  }, []);

  const validateSettings = useCallback(() => {
    if (settings.interval_minutes <= 0) {
      showWarning(t('自动晋升检查间隔必须大于 0'));
      return false;
    }
    if (settings.max_promotions_per_run <= 0) {
      showWarning(t('每次最大晋升数量必须大于 0'));
      return false;
    }
    for (const rule of settings.rules) {
      if (!rule.group || !rule.group.trim()) {
        showWarning(t('自动晋升规则分组不能为空'));
        return false;
      }
      if (!rule.type || Number(rule.type) <= 0) {
        showWarning(t('自动晋升规则渠道类型无效'));
        return false;
      }
      if (!rule.threshold_usd || Number(rule.threshold_usd) <= 0) {
        showWarning(t('自动晋升规则阈值必须大于 0'));
        return false;
      }
    }
    return true;
  }, [settings, t]);

  const loadSettings = useCallback(async () => {
    setLoading(true);
    try {
      const res = await API.get('/api/option/', { skipErrorHandler: true });
      if (!res.data.success) {
        throw new Error(res.data.message || t('加载自动晋升配置失败'));
      }
      setSettings(optionsToSettings(res.data.data || []));
      setCanConfigure(true);
    } catch (error) {
      setCanConfigure(false);
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  const saveSettings = useCallback(async () => {
    if (!validateSettings()) return;
    setSaving(true);
    try {
      const updates = buildOptionUpdates(settings);
      const orderedUpdates = [
        ...updates.filter(
          (item) => item.key !== `${SETTING_PREFIX}scheduler_enabled`,
        ),
        ...updates.filter(
          (item) => item.key === `${SETTING_PREFIX}scheduler_enabled`,
        ),
      ];
      for (const item of orderedUpdates) {
        const res = await API.put('/api/option/', item);
        if (!res.data.success) {
          throw new Error(res.data.message || t('保存自动晋升配置失败'));
        }
      }
      showSuccess(t('自动晋升配置已保存'));
      await loadSettings();
    } catch (error) {
      showError(error.message || t('保存自动晋升配置失败'));
    } finally {
      setSaving(false);
    }
  }, [loadSettings, settings, t, validateSettings]);

  const runAutoPromotion = useCallback(
    async (ruleId = '') => {
      setRunning(true);
      try {
        const res = await API.post(
          '/api/channel/preparations/auto-promotion/run',
          {
            rule_id: ruleId,
          },
        );
        if (!res.data.success) {
          throw new Error(res.data.message || t('执行自动晋升失败'));
        }
        const summary = res.data.data;
        setLastSummary(summary);
        showSuccess(
          t('自动晋升检查完成：晋升 {{count}} 个渠道', {
            count: summary?.total_promoted || 0,
          }),
        );
        refreshPreparations?.();
      } catch (error) {
        showError(error.message || t('执行自动晋升失败'));
      } finally {
        setRunning(false);
      }
    },
    [refreshPreparations, t],
  );

  const columns = useMemo(
    () => [
      {
        title: t('启用'),
        dataIndex: 'enabled',
        width: 80,
        render: (_, record) => (
          <Switch
            size='small'
            checked={!!record.enabled}
            onChange={(value) => updateRule(record.id, { enabled: value })}
          />
        ),
      },
      {
        title: t('分组'),
        dataIndex: 'group',
        width: 140,
        render: (_, record) => (
          <Input
            size='small'
            value={record.group}
            placeholder='default'
            onChange={(value) => updateRule(record.id, { group: value })}
          />
        ),
      },
      {
        title: t('渠道类型'),
        dataIndex: 'type',
        width: 190,
        render: (_, record) => (
          <Select
            size='small'
            value={record.type}
            onChange={(value) => updateRule(record.id, { type: value })}
            style={{ width: 170 }}
          >
            {CHANNEL_OPTIONS.map((option) => (
              <Select.Option key={option.value} value={option.value}>
                {option.label}
              </Select.Option>
            ))}
          </Select>
        ),
      },
      {
        title: t('触发阈值'),
        dataIndex: 'threshold_usd',
        width: 140,
        render: (_, record) => (
          <InputNumber
            size='small'
            min={0.0001}
            step={1}
            value={record.threshold_usd}
            suffix='USD'
            onChange={(value) =>
              updateRule(record.id, { threshold_usd: Number(value || 0) })
            }
          />
        ),
      },
      {
        title: t('策略'),
        dataIndex: 'strategy',
        width: 130,
        render: () => <Tag color='blue'>priority_weighted</Tag>,
      },
      {
        title: t('操作'),
        dataIndex: 'operate',
        width: 150,
        render: (_, record) => (
          <Space>
            <Button
              size='small'
              type='tertiary'
              loading={running}
              onClick={() => runAutoPromotion(record.id)}
            >
              {t('执行')}
            </Button>
            <Button
              size='small'
              type='danger'
              theme='borderless'
              onClick={() => removeRule(record.id)}
            >
              {t('删除')}
            </Button>
          </Space>
        ),
      },
    ],
    [removeRule, runAutoPromotion, running, t, updateRule],
  );

  const resultContent = useMemo(() => {
    if (!lastSummary) return null;
    return (
      <div className='space-y-3'>
        <Typography.Text>
          {t('本次共晋升 {{count}} 个渠道', {
            count: lastSummary.total_promoted || 0,
          })}
        </Typography.Text>
        {(lastSummary.rules || []).map((rule) => (
          <div key={rule.rule_id} className='border rounded-lg p-3'>
            <div className='font-semibold mb-1'>
              {rule.group} / {rule.type} / {rule.rule_id}
            </div>
            <div className='text-sm text-gray-500'>
              {t('初始容量')}：
              {formatUSD(rule.initial_capacity?.effective_capacity_usd)} USD，
              {t('最终容量')}：
              {formatUSD(rule.final_capacity?.effective_capacity_usd)} USD，
              {t('阈值')}：{formatUSD(rule.threshold_usd)} USD
            </div>
            <div className='text-sm text-gray-500'>
              {t('参与统计渠道')}：
              {rule.initial_capacity?.eligible_channel_count || 0}，
              {t('忽略无余额渠道')}：
              {rule.initial_capacity
                ?.ignored_non_positive_balance_channel_count || 0}
            </div>
            {rule.skipped_reason && (
              <div className='text-sm text-gray-500'>
                {t('跳过原因')}：{rule.skipped_reason}
              </div>
            )}
            {(rule.failures || []).map((failure) => (
              <div key={failure} className='text-sm text-red-500'>
                {failure}
              </div>
            ))}
          </div>
        ))}
      </div>
    );
  }, [lastSummary, t]);

  if (!canConfigure) {
    return (
      <div className='mb-3 rounded-xl border border-gray-100 bg-white dark:bg-zinc-900 p-4'>
        <Banner
          fullMode={false}
          type='info'
          description={t(
            '自动晋升配置需要 root 权限。普通管理员仍可按已保存规则手动执行自动晋升检查。',
          )}
          className='mb-3'
        />
        <Button
          size='small'
          type='warning'
          loading={running}
          onClick={() => runAutoPromotion('')}
        >
          {t('执行自动晋升检查')}
        </Button>
        <Modal
          title={t('自动晋升执行结果')}
          visible={!!lastSummary}
          onCancel={() => setLastSummary(null)}
          footer={null}
          width={720}
        >
          {resultContent}
        </Modal>
      </div>
    );
  }

  return (
    <Spin spinning={loading}>
      <div className='mb-3 rounded-xl border border-gray-100 bg-white dark:bg-zinc-900 p-4'>
        <div className='flex flex-col lg:flex-row lg:items-start lg:justify-between gap-3 mb-3'>
          <div>
            <Typography.Title heading={6} style={{ margin: 0 }}>
              {t('自动晋升')}
            </Typography.Title>
            <Typography.Text type='secondary'>
              {t(
                '只统计已启用且余额大于 0 的正式渠道；低于阈值时，从备货池自动晋升余额大于 0 的候选渠道。',
              )}
            </Typography.Text>
          </div>
          <Space wrap>
            <Button
              size='small'
              icon={<IconRefresh />}
              loading={loading}
              onClick={loadSettings}
            >
              {t('重新加载')}
            </Button>
            <Button
              size='small'
              type='primary'
              theme='solid'
              icon={<IconSave />}
              loading={saving}
              onClick={saveSettings}
            >
              {t('保存自动晋升配置')}
            </Button>
            <Button
              size='small'
              type='warning'
              loading={running}
              onClick={() => runAutoPromotion('')}
            >
              {t('执行自动晋升检查')}
            </Button>
          </Space>
        </div>

        <div className='grid grid-cols-1 md:grid-cols-3 gap-3 mb-3'>
          <div>
            <div className='mb-1 font-semibold'>{t('定时自动晋升')}</div>
            <Switch
              checked={!!settings.scheduler_enabled}
              onChange={(value) => updateSettings({ scheduler_enabled: value })}
            />
          </div>
          <div>
            <div className='mb-1 font-semibold'>{t('检查间隔')}</div>
            <InputNumber
              min={1}
              step={1}
              suffix={t('分钟')}
              value={settings.interval_minutes}
              onChange={(value) =>
                updateSettings({ interval_minutes: Number(value || 10) })
              }
            />
          </div>
          <div>
            <div className='mb-1 font-semibold'>{t('每次最大晋升')}</div>
            <InputNumber
              min={1}
              step={1}
              value={settings.max_promotions_per_run}
              onChange={(value) =>
                updateSettings({ max_promotions_per_run: Number(value || 10) })
              }
            />
          </div>
        </div>

        <Banner
          fullMode={false}
          type='info'
          description={t(
            '容量统计固定为：启用状态且余额 > 0 的渠道，其剩余额度合计 - 已用额度折算；余额 <= 0 的真实渠道会被忽略，余额 <= 0 的候选渠道不会自动晋升。系统不会自动刷新上游余额。',
          )}
          className='mb-3'
        />

        <div className='flex justify-between items-center mb-2'>
          <Typography.Text strong>{t('自动晋升规则')}</Typography.Text>
          <Button size='small' icon={<IconPlus />} onClick={addRule}>
            {t('添加规则')}
          </Button>
        </div>
        <Table
          rowKey='id'
          size='small'
          columns={columns}
          dataSource={settings.rules || []}
          pagination={false}
          scroll={{ x: 'max-content' }}
        />
      </div>

      <Modal
        title={t('自动晋升执行结果')}
        visible={!!lastSummary}
        onCancel={() => setLastSummary(null)}
        footer={null}
        width={720}
      >
        {resultContent}
      </Modal>
    </Spin>
  );
};

export default AutoPromotionPanel;
