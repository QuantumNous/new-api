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

import React, { useState } from 'react';
import CardPro from '../../common/ui/CardPro';
import DeploymentsTable from './DeploymentsTable';
import DeploymentsActions from './DeploymentsActions';
import DeploymentsFilters from './DeploymentsFilters';
import EditDeploymentModal from './modals/EditDeploymentModal';
import CreateDeploymentModal from './modals/CreateDeploymentModal';
import ColumnSelectorModal from './modals/ColumnSelectorModal';
import { useDeploymentsData } from '../../../hooks/model-deployments/useDeploymentsData';
import { useIsMobile } from '../../../hooks/common/useIsMobile';
import { createCardProPagination } from '../../../helpers/utils';

const DeploymentsPage = () => {
  const deploymentsData = useDeploymentsData();
  const isMobile = useIsMobile();

  // Create deployment modal state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const batchOperationsEnabled = false;

  const {
    // Edit state
    showEdit,
    editingDeployment,
    closeEdit,
    refresh,

    // Actions state
    selectedKeys,
    setSelectedKeys,
    setEditingDeployment,
    setShowEdit,
    batchDeleteDeployments,

    // Filters state
    formInitValues,
    setFormApi,
    searchDeployments,
    loading,
    searching,

    // Column visibility
    showColumnSelector,
    setShowColumnSelector,
    visibleColumns,
    setVisibleColumns,
    COLUMN_KEYS,

    // Description state
    compactMode,
    setCompactMode,

    // Translation
    t,
  } = deploymentsData;

  return (
    <>
      {/* Modals */}
      <EditDeploymentModal
        refresh={refresh}
        editingDeployment={editingDeployment}
        visible={showEdit}
        handleClose={closeEdit}
      />

      <CreateDeploymentModal
        visible={showCreateModal}
        onCancel={() => setShowCreateModal(false)}
        onSuccess={refresh}
        t={t}
      />

      <ColumnSelectorModal
        visible={showColumnSelector}
        onCancel={() => setShowColumnSelector(false)}
        visibleColumns={visibleColumns}
        onVisibleColumnsChange={setVisibleColumns}
        columnKeys={COLUMN_KEYS}
        t={t}
      />

      {/* Main Content */}
      <CardPro
        type='type3'
        actionsArea={
          <div className='flex flex-col md:flex-row justify-between items-center gap-2 w-full'>
            <DeploymentsActions
              selectedKeys={selectedKeys}
              setSelectedKeys={setSelectedKeys}
              setEditingDeployment={setEditingDeployment}
              setShowEdit={setShowEdit}
              batchDeleteDeployments={batchDeleteDeployments}
              batchOperationsEnabled={batchOperationsEnabled}
              compactMode={compactMode}
              setCompactMode={setCompactMode}
              showCreateModal={showCreateModal}
              setShowCreateModal={setShowCreateModal}
              setShowColumnSelector={setShowColumnSelector}
              t={t}
            />
            <DeploymentsFilters
              formInitValues={formInitValues}
              setFormApi={setFormApi}
              searchDeployments={searchDeployments}
              loading={loading}
              searching={searching}
              setShowColumnSelector={setShowColumnSelector}
              t={t}
            />
          </div>
        }
        paginationArea={createCardProPagination({
          currentPage: deploymentsData.activePage,
          pageSize: deploymentsData.pageSize,
          total: deploymentsData.deploymentCount,
          onPageChange: deploymentsData.handlePageChange,
          onPageSizeChange: deploymentsData.handlePageSizeChange,
          isMobile: isMobile,
          t: deploymentsData.t,
        })}
        t={deploymentsData.t}
      >
        <DeploymentsTable
          {...deploymentsData}
          batchOperationsEnabled={batchOperationsEnabled}
        />
      </CardPro>
    </>
  );
};

export default DeploymentsPage;
