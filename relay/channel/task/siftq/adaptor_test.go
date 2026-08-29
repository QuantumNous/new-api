package siftq

import (
	"bytes"
	"io"
	"net/http"
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

func TestJoinURLUsesExactlyOneBoundarySlash(t *testing.T) {
	tests := []struct {
		base string
		want string
	}{
		{base: "https://siftq.com/api/minimax/", want: "https://siftq.com/api/minimax/v2/video_generation"},
		{base: "https://siftq.com/api/minimax", want: "https://siftq.com/api/minimax/v2/video_generation"},
		{base: "", want: "https://siftq.com/api/minimax/v2/video_generation"},
	}
	for _, test := range tests {
		assert.Equal(t, test.want, joinURL(test.base, "/v2/video_generation"))
	}
}

func TestConvertRequestSupportsTextAndFrameModes(t *testing.T) {
	tests := []struct {
		name       string
		req        relaycommon.TaskSubmitReq
		wantAction string
		wantRatio  string
		wantRoles  []string
	}{
		{
			name:       "text to video",
			req:        relaycommon.TaskSubmitReq{Model: ModelName, Prompt: "ocean sunrise", Duration: 5, Size: "2K"},
			wantAction: constant.TaskActionTextGenerate,
			wantRatio:  "16:9",
		},
		{
			name:       "first frame",
			req:        relaycommon.TaskSubmitReq{Model: ModelName, Prompt: "camera pushes in", Duration: 5, Image: "https://example.com/first.png"},
			wantAction: constant.TaskActionGenerate,
			wantRatio:  "adaptive",
			wantRoles:  []string{"first_frame"},
		},
		{
			name:       "first and last frame",
			req:        relaycommon.TaskSubmitReq{Model: ModelName, Prompt: "interpolate", Duration: 6, Images: []string{"https://example.com/first.png", "https://example.com/last.png"}},
			wantAction: constant.TaskActionGenerate,
			wantRatio:  "adaptive",
			wantRoles:  []string{"first_frame", "last_frame"},
		},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			payload, action, err := convertRequest(test.req)
			require.NoError(t, err)
			assert.Equal(t, ModelName, payload.Model)
			assert.Equal(t, test.wantAction, action)
			assert.Equal(t, test.wantRatio, payload.Ratio)
			roles := make([]string, 0)
			for _, item := range payload.Content {
				if item.Role != "" {
					roles = append(roles, item.Role)
				}
			}
			assert.ElementsMatch(t, test.wantRoles, roles)
		})
	}
}

func TestConvertRequestSupportsMultimodalReferences(t *testing.T) {
	req := relaycommon.TaskSubmitReq{
		Model:    ModelName,
		Prompt:   "match the references",
		Duration: 7,
		Metadata: map[string]interface{}{
			"resolution":   "2K",
			"ratio":        "4:3",
			"callback_url": "https://example.com/webhooks/siftq",
			"content": []interface{}{
				map[string]interface{}{"type": "text", "text": "match the references"},
				map[string]interface{}{"type": "image_url", "image_url": map[string]interface{}{"url": "https://example.com/ref.png"}, "role": "reference_image"},
				map[string]interface{}{"type": "video_url", "video_url": map[string]interface{}{"url": "https://example.com/ref.mp4"}, "role": "reference_video"},
				map[string]interface{}{"type": "audio_url", "audio_url": map[string]interface{}{"url": "https://example.com/ref.mp3"}, "role": "reference_audio"},
			},
		},
	}

	payload, action, err := convertRequest(req)
	require.NoError(t, err)
	assert.Equal(t, constant.TaskActionReferenceGenerate, action)
	assert.Equal(t, "2K", payload.Resolution)
	assert.Equal(t, "4:3", payload.Ratio)
	assert.Equal(t, "https://example.com/webhooks/siftq", payload.CallbackURL)
	require.Len(t, payload.Content, 4)
}

func TestConvertRequestRejectsInvalidContractCombinations(t *testing.T) {
	tests := []struct {
		name string
		req  relaycommon.TaskSubmitReq
	}{
		{name: "duration too short", req: relaycommon.TaskSubmitReq{Model: ModelName, Prompt: "x", Duration: 3}},
		{name: "zero duration override", req: relaycommon.TaskSubmitReq{Model: ModelName, Prompt: "x", Duration: 5, Metadata: map[string]interface{}{"duration": 0}}},
		{name: "non-integer seconds", req: relaycommon.TaskSubmitReq{Model: ModelName, Prompt: "x", Seconds: "five"}},
		{name: "invalid resolution", req: relaycommon.TaskSubmitReq{Model: ModelName, Prompt: "x", Duration: 5, Size: "1080P"}},
		{name: "empty resolution override", req: relaycommon.TaskSubmitReq{Model: ModelName, Prompt: "x", Duration: 5, Metadata: map[string]interface{}{"resolution": ""}}},
		{name: "empty ratio override", req: relaycommon.TaskSubmitReq{Model: ModelName, Prompt: "x", Duration: 5, Metadata: map[string]interface{}{"ratio": ""}}},
		{name: "empty callback override", req: relaycommon.TaskSubmitReq{Model: ModelName, Prompt: "x", Duration: 5, Metadata: map[string]interface{}{"callback_url": ""}}},
		{name: "adaptive text ratio", req: relaycommon.TaskSubmitReq{Model: ModelName, Prompt: "x", Duration: 5, Metadata: map[string]interface{}{"ratio": "adaptive"}}},
		{name: "last frame without first", req: relaycommon.TaskSubmitReq{Model: ModelName, Prompt: "x", Duration: 5, Metadata: map[string]interface{}{"content": []interface{}{
			map[string]interface{}{"type": "text", "text": "x"},
			map[string]interface{}{"type": "image_url", "image_url": map[string]interface{}{"url": "https://example.com/last.png"}, "role": "last_frame"},
		}}}},
		{name: "frames mixed with references", req: relaycommon.TaskSubmitReq{Model: ModelName, Prompt: "x", Duration: 5, Metadata: map[string]interface{}{"content": []interface{}{
			map[string]interface{}{"type": "text", "text": "x"},
			map[string]interface{}{"type": "image_url", "image_url": map[string]interface{}{"url": "https://example.com/first.png"}, "role": "first_frame"},
			map[string]interface{}{"type": "audio_url", "audio_url": map[string]interface{}{"url": "https://example.com/ref.mp3"}, "role": "reference_audio"},
		}}}},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			_, _, err := convertRequest(test.req)
			require.Error(t, err)
		})
	}
}

func TestConvertRequestIgnoresFrameRatioOverride(t *testing.T) {
	payload, _, err := convertRequest(relaycommon.TaskSubmitReq{
		Model:    ModelName,
		Prompt:   "camera pushes in",
		Duration: 5,
		Image:    "https://example.com/first.png",
		Metadata: map[string]interface{}{"ratio": "not-a-ratio"},
	})
	require.NoError(t, err)
	assert.Equal(t, adaptiveRatio, payload.Ratio)
}

func TestConvertRequestRejectsMetadataDurationOutsideBillingBounds(t *testing.T) {
	_, _, err := convertRequest(relaycommon.TaskSubmitReq{
		Model:    ModelName,
		Prompt:   "test",
		Duration: 5,
		Metadata: map[string]interface{}{"duration": 16},
	})
	require.ErrorContains(t, err, "duration")
}

func TestValidateMediaURLRejectsMalformedBase64(t *testing.T) {
	err := validateMediaURL("data:image/png;base64,not-base64!", "image", 30<<20)
	require.ErrorContains(t, err, "invalid base64")
}

func TestValidateMediaURLRejectsOversizedBase64BeforeDecoding(t *testing.T) {
	err := validateMediaURL("data:image/png;base64,%%%%", "image", 2)
	require.ErrorContains(t, err, "exceeds size limit")
}

func TestValidateRequestRequiresFixedModel(t *testing.T) {
	gin.SetMode(gin.TestMode)
	ctx, _ := gin.CreateTestContext(httptest.NewRecorder())
	ctx.Request = httptest.NewRequest(http.MethodPost, "/v1/video/generations", bytes.NewBufferString(`{"model":"other","prompt":"test","duration":5}`))
	ctx.Request.Header.Set("Content-Type", "application/json")
	defer common.CleanupBodyStorage(ctx)
	info := &relaycommon.RelayInfo{TaskRelayInfo: &relaycommon.TaskRelayInfo{}}

	taskErr := (&TaskAdaptor{}).ValidateRequestAndSetAction(ctx, info)
	require.NotNil(t, taskErr)
	assert.Equal(t, "invalid_model", taskErr.Code)
}

func TestBuildRequestBodyAndHeaders(t *testing.T) {
	gin.SetMode(gin.TestMode)
	ctx, _ := gin.CreateTestContext(httptest.NewRecorder())
	payload := &videoRequest{
		Model:      ModelName,
		Content:    []contentItem{{Type: "text", Text: "test"}},
		Resolution: "768P",
		Duration:   5,
		Ratio:      "16:9",
	}
	ctx.Set(requestContextKey, payload)
	adaptor := &TaskAdaptor{apiKey: "test-secret"}

	body, err := adaptor.BuildRequestBody(ctx, &relaycommon.RelayInfo{})
	require.NoError(t, err)
	data, err := io.ReadAll(body)
	require.NoError(t, err)
	assert.JSONEq(t, `{"model":"MiniMax-H3","content":[{"type":"text","text":"test"}],"resolution":"768P","duration":5,"ratio":"16:9"}`, string(data))

	req := httptest.NewRequest(http.MethodPost, "https://example.com", nil)
	require.NoError(t, adaptor.BuildRequestHeader(ctx, req, &relaycommon.RelayInfo{}))
	assert.Equal(t, "Bearer test-secret", req.Header.Get("Authorization"))
	assert.Equal(t, "application/json", req.Header.Get("Content-Type"))
}

func TestParseTaskResult(t *testing.T) {
	adaptor := &TaskAdaptor{}
	tests := []struct {
		name       string
		body       string
		wantStatus model.TaskStatus
		wantURL    string
		wantErr    bool
	}{
		{name: "queued", body: `{"task":{"id":"1","status":"queued"}}`, wantStatus: model.TaskStatusQueued},
		{name: "running", body: `{"task":{"id":"1","status":"running"}}`, wantStatus: model.TaskStatusInProgress},
		{name: "succeeded", body: `{"task":{"id":"1","status":"succeeded","content":{"url":"https://example.com/out.mp4"},"modality":"video","usage":{"output_seconds":5}}}`, wantStatus: model.TaskStatusSuccess, wantURL: "https://example.com/out.mp4"},
		{name: "failed", body: `{"task":{"id":"1","status":"failed","error":{"code":"2013","message":"invalid request"}}}`, wantStatus: model.TaskStatusFailure},
		{name: "cancelled", body: `{"task":{"id":"1","status":"cancelled"}}`, wantStatus: model.TaskStatusFailure},
		{name: "unknown status remains retriable", body: `{"task":{"id":"1","status":"pausing"}}`, wantErr: true},
		{name: "missing terminal url", body: `{"task":{"id":"1","status":"succeeded","modality":"video"}}`, wantErr: true},
		{name: "legacy shape rejected", body: `{"task_id":"1","status":"Success","file_id":"2"}`, wantErr: true},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			result, err := adaptor.ParseTaskResult([]byte(test.body))
			if test.wantErr {
				require.Error(t, err)
				return
			}
			require.NoError(t, err)
			assert.Equal(t, test.wantStatus, model.TaskStatus(result.Status))
			assert.Equal(t, test.wantURL, result.Url)
		})
	}
}

func TestAdjustBillingOnComplete(t *testing.T) {
	adaptor := &TaskAdaptor{}
	tests := []struct {
		name      string
		task      *model.Task
		result    *relaycommon.TaskInfo
		wantQuota int
		wantClamp common.QuotaClampKind
	}{
		{
			name: "scales pre-charge by actual duration",
			task: &model.Task{Quota: 1000, PrivateData: model.TaskPrivateData{BillingContext: &model.TaskBillingContext{
				OtherRatios: map[string]float64{"seconds": 5},
			}}},
			result:    &relaycommon.TaskInfo{OutputSeconds: 10},
			wantQuota: 2000,
		},
		{
			name:      "missing billing context keeps pre-charge",
			task:      &model.Task{Quota: 1000},
			result:    &relaycommon.TaskInfo{OutputSeconds: 10},
			wantQuota: 0,
		},
		{
			name: "zero output duration keeps pre-charge",
			task: &model.Task{Quota: 1000, PrivateData: model.TaskPrivateData{BillingContext: &model.TaskBillingContext{
				OtherRatios: map[string]float64{"seconds": 5},
			}}},
			result:    &relaycommon.TaskInfo{},
			wantQuota: 0,
		},
		{
			name: "reports saturated quota",
			task: &model.Task{Quota: common.MaxQuota, PrivateData: model.TaskPrivateData{BillingContext: &model.TaskBillingContext{
				OtherRatios: map[string]float64{"seconds": 0.01},
			}}},
			result:    &relaycommon.TaskInfo{OutputSeconds: 15},
			wantQuota: common.MaxQuota,
			wantClamp: common.QuotaClampOverflow,
		},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			quota, clamp := adaptor.AdjustBillingOnCompleteWithClamp(test.task, test.result)
			assert.Equal(t, test.wantQuota, quota)
			if test.wantClamp == "" {
				assert.Nil(t, clamp)
			} else {
				require.NotNil(t, clamp)
				assert.Equal(t, test.wantClamp, clamp.Kind)
			}
		})
	}
}

func TestParseErrorResponsePreservesStructuredError(t *testing.T) {
	taskErr := (&TaskAdaptor{}).ParseErrorResponse(http.StatusUnauthorized, []byte(`{"type":"error","error":{"type":"authorized_error","message":"invalid key","http_code":"401"},"request_id":"req_123"}`))
	require.NotNil(t, taskErr)
	assert.Equal(t, "authorized_error", taskErr.Code)
	assert.Equal(t, http.StatusUnauthorized, taskErr.StatusCode)
	assert.Contains(t, taskErr.Message, "req_123")
	assert.False(t, taskErr.LocalError)
}

func TestFetchTaskUsesV2PathAndBearerAuth(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
		assert.Equal(t, "/api/minimax/v2/query/video_generation/task%2Fwith%2Fslash", req.URL.EscapedPath())
		assert.Equal(t, "Bearer test-key", req.Header.Get("Authorization"))
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"task":{"id":"task/with/slash","status":"queued"}}`))
	}))
	defer server.Close()

	resp, err := (&TaskAdaptor{}).FetchTask(server.URL+"/api/minimax/", "test-key", map[string]any{"task_id": "task/with/slash"}, "")
	require.NoError(t, err)
	defer resp.Body.Close()
	assert.Equal(t, http.StatusOK, resp.StatusCode)
}

func TestDoResponseReturnsPublicTaskID(t *testing.T) {
	gin.SetMode(gin.TestMode)
	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	resp := &http.Response{Body: io.NopCloser(bytes.NewBufferString(`{"task_id":"upstream-123"}`))}
	info := &relaycommon.RelayInfo{
		OriginModelName: ModelName,
		TaskRelayInfo:   &relaycommon.TaskRelayInfo{PublicTaskID: "task_public"},
	}

	taskID, _, taskErr := (&TaskAdaptor{}).DoResponse(ctx, resp, info)
	require.Nil(t, taskErr)
	assert.Equal(t, "upstream-123", taskID)
	assert.NotContains(t, recorder.Body.String(), "upstream-123")
	assert.Contains(t, recorder.Body.String(), "task_public")
}

func TestConvertToOpenAIVideoTreatsFreshTaskAsQueued(t *testing.T) {
	task := &model.Task{
		TaskID: "task_public",
		Status: model.TaskStatusNotStart,
		Properties: model.Properties{
			OriginModelName: ModelName,
		},
	}

	body, err := (&TaskAdaptor{}).ConvertToOpenAIVideo(task)
	require.NoError(t, err)
	assert.JSONEq(t, `{"id":"task_public","object":"video","status":"queued","progress":0,"created_at":0,"model":"MiniMax-H3","metadata":{"url":""}}`, string(body))
}
