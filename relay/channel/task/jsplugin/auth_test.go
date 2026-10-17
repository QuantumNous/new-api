package jsplugin

import (
	"fmt"
	"net/http"
	"net/http/httptest"
	"sync"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	pluginruntime "github.com/QuantumNous/new-api/pkg/jsplugin"
	vertexcore "github.com/QuantumNous/new-api/relay/channel/vertex"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestOAuth2JWTAuthCachesAndRefreshes(t *testing.T) {
	pluginAuthCache = sync.Map{}
	original := acquireAccessToken
	t.Cleanup(func() { acquireAccessToken = original; pluginAuthCache = sync.Map{} })
	calls := 0
	acquireAccessToken = func(_ vertexcore.Credentials, _ string) (string, error) {
		calls++
		return fmt.Sprintf("token-%d", calls), nil
	}
	credentials, err := common.Marshal(vertexcore.Credentials{ProjectID: "project", ClientEmail: "a@example.com", PrivateKey: "secret"})
	require.NoError(t, err)
	meta := pluginruntime.AuthMeta{Type: "oauth2_jwt"}
	first, err := resolveAuth(meta, string(credentials), "")
	require.NoError(t, err)
	second, err := resolveAuth(meta, string(credentials), "")
	require.NoError(t, err)
	assert.Equal(t, "Bearer token-1", first["authHeader"])
	assert.Equal(t, first, second)
	assert.Equal(t, 1, calls)
	pluginAuthCache.Store(string(credentials)+"\x00", cachedAuth{expiresAt: time.Now().Add(-time.Second)})
	refreshed, err := resolveAuth(meta, string(credentials), "")
	require.NoError(t, err)
	assert.Equal(t, "Bearer token-2", refreshed["authHeader"])
	assert.Equal(t, 2, calls)
}

func TestOAuth2JWTContextDoesNotExposeServiceAccountKey(t *testing.T) {
	pluginAuthCache = sync.Map{}
	original := acquireAccessToken
	t.Cleanup(func() { acquireAccessToken = original; pluginAuthCache = sync.Map{} })
	acquireAccessToken = func(_ vertexcore.Credentials, _ string) (string, error) {
		return "access-token", nil
	}
	credentials, err := common.Marshal(vertexcore.Credentials{ProjectID: "project", ClientEmail: "a@example.com", PrivateKey: "secret"})
	require.NoError(t, err)
	source := `
export const meta = {apiVersion:1,key:"oauth",name:"OAuth",version:"1.0.0",author:{name:"Test"},models:["m"],fetchMode:"per_task",auth:{type:"oauth2_jwt"}};
export function buildSubmitRequest(ctx) {
  if (ctx.apiKey !== undefined) throw new Error("raw key exposed");
  return {url:ctx.baseUrl+"/submit",headers:{Authorization:ctx.authHeader}};
}
export function parseSubmitResponse(){return {taskId:"1"}}
export function buildQueryRequest(){return {url:"https://example.com"}}
export function parseTaskResult(){return {status:"SUCCESS"}}
`
	plugin, err := pluginruntime.NewRegistry().Register(source, pluginruntime.Options{})
	require.NoError(t, err)
	adaptor := New(plugin)
	info := &relaycommon.RelayInfo{ChannelMeta: &relaycommon.ChannelMeta{ChannelBaseUrl: "https://provider.example", ApiKey: string(credentials)}, TaskRelayInfo: &relaycommon.TaskRelayInfo{}}
	adaptor.Init(info)
	c, _ := gin.CreateTestContext(httptest.NewRecorder())
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/videos", nil)
	c.Set("task_request", relaycommon.TaskSubmitReq{Prompt: "p"})
	require.Nil(t, adaptor.ValidateRequestAndSetAction(c, info))
	req := httptest.NewRequest(http.MethodPost, "https://provider.example/submit", nil)
	require.NoError(t, adaptor.BuildRequestHeader(c, req, info))
	assert.Equal(t, "Bearer access-token", req.Header.Get("Authorization"))
}
