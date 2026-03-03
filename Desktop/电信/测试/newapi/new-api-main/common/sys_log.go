package common

import (
	"fmt"
	"os"
	"time"

	"github.com/gin-gonic/gin"
)

func SysLog(s string) {
	t := time.Now()
	_, _ = fmt.Fprintf(gin.DefaultWriter, "[SYS] %v | %s \n", t.Format("2006/01/02 - 15:04:05"), s)
}

func SysError(s string) {
	t := time.Now()
	_, _ = fmt.Fprintf(gin.DefaultErrorWriter, "[SYS] %v | %s \n", t.Format("2006/01/02 - 15:04:05"), s)
}

func FatalLog(v ...any) {
	t := time.Now()
	_, _ = fmt.Fprintf(gin.DefaultErrorWriter, "[FATAL] %v | %v \n", t.Format("2006/01/02 - 15:04:05"), v)
	os.Exit(1)
}

func LogStartupSuccess(startTime time.Time, port string) {

	duration := time.Since(startTime)
	durationMs := duration.Milliseconds()

	// Get network IPs
	networkIps := GetNetworkIps()

	// Print blank line for spacing
	fmt.Fprintf(gin.DefaultWriter, "\n")

	// Print the main success message
	fmt.Fprintf(gin.DefaultWriter, "  \033[32m%s %s\033[0m  ready in %d ms\n", SystemName, Version, durationMs)
	fmt.Fprintf(gin.DefaultWriter, "\n")

	// Skip fancy startup message in container environments
	if !IsRunningInContainer() {
		// Print local URL
		fmt.Fprintf(gin.DefaultWriter, "  ➜  \033[1mLocal:\033[0m   http://localhost:%s/\n", port)
	}

	// Print network URLs
	for _, ip := range networkIps {
		fmt.Fprintf(gin.DefaultWriter, "  ➜  \033[1mNetwork:\033[0m http://%s:%s/\n", ip, port)
	}

	// Print blank line for spacing
	fmt.Fprintf(gin.DefaultWriter, "\n")
}
