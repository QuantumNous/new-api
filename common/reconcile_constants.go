package common

// Reconciliation v3.0 (upload-driven). See docs/reconciliation-upload-design.md.

// ReconcileUploadMaxFileBytes caps the supplier-bill upload size.
var ReconcileUploadMaxFileBytes int64 = 10 * 1024 * 1024 // 10 MB

// ReconcileUploadMaxLogRangeDays caps the time span covered by one upload, to
// keep the on-the-fly log scan bounded.
var ReconcileUploadMaxLogRangeDays = 31

// ReconcileDriftOkPct: |final cumulative Δ¥| / supplier_total_¥ below this
// ratio is classified as "ok_drift_only" by the drift analyser.
var ReconcileDriftOkPct = 0.005

// ReconcileDriftWarnPct: above this ratio the analyser flips to "diverging".
// Between OkPct and WarnPct the verdict is "needs_attention".
var ReconcileDriftWarnPct = 0.02

// ReconcileMaxBuckets caps the total number of (model, time-bucket) diff rows
// the comparator will produce. Larger uploads must switch to day-level
// granularity or shorten the time span — anything bigger overwhelms the JSON
// response and the frontend table.
var ReconcileMaxBuckets = 20000

// --- v3.1 difference-localisation (see docs §十三) ---

// ReconcileMaxAlignShiftHours: per-model the comparator probes integer-hour
// shifts in [-N, +N] to absorb the supplier's systematic hour-bucket offset
// before deciding what is a *real* difference. The parallel supplier drifts
// by ±1h, so 1 is enough — a wider window risks swallowing genuine adjacent
// differences as drift.
var ReconcileMaxAlignShiftHours = 1

// ReconcileSignificantAmountCNY: after alignment + ±1h residual netting, a
// (model, hour) bucket is shown in the detail table only if its residual Δ¥
// reaches this. Below it the bucket is pure drift / rounding and is hidden.
var ReconcileSignificantAmountCNY = 0.01

// ReconcileSignificantTokens / ReconcileSignificantPct gate whether a token
// dimension counts as a genuine *usage* mismatch (vs price-only): the delta
// must be at least this many tokens AND at least this share of the larger
// side. Both bounds avoid flagging rounding-scale token jitter.
var ReconcileSignificantTokens int64 = 1
var ReconcileSignificantPct = 0.005

// ReconcileDiffBreakdownTopN caps how many models the summary "差异构成"
// attribution lists explicitly; the rest collapse into a single "其他" item.
var ReconcileDiffBreakdownTopN = 5
