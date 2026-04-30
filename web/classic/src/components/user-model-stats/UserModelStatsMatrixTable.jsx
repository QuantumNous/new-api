import React from 'react';
import { Button, Card, Space, Table, Tag, Tooltip } from '@douyinfe/semi-ui';
import { renderQuota } from '../../helpers';

const buildCellMap = (cells = []) => {
  const m = new Map();
  for (const cell of cells) {
    m.set(`${cell.username}__${cell.model_name}`, cell);
  }
  return m;
};

const cellView = (cell) => {
  if (!cell) {
    return '-';
  }
  const content = (
    <div>
      <div>count: {cell.count || 0}</div>
      <div>token_used: {cell.token_used || 0}</div>
      <div>quota: {renderQuota(cell.quota || 0)}</div>
    </div>
  );
  return (
    <Tooltip content={content} position='top'>
      <span>{cell.token_used || 0}</span>
    </Tooltip>
  );
};

export const UserModelStatsMatrixTable = ({
  data,
  loading,
  matrixPivot,
  onPivotChange,
  matrixPagination,
  onMatrixPaginationChange,
  t,
}) => {
  const users = data?.users || [];
  const models = data?.models || [];
  const cells = data?.cells || [];
  const summary = data?.summary || {};
  const pagination = data?.pagination || {};
  const cellMap = buildCellMap(cells);

  const rowAsUser = matrixPivot === 'user_as_row';
  const rowKeys = rowAsUser ? users : models;
  const colKeys = rowAsUser ? models : users;
  const rowTitle = rowAsUser ? t('用户') : t('模型');

  const columns = [
    {
      title: rowTitle,
      dataIndex: 'rowKey',
      key: 'rowKey',
      fixed: 'left',
      render: (v) =>
        rowAsUser ? v : <Tag type='light' size='small'>{v}</Tag>,
    },
    ...colKeys.map((col) => ({
      title: rowAsUser ? <Tag type='light' size='small'>{col}</Tag> : col,
      dataIndex: col,
      key: col,
      render: (_, record) => {
        const user = rowAsUser ? record.rowKey : col;
        const model = rowAsUser ? col : record.rowKey;
        return cellView(cellMap.get(`${user}__${model}`));
      },
    })),
  ];

  const dataSource = rowKeys.map((rowKey) => ({ rowKey }));

  return (
    <div>
      <div className='mb-3 flex items-center justify-between'>
        <Space>
          <Card bodyStyle={{ padding: 12 }}>
            <div className='text-xs text-gray-500'>{t('Top 1 用户')}</div>
            <div className='font-semibold'>{summary?.top_user?.username || '-'}</div>
            <div className='text-xs text-gray-500'>{summary?.top_user?.token_used || 0} Tokens</div>
          </Card>
          <Card bodyStyle={{ padding: 12 }}>
            <div className='text-xs text-gray-500'>{t('Top 1 模型')}</div>
            <div className='font-semibold'>{summary?.top_model?.model_name || '-'}</div>
            <div className='text-xs text-gray-500'>{summary?.top_model?.token_used || 0} Tokens</div>
          </Card>
        </Space>
        <Button
          onClick={() =>
            onPivotChange(rowAsUser ? 'model_as_row' : 'user_as_row')
          }
        >
          {t('切换行列')}
        </Button>
      </div>

      <Table
        columns={columns}
        dataSource={dataSource}
        loading={loading}
        rowKey='rowKey'
        pagination={false}
        scroll={{ x: 'max-content' }}
      />

      <div className='mt-3 flex items-center gap-2'>
        <Button
          disabled={matrixPagination.userPage <= 1}
          onClick={() =>
            onMatrixPaginationChange({
              ...matrixPagination,
              userPage: Math.max(1, matrixPagination.userPage - 1),
            })
          }
        >
          {t('上一页用户')}
        </Button>
        <Button
          disabled={
            matrixPagination.userPage * matrixPagination.pageSize >=
            (pagination.user_total || 0)
          }
          onClick={() =>
            onMatrixPaginationChange({
              ...matrixPagination,
              userPage: matrixPagination.userPage + 1,
            })
          }
        >
          {t('下一页用户')}
        </Button>
        <Button
          disabled={matrixPagination.modelPage <= 1}
          onClick={() =>
            onMatrixPaginationChange({
              ...matrixPagination,
              modelPage: Math.max(1, matrixPagination.modelPage - 1),
            })
          }
        >
          {t('上一页模型')}
        </Button>
        <Button
          disabled={
            matrixPagination.modelPage * matrixPagination.pageSize >=
            (pagination.model_total || 0)
          }
          onClick={() =>
            onMatrixPaginationChange({
              ...matrixPagination,
              modelPage: matrixPagination.modelPage + 1,
            })
          }
        >
          {t('下一页模型')}
        </Button>
      </div>
    </div>
  );
};
