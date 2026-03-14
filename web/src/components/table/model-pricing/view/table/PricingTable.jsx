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
import { Card, Table, Empty, InputNumber } from '@douyinfe/semi-ui';
import {
  IllustrationNoResult,
  IllustrationNoResultDark,
} from '@douyinfe/semi-illustrations';
import { getPricingTableColumns } from './PricingTableColumns';

/**
 * Table-based view for displaying model pricing with row selection and search filtering.
 * @param {object} props
 * @param {Array} props.filteredModels - Filtered model data to display
 * @param {boolean} props.loading - Loading state
 * @param {number} props.currentPage - Current page number
 * @param {number} props.pageSize - Items per page
 * @param {Function} props.onPageChange - Page change callback
 * @param {Function} props.onPageSizeChange - Page size change callback
 * @returns {JSX.Element}
 */
const PricingTable = ({
  filteredModels,
  loading,
  rowSelection,
  pageSize,
  setPageSize,
  selectedGroup,
  groupRatio,
  copyText,
  setModalImageUrl,
  setIsModalOpenurl,
  currency,
  siteDisplayType,
  tokenUnit,
  displayPrice,
  searchValue,
  showRatio,
  compactMode = false,
  openModelDetail,
  t,
}) => {
  const columns = useMemo(() => {
    return getPricingTableColumns({
      t,
      selectedGroup,
      groupRatio,
      copyText,
      setModalImageUrl,
      setIsModalOpenurl,
      currency,
      siteDisplayType,
      tokenUnit,
      displayPrice,
      showRatio,
    });
  }, [
    t,
    selectedGroup,
    groupRatio,
    copyText,
    setModalImageUrl,
    setIsModalOpenurl,
    currency,
    siteDisplayType,
    tokenUnit,
    displayPrice,
    showRatio,
  ]);

  // 更新列定义中的 searchValue
  const processedColumns = useMemo(() => {
    const cols = columns.map((column) => {
      if (column.dataIndex === 'model_name') {
        return {
          ...column,
          filteredValue: searchValue ? [searchValue] : [],
        };
      }
      return column;
    });

    // Remove fixed property when in compact mode (mobile view)
    if (compactMode) {
      return cols.map(({ fixed, ...rest }) => rest);
    }
    return cols;
  }, [columns, searchValue, compactMode]);

  const ModelTable = useMemo(
    () => (
      <Card className='!rounded-xl overflow-hidden' bordered={false}>
        <Table
          columns={processedColumns}
          dataSource={filteredModels}
          loading={loading}
          rowSelection={rowSelection}
          scroll={compactMode ? undefined : { x: 'max-content' }}
          onRow={(record) => ({
            onClick: () => openModelDetail && openModelDetail(record),
            style: { cursor: 'pointer' },
          })}
          empty={
            <Empty
              image={
                <IllustrationNoResult style={{ width: 150, height: 150 }} />
              }
              darkModeImage={
                <IllustrationNoResultDark style={{ width: 150, height: 150 }} />
              }
              description={t('搜索无结果')}
              style={{ padding: 30 }}
            />
          }
          pagination={{
            defaultPageSize: 20,
            pageSize: pageSize,
            showSizeChanger: false,
            onPageSizeChange: (size) => setPageSize(size),
          }}
        />
      </Card>
    ),
    [
      filteredModels,
      loading,
      processedColumns,
      rowSelection,
      pageSize,
      setPageSize,
      openModelDetail,
      t,
      compactMode,
    ],
  );

  return (
    <>
      {ModelTable}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', padding: '8px 0', gap: 8 }}>
        <span className='text-sm select-none' style={{ color: 'var(--semi-color-text-2)' }}>{t('每页条数')}</span>
        <InputNumber
          size='small'
          min={1}
          value={pageSize}
          onChange={(val) => {
            if (val && val >= 1) setPageSize(Math.floor(val));
          }}
          style={{ width: 80 }}
        />
      </div>
    </>
  );
};

export default PricingTable;
