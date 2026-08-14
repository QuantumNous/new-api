package observability

import (
	"fmt"
	"log/slog"
	"net/http"
	"os"
	"sort"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/QuantumNous/new-api/wechat-epay-adapter/internal/store"
)

type Metrics struct {
	store    *store.Store
	mu       sync.Mutex
	requests map[requestMetricKey]requestMetric
}

type requestMetricKey struct {
	Route  string
	Method string
	Status int
}

type requestMetric struct {
	Count      uint64
	DurationNS uint64
}

type Logger struct {
	logger *slog.Logger
}

func NewMetrics(database *store.Store) *Metrics {
	return &Metrics{store: database, requests: make(map[requestMetricKey]requestMetric)}
}

func NewLogger(level string) *Logger {
	parsed := new(slog.LevelVar)
	if err := parsed.UnmarshalText([]byte(level)); err != nil {
		parsed.Set(slog.LevelInfo)
	}
	return &Logger{logger: slog.New(slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{Level: parsed}))}
}

func (m *Metrics) ObserveRequest(route, method string, status int, duration time.Duration) {
	if route == "" {
		route = "unmatched"
	}
	key := requestMetricKey{Route: route, Method: method, Status: status}
	m.mu.Lock()
	metric := m.requests[key]
	metric.Count++
	metric.DurationNS += uint64(duration)
	m.requests[key] = metric
	m.mu.Unlock()
}

func (l *Logger) LogRequest(requestID, method, route string, status int, duration time.Duration) {
	l.logger.Info("http request completed",
		slog.String("request_id", requestID),
		slog.String("method", method),
		slog.String("route", route),
		slog.Int("status", status),
		slog.Int64("duration_ms", duration.Milliseconds()),
	)
}

func (m *Metrics) ServeHTTP(writer http.ResponseWriter, _ *http.Request) {
	orderCounts, taskCounts, err := m.store.StateCounts()
	if err != nil {
		http.Error(writer, "metrics unavailable", http.StatusServiceUnavailable)
		return
	}
	writer.Header().Set("Content-Type", "text/plain; version=0.0.4; charset=utf-8")
	var output strings.Builder
	output.WriteString("# HELP payment_order_state Number of payment orders by state.\n# TYPE payment_order_state gauge\n")
	for _, count := range orderCounts {
		fmt.Fprintf(&output, "payment_order_state{state=%q} %d\n", count.State, count.Count)
	}
	output.WriteString("# HELP notification_tasks_pending Number of notification tasks by state.\n# TYPE notification_tasks_pending gauge\n")
	for _, count := range taskCounts {
		fmt.Fprintf(&output, "notification_tasks_pending{state=%q} %d\n", count.State, count.Count)
	}
	output.WriteString("# HELP http_request_duration_seconds HTTP request duration.\n# TYPE http_request_duration_seconds summary\n")
	m.mu.Lock()
	keys := make([]requestMetricKey, 0, len(m.requests))
	for key := range m.requests {
		keys = append(keys, key)
	}
	sort.Slice(keys, func(i, j int) bool {
		return keys[i].Route+keys[i].Method+strconv.Itoa(keys[i].Status) < keys[j].Route+keys[j].Method+strconv.Itoa(keys[j].Status)
	})
	for _, key := range keys {
		metric := m.requests[key]
		labels := fmt.Sprintf("route=%q,method=%q,status=%q", key.Route, key.Method, strconv.Itoa(key.Status))
		fmt.Fprintf(&output, "http_request_duration_seconds_sum{%s} %.9f\n", labels, float64(metric.DurationNS)/float64(time.Second))
		fmt.Fprintf(&output, "http_request_duration_seconds_count{%s} %d\n", labels, metric.Count)
	}
	m.mu.Unlock()
	_, _ = writer.Write([]byte(output.String()))
}
