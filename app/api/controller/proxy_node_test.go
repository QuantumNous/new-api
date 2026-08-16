package controller

import (
	"bytes"
	"encoding/json"
	"fmt"
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

type proxyNodeAPIResponse struct {
	Success bool            `json:"success"`
	Message string          `json:"message"`
	Data    json.RawMessage `json:"data"`
}

func setupProxyNodeControllerTest(t *testing.T) *gorm.DB {
	t.Helper()
	previousDB := model.DB
	previousSecret := common.CryptoSecret
	dsn := fmt.Sprintf("file:%s?mode=memory&cache=private", t.Name())
	db, err := gorm.Open(sqlite.Open(dsn), &gorm.Config{})
	require.NoError(t, err)
	require.NoError(t, db.AutoMigrate(&model.ProxyNode{}))
	model.DB = db
	common.CryptoSecret = "proxy-node-controller-test-secret"
	t.Cleanup(func() {
		model.DB = previousDB
		common.CryptoSecret = previousSecret
	})
	return db
}
func proxyNodeContext(t *testing.T, method, path, body string) (*gin.Context, *httptest.ResponseRecorder) {
	t.Helper()
	gin.SetMode(gin.TestMode)
	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Request = httptest.NewRequest(method, path, bytes.NewBufferString(body))
	ctx.Request.Header.Set("Content-Type", "application/json")
	return ctx, recorder
}

func decodeProxyNodeResponse(t *testing.T, recorder *httptest.ResponseRecorder) proxyNodeAPIResponse {
	t.Helper()
	var response proxyNodeAPIResponse
	require.NoError(t, common.Unmarshal(recorder.Body.Bytes(), &response))
	return response
}

func TestListProxyNodesRedactsStoredConfiguration(t *testing.T) {
	db := setupProxyNodeControllerTest(t)
	_, err := service.CreateProxyNode(service.ProxyNodeInput{
		Name: "edge", Enabled: true, Proxy: "http://user:pass@example.com:8080", ScopeType: model.ProxyNodeScopeAll,
	})
	require.NoError(t, err)

	ctx, recorder := proxyNodeContext(t, http.MethodGet, "/api/proxy/nodes", "")
	ListProxyNodes(ctx)

	response := decodeProxyNodeResponse(t, recorder)
	require.True(t, response.Success, response.Message)
	assert.NotContains(t, recorder.Body.String(), "example.com")
	assert.NotContains(t, recorder.Body.String(), "user")
	assert.NotContains(t, recorder.Body.String(), "pass")
	var items []model.ProxyNodePublic
	require.NoError(t, common.Unmarshal(response.Data, &items))
	require.Len(t, items, 1)
	assert.True(t, items[0].ProxyConfigured)
	assert.NoError(t, db.Model(&model.ProxyNode{}).Where("name = ?", "edge").Error)
}

func TestCreateProxyNodeRejectsInvalidScopeWithoutPersistence(t *testing.T) {
	db := setupProxyNodeControllerTest(t)
	ctx, recorder := proxyNodeContext(t, http.MethodPost, "/api/proxy/nodes", `{"name":"bad","enabled":true,"proxy":"http://example.com:8080","scope_type":"all","scope_value":"unexpected"}`)

	CreateProxyNode(ctx)

	response := decodeProxyNodeResponse(t, recorder)
	assert.False(t, response.Success)
	var count int64
	require.NoError(t, db.Model(&model.ProxyNode{}).Count(&count).Error)
	assert.Zero(t, count)
}

func TestUpdateProxyNodeWithoutProxyPreservesEncryptedConfiguration(t *testing.T) {
	db := setupProxyNodeControllerTest(t)
	node, err := service.CreateProxyNode(service.ProxyNodeInput{
		Name: "before", Enabled: true, Proxy: "http://user:pass@example.com:8080", ScopeType: model.ProxyNodeScopeAll,
	})
	require.NoError(t, err)
	originalCiphertext := node.EncryptedProxyConfig

	ctx, recorder := proxyNodeContext(t, http.MethodPut, "/api/proxy/nodes/1", `{"name":"after","enabled":false,"scope_type":"all","scope_value":""}`)
	ctx.Params = gin.Params{{Key: "id", Value: "1"}}
	UpdateProxyNode(ctx)

	response := decodeProxyNodeResponse(t, recorder)
	require.True(t, response.Success, response.Message)
	var updated model.ProxyNode
	require.NoError(t, db.First(&updated, node.ID).Error)
	assert.Equal(t, originalCiphertext, updated.EncryptedProxyConfig)
	assert.Equal(t, "after", updated.Name)
	assert.False(t, updated.Enabled)
}

func TestUpdateProxyNodeWithEmptyProxyPreservesEncryptedConfiguration(t *testing.T) {
	db := setupProxyNodeControllerTest(t)
	node, err := service.CreateProxyNode(service.ProxyNodeInput{
		Name: "before", Enabled: true, Proxy: "http://user:pass@example.com:8080", ScopeType: model.ProxyNodeScopeAll,
	})
	require.NoError(t, err)
	originalCiphertext := node.EncryptedProxyConfig

	ctx, recorder := proxyNodeContext(t, http.MethodPut, "/api/proxy/nodes/1", `{"name":"after","enabled":true,"proxy":"","scope_type":"all","scope_value":""}`)
	ctx.Params = gin.Params{{Key: "id", Value: "1"}}
	UpdateProxyNode(ctx)

	response := decodeProxyNodeResponse(t, recorder)
	require.True(t, response.Success, response.Message)
	var updated model.ProxyNode
	require.NoError(t, db.First(&updated, node.ID).Error)
	assert.Equal(t, originalCiphertext, updated.EncryptedProxyConfig)
}

func TestGetProxyNodeReportCountsHealthyNodesRegardlessOfEnabled(t *testing.T) {
	db := setupProxyNodeControllerTest(t)
	// One disabled node that is still healthy: must count toward `healthy`
	// but not toward `enabled`. Regression guard for the GORM query-chain bug
	// where the enabled predicate leaked into the healthy count.
	disabled, err := service.CreateProxyNode(service.ProxyNodeInput{
		Name: "disabled-healthy", Enabled: false, Proxy: "http://one.example:8080", ScopeType: model.ProxyNodeScopeAll,
	})
	require.NoError(t, err)
	require.NoError(t, db.Model(&model.ProxyNode{}).Where("id = ?", disabled.ID).
		Updates(map[string]any{"health": 0.9}).Error)
	enabled, err := service.CreateProxyNode(service.ProxyNodeInput{
		Name: "enabled-unhealthy", Enabled: true, Proxy: "http://two.example:8080", ScopeType: model.ProxyNodeScopeAll,
	})
	require.NoError(t, err)
	// CreateProxyNode seeds Health=1; drive the enabled node below the healthy
	// threshold so only the disabled node should count as healthy. Under the
	// query-chain bug, the leaked enabled predicate drops it and healthy==0.
	require.NoError(t, db.Model(&model.ProxyNode{}).Where("id = ?", enabled.ID).
		Updates(map[string]any{"health": 0.1}).Error)

	ctx, recorder := proxyNodeContext(t, http.MethodGet, "/api/proxy/nodes/report", "")
	GetProxyNodeReport(ctx)

	response := decodeProxyNodeResponse(t, recorder)
	require.True(t, response.Success, response.Message)
	var report struct {
		Total   int64 `json:"total"`
		Enabled int64 `json:"enabled"`
		Healthy int64 `json:"healthy"`
	}
	require.NoError(t, common.Unmarshal(response.Data, &report))
	assert.Equal(t, int64(2), report.Total)
	assert.Equal(t, int64(1), report.Enabled)
	assert.Equal(t, int64(1), report.Healthy, "healthy must include disabled nodes above the threshold")
}

func TestGetProxyNodeReturnsEditableLinkOnlyFromDetailEndpoint(t *testing.T) {
	setupProxyNodeControllerTest(t)
	node, err := service.CreateProxyNode(service.ProxyNodeInput{
		Name: "edge", Enabled: true, Proxy: "http://user:pass@example.com:8080", ScopeType: model.ProxyNodeScopeAll,
	})
	require.NoError(t, err)

	ctx, recorder := proxyNodeContext(t, http.MethodGet, "/api/proxy/nodes/1", "")
	ctx.Params = gin.Params{{Key: "id", Value: fmt.Sprint(node.ID)}}
	GetProxyNode(ctx)

	response := decodeProxyNodeResponse(t, recorder)
	require.True(t, response.Success, response.Message)
	var detail struct {
		Node  model.ProxyNodePublic `json:"node"`
		Proxy string                `json:"proxy"`
	}
	require.NoError(t, common.Unmarshal(response.Data, &detail))
	assert.Equal(t, "http://user:pass@example.com:8080", detail.Proxy)
	assert.True(t, detail.Node.ProxyConfigured)
}

func TestAllProxyNodesProbesEnabledNodesAndReportsCounts(t *testing.T) {
	setupProxyNodeControllerTest(t)
	// Unreachable loopback port: probe fails fast and deterministically,
	// no external network. 12 enabled nodes exercise bounded concurrency.
	const enabledCount = 12
	for i := 0; i < enabledCount; i++ {
		_, err := service.CreateProxyNode(service.ProxyNodeInput{
			Name: fmt.Sprintf("probe-%d", i), Enabled: true,
			Proxy: "http://127.0.0.1:9", ScopeType: model.ProxyNodeScopeAll,
		})
		require.NoError(t, err)
	}
	// Disabled node must be excluded from the batch.
	_, err := service.CreateProxyNode(service.ProxyNodeInput{
		Name: "disabled", Enabled: false,
		Proxy: "http://127.0.0.1:9", ScopeType: model.ProxyNodeScopeAll,
	})
	require.NoError(t, err)

	ctx, recorder := proxyNodeContext(t, http.MethodPost, "/api/proxy/nodes/test-all", "")
	TestAllProxyNodes(ctx)
	response := decodeProxyNodeResponse(t, recorder)
	require.True(t, response.Success, response.Message)
	var counts struct {
		Passed int `json:"passed"`
		Failed int `json:"failed"`
		Total  int `json:"total"`
	}
	require.NoError(t, common.Unmarshal(response.Data, &counts))
	assert.Equal(t, enabledCount, counts.Total)
	assert.Equal(t, 0, counts.Passed)
	assert.Equal(t, enabledCount, counts.Failed)
}
