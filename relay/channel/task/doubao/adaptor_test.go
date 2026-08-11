package doubao

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/model"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func newDoubaoTestContext(body string) (*gin.Context, *relaycommon.RelayInfo) {
	request := httptest.NewRequest(http.MethodPost, "/v1/video/generations", strings.NewReader(body))
	request.Header.Set("Content-Type", "application/json")
	context, _ := gin.CreateTestContext(httptest.NewRecorder())
	context.Request = request
	info := &relaycommon.RelayInfo{
		OriginModelName: "doubao-seedance-2-5-260628",
		TaskRelayInfo:   &relaycommon.TaskRelayInfo{},
	}
	return context, info
}

func TestValidateAndConvertArkTopLevelFields(t *testing.T) {
	gin.SetMode(gin.TestMode)
	context, info := newDoubaoTestContext(`{
		"model":"doubao-seedance-2-5-260628",
		"content":[{"type":"audio_url","audio_url":{"url":"https://example.com/reference.mp3"}}],
		"duration":-1,
		"resolution":"720p",
		"output_format":"mp4",
		"generate_audio":false,
		"watermark":false,
		"seed":0
	}`)
	adaptor := &TaskAdaptor{}

	taskErr := adaptor.ValidateRequestAndSetAction(context, info)

	require.Nil(t, taskErr)
	assert.Equal(t, constant.TaskActionGenerate, info.Action)
	req, err := relaycommon.GetTaskRequest(context)
	require.NoError(t, err)
	payload, err := adaptor.convertToRequestPayload(&req)
	require.NoError(t, err)
	require.Len(t, payload.Content, 1)
	assert.Equal(t, "audio_url", payload.Content[0].Type)
	require.NotNil(t, payload.Content[0].AudioURL)
	assert.Equal(t, "https://example.com/reference.mp3", payload.Content[0].AudioURL.URL)
	require.NotNil(t, payload.Duration)
	assert.Equal(t, -1, int(*payload.Duration))
	assert.Equal(t, "720p", payload.Resolution)
	assert.Equal(t, "mp4", payload.OutputFormat)
	require.NotNil(t, payload.GenerateAudio)
	assert.False(t, bool(*payload.GenerateAudio))
	require.NotNil(t, payload.Watermark)
	assert.False(t, bool(*payload.Watermark))
	require.NotNil(t, payload.Seed)
	assert.Zero(t, int(*payload.Seed))
}

func TestValidateRejectsRequestWithoutAnyContent(t *testing.T) {
	gin.SetMode(gin.TestMode)
	context, info := newDoubaoTestContext(`{"model":"doubao-seedance-2-5-260628","duration":-1}`)
	adaptor := &TaskAdaptor{}

	taskErr := adaptor.ValidateRequestAndSetAction(context, info)

	require.NotNil(t, taskErr)
	assert.Equal(t, "invalid_request", taskErr.Code)
}

func TestConvertPreservesDraftTaskAndFramesTakePrecedence(t *testing.T) {
	gin.SetMode(gin.TestMode)
	context, info := newDoubaoTestContext(`{
		"model":"doubao-seedance-2-5-260628",
		"content":[
			{"type":"draft_task","draft_task":{"id":"draft-task-id"}},
			{"type":"text","text":"continue this draft"}
		],
		"duration":8,
		"frames":121
	}`)
	adaptor := &TaskAdaptor{}

	require.Nil(t, adaptor.ValidateRequestAndSetAction(context, info))
	req, err := relaycommon.GetTaskRequest(context)
	require.NoError(t, err)
	payload, err := adaptor.convertToRequestPayload(&req)
	require.NoError(t, err)
	require.Len(t, payload.Content, 2)
	require.NotNil(t, payload.Content[0].DraftTask)
	assert.Equal(t, "draft-task-id", payload.Content[0].DraftTask.ID)
	require.NotNil(t, payload.Frames)
	assert.Equal(t, 121, int(*payload.Frames))
	assert.Nil(t, payload.Duration)
}

func TestEstimateBillingUsesMappedModelAndPayloadResolution(t *testing.T) {
	gin.SetMode(gin.TestMode)
	context, info := newDoubaoTestContext(`{
		"model":"my-seedance-alias",
		"content":[{"type":"video_url","video_url":{"url":"https://example.com/reference.mp4"}}],
		"resolution":"1080p"
	}`)
	info.OriginModelName = "my-seedance-alias"
	info.UpstreamModelName = "doubao-seedance-2-0-260128"
	info.IsModelMapped = true
	adaptor := &TaskAdaptor{}

	require.Nil(t, adaptor.ValidateRequestAndSetAction(context, info))
	ratios := adaptor.EstimateBilling(context, info)

	require.Contains(t, ratios, "seedance_unit_price")
	assert.InDelta(t, 31.0/46.0, ratios["seedance_unit_price"], 1e-9)
}

func TestParseTaskResultUsesCompletionTokensAsBillingTotal(t *testing.T) {
	adaptor := &TaskAdaptor{}

	result, err := adaptor.ParseTaskResult([]byte(`{
		"id":"upstream-task",
		"status":"succeeded",
		"content":{"video_url":"https://example.com/result.mp4"},
		"usage":{"completion_tokens":1234}
	}`))

	require.NoError(t, err)
	assert.Equal(t, model.TaskStatusSuccess, result.Status)
	assert.Equal(t, 1234, result.CompletionTokens)
	assert.Equal(t, 1234, result.TotalTokens)
	assert.Equal(t, "https://example.com/result.mp4", result.Url)
}

func TestParseTaskResultTreatsCancelledAsTerminalFailure(t *testing.T) {
	adaptor := &TaskAdaptor{}

	result, err := adaptor.ParseTaskResult([]byte(`{"id":"upstream-task","status":"cancelled"}`))

	require.NoError(t, err)
	assert.Equal(t, model.TaskStatusFailure, result.Status)
	assert.Equal(t, "100%", result.Progress)
	assert.Equal(t, "task cancelled", result.Reason)
}

func TestParseTaskResultTreatsExpiredAsTerminalFailure(t *testing.T) {
	adaptor := &TaskAdaptor{}

	result, err := adaptor.ParseTaskResult([]byte(`{"id":"upstream-task","status":"expired"}`))

	require.NoError(t, err)
	assert.Equal(t, model.TaskStatusFailure, result.Status)
	assert.Equal(t, "100%", result.Progress)
	assert.Equal(t, "task expired", result.Reason)
}

func TestConvertToOpenAIVideoExposesLastFrameURL(t *testing.T) {
	adaptor := &TaskAdaptor{}
	originTask := &model.Task{
		TaskID:   "public-task-id",
		Status:   model.TaskStatus(model.TaskStatusSuccess),
		Progress: "100%",
		Data: []byte(`{
			"id":"upstream-task",
			"status":"succeeded",
			"content":{
				"video_url":"https://example.com/result.mp4",
				"last_frame_url":"https://example.com/last-frame.jpeg"
			}
		}`),
		Properties: model.Properties{OriginModelName: "doubao-seedance-2-5-260628"},
	}

	responseBody, err := adaptor.ConvertToOpenAIVideo(originTask)

	require.NoError(t, err)
	var response map[string]interface{}
	require.NoError(t, common.Unmarshal(responseBody, &response))
	metadata, ok := response["metadata"].(map[string]interface{})
	require.True(t, ok)
	assert.Equal(t, "https://example.com/result.mp4", metadata["url"])
	assert.Equal(t, "https://example.com/last-frame.jpeg", metadata["last_frame_url"])
}
