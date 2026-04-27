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

import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Spinner, Switch } from '@heroui/react';
import {
  compareObjects,
  API,
  showError,
  showSuccess,
  showWarning,
} from '../../../helpers';
import ConfirmDialog from '../../../components/common/ui/ConfirmDialog';

// ----------------------------- helpers -----------------------------

const inputClass =
  'h-10 w-full rounded-xl border border-border bg-background px-3 text-sm text-foreground outline-none transition focus:border-primary disabled:cursor-not-allowed disabled:opacity-50';

function FieldLabel({ children }) {
  return (
    <label className='block text-sm font-medium text-foreground'>
      {children}
    </label>
  );
}

function FieldHint({ children }) {
  if (!children) return null;
  return <div className='mt-1.5 text-xs text-muted'>{children}</div>;
}

function InfoBanner({ tone = 'info', children }) {
  const cls =
    tone === 'warning'
      ? 'border-warning/30 bg-warning/5'
      : 'border-primary/20 bg-primary/5';
  return (
    <div
      className={`flex items-start gap-2 rounded-xl border ${cls} px-3 py-2 text-sm text-foreground`}
    >
      <span>{children}</span>
    </div>
  );
}

function SectionHeader({ title }) {
  if (!title) return null;
  return (
    <div className='border-b border-border pb-2 text-base font-semibold text-foreground'>
      {title}
    </div>
  );
}

function SwitchRow({ label, hint, value, onChange }) {
  return (
    <div className='flex items-start justify-between gap-3'>
      <div className='space-y-1'>
        <div className='text-sm font-medium text-foreground'>{label}</div>
        {hint ? <div className='text-xs text-muted'>{hint}</div> : null}
      </div>
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
  );
}

function StatusChip({ tone, children }) {
  const cls =
    tone === 'green'
      ? 'bg-success/15 text-success'
      : tone === 'blue'
        ? 'bg-primary/15 text-primary'
        : 'bg-surface-secondary text-muted';
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${cls}`}
    >
      {children}
    </span>
  );
}

function ProgressBar({ percent, tone = 'primary' }) {
  const safe = Math.max(0, Math.min(100, Number(percent) || 0));
  const fill =
    tone === 'danger'
      ? 'bg-danger'
      : tone === 'warning'
        ? 'bg-warning'
        : 'bg-primary';
  return (
    <div className='flex items-center gap-2'>
      <div className='h-2 flex-1 overflow-hidden rounded-full bg-surface-secondary'>
        <div
          className={`h-full rounded-full transition-[width] duration-200 ${fill}`}
          style={{ width: `${safe}%` }}
        />
      </div>
      <span className='shrink-0 text-xs font-medium text-foreground'>
        {Math.round(safe)}%
      </span>
    </div>
  );
}

function DescList({ rows }) {
  if (!rows?.length) return null;
  return (
    <div className='overflow-hidden rounded-xl border border-border bg-background'>
      {rows.map((row, idx) => (
        <div
          key={`${row.key}-${idx}`}
          className={`grid grid-cols-[160px_1fr] items-center gap-2 px-3 py-2 text-sm ${
            idx > 0 ? 'border-t border-border' : ''
          }`}
        >
          <div className='text-xs font-medium text-muted'>{row.key}</div>
          <div className='break-all text-foreground'>{row.value}</div>
        </div>
      ))}
    </div>
  );
}

function formatBytes(bytes, decimals = 2) {
  if (bytes === null || bytes === undefined || isNaN(bytes)) return '0 Bytes';
  if (bytes === 0) return '0 Bytes';
  if (bytes < 0) return '-' + formatBytes(-bytes, decimals);
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  if (i < 0 || i >= sizes.length) return bytes + ' Bytes';
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

const INITIAL_INPUTS = {
  'performance_setting.disk_cache_enabled': false,
  'performance_setting.disk_cache_threshold_mb': 10,
  'performance_setting.disk_cache_max_size_mb': 1024,
  'performance_setting.disk_cache_path': '',
  'performance_setting.monitor_enabled': false,
  'performance_setting.monitor_cpu_threshold': 90,
  'performance_setting.monitor_memory_threshold': 90,
  'performance_setting.monitor_disk_threshold': 95,
};

// ----------------------------- main -----------------------------

export default function SettingsPerformance(props) {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [statsLoading, setStatsLoading] = useState(false);
  const [stats, setStats] = useState(null);
  const [inputs, setInputs] = useState(INITIAL_INPUTS);
  const [inputsRow, setInputsRow] = useState(INITIAL_INPUTS);

  const [logInfo, setLogInfo] = useState(null);
  const [logCleanupMode, setLogCleanupMode] = useState('by_count');
  const [logCleanupValue, setLogCleanupValue] = useState(10);
  const [logCleanupLoading, setLogCleanupLoading] = useState(false);

  // ConfirmDialog state
  const [confirmCleanupLogs, setConfirmCleanupLogs] = useState(false);
  const [confirmClearCache, setConfirmClearCache] = useState(false);

  const setField = (key) => (value) => {
    setInputs((prev) => ({ ...prev, [key]: value }));
  };

  const setNumberField = (key) => (event) => {
    const raw = event?.target ? event.target.value : event;
    if (raw === '' || raw === null) {
      setField(key)('');
      return;
    }
    const num = Number(raw);
    if (Number.isNaN(num)) return;
    setField(key)(num);
  };

  function onSubmit() {
    const updateArray = compareObjects(inputs, inputsRow);
    if (!updateArray.length) return showWarning(t('你似乎并没有修改什么'));
    const requestQueue = updateArray.map((item) => {
      let value = '';
      if (typeof inputs[item.key] === 'boolean') {
        value = String(inputs[item.key]);
      } else {
        value = String(inputs[item.key]);
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
        fetchStats();
      })
      .catch(() => {
        showError(t('保存失败，请重试'));
      })
      .finally(() => {
        setLoading(false);
      });
  }

  async function fetchStats() {
    setStatsLoading(true);
    try {
      const res = await API.get('/api/performance/stats');
      if (res.data.success) {
        setStats(res.data.data);
      }
    } catch (error) {
      console.error('Failed to fetch performance stats:', error);
    } finally {
      setStatsLoading(false);
    }
  }

  async function clearDiskCache() {
    try {
      const res = await API.delete('/api/performance/disk_cache');
      if (res.data.success) {
        showSuccess(t('磁盘缓存已清理'));
        fetchStats();
      } else {
        showError(res.data.message || t('清理失败'));
      }
    } catch (error) {
      showError(t('清理失败'));
    }
  }

  async function resetStats() {
    try {
      const res = await API.post('/api/performance/reset_stats');
      if (res.data.success) {
        showSuccess(t('统计已重置'));
        fetchStats();
      }
    } catch (error) {
      showError(t('重置失败'));
    }
  }

  async function forceGC() {
    try {
      const res = await API.post('/api/performance/gc');
      if (res.data.success) {
        showSuccess(t('GC 已执行'));
        fetchStats();
      }
    } catch (error) {
      showError(t('GC 执行失败'));
    }
  }

  async function fetchLogInfo() {
    try {
      const res = await API.get('/api/performance/logs');
      if (res.data.success) {
        setLogInfo(res.data.data);
      }
    } catch (error) {
      console.error('Failed to fetch log info:', error);
    }
  }

  async function cleanupLogFiles() {
    if (
      logCleanupValue == null ||
      isNaN(logCleanupValue) ||
      logCleanupValue < 1
    ) {
      showError(t('请输入有效的数值'));
      return;
    }
    setLogCleanupLoading(true);
    try {
      const res = await API.delete(
        `/api/performance/logs?mode=${logCleanupMode}&value=${logCleanupValue}`,
      );
      if (res.data.success) {
        const { deleted_count, freed_bytes } = res.data.data;
        showSuccess(
          t('已清理 {{count}} 个日志文件，释放 {{size}}', {
            count: deleted_count,
            size: formatBytes(freed_bytes),
          }),
        );
      } else {
        showError(res.data.message || t('清理失败'));
      }
      fetchLogInfo();
    } catch (error) {
      showError(t('清理失败'));
    } finally {
      setLogCleanupLoading(false);
    }
  }

  useEffect(() => {
    const currentInputs = {};
    for (const key in props.options) {
      if (Object.keys(INITIAL_INPUTS).includes(key)) {
        if (typeof INITIAL_INPUTS[key] === 'boolean') {
          currentInputs[key] =
            props.options[key] === 'true' || props.options[key] === true;
        } else if (typeof INITIAL_INPUTS[key] === 'number') {
          currentInputs[key] =
            parseInt(props.options[key]) || INITIAL_INPUTS[key];
        } else {
          currentInputs[key] = props.options[key];
        }
      }
    }
    const merged = { ...INITIAL_INPUTS, ...currentInputs };
    setInputs(merged);
    setInputsRow(merged);
    fetchStats();
    fetchLogInfo();
  }, [props.options]);

  const diskCacheUsagePercent =
    stats?.cache_stats?.disk_cache_max_bytes > 0
      ? (
          (stats.cache_stats.current_disk_usage_bytes /
            stats.cache_stats.disk_cache_max_bytes) *
          100
        ).toFixed(1)
      : 0;

  const diskCacheEnabled = !!inputs['performance_setting.disk_cache_enabled'];
  const monitorEnabled = !!inputs['performance_setting.monitor_enabled'];

  return (
    <>
      <div className='relative space-y-8'>
        {loading && (
          <div className='absolute inset-0 z-10 flex items-center justify-center bg-background/60 backdrop-blur-[1px]'>
            <Spinner color='primary' />
          </div>
        )}

        {/* 磁盘缓存设置 */}
        <div className='space-y-4'>
          <SectionHeader title={t('磁盘缓存设置（磁盘换内存）')} />
          <InfoBanner>
            {t(
              '启用磁盘缓存后，大请求体将临时存储到磁盘而非内存，可显著降低内存占用，适用于处理包含大量图片/文件的请求。建议在 SSD 环境下使用。',
            )}
          </InfoBanner>
          <div className='grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3'>
            <SwitchRow
              label={t('启用磁盘缓存')}
              hint={t('将大请求体临时存储到磁盘')}
              value={inputs['performance_setting.disk_cache_enabled']}
              onChange={setField('performance_setting.disk_cache_enabled')}
            />
            <div className='space-y-2'>
              <FieldLabel>{t('磁盘缓存阈值 (MB)')}</FieldLabel>
              <input
                type='number'
                min={1}
                max={1024}
                value={inputs['performance_setting.disk_cache_threshold_mb']}
                onChange={setNumberField(
                  'performance_setting.disk_cache_threshold_mb',
                )}
                disabled={!diskCacheEnabled}
                className={inputClass}
              />
              <FieldHint>{t('请求体超过此大小时使用磁盘缓存')}</FieldHint>
            </div>
            <div className='space-y-2'>
              <FieldLabel>{t('磁盘缓存最大总量 (MB)')}</FieldLabel>
              <input
                type='number'
                min={100}
                max={102400}
                value={inputs['performance_setting.disk_cache_max_size_mb']}
                onChange={setNumberField(
                  'performance_setting.disk_cache_max_size_mb',
                )}
                disabled={!diskCacheEnabled}
                className={inputClass}
              />
              <FieldHint>
                {stats?.disk_space_info?.total > 0
                  ? t('可用空间: {{free}} / 总空间: {{total}}', {
                      free: formatBytes(stats.disk_space_info.free),
                      total: formatBytes(stats.disk_space_info.total),
                    })
                  : t('磁盘缓存占用的最大空间')}
              </FieldHint>
            </div>
            {!stats?.config?.is_running_in_container && (
              <div className='space-y-2'>
                <FieldLabel>{t('缓存目录')}</FieldLabel>
                <input
                  type='text'
                  value={inputs['performance_setting.disk_cache_path']}
                  onChange={(event) =>
                    setField('performance_setting.disk_cache_path')(
                      event.target.value,
                    )
                  }
                  placeholder={t('例如 /var/cache/new-api')}
                  disabled={!diskCacheEnabled}
                  className={inputClass}
                />
                <FieldHint>{t('留空使用系统临时目录')}</FieldHint>
              </div>
            )}
          </div>
        </div>

        {/* 系统性能监控 */}
        <div className='space-y-4'>
          <SectionHeader title={t('系统性能监控')} />
          <InfoBanner>
            {t(
              '启用性能监控后，当系统资源使用率超过设定阈值时，将拒绝新的 Relay 请求 (/v1, /v1beta 等)，以保护系统稳定性。',
            )}
          </InfoBanner>
          <div className='grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-4'>
            <SwitchRow
              label={t('启用性能监控')}
              hint={t('超过阈值时拒绝新请求')}
              value={inputs['performance_setting.monitor_enabled']}
              onChange={setField('performance_setting.monitor_enabled')}
            />
            <div className='space-y-2'>
              <FieldLabel>{t('CPU 阈值 (%)')}</FieldLabel>
              <input
                type='number'
                min={0}
                value={inputs['performance_setting.monitor_cpu_threshold']}
                onChange={setNumberField(
                  'performance_setting.monitor_cpu_threshold',
                )}
                disabled={!monitorEnabled}
                className={inputClass}
              />
              <FieldHint>{t('CPU 使用率超过此值时拒绝请求')}</FieldHint>
            </div>
            <div className='space-y-2'>
              <FieldLabel>{t('内存 阈值 (%)')}</FieldLabel>
              <input
                type='number'
                min={0}
                max={100}
                value={inputs['performance_setting.monitor_memory_threshold']}
                onChange={setNumberField(
                  'performance_setting.monitor_memory_threshold',
                )}
                disabled={!monitorEnabled}
                className={inputClass}
              />
              <FieldHint>{t('内存使用率超过此值时拒绝请求')}</FieldHint>
            </div>
            <div className='space-y-2'>
              <FieldLabel>{t('磁盘 阈值 (%)')}</FieldLabel>
              <input
                type='number'
                min={0}
                max={100}
                value={inputs['performance_setting.monitor_disk_threshold']}
                onChange={setNumberField(
                  'performance_setting.monitor_disk_threshold',
                )}
                disabled={!monitorEnabled}
                className={inputClass}
              />
              <FieldHint>{t('磁盘使用率超过此值时拒绝请求')}</FieldHint>
            </div>
          </div>
          <div>
            <Button color='primary' onPress={onSubmit}>
              {t('保存性能设置')}
            </Button>
          </div>
        </div>

        {/* 服务器日志管理 */}
        <div className='space-y-4'>
          <SectionHeader title={t('服务器日志管理')} />
          <InfoBanner>
            {t(
              '管理服务器运行日志文件。日志文件会随运行时间不断累积，建议定期清理以释放磁盘空间。',
            )}
          </InfoBanner>
          {logInfo === null ? null : logInfo.enabled ? (
            <>
              <DescList
                rows={[
                  { key: t('日志目录'), value: logInfo.log_dir },
                  { key: t('日志文件数'), value: logInfo.file_count },
                  {
                    key: t('日志总大小'),
                    value: formatBytes(logInfo.total_size),
                  },
                  ...(logInfo.oldest_time && logInfo.newest_time
                    ? [
                        {
                          key: t('日志时间范围'),
                          value: `${new Date(logInfo.oldest_time).toLocaleDateString()} ~ ${new Date(logInfo.newest_time).toLocaleDateString()}`,
                        },
                      ]
                    : []),
                ]}
              />
              <div className='grid grid-cols-1 gap-4 md:grid-cols-3'>
                <div className='space-y-2'>
                  <FieldLabel>{t('清理方式')}</FieldLabel>
                  <div className='inline-flex w-full overflow-hidden rounded-xl border border-border'>
                    {[
                      { value: 'by_count', label: t('保留最近N个文件') },
                      { value: 'by_days', label: t('保留最近N天') },
                    ].map((mode) => {
                      const active = mode.value === logCleanupMode;
                      return (
                        <button
                          key={mode.value}
                          type='button'
                          onClick={() => setLogCleanupMode(mode.value)}
                          className={`flex-1 px-3 py-2 text-sm font-medium transition-colors ${
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
                </div>
                <div className='space-y-2'>
                  <FieldLabel>
                    {logCleanupMode === 'by_count'
                      ? t('保留文件数')
                      : t('保留天数')}
                  </FieldLabel>
                  <input
                    type='number'
                    min={1}
                    max={logCleanupMode === 'by_count' ? 1000 : 3650}
                    value={logCleanupValue}
                    onChange={(event) => {
                      const raw = event.target.value;
                      setLogCleanupValue(raw === '' ? '' : Number(raw));
                    }}
                    className={inputClass}
                  />
                </div>
                <div className='flex items-end'>
                  <Button
                    color='danger'
                    isPending={logCleanupLoading}
                    onPress={() => setConfirmCleanupLogs(true)}
                  >
                    {t('清理日志文件')}
                  </Button>
                </div>
              </div>
            </>
          ) : (
            <InfoBanner tone='warning'>
              {t('服务器日志功能未启用（未配置日志目录）')}
            </InfoBanner>
          )}
        </div>

        {/* 性能监控 */}
        <div className='relative space-y-4'>
          {statsLoading && (
            <div className='absolute inset-0 z-10 flex items-center justify-center bg-background/60 backdrop-blur-[1px]'>
              <Spinner color='primary' />
            </div>
          )}
          <SectionHeader title={t('性能监控')} />

          <div className='flex flex-wrap items-center gap-2'>
            <Button variant='tertiary' onPress={fetchStats}>
              {t('刷新统计')}
            </Button>
            <Button
              color='warning'
              onPress={() => setConfirmClearCache(true)}
            >
              {t('清理不活跃缓存')}
            </Button>
            <Button variant='tertiary' onPress={resetStats}>
              {t('重置统计')}
            </Button>
            <Button variant='tertiary' onPress={forceGC}>
              {t('执行 GC')}
            </Button>
          </div>

          {stats && stats.cache_stats && (
            <>
              {/* 缓存使用情况 */}
              <div className='grid grid-cols-1 gap-4 md:grid-cols-2'>
                <div className='flex h-full flex-col rounded-xl border border-border bg-background p-4'>
                  <div className='mb-2 text-sm font-semibold text-foreground'>
                    {t('请求体磁盘缓存')}
                  </div>
                  <div className='mb-2'>
                    <ProgressBar
                      percent={parseFloat(diskCacheUsagePercent)}
                      tone={
                        parseFloat(diskCacheUsagePercent) > 80
                          ? 'danger'
                          : 'primary'
                      }
                    />
                  </div>
                  <div className='mb-2 flex justify-between text-xs text-muted'>
                    <span>
                      {formatBytes(
                        stats.cache_stats.current_disk_usage_bytes,
                      )}{' '}
                      / {formatBytes(stats.cache_stats.disk_cache_max_bytes)}
                    </span>
                    <span>
                      {t('活跃文件')}: {stats.cache_stats.active_disk_files}
                    </span>
                  </div>
                  <div className='mt-auto'>
                    <StatusChip tone='blue'>
                      {t('磁盘命中')}: {stats.cache_stats.disk_cache_hits}
                    </StatusChip>
                  </div>
                </div>

                <div className='flex h-full flex-col rounded-xl border border-border bg-background p-4'>
                  <div className='mb-2 text-sm font-semibold text-foreground'>
                    {t('请求体内存缓存')}
                  </div>
                  <div className='mb-2 flex justify-between text-sm text-foreground'>
                    <span>
                      {t('当前缓存大小')}:{' '}
                      {formatBytes(
                        stats.cache_stats.current_memory_usage_bytes,
                      )}
                    </span>
                    <span>
                      {t('活跃缓存数')}:{' '}
                      {stats.cache_stats.active_memory_buffers}
                    </span>
                  </div>
                  <div className='mt-auto'>
                    <StatusChip tone='green'>
                      {t('内存命中')}: {stats.cache_stats.memory_cache_hits}
                    </StatusChip>
                  </div>
                </div>
              </div>

              {/* 缓存目录磁盘空间 */}
              {stats.disk_space_info?.total > 0 && (
                <div className='rounded-xl border border-border bg-background p-4'>
                  <div className='mb-2 text-sm font-semibold text-foreground'>
                    {t('缓存目录磁盘空间')}
                  </div>
                  <div className='mb-2'>
                    <ProgressBar
                      percent={parseFloat(
                        stats.disk_space_info.used_percent.toFixed(1),
                      )}
                      tone={
                        stats.disk_space_info.used_percent > 90
                          ? 'danger'
                          : stats.disk_space_info.used_percent > 70
                            ? 'warning'
                            : 'primary'
                      }
                    />
                  </div>
                  <div className='flex flex-wrap justify-between gap-2 text-xs text-muted'>
                    <span>
                      {t('已用')}: {formatBytes(stats.disk_space_info.used)}
                    </span>
                    <span>
                      {t('可用')}: {formatBytes(stats.disk_space_info.free)}
                    </span>
                    <span>
                      {t('总计')}: {formatBytes(stats.disk_space_info.total)}
                    </span>
                  </div>
                  {stats.disk_space_info.free <
                    inputs['performance_setting.disk_cache_max_size_mb'] *
                      1024 *
                      1024 && (
                    <div className='mt-2'>
                      <InfoBanner tone='warning'>
                        {t('磁盘可用空间小于缓存最大总量设置')}
                      </InfoBanner>
                    </div>
                  )}
                </div>
              )}

              {/* 系统内存统计 */}
              <DescList
                rows={[
                  {
                    key: t('已分配内存'),
                    value: formatBytes(stats.memory_stats.alloc),
                  },
                  {
                    key: t('总分配内存'),
                    value: formatBytes(stats.memory_stats.total_alloc),
                  },
                  {
                    key: t('系统内存'),
                    value: formatBytes(stats.memory_stats.sys),
                  },
                  { key: t('GC 次数'), value: stats.memory_stats.num_gc },
                  {
                    key: t('Goroutine 数'),
                    value: stats.memory_stats.num_goroutine,
                  },
                  { key: t('缓存目录'), value: stats.disk_cache_info.path },
                  {
                    key: t('目录文件数'),
                    value: stats.disk_cache_info.file_count,
                  },
                  {
                    key: t('目录总大小'),
                    value: formatBytes(stats.disk_cache_info.total_size),
                  },
                ]}
              />
            </>
          )}
        </div>
      </div>

      {/* 清理日志确认 */}
      <ConfirmDialog
        visible={confirmCleanupLogs}
        title={t('确认清理日志文件？')}
        cancelText={t('取消')}
        confirmText={t('确认')}
        danger
        onCancel={() => setConfirmCleanupLogs(false)}
        onConfirm={async () => {
          setConfirmCleanupLogs(false);
          await cleanupLogFiles();
        }}
      >
        {logCleanupMode === 'by_count'
          ? t('将只保留最近 {{value}} 个日志文件，其余将被删除。', {
              value: logCleanupValue,
            })
          : t('将删除 {{value}} 天前的日志文件。', {
              value: logCleanupValue,
            })}
      </ConfirmDialog>

      {/* 清理不活跃缓存确认 */}
      <ConfirmDialog
        visible={confirmClearCache}
        title={t('确认清理不活跃的磁盘缓存？')}
        cancelText={t('取消')}
        confirmText={t('确认')}
        onCancel={() => setConfirmClearCache(false)}
        onConfirm={async () => {
          setConfirmClearCache(false);
          await clearDiskCache();
        }}
      >
        {t('这将删除超过 10 分钟未使用的临时缓存文件')}
      </ConfirmDialog>
    </>
  );
}
