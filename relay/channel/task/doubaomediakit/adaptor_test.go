package doubaomediakit

import (
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/model"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/relaykit/dto"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func newMediaKitTestContext(body string) (*gin.Context, *relaycommon.RelayInfo) {
	request := httptest.NewRequest(http.MethodPost, constant.ArkContentGenerationTasksPath, strings.NewReader(body))
	request.Header.Set("Content-Type", "application/json")
	context, _ := gin.CreateTestContext(httptest.NewRecorder())
	context.Request = request
	info := &relaycommon.RelayInfo{
		OriginModelName: "doubao-seedance-2-0-260128",
		ChannelMeta:     &relaycommon.ChannelMeta{ApiKey: "ark-key|mediakit-key"},
		TaskRelayInfo:   &relaycommon.TaskRelayInfo{PublicTaskID: "task_public"},
	}
	return context, info
}

func TestParseCredentialsSupportsPipeAndJSON(t *testing.T) {
	tests := []struct {
		name string
		raw  string
	}{
		{name: "pipe", raw: " ark-key | mediakit-key "},
		{name: "json", raw: `{"ark_api_key":"ark-key","mediakit_api_key":"mediakit-key"}`},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			keys, err := ParseCredentials(test.raw)

			require.NoError(t, err)
			assert.Equal(t, "ark-key", keys.ArkAPIKey)
			assert.Equal(t, "mediakit-key", keys.MediaKitAPIKey)
		})
	}
}

func TestTaskStageRoundTrip(t *testing.T) {
	generationID := newGenerationStage(resolution1080P, "ark:task/with punctuation")
	generation, err := parseTaskStage(generationID)
	require.NoError(t, err)
	assert.Equal(t, stageGeneration, generation.Phase)
	assert.Equal(t, resolution1080P, generation.TargetResolution)
	assert.Equal(t, "ark:task/with punctuation", generation.ArkTaskID)

	enhancementID := newEnhancementStage(resolution720P, "ark-task", "media:kit/task")
	enhancement, err := parseTaskStage(enhancementID)
	require.NoError(t, err)
	assert.Equal(t, stageEnhancement, enhancement.Phase)
	assert.Equal(t, "ark-task", enhancement.ArkTaskID)
	assert.Equal(t, "media:kit/task", enhancement.MediaKitTaskID)
}

func TestResolutionPolicyRewritesOnlyUpstreamResolution(t *testing.T) {
	gin.SetMode(gin.TestMode)
	tests := []struct {
		requested string
		generated string
	}{
		{requested: resolution720P, generated: resolution480P},
		{requested: resolution1080P, generated: resolution720P},
	}

	for _, test := range tests {
		t.Run(test.requested, func(t *testing.T) {
			context, info := newMediaKitTestContext(`{
				"model":"doubao-seedance-2-0-260128",
				"content":[{"type":"text","text":"a cinematic sunrise"}],
				"resolution":"` + test.requested + `"
			}`)
			adaptor := &TaskAdaptor{}
			adaptor.Init(info)

			require.Nil(t, adaptor.ValidateRequestAndSetAction(context, info))
			requestBody, err := adaptor.BuildRequestBody(context, info)
			require.NoError(t, err)
			body, err := io.ReadAll(requestBody)
			require.NoError(t, err)
			var payload map[string]any
			require.NoError(t, common.Unmarshal(body, &payload))
			assert.Equal(t, test.generated, payload["resolution"])
			assert.Equal(t, test.requested, adaptor.targetResolution)
		})
	}
}

func TestResolutionPolicyRejectsUnsupportedResolution(t *testing.T) {
	gin.SetMode(gin.TestMode)
	context, info := newMediaKitTestContext(`{
		"model":"doubao-seedance-2-0-260128",
		"content":[{"type":"text","text":"a cinematic sunrise"}],
		"resolution":"480p"
	}`)
	adaptor := &TaskAdaptor{}
	adaptor.Init(info)

	taskErr := adaptor.ValidateRequestAndSetAction(context, info)

	require.NotNil(t, taskErr)
	assert.Equal(t, "invalid_resolution", taskErr.Code)
}

func TestEstimateBillingUsesGenerationResolution(t *testing.T) {
	gin.SetMode(gin.TestMode)
	context, info := newMediaKitTestContext(`{
		"model":"doubao-seedance-2-0-260128",
		"content":[{"type":"text","text":"a cinematic sunrise"}],
		"resolution":"1080p"
	}`)
	adaptor := &TaskAdaptor{}
	adaptor.Init(info)

	require.Nil(t, adaptor.ValidateRequestAndSetAction(context, info))
	assert.Nil(t, adaptor.EstimateBilling(context, info))
}

func TestInitUsesCustomMediaKitBaseURL(t *testing.T) {
	info := &relaycommon.RelayInfo{
		ChannelMeta: &relaycommon.ChannelMeta{
			ApiKey: "ark-key|mediakit-key",
			ChannelOtherSettings: dto.ChannelOtherSettings{
				MediaKitBaseURL: "https://amk.example.com/",
			},
		},
	}
	adaptor := &TaskAdaptor{}
	adaptor.Init(info)
	assert.Equal(t, "https://amk.example.com", adaptor.mediaKitBaseURL)
}

func TestFetchTaskTransitionsFromArkToMediaKit(t *testing.T) {
	var mediaKitSubmit mediaKitSubmitRequest
	server := httptest.NewServer(http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
		writer.Header().Set("Content-Type", "application/json")
		switch request.URL.Path {
		case constant.ArkContentGenerationTasksPath + "/ark-task":
			assert.Equal(t, "Bearer ark-key", request.Header.Get("Authorization"))
			_, _ = writer.Write([]byte(`{
				"id":"ark-task",
				"status":"succeeded",
				"resolution":"720p",
				"content":{"video_url":"https://example.com/generated-720p.mp4"}
			}`))
		case mediaKitEnhancePath:
			assert.Equal(t, http.MethodPost, request.Method)
			assert.Equal(t, "Bearer mediakit-key", request.Header.Get("Authorization"))
			requestBody, readErr := io.ReadAll(request.Body)
			assert.NoError(t, readErr)
			assert.NoError(t, common.Unmarshal(requestBody, &mediaKitSubmit))
			_, _ = writer.Write([]byte(`{"success":true,"task_id":"mediakit-task"}`))
		case mediaKitTaskPath + "mediakit-task":
			assert.Equal(t, "Bearer mediakit-key", request.Header.Get("Authorization"))
			_, _ = writer.Write([]byte(`{
				"success":true,
				"task_id":"mediakit-task",
				"task_type":"enhance-video",
				"status":"completed",
				"result":{"video_url":"https://example.com/final-1080p.mp4"}
			}`))
		default:
			http.NotFound(writer, request)
		}
	}))
	t.Cleanup(server.Close)

	info := &relaycommon.RelayInfo{ChannelMeta: &relaycommon.ChannelMeta{ApiKey: "ark-key|mediakit-key"}}
	adaptor := &TaskAdaptor{}
	adaptor.Init(info)
	adaptor.mediaKitBaseURL = server.URL
	generationID := newGenerationStage(resolution1080P, "ark-task")

	transitionHTTPResponse, err := adaptor.FetchTask(server.URL, info.ApiKey, map[string]any{"task_id": generationID}, "")
	require.NoError(t, err)
	transitionBody, err := io.ReadAll(transitionHTTPResponse.Body)
	require.NoError(t, err)
	_ = transitionHTTPResponse.Body.Close()
	transitionResult, err := adaptor.ParseTaskResult(transitionBody)
	require.NoError(t, err)
	assert.Equal(t, string(model.TaskStatusInProgress), transitionResult.Status)
	assert.Equal(t, "70%", transitionResult.Progress)
	assert.Equal(t, "https://example.com/generated-720p.mp4", mediaKitSubmit.VideoURL)
	assert.Equal(t, resolution1080P, mediaKitSubmit.Resolution)
	assert.Equal(t, "aigc", mediaKitSubmit.Scene)
	assert.Equal(t, "standard", mediaKitSubmit.ToolVersion)
	assert.NotEmpty(t, mediaKitSubmit.ClientToken)

	completedHTTPResponse, err := adaptor.FetchTask(server.URL, info.ApiKey, map[string]any{"task_id": transitionResult.TaskID}, "")
	require.NoError(t, err)
	completedBody, err := io.ReadAll(completedHTTPResponse.Body)
	require.NoError(t, err)
	_ = completedHTTPResponse.Body.Close()
	completedResult, err := adaptor.ParseTaskResult(completedBody)
	require.NoError(t, err)
	assert.Equal(t, string(model.TaskStatusSuccess), completedResult.Status)
	assert.Equal(t, "100%", completedResult.Progress)
	assert.Equal(t, "https://example.com/final-1080p.mp4", completedResult.Url)
}

func TestConvertToArkVideoReturnsRequestedResolutionAndFinalURL(t *testing.T) {
	originTask := &model.Task{
		TaskID:     "task_public",
		Status:     model.TaskStatusSuccess,
		CreatedAt:  100,
		UpdatedAt:  200,
		Properties: model.Properties{OriginModelName: "doubao-seedance-2-0-260128"},
		PrivateData: model.TaskPrivateData{
			UpstreamTaskID: newEnhancementStage(resolution1080P, "ark-task", "mediakit-task"),
			ResultURL:      "https://example.com/final-1080p.mp4",
		},
	}

	body, err := (&TaskAdaptor{}).ConvertToArkVideo(originTask)

	require.NoError(t, err)
	var response map[string]any
	require.NoError(t, common.Unmarshal(body, &response))
	assert.Equal(t, "task_public", response["id"])
	assert.Equal(t, "succeeded", response["status"])
	assert.Equal(t, resolution1080P, response["resolution"])
	content, ok := response["content"].(map[string]any)
	require.True(t, ok)
	assert.Equal(t, "https://example.com/final-1080p.mp4", content["video_url"])
}
