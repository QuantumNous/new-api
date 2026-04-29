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

import React, { useEffect, useMemo, useState } from 'react';
import { Button, Empty, Pagination, Select } from '@douyinfe/semi-ui';
import CardTable from '../common/ui/CardTable';
import { renderNumber, renderQuota, showSuccess } from '../../helpers';

const EXPORT_OPTIONS = [
  { label: 'CSV', value: 'csv' },
  { label: 'JSON', value: 'json' },
];

const PAGE_SIZE_OPTIONS = [10, 50, 100, 500];

const escapeCsvCell = (value) => {
  if (value === null || value === undefined) {
    return '';
  }
  const stringValue = String(value);
  if (
    stringValue.includes(',') ||
    stringValue.includes('"') ||
    stringValue.includes('\n')
  ) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }
  return stringValue;
};

const downloadFile = (content, filename, mimeType) => {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
};

const buildTableConfig = (
  activeChartTab,
  {
    spec_line,
    spec_model_line,
    spec_pie,
    spec_rank_bar,
    spec_user_rank,
    spec_user_trend,
  },
  isAdminUser,
  analysisDimensionLabel,
  t,
) => {
  const lineRows = spec_line?.data?.[0]?.values || [];
  const modelTrendRows = spec_model_line?.data?.[0]?.values || [];
  const pieRows = spec_pie?.data?.[0]?.values || [];
  const rankRows = spec_rank_bar?.data?.[0]?.values || [];
  const userRankRows = spec_user_rank?.data?.[0]?.values || [];
  const userTrendRows = spec_user_trend?.data?.[0]?.values || [];

  switch (activeChartTab) {
    case '1':
      return {
        title: `${analysisDimensionLabel}${t('消耗分布明细')}`,
        filenamePrefix: 'model-consume-distribution',
        columns: [
          { key: 'time', title: t('时间'), dataIndex: 'Time' },
          {
            key: 'model',
            title: analysisDimensionLabel,
            dataIndex: 'Model',
          },
          {
            key: 'quota',
            title: t('消耗额度'),
            dataIndex: 'rawQuota',
            render: (value) => renderQuota(value || 0, 4),
          },
        ],
        rows: lineRows.map((row, index) => ({ ...row, key: `line-${index}` })),
        exportRows: lineRows.map((row) => ({
          时间: row.Time,
          [analysisDimensionLabel]: row.Model,
          消耗额度: row.rawQuota || 0,
        })),
      };
    case '2':
      return {
        title: `${analysisDimensionLabel}${t('调用趋势明细')}`,
        filenamePrefix: 'model-call-trend',
        columns: [
          { key: 'time', title: t('时间'), dataIndex: 'Time' },
          {
            key: 'model',
            title: analysisDimensionLabel,
            dataIndex: 'Model',
          },
          {
            key: 'count',
            title: t('调用次数'),
            dataIndex: 'Count',
            render: (value) => renderNumber(value || 0),
          },
        ],
        rows: modelTrendRows.map((row, index) => ({
          ...row,
          key: `trend-${index}`,
        })),
        exportRows: modelTrendRows.map((row) => ({
          时间: row.Time,
          [analysisDimensionLabel]: row.Model,
          调用次数: row.Count || 0,
        })),
      };
    case '3': {
      const total = pieRows.reduce((sum, row) => sum + (row.value || 0), 0);
      return {
        title: `${analysisDimensionLabel}${t('调用次数分布明细')}`,
        filenamePrefix: 'model-call-share',
        columns: [
          { key: 'model', title: analysisDimensionLabel, dataIndex: 'type' },
          {
            key: 'count',
            title: t('调用次数'),
            dataIndex: 'value',
            render: (value) => renderNumber(value || 0),
          },
          {
            key: 'ratio',
            title: t('占比'),
            dataIndex: 'ratio',
            render: (value) => `${value}%`,
          },
        ],
        rows: pieRows.map((row, index) => ({
          ...row,
          key: `pie-${index}`,
          ratio:
            total > 0 ? (((row.value || 0) / total) * 100).toFixed(2) : '0.00',
        })),
        exportRows: pieRows.map((row) => ({
          [analysisDimensionLabel]: row.type,
          调用次数: row.value || 0,
          占比:
            total > 0
              ? `${(((row.value || 0) / total) * 100).toFixed(2)}%`
              : '0.00%',
        })),
      };
    }
    case '4':
      return {
        title: `${analysisDimensionLabel}${t('调用次数排行明细')}`,
        filenamePrefix: 'model-call-ranking',
        columns: [
          { key: 'rank', title: t('排名'), dataIndex: 'rank' },
          {
            key: 'model',
            title: analysisDimensionLabel,
            dataIndex: 'Model',
          },
          {
            key: 'count',
            title: t('调用次数'),
            dataIndex: 'Count',
            render: (value) => renderNumber(value || 0),
          },
        ],
        rows: rankRows.map((row, index) => ({
          ...row,
          key: `rank-${index}`,
          rank: index + 1,
        })),
        exportRows: rankRows.map((row, index) => ({
          排名: index + 1,
          [analysisDimensionLabel]: row.Model,
          调用次数: row.Count || 0,
        })),
      };
    case '5':
      if (!isAdminUser) {
        return null;
      }
      return {
        title: t('用户消耗排行明细'),
        filenamePrefix: 'user-consume-ranking',
        columns: [
          { key: 'rank', title: t('排名'), dataIndex: 'rank' },
          { key: 'user', title: t('用户'), dataIndex: 'User' },
          {
            key: 'quota',
            title: t('消耗额度'),
            dataIndex: 'rawQuota',
            render: (value) => renderQuota(value || 0, 4),
          },
        ],
        rows: userRankRows.map((row, index) => ({
          ...row,
          key: `user-rank-${index}`,
          rank: index + 1,
        })),
        exportRows: userRankRows.map((row, index) => ({
          排名: index + 1,
          用户: row.User,
          消耗额度: row.rawQuota || 0,
        })),
      };
    case '6':
      if (!isAdminUser) {
        return null;
      }
      return {
        title: t('用户消耗趋势明细'),
        filenamePrefix: 'user-consume-trend',
        columns: [
          { key: 'time', title: t('时间'), dataIndex: 'Time' },
          { key: 'user', title: t('用户'), dataIndex: 'User' },
          {
            key: 'quota',
            title: t('消耗额度'),
            dataIndex: 'rawQuota',
            render: (value) => renderQuota(value || 0, 4),
          },
        ],
        rows: userTrendRows.map((row, index) => ({
          ...row,
          key: `user-trend-${index}`,
        })),
        exportRows: userTrendRows.map((row) => ({
          时间: row.Time,
          用户: row.User,
          消耗额度: row.rawQuota || 0,
        })),
      };
    default:
      return null;
  }
};

const DashboardAnalysisTable = ({
  activeChartTab,
  spec_line,
  spec_model_line,
  spec_pie,
  spec_rank_bar,
  spec_user_rank,
  spec_user_trend,
  isAdminUser,
  analysisDimensionLabel,
  t,
}) => {
  const [exportFormat, setExportFormat] = useState('csv');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const tableConfig = useMemo(
    () =>
      buildTableConfig(
        activeChartTab,
        {
          spec_line,
          spec_model_line,
          spec_pie,
          spec_rank_bar,
          spec_user_rank,
          spec_user_trend,
        },
        isAdminUser,
        analysisDimensionLabel,
        t,
      ),
    [
      activeChartTab,
      spec_line,
      spec_model_line,
      spec_pie,
      spec_rank_bar,
      spec_user_rank,
      spec_user_trend,
      isAdminUser,
      analysisDimensionLabel,
      t,
    ],
  );

  useEffect(() => {
    setCurrentPage(1);
  }, [activeChartTab, pageSize, tableConfig?.rows?.length]);

  if (!tableConfig) {
    return null;
  }

  const rows = tableConfig.rows || [];
  const paginatedRows = rows.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize,
  );

  const handleExport = () => {
    if (!tableConfig.exportRows || tableConfig.exportRows.length === 0) {
      return;
    }

    const timestamp = new Date()
      .toISOString()
      .replace(/[:]/g, '-')
      .replace(/\..+$/, '');

    if (exportFormat === 'json') {
      downloadFile(
        `${JSON.stringify(tableConfig.exportRows, null, 2)}\n`,
        `${tableConfig.filenamePrefix}-${timestamp}.json`,
        'application/json;charset=utf-8',
      );
    } else {
      const headers = Object.keys(tableConfig.exportRows[0] || {});
      const csv = [
        headers.join(','),
        ...tableConfig.exportRows.map((row) =>
          headers.map((header) => escapeCsvCell(row[header])).join(','),
        ),
      ].join('\n');

      downloadFile(
        `\uFEFF${csv}\n`,
        `${tableConfig.filenamePrefix}-${timestamp}.csv`,
        'text/csv;charset=utf-8',
      );
    }

    showSuccess(t('数据已下载'));
  };

  return (
    <div className='border-t border-[var(--semi-color-border)] p-4'>
      <div className='mb-3 flex flex-col gap-3 md:flex-row md:items-center md:justify-between'>
        <div className='text-sm font-semibold text-[var(--semi-color-text-0)]'>
          {tableConfig.title}
        </div>
        <div className='flex items-center justify-end gap-2'>
          <Select
            value={exportFormat}
            optionList={EXPORT_OPTIONS}
            size='small'
            style={{ minWidth: 110 }}
            onChange={setExportFormat}
          />
          <Button
            type='tertiary'
            size='small'
            disabled={tableConfig.exportRows.length === 0}
            onClick={handleExport}
          >
            {t('导出')}
          </Button>
        </div>
      </div>

      <CardTable
        columns={tableConfig.columns}
        dataSource={paginatedRows}
        rowKey='key'
        hidePagination={true}
        size='small'
        scroll={{ x: 'max-content' }}
        empty={<Empty description={t('暂无数据')} style={{ padding: 24 }} />}
      />

      {rows.length > 0 && (
        <div className='mt-3 flex justify-end'>
          <Pagination
            currentPage={currentPage}
            pageSize={pageSize}
            total={rows.length}
            pageSizeOpts={PAGE_SIZE_OPTIONS}
            showSizeChanger
            showTotal
            onPageChange={setCurrentPage}
            onPageSizeChange={(size) => {
              setPageSize(size);
              setCurrentPage(1);
            }}
          />
        </div>
      )}
    </div>
  );
};

export default DashboardAnalysisTable;
