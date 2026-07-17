package model

import (
	"testing"
	"time"

	"github.com/stretchr/testify/require"
)

func TestConnectionPoolConfigPreservesExistingDefaults(t *testing.T) {
	t.Setenv("SQL_MAX_IDLE_CONNS", "")
	t.Setenv("SQL_MAX_OPEN_CONNS", "")
	t.Setenv("SQL_MAX_LIFETIME", "")

	config := connectionPoolConfig()
	require.Equal(t, 100, config.maxIdleConns)
	require.Equal(t, 1000, config.maxOpenConns)
	require.Equal(t, 60*time.Second, config.maxLifetime)
}

func TestConnectionPoolConfigHonorsExplicitOverrides(t *testing.T) {
	t.Setenv("SQL_MAX_IDLE_CONNS", "3")
	t.Setenv("SQL_MAX_OPEN_CONNS", "7")
	t.Setenv("SQL_MAX_LIFETIME", "90")

	config := connectionPoolConfig()
	require.Equal(t, 3, config.maxIdleConns)
	require.Equal(t, 7, config.maxOpenConns)
	require.Equal(t, 90*time.Second, config.maxLifetime)
}
