package common

import (
	"net/http"
	"testing"
)

func resetRequestMetricsForTest() {
	requestMetrics.Lock()
	defer requestMetrics.Unlock()
	requestMetrics.buckets = [requestMetricsBuckets]requestMetricsBucketState{}
}

func TestGetRequestSuccessRateRequiresMinimumSamples(t *testing.T) {
	resetRequestMetricsForTest()
	t.Cleanup(resetRequestMetricsForTest)

	for i := 0; i < requestMetricsMinSamples-1; i++ {
		ObserveRequest(http.StatusOK)
	}
	if got := GetRequestSuccessRate(); got != nil {
		t.Fatalf("expected nil rate below minimum sample count, got %v", *got)
	}

	ObserveRequest(http.StatusInternalServerError)
	got := GetRequestSuccessRate()
	if got == nil || *got != 93.3 {
		t.Fatalf("expected 93.3%% after minimum samples, got %v", got)
	}
}

func TestGetRequestSuccessRateCountsBusinessFailures(t *testing.T) {
	resetRequestMetricsForTest()
	t.Cleanup(resetRequestMetricsForTest)

	for i := 0; i < requestMetricsMinSamples-1; i++ {
		ObserveRequestOutcome(true)
	}
	ObserveRequestOutcome(false)

	got := GetRequestSuccessRate()
	if got == nil || *got != 93.3 {
		t.Fatalf("expected HTTP 200 business failure to lower rate to 93.3%%, got %v", got)
	}
}
