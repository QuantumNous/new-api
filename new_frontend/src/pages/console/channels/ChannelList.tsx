import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageHeader } from '@/components/organisms/PageHeader';
import { DataTable, Column } from '@/components/organisms/DataTable';
import { SearchBox } from '@/components/molecules/SearchBox';
import { StatusBadge } from '@/components/molecules/StatusBadge';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import { useChannels } from '@/hooks/queries/useChannels';
import type { Channel } from '@/types/channel';
import { CHANNEL_TYPE_LABELS } from '@/lib/constants';

export default function ChannelList() {
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [keyword, setKeyword] = useState('');

  const { data, isLoading } = useChannels({ page, pageSize, keyword });

  const columns: Column<Channel>[] = [
    {
      key: 'id',
      title: 'ID',
      width: '80px',
    },
    {
      key: 'name',
      title: '名称',
    },
    {
      key: 'type',
      title: '类型',
      render: (value) => CHANNEL_TYPE_LABELS[value as keyof typeof CHANNEL_TYPE_LABELS] || value,
    },
    {
      key: 'status',
      title: '状态',
      render: (value) => (
        <StatusBadge
          status={value === 1 ? 'enabled' : 'disabled'}
        />
      ),
    },
    {
      key: 'priority',
      title: '优先级',
      width: '100px',
    },
    {
      key: 'weight',
      title: '权重',
      width: '100px',
    },
    {
      key: 'actions',
      title: '操作',
      width: '200px',
      render: (_, record) => (
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => navigate(`/console/channels/${record.id}/edit`)}
            data-testid={`edit-channel-${record.id}`}
          >
            编辑
          </Button>
          <Button size="sm" variant="outline" data-testid={`test-channel-${record.id}`}>
            测试
          </Button>
          <Button size="sm" variant="destructive" data-testid={`delete-channel-${record.id}`}>
            删除
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div data-testid="channel-list-page">
      <PageHeader
        title="渠道管理"
        description="管理 API 渠道配置"
        actions={
          <Button data-testid="create-channel-button">
            <Plus className="mr-2 h-4 w-4" />
            创建渠道
          </Button>
        }
      />

      <div className="mb-4">
        <SearchBox
          placeholder="搜索渠道名称..."
          onSearch={setKeyword}
          data-testid="channel-search"
        />
      </div>

      <DataTable
        columns={columns}
        data={data?.data?.items || []}
        loading={isLoading}
        pagination={{
          page,
          pageSize,
          total: data?.data?.total || 0,
          onPageChange: setPage,
          onPageSizeChange: setPageSize,
        }}
        emptyText="暂无渠道数据"
      />
    </div>
  );
}
