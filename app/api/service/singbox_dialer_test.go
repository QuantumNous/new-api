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

func TestOutboundFingerprintDisabledReturnsEmpty(t *testing.T) {
	previousDB := model.DB
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	require.NoError(t, err)
	require.NoError(t, db.AutoMigrate(&model.Option{}))
	model.DB = db
	t.Cleanup(func() { model.DB = previousDB })

	configJSON := `{"enabled": false, "outbound": {"type": "socks5", "tag": "out"}}`
	require.NoError(t, db.Create(&model.Option{Key: "proxy_config", Value: configJSON}).Error)

	fp, raw := outboundFingerprint()
	assert.Empty(t, fp, "fingerprint should be empty when disabled")
	assert.Nil(t, raw, "raw should be nil when disabled")
}

func TestOutboundFingerprintEnabledReturnsNonEmpty(t *testing.T) {
	previousDB := model.DB
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	require.NoError(t, err)
	require.NoError(t, db.AutoMigrate(&model.Option{}))
	model.DB = db
	t.Cleanup(func() { model.DB = previousDB })

	outboundJSON := `{"type":"socks5","tag":"out","socks5":{"server":"127.0.0.1","server_port":1080}}`
	configJSON := `{"enabled": true, "outbound": ` + outboundJSON + `}`
	require.NoError(t, db.Create(&model.Option{Key: "proxy_config", Value: configJSON}).Error)

	fp, raw := outboundFingerprint()
	assert.NotEmpty(t, fp, "fingerprint should be non-empty when enabled")
	assert.NotNil(t, raw, "raw should be non-nil when enabled")
	assert.JSONEq(t, outboundJSON, string(raw), "raw should match the outbound JSON from config")
}

func TestOutboundFingerprintNoConfigReturnsEmpty(t *testing.T) {
	previousDB := model.DB
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	require.NoError(t, err)
	require.NoError(t, db.AutoMigrate(&model.Option{}))
	model.DB = db
	t.Cleanup(func() { model.DB = previousDB })

	// No proxy_config row in DB
	fp, raw := outboundFingerprint()
	assert.Empty(t, fp, "fingerprint should be empty when no config exists")
	assert.Nil(t, raw, "raw should be nil when no config exists")
}

func TestOutboundFingerprintNilDBReturnsEmpty(t *testing.T) {
	previousDB := model.DB
	model.DB = nil
	t.Cleanup(func() { model.DB = previousDB })

	fp, raw := outboundFingerprint()
	assert.Empty(t, fp, "fingerprint should be empty when DB is nil")
	assert.Nil(t, raw, "raw should be nil when DB is nil")
}

func TestOutboundFingerprintConsistentHash(t *testing.T) {
	previousDB := model.DB
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	require.NoError(t, err)
	require.NoError(t, db.AutoMigrate(&model.Option{}))
	model.DB = db
	t.Cleanup(func() { model.DB = previousDB })

	outboundJSON := `{"type":"vless","tag":"out"}`
	configJSON := `{"enabled": true, "outbound": ` + outboundJSON + `}`
	require.NoError(t, db.Create(&model.Option{Key: "proxy_config", Value: configJSON}).Error)

	fp1, raw1 := outboundFingerprint()
	fp2, raw2 := outboundFingerprint()

	assert.Equal(t, fp1, fp2, "fingerprint should be deterministic for same config")
	assert.Equal(t, raw1, raw2, "raw should be deterministic for same config")
}

func TestOutboundFingerprintInvalidJSONReturnsEmpty(t *testing.T) {
	previousDB := model.DB
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	require.NoError(t, err)
	require.NoError(t, db.AutoMigrate(&model.Option{}))
	model.DB = db
	t.Cleanup(func() { model.DB = previousDB })

	require.NoError(t, db.Create(&model.Option{Key: "proxy_config", Value: "not-valid-json"}).Error)

	fp, raw := outboundFingerprint()
	assert.Empty(t, fp, "fingerprint should be empty for invalid JSON")
	assert.Nil(t, raw, "raw should be nil for invalid JSON")
}

func TestBuildOptionsJSONSSH(t *testing.T) {
	t.Run("password auth", func(t *testing.T) {
		input := `{"type":"ssh","server":"example.com","server_port":22,"username":"root","password":"secret"}`
		out, err := buildOptionsJSON([]byte(input))
		require.NoError(t, err)

		var result map[string]any
		require.NoError(t, common.Unmarshal(out, &result))
		outbounds := result["outbounds"].([]any)
		ob := outbounds[0].(map[string]any)

		assert.Equal(t, "ssh", ob["type"])
		assert.Equal(t, "example.com", ob["server"])
		assert.Equal(t, float64(22), ob["server_port"])
		assert.Equal(t, "root", ob["user"])
		assert.Equal(t, "secret", ob["password"])
		// private_key must NOT be set for password auth
		_, hasPrivateKey := ob["private_key"]
		assert.False(t, hasPrivateKey, "private_key should not be set for password auth")
	})

	t.Run("key auth", func(t *testing.T) {
		input := `{"type":"ssh","server":"example.com","server_port":22,"username":"root","private_key":"-----BEGIN OPENSSH PRIVATE KEY-----\nfake\n-----END OPENSSH PRIVATE KEY-----"}`
		out, err := buildOptionsJSON([]byte(input))
		require.NoError(t, err)

		var result map[string]any
		require.NoError(t, common.Unmarshal(out, &result))
		outbounds := result["outbounds"].([]any)
		ob := outbounds[0].(map[string]any)

		assert.Equal(t, "ssh", ob["type"])
		assert.Equal(t, "root", ob["user"])
		assert.Contains(t, ob["private_key"], "BEGIN OPENSSH PRIVATE KEY")
		// password must NOT be set for key auth
		_, hasPassword := ob["password"]
		assert.False(t, hasPassword, "password should not be set for key auth")
	})
}

func TestBuildOptionsJSONSocks5UsernamePassword(t *testing.T) {
	input := `{"type":"socks5","server":"example.com","server_port":1080,"username":"user","password":"pass"}`
	out, err := buildOptionsJSON([]byte(input))
	require.NoError(t, err)

	var result map[string]any
	require.NoError(t, common.Unmarshal(out, &result))
	outbounds := result["outbounds"].([]any)
	ob := outbounds[0].(map[string]any)

	assert.Equal(t, "socks", ob["type"])
	assert.Equal(t, "user", ob["username"])
	assert.Equal(t, "pass", ob["password"])
}

func TestBuildOptionsJSONHTTPUsernamePassword(t *testing.T) {
	input := `{"type":"http","server":"example.com","server_port":8080,"username":"user","password":"pass"}`
	out, err := buildOptionsJSON([]byte(input))
	require.NoError(t, err)

	var result map[string]any
	require.NoError(t, common.Unmarshal(out, &result))
	outbounds := result["outbounds"].([]any)
	ob := outbounds[0].(map[string]any)

	assert.Equal(t, "http", ob["type"])
	assert.Equal(t, "user", ob["username"])
	assert.Equal(t, "pass", ob["password"])
}
