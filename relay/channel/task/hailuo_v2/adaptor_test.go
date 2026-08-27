package hailuov2

import (
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
)

func newVideoContext(body string) (*gin.Context, *relaycommon.RelayInfo) {
	c, _ := gin.CreateTestContext(httptest.NewRecorder())
	c.Request = httptest.NewRequest("POST", "/v1/videos", strings.NewReader(body))
	c.Request.Header.Set("Content-Type", "application/json")
	info := &relaycommon.RelayInfo{
		ChannelMeta:     &relaycommon.ChannelMeta{ChannelBaseUrl: legacyBaseURL},
		TaskRelayInfo:   &relaycommon.TaskRelayInfo{},
		OriginModelName: ModelName,
	}
	info.UpstreamModelName = ModelName
	return c, info
}

func TestTaskAdaptorCreatesPublicTaskAndKeepsUpstreamIDPrivate(t *testing.T) {
	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)
	info := &relaycommon.RelayInfo{
		TaskRelayInfo:   &relaycommon.TaskRelayInfo{PublicTaskID: "task_public"},
		OriginModelName: ModelName,
	}
	resp := &http.Response{Body: io.NopCloser(strings.NewReader(`{"task_id":"424010985738629"}`))}

	upstreamID, _, taskErr := (&TaskAdaptor{}).DoResponse(c, resp, info)

	require.Nil(t, taskErr)
	require.Equal(t, "424010985738629", upstreamID)
	require.Contains(t, recorder.Body.String(), `"id":"task_public"`)
	require.NotContains(t, recorder.Body.String(), upstreamID)
}

func TestTaskAdaptorFetchesAndParsesSucceededTask(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		require.Equal(t, "/v2/query/video_generation/424010985738629", r.URL.Path)
		require.Equal(t, "Bearer secret", r.Header.Get("Authorization"))
		_, _ = w.Write([]byte(`{"task":{"id":"424010985738629","status":"succeeded","content":{"url":"https://example.com/video.mp4"},"usage":{"total_seconds":12,"input_seconds":7,"output_seconds":5,"input_image_count":6}}}`))
	}))
	defer server.Close()

	adaptor := &TaskAdaptor{}
	resp, err := adaptor.FetchTask(server.URL, "secret", map[string]any{"task_id": "424010985738629"}, "")
	require.NoError(t, err)
	defer resp.Body.Close()
	body, err := io.ReadAll(resp.Body)
	require.NoError(t, err)

	result, err := adaptor.ParseTaskResult(body)

	require.NoError(t, err)
	require.Equal(t, string(model.TaskStatusSuccess), result.Status)
	require.Equal(t, "100%", result.Progress)
	require.Equal(t, "https://example.com/video.mp4", result.Url)
}

func TestTaskAdaptorKeepsTaskPendingOnQueryError(t *testing.T) {
	_, err := (&TaskAdaptor{}).ParseTaskResult([]byte(`{"type":"error","error":{"type":"rate_limit_error","message":"rate limit","http_code":"429"}}`))

	require.Error(t, err)
}

func TestTaskAdaptorReservesWorstCaseReferenceInputCost(t *testing.T) {
	c, info := newVideoContext(`{}`)
	content := []ContentItem{{Type: "text", Text: common.GetPointer("prompt")}, {
		Type: "video_url", VideoURL: &URLValue{URL: "https://example.com/ref.mp4"}, Role: common.GetPointer("reference_video"),
	}}
	for i := 0; i < 6; i++ {
		content = append(content, ContentItem{Type: "image_url", ImageURL: &URLValue{URL: "https://example.com/ref.png"}, Role: common.GetPointer("reference_image")})
	}
	c.Set("task_request", VideoRequest{Model: ModelName, Content: content, Resolution: "2K", Duration: 5, Ratio: common.GetPointer("adaptive")})
	info.PriceData.ModelPrice = 0.13

	ratios := (&TaskAdaptor{}).EstimateBilling(c, info)

	require.InDelta(t, 5+15+0.04/0.13, ratios["billable_units"], 0.000001)
}

func TestTaskAdaptorSettlesFromUpstreamUsage(t *testing.T) {
	task := &model.Task{
		Data: []byte(`{"task":{"usage":{"total_seconds":12,"input_image_count":6}}}`),
		PrivateData: model.TaskPrivateData{BillingContext: &model.TaskBillingContext{
			ModelPrice: 0.13,
			GroupRatio: 2,
		}},
	}

	quota, clamp := (&TaskAdaptor{}).AdjustBillingOnCompleteChecked(task, &relaycommon.TaskInfo{})

	require.Equal(t, 1600000, quota)
	require.Nil(t, clamp)
}

func TestTaskAdaptorConvertsFailedTaskToOpenAIVideo(t *testing.T) {
	task := &model.Task{
		TaskID:     "task_public",
		Status:     model.TaskStatusFailure,
		Data:       []byte(`{"task":{"status":"failed","error":{"code":"1026","message":"sensitive content"}}}`),
		Properties: model.Properties{OriginModelName: ModelName},
	}

	data, err := (&TaskAdaptor{}).ConvertToOpenAIVideo(task)

	require.NoError(t, err)
	var response map[string]any
	require.NoError(t, common.Unmarshal(data, &response))
	errorBody, ok := response["error"].(map[string]any)
	require.True(t, ok)
	require.Equal(t, "1026", errorBody["code"])
	require.Equal(t, "sensitive content", errorBody["message"])
}

func TestTaskAdaptorBuildsMiniMaxH3CreateRequest(t *testing.T) {
	gin.SetMode(gin.TestMode)
	body := `{
		"model":"MiniMax-H3",
		"content":[
			{"type":"text","text":"一个男孩在海边打篮球"},
			{"type":"image_url","image_url":{"url":"https://example.com/first.png"},"role":"first_frame"}
		],
		"resolution":"2K",
		"duration":5,
		"ratio":"adaptive"
	}`
	c, info := newVideoContext(body)

	adaptor := &TaskAdaptor{}
	adaptor.Init(info)
	require.Nil(t, adaptor.ValidateRequestAndSetAction(c, info))
	requestURL, err := adaptor.BuildRequestURL(info)
	require.NoError(t, err)
	require.Equal(t, "https://api.minimaxi.com/v2/video_generation", requestURL)

	requestBody, err := adaptor.BuildRequestBody(c, info)
	require.NoError(t, err)
	data, err := io.ReadAll(requestBody)
	require.NoError(t, err)

	var got VideoRequest
	require.NoError(t, common.Unmarshal(data, &got))
	require.Equal(t, ModelName, got.Model)
	require.Equal(t, "2K", got.Resolution)
	require.Equal(t, 5, got.Duration)
	require.NotNil(t, got.Ratio)
	require.Equal(t, "adaptive", *got.Ratio)
	require.Len(t, got.Content, 2)
}

func TestTaskAdaptorRejectsInvalidMiniMaxH3Content(t *testing.T) {
	tests := []struct {
		name string
		body string
		code string
	}{
		{
			name: "duration is bounded before billing",
			body: `{"model":"MiniMax-H3","content":[{"type":"text","text":"prompt"}],"resolution":"2K","duration":16,"ratio":"16:9"}`,
			code: "invalid_duration",
		},
		{
			name: "text generation requires explicit ratio",
			body: `{"model":"MiniMax-H3","content":[{"type":"text","text":"prompt"}],"resolution":"2K","duration":5,"ratio":"adaptive"}`,
			code: "invalid_ratio",
		},
		{
			name: "reference audio cannot be used alone",
			body: `{"model":"MiniMax-H3","content":[{"type":"text","text":"prompt"},{"type":"audio_url","audio_url":{"url":"https://example.com/ref.mp3"},"role":"reference_audio"}],"resolution":"2K","duration":5,"ratio":"adaptive"}`,
			code: "invalid_content",
		},
		{
			name: "callback cannot expose upstream task id",
			body: `{"model":"MiniMax-H3","content":[{"type":"text","text":"prompt"}],"resolution":"2K","duration":5,"ratio":"16:9","callback_url":"https://example.com/callback"}`,
			code: "unsupported_callback_url",
		},
		{
			name: "frame and reference inputs are mutually exclusive",
			body: `{"model":"MiniMax-H3","content":[{"type":"text","text":"prompt"},{"type":"image_url","image_url":{"url":"https://example.com/first.png"},"role":"first_frame"},{"type":"image_url","image_url":{"url":"https://example.com/ref.png"},"role":"reference_image"}],"resolution":"2K","duration":5,"ratio":"adaptive"}`,
			code: "invalid_content",
		},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			c, info := newVideoContext(test.body)
			adaptor := &TaskAdaptor{}
			adaptor.Init(info)

			taskErr := adaptor.ValidateRequestAndSetAction(c, info)

			require.NotNil(t, taskErr)
			require.Equal(t, test.code, taskErr.Code)
		})
	}
}
