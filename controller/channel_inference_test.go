package controller

import (
	"context"
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/service"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestVLLMStatusPartialFailureAndCredentials(t *testing.T) {
	service.InitHttpClient()
	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		assert.Equal(t, http.MethodGet, r.Method)
		assert.Equal(t, "Bearer test-vllm-key", r.Header.Get("Authorization"))
		assert.Equal(t, "status-panel", r.Header.Get("X-Source"))
		switch r.URL.Path {
		case "/prefix/health":
			w.WriteHeader(http.StatusOK)
		case "/prefix/version":
			_, _ = w.Write([]byte(`{"version":"0.25.2"}`))
		case "/prefix/v1/models":
			_, _ = w.Write([]byte(`{"data":[{"id":"served-model","root":"source/model","max_model_len":1048576}]}`))
		case "/prefix/metrics":
			http.Error(w, "test-vllm-key should not reach the browser", http.StatusForbidden)
		default:
			t.Errorf("unexpected path: %s", r.URL.Path)
			w.WriteHeader(http.StatusNotFound)
		}
	}))
	defer upstream.Close()
	base := upstream.URL + "/prefix/"
	override := `{"X-Source":"status-panel"}`
	channel := &model.Channel{Type: constant.ChannelTypeVLLM, BaseURL: &base, Key: "test-vllm-key", HeaderOverride: &override}
	status, err := fetchInferenceStatus(context.Background(), channel)
	require.NoError(t, err)
	assert.Equal(t, 200, status.Endpoints["/health"].Status)
	assert.Equal(t, "0.25.2", status.Version)
	require.Len(t, status.Models, 1)
	assert.Equal(t, "source/model", status.Models[0].Root)
	require.NotNil(t, status.Models[0].MaxModelLen)
	assert.EqualValues(t, 1048576, *status.Models[0].MaxModelLen)
	assert.Equal(t, inferenceEndpointStatus{Status: 403, Error: "http_error"}, status.Endpoints["/metrics"])
	assert.Empty(t, status.RawMetrics)
	assert.Empty(t, status.Metrics)
	body, err := common.Marshal(status)
	require.NoError(t, err)
	assert.NotContains(t, string(body), channel.Key)
}

func TestInferenceStatusRejectsInvalidTargetsAndRedirects(t *testing.T) {
	service.InitHttpClient()
	_, err := fetchInferenceStatus(context.Background(), &model.Channel{Type: constant.ChannelTypeOllama})
	require.Error(t, err)
	target := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		t.Error("redirect must not forward channel credentials")
	}))
	defer target.Close()
	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		assert.Empty(t, r.Header.Get("Authorization"))
		http.Redirect(w, r, target.URL, http.StatusFound)
	}))
	defer upstream.Close()
	for _, channelType := range []int{constant.ChannelTypeVLLM, constant.ChannelTypeSGLang, constant.ChannelTypeTensorFold} {
		t.Run(constant.GetChannelTypeName(channelType), func(t *testing.T) {
			for _, base := range []string{"", "file:///etc/passwd", "http://user:secret@localhost", "http://localhost?key=secret"} {
				_, err := fetchInferenceStatus(context.Background(), &model.Channel{Type: channelType, BaseURL: &base})
				require.Error(t, err)
				assert.NotContains(t, err.Error(), "secret")
			}
			status, err := fetchInferenceStatus(context.Background(), &model.Channel{Type: channelType, BaseURL: &upstream.URL, Key: "EMPTY"})
			require.NoError(t, err)
			for _, endpoint := range status.Endpoints {
				assert.Equal(t, inferenceEndpointStatus{Status: 302, Error: "http_error"}, endpoint)
			}
		})
	}
}

func TestVLLMStatusInvalidAndOversizedResponses(t *testing.T) {
	service.InitHttpClient()
	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.URL.Path {
		case "/health":
			w.WriteHeader(http.StatusServiceUnavailable)
		case "/version":
			_, _ = w.Write([]byte(`{"version":false}`))
		case "/v1/models":
			_, _ = w.Write([]byte(`{"data":[]}`))
		case "/metrics":
			_, _ = w.Write([]byte(strings.Repeat(" ", (4<<20)+1)))
		}
	}))
	defer upstream.Close()
	channel := &model.Channel{Type: constant.ChannelTypeVLLM, BaseURL: &upstream.URL, Key: "EMPTY"}
	status, err := fetchInferenceStatus(context.Background(), channel)
	require.NoError(t, err)
	assert.Equal(t, 503, status.Endpoints["/health"].Status)
	assert.Equal(t, "invalid_response", status.Endpoints["/version"].Error)
	assert.Empty(t, status.Endpoints["/v1/models"].Error)
	assert.Equal(t, "response_too_large", status.Endpoints["/metrics"].Error)
	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	_, err = fetchInferenceStatus(ctx, channel)
	assert.ErrorIs(t, err, context.Canceled)
}

func TestParseVLLMMetricsPreservesSeriesAndHistogramTotals(t *testing.T) {
	metrics, err := parseInferenceMetrics(`# TYPE vllm:num_requests_running gauge
vllm:num_requests_running{engine="0",model_name="model,a"} 0
vllm:num_requests_running{model_name="model,a",engine="1"} 2
# TYPE vllm:time_to_first_token_seconds histogram
vllm:time_to_first_token_seconds_bucket{le="+Inf"} 4
vllm:time_to_first_token_seconds_sum 10
vllm:time_to_first_token_seconds_count 4
# TYPE vllm:kv_cache_usage_perc gauge
vllm:kv_cache_usage_perc NaN
vllm:bad_value +Inf
# TYPE process_start_time_seconds gauge
process_start_time_seconds 100
unrelated_metric 123
`, "vllm:")
	require.NoError(t, err)
	assert.ElementsMatch(t, []inferenceMetric{
		{Name: "vllm:num_requests_running", Labels: map[string]string{"engine": "0", "model_name": "model,a"}, Value: 0},
		{Name: "vllm:num_requests_running", Labels: map[string]string{"engine": "1", "model_name": "model,a"}, Value: 2},
		{Name: "vllm:time_to_first_token_seconds_sum", Labels: map[string]string{}, Value: 10},
		{Name: "vllm:time_to_first_token_seconds_count", Labels: map[string]string{}, Value: 4},
		{Name: "process_start_time_seconds", Labels: map[string]string{}, Value: 100},
	}, metrics)
	_, err = parseInferenceMetrics("vllm:broken{engine=oops} 1\n", "vllm:")
	require.Error(t, err)
}

func TestTensorFoldStatusUsesNativeEndpointsAndPreservesPartialResults(t *testing.T) {
	service.InitHttpClient()
	const metrics = `# TYPE tensorfold:requests_running gauge
tensorfold:requests_running 0
# TYPE tensorfold:kv_cache_usage_ratio gauge
tensorfold:kv_cache_usage_ratio{pool="0"} 0.25
tensorfold:kv_cache_usage_ratio{pool="1"} 0.5
# TYPE tensorfold:request_latency_seconds histogram
tensorfold:request_latency_seconds_bucket{le="+Inf"} 2
tensorfold:request_latency_seconds_sum 6
tensorfold:request_latency_seconds_count 2
vllm:num_requests_running 99
`
	for _, test := range []struct {
		name          string
		key           string
		health        string
		metrics       string
		metricsStatus int
		healthError   string
		metricsError  string
	}{
		{name: "authenticated minimal health", key: "test-key", health: `{"status":"ok"}`, metrics: metrics, metricsStatus: 200},
		{name: "open health details stay private", key: "EMPTY", health: `{"status":"ok","model":"private-model","live":{"private":"private-state"}}`, metrics: metrics, metricsStatus: 200},
		{name: "metrics unavailable", key: "test-key", health: `{"status":"ok"}`, metrics: "test-key upstream error", metricsStatus: 403, metricsError: "http_error"},
		{name: "invalid health", key: "test-key", health: `{}`, metrics: metrics, metricsStatus: 200, healthError: "invalid_response"},
		{name: "invalid metrics", key: "test-key", health: `{"status":"ok"}`, metrics: `tensorfold:broken{pool=oops} 1`, metricsStatus: 200, metricsError: "invalid_response"},
	} {
		t.Run(test.name, func(t *testing.T) {
			upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				assert.Equal(t, http.MethodGet, r.Method)
				if test.key == "EMPTY" {
					assert.Empty(t, r.Header.Get("Authorization"))
				} else {
					assert.Equal(t, "Bearer "+test.key, r.Header.Get("Authorization"))
				}
				switch r.URL.Path {
				case "/prefix/health":
					_, _ = w.Write([]byte(test.health))
				case "/prefix/v1/models":
					_, _ = w.Write([]byte(`{"data":[{"id":"served-model","owned_by":"tensorfold"}]}`))
				case "/prefix/metrics":
					w.WriteHeader(test.metricsStatus)
					_, _ = w.Write([]byte(test.metrics))
				default:
					t.Errorf("unexpected TensorFold path: %s", r.URL.Path)
					w.WriteHeader(http.StatusNotFound)
				}
			}))
			t.Cleanup(upstream.Close)
			channel := &model.Channel{Type: constant.ChannelTypeTensorFold, BaseURL: common.GetPointer(upstream.URL + "/prefix/"), Key: test.key}
			status, err := fetchInferenceStatus(context.Background(), channel)
			require.NoError(t, err)
			assert.Equal(t, map[string]inferenceEndpointStatus{
				"/health":    {Status: 200, Error: test.healthError},
				"/v1/models": {Status: 200},
				"/metrics":   {Status: test.metricsStatus, Error: test.metricsError},
			}, status.Endpoints)
			assert.Empty(t, status.Version)
			assert.Equal(t, []inferenceModel{{ID: "served-model"}}, status.Models)
			if test.metricsError != "" {
				assert.Empty(t, status.Metrics)
				assert.Empty(t, status.RawMetrics)
			} else {
				assert.Equal(t, metrics, status.RawMetrics)
				assert.ElementsMatch(t, []inferenceMetric{
					{Name: "tensorfold:requests_running", Labels: map[string]string{}, Value: 0},
					{Name: "tensorfold:kv_cache_usage_ratio", Labels: map[string]string{"pool": "0"}, Value: 0.25},
					{Name: "tensorfold:kv_cache_usage_ratio", Labels: map[string]string{"pool": "1"}, Value: 0.5},
					{Name: "tensorfold:request_latency_seconds_sum", Labels: map[string]string{}, Value: 6},
					{Name: "tensorfold:request_latency_seconds_count", Labels: map[string]string{}, Value: 2},
				}, status.Metrics)
			}
			encoded, err := common.Marshal(status)
			require.NoError(t, err)
			for _, secret := range []string{"test-key", "private-model", "private-state"} {
				assert.NotContains(t, string(encoded), secret)
			}
		})
	}
}

// Opt-in verification against an operator-provided instance; credentials stay in the environment.
func TestVLLMStatusLive(t *testing.T) {
	base := os.Getenv("NEW_API_VLLM_TEST_URL")
	if base == "" {
		t.Skip("NEW_API_VLLM_TEST_URL is not configured")
	}
	service.InitHttpClient()
	status, err := fetchInferenceStatus(context.Background(), &model.Channel{
		Type: constant.ChannelTypeVLLM, BaseURL: &base, Key: os.Getenv("NEW_API_VLLM_TEST_KEY"),
	})
	require.NoError(t, err)
	for path, endpoint := range status.Endpoints {
		assert.Equal(t, 200, endpoint.Status, path)
		assert.Empty(t, endpoint.Error, path)
	}
	assert.NotEmpty(t, status.Version)
	assert.NotEmpty(t, status.Models)
	assert.NotEmpty(t, status.Metrics)
	assert.NotEmpty(t, status.RawMetrics)
}

func TestSGLangStatusUsesDocumentedEndpointsAndRedactsServerConfiguration(t *testing.T) {
	service.InitHttpClient()
	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		assert.Equal(t, http.MethodGet, r.Method)
		assert.Equal(t, "Bearer test-key", r.Header.Get("Authorization"))
		switch r.URL.Path {
		case "/health":
			w.WriteHeader(http.StatusOK)
		case "/server_info":
			_, _ = w.Write([]byte(`{"version":"0.5.19","api_key":"server-secret","admin_api_key":"admin-secret","internal_states":[{"private":"private-state"}]}`))
		case "/v1/models":
			_, _ = w.Write([]byte(`{"data":[{"id":"served-model","root":"served-model","max_model_len":32768}]}`))
		case "/metrics":
			_, _ = w.Write([]byte("# TYPE sglang:num_running_reqs gauge\nsglang:num_running_reqs{dp_rank=\"0\"} 0\nsglang:num_running_reqs{dp_rank=\"1\"} 2\n# TYPE sglang:time_to_first_token_seconds histogram\nsglang:time_to_first_token_seconds_bucket{le=\"+Inf\"} 2\nsglang:time_to_first_token_seconds_sum 1.5\nsglang:time_to_first_token_seconds_count 2\nvllm:num_requests_running 9\n"))
		default:
			t.Errorf("unexpected SGLang path: %s", r.URL.Path)
			w.WriteHeader(http.StatusNotFound)
		}
	}))
	defer upstream.Close()
	status, err := fetchInferenceStatus(context.Background(), &model.Channel{Type: constant.ChannelTypeSGLang, BaseURL: &upstream.URL, Key: "test-key"})
	require.NoError(t, err)
	assert.Equal(t, "0.5.19", status.Version)
	require.Len(t, status.Models, 1)
	assert.Equal(t, "served-model", status.Models[0].ID)
	assert.ElementsMatch(t, []inferenceMetric{
		{Name: "sglang:num_running_reqs", Labels: map[string]string{"dp_rank": "0"}, Value: 0},
		{Name: "sglang:num_running_reqs", Labels: map[string]string{"dp_rank": "1"}, Value: 2},
		{Name: "sglang:time_to_first_token_seconds_sum", Labels: map[string]string{}, Value: 1.5},
		{Name: "sglang:time_to_first_token_seconds_count", Labels: map[string]string{}, Value: 2},
	}, status.Metrics)
	encoded, err := common.Marshal(status)
	require.NoError(t, err)
	for _, secret := range []string{"test-key", "server-secret", "admin-secret", "private-state", "api_key", "internal_states"} {
		assert.NotContains(t, string(encoded), secret)
	}
}
