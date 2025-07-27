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

import React from 'react';
import CardPro from '../../common/ui/CardPro';
import RedemptionsTable from './RedemptionsTable.jsx';
import RedemptionsActions from './RedemptionsActions.jsx';
import RedemptionsFilters from './RedemptionsFilters.jsx';
import RedemptionsDescription from './RedemptionsDescription.jsx';
import EditRedemptionModal from './modals/EditRedemptionModal';
import { useRedemptionsData } from '../../../hooks/redemptions/useRedemptionsData';
import { useIsMobile } from '../../../hooks/common/useIsMobile';
import { createCardProPagination } from '../../../helpers/utils';

const RedemptionsPage = () => {
  const redemptionsData = useRedemptionsData();
  const isMobile = useIsMobile();

  const {
    // Edit state
    showEdit,
    editingRedemption,
    closeEdit,
    refresh,

    // Actions state
    selectedKeys,
    setEditingRedemption,
    setShowEdit,
    batchCopyRedemptions,
    batchDeleteRedemptions,

    // Filters state
    formInitValues,
    setFormApi,
    searchRedemptions,
    loading,
    searching,

    // UI state
    compactMode,
    setCompactMode,

    // Translation
    t,
  } = redemptionsData;

  return (
    <>
      <EditRedemptionModal
        refresh={refresh}
        editingRedemption={editingRedemption}
        visiable={showEdit}
        handleClose={closeEdit}
      />

      <CardPro
        type="type1"
        descriptionArea={
          <RedemptionsDescription
            compactMode={compactMode}
            setCompactMode={setCompactMode}
            t={t}
          />
        }
        actionsArea={
          <div className="flex flex-col md:flex-row justify-between items-center gap-2 w-full">
            <RedemptionsActions
              selectedKeys={selectedKeys}
              setEditingRedemption={setEditingRedemption}
              setShowEdit={setShowEdit}
              batchCopyRedemptions={batchCopyRedemptions}
              batchDeleteRedemptions={batchDeleteRedemptions}
              t={t}
            />

            <div className="w-full md:w-full lg:w-auto order-1 md:order-2">
              <RedemptionsFilters
                formInitValues={formInitValues}
                setFormApi={setFormApi}
                searchRedemptions={searchRedemptions}
                loading={loading}
                searching={searching}
                t={t}
              />
            </div>
          </div>
        }
        paginationArea={createCardProPagination({
          currentPage: redemptionsData.activePage,
          pageSize: redemptionsData.pageSize,
          total: redemptionsData.tokenCount,
          onPageChange: redemptionsData.handlePageChange,
          onPageSizeChange: redemptionsData.handlePageSizeChange,
          isMobile: isMobile,
          t: redemptionsData.t,
        })}
        t={redemptionsData.t}
      >
        <RedemptionsTable {...redemptionsData} />
      </CardPro>
    </>
  );
};

export default RedemptionsPage; 