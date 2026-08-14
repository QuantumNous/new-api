package database

import (
	"testing"

	"github.com/QuantumNous/new-api/wechat-epay-adapter/internal/config"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestOpenSQLite(t *testing.T) {
	db, err := Open(config.Config{DatabaseType: "sqlite", DatabaseDSN: ":memory:"})
	require.NoError(t, err)
	assert.Equal(t, "sqlite", db.Dialector.Name())
}

func TestOpenRejectsUnsupportedDatabase(t *testing.T) {
	_, err := Open(config.Config{DatabaseType: "unsupported", DatabaseDSN: "ignored"})
	assert.Error(t, err)
}
