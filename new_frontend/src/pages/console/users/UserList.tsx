import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageHeader } from '@/components/organisms/PageHeader';
import { DataTable, Column } from '@/components/organisms/DataTable';
import { SearchBox } from '@/components/molecules/SearchBox';
import { StatusBadge } from '@/components/molecules/StatusBadge';
import { Button } from '@/components/ui/button';
import { Plus, Shield, ShieldAlert, ShieldCheck } from 'lucide-react';
import { useUsers } from '@/hooks/queries/useUsers';
import { formatDateTime } from '@/lib/utils';
import type { User } from '@/types/user';
import { USER_ROLES } from '@/lib/constants';

export default function UserList() {
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [keyword, setKeyword] = useState('');

  const { data, isLoading } = useUsers({ page, pageSize, keyword });

  const getRoleIcon = (role: number) => {
    if (role >= USER_ROLES.ROOT) return <ShieldCheck className="h-4 w-4 text-purple-600" />;
    if (role >= USER_ROLES.ADMIN) return <ShieldAlert className="h-4 w-4 text-blue-600" />;
    return <Shield className="h-4 w-4 text-gray-600" />;
  };

  const getRoleName = (role: number) => {
    if (role >= USER_ROLES.ROOT) return '超级管理员';
    if (role >= USER_ROLES.ADMIN) return '管理员';
    return '普通用户';
  };

  const columns: Column<User>[] = [
    {
      key: 'id',
      title: 'ID',
      width: '80px',
    },
    {
      key: 'username',
      title: '用户名',
    },
    {
      key: 'displayName',
      title: '显示名称',
      render: (value) => value || '-',
    },
    {
      key: 'email',
      title: '邮箱',
      render: (value) => value || '-',
    },
    {
      key: 'role',
      title: '角色',
      render: (value) => (
        <div className="flex items-center gap-2">
          {getRoleIcon(value)}
          <span>{getRoleName(value)}</span>
        </div>
      ),
    },
    {
      key: 'status',
      title: '状态',
      render: (value) => (
        <StatusBadge status={value === 1 ? 'enabled' : 'disabled'} />
      ),
    },
    {
      key: 'quota',
      title: '额度',
      render: (value, record) => {
        const remaining = (value - record.usedQuota) / 500000;
        return `¥${remaining.toFixed(2)}`;
      },
    },
    {
      key: 'createdTime',
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
            onClick={() => navigate(`/console/users/${record.id}/edit`)}
            data-testid={`edit-user-${record.id}`}
          >
            编辑
          </Button>
          <Button size="sm" variant="outline" data-testid={`manage-user-${record.id}`}>
            管理
          </Button>
          <Button size="sm" variant="destructive" data-testid={`delete-user-${record.id}`}>
            删除
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div data-testid="user-list-page">
      <PageHeader
        title="用户管理"
        description="管理系统用户和权限"
        actions={
          <Button onClick={() => navigate('/console/users/create')} data-testid="create-user-button">
            <Plus className="mr-2 h-4 w-4" />
            创建用户
          </Button>
        }
      />

      <div className="mb-4">
        <SearchBox
          placeholder="搜索用户名或邮箱..."
          onSearch={setKeyword}
          data-testid="user-search"
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
        emptyText="暂无用户数据"
      />
    </div>
  );
}
