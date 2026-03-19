export function normalizeDetailSegments(summary) {
  if (!summary) {
    return [];
  }

  if (Array.isArray(summary)) {
    return summary.filter((segment) => segment?.text);
  }

  if (Array.isArray(summary.segments)) {
    return summary.segments.filter((segment) => segment?.text);
  }

  if (typeof summary === 'string') {
    return splitSummaryText(summary);
  }

  if (typeof summary.text === 'string') {
    return splitSummaryText(summary.text);
  }

  return [];
}

function splitSummaryText(summaryText) {
  const normalizedText = String(summaryText || '').trim();
  if (!normalizedText) {
    return [];
  }

  const parts = normalizedText
    .split(/，\s*|\n+/)
    .map((part) => part.trim())
    .filter(Boolean);

  if (parts.length === 0) {
    return [];
  }

  return parts.map((text, index) => ({
    text,
    tone: index === 0 ? 'primary' : 'secondary',
  }));
}
