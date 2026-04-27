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

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Button, Skeleton } from '@heroui/react';
import { Inbox } from 'lucide-react';
import CardTable from '../../../../common/ui/CardTable';
import { getPricingTableColumns } from './PricingTableColumns';
import { useIsMobile } from '../../../../../hooks/common/useIsMobile';
import { useMinimumLoadingTime } from '../../../../../hooks/common/useMinimumLoadingTime';

const PAGE_SIZE_OPTIONS = [10, 20, 50, 100];

// Renders the column header. Semi columns can supply either a string/JSX
// node or a zero-arg function that returns JSX (used for the ratio column
// help button); both shapes are mirrored here.
const renderColumnTitle = (col) =>
  typeof col.title === 'function' ? col.title() : col.title;

// Tiny native checkbox with `indeterminate` support (mirrors the same helper
// inlined across the dashboard tables — kept local to avoid pulling a shared
// component for a single call site).
function HeaderCheckbox({ checked, indeterminate, onChange, ariaLabel }) {
  const ref = useRef(null);
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = !!indeterminate && !checked;
  }, [indeterminate, checked]);
  return (
    <input
      ref={ref}
      type='checkbox'
      checked={!!checked}
      onChange={(event) => onChange(event.target.checked)}
      aria-label={ariaLabel}
      className='h-4 w-4 accent-primary'
    />
  );
}

const PricingTable = ({
  filteredModels,
  loading,
  rowSelection,
  pageSize,
  setPageSize,
  currentPage = 1,
  setCurrentPage,
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
  const showSkeleton = useMinimumLoadingTime(loading);

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

  // `compactMode` strips the `fixed: 'right'` hint so the price column flows
  // inline rather than sticking to the right edge.
  const processedColumns = useMemo(() => {
    if (compactMode) {
      return columns.map(({ fixed, ...rest }) => rest);
    }
    return columns;
  }, [columns, compactMode]);

  const totalRows = filteredModels?.length ?? 0;
  const effectivePageSize = pageSize || 20;
  const totalPages = Math.max(1, Math.ceil(totalRows / effectivePageSize));
  const safeCurrentPage = Math.min(Math.max(1, currentPage), totalPages);
  const startIndex = (safeCurrentPage - 1) * effectivePageSize;
  const pagedModels = useMemo(
    () =>
      (filteredModels || []).slice(startIndex, startIndex + effectivePageSize),
    [filteredModels, startIndex, effectivePageSize],
  );

  // Mobile delegates to the shared CardTable: row selection on mobile falls
  // back to the card view (PricingCardView), so the table view here only
  // needs the read-only card stack.
  if (isMobile) {
    return (
      <div className='rounded-2xl bg-white/0 p-0'>
        <CardTable
          columns={processedColumns}
          dataSource={pagedModels}
          loading={loading}
          rowKey='model_name'
          onRow={(record) => ({
            onClick: () => openModelDetail && openModelDetail(record),
            style: { cursor: 'pointer' },
          })}
          empty={
            <div className='flex flex-col items-center gap-3 py-10 text-center'>
              <div className='flex h-20 w-20 items-center justify-center rounded-full bg-surface-secondary text-muted'>
                <Inbox size={36} />
              </div>
              <div className='text-sm text-muted'>{t('搜索无结果')}</div>
            </div>
          }
          hidePagination
        />
        <PaginationBar
          totalRows={totalRows}
          currentPage={safeCurrentPage}
          totalPages={totalPages}
          pageSize={effectivePageSize}
          setPageSize={setPageSize}
          setCurrentPage={setCurrentPage}
          t={t}
        />
      </div>
    );
  }

  const selectionEnabled = !!rowSelection;
  const selectedRowKeys = rowSelection?.selectedRowKeys ?? [];
  const onSelectionChange = rowSelection?.onChange;
  const getRowKey = (record) => record.key ?? record.model_name ?? record.id;

  const pageRowKeys = pagedModels.map(getRowKey);
  const allPageSelected =
    pageRowKeys.length > 0 &&
    pageRowKeys.every((key) => selectedRowKeys.includes(key));
  const somePageSelected =
    !allPageSelected &&
    pageRowKeys.some((key) => selectedRowKeys.includes(key));

  const togglePageSelection = (checked) => {
    if (!onSelectionChange) return;
    const next = checked
      ? Array.from(new Set([...selectedRowKeys, ...pageRowKeys]))
      : selectedRowKeys.filter((key) => !pageRowKeys.includes(key));
    onSelectionChange(next, null);
  };

  const toggleRowSelection = (rowKey, checked) => {
    if (!onSelectionChange) return;
    const next = checked
      ? Array.from(new Set([...selectedRowKeys, rowKey]))
      : selectedRowKeys.filter((key) => key !== rowKey);
    onSelectionChange(next, null);
  };

  // Compute sticky-right offset for the price column. We only honour
  // `fixed: 'right'` on the *last* column to avoid pixel-perfect calculation
  // of multiple sticky offsets.
  const stickyLastColumn =
    !compactMode &&
    processedColumns.length > 0 &&
    processedColumns[processedColumns.length - 1]?.fixed === 'right';

  const stickyHeadCellClass =
    'sticky right-0 z-10 bg-surface-secondary shadow-[-1px_0_0_0_rgba(0,0,0,0.04)]';
  const stickyBodyCellClass =
    'sticky right-0 z-10 bg-background shadow-[-1px_0_0_0_rgba(0,0,0,0.04)]';

  if (showSkeleton) {
    const colCount = processedColumns.length + (selectionEnabled ? 1 : 0);
    return (
      <div className='overflow-hidden rounded-2xl border border-border bg-background'>
        <div className='grid gap-px bg-border'>
          {[0, 1, 2, 3].map((row) => (
            <div
              key={row}
              className='grid bg-background p-3'
              style={{
                gridTemplateColumns: `repeat(${Math.max(colCount, 1)}, minmax(0, 1fr))`,
              }}
            >
              {Array.from({ length: colCount }).map((_, idx) => (
                <Skeleton
                  key={idx}
                  className='h-4 w-3/4 rounded-lg bg-surface-secondary'
                />
              ))}
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className='flex flex-col gap-3'>
      <div className='overflow-hidden rounded-2xl border border-border bg-background'>
        <div className='overflow-x-auto'>
          <table className='min-w-full border-collapse text-sm'>
            <thead className='bg-surface-secondary text-left text-xs font-semibold uppercase tracking-wide text-muted'>
              <tr>
                {selectionEnabled && (
                  <th className='w-10 whitespace-nowrap px-3 py-3'>
                    <HeaderCheckbox
                      checked={allPageSelected}
                      indeterminate={somePageSelected}
                      onChange={togglePageSelection}
                      ariaLabel={t('选择当前页')}
                    />
                  </th>
                )}
                {processedColumns.map((col, idx) => {
                  const isLast = idx === processedColumns.length - 1;
                  const sticky = stickyLastColumn && isLast;
                  return (
                    <th
                      key={col.key || col.dataIndex || idx}
                      className={`whitespace-nowrap px-4 py-3 ${sticky ? stickyHeadCellClass : ''}`}
                      style={{ width: col.width }}
                    >
                      {renderColumnTitle(col)}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody className='divide-y divide-[color:var(--app-border)]'>
              {pagedModels.length === 0 ? (
                <tr>
                  <td
                    colSpan={
                      processedColumns.length + (selectionEnabled ? 1 : 0)
                    }
                    className='py-12 text-center text-sm text-muted'
                  >
                    <div className='flex flex-col items-center gap-3'>
                      <div className='flex h-20 w-20 items-center justify-center rounded-full bg-surface-secondary text-muted'>
                        <Inbox size={36} />
                      </div>
                      <div>{t('搜索无结果')}</div>
                    </div>
                  </td>
                </tr>
              ) : (
                pagedModels.map((record, rowIdx) => {
                  const rowKey = getRowKey(record) ?? rowIdx;
                  const checked = selectedRowKeys.includes(rowKey);
                  return (
                    <tr
                      key={rowKey}
                      className='cursor-pointer transition-colors hover:bg-surface-secondary/60'
                      onClick={() => openModelDetail && openModelDetail(record)}
                    >
                      {selectionEnabled && (
                        <td
                          className='w-10 px-3 py-3 align-middle'
                          onClick={(event) => event.stopPropagation()}
                        >
                          <input
                            type='checkbox'
                            checked={checked}
                            onChange={(event) =>
                              toggleRowSelection(rowKey, event.target.checked)
                            }
                            aria-label={t('选择行')}
                            className='h-4 w-4 accent-primary'
                          />
                        </td>
                      )}
                      {processedColumns.map((col, colIdx) => {
                        const isLast = colIdx === processedColumns.length - 1;
                        const sticky = stickyLastColumn && isLast;
                        const value =
                          typeof col.dataIndex === 'string'
                            ? record?.[col.dataIndex]
                            : undefined;
                        const cell = col.render
                          ? col.render(value, record, rowIdx)
                          : (value ?? '-');
                        return (
                          <td
                            key={col.key || col.dataIndex || colIdx}
                            className={`px-4 py-3 align-middle text-foreground ${sticky ? stickyBodyCellClass : ''}`}
                          >
                            {cell}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <PaginationBar
        totalRows={totalRows}
        currentPage={safeCurrentPage}
        totalPages={totalPages}
        pageSize={effectivePageSize}
        setPageSize={setPageSize}
        setCurrentPage={setCurrentPage}
        t={t}
      />
    </div>
  );
};

function PaginationBar({
  totalRows,
  currentPage,
  totalPages,
  pageSize,
  setPageSize,
  setCurrentPage,
  t,
}) {
  if (totalRows === 0) return null;

  return (
    <div className='flex flex-wrap items-center justify-between gap-2 text-xs text-muted'>
      <div className='flex items-center gap-2'>
        <span>{t('每页')}</span>
        <select
          value={String(pageSize)}
          onChange={(event) => {
            setPageSize?.(Number(event.target.value));
            setCurrentPage?.(1);
          }}
          aria-label={t('每页数量')}
          className='h-7 rounded-md border border-[color:var(--app-border)] bg-background px-2 text-xs outline-none focus:border-primary'
        >
          {PAGE_SIZE_OPTIONS.map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
        <span>{t('共 {{total}} 条', { total: totalRows })}</span>
      </div>
      <div className='flex items-center gap-1'>
        <Button
          size='sm'
          variant='tertiary'
          isDisabled={currentPage <= 1}
          onPress={() => setCurrentPage?.(Math.max(1, currentPage - 1))}
        >
          {t('上一页')}
        </Button>
        <span>
          {currentPage} / {totalPages}
        </span>
        <Button
          size='sm'
          variant='tertiary'
          isDisabled={currentPage >= totalPages}
          onPress={() =>
            setCurrentPage?.(Math.min(totalPages, currentPage + 1))
          }
        >
          {t('下一页')}
        </Button>
      </div>
    </div>
  );
}

export default PricingTable;
