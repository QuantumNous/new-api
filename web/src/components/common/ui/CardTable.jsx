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
import { useTranslation } from 'react-i18next';
import { Skeleton, Pagination, Button } from '@heroui/react';
import { ChevronDown, ChevronUp, Inbox } from 'lucide-react';
import PropTypes from 'prop-types';
import { useIsMobile } from '../../../hooks/common/useIsMobile';
import { useMinimumLoadingTime } from '../../../hooks/common/useMinimumLoadingTime';

/**
 * CardTable 响应式表格组件
 *
 * 在桌面端渲染 Semi-UI 的 Table 组件，在移动端则将每一行数据渲染成 Card 形式。
 * 该组件与 Table 组件的大部分 API 保持一致，只需将原 Table 换成 CardTable 即可。
 */
const CardTable = ({
  columns = [],
  dataSource = [],
  loading = false,
  rowKey = 'key',
  hidePagination = false,
  ...tableProps
}) => {
  const isMobile = useIsMobile();
  const { t } = useTranslation();

  const showSkeleton = useMinimumLoadingTime(loading);

  const getRowKey = (record, index) => {
    if (typeof rowKey === 'function') return rowKey(record);
    return record[rowKey] !== undefined ? record[rowKey] : index;
  };

  const visibleColumns = columns.filter((col) => {
    if (tableProps?.visibleColumns && col.key) {
      return tableProps.visibleColumns[col.key];
    }
    return true;
  });

  const getCellValue = (record, dataIndex) => {
    if (Array.isArray(dataIndex)) {
      return dataIndex.reduce((value, key) => value?.[key], record);
    }
    if (typeof dataIndex === 'string' && dataIndex.includes('.')) {
      return dataIndex.split('.').reduce((value, key) => value?.[key], record);
    }
    return record?.[dataIndex];
  };

  const renderCell = (col, record, index) => {
    const value = getCellValue(record, col.dataIndex);
    return col.render ? col.render(value, record, index) : value;
  };

  const renderPagination = () => {
    if (hidePagination || !tableProps.pagination || dataSource.length === 0) {
      return null;
    }

    const pagination = tableProps.pagination;
    const pageSize = pagination.pageSize || pagination.defaultPageSize || 10;
    const total = pagination.total || dataSource.length;
    const currentPage = pagination.currentPage || pagination.current || 1;

    return (
      <div className='mt-3 flex justify-center'>
        <Pagination
          page={currentPage}
          total={Math.max(1, Math.ceil(total / pageSize))}
          onChange={(page) => {
            pagination.onPageChange?.(page);
            pagination.onChange?.(page, pageSize);
          }}
        />
      </div>
    );
  };

  const renderEmpty = () => {
    if (tableProps.empty) return tableProps.empty;
    return (
      <div className='flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-border bg-background/60 p-8 text-center text-muted'>
        <div className='flex h-12 w-12 items-center justify-center rounded-2xl bg-surface-secondary'>
          <Inbox size={24} />
        </div>
        <span className='text-sm'>{t('暂无数据')}</span>
      </div>
    );
  };

  if (!isMobile) {
    if (showSkeleton) {
      return (
        <div className='overflow-hidden rounded-2xl border border-border bg-background/80'>
          <div className='grid gap-px bg-border'>
            {[0, 1, 2, 3].map((row) => (
              <div
                key={row}
                className='grid bg-background p-3'
                style={{
                  gridTemplateColumns: `repeat(${Math.max(visibleColumns.length, 1)}, minmax(0, 1fr))`,
                }}
              >
                {visibleColumns.map((col, idx) => (
                  <Skeleton
                    key={col.key || col.dataIndex || idx}
                    className='h-4 w-3/4 rounded-lg bg-surface-secondary'
                  />
                ))}
              </div>
            ))}
          </div>
        </div>
      );
    }

    if (!dataSource || dataSource.length === 0) {
      return renderEmpty();
    }

    // Honor the `scroll={{ x: ... }}` contract that 9 list pages already pass
    // through. Numeric → fixed min-width in px; 'max-content' → let intrinsic
    // cell widths dictate the table width and let the parent overflow-x-auto
    // scroll. Without this CardTable was silently fitting every column to the
    // container, which collapsed CJK chips/buttons character-by-character.
    const scrollX = tableProps.scroll?.x;
    const tableMinWidth =
      typeof scrollX === 'number'
        ? `${scrollX}px`
        : scrollX === 'max-content'
          ? 'max-content'
          : undefined;

    return (
      <div className={tableProps.className}>
        <div className='overflow-x-auto rounded-2xl border border-border bg-background/80'>
          <table
            className='min-w-full border-collapse text-sm'
            style={tableMinWidth ? { minWidth: tableMinWidth } : undefined}
          >
            <thead className='bg-surface-secondary text-left text-xs font-semibold uppercase tracking-wide text-muted'>
              <tr>
                {visibleColumns.map((col, idx) => (
                  <th
                    key={col.key || col.dataIndex || idx}
                    className='whitespace-nowrap px-4 py-3'
                    style={{ width: col.width }}
                  >
                    {col.title}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className='divide-y divide-border'>
              {dataSource.map((record, index) => {
                const rowProps = tableProps.onRow?.(record, index) || {};
                return (
                  <tr
                    key={getRowKey(record, index)}
                    className='transition-colors hover:bg-surface-secondary/60'
                    {...rowProps}
                  >
                    {visibleColumns.map((col, colIdx) => {
                      // Default to nowrap so CJK pills don't break char-by-char
                      // (the same rule `<th>` already uses). Columns with long
                      // prose can opt out via `col.wrap === true` and wrap the
                      // cell in their own `whitespace-normal` container.
                      const wrapClass =
                        col.wrap === true
                          ? 'whitespace-normal'
                          : 'whitespace-nowrap';
                      return (
                        <td
                          key={col.key || col.dataIndex || colIdx}
                          className={`px-4 py-3 align-middle text-foreground ${wrapClass}`}
                        >
                          {renderCell(col, record, index) ?? '-'}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {renderPagination()}
      </div>
    );
  }

  if (showSkeleton) {
    const renderSkeletonCard = (key) => {
      return (
        <div
          key={key}
          className='rounded-2xl border border-border bg-background p-4 shadow-sm'
        >
          {visibleColumns.map((col, idx) => {
            if (!col.title) {
              return (
                <div key={idx} className='mt-2 flex justify-end'>
                  <Skeleton className='h-6 w-24 rounded-lg bg-surface-secondary' />
                </div>
              );
            }

            return (
              <div
                key={idx}
                className='flex justify-between items-center border-b border-dashed border-border py-2 last:border-b-0'
              >
                <Skeleton className='h-4 w-20 rounded-lg bg-surface-secondary' />
                <Skeleton
                  className='h-4 rounded-lg bg-surface-secondary'
                  style={{ width: `${50 + (idx % 3) * 10}%`, maxWidth: 180 }}
                />
              </div>
            );
          })}
        </div>
      );
    };

    return (
      <div className='flex flex-col gap-2'>
        {[1, 2, 3].map((i) => renderSkeletonCard(i))}
      </div>
    );
  }

  const isEmpty = !showSkeleton && (!dataSource || dataSource.length === 0);

  const MobileRowCard = ({ record, index }) => {
    const [showDetails, setShowDetails] = useState(false);
    const rowKeyVal = getRowKey(record, index);

    const hasDetails =
      tableProps.expandedRowRender &&
      (!tableProps.rowExpandable || tableProps.rowExpandable(record));

    return (
      <div
        key={rowKeyVal}
        className='rounded-2xl border border-border bg-background p-4 shadow-sm'
      >
        {visibleColumns.map((col, colIdx) => {
          const title = col.title;
          const cellContent = renderCell(col, record, index);

          if (!title) {
            return (
              <div key={col.key || colIdx} className='mt-2 flex justify-end'>
                {cellContent}
              </div>
            );
          }

          return (
            <div
              key={col.key || colIdx}
              className='flex justify-between items-start border-b border-dashed border-border py-2 last:border-b-0'
            >
              <span className='mr-2 select-none whitespace-nowrap font-medium text-muted'>
                {title}
              </span>
              <div className='flex-1 break-all flex justify-end items-center gap-1'>
                {cellContent !== undefined && cellContent !== null
                  ? cellContent
                  : '-'}
              </div>
            </div>
          );
        })}

        {hasDetails && (
          <>
            <Button
              variant='tertiary'
              size='sm'
              className='w-full flex justify-center mt-2'
              onPress={() => {
                setShowDetails(!showDetails);
              }}
            >
              {showDetails ? (
                <ChevronUp size={16} />
              ) : (
                <ChevronDown size={16} />
              )}
              {showDetails ? t('收起') : t('详情')}
            </Button>
            {showDetails && (
              <div className='pt-2'>
                {tableProps.expandedRowRender(record, index)}
              </div>
            )}
          </>
        )}
      </div>
    );
  };

  if (isEmpty) {
    if (tableProps.empty) return tableProps.empty;
    return <div className='flex justify-center p-4'>{renderEmpty()}</div>;
  }

  return (
    <div className='flex flex-col gap-2'>
      {dataSource.map((record, index) => (
        <MobileRowCard
          key={getRowKey(record, index)}
          record={record}
          index={index}
        />
      ))}
      {!hidePagination && tableProps.pagination && dataSource.length > 0 && (
        <div className='mt-2 flex justify-center'>{renderPagination()}</div>
      )}
    </div>
  );
};

CardTable.propTypes = {
  columns: PropTypes.array.isRequired,
  dataSource: PropTypes.array,
  loading: PropTypes.bool,
  rowKey: PropTypes.oneOfType([PropTypes.string, PropTypes.func]),
  hidePagination: PropTypes.bool,
};

export default CardTable;
