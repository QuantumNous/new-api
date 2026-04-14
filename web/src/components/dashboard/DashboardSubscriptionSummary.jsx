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
import { Popover } from '@douyinfe/semi-ui';
import {
  buildDashboardSubscriptionTriggerText,
  getDashboardSubscriptionTranslator,
  shouldShowDashboardSubscriptionTriggerTitle,
} from '../../helpers/dashboardSubscriptionSummary';

const DashboardSubscriptionSummary = ({ dashboardSubscriptionSummary, t }) => {
  const translate = getDashboardSubscriptionTranslator(t);
  const summary = dashboardSubscriptionSummary?.summary || dashboardSubscriptionSummary || {};
  const summaryText = summary?.summaryText?.trim() || '';
  const resetText = summary?.resetText?.trim() || '';
  const extraText = summary?.extraText?.trim() || '';
  const badgeText = summary?.badgeText?.trim() || '';
  const usedAmountText = summary?.usedAmountText?.trim() || '';
  const totalAmountText = summary?.totalAmountText?.trim() || '';
  const showProgress = Boolean(summary?.showProgress);
  const progressPercent = Number.isFinite(summary?.progressPercent)
    ? Math.max(0, Math.min(100, Number(summary.progressPercent)))
    : 0;
  const displayProgressPercent = Number.isFinite(summary?.displayProgressPercent)
    ? Math.max(0, Math.min(100, Number(summary.displayProgressPercent)))
    : progressPercent;
  const rows = Array.isArray(dashboardSubscriptionSummary?.rows)
    ? dashboardSubscriptionSummary.rows
    : [];
  const shouldShowTitle = shouldShowDashboardSubscriptionTriggerTitle(summary);
  const triggerText = buildDashboardSubscriptionTriggerText(summary);

  const popoverContent = useMemo(() => {
    if (!rows.length) {
      return (
        <div className='w-[320px] max-w-[calc(100vw-32px)] rounded-lg border border-black/10 bg-white p-3 shadow-[0_12px_32px_rgba(0,0,0,0.08)] dark:border-white/[0.12] dark:bg-black'>
          <div className='text-[11px] tracking-[-0.02em] text-black/40 dark:text-white/40'>
            {translate('暂无活跃订阅')}
          </div>
        </div>
      );
    }

    return (
      <div className='w-[340px] max-w-[calc(100vw-32px)] rounded-lg border border-black/10 bg-white p-3 shadow-[0_12px_32px_rgba(0,0,0,0.08)] dark:border-white/10 dark:bg-black'>
        <div className='mb-1 text-[11px] tracking-[-0.02em] text-black/40 dark:text-white/40'>
          {translate('活跃订阅')}
        </div>
        <div>
          {rows.map((row, index) => (
            <div
              key={`${row.titleText || 'subscription'}-${row.summaryText || index}`}
              className={`py-3 ${index > 0 ? 'border-t border-black/8 dark:border-white/[0.08]' : ''}`}
            >
              <div className='flex items-center justify-between gap-3'>
                <div className='flex min-w-0 items-center gap-2'>
                  <span className='inline-flex shrink-0 items-center gap-1.5 rounded-full border border-black/10 bg-black/[0.03] px-2 py-[5px] dark:border-white/10 dark:bg-white/[0.08]'>
                    <span className='h-1.5 w-1.5 rounded-full bg-[#2fb66c]' />
                    <span className='font-mono text-[10px] font-medium uppercase tracking-[0.14em] text-black/72 dark:text-white/72'>
                      {row.badgeText || 'PLAN'}
                    </span>
                  </span>
                  {row.titleText && row.titleText !== row.badgeText ? (
                    <span className='min-w-0 truncate text-[12px] tracking-[-0.02em] text-black/55 dark:text-white/55'>
                      {row.titleText}
                    </span>
                  ) : null}
                </div>
                {row.isPrimary ? (
                  <span className='shrink-0 text-[10px] tracking-[-0.01em] text-black/40 dark:text-white/40'>
                    {translate('主订阅')}
                  </span>
                ) : null}
              </div>
              <div className='mt-2 flex items-center gap-2 whitespace-nowrap'>
                <span className='text-[14px] font-semibold tracking-[-0.02em] text-black dark:text-white'>
                  {row.usedAmountText || '$0.00'}
                </span>
                <span className='text-black/20 dark:text-white/20'>/</span>
                <span className='text-[13px] tracking-[-0.02em] text-black/56 dark:text-white/56'>
                  {row.totalAmountText || '-'}
                </span>
              </div>
              <div className='mt-1 font-mono text-[10px] font-medium uppercase tracking-[0.12em] text-black/42 dark:text-white/42'>
                {row.resetText || '-'}
              </div>
              {row.showProgress ? (
                <div className='mt-2 h-[2px] w-full overflow-hidden rounded-full bg-black/8 dark:bg-white/12'>
                  <div
                    className='h-full rounded-full bg-[#2fb66c] transition-all duration-500'
                    style={{ width: `${row.displayProgressPercent ?? row.progressPercent}%` }}
                  />
                </div>
              ) : null}
            </div>
          ))}
        </div>
      </div>
    );
  }, [rows, translate]);

  if (!summaryText) {
    return null;
  }

  return (
    <Popover
      content={popoverContent}
      position='bottomRight'
      showArrow
      trigger='click'
    >
      <button
        type='button'
        className='group inline-flex cursor-pointer flex-col items-end rounded-[18px] bg-transparent px-2 py-1 text-right outline-none transition-colors duration-150 hover:bg-black/[0.03] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-dashed focus-visible:outline-black dark:hover:bg-white/[0.06] dark:focus-visible:outline-white'
        title={triggerText || summaryText}
      >
        <div className='inline-flex max-w-[min(48vw,460px)] flex-col items-end gap-1'>
          <div className='flex min-w-0 max-w-full items-center justify-end gap-3 whitespace-nowrap'>
            <span className='inline-flex shrink-0 items-center gap-1.5 rounded-full border border-black/10 bg-black/[0.03] px-2 py-[5px] dark:border-white/10 dark:bg-white/[0.08]'>
              <span className='h-1.5 w-1.5 rounded-full bg-[#2fb66c]' />
              <span className='font-mono text-[10px] font-medium uppercase tracking-[0.14em] text-black/72 dark:text-white/72'>
                {badgeText || 'PLAN'}
              </span>
            </span>
            {shouldShowTitle ? (
              <span className='max-w-[120px] truncate text-[12px] tracking-[-0.02em] text-black/52 dark:text-white/52'>
                {summary.titleText}
              </span>
            ) : null}
            <div className='min-w-0 whitespace-nowrap'>
              <span className='text-[14px] font-semibold tracking-[-0.02em] text-black dark:text-white'>
                {usedAmountText || '$0.00'}
              </span>
              <span className='mx-1 text-black/20 dark:text-white/20'>/</span>
              <span className='text-[13px] tracking-[-0.02em] text-black/56 dark:text-white/56'>
                {totalAmountText || '-'}
              </span>
            </div>
            {extraText ? (
              <span className='shrink-0 font-mono text-[10px] font-medium uppercase tracking-[0.12em] text-black/30 dark:text-white/30'>
                {extraText}
              </span>
            ) : null}
          </div>
          {showProgress ? (
            <div className='h-[2px] w-full overflow-hidden rounded-full bg-black/8 dark:bg-white/12'>
              <div
                className='h-full rounded-full bg-[#2fb66c] transition-all duration-500'
                style={{ width: `${displayProgressPercent}%` }}
              />
            </div>
          ) : null}
        </div>
      </button>
    </Popover>
  );
};

export default DashboardSubscriptionSummary;
