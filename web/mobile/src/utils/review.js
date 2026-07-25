// 工单/审批共用的枚举与展示工具

export const FEEDBACK_STATUS = {
  1: { text: '待处理', badge: 'pending' },
  2: { text: '处理中', badge: 'info' },
  3: { text: '已回复', badge: 'success' },
  4: { text: '已关闭', badge: 'danger' },
};

export const FEEDBACK_CATEGORY = {
  1: '建议',
  2: '咨询',
  3: 'Bug',
  4: '充值与账单',
  5: '其他',
};

// KYC / 企业认证 / 转账 / 开票通用：1 待审核 2 通过/入账/开具 3 驳回
export const REVIEW_STATUS = {
  1: { text: '待审核', badge: 'pending' },
  2: { text: '已通过', badge: 'success' },
  3: { text: '已驳回', badge: 'danger' },
};

export const fenToYuan = (fen) =>
  typeof fen === 'number' ? `¥${(fen / 100).toFixed(2)}` : '--';

// 后端时间字段两种形态并存：ISO 字符串（工单/审批）或 unix 秒（日志）
export const formatTs = (ts) => {
  if (!ts) return '';
  const d = typeof ts === 'number' ? new Date(ts * 1000) : new Date(ts);
  if (Number.isNaN(d.getTime())) return '';
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getMonth() + 1}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
};

export const downloadBase64File = (fileName, base64) => {
  const bytes = atob(base64);
  const arr = new Uint8Array(bytes.length);
  for (let i = 0; i < bytes.length; i++) {
    arr[i] = bytes.charCodeAt(i);
  }
  const blob = new Blob([arr]);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
};
