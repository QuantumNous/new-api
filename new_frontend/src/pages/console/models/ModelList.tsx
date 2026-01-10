import { useState } from 'react';
import { PageHeader } from '@/components/organisms/PageHeader';
import { DataTable, Column } from '@/components/organisms/DataTable';
import { SearchBox } from '@/components/molecules/SearchBox';
import { Button } from '@/components/ui/button';
import { Plus, RefreshCw } from 'lucide-react';

interface Model {
  id: string;
  name: string;
  type: string;
  ratio: number;
  enabled: boolean;
}

export default function ModelList() {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [keyword, setKeyword] = useState('');
  const [isLoading] = useState(false);

  const columns: Column<Model>[] = [
    {
      key: 'id',
      title: 'ID',
      width: '80px',
    },
    {
      key: 'name',
      title: '模型名称',
    },
    {
      key: 'type',
      title: '类型',
    },
    {
      key: 'ratio',
      title: '倍率',
      render: (value) => `${value}x`,
    },
    {
      key: 'enabled',
      title: '状态',
      render: (value) => (
        <span className={value ? 'text-green-600' : 'text-gray-400'}>
          {value ? '启用' : '禁用'}
        </span>
      ),
    },
    {
      key: 'actions',
      title: '操作',
      width: '150px',
      render: (_, record) => (
        <div className="flex gap-2">
          <Button size="sm" variant="outline" data-testid={`edit-model-${record.id}`}>
            编辑
          </Button>
          <Button size="sm" variant="destructive" data-testid={`delete-model-${record.id}`}>
            删除
          </Button>
        </div>
      ),
    },
  ];

  const mockData: Model[] = [];

  return (
    <div data-testid="model-list-page">
      <PageHeader
        title="模型管理"
        description="管理 AI 模型配置和倍率"
        actions={
          <div className="flex gap-2">
            <Button variant="outline" data-testid="sync-models-button">
              <RefreshCw className="mr-2 h-4 w-4" />
              同步模型
            </Button>
            <Button data-testid="create-model-button">
              <Plus className="mr-2 h-4 w-4" />
              创建模型
            </Button>
          </div>
        }
      />

      <div className="mb-4">
        <SearchBox
          placeholder="搜索模型名称..."
          onSearch={setKeyword}
          data-testid="model-search"
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
        emptyText="暂无模型数据"
      />
    </div>
  );
}
