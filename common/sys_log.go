package common

import (
	"fmt"
	"io"
	"os"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
)

// LogWriterMu protects concurrent access to gin.DefaultWriter/gin.DefaultErrorWriter
// during log file rotation. Acquire RLock when reading/writing through the writers,
// acquire Lock when swapping writers and closing old files.
var LogWriterMu sync.RWMutex

// LogWriter and ErrorLogWriter write to gin.DefaultWriter and
// gin.DefaultErrorWriter as they are at write time. Middleware that keeps its
// writer from startup, such as the gin access logger and panic recovery, must
// use them: log rotation swaps the gin writers and closes the old log file.
var (
	LogWriter      io.Writer = currentLogWriter{}
	ErrorLogWriter io.Writer = currentLogWriter{errorStream: true}
)

type currentLogWriter struct {
	errorStream bool
}

func (w currentLogWriter) Write(p []byte) (int, error) {
	LogWriterMu.RLock()
	defer LogWriterMu.RUnlock()
	if w.errorStream {
		return gin.DefaultErrorWriter.Write(p)
	}
	return gin.DefaultWriter.Write(p)
}

func SysLog(s string) {
	t := time.Now()
	LogWriterMu.RLock()
	_, _ = fmt.Fprintf(gin.DefaultWriter, "[SYS] %v | %s \n", t.Format("2006/01/02 - 15:04:05"), s)
	LogWriterMu.RUnlock()
}

func SysError(s string) {
	t := time.Now()
	LogWriterMu.RLock()
	_, _ = fmt.Fprintf(gin.DefaultErrorWriter, "[SYS] %v | %s \n", t.Format("2006/01/02 - 15:04:05"), s)
	LogWriterMu.RUnlock()
}

func FatalLog(v ...any) {
	t := time.Now()
	LogWriterMu.RLock()
	_, _ = fmt.Fprintf(gin.DefaultErrorWriter, "[FATAL] %v | %v \n", t.Format("2006/01/02 - 15:04:05"), v)
	LogWriterMu.RUnlock()
	os.Exit(1)
}

func LogStartupSuccess(startTime time.Time, port string) {
	duration := time.Since(startTime)
	durationMs := duration.Milliseconds()

	// Get network IPs
	networkIps := GetNetworkIps()

	LogWriterMu.RLock()
	defer LogWriterMu.RUnlock()

	if SessionCookieSecure == false {
		// Warn when the local HTTP compatibility mode disables cookie transport
		// security and refresh/logout Origin validation.
		fmt.Fprintf(gin.DefaultWriter, "\n")
		fmt.Fprintf(gin.DefaultWriter, "  \033[33m%s\033[0m\n", LogText("Warning: Refresh cookie is not secure and refresh/logout Origin validation is disabled. Please set SESSION_COOKIE_SECURE=true in production."))
		fmt.Fprintf(gin.DefaultWriter, "\n")
	}

	fmt.Fprintf(gin.DefaultWriter, "\n")
	fmt.Fprintf(gin.DefaultWriter, "  \033[32m%s %s\033[0m  %s\n", SystemName, Version, LogText("ready in %d ms", durationMs))
	fmt.Fprintf(gin.DefaultWriter, "\n")

	if !IsRunningInContainer() {
		fmt.Fprintf(gin.DefaultWriter, "  ➜  \033[1m%-8s\033[0m http://localhost:%s/\n", LogText("Local:"), port)
	}

	for _, ip := range networkIps {
		fmt.Fprintf(gin.DefaultWriter, "  ➜  \033[1m%-8s\033[0m http://%s:%s/\n", LogText("Network:"), ip, port)
	}

	fmt.Fprintf(gin.DefaultWriter, "\n")
}
