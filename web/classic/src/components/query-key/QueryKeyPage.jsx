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

import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Banner,
  Button,
  Card,
  Collapse,
  Empty,
  Space,
  Spin,
  Table,
  Tag,
  TextArea,
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
  showSuccess,
} from '../../helpers';
import { CHANNEL_OPTIONS } from '../../constants';

const { Text, Title } = Typography;

const STATUS_CONFIG = {
  found: { color: 'green', label: '已找到' },
  not_found: { color: 'grey', label: '未找到' },
  over_brushed: { color: 'red', label: '已超刷' },
};

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

const formatModels = (models) => {
  if (!models) return '-';
  const parts = String(models)
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
  if (parts.length <= 4) return parts.join(', ') || '-';
  return `${parts.slice(0, 4).join(', ')} ...`;
};

const channelTypeLabel = (type) => {
  const option = CHANNEL_OPTIONS.find((item) => item.value === type);
  return option?.label || type || '-';
};

const getStatusConfig = (status) =>
  STATUS_CONFIG[status] || STATUS_CONFIG.not_found;

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
    if (loading) return;
    setInputText('');
    setReport(null);
    setActiveBucket('all');
  };

  const copyKey = async (value) => {
    const ok = await copy(value || '');
    if (ok) showSuccess(t('已复制'));
    else showError(t('复制失败'));
  };

  const channelColumns = [
    {
      title: t('渠道'),
      dataIndex: 'name',
      render: (name, record) => (
        <div className='flex items-center gap-2'>
          {getChannelIcon(record.type)}
          <span>#{record.id}</span>
          <Text strong>{name || '-'}</Text>
          {record.is_multi_key ? <Tag color='blue'>{t('多密钥')}</Tag> : null}
          {record.matched_key_count > 1 ? (
            <Tag color='orange'>{t('共享原始额度')}</Tag>
          ) : null}
        </div>
      ),
    },
    {
      title: t('类型'),
      dataIndex: 'type',
      render: (type) => channelTypeLabel(type),
    },
    {
      title: t('状态'),
      dataIndex: 'status',
      render: (status) =>
        status === 1 ? (
          <Tag color='green'>{t('已启用')}</Tag>
        ) : (
          <Tag color='grey'>{t('已禁用')}</Tag>
        ),
    },
    {
      title: t('分组'),
      dataIndex: 'group',
      render: (group) => (
        <Space wrap>
          {String(group || '')
            .split(',')
            .map((item) => renderGroup(item))}
        </Space>
      ),
    },
    {
      title: t('模型'),
      dataIndex: 'models',
      render: formatModels,
    },
    {
      title: t('匹配密钥数'),
      dataIndex: 'matched_key_count',
      render: (count) => count || 1,
    },
    {
      title: t('已用额度'),
      dataIndex: 'used_quota',
      render: (quota) => renderQuota(quota || 0),
    },
    {
      title: t('匹配已用金额'),
      dataIndex: 'matched_used_amount',
      render: (amount) => renderQuotaWithAmount(amount || 0),
    },
    {
      title: t('原始额度'),
      dataIndex: 'original_amount',
      render: (amount) => renderQuotaWithAmount(amount || 0),
    },
    {
      title: t('理论当前额度'),
      dataIndex: 'current_amount',
      render: (amount) => renderQuotaWithAmount(amount || 0),
    },
    {
      title: t('超刷金额'),
      dataIndex: 'over_brush_amount',
      render: (amount) => (
        <Text type={amount > 0 ? 'danger' : 'secondary'}>
          {renderQuotaWithAmount(amount || 0)}
        </Text>
      ),
    },
    {
      title: t('余额更新时间'),
      dataIndex: 'balance_updated_time',
      render: formatDate,
    },
  ];

  const columns = [
    {
      title: t('密钥'),
      dataIndex: 'key',
      width: 260,
      render: (key) => (
        <div className='flex items-center gap-2 min-w-0'>
          <Text code ellipsis={{ showTooltip: true }} style={{ maxWidth: 220 }}>
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
      title: t('渠道数'),
      dataIndex: 'channel_count',
    },
    {
      title: t('已用额度'),
      dataIndex: 'used_quota',
      render: (quota) => renderQuota(quota || 0),
    },
    {
      title: t('已用金额'),
      dataIndex: 'used_amount',
      render: (amount) => renderQuotaWithAmount(amount || 0),
    },
    {
      title: t('原始额度'),
      dataIndex: 'original_amount',
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
      render: (amount) => renderQuotaWithAmount(amount || 0),
    },
    {
      title: t('超刷金额'),
      dataIndex: 'over_brush_amount',
      render: (amount) => (
        <Text type={amount > 0 ? 'danger' : 'secondary'}>
          {renderQuotaWithAmount(amount || 0)}
        </Text>
      ),
    },
  ];

  const expandedRowRender = (record) => {
    const channels = Array.isArray(record.channels) ? record.channels : [];
    if (channels.length === 0) {
      return <Empty description={t('没有匹配的渠道')} />;
    }
    return (
      <div className='rounded-lg bg-semi-color-fill-0 p-3'>
        <Banner
          type='info'
          closeIcon={null}
          description={t(
            '渠道明细不包含任何原始密钥；原始额度展示的是实际渠道余额，多密钥命中时可能为共享余额。',
          )}
          style={{ marginBottom: 12 }}
        />
        <Table
          columns={channelColumns}
          dataSource={channels}
          rowKey={(channel) => `${record.key}-${channel.id}`}
          pagination={false}
          size='small'
        />
      </div>
    );
  };

  return (
    <div className='flex flex-col gap-4'>
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
            disabled={loading}
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
                disabled={loading}
                icon={<IconRefresh />}
              >
                {t('清空')}
              </Button>
              <Button
                type='primary'
                theme='solid'
                onClick={submitReport}
                loading={loading}
                disabled={parsed.keys.length === 0}
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

          <Card className='!rounded-2xl'>
            <div className='mb-3 flex flex-wrap gap-2'>
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
            {filteredItems.length === 0 ? (
              <Empty description={t('暂无报告数据')} />
            ) : (
              <Table
                columns={columns}
                dataSource={filteredItems}
                rowKey='key'
                pagination={{ pageSize: 20 }}
                expandedRowRender={expandedRowRender}
                scroll={{ x: 1200 }}
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
