import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageHeader } from '@/components/organisms/PageHeader';
import { DataTable, Column } from '@/components/organisms/DataTable';
import { SearchBox } from '@/components/molecules/SearchBox';
import { StatusBadge } from '@/components/molecules/StatusBadge';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import { formatDateTime } from '@/lib/utils';

interface Redemption {
  id: number;
  name: string;
  key: string;
  quota: number;
  count: number;
  usedCount: number;
  status: number;
  createdTime: number;
}

export default function RedemptionList() {
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [keyword, setKeyword] = useState('');
  const [isLoading] = useState(false);

  const columns: Column<Redemption>[] = [
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
      key: 'key',
      title: '兑换码',
      render: (value) => (
        <code className="text-xs">{value}</code>
      ),
    },
    {
      key: 'quota',
      title: '额度',
      render: (value) => `¥${(value / 500000).toFixed(2)}`,
    },
    {
      key: 'count',
      title: '总次数',
    },
    {
      key: 'usedCount',
      title: '已使用',
    },
    {
      key: 'status',
      title: '状态',
      render: (value) => (
        <StatusBadge status={value === 1 ? 'enabled' : 'disabled'} />
      ),
    },
    {
      key: 'createdTime',
      title: '创建时间',
      render: (value) => formatDateTime(value * 1000),
    },
    {
      key: 'actions',
      title: '操作',
      width: '150px',
      render: (_, record) => (
        <div className="flex gap-2">
          <Button size="sm" variant="outline" data-testid={`edit-redemption-${record.id}`}>
            编辑
          </Button>
          <Button size="sm" variant="destructive" data-testid={`delete-redemption-${record.id}`}>
            删除
          </Button>
        </div>
      ),
    },
  ];

  const mockData: Redemption[] = [];

  return (
    <div data-testid="redemption-list-page">
      <PageHeader
        title="兑换码管理"
        description="管理系统兑换码"
        actions={
          <Button
            onClick={() => navigate('/console/redemptions/create')}
            data-testid="create-redemption-button"
          >
            <Plus className="mr-2 h-4 w-4" />
            创建兑换码
          </Button>
        }
      />

      <div className="mb-4">
        <SearchBox
          placeholder="搜索兑换码..."
          onSearch={setKeyword}
          data-testid="redemption-search"
        />
      </div>

      <DataTable
        columns={columns}
        data={mockData}
        loading={isLoading}
        pagination={{
          page,
          pageSize,
          total: 0,
          onPageChange: setPage,
          onPageSizeChange: setPageSize,
        }}
        emptyText="暂无兑换码数据"
      />
    </div>
  );
}
