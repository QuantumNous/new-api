package main

import (
	"context"
	"errors"
	"io"
	"log"
	"net"
	"net/http"
	"os"
	"os/signal"
	"smart-router/config"
	"smart-router/modeltrace"
	"smart-router/modeltraceapi"
	"smart-router/store"
	"sync"
	"syscall"
	"time"
)

var openStore = store.OpenSQLite
var releasePythonSHA256, releaseRuntimeSHA256, releaseVendorSHA256 string

type owner struct {
	server *modeltraceapi.Server
	db     *store.DB
	lock   *os.File
	mu     sync.Mutex
	closed bool
	err    error
}

func (o *owner) Close() error {
	ctx, cancel := context.WithTimeout(context.Background(), 20*time.Second)
	defer cancel()
	return o.Shutdown(ctx)
}

func (o *owner) Shutdown(ctx context.Context) error {
	o.mu.Lock()
	defer o.mu.Unlock()
	if o.closed {
		return o.err
	}
	if err := o.server.Shutdown(ctx); err != nil {
		// Do not close persistence while an owned handler may still be using it.
		return err
	}
	o.err = errors.Join(o.db.Close(), o.lock.Close())
	o.closed = true
	return o.err
}

type backend struct {
	modeltrace.Service
	*store.DB
}

func build(ctx context.Context, configuration config.ModelTraceConfig) (*modeltraceapi.Server, io.Closer, error) {
	if !configuration.Enabled {
		return nil, nil, nil
	}
	if len(configuration.IngestKey) < 32 || len(configuration.IngestKey) > 4096 {
		return nil, nil, config.ErrModelTraceConfig
	}
	engine, err := modeltrace.NewProcessEngine(configuration.Process)
	if err != nil {
		return nil, nil, config.ErrModelTraceConfig
	}
	metadata, err := configuration.Metadata()
	if err != nil {
		return nil, nil, config.ErrModelTraceConfig
	}
	lock, err := config.AcquireModelTraceDatabase(configuration.DatabasePath)
	if err != nil {
		return nil, nil, config.ErrModelTraceConfig
	}
	opened, statErr := os.Lstat(configuration.DatabasePath)
	if statErr != nil {
		_ = lock.Close()
		return nil, nil, modeltrace.ErrProbeStorage
	}
	db, err := openStore(ctx, configuration.DatabasePath)
	if err != nil {
		_ = lock.Close()
		return nil, nil, modeltrace.ErrProbeStorage
	}
	fail := func() (*modeltraceapi.Server, io.Closer, error) {
		_ = db.Close()
		_ = lock.Close()
		return nil, nil, modeltrace.ErrProbeStorage
	}
	current, pathErr := os.Lstat(configuration.DatabasePath)
	if statErr != nil || pathErr != nil || !os.SameFile(opened, current) ||
		config.ValidateModelTraceDatabase(configuration.DatabasePath) != nil ||
		db.RecoverInterrupted(ctx, time.Now()) != nil {
		return fail()
	}
	handler, err := modeltraceapi.NewServer(modeltraceapi.Options{
		Backend: backend{modeltrace.Service{Repository: db, Engine: engine}, db},
		Key:     configuration.IngestKey,
		Health: modeltraceapi.Health{StartupBankRevision: metadata.StartupBankRevision,
			RuntimeManifestRevision: metadata.RuntimeManifestRevision,
			WorkerPayloadSHA256:     metadata.WorkerPayloadSHA256, PublicConfigSHA256: metadata.PublicConfigSHA256},
	})
	if err != nil {
		return fail()
	}
	return handler, &owner{server: handler, db: db, lock: lock}, nil
}

func run(ctx context.Context, lookup func(string) string, pins config.ModelTracePins, stderr io.Writer) int {
	fail := func(code string) int {
		_, _ = io.WriteString(stderr, "modeltrace: "+code+"\n")
		return 1
	}
	configuration, err := config.LoadModelTrace(lookup, pins)
	if err != nil {
		return fail("configuration_invalid")
	}
	if !configuration.Enabled {
		return 0
	}
	handler, closer, err := build(ctx, configuration)
	if err != nil {
		return fail("startup_failed")
	}
	defer closer.Close()
	listener, err := net.Listen("tcp", configuration.ListenAddress)
	if err != nil {
		return fail("listen_failed")
	}
	server := &http.Server{Handler: handler, ReadHeaderTimeout: 3 * time.Second, ReadTimeout: 5 * time.Second,
		WriteTimeout: 30 * time.Second, IdleTimeout: 5 * time.Second, MaxHeaderBytes: 8 << 10,
		ErrorLog: log.New(io.Discard, "", 0)}
	done := make(chan error, 1)
	go func() { done <- server.Serve(listener) }()
	select {
	case <-ctx.Done():
	case err := <-done:
		if !errors.Is(err, http.ErrServerClosed) {
			return fail("listen_failed")
		}
		return 0
	}
	handler.StopAdmission()
	drain, cancel := context.WithTimeout(context.Background(), 20*time.Second)
	defer cancel()
	shutdownErr := closer.(*owner).Shutdown(drain)
	httpErr := server.Shutdown(drain)
	if httpErr != nil {
		_ = server.Close()
	}
	if err := <-done; !errors.Is(err, http.ErrServerClosed) || shutdownErr != nil {
		return fail("shutdown_failed")
	}
	return 0
}

func main() {
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()
	os.Exit(run(ctx, os.Getenv, config.ModelTracePins{PythonSHA256: releasePythonSHA256,
		RuntimeManifestSHA256: releaseRuntimeSHA256, VendorManifestSHA256: releaseVendorSHA256}, os.Stderr))
}
