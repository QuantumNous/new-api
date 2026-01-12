export function parseHttpStatusCodeRules(input) {
  const raw = (input ?? '').toString().trim();
  if (raw.length === 0) {
    return {
      ok: true,
      ranges: [],
      tokens: [],
      normalized: '',
      invalidTokens: [],
    };
  }

  const sanitized = raw.replace(/[，]/g, ',');
  const segments = sanitized.split(/[,]/g);

  const ranges = [];
  const invalidTokens = [];

  for (const segment of segments) {
    const trimmed = segment.trim();
    if (!trimmed) continue;
    const parsed = parseToken(trimmed);
    if (!parsed) invalidTokens.push(trimmed);
    else ranges.push(parsed);
  }

  if (invalidTokens.length > 0) {
    return {
      ok: false,
      ranges: [],
      tokens: [],
      normalized: raw,
      invalidTokens,
    };
  }

  const merged = mergeRanges(ranges);
  const tokens = merged.map((r) => (r.start === r.end ? `${r.start}` : `${r.start}-${r.end}`));
  const normalized = tokens.join(',');

  return {
    ok: true,
    ranges: merged,
    tokens,
    normalized,
    invalidTokens: [],
  };
}

function parseToken(token) {
  const cleaned = (token ?? '').toString().trim().replaceAll(' ', '');
  if (!cleaned) return null;

  if (cleaned.includes('-')) {
    const parts = cleaned.split('-');
    if (parts.length !== 2) return null;
    const [a, b] = parts;
    if (!isNumber(a) || !isNumber(b)) return null;
    const start = Number.parseInt(a, 10);
    const end = Number.parseInt(b, 10);
    if (!Number.isFinite(start) || !Number.isFinite(end)) return null;
    if (start > end) return null;
    if (start < 100 || end > 599) return null;
    return { start, end };
  }

  if (!isNumber(cleaned)) return null;
  const code = Number.parseInt(cleaned, 10);
  if (!Number.isFinite(code)) return null;
  if (code < 100 || code > 599) return null;
  return { start: code, end: code };
}

function isNumber(s) {
  return typeof s === 'string' && /^\d+$/.test(s);
}

function mergeRanges(ranges) {
  if (!Array.isArray(ranges) || ranges.length === 0) return [];

  const sorted = [...ranges].sort((a, b) => (a.start !== b.start ? a.start - b.start : a.end - b.end));
  const merged = [sorted[0]];

  for (let i = 1; i < sorted.length; i += 1) {
    const current = sorted[i];
    const last = merged[merged.length - 1];

    if (current.start <= last.end + 1) {
      last.end = Math.max(last.end, current.end);
      continue;
    }
    merged.push({ ...current });
  }

  return merged;
}
