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

func setupProxyConfigTestDB(t *testing.T) {
	t.Helper()
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	require.NoError(t, err)
	previousDB := model.DB
	model.DB = db
	t.Cleanup(func() { model.DB = previousDB })
	require.NoError(t, db.AutoMigrate(&model.Option{}))
	// OptionMap must be non-nil for updateOptionMap.
	if common.OptionMap == nil {
		common.OptionMap = make(map[string]string)
	}
}

func TestSaveAndLoadProxyConfigEncryptsRoundTrip(t *testing.T) {
	setupProxyConfigTestDB(t)

	plaintext := `{"enabled":true,"global_proxy_url":"socks5://user:pass@host:1080","outbound":{"type":"trojan","password":"my-secret-password","uuid":"my-secret-uuid"}}`
	require.NoError(t, SaveProxyConfigJSON(plaintext))

	// Verify the stored value is encrypted (not plaintext).
	var opt model.Option
	require.NoError(t, model.DB.Where("key = ?", "proxy_config").First(&opt).Error)
	assert.NotContains(t, opt.Value, "my-secret-password")
	assert.NotContains(t, opt.Value, "my-secret-uuid")
	assert.NotContains(t, opt.Value, "global_proxy_url")

	// Load should decrypt back to plaintext.
	loaded, err := LoadProxyConfigJSON()
	require.NoError(t, err)
	assert.JSONEq(t, plaintext, loaded)
}

func TestLoadProxyConfigLegacyPlaintext(t *testing.T) {
	setupProxyConfigTestDB(t)

	// Simulate a pre-#141 plaintext value stored directly.
	legacy := `{"enabled":false,"outbound":{"type":"trojan"}}`
	require.NoError(t, model.UpdateOption("proxy_config", legacy))

	// Load should return the legacy plaintext as-is (decryption fails → fallback).
	loaded, err := LoadProxyConfigJSON()
	require.NoError(t, err)
	assert.Equal(t, legacy, loaded)
}

func TestLoadProxyConfigNoRow(t *testing.T) {
	setupProxyConfigTestDB(t)

	_, err := LoadProxyConfigJSON()
	require.Error(t, err)
}

func TestGetGlobalProxyURLWithEncryptedConfig(t *testing.T) {
	setupProxyConfigTestDB(t)
	originalSecret := common.CryptoSecret
	common.CryptoSecret = "test-secret-key"
	t.Cleanup(func() { common.CryptoSecret = originalSecret })

	plaintext := `{"enabled":true,"global_proxy_url":"socks5://127.0.0.1:1080"}`
	require.NoError(t, SaveProxyConfigJSON(plaintext))

	url := getGlobalProxyURL()
	assert.Equal(t, "socks5://127.0.0.1:1080", url)
}
