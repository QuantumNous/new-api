package main

import (
	"context"
	"errors"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/QuantumNous/new-api/wechat-epay-adapter/internal/config"
	"github.com/QuantumNous/new-api/wechat-epay-adapter/internal/database"
	"github.com/QuantumNous/new-api/wechat-epay-adapter/internal/delivery"
	"github.com/QuantumNous/new-api/wechat-epay-adapter/internal/httpserver"
	"github.com/QuantumNous/new-api/wechat-epay-adapter/internal/observability"
	"github.com/QuantumNous/new-api/wechat-epay-adapter/internal/order"
	"github.com/QuantumNous/new-api/wechat-epay-adapter/internal/store"
	"github.com/QuantumNous/new-api/wechat-epay-adapter/internal/wechat"
	"github.com/QuantumNous/new-api/wechat-epay-adapter/migrations"
)

func main() {
	if err := run(); err != nil {
		log.Printf("adapter startup failed: %v", err)
		os.Exit(1)
	}
}

func run() error {
	appConfig, err := config.Load()
	if err != nil {
		return err
	}
	db, err := database.Open(appConfig)
	if err != nil {
		return err
	}
	if err := migrations.ApplyInitial(db); err != nil {
		return err
	}
	wechatClient, err := wechat.NewSDKClient(context.Background(), appConfig)
	if err != nil {
		return err
	}
	databaseStore := store.New(db)
	metrics := observability.NewMetrics(databaseStore)
	logger := observability.NewLogger(appConfig.LogLevel)
	router := httpserver.New(db, httpserver.SecurityOptions{TrustedProxies: appConfig.TrustedProxyCIDRs, RequestObserver: metrics, RequestLogger: logger})
	if err := httpserver.RegisterSubmitRoute(router, databaseStore, appConfig, wechatClient); err != nil {
		return err
	}
	httpserver.RegisterMetricsRoute(router, metrics, appConfig.MetricsAPIToken)

	server := &http.Server{
		Addr:              appConfig.ListenAddr,
		Handler:           router,
		ReadHeaderTimeout: 5 * time.Second,
		ReadTimeout:       15 * time.Second,
		WriteTimeout:      15 * time.Second,
		IdleTimeout:       60 * time.Second,
	}
	shutdownContext, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()
	for workerNumber := 0; workerNumber < appConfig.NotificationWorkers; workerNumber++ {
		worker := delivery.NewWorker(databaseStore, appConfig, fmt.Sprintf("notification-worker-%d", workerNumber+1), nil)
		go worker.Run(shutdownContext)
	}
	go order.NewRecoveryScheduler(databaseStore, order.NewNativeOrderService(databaseStore, wechatClient)).Run(shutdownContext)

	errChan := make(chan error, 1)
	go func() {
		errChan <- server.ListenAndServe()
	}()

	select {
	case err := <-errChan:
		if errors.Is(err, http.ErrServerClosed) {
			return nil
		}
		return err
	case <-shutdownContext.Done():
		context, cancel := context.WithTimeout(context.Background(), 15*time.Second)
		defer cancel()
		return server.Shutdown(context)
	}
}
