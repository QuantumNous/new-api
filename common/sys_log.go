package common

import (
	"fmt"
	"os"
	"time"

	"github.com/phuslu/log"
)

func SysLog(s string) {
	log.Info().Msg(s)
}

func SysError(s string) {
	log.Error().Msg(s)
}

func FatalLog(v ...any) {
	log.Error().Msgf("%v", v)
	os.Exit(1)
}

func LogStartupSuccess(startTime time.Time, port string) {

	duration := time.Since(startTime)
	durationMs := duration.Milliseconds()

	// Get network IPs
	networkIps := GetNetworkIps()

	// Print blank line for spacing
	fmt.Fprintf(os.Stdout, "\n")

	// Print the main success message
	fmt.Fprintf(os.Stdout, "  \033[32m%s %s\033[0m  ready in %d ms\n", SystemName, Version, durationMs)
	fmt.Fprintf(os.Stdout, "\n")

	// Skip fancy startup message in container environments
	if !IsRunningInContainer() {
		// Print local URL
		fmt.Fprintf(os.Stdout, "  ➜  \033[1mLocal:\033[0m   http://localhost:%s/\n", port)
	}

	// Print network URLs
	for _, ip := range networkIps {
		fmt.Fprintf(os.Stdout, "  ➜  \033[1mNetwork:\033[0m http://%s:%s/\n", ip, port)
	}

	// Print blank line for spacing
	fmt.Fprintf(os.Stdout, "\n")
}
