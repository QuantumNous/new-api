package main

import (
	"log"
	"net/http"
	"os"
	"strings"
	"time"
)

type Config struct {
	ListenAddr    string
	NewAPIBaseURL string
}

func loadConfig() Config {
	listenAddr := strings.TrimSpace(os.Getenv("LISTEN_ADDR"))
	if listenAddr == "" {
		listenAddr = ":3001"
	}

	newAPIBaseURL := strings.TrimSpace(os.Getenv("NEWAPI_BASE_URL"))
	if newAPIBaseURL == "" {
		newAPIBaseURL = "http://new-api:3000"
	}

	return Config{
		ListenAddr:    listenAddr,
		NewAPIBaseURL: strings.TrimRight(newAPIBaseURL, "/"),
	}
}

func main() {
	cfg := loadConfig()
	srv := &http.Server{
		Addr:              cfg.ListenAddr,
		Handler:           newServer(cfg),
		ReadHeaderTimeout: 5 * time.Second,
	}

	log.Printf("seedance-compat listening on %s, upstream=%s", cfg.ListenAddr, cfg.NewAPIBaseURL)
	log.Fatal(srv.ListenAndServe())
}
