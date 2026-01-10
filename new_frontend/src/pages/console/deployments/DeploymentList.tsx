import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageHeader } from '@/components/organisms/PageHeader';
import { DataTable, Column } from '@/components/organisms/DataTable';
import { SearchBox } from '@/components/molecules/SearchBox';
import { StatusBadge } from '@/components/molecules/StatusBadge';
import { Button } from '@/components/ui/button';
import { Plus, Eye } from 'lucide-react';
import { formatDateTime } from '@/lib/utils';

interface Deployment {
  id: string;
  name: string;
  model: string;
  status: string;
  replicas: number;
  location: string;
  createdAt: number;
}

export default function DeploymentList() {
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [keyword, setKeyword] = useState('');

  // 模拟数据
  const deployments: Deployment[] = [
    {
      id: '1',
      name: 'gpt-4-deployment',
      model: 'gpt-4',
      status: 'running',
      replicas: 2,
      location: 'US-East',
      createdAt: Date.now() / 1000 - 86400,
    },
  ];

  const columns: Column<Deployment>[] = [
    {
      key: 'name',
      title: '名称',
      render: (value) => <span className="font-medium">{value}</span>,
    },
    {
      key: 'model',
      title: '模型',
      render: (value) => <code className="text-sm">{value}</code>,
    },
    {
      key: 'status',
      title: '状态',
      render: (value) => {
        const statusMap: Record<string, 'enabled' | 'disabled' | 'pending'> = {
          running: 'enabled',
          stopped: 'disabled',
          pending: 'pending',
        };
        return <StatusBadge status={statusMap[value] || 'pending'} />;
      },
    },
    {
      key: 'replicas',
      title: '副本数',
    },
    {
      key: 'location',
      title: '位置',
    },
    {
      key: 'createdAt',
      title: '创建时间',
      render: (value) => formatDateTime(value * 1000),
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
            onClick={() => navigate(`/console/deployments/${record.id}`)}
            data-testid={`view-deployment-${record.id}`}
          >
            <Eye className="mr-1 h-3 w-3" />
            查看
          </Button>
          <Button
            size="sm"
            variant="outline"
            data-testid={`edit-deployment-${record.id}`}
          >
            编辑
          </Button>
          <Button
            size="sm"
            variant="destructive"
            data-testid={`delete-deployment-${record.id}`}
          >
            删除
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div data-testid="deployment-list-page">
      <PageHeader
        title="模型部署"
        description="管理 AI 模型部署实例"
        actions={
          <Button
            onClick={() => navigate('/console/deployments/create')}
            data-testid="create-deployment-button"
          >
            <Plus className="mr-2 h-4 w-4" />
            创建部署
          </Button>
        }
      />

      <div className="mb-4">
        <SearchBox
          placeholder="搜索部署名称..."
          onSearch={setKeyword}
          data-testid="deployment-search"
        />
      </div>

      <DataTable
        columns={columns}
        data={deployments}
        loading={false}
        pagination={{
          page,
          pageSize,
          total: deployments.length,
          onPageChange: setPage,
          onPageSizeChange: setPageSize,
        }}
        emptyText="暂无部署数据"
      />
    </div>
  );
}
