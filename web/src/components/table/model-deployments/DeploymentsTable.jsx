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

import React, { useMemo, useState } from 'react';
import { Empty } from '@douyinfe/semi-ui';
import CardTable from '../../common/ui/CardTable';
import {
  IllustrationNoResult,
  IllustrationNoResultDark,
} from '@douyinfe/semi-illustrations';
import { getDeploymentsColumns } from './DeploymentsColumnDefs';

// Import all the new modals
import ViewLogsModal from './modals/ViewLogsModal';
import ExtendDurationModal from './modals/ExtendDurationModal';
import ViewDetailsModal from './modals/ViewDetailsModal';
import UpdateConfigModal from './modals/UpdateConfigModal';
import ConfirmationDialog from './modals/ConfirmationDialog';

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
    rowSelection,
    batchOperationsEnabled = true,
    handlePageChange,
    handlePageSizeChange,
    handleRow,
    t,
    COLUMN_KEYS,
    // Column functions and data
    startDeployment,
    restartDeployment,
    deleteDeployment,
    syncDeploymentToChannel,
    setEditingDeployment,
    setShowEdit,
    refresh,
  } = deploymentsData;

  // Modal states
  const [selectedDeployment, setSelectedDeployment] = useState(null);
  const [showLogsModal, setShowLogsModal] = useState(false);
  const [showExtendModal, setShowExtendModal] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [confirmOperation, setConfirmOperation] = useState('delete');

  // Enhanced modal handlers
  const handleViewLogs = (deployment) => {
    setSelectedDeployment(deployment);
    setShowLogsModal(true);
  };

  const handleExtendDuration = (deployment) => {
    setSelectedDeployment(deployment);
    setShowExtendModal(true);
  };

  const handleViewDetails = (deployment) => {
    setSelectedDeployment(deployment);
    setShowDetailsModal(true);
  };

  const handleUpdateConfig = (deployment, operation = 'update') => {
    setSelectedDeployment(deployment);
    if (operation === 'delete' || operation === 'destroy') {
      setConfirmOperation(operation);
      setShowConfirmDialog(true);
    } else {
      setShowConfigModal(true);
    }
  };

  const handleConfirmAction = () => {
    if (
      selectedDeployment &&
      (confirmOperation === 'delete' || confirmOperation === 'destroy')
    ) {
      deleteDeployment(selectedDeployment.id);
    }
    setShowConfirmDialog(false);
    setSelectedDeployment(null);
  };

  const handleModalSuccess = (updatedDeployment) => {
    // Refresh the deployments list
    refresh?.();
  };

  // Get all columns
  const allColumns = useMemo(() => {
    return getDeploymentsColumns({
      t,
      COLUMN_KEYS,
      startDeployment,
      restartDeployment,
      deleteDeployment,
      setEditingDeployment,
      setShowEdit,
      refresh,
      activePage,
      deployments,
      // Enhanced handlers
      onViewLogs: handleViewLogs,
      onExtendDuration: handleExtendDuration,
      onViewDetails: handleViewDetails,
      onUpdateConfig: handleUpdateConfig,
      onSyncToChannel: syncDeploymentToChannel,
    });
  }, [
    t,
    COLUMN_KEYS,
    startDeployment,
    restartDeployment,
    deleteDeployment,
    syncDeploymentToChannel,
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
    if (compactMode) {
      // In compact mode, remove fixed columns and adjust widths
      return visibleColumnsList.map(({ fixed, width, ...rest }) => ({
        ...rest,
        width: width ? Math.max(width * 0.8, 80) : undefined, // Reduce width by 20% but keep minimum
      }));
    }
    return visibleColumnsList;
  }, [compactMode, visibleColumnsList]);

  return (
    <>
      <CardTable
        columns={tableColumns}
        dataSource={deployments}
        scroll={compactMode ? { x: 800 } : { x: 1200 }}
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
        rowSelection={batchOperationsEnabled ? rowSelection : undefined}
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

      {/* Enhanced Modals */}
      <ViewLogsModal
        visible={showLogsModal}
        onCancel={() => setShowLogsModal(false)}
        deployment={selectedDeployment}
        t={t}
      />

      <ExtendDurationModal
        visible={showExtendModal}
        onCancel={() => setShowExtendModal(false)}
        deployment={selectedDeployment}
        onSuccess={handleModalSuccess}
        t={t}
      />

      <ViewDetailsModal
        visible={showDetailsModal}
        onCancel={() => setShowDetailsModal(false)}
        deployment={selectedDeployment}
        t={t}
      />

      <UpdateConfigModal
        visible={showConfigModal}
        onCancel={() => setShowConfigModal(false)}
        deployment={selectedDeployment}
        onSuccess={handleModalSuccess}
        t={t}
      />

      <ConfirmationDialog
        visible={showConfirmDialog}
        onCancel={() => setShowConfirmDialog(false)}
        onConfirm={handleConfirmAction}
        title={t('确认操作')}
        type='danger'
        deployment={selectedDeployment}
        operation={confirmOperation}
        t={t}
      />
    </>
  );
};

export default DeploymentsTable;
