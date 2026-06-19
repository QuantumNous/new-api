// Shared mapping for the v3.1 difference-localisation `diff_kind` tag, used by
// SummaryCard (差异构成), ByModelTable and DiffTable. `t` is the i18next fn.
export const DIFF_KIND_META = {
  price_only: { color: 'amber', label: '倍率差' },
  usage: { color: 'red', label: '用量差' },
  missing_local: { color: 'orange', label: '我方漏记' },
  missing_supplier: { color: 'purple', label: '供方漏记' },
  mixed: { color: 'grey', label: '复合差异' },
};

export function diffKindTag(kind, t) {
  if (!kind) return null;
  const meta = DIFF_KIND_META[kind];
  if (!meta) return { color: 'grey', label: kind };
  return { color: meta.color, label: t(meta.label) };
}
