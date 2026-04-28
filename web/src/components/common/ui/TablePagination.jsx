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

// Shared bottom pagination toolbar for every CardPro-backed table.
// Mounted by `createCardProPagination` in helpers/utils.jsx so all 9 list
// pages (tokens / channels / users / logs / ...) get the same UX in one place.
//
// Composition follows HeroUI v3 — Pagination is fully compositional in v3
// (Pagination.Content/Item/Link/Previous/Next/Ellipsis), so the page list
// with ellipses is generated here.

import React from 'react';
import {
  ListBox,
  Pagination,
  Select,
} from '@heroui/react';
import { ChevronDown } from 'lucide-react';

// Compute the [1, '…', cur-1, cur, cur+1, '…', last] window. Renders all
// pages without ellipsis when the total fits a single row (≤ 7).
function buildPageList(currentPage, totalPages) {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }
  const set = new Set([1, totalPages, currentPage]);
  for (let delta = 1; delta <= 1; delta++) {
    if (currentPage - delta >= 1) set.add(currentPage - delta);
    if (currentPage + delta <= totalPages) set.add(currentPage + delta);
  }
  const sorted = Array.from(set).sort((a, b) => a - b);
  const result = [];
  for (let i = 0; i < sorted.length; i++) {
    if (i > 0 && sorted[i] - sorted[i - 1] > 1) {
      result.push(`…@${sorted[i - 1]}`);
    }
    result.push(sorted[i]);
  }
  return result;
}

export default function TablePagination({
  currentPage,
  pageSize,
  total,
  onPageChange,
  onPageSizeChange,
  isMobile = false,
  pageSizeOpts = [10, 20, 50, 100],
  showSizeChanger = true,
  t = (key) => key,
}) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const start = (currentPage - 1) * pageSize + 1;
  const end = Math.min(currentPage * pageSize, total);
  const pageList = buildPageList(currentPage, totalPages);

  const goTo = (next) => {
    const clamped = Math.min(Math.max(1, next), totalPages);
    if (clamped === currentPage) return;
    onPageChange?.(clamped, pageSize);
  };

  // Keep the legacy phrasing — these translation keys ("显示第" / "条 - 第" /
  // "条，共" / "条") are already in i18n/locales for every supported language.
  const summary = (
    <span className='text-xs text-muted whitespace-nowrap select-none sm:text-sm'>
      {`${t('显示第')} ${start} ${t('条 - 第')} ${end} ${t('条，共')} ${total} ${t('条')}`}
    </span>
  );

  const sizeChanger = showSizeChanger ? (
    <div className='flex items-center gap-1.5 text-xs text-muted sm:text-sm'>
      <span className='whitespace-nowrap'>{t('每页')}</span>
      <Select
        aria-label={t('每页条数')}
        selectedKey={String(pageSize)}
        onSelectionChange={(key) => {
          if (key == null) return;
          const next = Number(key);
          if (!Number.isFinite(next) || next === pageSize) return;
          onPageSizeChange?.(next);
        }}
      >
        {/* Don't fight HeroUI's `.select__trigger` defaults — it already
            handles bg, border, focus, and (critically) reserves `pr-7` via
            `&:has(.select__indicator)` so the absolutely-positioned
            chevron has its own slot. We only tighten height + left padding
            and shrink the inner value text to fit a pagination chip. */}
        <Select.Trigger className='!min-h-8 !rounded-lg !pl-2.5 [&_.select__value]:!text-xs [&_.select__value]:!sm:text-xs'>
          <Select.Value />
          <Select.Indicator>
            <ChevronDown size={12} className='text-muted' />
          </Select.Indicator>
        </Select.Trigger>
        {/* Sized just-large-enough for "100" + the right-anchored indicator.
            Going wider (min-w-24 / 96px) leaves an awkward gap because
            `.list-box-item__indicator` is absolute-positioned at `right-2`
            and the value text is left-aligned. */}
        <Select.Popover className='min-w-[72px]'>
          <ListBox>
            {pageSizeOpts.map((size) => (
              <ListBox.Item
                key={size}
                id={String(size)}
                textValue={String(size)}
              >
                {size}
                <ListBox.ItemIndicator />
              </ListBox.Item>
            ))}
          </ListBox>
        </Select.Popover>
      </Select>
      <span className='whitespace-nowrap'>{t('条')}</span>
    </div>
  ) : null;

  // HeroUI Pagination is fully compositional in v3 — Pagination root only
  // takes `children` + `size`. Build the windowed page list ourselves and
  // wire each link's `onPress` to `goTo`.
  const navigation = (
    <Pagination size={isMobile ? 'sm' : 'md'} aria-label={t('分页')}>
      <Pagination.Content>
        <Pagination.Item>
          <Pagination.Previous
            isDisabled={currentPage <= 1}
            onPress={() => goTo(currentPage - 1)}
          >
            <Pagination.PreviousIcon />
            <span className='sr-only sm:not-sr-only'>{t('上一页')}</span>
          </Pagination.Previous>
        </Pagination.Item>
        {pageList.map((entry) => {
          if (typeof entry === 'string' && entry.startsWith('…@')) {
            return (
              <Pagination.Item key={entry}>
                <Pagination.Ellipsis />
              </Pagination.Item>
            );
          }
          const page = entry;
          const isActive = page === currentPage;
          return (
            <Pagination.Item key={page}>
              <Pagination.Link
                isActive={isActive}
                onPress={() => goTo(page)}
                aria-label={`${t('第')} ${page} ${t('页')}`}
                aria-current={isActive ? 'page' : undefined}
              >
                {page}
              </Pagination.Link>
            </Pagination.Item>
          );
        })}
        <Pagination.Item>
          <Pagination.Next
            isDisabled={currentPage >= totalPages}
            onPress={() => goTo(currentPage + 1)}
          >
            <span className='sr-only sm:not-sr-only'>{t('下一页')}</span>
            <Pagination.NextIcon />
          </Pagination.Next>
        </Pagination.Item>
      </Pagination.Content>
    </Pagination>
  );

  // Layout: stacked-and-centered on mobile, left/right split on ≥ sm.
  // The summary + page-size form sit on the left, the pager on the right;
  // CardPro's footer wrapper already supplies the top border + padding.
  return (
    <div className='flex w-full flex-col items-center gap-3 sm:flex-row sm:justify-between'>
      <div className='flex flex-wrap items-center justify-center gap-x-4 gap-y-2 sm:justify-start'>
        {summary}
        {sizeChanger}
      </div>
      <div className='flex justify-center sm:justify-end'>{navigation}</div>
    </div>
  );
}
