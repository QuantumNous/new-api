package common

import (
	"bytes"
	"context"
	"encoding/json"
	"math"
	"net/http"
	"net/url"
	"os"
	"strconv"
	"strings"
	"sync"
	"time"
)

const networkSeriesLength = 12

type NetworkBandwidth struct {
	Available  bool
	UpMbps     float64
	DownMbps   float64
	UpSeries   []float64
	DownSeries []float64
}

type prometheusQueryResponse struct {
	Status string `json:"status"`
	Data   struct {
		ResultType string `json:"resultType"`
		Result     []struct {
			Value []json.RawMessage `json:"value"`
		} `json:"result"`
	} `json:"data"`
}

func SampleNetworkBandwidth() NetworkBandwidth {
	baseURL := strings.TrimRight(strings.TrimSpace(os.Getenv("PROMETHEUS_URL")), "/")
	instance := strings.TrimSpace(os.Getenv("PROMETHEUS_INSTANCE"))
	if baseURL == "" || instance == "" {
		return NetworkBandwidth{}
	}
	parsed, err := url.Parse(baseURL)
	if err != nil || (parsed.Scheme != "http" && parsed.Scheme != "https") || parsed.Host == "" {
		return NetworkBandwidth{}
	}

	device := strings.TrimSpace(os.Getenv("PROMETHEUS_NETWORK_DEVICE"))
	if device == "" || !validPrometheusMatcher(device) {
		return NetworkBandwidth{}
	}
	matcher := `device=~"` + device + `"`
	labels := `instance="` + escapePrometheusString(instance) + `",` + matcher
	queries := [2]string{
		`sum(rate(node_network_transmit_bytes_total{` + labels + `}[1m])) * 8 / 1000000`,
		`sum(rate(node_network_receive_bytes_total{` + labels + `}[1m])) * 8 / 1000000`,
	}

	var values [2]float64
	var wg sync.WaitGroup
	var valid [2]bool
	for i := range queries {
		wg.Add(1)
		go func(index int) {
			defer wg.Done()
			values[index], valid[index] = queryPrometheus(baseURL, queries[index])
		}(i)
	}
	wg.Wait()
	if !valid[0] || !valid[1] {
		return NetworkBandwidth{}
	}

	previous := GetSystemStatus().Network
	upSeries := appendSeries(previous.UpSeries, values[0])
	downSeries := appendSeries(previous.DownSeries, values[1])
	return NetworkBandwidth{
		Available: true,
		UpMbps:    values[0], DownMbps: values[1],
		UpSeries: upSeries, DownSeries: downSeries,
	}
}

func queryPrometheus(baseURL, query string) (float64, bool) {
	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
	defer cancel()
	requestURL := strings.TrimRight(baseURL, "/") + "/api/v1/query?query=" + url.QueryEscape(query)
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, requestURL, nil)
	if err != nil {
		return 0, false
	}
	if token := strings.TrimSpace(os.Getenv("PROMETHEUS_BEARER_TOKEN")); token != "" {
		req.Header.Set("Authorization", "Bearer "+token)
	}
	response, err := http.DefaultClient.Do(req)
	if err != nil {
		return 0, false
	}
	defer response.Body.Close()
	if response.StatusCode < 200 || response.StatusCode >= 300 {
		return 0, false
	}
	var payload prometheusQueryResponse
	if err := json.NewDecoder(response.Body).Decode(&payload); err != nil || payload.Status != "success" || len(payload.Data.Result) == 0 || len(payload.Data.Result[0].Value) < 2 {
		return 0, false
	}
	rawValue := bytes.TrimSpace(payload.Data.Result[0].Value[1])
	if len(rawValue) == 0 || bytes.Equal(rawValue, []byte("null")) {
		return 0, false
	}

	var value float64
	if rawValue[0] != '"' {
		if err := json.Unmarshal(rawValue, &value); err == nil {
			return value, validNetworkValue(value)
		}
	}

	var raw string
	if err := json.Unmarshal(rawValue, &raw); err != nil {
		return 0, false
	}
	value, err = strconv.ParseFloat(raw, 64)
	if err != nil || !validNetworkValue(value) {
		return 0, false
	}
	return value, true
}

func validNetworkValue(value float64) bool {
	return !math.IsNaN(value) && !math.IsInf(value, 0) && value >= 0
}

func appendSeries(series []float64, value float64) []float64 {
	result := append([]float64(nil), series...)
	result = append(result, value)
	if len(result) > networkSeriesLength {
		result = result[len(result)-networkSeriesLength:]
	}
	return result
}

func validPrometheusMatcher(value string) bool {
	for _, char := range value {
		if (char >= 'a' && char <= 'z') || (char >= 'A' && char <= 'Z') || (char >= '0' && char <= '9') || strings.ContainsRune("._*|:+-", char) {
			continue
		}
		return false
	}
	return true
}

func escapePrometheusString(value string) string {
	value = strings.ReplaceAll(value, `\`, `\\`)
	return strings.ReplaceAll(value, `"`, `\"`)
}
