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
import { Card } from '@heroui/react';
import { Inbox } from 'lucide-react';
import { Table } from '@/components/common/ui/HeroCompat';
import { getPricingTableColumns } from './PricingTableColumns';
import { useIsMobile } from '../../../../../hooks/common/useIsMobile';

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
  const isMobile = useIsMobile();

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
      isMobile,
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
    isMobile,
  ]);

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

    if (compactMode) {
      return cols.map(({ fixed, ...rest }) => rest);
    }
    return cols;
  }, [columns, searchValue, compactMode]);

  const ModelTable = useMemo(
    () => (
      <Card className='!rounded-xl overflow-hidden border-0'>
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
            <div className='flex flex-col items-center gap-3 py-10 text-center'>
              <div className='flex h-20 w-20 items-center justify-center rounded-full bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500'>
                <Inbox size={36} />
              </div>
              <div className='text-sm text-muted'>{t('搜索无结果')}</div>
            </div>
          }
          pagination={{
            defaultPageSize: 20,
            pageSize: pageSize,
            showSizeChanger: true,
            pageSizeOptions: [10, 20, 50, 100],
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

  return ModelTable;
};

export default PricingTable;
