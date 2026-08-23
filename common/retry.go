package common

import (
	"fmt"
	"strings"
	"time"
)

const (
	defaultStartupRetryAttempts = 30
	defaultStartupRetryInterval = 2 * time.Second
)

func StartupRetryAttempts() int {
	attempts := GetEnvOrDefault("STARTUP_RETRY_ATTEMPTS", defaultStartupRetryAttempts)
	if attempts < 1 {
		return 1
	}
	return attempts
}

func StartupRetryInterval() time.Duration {
	ms := GetEnvOrDefault("STARTUP_RETRY_INTERVAL_MS", int(defaultStartupRetryInterval/time.Millisecond))
	if ms <= 0 {
		return defaultStartupRetryInterval
	}
	return time.Duration(ms) * time.Millisecond
}

// IsTransientNetworkError reports whether err is a temporary connect/bootstrap
// failure that should be retried during process startup.
func IsTransientNetworkError(err error) bool {
	if err == nil {
		return false
	}
	msg := strings.ToLower(err.Error())
	for _, needle := range []string{
		"connection refused",
		"connection reset",
		"i/o timeout",
		"timeout exceeded",
		"no such host",
		"network is unreachable",
		"temporary failure",
		"database system is starting up",
		"not yet accepting connections",
		"dial tcp",
		"dial udp",
		"driver: bad connection",
		"sql: database is closed",
		"unexpected eof",
		"broken pipe",
		"server closed the connection",
		"no route to host",
		"connection timed out",
		"could not connect",
		"connectex:",
		"wsarecv",
		"wsasend",
	} {
		if strings.Contains(msg, needle) {
			return true
		}
	}
	return false
}

// RetryTransient retries fn while it returns a transient network/bootstrap error.
// Permanent errors (auth, bad DSN, missing database) fail immediately.
func RetryTransient(name string, fn func() error) error {
	attempts := StartupRetryAttempts()
	interval := StartupRetryInterval()
	var err error
	for i := 1; i <= attempts; i++ {
		err = fn()
		if err == nil {
			if i > 1 {
				SysLog(fmt.Sprintf("%s became ready after %d attempts", name, i))
			}
			return nil
		}
		if !IsTransientNetworkError(err) || i == attempts {
			break
		}
		SysLog(fmt.Sprintf("%s not ready (attempt %d/%d): %v; retrying in %s", name, i, attempts, err, interval))
		time.Sleep(interval)
	}
	return fmt.Errorf("%s failed after %d attempt(s): %w", name, attempts, err)
}
