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

// /console/token table — HeroUI v3 `Table` (React Aria Components).
//
// Two overrides are intentional and load-bearing for this page:
//
// 1. HeroUI's `.table__row` and `.table__cell` are styled with `h-full`
//    (`height: 100%`). When the parent tbody has more height than the
//    rows actually need (e.g. only a handful of tokens) the rows stretch
//    to fill it and you get 100px+ row heights. We force them back to
//    `!h-auto` via descendant selectors on the Table root.
//
// 2. Default cell padding is `py-3 px-4` (= 56–64px row). We tighten to
//    `py-1 px-3` so the natural row height lands at ~44px, matching the
//    previous CardTable rhythm.
//
// Selection: HeroUI emits `'all' | Set<key>`; useTokensData wants an
// array of full row objects. We adapt at the boundary so the existing
// batch-copy / batch-delete handlers keep working.

import React, { useMemo } from 'react';
import { Spinner, Table } from '@heroui/react';
import TableEmptyState from '../../common/ui/TableEmptyState';
import { getTokensColumns } from './TokensColumnDefs';

const TokensTable = (tokensData) => {
  const {
    tokens,
    loading,
    selectedKeys,
    setSelectedKeys,
    showKeys,
    resolvedTokenKeys,
    loadingTokenKeys,
    toggleTokenVisibility,
    copyTokenKey,
    copyTokenConnectionString,
    manageToken,
    onOpenLink,
    setEditingToken,
    setShowEdit,
    refresh,
    groupRatios,
    t,
  } = tokensData;

  const columns = useMemo(
    () =>
      getTokensColumns({
        t,
        showKeys,
        resolvedTokenKeys,
        loadingTokenKeys,
        toggleTokenVisibility,
        copyTokenKey,
        copyTokenConnectionString,
        manageToken,
        onOpenLink,
        setEditingToken,
        setShowEdit,
        refresh,
        groupRatios,
      }),
    [
      t,
      showKeys,
      resolvedTokenKeys,
      loadingTokenKeys,
      toggleTokenVisibility,
      copyTokenKey,
      copyTokenConnectionString,
      manageToken,
      onOpenLink,
      setEditingToken,
      setShowEdit,
      refresh,
      groupRatios,
    ],
  );

  // Stable column key — prefer explicit `key`, fall back to `dataIndex`,
  // last-resort the column index. The action column has neither, hence
  // the `__col_*` sentinel.
  const getColKey = (col, index) => col.key || col.dataIndex || `__col_${index}`;

  // HeroUI emits `'all' | Set<key>`. useTokensData expects an array of
  // full row objects, so we materialise it here.
  const heroSelectedKeys = useMemo(
    () => new Set((selectedKeys || []).map((row) => row.id)),
    [selectedKeys],
  );

  const handleSelectionChange = (keys) => {
    if (keys === 'all') {
      setSelectedKeys?.(tokens || []);
      return;
    }
    const set = keys instanceof Set ? keys : new Set(keys);
    setSelectedKeys?.((tokens || []).filter((row) => set.has(row.id)));
  };

  return (
    <div className='relative'>
      <Table
        // BEM descendants (`.table__row`, `.table__cell`, `.table__column`)
        // come from HeroUI's table.css. We override only the size-related
        // bits here so behavioural CSS (hover, selected, focus rings) stays
        // intact:
        //   • `!h-auto` neutralises `.table__row { h-full }` that would
        //     otherwise stretch rows to fill empty body space.
        //   • `!py-1 !px-3` tightens cell padding to a ~44px row.
        //   • `align-middle` on the column keeps the header text
        //     vertically centered when the column height is taller than
        //     the text line-height (e.g. when the body is empty).
        className={
          '[&_.table__row]:!h-auto ' +
          '[&_.table__cell]:!h-auto [&_.table__cell]:!py-1 [&_.table__cell]:!px-3 ' +
          '[&_.table__column]:!py-2 [&_.table__column]:!px-3 [&_.table__column]:!align-middle'
        }
      >
        <Table.ScrollContainer>
          <Table.Content
            aria-label={t('令牌列表')}
            selectionMode='multiple'
            selectionBehavior='toggle'
            selectedKeys={heroSelectedKeys}
            onSelectionChange={handleSelectionChange}
          >
            <Table.Header>
              {columns.map((col, index) => (
                <Table.Column
                  key={getColKey(col, index)}
                  id={getColKey(col, index)}
                >
                  {col.title || ''}
                </Table.Column>
              ))}
            </Table.Header>
            {/* HeroUI Table.Body uses `renderEmptyState` (a function), NOT
                `emptyContent` (a node) — the latter is silently ignored.
                Loading isn't built into Table.Body either; we paint a
                Spinner overlay above the whole table when `loading` is
                true so the empty state doesn't flicker during refetch. */}
            <Table.Body
              items={tokens || []}
              renderEmptyState={() => (
                <TableEmptyState description={t('搜索无结果')} />
              )}
            >
              {(item) => (
                <Table.Row
                  key={item.id}
                  id={item.id}
                  // Disabled-look for non-active tokens (status !== 1) —
                  // same intent as the previous CardTable's handleRow.
                  className={item.status !== 1 ? 'opacity-60' : ''}
                >
                  {columns.map((col, index) => {
                    const key = getColKey(col, index);
                    const value =
                      col.dataIndex !== undefined
                        ? item[col.dataIndex]
                        : undefined;
                    return (
                      <Table.Cell key={key} className='whitespace-nowrap'>
                        {col.render ? col.render(value, item) : (value ?? '-')}
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
};

export default TokensTable;
