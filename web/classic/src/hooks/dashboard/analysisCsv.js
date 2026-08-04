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

export const escapeCsvCell = (value) => {
  let text = String(value ?? '');
  if (/^[\t\r\n ]*[=+\-@]/.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
};

export const formatAnalysisPeriod = (period) => {
  if (!period) return '';
  return new Date(Number(period) * 1000)
    .toLocaleString('zh-CN', {
      hour12: false,
      timeZone: 'Asia/Shanghai',
    })
    .replaceAll('/', '-');
};

const ANALYSIS_DIMENSION_ORDER = [
  'period',
  'username',
  'model_name',
  'token_name',
  'group',
  'channel',
];

export const getAnalysisTableDimensions = (isAdminUser, dimensions) => {
  const selected = new Set(Array.isArray(dimensions) ? dimensions : []);
  return ANALYSIS_DIMENSION_ORDER.filter(
    (dimension) =>
      selected.has(dimension) &&
      (isAdminUser || !['username', 'channel'].includes(dimension)),
  );
};

export const buildDashboardAnalysisCsv = ({
  rows = [],
  isAdminUser,
  t = (value) => value,
  quotaPerUnit = 1,
  dimensions,
}) => {
  if (!rows.length) return '';

  // The server-confirmed dimensions are the display contract. Missing metadata
  // fails closed so an omitted dimension cannot become a dead CSV column.
  const selectedDimensions = new Set(
    getAnalysisTableDimensions(isAdminUser, dimensions),
  );
  const hasDimension = (dimension) => selectedDimensions.has(dimension);

  const normalizedQuotaPerUnit = Number(quotaPerUnit);
  const safeQuotaPerUnit =
    Number.isFinite(normalizedQuotaPerUnit) && normalizedQuotaPerUnit > 0
      ? normalizedQuotaPerUnit
      : 1;
  const headers = [
    ...(hasDimension('period') ? [t('时间')] : []),
    ...(hasDimension('username') ? [t('用户')] : []),
    ...(hasDimension('model_name') ? [t('模型')] : []),
    ...(hasDimension('token_name') ? [t('令牌名称')] : []),
    ...(hasDimension('group') ? [t('分组')] : []),
    ...(hasDimension('channel') ? [t('渠道')] : []),
    t('成功请求数'),
    t('输入 Tokens'),
    t('输出 Tokens'),
    t('消费金额（USD）'),
  ];
  const values = rows.map((row) => [
    ...(hasDimension('period') ? [formatAnalysisPeriod(row.period)] : []),
    ...(hasDimension('username') ? [row.username || ''] : []),
    ...(hasDimension('model_name') ? [row.model_name || ''] : []),
    ...(hasDimension('token_name') ? [row.token_name || ''] : []),
    ...(hasDimension('group') ? [row.group || ''] : []),
    ...(hasDimension('channel') ? [row.channel_id || ''] : []),
    Number(row.request_count || 0),
    Number(row.prompt_tokens || 0),
    Number(row.completion_tokens || 0),
    (Number(row.quota || 0) / safeQuotaPerUnit).toFixed(6),
  ]);
  return `\uFEFF${[headers, ...values]
    .map((row) => row.map(escapeCsvCell).join(','))
    .join('\r\n')}`;
};
