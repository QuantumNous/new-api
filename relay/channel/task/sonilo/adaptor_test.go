package sonilo

import (
	"bytes"
	"io"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/relay/channel/task/taskcommon"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
)

func multipartContext(t *testing.T, fields map[string]string, withVideo bool) (*gin.Context, *httptest.ResponseRecorder) {
	t.Helper()
	gin.SetMode(gin.TestMode)
	var body bytes.Buffer
	w := multipart.NewWriter(&body)
	for key, value := range fields {
		require.NoError(t, w.WriteField(key, value))
	}
	if withVideo {
		part, err := w.CreateFormFile("video", "input.mp4")
		require.NoError(t, err)
		_, err = part.Write([]byte("fake-video"))
		require.NoError(t, err)
	}
	require.NoError(t, w.Close())
	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Request = httptest.NewRequest(http.MethodPost, "/v1/video-to-music", bytes.NewReader(body.Bytes()))
	ctx.Request.Header.Set("Content-Type", w.FormDataContentType())
	return ctx, recorder
}

func validFields() map[string]string {
	return map[string]string{
		"model":            ModelVideoToMusic,
		"duration_seconds": "5",
		"output_format":    "mp3",
		"variants_num":     "2",
		"prompt":           "gentle ambient score",
		"segments":         `[{"start":0,"end":5,"prompt":"calm"}]`,
		"preserve_speech":  "false",
		"ducking":          "false",
	}
}

func validateRequest(t *testing.T, fields map[string]string, withVideo bool) (*TaskAdaptor, *gin.Context, *relaycommon.RelayInfo) {
	t.Helper()
	ctx, _ := multipartContext(t, fields, withVideo)
	info := &relaycommon.RelayInfo{TaskRelayInfo: &relaycommon.TaskRelayInfo{}}
	adaptor := &TaskAdaptor{}
	require.Nil(t, adaptor.ValidateRequestAndSetAction(ctx, info))
	return adaptor, ctx, info
}

func TestValidateAndBuildMultipartUpload(t *testing.T) {
	adaptor, ctx, info := validateRequest(t, validFields(), true)
	ratios := adaptor.EstimateBilling(ctx, info)
	require.Equal(t, 10.0, ratios["seconds"])
	require.Equal(t, 2.0, ratios["variants"])

	body, err := adaptor.BuildRequestBody(ctx, info)
	require.NoError(t, err)
	req := httptest.NewRequest(http.MethodPost, "/", body)
	req.Header.Set("Content-Type", adaptor.contentType)
	require.NoError(t, req.ParseMultipartForm(1<<20))
	require.Equal(t, "async", req.FormValue("mode"))
	require.Equal(t, "false", req.FormValue("preserve_speech"))
	require.Equal(t, "false", req.FormValue("ducking"))
	require.Equal(t, "2", req.FormValue("variants_num"))
	require.Equal(t, "", req.FormValue("model"))
	require.Equal(t, "", req.FormValue("duration_seconds"))
	file, header, err := req.FormFile("video")
	require.NoError(t, err)
	defer file.Close()
	require.Equal(t, "input.mp4", header.Filename)
	data, err := io.ReadAll(file)
	require.NoError(t, err)
	require.Equal(t, "fake-video", string(data))
}

func TestBuildMultipartVideoURL(t *testing.T) {
	ctx, _ := multipartContext(t, validFields(), false)
	ctx.Set(requestContextKey, submitRequest{
		Model: ModelVideoToMusic, VideoURL: "https://cdn.example.com/input.mp4",
		OutputFormat: "m4a", VariantsNum: 1, DurationSeconds: 12,
	})
	adaptor := &TaskAdaptor{}
	body, err := adaptor.BuildRequestBody(ctx, &relaycommon.RelayInfo{})
	require.NoError(t, err)
	req := httptest.NewRequest(http.MethodPost, "/", body)
	req.Header.Set("Content-Type", adaptor.contentType)
	require.NoError(t, req.ParseMultipartForm(1<<20))
	require.Equal(t, "https://cdn.example.com/input.mp4", req.FormValue("video_url"))
	require.Equal(t, "m4a", req.FormValue("output_format"))
}

func TestValidateRejectsInvalidSourcesAndOptions(t *testing.T) {
	tests := []struct {
		name      string
		mutate    func(map[string]string)
		withVideo bool
		code      string
	}{
		{name: "missing source", withVideo: false, code: "invalid_video_source"},
		{name: "both sources", withVideo: true, code: "invalid_video_source", mutate: func(v map[string]string) { v["video_url"] = "https://example.com/v.mp4" }},
		{name: "missing duration", withVideo: true, code: "invalid_duration_seconds", mutate: func(v map[string]string) { delete(v, "duration_seconds") }},
		{name: "bad format", withVideo: true, code: "invalid_output_format", mutate: func(v map[string]string) { v["output_format"] = "aac" }},
		{name: "too many variants", withVideo: true, code: "invalid_variants_num", mutate: func(v map[string]string) { v["variants_num"] = "11" }},
		{name: "bad bool", withVideo: true, code: "invalid_ducking", mutate: func(v map[string]string) { v["ducking"] = "sometimes" }},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			fields := validFields()
			if tc.mutate != nil {
				tc.mutate(fields)
			}
			ctx, _ := multipartContext(t, fields, tc.withVideo)
			err := (&TaskAdaptor{}).ValidateRequestAndSetAction(ctx, &relaycommon.RelayInfo{TaskRelayInfo: &relaycommon.TaskRelayInfo{}})
			require.NotNil(t, err)
			require.Equal(t, tc.code, err.Code)
		})
	}
}

func TestAcceptedResponseNormalization(t *testing.T) {
	resp := &http.Response{StatusCode: http.StatusAccepted}
	normalizeAcceptedResponse(resp)
	require.Equal(t, http.StatusOK, resp.StatusCode)
}

func TestDoResponseAndPollAreWhitelabeled(t *testing.T) {
	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	adaptor := &TaskAdaptor{}
	upstream := `{"task_id":"upstream-secret-id","status":"processing"}`
	taskID, data, taskErr := adaptor.DoResponse(ctx, &http.Response{Body: io.NopCloser(strings.NewReader(upstream))}, &relaycommon.RelayInfo{
		OriginModelName: ModelVideoToMusic,
		TaskRelayInfo:   &relaycommon.TaskRelayInfo{PublicTaskID: "task_public"},
	})
	require.Nil(t, taskErr)
	require.Equal(t, "upstream-secret-id", taskID)
	require.Equal(t, upstream, string(data))
	require.NotContains(t, recorder.Body.String(), "upstream-secret-id")
	require.NotContains(t, recorder.Body.String(), "api.sonilo.com")
	require.Contains(t, recorder.Body.String(), "task_public")

	result, err := adaptor.ParseTaskResult([]byte(`{"task_id":"upstream-secret-id","status":"succeeded","duration_seconds":5,"audio":[{"url":"https://audio.example/file.mp3"}]}`))
	require.NoError(t, err)
	require.Equal(t, string(model.TaskStatusSuccess), result.Status)
	require.Equal(t, "https://audio.example/file.mp3", result.Url)

	failed, err := adaptor.ParseTaskResult([]byte(`{"task_id":"x","status":"failed","error":{"message":"Sonilo internal error"}}`))
	require.NoError(t, err)
	require.Equal(t, "task failed at upstream provider", failed.Reason)
}

func TestCompletionBillingUsesActualDurationAndFloor(t *testing.T) {
	adaptor := &TaskAdaptor{}
	task := &model.Task{
		Quota: 180,
		PrivateData: model.TaskPrivateData{BillingContext: &model.TaskBillingContext{
			PerCallBilling: true,
			OtherRatios:    map[string]float64{"seconds": 10, "variants": 2},
		}},
		Data: []byte(`{"status":"succeeded","duration_seconds":25,"audio":[{},{}]}`),
	}
	require.Equal(t, 450, adaptor.AdjustPerCallBillingOnComplete(task, &relaycommon.TaskInfo{}))
	task.Data = []byte(`{"status":"succeeded","duration_seconds":4,"audio":[{}]}`)
	require.Equal(t, 180, adaptor.AdjustPerCallBillingOnComplete(task, &relaycommon.TaskInfo{}))
}

func TestConvertAndExtractMultipleVariants(t *testing.T) {
	task := &model.Task{
		TaskID: "task_public", CreatedAt: 123, Status: model.TaskStatusSuccess,
		Properties: model.Properties{OriginModelName: ModelVideoToMusic},
		Data:       []byte(`{"status":"succeeded","duration_seconds":12,"audio":[{"url":"https://provider.example/a.mp3","content_type":"audio/mpeg"},{"url":"https://provider.example/b.mp3","content_type":"audio/mpeg"}]}`),
	}
	body, err := (&TaskAdaptor{}).ConvertToVideoToMusic(task)
	require.NoError(t, err)
	require.NotContains(t, string(body), "provider.example")
	require.NotContains(t, string(body), "api.sonilo.com")
	require.Contains(t, string(body), "variant=0")
	require.Contains(t, string(body), "variant=1")
	require.Equal(t, "https://provider.example/b.mp3", ExtractUpstreamAudioURL(task.Data, 1))
	require.Empty(t, ExtractUpstreamAudioURL(task.Data, 2))
}

func TestSoniloIsWhitelabeled(t *testing.T) {
	require.True(t, taskcommon.ShouldWhitelabelChannelType(constant.ChannelTypeSonilo))
}
