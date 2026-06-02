import React, { useMemo } from 'react';
import { Empty } from '@douyinfe/semi-ui';
import {
  IllustrationNoResult,
  IllustrationNoResultDark,
} from '@douyinfe/semi-illustrations';
import CardTable from '../../common/ui/CardTable';
import { PREPARATION_STATUS } from '../../../hooks/channels/useChannelPreparationsData';
import { getPreparationColumns } from './PreparationColumnDefs';

const PreparationTable = ({
  t,
  preparations,
  loading,
  activePage,
  pageSize,
  total,
  handlePageChange,
  handlePageSizeChange,
  selectedPreparationKeys,
  setSelectedPreparationKeys,
  setSelectedPreparations,
  openEdit,
  promotePreparation,
  deletePreparation,
}) => {
  const columns = useMemo(
    () =>
      getPreparationColumns({
        t,
        openEdit,
        promotePreparation,
        deletePreparation,
      }),
    [t, openEdit, promotePreparation, deletePreparation],
  );

  return (
    <CardTable
      columns={columns}
      dataSource={preparations}
      rowKey='id'
      scroll={{ x: 'max-content' }}
      pagination={{
        currentPage: activePage,
        pageSize,
        total,
        pageSizeOpts: [10, 20, 50, 100],
        showSizeChanger: true,
        onPageSizeChange: handlePageSizeChange,
        onPageChange: handlePageChange,
      }}
      hidePagination={true}
      rowSelection={{
        selectedRowKeys: selectedPreparationKeys,
        getCheckboxProps: (record) => ({
          disabled: record.status !== PREPARATION_STATUS.PENDING,
        }),
        onChange: (selectedRowKeys, selectedRows) => {
          setSelectedPreparationKeys(selectedRowKeys);
          setSelectedPreparations(
            selectedRows.filter(
              (item) => item.status === PREPARATION_STATUS.PENDING,
            ),
          );
        },
      }}
      empty={
        <Empty
          image={<IllustrationNoResult style={{ width: 150, height: 150 }} />}
          darkModeImage={
            <IllustrationNoResultDark style={{ width: 150, height: 150 }} />
          }
          description={t('搜索无结果')}
          style={{ padding: 30 }}
        />
      }
      className='rounded-xl overflow-hidden'
      size='middle'
      loading={loading}
    />
  );
};

export default PreparationTable;
