package vertex

import (
	"context"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	omnitask "github.com/QuantumNous/new-api/relay/channel/task/omni"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestOmniBuildRequestURL(t *testing.T) {
	info := &relaycommon.RelayInfo{
		ChannelMeta: &relaycommon.ChannelMeta{
			ApiKey:            `{"project_id":"vertex-project"}`,
			UpstreamModelName: omnitask.ModelGeminiOmniFlashPreview,
		},
	}
	adaptor := &TaskAdaptor{}
	adaptor.Init(info)

	requestURL, err := adaptor.BuildRequestURL(info)
	require.NoError(t, err)
	assert.Equal(t, "https://aiplatform.googleapis.com/v1beta1/projects/vertex-project/locations/global/interactions", requestURL)
	assert.Contains(t, adaptor.GetModelList(), omnitask.ModelGeminiOmniFlashPreview)
}

func TestOmniMappedAliasRunsReferenceVideoValidation(t *testing.T) {
	gin.SetMode(gin.TestMode)
	request := httptest.NewRequestWithContext(context.Background(), http.MethodPost, "/v1/videos", strings.NewReader(`{
		"model":"gemini-omni-flash",
		"prompt":"edit this video",
		"duration":3,
		"video":"not-valid-base64"
	}`))
	request.Header.Set("Content-Type", "application/json")
	context, _ := gin.CreateTestContext(httptest.NewRecorder())
	context.Request = request
	context.Set("model_mapping", `{"gemini-omni-flash":"gemini-omni-flash-preview"}`)
	info := &relaycommon.RelayInfo{
		OriginModelName: "gemini-omni-flash",
		ChannelMeta:     &relaycommon.ChannelMeta{},
		TaskRelayInfo:   &relaycommon.TaskRelayInfo{},
	}

	taskErr := (&TaskAdaptor{}).ValidateRequestAndSetAction(context, info)

	require.NotNil(t, taskErr)
	assert.Equal(t, "invalid_omni_request", taskErr.Code)
	assert.Contains(t, taskErr.Message, "invalid base64 video data")
	assert.Equal(t, omnitask.ModelGeminiOmniFlashPreview, info.UpstreamModelName)
}
