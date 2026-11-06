package githubcopilot

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/QuantumNous/new-api/constant"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	copilot "github.com/QuantumNous/new-api/service/githubcopilot"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestSetupRequestHeaderUsesEndpointCredential(t *testing.T) {
	profileKey := `{"profile_id":"11111111-1111-4111-8111-111111111111","login":"octocat"}`
	adaptor := &Adaptor{
		key: copilot.ChannelKey{
			ProfileID: "11111111-1111-4111-8111-111111111111",
			Login:     "octocat",
		},
		endpoint: &copilot.Endpoint{
			Type:    "openai",
			BaseURL: "https://api.githubcopilot.com",
			APIKey:  "endpoint-key",
			Headers: map[string]string{"Editor-Version": "new-api"},
		},
		protocol: copilot.ProtocolOpenAIChat,
	}
	info := &relaycommon.RelayInfo{
		ChannelMeta: &relaycommon.ChannelMeta{
			ApiKey:      profileKey,
			ChannelType: constant.ChannelTypeGitHubCopilot,
		},
	}
	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Request = httptest.NewRequest(http.MethodPost, "/v1/chat/completions", nil)
	headers := http.Header{"Authorization": []string{"Bearer stale"}}

	require.NoError(t, adaptor.SetupRequestHeader(ctx, &headers, info))
	assert.Equal(t, "Bearer endpoint-key", headers.Get("Authorization"))
	assert.Empty(t, headers.Get("x-api-key"))
	assert.Equal(t, "new-api", headers.Get("Editor-Version"))
	assert.NotContains(t, headers.Get("Authorization"), "profile_id")
}
