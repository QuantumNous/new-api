// Command proxy is a transparent reverse proxy that records the prompts
// users submit to a new-api instance.
//
// It runs as a sidecar in front of new-api and never modifies new-api itself, so
// the upstream project can be upgraded by bumping its image tag. Auditing is
// asynchronous and, by default, fail-open: relay traffic is never delayed or
// rejected because of the audit path.
package main

import (
	"context"
	"errors"
	"flag"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"gorm.io/gorm"
)

func main() {
	configPath := flag.String("config", "/etc/proxy/config.yaml", "path to the configuration file")
	flag.Parse()

	log.SetFlags(log.LstdFlags | log.LUTC)

	cfg, err := LoadConfig(*configPath)
	if err != nil {
		log.Fatalf("proxy: %v", err)
	}
	cfg.LogEffective()

	var db *gorm.DB
	db, err = openDatabase(cfg.Database)
	if err != nil {
		// A missing table is a deployment mistake, not an outage, so fail_open does
		// not apply: starting anyway would spool every record to disk indefinitely
		// while the process looked healthy.
		if errors.Is(err, ErrSchemaMissing) {
			log.Fatalf("proxy: %v", err)
		}
		if !cfg.failOpen() {
			log.Fatalf("proxy: audit database unavailable and fail_open is false: %v", err)
		}
		// Spool-only mode: requests are still audited to disk, but replay cannot
		// start until a restart establishes the connection and runs AutoMigrate.
		log.Printf("proxy: audit database unavailable, recording to spool only: %v", err)
	}

	redactor, err := NewRedactor(cfg.Capture.RedactPatterns)
	if err != nil {
		log.Fatalf("proxy: %v", err)
	}

	store, err := NewStore(db, cfg.Store)
	if err != nil {
		log.Fatalf("proxy: %v", err)
	}
	store.Start()

	var identity *IdentityResolver
	if cfg.Identity.Enabled {
		if db == nil {
			log.Print("proxy: identity resolution disabled because the database is unavailable")
			cfg.Identity.Enabled = false
		} else {
			identity = NewIdentityResolver(db, cfg.Identity)
		}
	}

	proxy, err := NewProxy(cfg, store, identity, redactor)
	if err != nil {
		log.Fatalf("proxy: %v", err)
	}

	server := &http.Server{
		Addr:    cfg.Listen,
		Handler: proxy,
		// Read and write timeouts stay unset on purpose: relay requests can upload
		// large payloads and SSE responses can stream for minutes. Only the header
		// read is bounded, which is what protects against slowloris.
		ReadHeaderTimeout: 30 * time.Second,
	}

	go func() {
		log.Printf("proxy: listening on %s, forwarding to %s (fail_open=%t)", cfg.Listen, cfg.Upstream, cfg.failOpen())
		if err := server.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			log.Fatalf("proxy: listen on %s: %v", cfg.Listen, err)
		}
	}()

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	signalReceived := <-quit
	log.Printf("proxy: received %v, shutting down", signalReceived)

	// Streaming responses may still be in flight; drain them before stopping the
	// writer so their audit records are not lost.
	shutdownCtx, cancel := context.WithTimeout(context.Background(), 120*time.Second)
	defer cancel()
	if err := server.Shutdown(shutdownCtx); err != nil {
		log.Printf("proxy: forced shutdown: %v", err)
	}
	store.Close()
	log.Printf("proxy: stopped (%v)", store.Stats())
}
