package metrics

import (
	"fmt"
	"net/http"
	"sort"
	"strconv"
	"sync"
)

type key struct {
	route  string
	status int
}

type Registry struct {
	mu       sync.RWMutex
	requests map[key]uint64
}

func New() *Registry {
	return &Registry{requests: make(map[key]uint64)}
}

func (registry *Registry) ObserveHTTP(route string, status int) {
	registry.mu.Lock()
	registry.requests[key{route: route, status: status}]++
	registry.mu.Unlock()
}

func (registry *Registry) Handler() http.Handler {
	return http.HandlerFunc(func(writer http.ResponseWriter, _ *http.Request) {
		writer.Header().Set("Content-Type", "text/plain; version=0.0.4")
		registry.mu.RLock()
		keys := make([]key, 0, len(registry.requests))
		for metric := range registry.requests {
			keys = append(keys, metric)
		}
		sort.Slice(keys, func(left, right int) bool {
			if keys[left].route != keys[right].route {
				return keys[left].route < keys[right].route
			}
			return keys[left].status < keys[right].status
		})
		counts := make([]uint64, len(keys))
		for index, metric := range keys {
			counts[index] = registry.requests[metric]
		}
		registry.mu.RUnlock()

		_, _ = fmt.Fprintln(
			writer,
			"# HELP smart_router_http_requests_total HTTP requests handled by the router.",
		)
		_, _ = fmt.Fprintln(writer, "# TYPE smart_router_http_requests_total counter")
		for index, metric := range keys {
			_, _ = fmt.Fprintf(
				writer,
				"smart_router_http_requests_total{route=%s,status=%s} %d\n",
				strconv.Quote(metric.route),
				strconv.Quote(strconv.Itoa(metric.status)),
				counts[index],
			)
		}
	})
}
