package perfmetrics

import (
	"context"
	"strings"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestBuildPrometheusTextEmitsRecallTranslationMetrics(t *testing.T) {
	resetPerfMetricsStateForTest(t)

	RecordRecallTranslationObservation("succeeded", "succeeded", "", false, 1500)
	RecordRecallTranslationObservation("failed", "failed", "translation_failed", false, 250)
	RecordRecallTranslationObservation("claimed", "running", "", true, 0)

	text, err := BuildPrometheusText(context.Background())

	require.NoError(t, err)
	require.Contains(t, text, "# HELP newapi_recall_translation_tasks_total Total recall translation task observations by lifecycle event and status.\n")
	require.Contains(t, text, "# TYPE newapi_recall_translation_tasks_total counter\n")
	require.Contains(t, text, "# HELP newapi_recall_translation_duration_seconds Recall translation task completion duration by status.\n")
	require.Contains(t, text, "# TYPE newapi_recall_translation_duration_seconds histogram\n")
	requirePrometheusSampleLine(t, text, `newapi_recall_translation_tasks_total{event="claimed",status="running",error_class="none"} 1`)
	requirePrometheusSampleLine(t, text, `newapi_recall_translation_tasks_total{event="failed",status="failed",error_class="translation_failed"} 1`)
	requirePrometheusSampleLine(t, text, `newapi_recall_translation_tasks_total{event="succeeded",status="succeeded",error_class="none"} 1`)
	requirePrometheusSampleLine(t, text, `newapi_recall_translation_lease_recoveries_total{event="claimed",status="running",error_class="none"} 1`)
	requirePrometheusSampleLine(t, text, `newapi_recall_translation_duration_seconds_bucket{status="failed",le="0.25"} 1`)
	requirePrometheusSampleLine(t, text, `newapi_recall_translation_duration_seconds_bucket{status="succeeded",le="2"} 1`)
	requirePrometheusSampleLine(t, text, `newapi_recall_translation_duration_seconds_count{status="failed"} 1`)
	requirePrometheusSampleLine(t, text, `newapi_recall_translation_duration_seconds_count{status="succeeded"} 1`)
	requirePrometheusSeriesGaugeMatchesRenderedSamples(t, text)
	require.NotContains(t, text, "secret@example.com")
	require.NotContains(t, text, "{{.ClaimURL}}")
	for _, line := range strings.Split(text, "\n") {
		if strings.HasPrefix(line, "newapi_recall_translation_") {
			require.NotContains(t, line, "task_id")
			require.NotContains(t, line, "campaign_id")
		}
	}
}
