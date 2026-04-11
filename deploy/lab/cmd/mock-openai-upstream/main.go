package main

import (
	"errors"
	"flag"
	"log"
	"net/http"
	"time"

	"github.com/QuantumNous/new-api/deploy/lab/governorlab"
)

func main() {
	listenAddr := flag.String("listen", ":8080", "listen address")
	delayMS := flag.Int("delay-ms", 1500, "response delay in milliseconds")
	responseText := flag.String("response-text", "ok", "mock assistant response text")
	models := flag.String("models", "gpt-4o-mini", "comma-separated supported model list")
	flag.Parse()

	handler := governorlab.NewMockHandler(governorlab.MockConfig{
		Delay:        time.Duration(*delayMS) * time.Millisecond,
		ResponseText: *responseText,
		Models:       governorlab.SplitCSV(*models),
	})

	server := &http.Server{
		Addr:    *listenAddr,
		Handler: handler,
	}

	log.Printf("mock OpenAI upstream listening on %s (delay=%dms, models=%s)", *listenAddr, *delayMS, *models)
	if err := server.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
		log.Fatal(err)
	}
}
