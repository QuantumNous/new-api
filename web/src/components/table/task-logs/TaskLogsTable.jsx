import React, { useMemo } from 'react';
import { Empty, Spin } from '@douyinfe/semi-ui';
import CardTable from '../../common/ui/CardTable';
import {
  IllustrationNoResult,
  IllustrationNoResultDark,
} from '@douyinfe/semi-illustrations';
import { getTaskLogsColumns } from './TaskLogsColumnDefs';
import { useIsMobile } from '../../../hooks/common/useIsMobile';

const TaskLogsTable = (taskLogsData) => {
  const isMobile = useIsMobile();
  const {
    logs,
    loading,
    activePage,
    pageSize,
    logCount,
    compactMode,
    visibleColumns,
    handlePageChange,
    handlePageSizeChange,
    copyText,
    openContentModal,
    openVideoModal,
    openAudioModal,
    showUserInfoFunc,
    isAdminUser,
    t,
    COLUMN_KEYS,
  } = taskLogsData;

  // Get all columns
  const allColumns = useMemo(() => {
    return getTaskLogsColumns({
      t,
      COLUMN_KEYS,
      copyText,
      openContentModal,
      openVideoModal,
      openAudioModal,
      showUserInfoFunc,
      isAdminUser,
    });
  }, [t, COLUMN_KEYS, copyText, openContentModal, openVideoModal, openAudioModal, showUserInfoFunc, isAdminUser]);

  // Filter columns based on visibility settings
  const getVisibleColumns = () => {
    return allColumns.filter((column) => visibleColumns[column.key]);
  };

  const visibleColumnsList = useMemo(() => {
    return getVisibleColumns();
  }, [visibleColumns, allColumns]);

  const tableColumns = useMemo(() => {
    return compactMode
      ? visibleColumnsList.map(({ fixed, ...rest }) => rest)
      : visibleColumnsList;
  }, [compactMode, visibleColumnsList]);

  if (!isMobile && loading && (!logs || logs.length === 0)) {
    return (
      <div className='table-centered-loading-state'>
        <Spin size='large' />
      </div>
    );
  }

  return (
    <CardTable
      columns={tableColumns}
      dataSource={logs}
      rowKey='key'
      loading={loading}
      scroll={compactMode ? undefined : { x: 'max-content' }}
      className='rounded-xl overflow-hidden'
      size='middle'
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
      pagination={{
        currentPage: activePage,
        pageSize: pageSize,
        total: logCount,
        pageSizeOptions: [10, 20, 50, 100],
        showSizeChanger: true,
        onPageSizeChange: handlePageSizeChange,
        onPageChange: handlePageChange,
      }}
      hidePagination={true}
    />
  );
};

export default TaskLogsTable;
