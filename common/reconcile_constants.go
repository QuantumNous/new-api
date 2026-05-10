package common

// Reconciliation module configuration. The module's only product is a monthly
// xlsx download for manual comparison against the supplier bill (see
// docs/reconciliation-design.md).

// Per-bucket aggregation lag in seconds. Once a bucket has been aggregated and
// AggregatedAt + lag is in the past, the periodic sweep skips it instead of
// rewriting the same data every hour.
var ReconcileAggregateLagSeconds = 1800
