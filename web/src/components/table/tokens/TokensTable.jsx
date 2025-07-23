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
import CardTable from '../../common/ui/CardTable.js';
import {
  IllustrationNoResult,
  IllustrationNoResultDark,
} from '@douyinfe/semi-illustrations';
import { getTokensColumns } from './TokensColumnDefs.js';

const TokensTable = (tokensData) => {
  const {
    tokens,
    loading,
    activePage,
    pageSize,
    tokenCount,
    compactMode,
    handlePageChange,
    handlePageSizeChange,
    rowSelection,
    handleRow,
    showKeys,
    setShowKeys,
    copyText,
    manageToken,
    onOpenLink,
    setEditingToken,
    setShowEdit,
    refresh,
    t,
  } = tokensData;

  // Get all columns
  const columns = useMemo(() => {
    return getTokensColumns({
      t,
      showKeys,
      setShowKeys,
      copyText,
      manageToken,
      onOpenLink,
      setEditingToken,
      setShowEdit,
      refresh,
    });
  }, [
    t,
    showKeys,
    setShowKeys,
    copyText,
    manageToken,
    onOpenLink,
    setEditingToken,
    setShowEdit,
    refresh,
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
    <CardTable
      columns={tableColumns}
      dataSource={tokens}
      scroll={compactMode ? undefined : { x: 'max-content' }}
      pagination={{
        currentPage: activePage,
        pageSize: pageSize,
        total: tokenCount,
        showSizeChanger: true,
        pageSizeOptions: [10, 20, 50, 100],
        onPageSizeChange: handlePageSizeChange,
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
  );
};

export default TokensTable; 