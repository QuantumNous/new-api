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

import React, { useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Banner,
  Button,
  Card,
  Collapse,
  Dropdown,
  Empty,
  Space,
  Spin,
  Table,
  Tag,
  TextArea,
  Tooltip,
  Typography,
} from '@douyinfe/semi-ui';
import {
  IconAlertTriangle,
  IconCopy,
  IconRefresh,
  IconSearch,
} from '@douyinfe/semi-icons';
import {
  API,
  copy,
  getChannelIcon,
  renderGroup,
  renderQuota,
  renderQuotaWithAmount,
  showError,
  showInfo,
  showSuccess,
} from '../../helpers';
import { CHANNEL_OPTIONS } from '../../constants';

const { Text, Title } = Typography;

const STATUS_CONFIG = {
  found: { color: 'green', label: '已找到' },
  not_found: { color: 'grey', label: '未找到' },
  over_brushed: { color: 'red', label: '已超刷' },
};

const SOURCE_CONFIG = {
  channel: { color: 'green', label: '正式渠道' },
  preparation: { color: 'blue', label: '备货池' },
};

const QUERY_KEY_TEST_STATUS = {
  untested: { color: 'grey', label: '未测试' },
  testing: { color: 'blue', label: '测试中' },
  success: { color: 'green', label: '成功' },
  failed: { color: 'red', label: '失败' },
  partial: { color: 'orange', label: '部分成功' },
};

const DEFAULT_BATCH_TEST_MODEL = '';
const DEFAULT_BATCH_TEST_MODEL_LABEL = '使用渠道配置的测试模型';

const BUCKETS = [
  { key: 'all', label: '全部' },
  { key: 'found', label: '已找到' },
  { key: 'not_found', label: '未找到' },
  { key: 'over_brushed', label: '已超刷' },
];

const stableStringify = (value) => {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
};

const normalizeMatchKey = (value) => {
  const trimmed = String(value || '').trim();
  if (!trimmed) return '';
  try {
    const parsed = JSON.parse(trimmed);
    if (typeof parsed === 'string') return parsed.trim();
    if (parsed === null || parsed === undefined) return '';
    return stableStringify(parsed);
  } catch (error) {
    return trimmed;
  }
};

const parseKeyInput = (text) => {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const seen = new Set();
  const keys = [];

  lines.forEach((line) => {
    const matchKey = normalizeMatchKey(line);
    if (!matchKey || seen.has(matchKey)) return;
    seen.add(matchKey);
    keys.push(line);
  });

  return {
    keys,
    totalInput: lines.length,
    duplicateCount: lines.length - keys.length,
  };
};

const formatDate = (timestamp) => {
  if (!timestamp) return '-';
  return new Date(timestamp * 1000).toLocaleString();
};

const channelTypeLabel = (type) => {
  const option = CHANNEL_OPTIONS.find((item) => item.value === type);
  return option?.label || type || '-';
};

const getStatusConfig = (status) =>
  STATUS_CONFIG[status] || STATUS_CONFIG.not_found;

const getSourceConfig = (source) =>
  SOURCE_CONFIG[source || 'channel'] || SOURCE_CONFIG.channel;

const normalizeCopyCell = (value) => {
  if (value === null || value === undefined) return '';
  return String(value).replace(/\t/g, ' ').replace(/\r?\n/g, ' ');
};

const buildTsv = (rows, columns, includeHeader) => {
  const lines = [];
  if (includeHeader) {
    lines.push(columns.map((column) => normalizeCopyCell(column.label)).join('\t'));
  }
  rows.forEach((row) => {
    lines.push(
      columns.map((column) => normalizeCopyCell(column.getValue(row))).join('\t'),
    );
  });
  return lines.join('\n');
};

const buildQueryKeyTestId = (key, channel) =>
  `${normalizeMatchKey(key)}::${channel?.source || 'channel'}::${channel?.id}`;

const MetricCard = ({ title, value, color }) => (
  <Card className='!rounded-xl' bodyStyle={{ padding: 16 }}>
    <div className='text-sm text-semi-color-text-2'>{title}</div>
    <div className='mt-1 text-2xl font-semibold' style={{ color }}>
      {value}
    </div>
  </Card>
);

const QueryKeyPage = () => {
  const { t } = useTranslation();
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState(null);
  const [activeBucket, setActiveBucket] = useState('all');
  const [queryKeyTestResults, setQueryKeyTestResults] = useState({});
  const [testingQueryKeyIds, setTestingQueryKeyIds] = useState(new Set());
  const [isQueryKeyBatchTesting, setIsQueryKeyBatchTesting] = useState(false);
  const [queryKeyBatchProgress, setQueryKeyBatchProgress] = useState({
    finished: 0,
    total: 0,
  });
  const shouldStopQueryKeyBatchTestingRef = useRef(false);

  const parsed = useMemo(() => parseKeyInput(inputText), [inputText]);
  const items = Array.isArray(report?.items) ? report.items : [];

  const filteredItems = useMemo(() => {
    if (activeBucket === 'all') return items;
    if (activeBucket === 'found') return items.filter((item) => item.found);
    return items.filter((item) => item.status === activeBucket);
  }, [activeBucket, items]);

  const bucketCounts = {
    all: items.length,
    found: report?.found_count || 0,
    not_found: report?.not_found_count || 0,
    over_brushed: report?.over_brushed_count || 0,
  };

  const submitReport = async () => {
    if (loading || isQueryKeyBatchTesting) return;
    if (parsed.keys.length === 0) {
      showError(t('请输入密钥'));
      return;
    }
    if (parsed.keys.length > 10000) {
      showError(t('最多支持 10000 个唯一密钥'));
      return;
    }

    setLoading(true);
    try {
      const res = await API.post('/api/channel/query-key/report', {
        keys: parsed.keys,
      });
      const { success, message, data } = res.data || {};
      if (!success) {
        showError(message || t('查询失败'));
        return;
      }
      setReport(data);
      setActiveBucket('all');
      setQueryKeyTestResults({});
      setTestingQueryKeyIds(new Set());
      setQueryKeyBatchProgress({ finished: 0, total: 0 });
      shouldStopQueryKeyBatchTestingRef.current = false;
      showSuccess(t('查询完成'));
    } catch (error) {
      showError(
        error?.response?.data?.message || error?.message || t('网络错误'),
      );
    } finally {
      setLoading(false);
    }
  };

  const clearAll = () => {
    if (loading || isQueryKeyBatchTesting) return;
    setInputText('');
    setReport(null);
    setActiveBucket('all');
    setQueryKeyTestResults({});
    setTestingQueryKeyIds(new Set());
    setQueryKeyBatchProgress({ finished: 0, total: 0 });
    shouldStopQueryKeyBatchTestingRef.current = false;
  };

  const copyKey = async (value) => {
    const ok = await copy(value || '');
    if (ok) showSuccess(t('已复制'));
    else showError(t('复制失败'));
  };

  const getStatusLabel = (item) => {
    const config = getStatusConfig(item.status);
    const labels = [t(config.label)];
    if (item.original_amount_shared) {
      labels.push(t('原始额度为共享余额'));
    }
    return labels.join(' / ');
  };

  const getChannelStatusLabel = (channel) => {
    return getChannelStatusMeta(channel).label;
  };

  const getChannelStatusMeta = (channel) => {
    if (!channel) return { color: 'grey', label: t('未找到') };
    if (channel.source === 'preparation') {
      if (channel.status === 2) return { color: 'green', label: t('已晋升') };
      if (channel.status === 3) return { color: 'grey', label: t('已归档') };
      if (channel.status === 4) return { color: 'orange', label: t('晋升中') };
      return { color: 'blue', label: t('待晋升') };
    }
    return channel.status === 1
      ? { color: 'green', label: t('已启用') }
      : { color: 'grey', label: t('已禁用') };
  };

  const getItemChannels = (item) =>
    Array.isArray(item?.channels) ? item.channels : [];

  const buildQueryKeyBatchTasks = (rows) =>
    rows.flatMap((item) =>
      getItemChannels(item).map((channel) => ({
        item,
        channel,
      })),
    );

  const getItemChannelStatusText = (item) => {
    const channels = getItemChannels(item);
    if (channels.length === 0) return t('未找到');
    const counts = channels.reduce((acc, channel) => {
      const label = getChannelStatusMeta(channel).label;
      acc[label] = (acc[label] || 0) + 1;
      return acc;
    }, {});
    return Object.entries(counts)
      .map(([label, count]) => (channels.length === 1 ? label : `${label} ${count}`))
      .join(' / ');
  };

  const renderItemChannelStatus = (item) => {
    const channels = getItemChannels(item);
    if (channels.length === 0) return <Tag color='grey'>{t('未找到')}</Tag>;
    const counts = channels.reduce((acc, channel) => {
      const meta = getChannelStatusMeta(channel);
      if (!acc[meta.label]) acc[meta.label] = { ...meta, count: 0 };
      acc[meta.label].count += 1;
      return acc;
    }, {});
    return (
      <Space wrap>
        {Object.values(counts).map((meta) => (
          <Tag key={meta.label} color={meta.color}>
            {meta.label}
            {channels.length > 1 ? ` ${meta.count}` : ''}
          </Tag>
        ))}
      </Space>
    );
  };

  const getQueryKeyTestResult = (item, channel) =>
    queryKeyTestResults[buildQueryKeyTestId(item?.key, channel)];

  const isQueryKeyTesting = (item, channel) =>
    testingQueryKeyIds.has(buildQueryKeyTestId(item?.key, channel));

  const getItemTestSummary = (item) => {
    const channels = getItemChannels(item);
    const results = channels
      .map((channel) => getQueryKeyTestResult(item, channel))
      .filter(Boolean);
    const testingCount = channels.filter((channel) =>
      isQueryKeyTesting(item, channel),
    ).length;
    const successCount = results.filter((result) => result.success).length;
    const failedCount = results.filter((result) => !result.success).length;
    const responseTimes = results
      .filter((result) => typeof result.time === 'number')
      .map((result) => result.time);
    return {
      total: channels.length,
      tested: results.length,
      testingCount,
      successCount,
      failedCount,
      fastestTime:
        responseTimes.length > 0 ? Math.min(...responseTimes) : null,
      firstFailure: results.find((result) => !result.success),
    };
  };

  const getQueryKeyTestStatusText = (item) => {
    const summary = getItemTestSummary(item);
    if (summary.total === 0) return '-';
    if (summary.testingCount > 0) return t('测试中');
    if (summary.tested === 0) return t('未测试');
    if (summary.total === 1) {
      return summary.successCount === 1 ? t('成功') : t('失败');
    }
    if (summary.failedCount === 0 && summary.tested === summary.total) {
      return t('全部成功');
    }
    if (summary.successCount > 0) {
      return `${t('部分成功')} ${summary.successCount}/${summary.tested}`;
    }
    return `${t('全部失败')} ${summary.failedCount}/${summary.tested}`;
  };

  const getQueryKeyResponseTimeText = (item) => {
    const summary = getItemTestSummary(item);
    if (summary.testingCount > 0) return t('测试中');
    if (summary.fastestTime === null) return '-';
    return `${summary.fastestTime.toFixed(2)}s`;
  };

  const getSingleTestStatusText = (item, channel) => {
    if (isQueryKeyTesting(item, channel)) return t('测试中');
    const result = getQueryKeyTestResult(item, channel);
    if (!result) return t('未测试');
    return result.success ? t('成功') : t('失败');
  };

  const getSingleResponseTimeText = (item, channel) => {
    if (isQueryKeyTesting(item, channel)) return t('测试中');
    const result = getQueryKeyTestResult(item, channel);
    if (!result || typeof result.time !== 'number') return '-';
    return `${result.time.toFixed(2)}s`;
  };

  const renderSingleTestStatus = (item, channel) => {
    if (isQueryKeyTesting(item, channel)) {
      return <Tag color={QUERY_KEY_TEST_STATUS.testing.color}>{t('测试中')}</Tag>;
    }
    const result = getQueryKeyTestResult(item, channel);
    if (!result) {
      return <Tag color={QUERY_KEY_TEST_STATUS.untested.color}>{t('未测试')}</Tag>;
    }
    const tag = (
      <Tag
        color={
          result.success
            ? QUERY_KEY_TEST_STATUS.success.color
            : QUERY_KEY_TEST_STATUS.failed.color
        }
      >
        {result.success ? t('成功') : t('失败')}
      </Tag>
    );
    if (!result.success && result.message) {
      return <Tooltip content={result.message}>{tag}</Tooltip>;
    }
    return tag;
  };

  const renderItemTestStatus = (item) => {
    const summary = getItemTestSummary(item);
    if (summary.total === 0) return <Text type='tertiary'>-</Text>;
    if (summary.testingCount > 0) {
      return (
        <Tag color={QUERY_KEY_TEST_STATUS.testing.color}>
          {t('测试中')} {summary.testingCount}/{summary.total}
        </Tag>
      );
    }
    if (summary.tested === 0) {
      return <Tag color={QUERY_KEY_TEST_STATUS.untested.color}>{t('未测试')}</Tag>;
    }
    if (summary.total === 1) {
      const channel = getItemChannels(item)[0];
      return renderSingleTestStatus(item, channel);
    }
    const allSuccess =
      summary.successCount === summary.total && summary.tested === summary.total;
    const allFailed = summary.failedCount === summary.tested;
    const color = allSuccess
      ? QUERY_KEY_TEST_STATUS.success.color
      : allFailed
        ? QUERY_KEY_TEST_STATUS.failed.color
        : QUERY_KEY_TEST_STATUS.partial.color;
    const tag = (
      <Tag color={color}>
        {allSuccess
          ? t('全部成功')
          : allFailed
            ? t('全部失败')
            : t('部分成功')}{' '}
        {summary.successCount}/{summary.tested}
      </Tag>
    );
    if (summary.firstFailure?.message) {
      return <Tooltip content={summary.firstFailure.message}>{tag}</Tooltip>;
    }
    return tag;
  };

  const renderSingleResponseTime = (item, channel) => {
    if (isQueryKeyTesting(item, channel)) return <Text type='tertiary'>{t('测试中')}</Text>;
    const result = getQueryKeyTestResult(item, channel);
    if (!result || typeof result.time !== 'number') return <Text type='tertiary'>-</Text>;
    return <Text>{result.time.toFixed(2)}s</Text>;
  };

  const renderItemResponseTime = (item) => {
    const summary = getItemTestSummary(item);
    if (summary.testingCount > 0) return <Text type='tertiary'>{t('测试中')}</Text>;
    if (summary.fastestTime === null) return <Text type='tertiary'>-</Text>;
    return <Text>{summary.fastestTime.toFixed(2)}s</Text>;
  };

  const testQueryKeyChannel = async (item, channel, options = {}) => {
    const testId = buildQueryKeyTestId(item?.key, channel);
    if (!item?.key || !channel?.id || testingQueryKeyIds.has(testId)) return null;

    setTestingQueryKeyIds((previous) => {
      const next = new Set(previous);
      next.add(testId);
      return next;
    });

    try {
      const res = await API.post('/api/channel/query-key/test', {
        key: item.key,
        source: channel.source || 'channel',
        target_id: channel.id,
        model: options.model || DEFAULT_BATCH_TEST_MODEL,
        endpoint_type: options.endpointType || '',
        stream: Boolean(options.stream),
      });
      const payload = res.data || {};
      const result = {
        success: Boolean(payload.success),
        message: payload.message || '',
        time: typeof payload.time === 'number' ? payload.time : 0,
        errorCode: payload.error_code || '',
      };
      setQueryKeyTestResults((previous) => ({
        ...previous,
        [testId]: result,
      }));
      if (!options.silent) {
        if (result.success) {
          showSuccess(t('测试成功'));
        } else {
          showError(result.message || t('测试失败'));
        }
      }
      return result;
    } catch (error) {
      const result = {
        success: false,
        message:
          error?.response?.data?.message || error?.message || t('网络错误'),
        time: 0,
        errorCode: '',
      };
      setQueryKeyTestResults((previous) => ({
        ...previous,
        [testId]: result,
      }));
      if (!options.silent) showError(result.message);
      return result;
    } finally {
      setTestingQueryKeyIds((previous) => {
        const next = new Set(previous);
        next.delete(testId);
        return next;
      });
    }
  };

  const testQueryKeyItem = async (item) => {
    const channels = getItemChannels(item);
    if (channels.length === 0) {
      showError(t('没有匹配的渠道'));
      return;
    }
    if (channels.length === 1) {
      await testQueryKeyChannel(item, channels[0], {
        model: DEFAULT_BATCH_TEST_MODEL,
      });
      return;
    }

    const results = [];
    for (const channel of channels) {
      // Keep tests sequential to avoid creating an accidental upstream burst.
      // eslint-disable-next-line no-await-in-loop
      const result = await testQueryKeyChannel(item, channel, {
        silent: true,
        model: DEFAULT_BATCH_TEST_MODEL,
      });
      if (result) results.push(result);
    }
    const successCount = results.filter((result) => result.success).length;
    const failedCount = results.length - successCount;
    if (failedCount === 0) {
      showSuccess(t('测试完成：全部成功'));
    } else {
      showError(
        t('测试完成：成功 {{success}} / 失败 {{failed}}')
          .replace('{{success}}', successCount)
          .replace('{{failed}}', failedCount),
      );
    }
  };

  const batchTestQueryKeyItems = async (scope) => {
    if (isQueryKeyBatchTesting) {
      showInfo(t('批量测试正在进行中'));
      return;
    }

    const sourceRows = scope === 'filtered' ? filteredItems : items;
    const tasks = buildQueryKeyBatchTasks(sourceRows);
    if (tasks.length === 0) {
      showError(t('没有可测试的渠道'));
      return;
    }

    const taskIds = new Set(
      tasks.map(({ item, channel }) => buildQueryKeyTestId(item.key, channel)),
    );
    setQueryKeyTestResults((previous) => {
      const next = { ...previous };
      taskIds.forEach((testId) => {
        delete next[testId];
      });
      return next;
    });

    setIsQueryKeyBatchTesting(true);
    setQueryKeyBatchProgress({ finished: 0, total: tasks.length });
    shouldStopQueryKeyBatchTestingRef.current = false;

    let successCount = 0;
    let failedCount = 0;
    let finishedCount = 0;
    const concurrencyLimit = 5;

    try {
      for (let i = 0; i < tasks.length; i += concurrencyLimit) {
        if (shouldStopQueryKeyBatchTestingRef.current) break;
        const batch = tasks.slice(i, i + concurrencyLimit);
        // eslint-disable-next-line no-await-in-loop
        const results = await Promise.allSettled(
          batch.map(({ item, channel }) =>
            testQueryKeyChannel(item, channel, {
              silent: true,
              model: DEFAULT_BATCH_TEST_MODEL,
            }),
          ),
        );
        results.forEach((result) => {
          finishedCount += 1;
          if (result.status === 'fulfilled' && result.value?.success) {
            successCount += 1;
          } else {
            failedCount += 1;
          }
        });
        setQueryKeyBatchProgress({
          finished: finishedCount,
          total: tasks.length,
        });
      }

      if (shouldStopQueryKeyBatchTestingRef.current) {
        showInfo(
          t('批量测试已停止：完成 {{finished}} / {{total}}')
            .replace('{{finished}}', finishedCount)
            .replace('{{total}}', tasks.length),
        );
      } else if (failedCount === 0) {
        showSuccess(
          t('批量测试完成：全部成功，共 {{count}} 个')
            .replace('{{count}}', successCount),
        );
      } else {
        showError(
          t('批量测试完成：成功 {{success}} / 失败 {{failed}}')
            .replace('{{success}}', successCount)
            .replace('{{failed}}', failedCount),
        );
      }
    } finally {
      setIsQueryKeyBatchTesting(false);
      shouldStopQueryKeyBatchTestingRef.current = false;
    }
  };

  const stopQueryKeyBatchTest = () => {
    if (!isQueryKeyBatchTesting) return;
    shouldStopQueryKeyBatchTestingRef.current = true;
    showInfo(t('正在停止批量测试，已开始的请求会继续完成'));
  };

  const isItemTesting = (item) =>
    getItemChannels(item).some((channel) => isQueryKeyTesting(item, channel));

  const mainCopyColumns = useMemo(
    () => [
      { label: t('密钥'), getValue: (item) => item.key || '' },
      { label: t('结果'), getValue: getStatusLabel },
      { label: t('渠道状态'), getValue: getItemChannelStatusText },
      { label: t('测试状态'), getValue: getQueryKeyTestStatusText },
      { label: t('响应时间'), getValue: getQueryKeyResponseTimeText },
      {
        label: t('渠道数'),
        getValue: (item) => item.channel_count || 0,
      },
      {
        label: t('已用额度'),
        getValue: (item) => renderQuota(item.used_quota || 0),
      },
      {
        label: t('已用金额'),
        getValue: (item) => renderQuotaWithAmount(item.used_amount || 0),
      },
      {
        label: t('原始额度'),
        getValue: (item) => {
          const amount = renderQuotaWithAmount(item.original_amount || 0);
          return item.original_amount_shared ? `${amount} (${t('共享')})` : amount;
        },
      },
      {
        label: t('理论当前额度'),
        getValue: (item) => renderQuotaWithAmount(item.current_amount || 0),
      },
      {
        label: t('超刷金额'),
        getValue: (item) => renderQuotaWithAmount(item.over_brush_amount || 0),
      },
    ],
    [t, queryKeyTestResults, testingQueryKeyIds],
  );

  const channelDetailCopyColumns = useMemo(
    () => [
      { label: t('密钥'), getValue: ({ item }) => item.key || '' },
      {
        label: t('来源'),
        getValue: ({ channel }) => t(getSourceConfig(channel.source).label),
      },
      { label: 'ID', getValue: ({ channel }) => channel.id || '' },
      { label: t('渠道'), getValue: ({ channel }) => channel.name || '' },
      {
        label: t('类型'),
        getValue: ({ channel }) => channelTypeLabel(channel.type),
      },
      {
        label: t('状态'),
        getValue: ({ channel }) => getChannelStatusLabel(channel),
      },
      {
        label: t('测试状态'),
        getValue: ({ item, channel }) => getSingleTestStatusText(item, channel),
      },
      {
        label: t('响应时间'),
        getValue: ({ item, channel }) => getSingleResponseTimeText(item, channel),
      },
      { label: t('分组'), getValue: ({ channel }) => channel.group || '' },
      {
        label: t('匹配密钥数'),
        getValue: ({ channel }) => channel.matched_key_count || 1,
      },
      {
        label: t('已用额度'),
        getValue: ({ channel }) => renderQuota(channel.used_quota || 0),
      },
      {
        label: t('匹配已用金额'),
        getValue: ({ channel }) =>
          renderQuotaWithAmount(channel.matched_used_amount || 0),
      },
      {
        label: t('原始额度'),
        getValue: ({ channel }) =>
          renderQuotaWithAmount(channel.original_amount || 0),
      },
      {
        label: t('理论当前额度'),
        getValue: ({ channel }) =>
          renderQuotaWithAmount(channel.current_amount || 0),
      },
      {
        label: t('超刷金额'),
        getValue: ({ channel }) =>
          renderQuotaWithAmount(channel.over_brush_amount || 0),
      },
      {
        label: t('余额更新时间'),
        getValue: ({ channel }) => formatDate(channel.balance_updated_time),
      },
    ],
    [t, queryKeyTestResults, testingQueryKeyIds],
  );

  const flattenChannelDetails = (rows) =>
    rows.flatMap((item) =>
      (Array.isArray(item.channels) ? item.channels : []).map((channel) => ({
        item,
        channel,
      })),
    );

  const copyRows = async (rows, copyColumns, includeHeader) => {
    if (!rows.length) {
      showError(t('暂无报告数据'));
      return;
    }
    const ok = await copy(buildTsv(rows, copyColumns, includeHeader));
    if (ok) showSuccess(t('已复制'));
    else showError(t('复制失败'));
  };

  const copyColumn = async (rows, copyColumnConfig, includeHeader) => {
    await copyRows(rows, [copyColumnConfig], includeHeader);
  };

  const renderCopyMenu = (includeHeader) => (
    <Dropdown.Menu>
      <Dropdown.Item
        onClick={() => copyRows(filteredItems, mainCopyColumns, includeHeader)}
      >
        {t('当前筛选结果')}
      </Dropdown.Item>
      <Dropdown.Item onClick={() => copyRows(items, mainCopyColumns, includeHeader)}>
        {t('全部结果')}
      </Dropdown.Item>
      <Dropdown.Item
        onClick={() =>
          copyRows(
            flattenChannelDetails(filteredItems),
            channelDetailCopyColumns,
            includeHeader,
          )
        }
      >
        {t('当前筛选渠道明细')}
      </Dropdown.Item>
      <Dropdown.Item
        onClick={() =>
          copyRows(
            flattenChannelDetails(items),
            channelDetailCopyColumns,
            includeHeader,
          )
        }
      >
        {t('全部渠道明细')}
      </Dropdown.Item>
      <Dropdown.Divider />
      <div className='px-3 py-2 text-xs text-semi-color-text-2'>
        {t('单列（当前筛选）')}
      </div>
      {mainCopyColumns.map((copyColumnConfig) => (
        <Dropdown.Item
          key={copyColumnConfig.label}
          onClick={() =>
            copyColumn(filteredItems, copyColumnConfig, includeHeader)
          }
        >
          {copyColumnConfig.label}
        </Dropdown.Item>
      ))}
    </Dropdown.Menu>
  );

  const renderBatchTestMenu = () => (
    <Dropdown.Menu>
      <Dropdown.Item onClick={() => batchTestQueryKeyItems('filtered')}>
        {t('测试当前筛选')}
      </Dropdown.Item>
      <Dropdown.Item onClick={() => batchTestQueryKeyItems('all')}>
        {t('测试全部结果')}
      </Dropdown.Item>
      <Dropdown.Divider />
      <div className='px-3 py-2 text-xs text-semi-color-text-2'>
        {t('默认模型：{{model}}').replace(
          '{{model}}',
          t(DEFAULT_BATCH_TEST_MODEL_LABEL),
        )}
      </div>
    </Dropdown.Menu>
  );

  const channelColumns = [
    {
      title: t('渠道'),
      dataIndex: 'name',
      width: 300,
      render: (name, record) => {
        const sourceConfig = getSourceConfig(record.source);
        return (
          <div className='flex items-center gap-2'>
            {getChannelIcon(record.type)}
            <span>#{record.id}</span>
            <Tag color={sourceConfig.color}>{t(sourceConfig.label)}</Tag>
            <Text strong>{name || '-'}</Text>
            {record.is_multi_key ? <Tag color='blue'>{t('多密钥')}</Tag> : null}
            {record.matched_key_count > 1 ? (
              <Tag color='orange'>{t('共享原始额度')}</Tag>
            ) : null}
          </div>
        );
      },
    },
    {
      title: t('类型'),
      dataIndex: 'type',
      width: 150,
      render: (type) => channelTypeLabel(type),
    },
    {
      title: t('状态'),
      dataIndex: 'status',
      width: 110,
      render: (_, record) => {
        const meta = getChannelStatusMeta(record);
        return <Tag color={meta.color}>{meta.label}</Tag>;
      },
    },
    {
      title: t('测试状态'),
      dataIndex: 'query_key_test_status',
      width: 120,
      render: (_, record) => renderSingleTestStatus(record.__item, record),
    },
    {
      title: t('响应时间'),
      dataIndex: 'query_key_response_time',
      width: 120,
      render: (_, record) => renderSingleResponseTime(record.__item, record),
    },
    {
      title: t('操作'),
      dataIndex: 'query_key_operate',
      width: 120,
      fixed: 'right',
      render: (_, record) => {
        const item = record.__item;
        return (
          <Button
            size='small'
            type='tertiary'
            onClick={() => testQueryKeyChannel(item, record)}
            loading={isQueryKeyTesting(item, record)}
          >
            {t('测试')}
          </Button>
        );
      },
    },
    {
      title: t('分组'),
      dataIndex: 'group',
      width: 140,
      render: (group) => (
        <Space wrap>
          {String(group || '')
            .split(',')
            .map((item) => renderGroup(item))}
        </Space>
      ),
    },
    {
      title: t('匹配密钥数'),
      dataIndex: 'matched_key_count',
      width: 120,
      render: (count) => count || 1,
    },
    {
      title: t('已用额度'),
      dataIndex: 'used_quota',
      width: 160,
      render: (quota) => renderQuota(quota || 0),
    },
    {
      title: t('匹配已用金额'),
      dataIndex: 'matched_used_amount',
      width: 180,
      render: (amount) => renderQuotaWithAmount(amount || 0),
    },
    {
      title: t('原始额度'),
      dataIndex: 'original_amount',
      width: 180,
      render: (amount) => renderQuotaWithAmount(amount || 0),
    },
    {
      title: t('理论当前额度'),
      dataIndex: 'current_amount',
      width: 180,
      render: (amount) => renderQuotaWithAmount(amount || 0),
    },
    {
      title: t('超刷金额'),
      dataIndex: 'over_brush_amount',
      width: 160,
      render: (amount) => (
        <Text type={amount > 0 ? 'danger' : 'secondary'}>
          {renderQuotaWithAmount(amount || 0)}
        </Text>
      ),
    },
    {
      title: t('余额更新时间'),
      dataIndex: 'balance_updated_time',
      width: 180,
      render: formatDate,
    },
  ];

  const columns = [
    {
      title: t('密钥'),
      dataIndex: 'key',
      width: 520,
      render: (key) => (
        <div className='flex items-center gap-2 min-w-0'>
          <Text code ellipsis={{ showTooltip: true }} style={{ maxWidth: 480 }}>
            {key}
          </Text>
          <Button
            size='small'
            theme='borderless'
            icon={<IconCopy />}
            onClick={() => copyKey(key)}
          />
        </div>
      ),
    },
    {
      title: t('结果'),
      dataIndex: 'status',
      width: 180,
      render: (status, record) => {
        const config = getStatusConfig(status);
        return (
          <Space wrap>
            <Tag color={config.color}>{t(config.label)}</Tag>
            {record.original_amount_shared ? (
              <Tag color='orange'>{t('原始额度为共享余额')}</Tag>
            ) : null}
          </Space>
        );
      },
    },
    {
      title: t('渠道状态'),
      dataIndex: 'channel_status',
      width: 180,
      render: (_, record) => renderItemChannelStatus(record),
    },
    {
      title: t('测试状态'),
      dataIndex: 'query_key_test_status',
      width: 150,
      render: (_, record) => renderItemTestStatus(record),
    },
    {
      title: t('响应时间'),
      dataIndex: 'query_key_response_time',
      width: 130,
      render: (_, record) => renderItemResponseTime(record),
    },
    {
      title: t('渠道数'),
      dataIndex: 'channel_count',
      width: 100,
    },
    {
      title: t('已用额度'),
      dataIndex: 'used_quota',
      width: 160,
      render: (quota) => renderQuota(quota || 0),
    },
    {
      title: t('已用金额'),
      dataIndex: 'used_amount',
      width: 160,
      render: (amount) => renderQuotaWithAmount(amount || 0),
    },
    {
      title: t('原始额度'),
      dataIndex: 'original_amount',
      width: 190,
      render: (amount, record) => (
        <Space wrap>
          <Text>{renderQuotaWithAmount(amount || 0)}</Text>
          {record.original_amount_shared ? (
            <Tag color='orange'>{t('共享')}</Tag>
          ) : null}
        </Space>
      ),
    },
    {
      title: t('理论当前额度'),
      dataIndex: 'current_amount',
      width: 190,
      render: (amount) => renderQuotaWithAmount(amount || 0),
    },
    {
      title: t('超刷金额'),
      dataIndex: 'over_brush_amount',
      width: 160,
      render: (amount) => (
        <Text type={amount > 0 ? 'danger' : 'secondary'}>
          {renderQuotaWithAmount(amount || 0)}
        </Text>
      ),
    },
    {
      title: t('操作'),
      dataIndex: 'query_key_operate',
      width: 130,
      fixed: 'right',
      render: (_, record) => {
        const channels = getItemChannels(record);
        return (
          <Button
            size='small'
            type='tertiary'
            disabled={channels.length === 0}
            loading={isItemTesting(record)}
            onClick={() => testQueryKeyItem(record)}
          >
            {channels.length > 1 ? t('测试全部') : t('测试')}
          </Button>
        );
      },
    },
  ];

  const expandedRowRender = (record) => {
    const channels = Array.isArray(record.channels) ? record.channels : [];
    if (channels.length === 0) {
      return <Empty description={t('没有匹配的渠道')} />;
    }
    const channelsWithItem = channels.map((channel) => ({
      ...channel,
      __item: record,
    }));
    return (
      <div className='rounded-lg bg-semi-color-fill-0 p-3'>
        <Banner
          type='info'
          closeIcon={null}
          description={t(
            '渠道/备货池明细不包含任何原始密钥；原始额度展示的是实际渠道余额，多密钥命中时可能为共享余额。',
          )}
          style={{ marginBottom: 12 }}
        />
        <Table
          columns={channelColumns}
          dataSource={channelsWithItem}
          rowKey={(channel) =>
            `${record.key}-${channel.source || 'channel'}-${channel.id}`
          }
          pagination={false}
          size='small'
          scroll={{ x: 2200 }}
          style={{ width: '100%' }}
        />
      </div>
    );
  };

  return (
    <div className='flex w-full max-w-none flex-col gap-4 overflow-x-auto'>
      <div>
        <Title heading={3} style={{ margin: 0 }}>
          {t('批量密钥报告')}
        </Title>
        <Text type='secondary'>
          {t('隐藏管理员页面，用于按密钥生成渠道用量与超刷报告。')}
        </Text>
      </div>

      <Card className='!rounded-2xl'>
        <div className='flex flex-col gap-3'>
          <Banner
            type='warning'
            icon={<IconAlertTriangle />}
            closeIcon={null}
            description={t(
              '每行一个渠道密钥，最多支持 10000 个唯一密钥。报告会匹配多密钥渠道，但不会展示任何渠道内的原始密钥。',
            )}
          />
          <TextArea
            value={inputText}
            onChange={setInputText}
            disabled={loading || isQueryKeyBatchTesting}
            placeholder={`sk-xxxx\nsk-yyyy\nsk-zzzz`}
            autosize={{ minRows: 12, maxRows: 22 }}
            style={{
              fontFamily: 'monospace',
              fontSize: 13,
              lineHeight: '20px',
              whiteSpace: 'pre',
              overflowX: 'auto',
            }}
            wrap='off'
          />
          <div className='flex flex-col md:flex-row items-start md:items-center justify-between gap-3'>
            <Space wrap>
              <Text strong>{t('解析结果')}</Text>
              <Tag color={parsed.keys.length > 0 ? 'green' : 'grey'}>
                {t(
                  '共 {{total}} 行，{{unique}} 个唯一密钥，已移除 {{duplicates}} 个重复项',
                )
                  .replace('{{total}}', parsed.totalInput)
                  .replace('{{unique}}', parsed.keys.length)
                  .replace('{{duplicates}}', parsed.duplicateCount)}
              </Tag>
            </Space>
            <Space wrap>
              <Button
                onClick={clearAll}
                disabled={loading || isQueryKeyBatchTesting}
                icon={<IconRefresh />}
              >
                {t('清空')}
              </Button>
              <Button
                type='primary'
                theme='solid'
                onClick={submitReport}
                loading={loading}
                disabled={parsed.keys.length === 0 || isQueryKeyBatchTesting}
                icon={<IconSearch />}
              >
                {t('生成报告')}
              </Button>
            </Space>
          </div>
        </div>
      </Card>

      {loading ? (
        <Card className='!rounded-2xl'>
          <div className='flex justify-center py-12'>
            <Spin size='large' tip={t('正在生成报告...')} />
          </div>
        </Card>
      ) : report ? (
        <>
          <div className='grid grid-cols-1 md:grid-cols-3 xl:grid-cols-6 gap-3'>
            <MetricCard title={t('输入行数')} value={report.total_input || 0} />
            <MetricCard title={t('唯一密钥')} value={report.unique_keys || 0} />
            <MetricCard
              title={t('已找到')}
              value={report.found_count || 0}
              color='var(--semi-color-success)'
            />
            <MetricCard
              title={t('未找到')}
              value={report.not_found_count || 0}
            />
            <MetricCard
              title={t('已超刷')}
              value={report.over_brushed_count || 0}
              color='var(--semi-color-danger)'
            />
            <MetricCard
              title={t('重复项')}
              value={report.duplicate_count || 0}
            />
          </div>

          <div className='grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-3'>
            <MetricCard
              title={t('总已用额度')}
              value={renderQuota(report.total_used_quota || 0)}
            />
            <MetricCard
              title={t('总已用金额')}
              value={renderQuotaWithAmount(report.total_used_amount || 0)}
            />
            <MetricCard
              title={t('总原始额度')}
              value={renderQuotaWithAmount(report.total_original_amount || 0)}
            />
            <MetricCard
              title={t('总理论当前额度')}
              value={renderQuotaWithAmount(report.total_current_amount || 0)}
            />
            <MetricCard
              title={t('总超刷金额')}
              value={renderQuotaWithAmount(report.total_over_brush_amount || 0)}
              color='var(--semi-color-danger)'
            />
          </div>

          <Card className='!rounded-2xl overflow-x-auto'>
            <div className='mb-3 flex flex-col gap-2 md:flex-row md:items-center md:justify-between'>
              <div className='flex flex-wrap gap-2'>
                {BUCKETS.map((bucket) => (
                  <Button
                    key={bucket.key}
                    size='small'
                    type={activeBucket === bucket.key ? 'primary' : 'tertiary'}
                    theme={activeBucket === bucket.key ? 'solid' : 'light'}
                    onClick={() => setActiveBucket(bucket.key)}
                  >
                    {t(bucket.label)} ({bucketCounts[bucket.key] || 0})
                  </Button>
                ))}
              </div>
              <Space wrap>
                {isQueryKeyBatchTesting ? (
                  <Button size='small' type='danger' onClick={stopQueryKeyBatchTest}>
                    {t('停止批量测试')} {queryKeyBatchProgress.finished}/
                    {queryKeyBatchProgress.total}
                  </Button>
                ) : (
                  <Dropdown
                    trigger='click'
                    position='bottomRight'
                    render={renderBatchTestMenu()}
                  >
                    <Button
                      size='small'
                      type='tertiary'
                      disabled={buildQueryKeyBatchTasks(items).length === 0}
                    >
                      {t('批量测试')}
                    </Button>
                  </Dropdown>
                )}
                <Dropdown
                  trigger='click'
                  position='bottomRight'
                  render={renderCopyMenu(true)}
                >
                  <Button size='small' icon={<IconCopy />}>
                    {t('复制带表头')}
                  </Button>
                </Dropdown>
                <Dropdown
                  trigger='click'
                  position='bottomRight'
                  render={renderCopyMenu(false)}
                >
                  <Button size='small' type='tertiary' icon={<IconCopy />}>
                    {t('复制不带表头')}
                  </Button>
                </Dropdown>
              </Space>
            </div>
            {filteredItems.length === 0 ? (
              <Empty description={t('暂无报告数据')} />
            ) : (
              <Table
                columns={columns}
                dataSource={filteredItems}
                rowKey='key'
                pagination={{ pageSize: 20 }}
                expandedRowRender={expandedRowRender}
                scroll={{ x: 2200 }}
                style={{ width: '100%' }}
              />
            )}
          </Card>

          <Collapse>
            <Collapse.Panel header={t('指标说明')} itemKey='metrics'>
              <div className='text-sm text-semi-color-text-2 leading-6'>
                {t(
                  '原始额度是实际 Channel.Balance。多密钥渠道命中多个输入密钥时，该余额可能为共享余额；页面不会按命中密钥数拆分或展示 balance / M。',
                )}
              </div>
            </Collapse.Panel>
          </Collapse>
        </>
      ) : (
        <Card className='!rounded-2xl'>
          <Empty description={t('请输入密钥并生成报告')} />
        </Card>
      )}
    </div>
  );
};

export default QueryKeyPage;
