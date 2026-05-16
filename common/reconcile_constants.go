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
