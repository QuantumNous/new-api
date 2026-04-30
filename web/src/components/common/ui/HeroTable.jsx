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

// Shared HeroUI v3 `Table` wrapper for the console list pages
// (tokens, channels, redemptions, users, ...). Built so every page renders
// with the exact same row rhythm + selection ergonomics the new tokens
// table established (see /console/token).
//
// Two HeroUI defaults that *had* to be neutralised — keep these in mind
// when extending:
//
// 1. `.table__row` and `.table__cell` ship `height: 100%`. When the body
//    has spare vertical space (e.g. only a handful of rows) the rows
//    stretch to fill it and you get 80–120px row heights. We force them
//    back to `!h-auto` via descendant selectors on the Table root.
//
// 2. Default cell padding is `py-3 px-4` (= 56–64px row). We tighten to
//    `py-1 px-3` so the natural row height lands at ~44px, matching the
//    rhythm the previous CardTable settled on.
//
// Selection adapter: HeroUI emits `'all' | Set<key>`. Most of our hooks
// store selection as an array of full row objects. The wrapper round-trips
// between the two shapes via `rowSelection.selectedRows` /
// `rowSelection.onSelectionChange(rows)`.

import React, { useMemo } from 'react';
import { Spinner, Table } from '@heroui/react';
import PropTypes from 'prop-types';
import TableEmptyState from './TableEmptyState';

// Tighter row rhythm than HeroUI's default `py-3 px-4` cells. The actual
// CSS lives in `index.css` under `.ct-compact-table` because Tailwind v4
// can't reliably express selectors that target BEM `__` class names from
// inside arbitrary-selector syntax.
const TABLE_CLASS_OVERRIDES = 'ct-compact-table';

// React Aria's Table Collection insists on a stable, string-typed `id` for
// every Column / Row across re-renders. A few callers pass `dataIndex` as
// an array (e.g. `['plan', 'id']` for nested fields) — passing the raw
// array as `id={...}` triggers React Aria's "Cannot change the id of an
// item" error inside its commit-time reconciliation. Always coerce to a
// string here.
const stableColKey = (col, index) => {
  if (col.key) return String(col.key);
  if (col.dataIndex !== undefined) {
    return Array.isArray(col.dataIndex)
      ? col.dataIndex.join('.')
      : String(col.dataIndex);
  }
  return `__col_${index}`;
};

// Sticky-right cells (columns marked `fixed: 'right'`). Pin the cell to the
// right edge during horizontal scroll, paint a solid surface so the cells
// scrolled underneath can't bleed through, and add a subtle left shadow as
// a visual cue that there's more content off-screen.
//
// CRITICAL: use `!` (Tailwind important) on every bg utility. HeroUI's
// `.table__row:hover .table__cell { bg-surface/40 }` rule has higher
// specificity than our class-based bg AND uses a translucent color — so
// without `!important` the sticky cell becomes ~40% transparent on row
// hover and the body cells underneath bleed through it (which is what
// users see as "left text covering the 禁用 button").
//
// Hover bg uses `color-mix(... var(--app-surface) 40%, var(--app-background))`
// — the OPAQUE equivalent of HeroUI's `bg-surface/40` over `bg-background`,
// so the sticky cell visually matches its hovered siblings while staying
// fully opaque.
const STICKY_RIGHT_BASE =
  'sticky right-0 z-[1] shadow-[-4px_0_4px_-2px_rgba(0,0,0,0.06)]';

// Body cell: opaque body-bg at rest, opaque surface-tinted bg on row hover.
const STICKY_RIGHT_CELL =
  `${STICKY_RIGHT_BASE} ` +
  '!bg-[color:var(--app-background)] ' +
  'group-hover/row:!bg-[color-mix(in_oklab,var(--app-surface)_40%,var(--app-background))]';

// Header column: uses the surface-secondary tone the rest of `.table__header`
// already paints, so the sticky header cell is indistinguishable from its
// non-sticky siblings.
const STICKY_RIGHT_HEADER =
  `${STICKY_RIGHT_BASE} !bg-[color:var(--app-surface-secondary)]`;

export default function HeroTable({
  ariaLabel,
  columns = [],
  dataSource = [],
  rowKey = 'id',
  loading = false,
  emptyDescription = '',
  rowClassName,
  rowSelection,
  className = '',
}) {
  const getRowKey = (record) =>
    typeof rowKey === 'function' ? rowKey(record) : record?.[rowKey];

  // `rowSelection` is optional. When omitted (or `selectionMode='none'`),
  // HeroUI Table falls back to display-only mode (no checkbox column,
  // rows are not focusable for selection).
  const selectionMode = rowSelection?.selectionMode || 'none';

  const selectedKeys = useMemo(() => {
    if (!rowSelection) return undefined;
    const rows = rowSelection.selectedRows || [];
    return new Set(rows.map((row) => getRowKey(row)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rowSelection?.selectedRows, dataSource]);

  const handleSelectionChange = (keys) => {
    if (!rowSelection?.onSelectionChange) return;
    if (keys === 'all') {
      rowSelection.onSelectionChange((dataSource || []).slice());
      return;
    }
    const set = keys instanceof Set ? keys : new Set(keys);
    rowSelection.onSelectionChange(
      (dataSource || []).filter((row) => set.has(getRowKey(row))),
    );
  };

  const renderEmpty = () => (
    <TableEmptyState description={emptyDescription} />
  );

  return (
    <div className={`relative ${className}`}>
      <Table className={TABLE_CLASS_OVERRIDES}>
        <Table.ScrollContainer>
          <Table.Content
            aria-label={ariaLabel}
            selectionMode={selectionMode}
            selectionBehavior={
              selectionMode !== 'none' ? 'toggle' : undefined
            }
            selectedKeys={selectionMode !== 'none' ? selectedKeys : undefined}
            onSelectionChange={
              selectionMode !== 'none' ? handleSelectionChange : undefined
            }
          >
            <Table.Header>
              {columns.map((col, index) => {
                const stickyRight = col.fixed === 'right';
                // Force header text on a single line by default — cells
                // already get `whitespace-nowrap` (see below), but the
                // header was rendering `{col.title}` plain, so short
                // CJK / slash-bearing titles like "已用/剩余" wrapped
                // mid-character in narrow columns. The header now sets
                // its own min-content baseline so the auto-sized column
                // grows wide enough to hold the title in one line.
                // Columns can opt-in to wrapping by setting `wrap: true`.
                const headerWrapClass =
                  col.wrap === true
                    ? 'whitespace-normal'
                    : 'whitespace-nowrap';
                const headerClassName = [
                  stickyRight ? STICKY_RIGHT_HEADER : '',
                  headerWrapClass,
                ]
                  .filter(Boolean)
                  .join(' ');
                return (
                  <Table.Column
                    key={stableColKey(col, index)}
                    id={stableColKey(col, index)}
                    className={headerClassName || undefined}
                  >
                    {col.title || ''}
                  </Table.Column>
                );
              })}
            </Table.Header>
            {/* HeroUI Table.Body uses `renderEmptyState` (a function), NOT
                `emptyContent` (a node) — the latter is silently ignored.
                Loading isn't built into Table.Body either; the Spinner
                overlay below covers the empty-state flicker during refetch. */}
            <Table.Body
              items={dataSource || []}
              renderEmptyState={renderEmpty}
            >
              {(item) => (
                <Table.Row
                  key={getRowKey(item)}
                  id={getRowKey(item)}
                  className={`group/row ${
                    typeof rowClassName === 'function'
                      ? rowClassName(item) || ''
                      : ''
                  }`}
                >
                  {columns.map((col, index) => {
                    const key = stableColKey(col, index);
                    // Support nested-path dataIndex (e.g.
                    // `['plan', 'id']`) — same convention CardTable
                    // followed. Array → walk; dotted string → split &
                    // walk; plain key → direct property access.
                    let value;
                    if (col.dataIndex !== undefined) {
                      if (Array.isArray(col.dataIndex)) {
                        value = col.dataIndex.reduce(
                          (acc, k) => acc?.[k],
                          item,
                        );
                      } else if (
                        typeof col.dataIndex === 'string' &&
                        col.dataIndex.includes('.')
                      ) {
                        value = col.dataIndex
                          .split('.')
                          .reduce((acc, k) => acc?.[k], item);
                      } else {
                        value = item?.[col.dataIndex];
                      }
                    }
                    // Default to `nowrap` so CJK chips and inline pills
                    // don't break char-by-char in narrow columns. Columns
                    // with long-form prose can opt out via `wrap: true`.
                    const wrapClass =
                      col.wrap === true
                        ? 'whitespace-normal'
                        : 'whitespace-nowrap';
                    const stickyClass =
                      col.fixed === 'right' ? STICKY_RIGHT_CELL : '';
                    return (
                      <Table.Cell
                        key={key}
                        className={`${wrapClass} ${stickyClass}`}
                      >
                        {col.render
                          ? col.render(value, item)
                          : (value ?? '-')}
                      </Table.Cell>
                    );
                  })}
                </Table.Row>
              )}
            </Table.Body>
          </Table.Content>
        </Table.ScrollContainer>
      </Table>
      {loading ? (
        <div className='absolute inset-0 z-10 flex items-center justify-center rounded-2xl bg-background/60 backdrop-blur-[1px]'>
          <Spinner color='primary' />
        </div>
      ) : null}
    </div>
  );
}

HeroTable.propTypes = {
  ariaLabel: PropTypes.string,
  columns: PropTypes.array.isRequired,
  dataSource: PropTypes.array,
  rowKey: PropTypes.oneOfType([PropTypes.string, PropTypes.func]),
  loading: PropTypes.bool,
  emptyDescription: PropTypes.string,
  rowClassName: PropTypes.func,
  rowSelection: PropTypes.shape({
    selectionMode: PropTypes.oneOf(['none', 'single', 'multiple']),
    selectedRows: PropTypes.array,
    onSelectionChange: PropTypes.func,
  }),
  className: PropTypes.string,
};
