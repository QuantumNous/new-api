export function formatTokens(value) {
  if (!Number.isFinite(value) || value === 0) return '0';
  const abs = Math.abs(value);
  if (abs >= 1e9) return `${(value / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `${(value / 1e6).toFixed(abs >= 1e8 ? 0 : abs >= 1e7 ? 1 : 2)}M`;
  if (abs >= 1e3) return `${(value / 1e3).toFixed(abs >= 1e5 ? 0 : 1)}K`;
  return String(Math.round(value));
}

export function formatShare(share) {
  if (!Number.isFinite(share)) return '0%';
  return `${(share * 100).toFixed(1)}%`;
}
