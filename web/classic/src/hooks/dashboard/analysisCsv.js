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

export const buildDashboardAnalysisCsv = ({
  rows = [],
  isAdminUser,
  t = (value) => value,
  quotaPerUnit = 1,
}) => {
  if (!rows.length) return '';

  const normalizedQuotaPerUnit = Number(quotaPerUnit);
  const safeQuotaPerUnit =
    Number.isFinite(normalizedQuotaPerUnit) && normalizedQuotaPerUnit > 0
      ? normalizedQuotaPerUnit
      : 1;
  const headers = [
    t('时间'),
    ...(isAdminUser ? [t('用户')] : []),
    t('模型'),
    t('令牌名称'),
    t('分组'),
    ...(isAdminUser ? [t('渠道')] : []),
    t('成功请求数'),
    t('输入 Tokens'),
    t('输出 Tokens'),
    t('消费金额（USD）'),
  ];
  const values = rows.map((row) => [
    formatAnalysisPeriod(row.period),
    ...(isAdminUser ? [row.username || ''] : []),
    row.model_name || '',
    row.token_name || '',
    row.group || '',
    ...(isAdminUser ? [row.channel_id || ''] : []),
    Number(row.request_count || 0),
    Number(row.prompt_tokens || 0),
    Number(row.completion_tokens || 0),
    (Number(row.quota || 0) / safeQuotaPerUnit).toFixed(6),
  ]);
  return `\uFEFF${[headers, ...values]
    .map((row) => row.map(escapeCsvCell).join(','))
    .join('\r\n')}`;
};
