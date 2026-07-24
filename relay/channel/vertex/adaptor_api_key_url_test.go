package vertex

import (
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/dto"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/stretchr/testify/require"
)

// newAPIKeyRelayInfo 构造一个 Vertex API Key 模式的最小 RelayInfo。
// OriginModelName 不影响 URL 路径（只影响 region 推断），这里固定 "gemini-test"。
func newAPIKeyRelayInfo(projectID, apiKey string) *relaycommon.RelayInfo {
	return &relaycommon.RelayInfo{
		ChannelMeta: &relaycommon.ChannelMeta{
			ApiKey:            apiKey,
			UpstreamModelName: "gemini-test",
			ChannelOtherSettings: dto.ChannelOtherSettings{
				VertexKeyType:   dto.VertexKeyTypeAPIKey,
				VertexProjectID: projectID,
			},
		},
		OriginModelName: "gemini-test",
	}
}

func TestGetRequestUrl_APIKey_UsesProjectIDFromSettings(t *testing.T) {
	const projectID = "zmdy6v-mffg"
	const apiKey = "AIzaSyTest"

	a := &Adaptor{RequestMode: RequestModeGemini}
	info := newAPIKeyRelayInfo(projectID, apiKey)

	url, err := a.getRequestUrl(info, "gemini-3.1-flash-image", "generateContent")
	require.NoError(t, err)

	// 官方端点路径必须包含 /projects/{PROJECT_ID}/locations/{REGION}/publishers/google/models/...
	require.Contains(t, url, "/projects/"+projectID+"/locations/", "URL should embed the configured project_id")
	require.Contains(t, url, "/publishers/google/models/gemini-3.1-flash-image:generateContent")
	require.True(t, strings.HasSuffix(url, "key="+apiKey), "URL should end with the API key query, got: %s", url)
}

func TestGetRequestUrl_APIKey_StreamSuffixUsesAmpersand(t *testing.T) {
	const projectID = "zmdy6v-mffg"
	const apiKey = "AIzaSyTest"

	a := &Adaptor{RequestMode: RequestModeGemini}
	info := newAPIKeyRelayInfo(projectID, apiKey)

	url, err := a.getRequestUrl(info, "gemini-3.1-flash-image", "streamGenerateContent?alt=sse")
	require.NoError(t, err)

	// 流式 suffix 已经带 ?alt=sse，所以 key 应该用 & 拼接
	require.Contains(t, url, "streamGenerateContent?alt=sse&key="+apiKey)
	require.Contains(t, url, "/projects/"+projectID+"/locations/")
}

func TestGetRequestUrl_APIKey_ClaudeModeUsesProjectID(t *testing.T) {
	const projectID = "zmdy6v-mffg"
	const apiKey = "AIzaSyTest"

	a := &Adaptor{RequestMode: RequestModeClaude}
	info := newAPIKeyRelayInfo(projectID, apiKey)

	url, err := a.getRequestUrl(info, "claude-3-sonnet@20240229", "rawPredict")
	require.NoError(t, err)

	require.Contains(t, url, "/projects/"+projectID+"/locations/")
	require.Contains(t, url, "/publishers/anthropic/models/claude-3-sonnet@20240229:rawPredict")
	require.True(t, strings.HasSuffix(url, "key="+apiKey))
}

// TestGetRequestUrl_APIKey_EmptyProjectIDFallsBackToLegacyBehavior 确保未配置
// project_id 时退回旧行为（路径里不含 /projects/.../locations/...），不破坏现有部署。
func TestGetRequestUrl_APIKey_EmptyProjectIDFallsBackToLegacyBehavior(t *testing.T) {
	const apiKey = "AIzaSyTest"

	a := &Adaptor{RequestMode: RequestModeGemini}
	info := newAPIKeyRelayInfo("", apiKey) // 空 project_id

	url, err := a.getRequestUrl(info, "gemini-test", "generateContent")
	require.NoError(t, err)

	require.NotContains(t, url, "/projects/", "legacy behavior: no project_id → no /projects/ segment")
	require.Contains(t, url, "/publishers/google/models/gemini-test:generateContent")
	require.True(t, strings.HasSuffix(url, "key="+apiKey))
}
