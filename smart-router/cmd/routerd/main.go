package main

import (
	"context"
	"io"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"smart-router/api"
	"smart-router/config"
	"smart-router/internal/catalog"
	"smart-router/metrics"
	"smart-router/store"
)

func main() {
	configuration, err := config.Load(os.Getenv)
	if err != nil {
		log.Fatal(err)
	}
	handler, closer, err := build(context.Background(), configuration)
	if err != nil {
		log.Fatal(err)
	}
	defer func() { _ = closer.Close() }()

	server := &http.Server{
		Addr:              configuration.ListenAddress,
		Handler:           handler,
		ReadHeaderTimeout: 5 * time.Second,
		ReadTimeout:       15 * time.Second,
		WriteTimeout:      30 * time.Second,
		IdleTimeout:       60 * time.Second,
	}
	shutdownContext, stop := signal.NotifyContext(
		context.Background(), os.Interrupt, syscall.SIGTERM,
	)
	defer stop()
	go func() {
		<-shutdownContext.Done()
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()
		_ = server.Shutdown(ctx)
	}()

	log.Printf("routerd listening on %s", configuration.ListenAddress)
	if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
		log.Fatal(err)
	}
}

func build(ctx context.Context, configuration config.Config) (http.Handler, io.Closer, error) {
	configHash, pluginHash, err := configuration.PublicHashes()
	if err != nil {
		return nil, nil, err
	}
	database, err := store.OpenSQLite(ctx, configuration.DatabasePath)
	if err != nil {
		return nil, nil, err
	}
	runtime := catalog.NewRuntime(catalog.RuntimeConfig{
		Store: database, SigningKey: configuration.SigningKey, Now: time.Now,
		SnapshotTTL:          configuration.SnapshotTTL,
		HysteresisMicrounits: configuration.HysteresisMicrounits,
		ConfigSHA256:         configHash, PluginManifestSHA256: pluginHash,
	})
	return api.NewServer(runtime, metrics.New()), database, nil
}
