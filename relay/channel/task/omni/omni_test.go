package omni

import (
	"encoding/base64"
	"io"
	"net/http/httptest"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/model"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func newTaskContext(t *testing.T, req relaycommon.TaskSubmitReq) *gin.Context {
	t.Helper()
	gin.SetMode(gin.TestMode)
	context, _ := gin.CreateTestContext(httptest.NewRecorder())
	context.Request = httptest.NewRequest("POST", "/v1/videos", nil)
	context.Set("task_request", req)
	return context
}

func TestBuildRequestBodyIncludesPromptReferenceImagesAndAsyncState(t *testing.T) {
	imageOne := base64.StdEncoding.EncodeToString([]byte("image-one"))
	imageTwo := base64.StdEncoding.EncodeToString([]byte("image-two"))
	req := relaycommon.TaskSubmitReq{
		Prompt:   "A product rotates on a pedestal.",
		Images:   []string{"data:image/png;base64," + imageOne, "data:image/jpeg;base64," + imageTwo},
		Duration: 5,
		Size:     "720x1280",
		Metadata: map[string]any{"previous_interaction_id": "interaction_previous"},
	}
	context := newTaskContext(t, req)
	info := &relaycommon.RelayInfo{
		ChannelMeta:   &relaycommon.ChannelMeta{UpstreamModelName: ModelGeminiOmniFlashPreview},
		TaskRelayInfo: &relaycommon.TaskRelayInfo{},
	}

	body, err := BuildRequestBody(context, info)
	require.NoError(t, err)
	raw, err := io.ReadAll(body)
	require.NoError(t, err)
	var request interactionRequest
	require.NoError(t, common.Unmarshal(raw, &request))

	assert.Equal(t, ModelGeminiOmniFlashPreview, request.Model)
	assert.True(t, request.Background)
	assert.True(t, request.Store)
	assert.Equal(t, "interaction_previous", request.PreviousInteractionID)
	assert.Equal(t, responseFormat{Type: "video", AspectRatio: "9:16"}, request.ResponseFormat)
	require.Len(t, request.Input, 3)
	assert.Contains(t, request.Input[0].Text, "Generate exactly a 5-second video.")
	assert.Equal(t, inputPart{Type: "image", MimeType: "image/png", Data: imageOne}, request.Input[1])
	assert.Equal(t, inputPart{Type: "image", MimeType: "image/jpeg", Data: imageTwo}, request.Input[2])
	assert.Equal(t, constant.TaskActionGenerate, info.Action)
}

func TestValidateRequestEnforcesOmniBounds(t *testing.T) {
	tests := []struct {
		name    string
		req     relaycommon.TaskSubmitReq
		wantErr string
	}{
		{
			name:    "duration below minimum",
			req:     relaycommon.TaskSubmitReq{Prompt: "test", Duration: 2},
			wantErr: "duration must be between 3 and 10 seconds",
		},
		{
			name:    "duration above maximum",
			req:     relaycommon.TaskSubmitReq{Prompt: "test", Duration: 11},
			wantErr: "duration must be between 3 and 10 seconds",
		},
		{
			name:    "unsupported aspect ratio",
			req:     relaycommon.TaskSubmitReq{Prompt: "test", Duration: 3, Metadata: map[string]any{"aspect_ratio": "1:1"}},
			wantErr: "aspect_ratio must be 16:9 or 9:16",
		},
		{
			name:    "too many images",
			req:     relaycommon.TaskSubmitReq{Prompt: "test", Duration: 3, Images: make([]string, MaxImages+1)},
			wantErr: "images must contain at most 10 items",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			context := newTaskContext(t, tt.req)
			err := ValidateRequest(context, &relaycommon.RelayInfo{TaskRelayInfo: &relaycommon.TaskRelayInfo{}})
			require.Error(t, err)
			assert.Contains(t, err.Error(), tt.wantErr)
		})
	}
}

func TestParseInteractionLifecycle(t *testing.T) {
	upstreamName, err := ParseSubmitResponse([]byte(`{"id":"interaction_123","status":"in_progress","model":"gemini-omni-flash-preview"}`))
	require.NoError(t, err)
	assert.Equal(t, "interactions/interaction_123", upstreamName)

	inProgress, err := ParseTaskResult([]byte(`{"id":"interaction_123","status":"in_progress"}`))
	require.NoError(t, err)
	assert.Equal(t, string(model.TaskStatusInProgress), inProgress.Status)

	completed, err := ParseTaskResult([]byte(`{
		"id":"interaction_123",
		"status":"completed",
		"steps":[{"type":"model_output","content":[{"type":"video","mime_type":"video/mp4","data":"dmlkZW8="}]}],
		"usage":{"total_tokens":17682,"total_output_tokens":17376}
	}`))
	require.NoError(t, err)
	assert.Equal(t, string(model.TaskStatusSuccess), completed.Status)
	assert.Equal(t, "data:video/mp4;base64,dmlkZW8=", completed.Url)
	assert.Equal(t, 17682, completed.TotalTokens)
	assert.Equal(t, 17376, completed.CompletionTokens)
}

func TestParseCompletedInteractionWithoutVideoFails(t *testing.T) {
	result, err := ParseTaskResult([]byte(`{"id":"interaction_123","status":"completed","steps":[]}`))
	require.NoError(t, err)
	assert.Equal(t, string(model.TaskStatusFailure), result.Status)
	assert.Contains(t, result.Reason, "did not contain video")
}
