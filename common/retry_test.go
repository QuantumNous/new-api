package common

import (
	"errors"
	"fmt"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
)

func TestIsTransientNetworkError(t *testing.T) {
	require.False(t, IsTransientNetworkError(nil))
	require.True(t, IsTransientNetworkError(errors.New("dial tcp 172.18.0.2:5432: connect: connection refused")))
	require.True(t, IsTransientNetworkError(errors.New("pq: the database system is starting up")))
	require.True(t, IsTransientNetworkError(errors.New("redis: connection timed out")))
	require.False(t, IsTransientNetworkError(errors.New("password authentication failed for user \"root\"")))
	require.False(t, IsTransientNetworkError(errors.New(`database "new-api" does not exist`)))
	require.False(t, IsTransientNetworkError(errors.New("NOAUTH Authentication required")))
}

func TestRetryTransientSucceedsAfterTransientFailures(t *testing.T) {
	t.Setenv("STARTUP_RETRY_ATTEMPTS", "5")
	t.Setenv("STARTUP_RETRY_INTERVAL_MS", "1")

	attempts := 0
	err := RetryTransient("database", func() error {
		attempts++
		if attempts < 3 {
			return errors.New("dial tcp 127.0.0.1:5432: connect: connection refused")
		}
		return nil
	})
	require.NoError(t, err)
	require.Equal(t, 3, attempts)
}

func TestRetryTransientDoesNotRetryPermanentErrors(t *testing.T) {
	t.Setenv("STARTUP_RETRY_ATTEMPTS", "5")
	t.Setenv("STARTUP_RETRY_INTERVAL_MS", "1")

	attempts := 0
	permanent := errors.New("password authentication failed for user \"root\"")
	err := RetryTransient("database", func() error {
		attempts++
		return permanent
	})
	require.Error(t, err)
	require.ErrorContains(t, err, permanent.Error())
	require.Equal(t, 1, attempts)
}

func TestRetryTransientExhaustsAttempts(t *testing.T) {
	t.Setenv("STARTUP_RETRY_ATTEMPTS", "3")
	t.Setenv("STARTUP_RETRY_INTERVAL_MS", "1")

	attempts := 0
	err := RetryTransient("redis", func() error {
		attempts++
		return errors.New("dial tcp 127.0.0.1:6379: connect: connection refused")
	})
	require.Error(t, err)
	require.Equal(t, 3, attempts)
	require.ErrorContains(t, err, "failed after 3 attempt(s)")
}

func TestStartupRetryDefaultsAndOverrides(t *testing.T) {
	t.Setenv("STARTUP_RETRY_ATTEMPTS", "")
	t.Setenv("STARTUP_RETRY_INTERVAL_MS", "")
	require.Equal(t, defaultStartupRetryAttempts, StartupRetryAttempts())
	require.Equal(t, defaultStartupRetryInterval, StartupRetryInterval())

	t.Setenv("STARTUP_RETRY_ATTEMPTS", "0")
	t.Setenv("STARTUP_RETRY_INTERVAL_MS", "-5")
	require.Equal(t, 1, StartupRetryAttempts())
	require.Equal(t, defaultStartupRetryInterval, StartupRetryInterval())

	t.Setenv("STARTUP_RETRY_ATTEMPTS", "8")
	t.Setenv("STARTUP_RETRY_INTERVAL_MS", "250")
	require.Equal(t, 8, StartupRetryAttempts())
	require.Equal(t, 250*time.Millisecond, StartupRetryInterval())
}

func TestRetryTransientWrapsLastError(t *testing.T) {
	t.Setenv("STARTUP_RETRY_ATTEMPTS", "2")
	t.Setenv("STARTUP_RETRY_INTERVAL_MS", "1")

	err := RetryTransient("database", func() error {
		return fmt.Errorf("dial tcp: connection refused")
	})
	require.ErrorContains(t, err, "connection refused")
}
