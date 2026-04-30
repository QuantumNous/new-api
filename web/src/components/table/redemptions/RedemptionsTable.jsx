/*
Copyright (C) 2025 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/

// /console/redemption table — thin glue around the shared HeroTable
// wrapper so the redemptions view inherits the same row rhythm as
// /console/token.
//
// Selection: hook stores `selectedKeys` as an array of full row
// objects; HeroTable round-trips that to HeroUI's Set<key>.
//
// Disabled / used / expired redemptions get `opacity-60` so the visual
// disabled-state cue matches the rest of the console.

import React, { useMemo, useState } from 'react';
import HeroTable from '../../common/ui/HeroTable';
import { getRedemptionsColumns, isExpired } from './RedemptionsColumnDefs';
import {
  REDEMPTION_STATUS,
} from '../../../constants/redemption.constants';
import DeleteRedemptionModal from './modals/DeleteRedemptionModal';

const RedemptionsTable = (redemptionsData) => {
  const {
    redemptions,
    loading,
    activePage,
    compactMode,
    selectedKeys,
    setSelectedKeys,
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

  const showDeleteRedemptionModal = (record) => {
    setDeletingRecord(record);
    setShowDeleteModal(true);
  };

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
      showDeleteRedemptionModal,
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

  // Compact mode strips `fixed` from the operations column so it
  // joins the natural horizontal flow instead of being pinned right.
  const tableColumns = useMemo(() => {
    return compactMode
      ? columns.map((col) => {
          if (col.dataIndex === 'operate') {
            const { fixed, ...rest } = col;
            return rest;
          }
          return col;
        })
      : columns;
  }, [compactMode, columns]);

  return (
    <>
      <HeroTable
        ariaLabel={t('兑换码列表')}
        columns={tableColumns}
        dataSource={redemptions || []}
        loading={loading}
        emptyDescription={t('搜索无结果')}
        rowClassName={(record) => {
          // Used codes and expired/unused codes are dimmed — same
          // semantics the previous CardTable's `handleRow` carried, just
          // expressed through opacity to align with /console/token.
          if (record.status === REDEMPTION_STATUS.USED) return 'opacity-60';
          if (isExpired(record)) return 'opacity-60';
          return '';
        }}
        rowSelection={{
          selectionMode: 'multiple',
          selectedRows: selectedKeys || [],
          onSelectionChange: (rows) => setSelectedKeys?.(rows),
        }}
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
