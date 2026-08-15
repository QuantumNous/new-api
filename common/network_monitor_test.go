package common

import (
	"fmt"
	"net/http"
	"net/http/httptest"
	"net/url"
	"strings"
	"sync"
	"testing"
)

func TestSampleNetworkBandwidthQueriesPrometheusAndBuildsSeries(t *testing.T) {
	var queries []string
	var queriesMu sync.Mutex
	server := httptest.NewServer(http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
		if request.Header.Get("Authorization") != "Bearer test-token" {
			http.Error(writer, "missing auth", http.StatusUnauthorized)
			return
		}
		query, _ := url.QueryUnescape(request.URL.Query().Get("query"))
		queriesMu.Lock()
		queries = append(queries, query)
		queriesMu.Unlock()
		value := "2.5"
		if strings.Contains(query, "receive") {
			value = "12.5"
		}
		fmt.Fprintf(writer, `{"status":"success","data":{"resultType":"vector","result":[{"value":["0","%s"]}]}}`, value)
	}))
	defer server.Close()
	t.Setenv("PROMETHEUS_URL", server.URL)
	t.Setenv("PROMETHEUS_INSTANCE", "node-exporter:9100")
	t.Setenv("PROMETHEUS_BEARER_TOKEN", "test-token")
	t.Setenv("PROMETHEUS_NETWORK_DEVICE", "bond0")

	bandwidth := SampleNetworkBandwidth()
	if !bandwidth.Available || bandwidth.UpMbps != 2.5 || bandwidth.DownMbps != 12.5 {
		t.Fatalf("unexpected bandwidth sample: %+v", bandwidth)
	}
	if len(bandwidth.UpSeries) != 1 || len(bandwidth.DownSeries) != 1 {
		t.Fatalf("expected one sample in each series: %+v", bandwidth)
	}
	if len(queries) != 2 || !strings.Contains(queries[0], `device=~"bond0"`) {
		t.Fatalf("unexpected Prometheus queries: %v", queries)
	}
}

func TestQueryPrometheusRejectsInvalidBandwidthValues(t *testing.T) {
	testCases := []struct {
		name  string
		value string
	}{
		{name: "NaN", value: `"NaN"`},
		{name: "+Inf", value: `"+Inf"`},
		{name: "-Inf", value: `"-Inf"`},
		{name: "negative", value: `"-1"`},
		{name: "null", value: "null"},
	}
	for _, testCase := range testCases {
		t.Run(testCase.name, func(t *testing.T) {
			server := httptest.NewServer(http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
				fmt.Fprintf(writer, `{"status":"success","data":{"resultType":"vector","result":[{"value":["0",%s]}]}}`, testCase.value)
			}))
			defer server.Close()

			if got, ok := queryPrometheus(server.URL, "test"); ok {
				t.Fatalf("expected invalid value %q to be rejected, got %v", testCase.name, got)
			}
		})
	}
}
