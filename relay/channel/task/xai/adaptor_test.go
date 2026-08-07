package xai

import (
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/setting/system_setting"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestBuildRequestURLMatchesCLIProxyVideoRoutes(t *testing.T) {
	adaptor := &TaskAdaptor{}
	adaptor.Init(&relaycommon.RelayInfo{ChannelMeta: &relaycommon.ChannelMeta{ChannelBaseUrl: "http://cliproxy:8317"}})

	tests := map[string]string{
		"/v1/videos":             "http://cliproxy:8317/v1/videos",
		"/v1/videos/generations": "http://cliproxy:8317/v1/videos/generations",
		"/v1/videos/edits":       "http://cliproxy:8317/v1/videos/edits",
		"/v1/videos/extensions":  "http://cliproxy:8317/v1/videos/extensions",
		"/openai/v1/videos":      "http://cliproxy:8317/openai/v1/videos",
	}
	for path, want := range tests {
		t.Run(path, func(t *testing.T) {
			got, err := adaptor.BuildRequestURL(&relaycommon.RelayInfo{RequestURLPath: path})
			require.NoError(t, err)
			assert.Equal(t, want, got)
		})
	}
}

func TestDoResponsePreservesNativeAndOpenAIContracts(t *testing.T) {
	gin.SetMode(gin.TestMode)
	tests := []struct {
		name          string
		path          string
		upstreamBody  string
		publicIDField string
		removedField  string
	}{
		{
			name:          "xAI native",
			path:          "/v1/videos",
			upstreamBody:  `{"request_id":"vid_upstream","status":"pending"}`,
			publicIDField: "request_id",
			removedField:  "id",
		},
		{
			name:          "OpenAI compatible",
			path:          "/openai/v1/videos",
			upstreamBody:  `{"id":"vid_upstream","object":"video","status":"queued"}`,
			publicIDField: "id",
			removedField:  "request_id",
		},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			recorder := httptest.NewRecorder()
			ctx, _ := gin.CreateTestContext(recorder)
			resp := &http.Response{Body: io.NopCloser(strings.NewReader(test.upstreamBody))}
			info := &relaycommon.RelayInfo{
				RequestURLPath: test.path,
				TaskRelayInfo: &relaycommon.TaskRelayInfo{
					PublicTaskID: "task_public",
				},
			}

			upstreamID, taskData, taskErr := (&TaskAdaptor{}).DoResponse(ctx, resp, info)
			require.Nil(t, taskErr)
			assert.Equal(t, "vid_upstream", upstreamID)
			assert.JSONEq(t, test.upstreamBody, string(taskData))

			var payload map[string]any
			require.NoError(t, common.Unmarshal(recorder.Body.Bytes(), &payload))
			assert.Equal(t, "task_public", payload[test.publicIDField])
			_, exists := payload[test.removedField]
			assert.False(t, exists)
		})
	}
}

func TestParseTaskResultMapsXAICompletedVideo(t *testing.T) {
	result, err := (&TaskAdaptor{}).ParseTaskResult([]byte(`{
		"status":"done",
		"progress":100,
		"video":{"url":"https://vidgen.x.ai/video.mp4","duration":6}
	}`))
	require.NoError(t, err)
	assert.Equal(t, string(model.TaskStatusSuccess), result.Status)
	assert.Equal(t, "100%", result.Progress)
	assert.Equal(t, "https://vidgen.x.ai/video.mp4", result.Url)
}

func TestNativeEditAllowsProviderSpecificPayloadWithoutPrompt(t *testing.T) {
	gin.SetMode(gin.TestMode)
	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Request = httptest.NewRequest(http.MethodPost, "/v1/videos/edits", strings.NewReader(`{
		"model":"grok-imagine-video-1.5",
		"request_id":"vid_source"
	}`))
	ctx.Request.Header.Set("Content-Type", "application/json")

	info := &relaycommon.RelayInfo{
		RequestURLPath: "/v1/videos/edits",
		TaskRelayInfo:  &relaycommon.TaskRelayInfo{},
	}
	taskErr := (&TaskAdaptor{}).ValidateRequestAndSetAction(ctx, info)
	require.Nil(t, taskErr)
}

func TestVideoConvertersExposePublicIDsAndProxyURLs(t *testing.T) {
	previousServerAddress := system_setting.ServerAddress
	system_setting.ServerAddress = "https://video-proxy.example.com/"
	t.Cleanup(func() { system_setting.ServerAddress = previousServerAddress })

	task := &model.Task{
		TaskID:     "task_public",
		Status:     model.TaskStatusSuccess,
		Progress:   "100%",
		CreatedAt:  100,
		FinishTime: 200,
		Properties: model.Properties{OriginModelName: "grok-imagine-video-1.5"},
		PrivateData: model.TaskPrivateData{
			ResultURL: "https://vidgen.x.ai/video.mp4",
		},
		Data: []byte(`{"request_id":"vid_upstream","model":"grok-imagine-video-1.5","status":"done","video":{"url":"https://vidgen.x.ai/video.mp4","duration":6}}`),
	}
	adaptor := &TaskAdaptor{}

	nativeBody, err := adaptor.ConvertToNativeVideo(task)
	require.NoError(t, err)
	var native map[string]any
	require.NoError(t, common.Unmarshal(nativeBody, &native))
	assert.Equal(t, "task_public", native["request_id"])
	_, hasNativeID := native["id"]
	assert.False(t, hasNativeID)
	nativeVideo, ok := native["video"].(map[string]any)
	require.True(t, ok)
	assert.Equal(t, "https://video-proxy.example.com/v1/videos/task_public/content", nativeVideo["url"])

	openAIBody, err := adaptor.ConvertToOpenAIVideo(task)
	require.NoError(t, err)
	var openAI map[string]any
	require.NoError(t, common.Unmarshal(openAIBody, &openAI))
	assert.Equal(t, "task_public", openAI["id"])
	assert.Equal(t, "grok-imagine-video-1.5", openAI["model"])
	assert.Equal(t, "completed", openAI["status"])
	assert.Equal(t, "https://video-proxy.example.com/v1/videos/task_public/content", openAI["video_url"])
	assert.Equal(t, "6", openAI["seconds"])
	assert.Equal(t, "https://vidgen.x.ai/video.mp4", task.GetResultURL())
}
