package controller

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/service"
	"github.com/gin-gonic/gin"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func setupProxyConfigControllerTest(t *testing.T) *gorm.DB {
	t.Helper()
	previousDB := model.DB
	previousSecret := common.CryptoSecret
	dsn := "file:proxy-config-controller-test?mode=memory&cache=private"
	db, err := gorm.Open(sqlite.Open(dsn), &gorm.Config{})
	require.NoError(t, err)
	require.NoError(t, db.AutoMigrate(&model.Option{}))
	model.DB = db
	common.CryptoSecret = "proxy-config-controller-test-secret"
	if common.OptionMap == nil {
		common.OptionMap = make(map[string]string)
	}
	t.Cleanup(func() {
		model.DB = previousDB
		common.CryptoSecret = previousSecret
	})
	return db
}

func proxyConfigContext(t *testing.T, method, path, body string) (*gin.Context, *httptest.ResponseRecorder) {
	t.Helper()
	gin.SetMode(gin.TestMode)
	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Request = httptest.NewRequest(method, path, bytes.NewBufferString(body))
	ctx.Request.Header.Set("Content-Type", "application/json")
	return ctx, recorder
}

func TestGetProxyConfigMasksSecrets(t *testing.T) {
	setupProxyConfigControllerTest(t)

	// Save a config with real secrets.
	require.NoError(t, service.SaveProxyConfigJSON(`{"enabled":true,"outbound":{"type":"trojan","password":"real-password","uuid":"real-uuid"}}`))

	ctx, recorder := proxyConfigContext(t, http.MethodGet, "/api/proxy/config", "")
	GetProxyConfig(ctx)

	var resp struct {
		Success bool              `json:"success"`
		Data    json.RawMessage   `json:"data"`
	}
	require.NoError(t, json.Unmarshal(recorder.Body.Bytes(), &resp))

	var cfg ProxyConfigRequest
	require.NoError(t, json.Unmarshal(resp.Data, &cfg))
	assert.Equal(t, maskedSecret, cfg.Outbound.Password)
	assert.Equal(t, maskedSecret, cfg.Outbound.UUID)
}

func TestUpdateProxyConfigRestoresMaskedSecrets(t *testing.T) {
	setupProxyConfigControllerTest(t)

	// Save initial config with real secrets.
	require.NoError(t, service.SaveProxyConfigJSON(`{"enabled":true,"outbound":{"type":"trojan","password":"real-password","uuid":"real-uuid"}}`))

	// Simulate frontend round-trip: masked values sent back unchanged.
	body := `{"enabled":true,"outbound":{"type":"trojan","password":"********","uuid":"********"}}`
	ctx, recorder := proxyConfigContext(t, http.MethodPut, "/api/proxy/config", body)
	UpdateProxyConfig(ctx)
	assert.Equal(t, http.StatusOK, recorder.Code)

	// Verify stored config still has real secrets, not the sentinel.
	loaded, err := service.LoadProxyConfigJSON()
	require.NoError(t, err)
	var cfg ProxyConfigRequest
	require.NoError(t, json.Unmarshal([]byte(loaded), &cfg))
	assert.Equal(t, "real-password", cfg.Outbound.Password)
	assert.Equal(t, "real-uuid", cfg.Outbound.UUID)
}
