package controller

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/service"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestBatchCreateProxyNodesKeepsValidRows(t *testing.T) {
	db := setupProxyNodeControllerTest(t)
	ctx, recorder := proxyNodeContext(t, http.MethodPost, "/api/proxy/nodes/batch", `{"name_prefix":"edge","enabled":true,"scope_type":"all","proxy_text":"# ignored\nhttp://one.example:8080\nnot-a-proxy\nhttp://one.example:8080\nhttp://two.example:8080"}`)

	BatchCreateProxyNodes(ctx)

	response := decodeProxyNodeResponse(t, recorder)
	require.True(t, response.Success, response.Message)
	var result struct {
		Created int                     `json:"created"`
		Failed  int                     `json:"failed"`
		Skipped int                     `json:"skipped"`
		Items   []model.ProxyNodePublic `json:"items"`
	}
	require.NoError(t, common.Unmarshal(response.Data, &result))
	assert.Equal(t, 2, result.Created)
	assert.Equal(t, 1, result.Failed)
	assert.Equal(t, 2, result.Skipped)
	require.Len(t, result.Items, 2)
	assert.Equal(t, "edge#1", result.Items[0].Name)
	assert.Equal(t, "edge#3", result.Items[1].Name)
	var count int64
	require.NoError(t, db.Model(&model.ProxyNode{}).Count(&count).Error)
	assert.Equal(t, int64(2), count)
}

func TestBatchProxyNodeStateOperationsOnlyChangeSelectedRows(t *testing.T) {
	db := setupProxyNodeControllerTest(t)
	first, err := service.CreateProxyNode(service.ProxyNodeInput{Name: "first", Enabled: true, Proxy: "http://one.example:8080", ScopeType: model.ProxyNodeScopeAll})
	require.NoError(t, err)
	second, err := service.CreateProxyNode(service.ProxyNodeInput{Name: "second", Enabled: false, Proxy: "http://two.example:8080", ScopeType: model.ProxyNodeScopeAll})
	require.NoError(t, err)

	ctx, recorder := proxyNodeContext(t, http.MethodPost, "/api/proxy/nodes/batch-enabled", fmt.Sprintf(`{"ids":[%d],"enabled":false}`, first.ID))
	BatchSetProxyNodesEnabled(ctx)
	assert.True(t, decodeProxyNodeResponse(t, recorder).Success)
	var updated model.ProxyNode
	require.NoError(t, db.First(&updated, first.ID).Error)
	assert.False(t, updated.Enabled)
	updated = model.ProxyNode{}
	require.NoError(t, db.First(&updated, second.ID).Error)
	assert.False(t, updated.Enabled)

	require.NoError(t, db.Model(&model.ProxyNode{}).Where("id = ?", first.ID).Updates(map[string]any{"last_error": "failed", "failure_count": 3}).Error)
	ctx, recorder = proxyNodeContext(t, http.MethodPost, "/api/proxy/nodes/batch-clear-errors", fmt.Sprintf(`{"ids":[%d]}`, first.ID))
	BatchClearProxyNodeErrors(ctx)
	updated = model.ProxyNode{}
	require.NoError(t, db.First(&updated, first.ID).Error)
	assert.Empty(t, updated.LastError)
	assert.Zero(t, updated.FailureCount)
}

func TestBatchCreateProxyNodesRejectsMoreThan500Entries(t *testing.T) {
	setupProxyNodeControllerTest(t)
	lines := make([]string, 501)
	for index := range lines {
		lines[index] = fmt.Sprintf("http://node-%d.example:8080", index)
	}
	ctx, recorder := proxyNodeContext(t, http.MethodPost, "/api/proxy/nodes/batch", "{\"proxy_text\":"+mustJSON(t, strings.Join(lines, "\n"))+"}")

	BatchCreateProxyNodes(ctx)

	assert.False(t, decodeProxyNodeResponse(t, recorder).Success)
}

func mustJSON(t *testing.T, value string) string {
	t.Helper()
	encoded, err := json.Marshal(value)
	require.NoError(t, err)
	return string(encoded)
}
