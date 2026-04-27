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

import React from 'react';
import { Card } from '@heroui/react';
import { CircleDollarSign } from 'lucide-react';
import { calculateModelPrice, getModelPriceItems } from '../../../../../helpers';

function GroupChip({ children, tone = 'default' }) {
  const toneClass =
    tone === 'violet'
      ? 'bg-violet-100 text-violet-700 dark:bg-violet-950/40 dark:text-violet-300'
      : tone === 'teal'
        ? 'bg-teal-100 text-teal-700 dark:bg-teal-950/40 dark:text-teal-300'
        : tone === 'amber'
          ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300'
          : tone === 'blue'
            ? 'bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300'
            : 'border border-[color:var(--app-border)] bg-background text-foreground';
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${toneClass}`}
    >
      {children}
    </span>
  );
}

const ModelPricingTable = ({
  modelData,
  groupRatio,
  currency,
  siteDisplayType,
  tokenUnit,
  displayPrice,
  showRatio,
  usableGroup,
  autoGroups = [],
  t,
}) => {
  const modelEnableGroups = Array.isArray(modelData?.enable_groups)
    ? modelData.enable_groups
    : [];
  const autoChain = autoGroups.filter((g) => modelEnableGroups.includes(g));

  const availableGroups = Object.keys(usableGroup || {})
    .filter((g) => g !== '')
    .filter((g) => g !== 'auto')
    .filter((g) => modelEnableGroups.includes(g));

  const tableData = availableGroups.map((group) => {
    const priceData = modelData
      ? calculateModelPrice({
          record: modelData,
          selectedGroup: group,
          groupRatio,
          tokenUnit,
          displayPrice,
          currency,
          quotaDisplayType: siteDisplayType,
        })
      : { inputPrice: '-', outputPrice: '-', price: '-' };

    const groupRatioValue =
      groupRatio && groupRatio[group] ? groupRatio[group] : 1;

    return {
      key: group,
      group,
      ratio: groupRatioValue,
      billingType:
        modelData?.billing_mode === 'tiered_expr'
          ? t('动态计费')
          : modelData?.quota_type === 0
            ? t('按量计费')
            : modelData?.quota_type === 1
              ? t('按次计费')
              : '-',
      priceItems: getModelPriceItems(priceData, t, siteDisplayType),
    };
  });

  // 动态计费时始终显示分组倍率列，否则按 showRatio 设置
  const isDynamicBilling = modelData?.billing_mode === 'tiered_expr';
  const showRatioCol = showRatio || isDynamicBilling;

  return (
    <Card className='!rounded-2xl border border-[color:var(--app-border)] shadow-sm'>
      <Card.Content className='space-y-4 p-5'>
        <div className='flex items-center gap-2'>
          <div className='flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-orange-100 text-orange-600 dark:bg-orange-950/40 dark:text-orange-300'>
            <CircleDollarSign size={16} />
          </div>
          <div>
            <div className='text-base font-semibold text-foreground'>
              {t('分组价格')}
            </div>
            <div className='text-xs text-muted'>
              {t('不同用户分组的价格信息')}
            </div>
          </div>
        </div>

        {autoChain.length > 0 && (
          <div className='flex flex-wrap items-center gap-1'>
            <span className='text-sm text-muted'>{t('auto分组调用链路')}</span>
            <span className='text-sm text-muted'>→</span>
            {autoChain.map((g, idx) => (
              <React.Fragment key={g}>
                <GroupChip>
                  {g}
                  {t('分组')}
                </GroupChip>
                {idx < autoChain.length - 1 && (
                  <span className='text-sm text-muted'>→</span>
                )}
              </React.Fragment>
            ))}
          </div>
        )}

        {tableData.length === 0 ? (
          <div className='py-6 text-center text-sm text-muted'>
            {t('暂无可用分组')}
          </div>
        ) : (
          <div className='overflow-hidden rounded-xl border border-[color:var(--app-border)]'>
            <table className='w-full text-sm'>
              <thead className='bg-[color:var(--app-background)] text-xs uppercase text-muted'>
                <tr>
                  <th className='px-3 py-2 text-left font-semibold'>
                    {t('分组')}
                  </th>
                  {showRatioCol ? (
                    <th className='px-3 py-2 text-left font-semibold'>
                      {t('分组倍率')}
                    </th>
                  ) : null}
                  <th className='px-3 py-2 text-left font-semibold'>
                    {t('计费类型')}
                  </th>
                  <th className='px-3 py-2 text-left font-semibold'>
                    {siteDisplayType === 'TOKENS'
                      ? t('计费摘要')
                      : t('价格摘要')}
                  </th>
                </tr>
              </thead>
              <tbody className='divide-y divide-[color:var(--app-border)]'>
                {tableData.map((row) => {
                  const billingTone =
                    row.billingType === t('按量计费')
                      ? 'violet'
                      : row.billingType === t('按次计费')
                        ? 'teal'
                        : row.billingType === t('动态计费')
                          ? 'amber'
                          : 'default';
                  const isDynamicSummary =
                    row.priceItems.length === 1 &&
                    row.priceItems[0].isDynamic;
                  return (
                    <tr key={row.key}>
                      <td className='px-3 py-2'>
                        <GroupChip>
                          {row.group}
                          {t('分组')}
                        </GroupChip>
                      </td>
                      {showRatioCol ? (
                        <td className='px-3 py-2'>
                          <GroupChip tone='blue'>{row.ratio}x</GroupChip>
                        </td>
                      ) : null}
                      <td className='px-3 py-2'>
                        <GroupChip tone={billingTone}>
                          {row.billingType || '-'}
                        </GroupChip>
                      </td>
                      <td className='px-3 py-2'>
                        {isDynamicSummary ? (
                          <span className='text-xs text-muted'>
                            {t('见上方动态计费详情')}
                          </span>
                        ) : (
                          <div className='space-y-1'>
                            {row.priceItems.map((item) => (
                              <div key={item.key}>
                                <div className='font-semibold text-orange-600 dark:text-orange-300'>
                                  {item.label} {item.value}
                                </div>
                                {item.suffix ? (
                                  <div className='text-xs text-muted'>
                                    {item.suffix}
                                  </div>
                                ) : null}
                              </div>
                            ))}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card.Content>
    </Card>
  );
};

export default ModelPricingTable;
