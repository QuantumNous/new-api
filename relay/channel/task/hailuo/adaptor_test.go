package hailuo

import (
	"bytes"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func newV2TestContext(t *testing.T, body string) *gin.Context {
	t.Helper()
	c, _ := gin.CreateTestContext(httptest.NewRecorder())
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/videos", bytes.NewReader([]byte(body)))
	c.Request.Header.Set("Content-Type", "application/json")
	t.Cleanup(func() { common.CleanupBodyStorage(c) })
	return c
}

func TestValidateV2Request(t *testing.T) {
	tests := []struct {
		name    string
		body    string
		wantErr bool
		wantDur int
	}{
		{"text only defaults duration", `{"model":"MiniMax-H3","prompt":"a boy playing basketball"}`, false, V2DefaultDuration},
		{"valid 2K text request", `{"model":"MiniMax-H3","prompt":"a boy playing basketball","duration":5,"size":"2K"}`, false, 5},
		{"duration too short", `{"model":"MiniMax-H3","prompt":"p","duration":3}`, true, 0},
		{"duration too long", `{"model":"MiniMax-H3","prompt":"p","duration":16}`, true, 0},
		{"unsupported resolution", `{"model":"MiniMax-H3","prompt":"p","duration":5,"size":"1080P"}`, true, 0},
		{"invalid ratio", `{"model":"MiniMax-H3","prompt":"p","duration":5,"metadata":{"ratio":"16:10"}}`, true, 0},
		{"too many frame images", `{"model":"MiniMax-H3","prompt":"p","duration":5,"images":["a","b","c"]}`, true, 0},
		{"content must be array", `{"model":"MiniMax-H3","prompt":"p","duration":5,"metadata":{"content":"nope"}}`, true, 0},
		{"too many reference videos",
			`{"model":"MiniMax-H3","prompt":"p","duration":5,"metadata":{"content":[
				{"type":"video_url","video_url":{"url":"u1"}},
				{"type":"video_url","video_url":{"url":"u2"}},
				{"type":"video_url","video_url":{"url":"u3"}},
				{"type":"video_url","video_url":{"url":"u4"}}]}}`, true, 0},
		{"valid metadata content",
			`{"model":"MiniMax-H3","prompt":"p","duration":5,"metadata":{"content":[
				{"type":"image_url","image_url":{"url":"u1"},"role":"reference_image"}]}}`, false, 5},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			c := newV2TestContext(t, tt.body)
			info := &relaycommon.RelayInfo{TaskRelayInfo: &relaycommon.TaskRelayInfo{}, OriginModelName: "MiniMax-H3"}
			taskErr := (&TaskAdaptor{}).ValidateRequestAndSetAction(c, info)
			if tt.wantErr {
				require.NotNil(t, taskErr)
				return
			}
			require.Nil(t, taskErr)
			req, err := relaycommon.GetTaskRequest(c)
			require.NoError(t, err)
			assert.Equal(t, tt.wantDur, req.Duration)
		})
	}
}

func TestValidateV2RequestKeepsV1Path(t *testing.T) {
	// V1 模型不应触发 V2 的 4-15 秒限制
	c := newV2TestContext(t, `{"model":"MiniMax-Hailuo-2.3","prompt":"p","duration":20}`)
	info := &relaycommon.RelayInfo{TaskRelayInfo: &relaycommon.TaskRelayInfo{}, OriginModelName: "MiniMax-Hailuo-2.3"}
	taskErr := (&TaskAdaptor{}).ValidateRequestAndSetAction(c, info)
	require.Nil(t, taskErr)
}

func TestBuildV2Content(t *testing.T) {
	t.Run("text only", func(t *testing.T) {
		req := &relaycommon.TaskSubmitReq{Prompt: "a boy playing basketball"}
		content, err := buildV2Content(req)
		require.NoError(t, err)
		require.Len(t, content, 1)
		assert.Equal(t, "text", content[0].Type)
		assert.Equal(t, "a boy playing basketball", content[0].Text)
	})
	t.Run("first and last frame", func(t *testing.T) {
		req := &relaycommon.TaskSubmitReq{Prompt: "p", Images: []string{"first.png", "last.png"}}
		content, err := buildV2Content(req)
		require.NoError(t, err)
		require.Len(t, content, 3)
		assert.Equal(t, "first_frame", content[1].Role)
		assert.Equal(t, "first.png", content[1].ImageURL.URL)
		assert.Equal(t, "last_frame", content[2].Role)
		assert.Equal(t, "last.png", content[2].ImageURL.URL)
	})
	t.Run("reference video and audio", func(t *testing.T) {
		req := &relaycommon.TaskSubmitReq{
			Prompt: "p",
			Metadata: map[string]any{
				"reference_video": "ref.mp4",
				"reference_audio": []any{"a.mp3", "b.mp3"},
			},
		}
		content, err := buildV2Content(req)
		require.NoError(t, err)
		require.Len(t, content, 4)
		assert.Equal(t, "video_url", content[1].Type)
		assert.Equal(t, "reference_video", content[1].Role)
		assert.Equal(t, "ref.mp4", content[1].VideoURL.URL)
		assert.Equal(t, "audio_url", content[2].Type)
		assert.Equal(t, "reference_audio", content[2].Role)
		assert.Equal(t, "a.mp3", content[2].AudioURL.URL)
		assert.Equal(t, "b.mp3", content[3].AudioURL.URL)
	})
	t.Run("content passthrough prepends missing text", func(t *testing.T) {
		req := &relaycommon.TaskSubmitReq{
			Prompt: "p",
			Metadata: map[string]any{
				"content": []any{
					map[string]any{"type": "image_url", "image_url": map[string]any{"url": "img.png"}, "role": "first_frame"},
				},
			},
		}
		content, err := buildV2Content(req)
		require.NoError(t, err)
		require.Len(t, content, 2)
		assert.Equal(t, "text", content[0].Type)
		assert.Equal(t, "p", content[0].Text)
		assert.Equal(t, "image_url", content[1].Type)
		assert.Equal(t, "img.png", content[1].ImageURL.URL)
	})
}

func TestBuildV2RequestPayload(t *testing.T) {
	req := &relaycommon.TaskSubmitReq{
		Prompt:   "p",
		Duration: 5,
		Size:     "2K",
		Metadata: map[string]any{
			"ratio":          "16:9",
			"callback_url":   "https://example.com/cb",
			"aigc_watermark": true,
		},
	}
	payload, err := buildV2RequestPayload(req, &relaycommon.RelayInfo{TaskRelayInfo: &relaycommon.TaskRelayInfo{}, ChannelMeta: &relaycommon.ChannelMeta{UpstreamModelName: "MiniMax-H3"}})
	require.NoError(t, err)
	assert.Equal(t, "MiniMax-H3", payload.Model)
	assert.Equal(t, "2K", payload.Resolution)
	assert.Equal(t, 5, payload.Duration)
	assert.Equal(t, "16:9", payload.Ratio)
	assert.Equal(t, "https://example.com/cb", payload.CallbackURL)
	require.NotNil(t, payload.AigcWatermark)
	assert.True(t, *payload.AigcWatermark)
}

func TestBuildV2RequestPayloadDefaultsAdaptiveForImages(t *testing.T) {
	req := &relaycommon.TaskSubmitReq{
		Prompt:   "p",
		Duration: 5,
		Images:   []string{"img.png"},
	}
	payload, err := buildV2RequestPayload(req, &relaycommon.RelayInfo{TaskRelayInfo: &relaycommon.TaskRelayInfo{}, ChannelMeta: &relaycommon.ChannelMeta{UpstreamModelName: "MiniMax-H3"}})
	require.NoError(t, err)
	assert.Equal(t, "adaptive", payload.Ratio)
	assert.Equal(t, "768P", payload.Resolution)
}

func TestEstimateBillingV2(t *testing.T) {
	tests := []struct {
		name  string
		model string
		req   relaycommon.TaskSubmitReq
		want  map[string]float64
	}{
		{"2K text", "MiniMax-H3", relaycommon.TaskSubmitReq{Duration: 5, Size: "2K"}, map[string]float64{"seconds": 5, "resolution": 1.6}},
		{"768P default", "MiniMax-H3", relaycommon.TaskSubmitReq{Duration: 10}, map[string]float64{"seconds": 10, "resolution": 1}},
		{"oversized duration clamped", "MiniMax-H3", relaycommon.TaskSubmitReq{Duration: 9999}, map[string]float64{"seconds": 15, "resolution": 1}},
		{"V1 model returns nil", "MiniMax-Hailuo-2.3", relaycommon.TaskSubmitReq{Duration: 5}, nil},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			c, _ := gin.CreateTestContext(httptest.NewRecorder())
			c.Set("task_request", tt.req)
			info := &relaycommon.RelayInfo{TaskRelayInfo: &relaycommon.TaskRelayInfo{}, ChannelMeta: &relaycommon.ChannelMeta{UpstreamModelName: tt.model}}
			got := (&TaskAdaptor{}).EstimateBilling(c, info)
			if tt.want == nil {
				assert.Nil(t, got)
				return
			}
			require.NotNil(t, got)
			assert.Equal(t, tt.want["seconds"], got["seconds"])
			assert.Equal(t, tt.want["resolution"], got["resolution"])
		})
	}
}

func TestParseTaskResultV2(t *testing.T) {
	tests := []struct {
		name       string
		body       string
		wantStatus model.TaskStatus
		wantURL    string
		wantReason string
	}{
		{"queued", `{"task":{"id":"1","status":"queued"}}`, model.TaskStatusQueued, "", ""},
		{"running", `{"task":{"id":"1","status":"running"}}`, model.TaskStatusInProgress, "", ""},
		{"succeeded with url", `{"task":{"id":"1","status":"succeeded","content":{"url":"https://cdn/x.mp4"}}}`, model.TaskStatusSuccess, "https://cdn/x.mp4", ""},
		{"failed with error", `{"task":{"id":"1","status":"failed","error":{"code":"1026","message":"sensitive content"}}}`, model.TaskStatusFailure, "", "sensitive content"},
		{"cancelled", `{"task":{"id":"1","status":"cancelled"}}`, model.TaskStatusFailure, "", "task cancelled"},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			ti, err := (&TaskAdaptor{}).ParseTaskResult([]byte(tt.body))
			require.NoError(t, err)
			assert.Equal(t, string(tt.wantStatus), string(ti.Status))
			assert.Equal(t, tt.wantURL, ti.Url)
			assert.Equal(t, tt.wantReason, ti.Reason)
		})
	}
}

func TestParseTaskResultV1Fallback(t *testing.T) {
	body := `{"task_id":"123","status":"Success","file_id":"f1","base_resp":{"status_code":0,"status_msg":""}}`
	ti, err := (&TaskAdaptor{}).ParseTaskResult([]byte(body))
	require.NoError(t, err)
	assert.Equal(t, string(model.TaskStatusSuccess), string(ti.Status))
	// apiKey 为空时 buildVideoURL 直接返回空串
	assert.Equal(t, "", ti.Url)
}

func TestConvertToV2OpenAIVideoFailed(t *testing.T) {
	task := &model.Task{
		TaskID:     "task_abc",
		Status:     model.TaskStatusFailure,
		Progress:   "100%",
		Properties: model.Properties{OriginModelName: "MiniMax-H3"},
		Data:       []byte(`{"task":{"id":"1","status":"failed","error":{"code":"1026","message":"sensitive"}}}`),
	}
	data, err := (&TaskAdaptor{}).ConvertToOpenAIVideo(task)
	require.NoError(t, err)
	var ov dto.OpenAIVideo
	require.NoError(t, common.Unmarshal(data, &ov))
	assert.Equal(t, dto.VideoStatusFailed, ov.Status)
	require.NotNil(t, ov.Error)
	assert.Equal(t, "1026", ov.Error.Code)
	assert.Equal(t, "sensitive", ov.Error.Message)
}

func TestConvertToV2OpenAIVideoSubmitResponse(t *testing.T) {
	// 提交响应（无 task 对象）走通用转换，不报错、不带错误信息
	task := &model.Task{
		TaskID:     "task_abc",
		Status:     model.TaskStatusQueued,
		Properties: model.Properties{OriginModelName: "MiniMax-H3"},
		Data:       []byte(`{"task_id":"123"}`),
	}
	data, err := (&TaskAdaptor{}).ConvertToOpenAIVideo(task)
	require.NoError(t, err)
	var ov dto.OpenAIVideo
	require.NoError(t, common.Unmarshal(data, &ov))
	assert.Equal(t, dto.VideoStatusQueued, ov.Status)
	assert.Nil(t, ov.Error)
}

func TestValidateV2RequestWithMappedModel(t *testing.T) {
	// 渠道模型映射别名 h3 -> MiniMax-H3 时也必须走 V2 校验（duration 3 应被拒绝）
	c := newV2TestContext(t, `{"model":"h3","prompt":"p","duration":3}`)
	c.Set("model_mapping", `{"h3":"MiniMax-H3"}`)
	info := &relaycommon.RelayInfo{TaskRelayInfo: &relaycommon.TaskRelayInfo{}, OriginModelName: "h3"}
	taskErr := (&TaskAdaptor{}).ValidateRequestAndSetAction(c, info)
	require.NotNil(t, taskErr)
	assert.Equal(t, "invalid_duration", taskErr.Code)
}

func TestValidateV2RequestMappedValid(t *testing.T) {
	c := newV2TestContext(t, `{"model":"h3","prompt":"p","duration":5,"size":"2K"}`)
	c.Set("model_mapping", `{"h3":"MiniMax-H3"}`)
	info := &relaycommon.RelayInfo{TaskRelayInfo: &relaycommon.TaskRelayInfo{}, OriginModelName: "h3"}
	taskErr := (&TaskAdaptor{}).ValidateRequestAndSetAction(c, info)
	require.Nil(t, taskErr)
	req, err := relaycommon.GetTaskRequest(c)
	require.NoError(t, err)
	assert.Equal(t, 5, req.Duration)
}

func TestResolveUpstreamModel(t *testing.T) {
	tests := []struct {
		name    string
		mapping string
		origin  string
		want    string
	}{
		{"no mapping", "", "h3", "h3"},
		{"direct alias", `{"h3":"MiniMax-H3"}`, "h3", "MiniMax-H3"},
		{"chain mapping", `{"a":"b","b":"MiniMax-H3"}`, "a", "MiniMax-H3"},
		{"self mapping keeps origin", `{"h3":"h3"}`, "h3", "h3"},
		{"cycle stops at first hop", `{"a":"b","b":"a"}`, "a", "b"},
		{"unmapped origin", `{"h3":"MiniMax-H3"}`, "other", "other"},
		{"malformed mapping falls back", "not-json", "h3", "h3"},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			c, _ := gin.CreateTestContext(httptest.NewRecorder())
			if tt.mapping != "" {
				c.Set("model_mapping", tt.mapping)
			}
			assert.Equal(t, tt.want, resolveUpstreamModel(c, tt.origin))
		})
	}
}

func TestFetchTaskEndpointByModel(t *testing.T) {
	tests := []struct {
		name  string
		model string
		want  string
	}{
		{"v2 upstream model", "MiniMax-H3", "/v2/query/video_generation/123"},
		{"v1 legacy model", "MiniMax-Hailuo-2.3", "/v1/query/video_generation?task_id=123"},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			var gotPath string
			srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				gotPath = r.URL.RequestURI()
				w.WriteHeader(http.StatusOK)
			}))
			defer srv.Close()

			resp, err := (&TaskAdaptor{}).FetchTask(srv.URL, "key", map[string]any{"task_id": "123", "model": tt.model}, "")
			require.NoError(t, err)
			defer resp.Body.Close()
			assert.Equal(t, tt.want, gotPath)
		})
	}
}
