import React, { useMemo } from 'react';
import { Table, Tag, Tooltip, Typography } from '@douyinfe/semi-ui';

const { Text } = Typography;

const StatsTable = ({
  data,
  loading,
  pagination,
  onPageChange,
  onPageSizeChange,
  sortBy,
  sortOrder,
  onSort,
  t,
}) => {
  // 格式化数字
  const formatNumber = (num, decimals = 2) => {
    if (num === null || num === undefined) return '-';
    if (typeof num === 'number') {
      return num.toLocaleString(undefined, { 
        minimumFractionDigits: decimals, 
        maximumFractionDigits: decimals 
      });
    }
    return num;
  };

  // 格式化Token数量
  const formatTokens = (num) => {
    if (num === null || num === undefined) return '-';
    if (num >= 1000000) {
      return `${(num / 1000000).toFixed(2)}M`;
    }
    if (num >= 1000) {
      return `${(num / 1000).toFixed(2)}K`;
    }
    return num.toString();
  };

  // 获取成功率颜色
  const getSuccessRateColor = (rate) => {
    if (rate >= 99) return 'green';
    if (rate >= 95) return 'lime';
    if (rate >= 90) return 'yellow';
    if (rate >= 80) return 'orange';
    return 'red';
  };

  // 获取响应时间颜色
  const getResponseTimeColor = (time) => {
    if (time <= 1) return 'green';
    if (time <= 3) return 'lime';
    if (time <= 5) return 'yellow';
    if (time <= 10) return 'orange';
    return 'red';
  };

  const columns = useMemo(() => [
    {
      title: t('渠道'),
      dataIndex: 'channel_name',
      key: 'channel_name',
      width: 150,
      render: (text, record) => (
        <Tooltip content={`ID: ${record.channel_id}`}>
          <Text ellipsis={{ showTooltip: true }} style={{ maxWidth: 130 }}>
            {text}
          </Text>
        </Tooltip>
      ),
    },
    {
      title: t('模型'),
      dataIndex: 'model_name',
      key: 'model_name',
      width: 180,
      render: (text) => (
        <Text ellipsis={{ showTooltip: true }} style={{ maxWidth: 160 }}>
          {text}
        </Text>
      ),
    },
    {
      title: t('时间点'),
      dataIndex: 'time_point',
      key: 'time_point',
      width: 120,
      render: (text) => text === 'all' ? t('汇总') : text,
    },
    {
      title: t('调用次数'),
      dataIndex: 'total_calls',
      key: 'total_calls',
      width: 100,
      sorter: true,
      sortOrder: sortBy === 'total_calls' ? sortOrder : undefined,
      onHeaderCell: () => ({ onClick: () => onSort('total_calls') }),
      render: (text) => formatNumber(text, 0),
    },
    {
      title: t('成功/失败'),
      key: 'success_failed',
      width: 100,
      render: (_, record) => (
        <span>
          <Text type="success">{record.success_calls || 0}</Text>
          {' / '}
          <Text type="danger">{record.failed_calls || 0}</Text>
        </span>
      ),
    },
    {
      title: t('成功率'),
      dataIndex: 'success_rate',
      key: 'success_rate',
      width: 90,
      sorter: true,
      sortOrder: sortBy === 'success_rate' ? sortOrder : undefined,
      onHeaderCell: () => ({ onClick: () => onSort('success_rate') }),
      render: (text) => (
        <Tag color={getSuccessRateColor(text)}>
          {formatNumber(text)}%
        </Tag>
      ),
    },
    {
      title: t('输入Token'),
      key: 'prompt_tokens',
      width: 120,
      children: [
        {
          title: t('总量'),
          dataIndex: 'prompt_tokens',
          key: 'prompt_tokens_total',
          width: 80,
          sorter: true,
          sortOrder: sortBy === 'prompt_tokens' ? sortOrder : undefined,
          onHeaderCell: () => ({ onClick: () => onSort('prompt_tokens') }),
          render: (text) => formatTokens(text),
        },
        {
          title: t('平均'),
          dataIndex: 'avg_prompt_tokens',
          key: 'avg_prompt_tokens',
          width: 80,
          sorter: true,
          sortOrder: sortBy === 'avg_prompt_tokens' ? sortOrder : undefined,
          onHeaderCell: () => ({ onClick: () => onSort('avg_prompt_tokens') }),
          render: (text) => formatNumber(text, 0),
        },
      ],
    },
    {
      title: t('输出Token'),
      key: 'completion_tokens',
      width: 120,
      children: [
        {
          title: t('总量'),
          dataIndex: 'completion_tokens',
          key: 'completion_tokens_total',
          width: 80,
          sorter: true,
          sortOrder: sortBy === 'completion_tokens' ? sortOrder : undefined,
          onHeaderCell: () => ({ onClick: () => onSort('completion_tokens') }),
          render: (text) => formatTokens(text),
        },
        {
          title: t('平均'),
          dataIndex: 'avg_completion_tokens',
          key: 'avg_completion_tokens',
          width: 80,
          sorter: true,
          sortOrder: sortBy === 'avg_completion_tokens' ? sortOrder : undefined,
          onHeaderCell: () => ({ onClick: () => onSort('avg_completion_tokens') }),
          render: (text) => formatNumber(text, 0),
        },
      ],
    },
    {
      title: t('响应时间(秒)'),
      key: 'response_time',
      width: 280,
      children: [
        {
          title: t('平均'),
          dataIndex: 'avg_response_time',
          key: 'avg_response_time',
          width: 70,
          sorter: true,
          sortOrder: sortBy === 'avg_response_time' ? sortOrder : undefined,
          onHeaderCell: () => ({ onClick: () => onSort('avg_response_time') }),
          render: (text) => (
            <Tag color={getResponseTimeColor(text)} size="small">
              {formatNumber(text)}
            </Tag>
          ),
        },
        {
          title: 'P50',
          dataIndex: 'p50_response_time',
          key: 'p50_response_time',
          width: 55,
          render: (text) => formatNumber(text),
        },
        {
          title: 'P90',
          dataIndex: 'p90_response_time',
          key: 'p90_response_time',
          width: 55,
          render: (text) => formatNumber(text),
        },
        {
          title: 'P95',
          dataIndex: 'p95_response_time',
          key: 'p95_response_time',
          width: 55,
          render: (text) => formatNumber(text),
        },
        {
          title: 'P99',
          dataIndex: 'p99_response_time',
          key: 'p99_response_time',
          width: 55,
          render: (text) => (
            <Tag color={getResponseTimeColor(text)} size="small">
              {formatNumber(text)}
            </Tag>
          ),
        },
      ],
    },
    {
      title: t('消耗额度'),
      dataIndex: 'total_quota',
      key: 'total_quota',
      width: 100,
      sorter: true,
      sortOrder: sortBy === 'total_quota' ? sortOrder : undefined,
      onHeaderCell: () => ({ onClick: () => onSort('total_quota') }),
      render: (text) => formatNumber(text / 500000, 4), // 转换为美元
    },
  ], [sortBy, sortOrder, onSort, t]);

  return (
    <Table
      columns={columns}
      dataSource={data}
      loading={loading}
      rowKey={(record) => `${record.channel_id}-${record.model_name}-${record.time_point}`}
      pagination={{
        currentPage: pagination.page,
        pageSize: pagination.pageSize,
        total: pagination.total,
        showSizeChanger: true,
        pageSizeOpts: [10, 20, 50, 100],
        onPageChange: onPageChange,
        onPageSizeChange: onPageSizeChange,
        showTotal: true,
        formatShowTotal: (total) => t('共 {{total}} 条', { total }),
      }}
      scroll={{ x: 1400 }}
      bordered
      size="small"
      style={{ marginTop: '16px' }}
    />
  );
};

export default StatsTable;


