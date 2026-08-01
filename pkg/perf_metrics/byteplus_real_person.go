package perfmetrics

import (
	"strconv"
	"strings"
	"sync/atomic"
)

var bytePlusRealPersonMetricLabels = struct {
	resources  []string
	operations []string
	results    []string
	backlogs   []string
	callbacks  []string
}{
	resources:  []string{"asset", "verification_session"},
	operations: []string{"verification_status", "asset_status", "asset_delete", "tos_cleanup", "idempotency_recovery", "idempotency_retention"},
	results:    []string{"success", "retry", "error"},
	backlogs:   []string{"deleting", "tos_cleanup_due"},
	callbacks:  []string{"2xx", "429", "other_4xx", "5xx"},
}

type bytePlusRealPersonMetricSnapshot struct {
	outcomeUnknown [2]int64
	reconcile      [6][3]int64
	lastSuccess    int64
	backlogCount   [2]int64
	backlogAge     [2]int64
	callbacks      [4]int64
}

var (
	bytePlusRealPersonMetricsInitialized atomic.Bool
	bytePlusRealPersonOutcomeUnknown     [2]atomic.Int64
	bytePlusRealPersonReconcile          [6][3]atomic.Int64
	bytePlusRealPersonLastSuccess        atomic.Int64
	bytePlusRealPersonBacklogCount       [2]atomic.Int64
	bytePlusRealPersonBacklogAge         [2]atomic.Int64
	bytePlusRealPersonCallback           [4]atomic.Int64
)

func RecordBytePlusRealPersonOutcomeUnknown(resource string) {
	index := fixedLabelIndex(bytePlusRealPersonMetricLabels.resources, resource)
	if index < 0 {
		return
	}
	bytePlusRealPersonMetricsInitialized.Store(true)
	bytePlusRealPersonOutcomeUnknown[index].Add(1)
}

func RecordBytePlusRealPersonReconcile(operation, result string) {
	operationIndex := fixedLabelIndex(bytePlusRealPersonMetricLabels.operations, operation)
	resultIndex := fixedLabelIndex(bytePlusRealPersonMetricLabels.results, result)
	if operationIndex < 0 || resultIndex < 0 {
		return
	}
	bytePlusRealPersonMetricsInitialized.Store(true)
	bytePlusRealPersonReconcile[operationIndex][resultIndex].Add(1)
}

func MarkBytePlusRealPersonReconcileSuccess(now int64) {
	bytePlusRealPersonMetricsInitialized.Store(true)
	bytePlusRealPersonLastSuccess.Store(now)
}

func SetBytePlusRealPersonBacklog(kind string, count, oldestAge int64) {
	index := fixedLabelIndex(bytePlusRealPersonMetricLabels.backlogs, kind)
	if index < 0 {
		return
	}
	if count < 0 {
		count = 0
	}
	if oldestAge < 0 {
		oldestAge = 0
	}
	bytePlusRealPersonMetricsInitialized.Store(true)
	bytePlusRealPersonBacklogCount[index].Store(count)
	bytePlusRealPersonBacklogAge[index].Store(oldestAge)
}

func RecordBytePlusRealPersonCallbackStatus(statusCode int) {
	status := ""
	switch {
	case statusCode >= 200 && statusCode <= 299:
		status = "2xx"
	case statusCode == 429:
		status = "429"
	case statusCode >= 400 && statusCode <= 499:
		status = "other_4xx"
	case statusCode >= 500 && statusCode <= 599:
		status = "5xx"
	default:
		return
	}
	index := fixedLabelIndex(bytePlusRealPersonMetricLabels.callbacks, status)
	if index < 0 {
		return
	}
	bytePlusRealPersonMetricsInitialized.Store(true)
	bytePlusRealPersonCallback[index].Add(1)
}

func snapshotBytePlusRealPersonMetrics() (bytePlusRealPersonMetricSnapshot, bool) {
	var snapshot bytePlusRealPersonMetricSnapshot
	initialized := bytePlusRealPersonMetricsInitialized.Load()
	for i := range bytePlusRealPersonMetricLabels.resources {
		snapshot.outcomeUnknown[i] = bytePlusRealPersonOutcomeUnknown[i].Load()
	}
	for i := range bytePlusRealPersonMetricLabels.operations {
		for j := range bytePlusRealPersonMetricLabels.results {
			snapshot.reconcile[i][j] = bytePlusRealPersonReconcile[i][j].Load()
		}
	}
	snapshot.lastSuccess = bytePlusRealPersonLastSuccess.Load()
	for i := range bytePlusRealPersonMetricLabels.backlogs {
		snapshot.backlogCount[i] = bytePlusRealPersonBacklogCount[i].Load()
		snapshot.backlogAge[i] = bytePlusRealPersonBacklogAge[i].Load()
	}
	for i := range bytePlusRealPersonMetricLabels.callbacks {
		snapshot.callbacks[i] = bytePlusRealPersonCallback[i].Load()
	}
	return snapshot, initialized
}

func bytePlusRealPersonMetricSeriesCount(enabled bool) int {
	if !enabled {
		return 0
	}
	return len(bytePlusRealPersonMetricLabels.resources) +
		len(bytePlusRealPersonMetricLabels.operations)*len(bytePlusRealPersonMetricLabels.results) +
		1 +
		len(bytePlusRealPersonMetricLabels.backlogs)*2 +
		len(bytePlusRealPersonMetricLabels.callbacks)
}

func writeBytePlusRealPersonMetrics(b *strings.Builder, snapshot bytePlusRealPersonMetricSnapshot, enabled bool) {
	if !enabled {
		return
	}
	b.WriteString("# HELP newapi_byteplus_real_person_outcome_unknown_total Total idempotency outcome-unknown transitions by resource.\n")
	b.WriteString("# TYPE newapi_byteplus_real_person_outcome_unknown_total counter\n")
	for i, resource := range bytePlusRealPersonMetricLabels.resources {
		b.WriteString(`newapi_byteplus_real_person_outcome_unknown_total{resource="`)
		b.WriteString(resource)
		b.WriteString(`"} `)
		b.WriteString(strconv.FormatInt(snapshot.outcomeUnknown[i], 10))
		b.WriteByte('\n')
	}
	b.WriteString("# HELP newapi_byteplus_real_person_reconcile_total Total background reconciliation outcomes.\n")
	b.WriteString("# TYPE newapi_byteplus_real_person_reconcile_total counter\n")
	for i, operation := range bytePlusRealPersonMetricLabels.operations {
		for j, result := range bytePlusRealPersonMetricLabels.results {
			b.WriteString(`newapi_byteplus_real_person_reconcile_total{operation="`)
			b.WriteString(operation)
			b.WriteString(`",result="`)
			b.WriteString(result)
			b.WriteString(`"} `)
			b.WriteString(strconv.FormatInt(snapshot.reconcile[i][j], 10))
			b.WriteByte('\n')
		}
	}
	b.WriteString("# HELP newapi_byteplus_real_person_reconcile_last_success_unixtime Last successful full reconciliation Unix time.\n")
	b.WriteString("# TYPE newapi_byteplus_real_person_reconcile_last_success_unixtime gauge\n")
	b.WriteString("newapi_byteplus_real_person_reconcile_last_success_unixtime ")
	b.WriteString(strconv.FormatInt(snapshot.lastSuccess, 10))
	b.WriteByte('\n')
	b.WriteString("# HELP newapi_byteplus_real_person_backlog Current background reconciliation backlog count.\n")
	b.WriteString("# TYPE newapi_byteplus_real_person_backlog gauge\n")
	for i, kind := range bytePlusRealPersonMetricLabels.backlogs {
		b.WriteString(`newapi_byteplus_real_person_backlog{kind="`)
		b.WriteString(kind)
		b.WriteString(`"} `)
		b.WriteString(strconv.FormatInt(snapshot.backlogCount[i], 10))
		b.WriteByte('\n')
	}
	b.WriteString("# HELP newapi_byteplus_real_person_backlog_oldest_update_age_seconds Age of oldest background reconciliation backlog row.\n")
	b.WriteString("# TYPE newapi_byteplus_real_person_backlog_oldest_update_age_seconds gauge\n")
	for i, kind := range bytePlusRealPersonMetricLabels.backlogs {
		b.WriteString(`newapi_byteplus_real_person_backlog_oldest_update_age_seconds{kind="`)
		b.WriteString(kind)
		b.WriteString(`"} `)
		b.WriteString(strconv.FormatInt(snapshot.backlogAge[i], 10))
		b.WriteByte('\n')
	}
	b.WriteString("# HELP newapi_byteplus_real_person_callback_total Total real-person callback HTTP status buckets.\n")
	b.WriteString("# TYPE newapi_byteplus_real_person_callback_total counter\n")
	for i, status := range bytePlusRealPersonMetricLabels.callbacks {
		b.WriteString(`newapi_byteplus_real_person_callback_total{status="`)
		b.WriteString(status)
		b.WriteString(`"} `)
		b.WriteString(strconv.FormatInt(snapshot.callbacks[i], 10))
		b.WriteByte('\n')
	}
}

func fixedLabelIndex(labels []string, value string) int {
	value = strings.TrimSpace(value)
	for i, label := range labels {
		if value == label {
			return i
		}
	}
	return -1
}

func resetBytePlusRealPersonMetricsForTest() {
	bytePlusRealPersonMetricsInitialized.Store(false)
	for i := range bytePlusRealPersonOutcomeUnknown {
		bytePlusRealPersonOutcomeUnknown[i].Store(0)
	}
	for i := range bytePlusRealPersonReconcile {
		for j := range bytePlusRealPersonReconcile[i] {
			bytePlusRealPersonReconcile[i][j].Store(0)
		}
	}
	bytePlusRealPersonLastSuccess.Store(0)
	for i := range bytePlusRealPersonBacklogCount {
		bytePlusRealPersonBacklogCount[i].Store(0)
		bytePlusRealPersonBacklogAge[i].Store(0)
	}
	for i := range bytePlusRealPersonCallback {
		bytePlusRealPersonCallback[i].Store(0)
	}
}
