package service

import (
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func TestProxyNodeStorageEncryptsAndRoundTrips(t *testing.T) {
	previousDB := model.DB
	previousSecret := common.CryptoSecret
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	require.NoError(t, err)
	require.NoError(t, db.AutoMigrate(&model.ProxyNode{}))
	model.DB = db
	common.CryptoSecret = "test-secret"
	t.Cleanup(func() { model.DB = previousDB; common.CryptoSecret = previousSecret })

	node, err := CreateProxyNode(ProxyNodeInput{
		Name:       "edge",
		Enabled:    true,
		Proxy:      "http://user:pass@example.com:8080",
		ScopeType:  model.ProxyNodeScopeAll,
		ScopeValue: "",
	})
	require.NoError(t, err)
	assert.NotContains(t, node.EncryptedProxyConfig, "user")
	assert.NotContains(t, node.EncryptedProxyConfig, "pass")

	parsed, err := DecryptProxyNodeConfig(node)
	require.NoError(t, err)
	assert.Equal(t, "http", parsed.Protocol)
	assert.Contains(t, string(parsed.OutboundJSON), "example.com")
}
