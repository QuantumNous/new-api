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
  Typography,
} from '@douyinfe/semi-ui';
import { IconPlus, IconRefresh, IconSave } from '@douyinfe/semi-icons';
import {
  API,
  buildGroupOptions,
  showError,
  showSuccess,
  showWarning,
} from '../../../helpers';
import { CHANNEL_OPTIONS } from '../../../constants/channel.constants';

const SETTING_PREFIX = 'channel_preparation_auto_promotion_setting.';
const DEFAULT_STRATEGY = 'priority_weighted';
const DEFAULT_GUARANTEE_PRIORITY = 'capacity_first';
const DEFAULT_GROUP = 'default';

const GUARANTEE_PRIORITY_OPTIONS = [
  { value: 'capacity_first', label: '容量优先' },
  { value: 'count_first', label: '数量优先' },
];

const STRATEGY_OPTIONS = [
  { value: 'priority_weighted', label: '优先级 + 权重' },
  { value: 'small_balance_first', label: '优先级内小余额优先' },
  { value: 'large_balance_first', label: '优先级内大余额优先' },
];

const GUARANTEE_PRIORITY_LABELS = Object.fromEntries(
  GUARANTEE_PRIORITY_OPTIONS.map((item) => [item.value, item.label]),
);
const STRATEGY_LABELS = Object.fromEntries(
  STRATEGY_OPTIONS.map((item) => [item.value, item.label]),
);

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

function parseNonNegativeInteger(value, fallback = 0) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(0, Math.trunc(parsed));
}

function normalizeStrategy(strategy, fallback = DEFAULT_STRATEGY) {
  return STRATEGY_LABELS[strategy] ? strategy : fallback;
}

function normalizeGuaranteePriority(priority) {
  return GUARANTEE_PRIORITY_LABELS[priority]
    ? priority
    : DEFAULT_GUARANTEE_PRIORITY;
}

function normalizeRule(rule = {}) {
  const legacyStrategy = normalizeStrategy(rule.strategy, DEFAULT_STRATEGY);
  const capacityShortageStrategy = normalizeStrategy(
    rule.capacity_shortage_strategy,
    legacyStrategy,
  );
  const countShortageStrategy = normalizeStrategy(
    rule.count_shortage_strategy,
    legacyStrategy,
  );

  return {
    id: String(
      rule.id || `rule-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    ),
    enabled: parseBool(rule.enabled, true),
    group: rule.group || DEFAULT_GROUP,
    type: Number(rule.type || 14),
    threshold_usd: parseNumber(rule.threshold_usd, 1),
    minimum_usable_channel_count: parseNonNegativeInteger(
      rule.minimum_usable_channel_count,
      0,
    ),
    guarantee_priority: normalizeGuaranteePriority(rule.guarantee_priority),
    count_shortage_strategy: countShortageStrategy,
    capacity_shortage_strategy: capacityShortageStrategy,
    strategy: capacityShortageStrategy,
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

function formatTimestamp(seconds) {
  if (!seconds) return '-';
  return new Date(seconds * 1000).toLocaleString();
}

function buildNextCheckText(status, t) {
  if (!status) return t('加载中');
  if (!status.is_master_node) return t('非主节点不执行定时任务');
  if (!status.scheduler_enabled) return t('未启用');
  if (status.running) return t('正在检查');
  if (status.next_check_at > 0) return formatTimestamp(status.next_check_at);
  return t('等待调度器同步');
}

function strategyLabel(value) {
  return STRATEGY_LABELS[value] || value || '-';
}

function guaranteePriorityLabel(value) {
  return GUARANTEE_PRIORITY_LABELS[value] || value || '-';
}

const AutoPromotionPanel = ({ t, refreshPreparations }) => {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [running, setRunning] = useState(false);
  const [canConfigure, setCanConfigure] = useState(true);
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [groupOptions, setGroupOptions] = useState([
    { label: DEFAULT_GROUP, value: DEFAULT_GROUP },
  ]);
  const [schedulerStatus, setSchedulerStatus] = useState(null);
  const [lastSummary, setLastSummary] = useState(null);

  const updateSettings = useCallback((patch) => {
    setSettings((prev) => ({ ...prev, ...patch }));
  }, []);

  const updateRule = useCallback((ruleId, patch) => {
    setSettings((prev) => ({
      ...prev,
      rules: prev.rules.map((rule) =>
        rule.id === ruleId ? normalizeRule({ ...rule, ...patch }) : rule,
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
          group: DEFAULT_GROUP,
          type: 14,
          threshold_usd: 1,
          minimum_usable_channel_count: 0,
          guarantee_priority: DEFAULT_GUARANTEE_PRIORITY,
          count_shortage_strategy: DEFAULT_STRATEGY,
          capacity_shortage_strategy: DEFAULT_STRATEGY,
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
    const seenIds = new Set();
    for (const rule of settings.rules) {
      if (!rule.id || seenIds.has(rule.id)) {
        showWarning(t('自动晋升规则 ID 不能为空或重复'));
        return false;
      }
      seenIds.add(rule.id);
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
      if (
        !Number.isInteger(Number(rule.minimum_usable_channel_count)) ||
        Number(rule.minimum_usable_channel_count) < 0
      ) {
        showWarning(t('最低可用渠道数必须是非负整数'));
        return false;
      }
      if (!GUARANTEE_PRIORITY_LABELS[rule.guarantee_priority]) {
        showWarning(t('自动晋升保障优先级无效'));
        return false;
      }
      if (
        !STRATEGY_LABELS[rule.count_shortage_strategy] ||
        !STRATEGY_LABELS[rule.capacity_shortage_strategy]
      ) {
        showWarning(t('自动晋升策略无效'));
        return false;
      }
    }
    return true;
  }, [settings, t]);

  const loadGroupOptions = useCallback(async () => {
    try {
      const res = await API.get('/api/group/', { skipErrorHandler: true });
      if (res?.data?.success) {
        setGroupOptions(buildGroupOptions(res.data.data, DEFAULT_GROUP));
      }
    } catch (error) {
      setGroupOptions([{ label: DEFAULT_GROUP, value: DEFAULT_GROUP }]);
    }
  }, []);

  const loadSchedulerStatus = useCallback(async () => {
    try {
      const res = await API.get(
        '/api/channel/preparations/auto-promotion/status',
        { skipErrorHandler: true },
      );
      if (res.data.success) {
        setSchedulerStatus(res.data.data || null);
      }
    } catch (error) {
      setSchedulerStatus(null);
    }
  }, []);

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

  const reloadAll = useCallback(async () => {
    await Promise.all([
      loadSettings(),
      loadGroupOptions(),
      loadSchedulerStatus(),
    ]);
  }, [loadGroupOptions, loadSettings, loadSchedulerStatus]);

  useEffect(() => {
    reloadAll();
    const timer = setInterval(loadSchedulerStatus, 30000);
    return () => clearInterval(timer);
  }, [loadSchedulerStatus, reloadAll]);

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
      await reloadAll();
    } catch (error) {
      showError(error.message || t('保存自动晋升配置失败'));
    } finally {
      setSaving(false);
    }
  }, [reloadAll, settings, t, validateSettings]);

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
        loadSchedulerStatus();
      } catch (error) {
        showError(error.message || t('执行自动晋升失败'));
      } finally {
        setRunning(false);
      }
    },
    [loadSchedulerStatus, refreshPreparations, t],
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
              {t('阈值')}：{formatUSD(rule.threshold_usd)} USD，
              {t('容量缺口')}：{formatUSD(rule.capacity_deficit_usd)} USD
            </div>
            <div className='text-sm text-gray-500'>
              {t('初始可用渠道')}：
              {rule.initial_capacity?.usable_channel_count ??
                rule.initial_capacity?.eligible_channel_count ??
                0}
              ，{t('最终可用渠道')}：
              {rule.final_capacity?.usable_channel_count ??
                rule.final_capacity?.eligible_channel_count ??
                0}
              ，{t('最低可用渠道数')}：{rule.minimum_usable_channel_count || 0}
              ，{t('数量缺口')}：{rule.count_deficit || 0}
            </div>
            <div className='text-sm text-gray-500'>
              {t('保障优先级')}：
              {t(guaranteePriorityLabel(rule.guarantee_priority))}，
              {t('数量不足策略')}：
              {t(strategyLabel(rule.count_shortage_strategy))}，
              {t('容量不足策略')}：
              {t(strategyLabel(rule.capacity_shortage_strategy))}
            </div>
            <div className='text-sm text-gray-500'>
              {t('参与统计渠道')}：
              {rule.initial_capacity?.eligible_channel_count || 0}，
              {t('忽略无余额渠道')}：
              {rule.initial_capacity
                ?.ignored_non_positive_balance_channel_count || 0}
            </div>
            {(rule.promotions || []).map((promotion) => (
              <div
                key={`${promotion.preparation_id}-${promotion.channel_id}`}
                className='mt-2 rounded bg-gray-50 dark:bg-zinc-800 p-2 text-xs text-gray-600 dark:text-gray-300'
              >
                {t('候选')} #{promotion.preparation_id} → {t('渠道')} #
                {promotion.channel_id}，{t('不足类型')}：
                {promotion.shortage_type === 'count' ? t('数量') : t('容量')}，
                {t('策略')}：{t(strategyLabel(promotion.strategy))}，
                {t('可用渠道')}：{promotion.usable_count_before} →{' '}
                {promotion.usable_count_after}，{t('容量')}：
                {formatUSD(promotion.capacity_before_usd)} →{' '}
                {formatUSD(promotion.capacity_after_usd)} USD，
                {t('数量缺口')}：{promotion.count_deficit_before} →{' '}
                {promotion.count_deficit_after}，{t('容量缺口')}：
                {formatUSD(promotion.capacity_deficit_before_usd)} →{' '}
                {formatUSD(promotion.capacity_deficit_after_usd)} USD
              </div>
            ))}
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

  const nextCheckText = buildNextCheckText(schedulerStatus, t);
  const lastCheckText = schedulerStatus?.last_check_at
    ? formatTimestamp(schedulerStatus.last_check_at)
    : '';

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
        <div className='mb-3 rounded-lg bg-gray-50 dark:bg-zinc-800 p-3 text-sm'>
          <div>
            <Typography.Text strong>{t('下次检查')}：</Typography.Text>
            <Typography.Text>{nextCheckText}</Typography.Text>
          </div>
          {lastCheckText && (
            <div className='mt-1 text-gray-500'>
              {t('上次检查')}：{lastCheckText}
            </div>
          )}
        </div>
        <Button
          size='small'
          type='warning'
          loading={running}
          onClick={() => runAutoPromotion('')}
        >
          {t('执行全部规则检查')}
        </Button>
        <Modal
          title={t('自动晋升执行结果')}
          visible={!!lastSummary}
          onCancel={() => setLastSummary(null)}
          footer={null}
          width={820}
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
                '只统计已启用且余额大于 0 的正式渠道；未满足最低可用渠道数或容量阈值时，从备货池自动晋升余额大于 0 的候选渠道。',
              )}
            </Typography.Text>
          </div>
          <Space wrap>
            <Button
              size='small'
              icon={<IconRefresh />}
              loading={loading}
              onClick={reloadAll}
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
              {t('执行全部规则检查')}
            </Button>
          </Space>
        </div>

        <div className='grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3 mb-3'>
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
          <div>
            <div className='mb-1 font-semibold'>{t('下次检查')}</div>
            <div className='min-h-[32px] flex items-center text-sm text-gray-700 dark:text-gray-200'>
              {nextCheckText}
            </div>
            {lastCheckText && (
              <div className='text-xs text-gray-500'>
                {t('上次检查')}：{lastCheckText}
              </div>
            )}
          </div>
        </div>

        <Banner
          fullMode={false}
          type='info'
          description={t(
            '容量统计固定为：启用状态且余额 > 0 的渠道，其剩余额度合计 - 已用额度折算；余额 <= 0 的真实渠道会被忽略，余额 <= 0 的候选渠道不会自动晋升。系统不会自动刷新上游余额。候选选择始终先限制在最高优先级层级内。',
          )}
          className='mb-3'
        />

        <div className='flex justify-between items-center mb-2'>
          <Typography.Text strong>{t('自动晋升规则')}</Typography.Text>
          <Button size='small' icon={<IconPlus />} onClick={addRule}>
            {t('添加规则')}
          </Button>
        </div>
        <div className='space-y-3'>
          {(settings.rules || []).length === 0 ? (
            <div className='rounded-lg border border-dashed border-gray-200 p-4 text-sm text-gray-500'>
              {t('暂无自动晋升规则，请先添加规则。')}
            </div>
          ) : (
            (settings.rules || []).map((rule) => (
              <div
                key={rule.id}
                className='rounded-lg border border-gray-100 p-3'
              >
                <div className='grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3 items-end'>
                  <div>
                    <div className='mb-1 text-sm font-semibold'>
                      {t('启用')}
                    </div>
                    <Switch
                      size='small'
                      checked={!!rule.enabled}
                      onChange={(value) =>
                        updateRule(rule.id, { enabled: value })
                      }
                    />
                  </div>
                  <div>
                    <div className='mb-1 text-sm font-semibold'>
                      {t('分组')}
                    </div>
                    <Select
                      size='small'
                      value={rule.group}
                      optionList={groupOptions}
                      allowCreate
                      filter
                      showClear
                      placeholder={DEFAULT_GROUP}
                      onChange={(value) =>
                        updateRule(rule.id, { group: value || DEFAULT_GROUP })
                      }
                      style={{ width: '100%' }}
                    />
                  </div>
                  <div>
                    <div className='mb-1 text-sm font-semibold'>
                      {t('渠道类型')}
                    </div>
                    <Select
                      size='small'
                      value={rule.type}
                      onChange={(value) => updateRule(rule.id, { type: value })}
                      style={{ width: '100%' }}
                    >
                      {CHANNEL_OPTIONS.map((option) => (
                        <Select.Option key={option.value} value={option.value}>
                          {option.label}
                        </Select.Option>
                      ))}
                    </Select>
                  </div>
                  <div>
                    <div className='mb-1 text-sm font-semibold'>
                      {t('容量阈值')}
                    </div>
                    <InputNumber
                      size='small'
                      min={0.0001}
                      step={1}
                      value={rule.threshold_usd}
                      suffix='USD'
                      onChange={(value) =>
                        updateRule(rule.id, {
                          threshold_usd: Number(value || 0),
                        })
                      }
                      style={{ width: '100%' }}
                    />
                  </div>
                  <div>
                    <div className='mb-1 text-sm font-semibold'>
                      {t('最低可用渠道数')}
                    </div>
                    <InputNumber
                      size='small'
                      min={0}
                      step={1}
                      value={rule.minimum_usable_channel_count}
                      onChange={(value) =>
                        updateRule(rule.id, {
                          minimum_usable_channel_count: parseNonNegativeInteger(
                            value,
                            0,
                          ),
                        })
                      }
                      style={{ width: '100%' }}
                    />
                  </div>
                  <div>
                    <div className='mb-1 text-sm font-semibold'>
                      {t('保障优先级')}
                    </div>
                    <Select
                      size='small'
                      value={rule.guarantee_priority}
                      onChange={(value) =>
                        updateRule(rule.id, { guarantee_priority: value })
                      }
                      style={{ width: '100%' }}
                    >
                      {GUARANTEE_PRIORITY_OPTIONS.map((option) => (
                        <Select.Option key={option.value} value={option.value}>
                          {t(option.label)}
                        </Select.Option>
                      ))}
                    </Select>
                  </div>
                  <div>
                    <div className='mb-1 text-sm font-semibold'>
                      {t('数量不足策略')}
                    </div>
                    <Select
                      size='small'
                      value={rule.count_shortage_strategy}
                      onChange={(value) =>
                        updateRule(rule.id, { count_shortage_strategy: value })
                      }
                      style={{ width: '100%' }}
                    >
                      {STRATEGY_OPTIONS.map((option) => (
                        <Select.Option key={option.value} value={option.value}>
                          {t(option.label)}
                        </Select.Option>
                      ))}
                    </Select>
                  </div>
                  <div>
                    <div className='mb-1 text-sm font-semibold'>
                      {t('容量不足策略')}
                    </div>
                    <Select
                      size='small'
                      value={rule.capacity_shortage_strategy}
                      onChange={(value) =>
                        updateRule(rule.id, {
                          capacity_shortage_strategy: value,
                          strategy: value,
                        })
                      }
                      style={{ width: '100%' }}
                    >
                      {STRATEGY_OPTIONS.map((option) => (
                        <Select.Option key={option.value} value={option.value}>
                          {t(option.label)}
                        </Select.Option>
                      ))}
                    </Select>
                  </div>
                </div>
                <div className='mt-3 flex flex-wrap gap-2 justify-end'>
                  <Button
                    size='small'
                    type='tertiary'
                    loading={running}
                    onClick={() => runAutoPromotion(rule.id)}
                  >
                    {t('执行本规则')}
                  </Button>
                  <Button
                    size='small'
                    type='danger'
                    theme='borderless'
                    onClick={() => removeRule(rule.id)}
                  >
                    {t('删除')}
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <Modal
        title={t('自动晋升执行结果')}
        visible={!!lastSummary}
        onCancel={() => setLastSummary(null)}
        footer={null}
        width={820}
      >
        {resultContent}
      </Modal>
    </Spin>
  );
};

export default AutoPromotionPanel;
