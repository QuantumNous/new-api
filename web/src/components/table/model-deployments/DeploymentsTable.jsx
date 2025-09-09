/*
Copyright (C) 2025 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/

import React, { useMemo } from 'react';
import { Empty } from '@douyinfe/semi-ui';
import CardTable from '../../common/ui/CardTable';
import {
  IllustrationNoResult,
  IllustrationNoResultDark,
} from '@douyinfe/semi-illustrations';
import { getDeploymentsColumns } from './DeploymentsColumnDefs';

const DeploymentsTable = (deploymentsData) => {
  const {
    deployments,
    loading,
    searching,
    activePage,
    pageSize,
    deploymentCount,
    compactMode,
    visibleColumns,
    setSelectedKeys,
    handlePageChange,
    handlePageSizeChange,
    handleRow,
    t,
    COLUMN_KEYS,
    // Column functions and data
    startDeployment,
    stopDeployment,
    restartDeployment,
    deleteDeployment,
    setEditingDeployment,
    setShowEdit,
    refresh,
  } = deploymentsData;

  // Get all columns
  const allColumns = useMemo(() => {
    return getDeploymentsColumns({
      t,
      COLUMN_KEYS,
      startDeployment,
      stopDeployment,
      restartDeployment,
      deleteDeployment,
      setEditingDeployment,
      setShowEdit,
      refresh,
      activePage,
      deployments,
    });
  }, [
    t,
    COLUMN_KEYS,
    startDeployment,
    stopDeployment,
    restartDeployment,
    deleteDeployment,
    setEditingDeployment,
    setShowEdit,
    refresh,
    activePage,
    deployments,
  ]);

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

  return (
    <CardTable
      columns={tableColumns}
      dataSource={deployments}
      scroll={compactMode ? undefined : { x: 'max-content' }}
      pagination={{
        currentPage: activePage,
        pageSize: pageSize,
        total: deploymentCount,
        pageSizeOpts: [10, 20, 50, 100],
        showSizeChanger: true,
        onPageSizeChange: handlePageSizeChange,
        onPageChange: handlePageChange,
      }}
      hidePagination={true}
      expandAllRows={false}
      onRow={handleRow}
      rowSelection={{
        onChange: (selectedRowKeys, selectedRows) => {
          setSelectedKeys(selectedRows);
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
      loading={loading || searching}
    />
  );
};

export default DeploymentsTable;