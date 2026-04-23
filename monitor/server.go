package monitor

import (
	"fmt"
	"log"
	"net/http"
	"os"
	"strconv"

	"github.com/prometheus/client_golang/prometheus/promhttp"
)

// StartMetricsServer starts a dedicated HTTP server for Prometheus metrics.
// It blocks, so call it in a goroutine.
func StartMetricsServer() {
	if !Enabled() {
		return
	}

	port := 9090
	if p := os.Getenv("PROMETHEUS_PORT"); p != "" {
		if v, err := strconv.Atoi(p); err == nil && v > 0 {
			port = v
		}
	}

	mux := http.NewServeMux()
	mux.Handle("/metrics", promhttp.Handler())

	addr := fmt.Sprintf(":%d", port)
	log.Printf("Prometheus metrics server listening on %s", addr)
	if err := http.ListenAndServe(addr, mux); err != nil {
		log.Printf("Prometheus metrics server error: %v", err)
	}
}
