import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageHeader } from '@/components/organisms/PageHeader';
import { DataTable, Column } from '@/components/organisms/DataTable';
import { SearchBox } from '@/components/molecules/SearchBox';
import { StatusBadge } from '@/components/molecules/StatusBadge';
import { Button } from '@/components/ui/button';
import { Plus, Copy } from 'lucide-react';
import { useTokens } from '@/hooks/queries/useTokens';
import { useToast } from '@/hooks/use-toast';
import { copyToClipboard, formatDateTime } from '@/lib/utils';
import type { Token } from '@/types/token';

export default function TokenList() {
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [keyword, setKeyword] = useState('');
  const { toast } = useToast();

  const { data, isLoading } = useTokens({ page, pageSize, keyword });

  const handleCopyKey = async (key: string) => {
    const success = await copyToClipboard(key);
    if (success) {
      toast({
        title: '复制成功',
        description: '令牌已复制到剪贴板',
      });
    }
  };

  const columns: Column<Token>[] = [
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
      title: '密钥',
      render: (value) => (
        <div className="flex items-center gap-2">
          <code className="text-xs">{value.substring(0, 20)}...</code>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => handleCopyKey(value)}
            data-testid={`copy-key-${value}`}
          >
            <Copy className="h-3 w-3" />
          </Button>
        </div>
      ),
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
          <Button
            size="sm"
            variant="outline"
            onClick={() => navigate(`/console/tokens/${record.id}/edit`)}
            data-testid={`edit-token-${record.id}`}
          >
            编辑
          </Button>
          <Button size="sm" variant="destructive" data-testid={`delete-token-${record.id}`}>
            删除
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div data-testid="token-list-page">
      <PageHeader
        title="令牌管理"
        description="管理 API 访问令牌"
        actions={
          <Button data-testid="create-token-button">
            <Plus className="mr-2 h-4 w-4" />
            创建令牌
          </Button>
        }
      />

      <div className="mb-4">
        <SearchBox
          placeholder="搜索令牌名称..."
          onSearch={setKeyword}
          data-testid="token-search"
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
        emptyText="暂无令牌数据"
      />
    </div>
  );
}
