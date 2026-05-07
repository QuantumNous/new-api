import React, { useMemo } from 'react';
import { Tag } from '@douyinfe/semi-ui';
import CardTable from '../common/ui/CardTable';
import { renderQuota } from '../../helpers';

const COLUMNS = {
  userTotal: (t) => [
    { title: t('用户ID'), dataIndex: 'user_id', key: 'user_id' },
    { title: t('用户'), dataIndex: 'username', key: 'username' },
    { title: t('用户分组'), dataIndex: 'user_group', key: 'user_group' },
    { title: t('请求次数'), dataIndex: 'count', key: 'count' },
    { title: t('总 Tokens'), dataIndex: 'token_used', key: 'token_used' },
    {
      title: t('额度消耗'),
      dataIndex: 'quota',
      key: 'quota',
      render: (v) => renderQuota(v),
    },
  ],
  modelTotal: (t) => [
    {
      title: t('模型'),
      dataIndex: 'model_name',
      key: 'model_name',
      render: (v) => <Tag type='light'>{v}</Tag>,
    },
    { title: t('请求次数'), dataIndex: 'count', key: 'count' },
    { title: t('总 Tokens'), dataIndex: 'token_used', key: 'token_used' },
    {
      title: t('额度消耗'),
      dataIndex: 'quota',
      key: 'quota',
      render: (v) => renderQuota(v),
    },
  ],
  detail: (t) => [
    { title: t('用户ID'), dataIndex: 'user_id', key: 'user_id' },
    { title: t('用户'), dataIndex: 'username', key: 'username' },
    { title: t('用户分组'), dataIndex: 'user_group', key: 'user_group' },
    {
      title: t('模型'),
      dataIndex: 'model_name',
      key: 'model_name',
      render: (v) => <Tag type='light'>{v}</Tag>,
    },
    { title: t('请求次数'), dataIndex: 'count', key: 'count' },
    { title: t('总 Tokens'), dataIndex: 'token_used', key: 'token_used' },
    {
      title: t('额度消耗'),
      dataIndex: 'quota',
      key: 'quota',
      render: (v) => renderQuota(v),
    },
  ],
};

export const UserModelStatsTable = ({ items, loading, pagination, onPaginationChange, t, type = 'detail' }) => {
  const columns = useMemo(() => {
    const builder = COLUMNS[type] || COLUMNS.detail;
    return builder(t);
  }, [t, type]);

  return (
    <CardTable
      columns={columns}
      dataSource={items}
      loading={loading}
      pagination={{
        currentPage: pagination.page,
        pageSize: pagination.pageSize,
        total: pagination.total,
        onPageChange: (page) => onPaginationChange({ ...pagination, page }),
        onPageSizeChange: (pageSize) => onPaginationChange({ ...pagination, page: 1, pageSize }),
      }}
    />
  );
};
