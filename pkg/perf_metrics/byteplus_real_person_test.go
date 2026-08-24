package perfmetrics

import (
	"context"
	"fmt"
	"strings"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestBytePlusRealPersonMetricsFixedSeriesAndLabels(t *testing.T) {
	resetPerfMetricsStateForTest(t)

	text, err := BuildPrometheusText(context.Background())
	require.NoError(t, err)
	require.Equal(t, 29, countBytePlusRealPersonSamples(text))
	requirePrometheusSampleLine(t, text, `newapi_byteplus_real_person_outcome_unknown_total{resource="asset"} 0`)
	requirePrometheusSampleLine(t, text, `newapi_byteplus_real_person_backlog{kind="deleting"} 0`)
	requireAllBytePlusRealPersonReconcileSeries(t, text)
	requirePrometheusSeriesGaugeMatchesRenderedSamples(t, text)

	RecordBytePlusRealPersonOutcomeUnknown("unknown")
	RecordBytePlusRealPersonReconcile("asset_status", "unknown")
	SetBytePlusRealPersonBacklog("bad", -1, -1)
	RecordBytePlusRealPersonCallbackStatus(302)
	text, err = BuildPrometheusText(context.Background())
	require.NoError(t, err)
	require.Equal(t, 29, countBytePlusRealPersonSamples(text))
	requirePrometheusSampleLine(t, text, `newapi_byteplus_real_person_outcome_unknown_total{resource="asset"} 0`)
	requirePrometheusSampleLine(t, text, `newapi_byteplus_real_person_reconcile_total{operation="asset_status",result="error"} 0`)
	requirePrometheusSampleLine(t, text, `newapi_byteplus_real_person_backlog{kind="deleting"} 0`)
	requirePrometheusSampleLine(t, text, `newapi_byteplus_real_person_callback_total{status="429"} 0`)
	requirePrometheusSeriesGaugeMatchesRenderedSamples(t, text)

	RecordBytePlusRealPersonOutcomeUnknown("asset")
	RecordBytePlusRealPersonReconcile("asset_delete", "success")
	MarkBytePlusRealPersonReconcileSuccess(1234)
	SetBytePlusRealPersonBacklog("deleting", 3, -9)
	RecordBytePlusRealPersonCallbackStatus(429)

	text, err = BuildPrometheusText(context.Background())
	require.NoError(t, err)
	require.Equal(t, 29, countBytePlusRealPersonSamples(text))
	requirePrometheusSampleLine(t, text, `newapi_byteplus_real_person_outcome_unknown_total{resource="asset"} 1`)
	requirePrometheusSampleLine(t, text, `newapi_byteplus_real_person_reconcile_total{operation="asset_delete",result="success"} 1`)
	requirePrometheusSampleLine(t, text, "newapi_byteplus_real_person_reconcile_last_success_unixtime 1234")
	requirePrometheusSampleLine(t, text, `newapi_byteplus_real_person_backlog{kind="deleting"} 3`)
	requirePrometheusSampleLine(t, text, `newapi_byteplus_real_person_backlog_oldest_update_age_seconds{kind="deleting"} 0`)
	requirePrometheusSampleLine(t, text, `newapi_byteplus_real_person_callback_total{status="429"} 1`)
	require.NotContains(t, text, `resource="unknown"`)
	require.NotContains(t, text, `result="unknown"`)
	require.NotContains(t, text, `status="3xx"`)
	requirePrometheusSeriesGaugeMatchesRenderedSamples(t, text)
}

func TestBytePlusRealPersonMetricsSeriesCapFailsClosed(t *testing.T) {
	resetPerfMetricsStateForTest(t)
	t.Setenv(prometheusMaxSeriesPerScrapeEnv, "28")

	RecordBytePlusRealPersonCallbackStatus(200)
	text, err := BuildPrometheusText(context.Background())

	require.Error(t, err)
	require.Empty(t, text)
}

func TestBytePlusRealPersonCallbackStatusBuckets(t *testing.T) {
	resetPerfMetricsStateForTest(t)

	for _, status := range []int{200, 204, 429, 400, 499, 500, 599} {
		RecordBytePlusRealPersonCallbackStatus(status)
	}

	text, err := BuildPrometheusText(context.Background())
	require.NoError(t, err)
	requirePrometheusSampleLine(t, text, `newapi_byteplus_real_person_callback_total{status="2xx"} 2`)
	requirePrometheusSampleLine(t, text, `newapi_byteplus_real_person_callback_total{status="429"} 1`)
	requirePrometheusSampleLine(t, text, `newapi_byteplus_real_person_callback_total{status="other_4xx"} 2`)
	requirePrometheusSampleLine(t, text, `newapi_byteplus_real_person_callback_total{status="5xx"} 2`)
}

func countBytePlusRealPersonSamples(text string) int {
	count := 0
	for _, line := range strings.Split(text, "\n") {
		if strings.HasPrefix(line, "newapi_byteplus_real_person_") {
			count++
		}
	}
	return count
}

func requireAllBytePlusRealPersonReconcileSeries(t *testing.T, text string) {
	t.Helper()
	for _, operation := range []string{"verification_status", "asset_status", "asset_delete", "tos_cleanup", "idempotency_recovery", "idempotency_retention"} {
		for _, result := range []string{"success", "retry", "error"} {
			requirePrometheusSampleLine(t, text, fmt.Sprintf(`newapi_byteplus_real_person_reconcile_total{operation="%s",result="%s"} 0`, operation, result))
		}
	}
}
