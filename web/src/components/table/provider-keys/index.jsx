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

import React from 'react';
import { Button, Input, Space, Tag, Typography } from '@douyinfe/semi-ui';
import CardPro from '../../common/ui/CardPro';
import CardTable from '../../common/ui/CardTable';
import {
  createCardProPagination,
  renderQuota,
  timestamp2string,
} from '../../../helpers';
import { useProviderKeysData } from '../../../hooks/provider-keys/useProviderKeysData';
import { useIsMobile } from '../../../hooks/common/useIsMobile';

const { Text } = Typography;

const ProviderKeysPage = () => {
  const providerKeysData = useProviderKeysData();
  const isMobile = useIsMobile();

  const columns = [
    {
      title: providerKeysData.t('ID'),
      dataIndex: 'id',
      key: 'id',
      width: 90,
    },
    {
      title: providerKeysData.t('凭证'),
      dataIndex: 'current_key',
      key: 'credential',
      render: (_, record) => (
        <div style={{ maxWidth: 440 }}>
          <div
            style={{
              wordBreak: 'break-all',
              lineHeight: 1.6,
              fontFamily: 'monospace',
            }}
          >
            {record.current_key || record.key_preview || '-'}
          </div>
          <div
            style={{
              marginTop: 4,
              color: 'var(--semi-color-text-2)',
              fontSize: 12,
            }}
          >
            {providerKeysData.t('预览')}: {record.key_preview || '-'}
          </div>
        </div>
      ),
    },
    {
      title: providerKeysData.t('关联渠道'),
      dataIndex: 'channels',
      key: 'channels',
      render: (_, record) => (
        <div style={{ maxWidth: 360 }}>
          <div style={{ marginBottom: 6 }}>
            {providerKeysData.t('共 {{count}} 个渠道', {
              count: record.channel_count || 0,
            })}
          </div>
          <Space wrap>
            {(record.channels || []).slice(0, 4).map((channel) => (
              <Tag
                key={`${record.id}-${channel.id}`}
                color='blue'
                shape='circle'
              >
                #{channel.id} {channel.name || providerKeysData.t('未命名')}
              </Tag>
            ))}
            {(record.channels || []).length > 4 ? (
              <Tag color='grey' shape='circle'>
                +{record.channels.length - 4}
              </Tag>
            ) : null}
          </Space>
        </div>
      ),
    },
    {
      title: providerKeysData.t('请求'),
      dataIndex: 'request_count',
      key: 'request_count',
      render: (_, record) => (
        <div>
          <div>
            {providerKeysData.t('总请求')}: {record.request_count || 0}
          </div>
          <div style={{ color: 'var(--semi-color-text-2)', fontSize: 12 }}>
            {providerKeysData.t('成功 {{success}} / 异常 {{error}}', {
              success: record.success_count || 0,
              error: record.error_count || 0,
            })}
          </div>
        </div>
      ),
    },
    {
      title: providerKeysData.t('原价消耗'),
      dataIndex: 'total_quota',
      key: 'total_quota',
      render: (value) => renderQuota(value || 0, 4),
    },
    {
      title: providerKeysData.t('成本消耗'),
      dataIndex: 'total_cost_quota',
      key: 'total_cost_quota',
      render: (value) => renderQuota(value || 0, 4),
    },
    {
      title: providerKeysData.t('最近使用'),
      dataIndex: 'last_used_at',
      key: 'last_used_at',
      render: (value) => (value ? timestamp2string(value) : '-'),
    },
    {
      title: providerKeysData.t('操作'),
      key: 'operate',
      width: 120,
      render: (_, record) => (
        <Button
          size='small'
          type='tertiary'
          onClick={() => providerKeysData.openLogs(record.id)}
        >
          {providerKeysData.t('查看日志')}
        </Button>
      ),
    },
  ];

  return (
    <CardPro
      type='type1'
      descriptionArea={
        <div className='flex flex-col gap-1'>
          <Text strong>{providerKeysData.t('凭证管理')}</Text>
          <Text type='tertiary'>
            {providerKeysData.t(
              '按稳定的上游 Key ID 聚合查看关联渠道、请求量以及原价与成本消耗。',
            )}
          </Text>
        </div>
      }
      actionsArea={
        <div className='flex justify-end'>
          <Button
            type='tertiary'
            size='small'
            loading={providerKeysData.loading}
            onClick={providerKeysData.refresh}
          >
            {providerKeysData.t('刷新')}
          </Button>
        </div>
      }
      searchArea={
        <div className='flex flex-col gap-2'>
          <div className='flex flex-col gap-2 lg:flex-row'>
            <Input
              value={providerKeysData.keyword}
              placeholder={providerKeysData.t('搜索 Key ID / 预览 / 指纹')}
              showClear
              pure
              onChange={providerKeysData.setKeyword}
              onEnterPress={providerKeysData.handleSearch}
            />
            <div className='flex gap-2'>
              <Button
                type='tertiary'
                size='small'
                loading={providerKeysData.loading}
                onClick={providerKeysData.handleSearch}
              >
                {providerKeysData.t('查询')}
              </Button>
              <Button
                type='tertiary'
                size='small'
                onClick={providerKeysData.handleReset}
              >
                {providerKeysData.t('重置')}
              </Button>
            </div>
          </div>
          <div className='text-xs text-[var(--semi-color-text-2)]'>
            {providerKeysData.t(
              '这里只做查看与跳转，不修改渠道里的真实凭证内容；点击“查看日志”会自动按上游 Key ID 过滤使用日志。',
            )}
          </div>
        </div>
      }
      paginationArea={createCardProPagination({
        currentPage: providerKeysData.activePage,
        pageSize: providerKeysData.pageSize,
        total: providerKeysData.total,
        onPageChange: providerKeysData.handlePageChange,
        onPageSizeChange: providerKeysData.handlePageSizeChange,
        isMobile,
        t: providerKeysData.t,
      })}
      t={providerKeysData.t}
    >
      <CardTable
        rowKey='id'
        hidePagination
        loading={providerKeysData.loading}
        columns={columns}
        dataSource={providerKeysData.items}
      />
    </CardPro>
  );
};

export default ProviderKeysPage;
