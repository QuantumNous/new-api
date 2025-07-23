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
import CardTable from '../../common/ui/CardTable.js';
import {
  IllustrationNoResult,
  IllustrationNoResultDark
} from '@douyinfe/semi-illustrations';
import { getRedemptionsColumns, isExpired } from './RedemptionsColumnDefs';
import DeleteRedemptionModal from './modals/DeleteRedemptionModal';

const RedemptionsTable = (redemptionsData) => {
  const {
    redemptions,
    loading,
    activePage,
    pageSize,
    tokenCount,
    compactMode,
    handlePageChange,
    rowSelection,
    handleRow,
    manageRedemption,
    copyText,
    setEditingRedemption,
    setShowEdit,
    refresh,
    t,
  } = redemptionsData;

  // Modal states
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deletingRecord, setDeletingRecord] = useState(null);

  // Handle show delete modal
  const showDeleteRedemptionModal = (record) => {
    setDeletingRecord(record);
    setShowDeleteModal(true);
  };

  // Get all columns
  const columns = useMemo(() => {
    return getRedemptionsColumns({
      t,
      manageRedemption,
      copyText,
      setEditingRedemption,
      setShowEdit,
      refresh,
      redemptions,
      activePage,
      showDeleteRedemptionModal
    });
  }, [
    t,
    manageRedemption,
    copyText,
    setEditingRedemption,
    setShowEdit,
    refresh,
    redemptions,
    activePage,
    showDeleteRedemptionModal,
  ]);

  // Handle compact mode by removing fixed positioning
  const tableColumns = useMemo(() => {
    return compactMode ? columns.map(col => {
      if (col.dataIndex === 'operate') {
        const { fixed, ...rest } = col;
        return rest;
      }
      return col;
    }) : columns;
  }, [compactMode, columns]);

  return (
    <>
      <CardTable
        columns={tableColumns}
        dataSource={redemptions}
        scroll={compactMode ? undefined : { x: 'max-content' }}
        pagination={{
          currentPage: activePage,
          pageSize: pageSize,
          total: tokenCount,
          showSizeChanger: true,
          pageSizeOptions: [10, 20, 50, 100],
          onPageSizeChange: redemptionsData.handlePageSizeChange,
          onPageChange: handlePageChange,
        }}
        hidePagination={true}
        loading={loading}
        rowSelection={rowSelection}
        onRow={handleRow}
        empty={
          <Empty
            image={<IllustrationNoResult style={{ width: 150, height: 150 }} />}
            darkModeImage={<IllustrationNoResultDark style={{ width: 150, height: 150 }} />}
            description={t('搜索无结果')}
            style={{ padding: 30 }}
          />
        }
        className="rounded-xl overflow-hidden"
        size="middle"
      />

      <DeleteRedemptionModal
        visible={showDeleteModal}
        onCancel={() => setShowDeleteModal(false)}
        record={deletingRecord}
        manageRedemption={manageRedemption}
        refresh={refresh}
        redemptions={redemptions}
        activePage={activePage}
        t={t}
      />
    </>
  );
};

export default RedemptionsTable; 