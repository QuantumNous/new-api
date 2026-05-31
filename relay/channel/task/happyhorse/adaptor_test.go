package happyhorse

import (
	"bytes"
	"io"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/model"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// ============================
// convertToHappyHorseRequest tests
// ============================

func TestConvertToHappyHorseRequest_TextToVideo(t *testing.T) {
	info := &relaycommon.RelayInfo{
		ChannelMeta: &relaycommon.ChannelMeta{
			UpstreamModelName: "happyhorse-1.0-t2v",
		},
	}
	req := relaycommon.TaskSubmitReq{
		Prompt: "A cat playing piano",
		Model:  "happyhorse-1.0-t2v",
	}

	hhReq, err := convertToHappyHorseRequest(info, req)
	require.NoError(t, err)
	assert.Equal(t, "happyhorse-1.0-t2v", hhReq.Model)
	assert.Equal(t, "A cat playing piano", hhReq.Input.Prompt)
	assert.Empty(t, hhReq.Input.Media)
	assert.Equal(t, "720P", hhReq.Parameters.Resolution)
	assert.Equal(t, 5, *hhReq.Parameters.Duration)
	assert.True(t, *hhReq.Parameters.PromptExtend)
}

func TestConvertToHappyHorseRequest_ImageToVideo(t *testing.T) {
	info := &relaycommon.RelayInfo{
		ChannelMeta: &relaycommon.ChannelMeta{
			UpstreamModelName: "happyhorse-1.0-i2v",
		},
	}
	req := relaycommon.TaskSubmitReq{
		Prompt:         "A dog running",
		Model:          "happyhorse-1.0-i2v",
		InputReference: "https://example.com/image.jpg",
	}

	hhReq, err := convertToHappyHorseRequest(info, req)
	require.NoError(t, err)
	assert.Equal(t, "happyhorse-1.0-i2v", hhReq.Model)
	require.Len(t, hhReq.Input.Media, 1)
	assert.Equal(t, "image_url", hhReq.Input.Media[0].Type)
	assert.Equal(t, "https://example.com/image.jpg", hhReq.Input.Media[0].ImageURL.URL)
}

func TestConvertToHappyHorseRequest_ReferenceToVideo(t *testing.T) {
	info := &relaycommon.RelayInfo{
		ChannelMeta: &relaycommon.ChannelMeta{
			UpstreamModelName: "happyhorse-1.0-r2v",
		},
	}
	req := relaycommon.TaskSubmitReq{
		Prompt:         "A flying bird",
		Model:          "happyhorse-1.0-r2v",
		InputReference: "https://example.com/frame1.jpg",
		Images:         []string{"https://example.com/frame2.jpg", "https://example.com/frame3.jpg"},
	}

	hhReq, err := convertToHappyHorseRequest(info, req)
	require.NoError(t, err)
	// InputReference + 2 images = 3 media items
	require.Len(t, hhReq.Input.Media, 3)
	for _, m := range hhReq.Input.Media {
		assert.Equal(t, "image_url", m.Type)
		assert.NotNil(t, m.ImageURL)
	}
	assert.Equal(t, "https://example.com/frame1.jpg", hhReq.Input.Media[0].ImageURL.URL)
	assert.Equal(t, "https://example.com/frame2.jpg", hhReq.Input.Media[1].ImageURL.URL)
	assert.Equal(t, "https://example.com/frame3.jpg", hhReq.Input.Media[2].ImageURL.URL)
}

func TestConvertToHappyHorseRequest_VideoEdit(t *testing.T) {
	info := &relaycommon.RelayInfo{
		ChannelMeta: &relaycommon.ChannelMeta{
			UpstreamModelName: "happyhorse-1.0-video-edit",
		},
	}
	req := relaycommon.TaskSubmitReq{
		Prompt:         "Add sunglasses to the person",
		Model:          "happyhorse-1.0-video-edit",
		InputReference: "https://example.com/video.mp4",
		Images:         []string{"https://example.com/ref.jpg"},
	}

	hhReq, err := convertToHappyHorseRequest(info, req)
	require.NoError(t, err)
	require.Len(t, hhReq.Input.Media, 2)
	// First item should be video_url
	assert.Equal(t, "video_url", hhReq.Input.Media[0].Type)
	assert.NotNil(t, hhReq.Input.Media[0].VideoURL)
	assert.Equal(t, "https://example.com/video.mp4", hhReq.Input.Media[0].VideoURL.URL)
	// Second item should be image_url
	assert.Equal(t, "image_url", hhReq.Input.Media[1].Type)
	assert.Equal(t, "https://example.com/ref.jpg", hhReq.Input.Media[1].ImageURL.URL)
}

func TestConvertToHappyHorseRequest_CustomSizeAndDuration(t *testing.T) {
	info := &relaycommon.RelayInfo{
		ChannelMeta: &relaycommon.ChannelMeta{
			UpstreamModelName: "happyhorse-1.0-t2v",
		},
	}
	req := relaycommon.TaskSubmitReq{
		Prompt:   "A sunset",
		Model:    "happyhorse-1.0-t2v",
		Size:     "1080",
		Duration: 8,
	}

	hhReq, err := convertToHappyHorseRequest(info, req)
	require.NoError(t, err)
	assert.Equal(t, "1080P", hhReq.Parameters.Resolution)
	assert.Equal(t, 8, *hhReq.Parameters.Duration)
}

func TestConvertToHappyHorseRequest_SizeAlreadyWithP(t *testing.T) {
	info := &relaycommon.RelayInfo{
		ChannelMeta: &relaycommon.ChannelMeta{
			UpstreamModelName: "happyhorse-1.0-t2v",
		},
	}
	req := relaycommon.TaskSubmitReq{
		Prompt: "test",
		Model:  "happyhorse-1.0-t2v",
		Size:   "480p",
	}

	hhReq, err := convertToHappyHorseRequest(info, req)
	require.NoError(t, err)
	assert.Equal(t, "480P", hhReq.Parameters.Resolution)
}

func TestConvertToHappyHorseRequest_ModelMapped(t *testing.T) {
	info := &relaycommon.RelayInfo{
		ChannelMeta: &relaycommon.ChannelMeta{
			UpstreamModelName: "mapped-model-t2v",
			IsModelMapped:     true,
		},
	}
	req := relaycommon.TaskSubmitReq{
		Prompt: "test",
		Model:  "original-model",
	}

	hhReq, err := convertToHappyHorseRequest(info, req)
	require.NoError(t, err)
	assert.Equal(t, "mapped-model-t2v", hhReq.Model)
}

func TestConvertToHappyHorseRequest_VideoEditNoImages(t *testing.T) {
	info := &relaycommon.RelayInfo{
		ChannelMeta: &relaycommon.ChannelMeta{
			UpstreamModelName: "happyhorse-1.0-video-edit",
		},
	}
	req := relaycommon.TaskSubmitReq{
		Prompt:         "Edit this video",
		Model:          "happyhorse-1.0-video-edit",
		InputReference: "https://example.com/video.mp4",
	}

	hhReq, err := convertToHappyHorseRequest(info, req)
	require.NoError(t, err)
	require.Len(t, hhReq.Input.Media, 1)
	assert.Equal(t, "video_url", hhReq.Input.Media[0].Type)
}

func TestConvertToHappyHorseRequest_EmptyImagesSkipped(t *testing.T) {
	info := &relaycommon.RelayInfo{
		ChannelMeta: &relaycommon.ChannelMeta{
			UpstreamModelName: "happyhorse-1.0-r2v",
		},
	}
	req := relaycommon.TaskSubmitReq{
		Prompt: "test",
		Model:  "happyhorse-1.0-r2v",
		Images: []string{"https://example.com/img.jpg", "", "https://example.com/img2.jpg"},
	}

	hhReq, err := convertToHappyHorseRequest(info, req)
	require.NoError(t, err)
	// Empty string should be skipped
	require.Len(t, hhReq.Input.Media, 2)
}

// ============================
// convertHappyHorseStatus tests
// ============================

func TestConvertHappyHorseStatus(t *testing.T) {
	tests := []struct {
		input    string
		expected string
	}{
		{"PENDING", dto.VideoStatusQueued},
		{"RUNNING", dto.VideoStatusInProgress},
		{"SUCCEEDED", dto.VideoStatusCompleted},
		{"FAILED", dto.VideoStatusFailed},
		{"CANCELED", dto.VideoStatusFailed},
		{"UNKNOWN", dto.VideoStatusFailed},
		{"SOMETHING_ELSE", dto.VideoStatusUnknown},
	}
	for _, tc := range tests {
		t.Run(tc.input, func(t *testing.T) {
			assert.Equal(t, tc.expected, convertHappyHorseStatus(tc.input))
		})
	}
}

// ============================
// ParseTaskResult tests
// ============================

func TestParseTaskResult_Pending(t *testing.T) {
	a := &TaskAdaptor{}
	respBody := []byte(`{
		"output": {"task_id": "task-123", "task_status": "PENDING"},
		"request_id": "req-001"
	}`)

	result, err := a.ParseTaskResult(respBody)
	require.NoError(t, err)
	assert.Equal(t, model.TaskStatusQueued, result.Status)
	assert.Empty(t, result.Url)
}

func TestParseTaskResult_Running(t *testing.T) {
	a := &TaskAdaptor{}
	respBody := []byte(`{
		"output": {"task_id": "task-123", "task_status": "RUNNING"},
		"request_id": "req-002"
	}`)

	result, err := a.ParseTaskResult(respBody)
	require.NoError(t, err)
	assert.Equal(t, model.TaskStatusInProgress, result.Status)
}

func TestParseTaskResult_Succeeded(t *testing.T) {
	a := &TaskAdaptor{}
	respBody := []byte(`{
		"output": {"task_id": "task-123", "task_status": "SUCCEEDED", "video_url": "https://example.com/out.mp4"},
		"request_id": "req-003"
	}`)

	result, err := a.ParseTaskResult(respBody)
	require.NoError(t, err)
	assert.Equal(t, model.TaskStatusSuccess, result.Status)
	assert.Equal(t, "https://example.com/out.mp4", result.Url)
}

func TestParseTaskResult_Failed(t *testing.T) {
	a := &TaskAdaptor{}
	respBody := []byte(`{
		"output": {"task_id": "task-123", "task_status": "FAILED", "code": "ERR_INTERNAL", "message": "GPU OOM"},
		"request_id": "req-004"
	}`)

	result, err := a.ParseTaskResult(respBody)
	require.NoError(t, err)
	assert.Equal(t, model.TaskStatusFailure, result.Status)
	assert.Contains(t, result.Reason, "GPU OOM")
}

func TestParseTaskResult_FailedWithTopLevelMessage(t *testing.T) {
	a := &TaskAdaptor{}
	respBody := []byte(`{
		"output": {"task_id": "task-123", "task_status": "FAILED"},
		"request_id": "req-005",
		"code": "InvalidParameter",
		"message": "Bad request"
	}`)

	result, err := a.ParseTaskResult(respBody)
	require.NoError(t, err)
	assert.Equal(t, model.TaskStatusFailure, result.Status)
	assert.Equal(t, "Bad request", result.Reason)
}

func TestParseTaskResult_UnknownStatus(t *testing.T) {
	a := &TaskAdaptor{}
	respBody := []byte(`{
		"output": {"task_id": "task-123", "task_status": "WEIRD_STATUS"},
		"request_id": "req-006"
	}`)

	result, err := a.ParseTaskResult(respBody)
	require.NoError(t, err)
	assert.Equal(t, model.TaskStatusQueued, result.Status) // defaults to queued
}

func TestParseTaskResult_InvalidJSON(t *testing.T) {
	a := &TaskAdaptor{}
	_, err := a.ParseTaskResult([]byte(`not json`))
	assert.Error(t, err)
}

// ============================
// Adaptor basic method tests
// ============================

func TestGetModelList(t *testing.T) {
	a := &TaskAdaptor{}
	models := a.GetModelList()
	assert.Equal(t, ModelList, models)
	assert.Len(t, models, 4)
	assert.Contains(t, models, "happyhorse-1.0-t2v")
	assert.Contains(t, models, "happyhorse-1.0-i2v")
	assert.Contains(t, models, "happyhorse-1.0-r2v")
	assert.Contains(t, models, "happyhorse-1.0-video-edit")
}

func TestGetChannelName(t *testing.T) {
	a := &TaskAdaptor{}
	assert.Equal(t, "happyhorse", a.GetChannelName())
}

func TestInit(t *testing.T) {
	a := &TaskAdaptor{}
	info := &relaycommon.RelayInfo{
		ChannelMeta: &relaycommon.ChannelMeta{
			ChannelBaseUrl: "https://dashscope.aliyuncs.com",
			ApiKey:         "sk-test-key",
		},
	}
	a.Init(info)
	assert.Equal(t, "https://dashscope.aliyuncs.com", a.baseURL)
	assert.Equal(t, "sk-test-key", a.apiKey)
}

func TestBuildRequestURL(t *testing.T) {
	a := &TaskAdaptor{baseURL: "https://dashscope.aliyuncs.com"}
	url, err := a.BuildRequestURL(nil)
	require.NoError(t, err)
	assert.Equal(t, "https://dashscope.aliyuncs.com/api/v1/services/aigc/video-generation/video-synthesis", url)
}

func TestBuildRequestHeader(t *testing.T) {
	a := &TaskAdaptor{apiKey: "sk-abc123"}
	req, _ := http.NewRequest(http.MethodPost, "http://example.com", nil)
	err := a.BuildRequestHeader(nil, req, nil)
	require.NoError(t, err)
	assert.Equal(t, "Bearer sk-abc123", req.Header.Get("Authorization"))
	assert.Equal(t, "application/json", req.Header.Get("Content-Type"))
	assert.Equal(t, "enable", req.Header.Get("X-DashScope-Async"))
}

// ============================
// DoResponse tests
// ============================

func TestDoResponse_Success(t *testing.T) {
	a := &TaskAdaptor{}
	info := &relaycommon.RelayInfo{
		OriginModelName: "happyhorse-1.0-t2v",
		TaskRelayInfo: &relaycommon.TaskRelayInfo{
			PublicTaskID: "task-public-001",
		},
	}

	hhResp := HappyHorseResponse{
		Output: HappyHorseOutput{
			TaskID:     "upstream-task-123",
			TaskStatus: "PENDING",
		},
		RequestID: "req-do-001",
	}
	body, _ := common.Marshal(hhResp)

	resp := &http.Response{
		StatusCode: http.StatusOK,
		Body:       io.NopCloser(bytesReader(body)),
	}

	w := httptest.NewRecorder()
	c, _ := createGinContext(w)
	c.Set("model", "happyhorse-1.0-t2v")

	taskID, taskData, taskErr := a.DoResponse(c, resp, info)
	assert.Nil(t, taskErr)
	assert.Equal(t, "upstream-task-123", taskID)
	assert.NotEmpty(t, taskData)
	assert.Equal(t, http.StatusOK, w.Code)
}

func TestDoResponse_ErrorCode(t *testing.T) {
	a := &TaskAdaptor{}
	info := &relaycommon.RelayInfo{
		TaskRelayInfo: &relaycommon.TaskRelayInfo{
			PublicTaskID: "task-public-002",
		},
	}

	hhResp := HappyHorseResponse{
		Code:    "InvalidParameter",
		Message: "model not found",
		RequestID: "req-do-002",
	}
	body, _ := common.Marshal(hhResp)

	resp := &http.Response{
		StatusCode: http.StatusBadRequest,
		Body:       io.NopCloser(bytesReader(body)),
	}

	w := httptest.NewRecorder()
	c, _ := createGinContext(w)

	_, _, taskErr := a.DoResponse(c, resp, info)
	assert.NotNil(t, taskErr)
}

func TestDoResponse_EmptyTaskID(t *testing.T) {
	a := &TaskAdaptor{}
	info := &relaycommon.RelayInfo{
		TaskRelayInfo: &relaycommon.TaskRelayInfo{
			PublicTaskID: "task-public-003",
		},
	}

	hhResp := HappyHorseResponse{
		Output:    HappyHorseOutput{TaskStatus: "PENDING"},
		RequestID: "req-do-003",
	}
	body, _ := common.Marshal(hhResp)

	resp := &http.Response{
		StatusCode: http.StatusOK,
		Body:       io.NopCloser(bytesReader(body)),
	}

	w := httptest.NewRecorder()
	c, _ := createGinContext(w)

	_, _, taskErr := a.DoResponse(c, resp, info)
	assert.NotNil(t, taskErr)
}

// ============================
// FetchTask tests
// ============================

func TestFetchTask_InvalidTaskIDType(t *testing.T) {
	a := &TaskAdaptor{}
	// task_id is not a string
	_, err := a.FetchTask("https://example.com", "key", map[string]any{"task_id": 123}, "")
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "invalid task_id")
}

func TestFetchTask_MissingTaskID(t *testing.T) {
	a := &TaskAdaptor{}
	_, err := a.FetchTask("https://example.com", "key", map[string]any{}, "")
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "invalid task_id")
}

// ============================
// ConvertToOpenAIVideo tests
// ============================

func TestConvertToOpenAIVideo_Success(t *testing.T) {
	a := &TaskAdaptor{}
	hhResp := HappyHorseResponse{
		Output: HappyHorseOutput{
			TaskID:     "task-conv-1",
			TaskStatus: "SUCCEEDED",
			VideoURL:   "https://example.com/result.mp4",
		},
		RequestID: "req-conv-1",
	}
	data, _ := common.Marshal(hhResp)

	task := &model.Task{
		TaskID: "task-conv-1",
		Properties: model.Properties{
			OriginModelName: "happyhorse-1.0-t2v",
		},
		Progress:  "100%",
		Data:      data,
		CreatedAt: 1700000000,
		UpdatedAt: 1700000100,
	}

	result, err := a.ConvertToOpenAIVideo(task)
	require.NoError(t, err)

	var video dto.OpenAIVideo
	err = common.Unmarshal(result, &video)
	require.NoError(t, err)
	assert.Equal(t, "task-conv-1", video.ID)
	assert.Equal(t, dto.VideoStatusCompleted, video.Status)
	assert.Equal(t, "happyhorse-1.0-t2v", video.Model)
	assert.Equal(t, 100, video.Progress)
	assert.Equal(t, "https://example.com/result.mp4", video.Metadata["url"])
}

func TestConvertToOpenAIVideo_WithError(t *testing.T) {
	a := &TaskAdaptor{}
	hhResp := HappyHorseResponse{
		Output: HappyHorseOutput{
			TaskID:     "task-conv-2",
			TaskStatus: "FAILED",
			Code:       "GPU_ERROR",
			Message:    "GPU out of memory",
		},
		Code:    "InternalError",
		Message: "internal server error",
		RequestID: "req-conv-2",
	}
	data, _ := common.Marshal(hhResp)

	task := &model.Task{
		TaskID: "task-conv-2",
		Properties: model.Properties{
			OriginModelName: "happyhorse-1.0-t2v",
		},
		Data: data,
	}

	result, err := a.ConvertToOpenAIVideo(task)
	require.NoError(t, err)

	var video dto.OpenAIVideo
	err = common.Unmarshal(result, &video)
	require.NoError(t, err)
	assert.Equal(t, dto.VideoStatusFailed, video.Status)
	require.NotNil(t, video.Error)
	assert.Equal(t, "InternalError", video.Error.Code)
	assert.Equal(t, "internal server error", video.Error.Message)
}

// ============================
// helpers
// ============================

func bytesReader(b []byte) *bytes.Reader {
	return bytes.NewReader(b)
}

func createGinContext(w http.ResponseWriter) (*gin.Context, *httptest.ResponseRecorder) {
	gin.SetMode(gin.TestMode)
	c, _ := gin.CreateTestContext(w)
	c.Request = httptest.NewRequest(http.MethodPost, "/", nil)
	return c, w.(*httptest.ResponseRecorder)
}

func TestConvertToHappyHorseRequest_MetadataOverride(t *testing.T) {
	info := &relaycommon.RelayInfo{
		ChannelMeta: &relaycommon.ChannelMeta{
			UpstreamModelName: "happyhorse-1.0-t2v",
		},
	}
	req := relaycommon.TaskSubmitReq{
		Prompt:   "test",
		Model:    "happyhorse-1.0-t2v",
		Size:     "480",
		Duration: 3,
		Metadata: map[string]interface{}{
			"resolution":    "1080",
			"duration":      8,
			"prompt_extend": false,
			"seed":          42,
			"watermark":     true,
		},
	}

	hhReq, err := convertToHappyHorseRequest(info, req)
	require.NoError(t, err)
	assert.Equal(t, "1080P", hhReq.Parameters.Resolution)
	assert.Equal(t, 8, *hhReq.Parameters.Duration)
	assert.False(t, *hhReq.Parameters.PromptExtend)
	assert.Equal(t, 42, *hhReq.Parameters.Seed)
	require.NotNil(t, hhReq.Parameters.Watermark)
	assert.True(t, *hhReq.Parameters.Watermark)
}

func TestConvertToHappyHorseRequest_WatermarkNotSetByDefault(t *testing.T) {
	info := &relaycommon.RelayInfo{
		ChannelMeta: &relaycommon.ChannelMeta{
			UpstreamModelName: "happyhorse-1.0-t2v",
		},
	}
	req := relaycommon.TaskSubmitReq{
		Prompt: "test",
		Model:  "happyhorse-1.0-t2v",
	}

	hhReq, err := convertToHappyHorseRequest(info, req)
	require.NoError(t, err)
	assert.Nil(t, hhReq.Parameters.Watermark)
}

func TestConvertToHappyHorseRequest_MetadataWatermarkFalse(t *testing.T) {
	info := &relaycommon.RelayInfo{
		ChannelMeta: &relaycommon.ChannelMeta{
			UpstreamModelName: "happyhorse-1.0-t2v",
		},
	}
	req := relaycommon.TaskSubmitReq{
		Prompt: "test",
		Model:  "happyhorse-1.0-t2v",
		Metadata: map[string]interface{}{
			"watermark": false,
		},
	}

	hhReq, err := convertToHappyHorseRequest(info, req)
	require.NoError(t, err)
	require.NotNil(t, hhReq.Parameters.Watermark)
	assert.False(t, *hhReq.Parameters.Watermark)
}

func TestConvertToHappyHorseRequest_SeedNotSetByDefault(t *testing.T) {
	info := &relaycommon.RelayInfo{
		ChannelMeta: &relaycommon.ChannelMeta{
			UpstreamModelName: "happyhorse-1.0-t2v",
		},
	}
	req := relaycommon.TaskSubmitReq{
		Prompt: "test",
		Model:  "happyhorse-1.0-t2v",
	}

	hhReq, err := convertToHappyHorseRequest(info, req)
	require.NoError(t, err)
	assert.Nil(t, hhReq.Parameters.Seed)
}

func TestConvertToHappyHorseRequest_VideoEditModelMapped(t *testing.T) {
	info := &relaycommon.RelayInfo{
		ChannelMeta: &relaycommon.ChannelMeta{
			UpstreamModelName: "custom-video-edit-v2",
			IsModelMapped:     true,
		},
	}
	req := relaycommon.TaskSubmitReq{
		Prompt:         "Edit this",
		Model:          "happyhorse-1.0-video-edit",
		InputReference: "https://example.com/video.mp4",
	}

	hhReq, err := convertToHappyHorseRequest(info, req)
	require.NoError(t, err)
	assert.Equal(t, "custom-video-edit-v2", hhReq.Model)
	require.Len(t, hhReq.Input.Media, 1)
	assert.Equal(t, "video_url", hhReq.Input.Media[0].Type)
}

func TestConvertToHappyHorseRequest_MetadataSeedZero(t *testing.T) {
	info := &relaycommon.RelayInfo{
		ChannelMeta: &relaycommon.ChannelMeta{
			UpstreamModelName: "happyhorse-1.0-t2v",
		},
	}
	req := relaycommon.TaskSubmitReq{
		Prompt: "test",
		Model:  "happyhorse-1.0-t2v",
		Metadata: map[string]interface{}{
			"seed": 0,
		},
	}

	hhReq, err := convertToHappyHorseRequest(info, req)
	require.NoError(t, err)
	require.NotNil(t, hhReq.Parameters.Seed)
	assert.Equal(t, 0, *hhReq.Parameters.Seed)
}

func TestParseTaskResult_WithUsage(t *testing.T) {
	a := &TaskAdaptor{}
	respBody := []byte(`{
		"output": {"task_id": "task-123", "task_status": "SUCCEEDED", "video_url": "https://example.com/out.mp4"},
		"request_id": "req-usage",
		"usage": {"duration": 5, "video_count": 1}
	}`)

	result, err := a.ParseTaskResult(respBody)
	require.NoError(t, err)
	assert.Equal(t, model.TaskStatusSuccess, result.Status)
	assert.Equal(t, 5, result.TotalTokens)
	assert.Equal(t, "https://example.com/out.mp4", result.Url)
}
