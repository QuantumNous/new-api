package hailuov2

import (
	"io"
	"math"
	"net/http"
	"net/http/httptest"
	"strconv"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/model"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/service"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
)

func newVideoContext(body, upstreamModel string) (*gin.Context, *relaycommon.RelayInfo) {
	t := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(t)
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/videos", strings.NewReader(body))
	c.Request.Header.Set("Content-Type", "application/json")
	return c, &relaycommon.RelayInfo{
		ChannelMeta: &relaycommon.ChannelMeta{
			ChannelType:       constant.ChannelTypeMiniMaxH3,
			ChannelBaseUrl:    "https://api.minimax.io",
			ApiKey:            "secret",
			UpstreamModelName: upstreamModel,
		},
		TaskRelayInfo:   &relaycommon.TaskRelayInfo{},
		OriginModelName: "client-alias",
	}
}

func validTextRequest(resolution string, duration int) VideoRequest {
	return VideoRequest{
		Model:      "client-alias",
		Content:    []ContentItem{{Type: "text", Text: common.GetPointer("prompt")}},
		Resolution: resolution,
		Duration:   duration,
		Ratio:      common.GetPointer("16:9"),
	}
}

func TestValidateAfterModelMappingStoresForcedUpstreamRequest(t *testing.T) {
	body := `{"model":"client-alias","content":[{"type":"text","text":"prompt"}],"resolution":"768P","duration":4,"ratio":"16:9","aigc_watermark":false}`
	c, info := newVideoContext(body, ModelName)

	adaptor := &TaskAdaptor{}
	require.Nil(t, adaptor.ValidateRequestAfterModelMapping(c, info))
	require.Equal(t, constant.TaskActionGenerate, info.Action)

	requestBody, err := adaptor.BuildRequestBody(c, info)
	require.NoError(t, err)
	data, err := io.ReadAll(requestBody)
	require.NoError(t, err)
	require.Contains(t, string(data), `"aigc_watermark":false`)

	var request VideoRequest
	require.NoError(t, common.Unmarshal(data, &request))
	require.Equal(t, ModelName, request.Model)
	require.NotNil(t, request.AIGCWatermark)
	require.False(t, *request.AIGCWatermark)
}

func TestValidateAfterModelMappingRejectsUnsupportedMappedModel(t *testing.T) {
	c, info := newVideoContext(`{"model":"client-alias"}`, "MiniMax-H3-Context-IR")
	taskErr := (&TaskAdaptor{}).ValidateRequestAfterModelMapping(c, info)
	require.NotNil(t, taskErr)
	require.Equal(t, "unsupported_model", taskErr.Code)
}

func TestValidateVideoRequestBoundaries(t *testing.T) {
	for _, resolution := range []string{"768P", "2K"} {
		for _, duration := range []int{4, 15} {
			req := validTextRequest(resolution, duration)
			code, err := validateVideoRequest(&req)
			require.NoError(t, err, "%s/%d returned %s", resolution, duration, code)
		}
	}

	tests := []struct {
		name string
		req  VideoRequest
		code string
	}{
		{name: "missing model", req: func() VideoRequest { r := validTextRequest("768P", 4); r.Model = ""; return r }(), code: "invalid_model"},
		{name: "duration below minimum", req: validTextRequest("768P", 3), code: "invalid_duration"},
		{name: "duration above maximum", req: validTextRequest("768P", 16), code: "invalid_duration"},
		{name: "unsupported resolution", req: validTextRequest("1080P", 4), code: "invalid_resolution"},
		{name: "missing text", req: func() VideoRequest { r := validTextRequest("768P", 4); r.Content = nil; return r }(), code: "invalid_content"},
		{name: "blank text", req: func() VideoRequest {
			r := validTextRequest("768P", 4)
			r.Content[0].Text = common.GetPointer("  ")
			return r
		}(), code: "invalid_content"},
		{name: "text too long", req: func() VideoRequest {
			r := validTextRequest("768P", 4)
			r.Content[0].Text = common.GetPointer(strings.Repeat("界", 7001))
			return r
		}(), code: "invalid_content"},
		{name: "text only missing ratio", req: func() VideoRequest { r := validTextRequest("768P", 4); r.Ratio = nil; return r }(), code: "invalid_ratio"},
		{name: "text only adaptive ratio", req: func() VideoRequest {
			r := validTextRequest("768P", 4)
			r.Ratio = common.GetPointer("adaptive")
			return r
		}(), code: "invalid_ratio"},
		{name: "unsupported ratio", req: func() VideoRequest { r := validTextRequest("768P", 4); r.Ratio = common.GetPointer("2:1"); return r }(), code: "invalid_ratio"},
		{name: "callback present", req: func() VideoRequest { r := validTextRequest("768P", 4); r.CallbackURL = common.GetPointer(""); return r }(), code: "unsupported_callback_url"},
		{name: "multiple payloads", req: func() VideoRequest {
			r := validTextRequest("768P", 4)
			r.Content[0].ImageURL = &URLValue{URL: "https://example.com/a.png"}
			return r
		}(), code: "invalid_content"},
		{name: "frame and reference", req: func() VideoRequest {
			r := validTextRequest("768P", 4)
			r.Ratio = nil
			r.Content = append(r.Content,
				ContentItem{Type: "image_url", ImageURL: &URLValue{URL: "https://example.com/first.png"}, Role: common.GetPointer("first_frame")},
				ContentItem{Type: "image_url", ImageURL: &URLValue{URL: "https://example.com/ref.png"}, Role: common.GetPointer("reference_image")},
			)
			return r
		}(), code: "invalid_content"},
		{name: "reference audio alone", req: func() VideoRequest {
			r := validTextRequest("768P", 4)
			r.Content = append(r.Content, ContentItem{Type: "audio_url", AudioURL: &URLValue{URL: "https://example.com/ref.mp3"}, Role: common.GetPointer("reference_audio")})
			return r
		}(), code: "invalid_content"},
		{name: "too many reference images", req: func() VideoRequest {
			r := validTextRequest("768P", 4)
			for range 10 {
				r.Content = append(r.Content, ContentItem{Type: "image_url", ImageURL: &URLValue{URL: "https://example.com/ref.png"}, Role: common.GetPointer("reference_image")})
			}
			return r
		}(), code: "invalid_content"},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			code, err := validateVideoRequest(&test.req)
			require.Error(t, err)
			require.Equal(t, test.code, code)
		})
	}
}

func TestValidateVideoRequestDefaultsMediaRatioToAdaptive(t *testing.T) {
	req := validTextRequest("768P", 4)
	req.Ratio = nil
	req.Content = append(req.Content, ContentItem{
		Type: "image_url", ImageURL: &URLValue{URL: "https://example.com/first.png"}, Role: common.GetPointer("first_frame"),
	})
	_, err := validateVideoRequest(&req)
	require.NoError(t, err)
	require.NotNil(t, req.Ratio)
	require.Equal(t, "adaptive", *req.Ratio)
}

func TestTaskAdaptorBuildsURLAndHeaders(t *testing.T) {
	adaptor := &TaskAdaptor{}
	_, info := newVideoContext(`{}`, ModelName)
	info.ChannelBaseUrl = ""
	adaptor.Init(info)
	requestURL, err := adaptor.BuildRequestURL(info)
	require.NoError(t, err)
	require.Equal(t, "https://api.minimax.io/v2/video_generation", requestURL)

	req := httptest.NewRequest(http.MethodPost, requestURL, nil)
	require.NoError(t, adaptor.BuildRequestHeader(nil, req, info))
	require.Equal(t, "Bearer secret", req.Header.Get("Authorization"))
	require.Equal(t, "application/json", req.Header.Get("Content-Type"))

	info.ChannelBaseUrl = "https://api.minimax.chat///"
	adaptor.Init(info)
	requestURL, err = adaptor.BuildRequestURL(info)
	require.NoError(t, err)
	require.Equal(t, "https://api.minimax.chat/v2/video_generation", requestURL)
}

func TestDoResponseReturnsPublicIDAndKeepsUpstreamIDPrivate(t *testing.T) {
	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)
	info := &relaycommon.RelayInfo{
		TaskRelayInfo:   &relaycommon.TaskRelayInfo{PublicTaskID: "task_public"},
		OriginModelName: "client-alias",
	}
	resp := &http.Response{Body: io.NopCloser(strings.NewReader(`{"task_id":"upstream-secret"}`))}

	upstreamID, taskData, taskErr := (&TaskAdaptor{}).DoResponse(c, resp, info)
	require.Nil(t, taskErr)
	require.Equal(t, "upstream-secret", upstreamID)
	require.NotContains(t, string(taskData), "upstream-secret")
	var persisted map[string]any
	require.NoError(t, common.Unmarshal(taskData, &persisted))
	require.NotContains(t, persisted, "task_id")
	require.Contains(t, recorder.Body.String(), `"id":"task_public"`)
	require.NotContains(t, recorder.Body.String(), "upstream-secret")
}

func TestFetchTaskEscapesIDAndSetsBearerHeader(t *testing.T) {
	service.InitHttpClient()
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		require.Equal(t, "/v2/query/video_generation/task%2Fwith%20space", r.URL.EscapedPath())
		require.Equal(t, "Bearer secret", r.Header.Get("Authorization"))
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"task":{"status":"queued"}}`))
	}))
	defer server.Close()

	resp, err := (&TaskAdaptor{}).FetchTask(server.URL+"/", "secret", map[string]any{"task_id": "task/with space"}, "")
	require.NoError(t, err)
	defer resp.Body.Close()
	require.Equal(t, http.StatusOK, resp.StatusCode)
}

func TestFetchTaskSanitizesUpstreamIDAndPreservesParsingAndBilling(t *testing.T) {
	service.InitHttpClient()
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_, _ = w.Write([]byte(`{
			"task": {
				"id": "upstream-secret",
				"status": "succeeded",
				"content": {"url": "https://example.com/video.mp4"},
				"usage": {"total_seconds": 8, "input_image_count": 5},
				"resolution": "768P",
				"diagnostic": "preserved"
			},
			"request_trace": "trace-preserved"
		}`))
	}))
	defer server.Close()

	resp, err := (&TaskAdaptor{}).FetchTask(server.URL, "secret", map[string]any{"task_id": "upstream-secret"}, "")
	require.NoError(t, err)
	defer resp.Body.Close()
	body, err := io.ReadAll(resp.Body)
	require.NoError(t, err)
	require.NotContains(t, string(body), "upstream-secret")
	require.Contains(t, string(body), `"diagnostic":"preserved"`)
	require.Contains(t, string(body), `"request_trace":"trace-preserved"`)

	result, err := (&TaskAdaptor{}).ParseTaskResult(body)
	require.NoError(t, err)
	require.Equal(t, string(model.TaskStatusSuccess), result.Status)
	require.Empty(t, result.TaskID)
	require.Equal(t, "https://example.com/video.mp4", result.Url)

	task := completedTask("768P", 10, 1000, 8, 5)
	task.Data = body
	require.Equal(t, 800, (&TaskAdaptor{}).AdjustPerCallBillingOnComplete(task, result))
}

func TestFetchTaskPreservesErrorEnvelope(t *testing.T) {
	service.InitHttpClient()
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusUnauthorized)
		_, _ = w.Write([]byte(`{"type":"error","error":{"message":"invalid key","http_code":"401"}}`))
	}))
	defer server.Close()

	resp, err := (&TaskAdaptor{}).FetchTask(server.URL, "secret", map[string]any{"task_id": "upstream-secret"}, "")
	require.NoError(t, err)
	defer resp.Body.Close()
	body, err := io.ReadAll(resp.Body)
	require.NoError(t, err)

	result, err := (&TaskAdaptor{}).ParseTaskResult(body)
	require.NoError(t, err)
	require.Equal(t, string(model.TaskStatusFailure), result.Status)
	require.Equal(t, http.StatusUnauthorized, result.Code)
	require.Equal(t, "invalid key", result.Reason)
}

func TestParseTaskResultMapsStatuses(t *testing.T) {
	tests := []struct {
		name       string
		body       string
		wantStatus model.TaskStatus
		wantReason string
	}{
		{name: "queued", body: `{"task":{"id":"upstream","status":"queued"}}`, wantStatus: model.TaskStatusQueued},
		{name: "running", body: `{"task":{"id":"upstream","status":"running"}}`, wantStatus: model.TaskStatusInProgress},
		{name: "failed", body: `{"task":{"id":"upstream","status":"failed","error":{"code":"1026","message":"sensitive content"}}}`, wantStatus: model.TaskStatusFailure, wantReason: "sensitive content"},
		{name: "cancelled", body: `{"task":{"id":"upstream","status":"cancelled"}}`, wantStatus: model.TaskStatusFailure, wantReason: "cancelled"},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			result, err := (&TaskAdaptor{}).ParseTaskResult([]byte(test.body))
			require.NoError(t, err)
			require.Equal(t, string(test.wantStatus), result.Status)
			require.Equal(t, test.wantReason, result.Reason)
		})
	}
}

func TestParseTaskResultRequiresCompleteSucceededPayload(t *testing.T) {
	valid := `{"task":{"id":"upstream","status":"succeeded","content":{"url":"https://example.com/video.mp4"},"usage":{"total_seconds":12,"output_seconds":5,"input_image_count":0},"resolution":"2K"}}`
	result, err := (&TaskAdaptor{}).ParseTaskResult([]byte(valid))
	require.NoError(t, err)
	require.Equal(t, string(model.TaskStatusSuccess), result.Status)
	require.Equal(t, "https://example.com/video.mp4", result.Url)
	require.Equal(t, 12, result.TotalTokens)
	require.Equal(t, 5, result.CompletionTokens)

	invalidBodies := []string{
		`{"task":{"status":"succeeded","content":{"url":"https://example.com/video.mp4"},"resolution":"2K"}}`,
		`{"task":{"status":"succeeded","content":{"url":"https://example.com/video.mp4"},"usage":{"input_image_count":0},"resolution":"2K"}}`,
		`{"task":{"status":"succeeded","content":{"url":"https://example.com/video.mp4"},"usage":{"total_seconds":0,"input_image_count":0},"resolution":"2K"}}`,
		`{"task":{"status":"succeeded","content":{"url":"https://example.com/video.mp4"},"usage":{"total_seconds":12},"resolution":"2K"}}`,
		`{"task":{"status":"succeeded","content":{"url":"https://example.com/video.mp4"},"usage":{"total_seconds":12,"input_image_count":-1},"resolution":"2K"}}`,
		`{"task":{"status":"succeeded","content":{"url":"https://example.com/video.mp4"},"usage":{"total_seconds":12,"input_image_count":0},"resolution":"1080P"}}`,
	}
	for _, body := range invalidBodies {
		result, err := (&TaskAdaptor{}).ParseTaskResult([]byte(body))
		require.Error(t, err, body)
		require.Nil(t, result)
	}
}

func TestMalformedSuccessDoesNotProduceTerminalResultForBilling(t *testing.T) {
	result, err := (&TaskAdaptor{}).ParseTaskResult([]byte(
		`{"task":{"status":"succeeded","usage":{"total_seconds":12,"input_image_count":0},"resolution":"2K"}}`,
	))

	require.ErrorContains(t, err, "missing content.url")
	// Polling settles only from a successful terminal TaskInfo. A nil result at
	// this adaptor boundary leaves the persisted task non-terminal and unbilled.
	require.Nil(t, result)
}

func TestParseTaskResultClassifiesErrorEnvelopes(t *testing.T) {
	for _, httpCode := range []string{"401", "404"} {
		result, err := (&TaskAdaptor{}).ParseTaskResult([]byte(`{"type":"error","error":{"message":"terminal error","http_code":"` + httpCode + `"}}`))
		require.NoError(t, err)
		require.Equal(t, string(model.TaskStatusFailure), result.Status)
		require.Equal(t, httpCode, strconv.Itoa(result.Code))
		require.Equal(t, "terminal error", result.Reason)
	}

	for _, httpCode := range []string{"429", "500"} {
		result, err := (&TaskAdaptor{}).ParseTaskResult([]byte(`{"type":"error","error":{"message":"retryable error","http_code":"` + httpCode + `"}}`))
		require.ErrorContains(t, err, "retryable error")
		require.Nil(t, result)
	}
}

func TestParseTaskResultRejectsUnknownStatus(t *testing.T) {
	_, err := (&TaskAdaptor{}).ParseTaskResult([]byte(`{"task":{"status":"paused"}}`))
	require.ErrorContains(t, err, "unknown upstream task status")
}

func TestEstimateBillingUsesInternationalResolutionAndImagePricing(t *testing.T) {
	tests := []struct {
		name       string
		request    VideoRequest
		wantUnits  float64
		wantMarker string
	}{
		{name: "768P", request: validTextRequest("768P", 5), wantUnits: 5, wantMarker: billingResolution768PKey},
		{name: "2K", request: validTextRequest("2K", 5), wantUnits: 8.125, wantMarker: billingResolution2KKey},
		{name: "reference videos reserve one maximum total input duration and sixth image", request: func() VideoRequest {
			r := validTextRequest("2K", 5)
			r.Ratio = common.GetPointer("adaptive")
			for range 2 {
				r.Content = append(r.Content, ContentItem{Type: "video_url", VideoURL: &URLValue{URL: "https://example.com/ref.mp4"}, Role: common.GetPointer("reference_video")})
			}
			for range 6 {
				r.Content = append(r.Content, ContentItem{Type: "image_url", ImageURL: &URLValue{URL: "https://example.com/ref.png"}, Role: common.GetPointer("reference_image")})
			}
			return r
		}(), wantUnits: 33, wantMarker: billingResolution2KKey},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			c, info := newVideoContext(`{}`, ModelName)
			c.Set(requestContextKey, test.request)
			info.PriceData.ModelPrice = 0.08
			ratios := (&TaskAdaptor{}).EstimateBilling(c, info)
			require.InDelta(t, test.wantUnits, ratios[billingUnitsKey], 1e-9)
			require.Equal(t, 1.0, ratios[billingRegionIntlKey])
			require.Equal(t, 1.0, ratios[test.wantMarker])
			require.Len(t, ratios, 3)
		})
	}
}

func completedTask(resolution string, reservedUnits float64, quota, seconds, images int) *model.Task {
	data, _ := common.Marshal(QueryResponse{Task: VideoTask{
		Status:     "succeeded",
		Resolution: resolution,
		Usage: &VideoTaskUsage{
			TotalSeconds:    common.GetPointer(seconds),
			InputImageCount: common.GetPointer(images),
		},
	}})
	marker := billingResolution768PKey
	if resolution == "2K" {
		marker = billingResolution2KKey
	}
	return &model.Task{
		TaskID: "task_public",
		Quota:  quota,
		Data:   data,
		PrivateData: model.TaskPrivateData{BillingContext: &model.TaskBillingContext{
			ModelPrice: 0.08,
			OtherRatios: map[string]float64{
				billingUnitsKey:      reservedUnits,
				billingRegionIntlKey: 1,
				marker:               1,
			},
		}},
	}
}

func TestCompletionBillingScalesPersistedReservation(t *testing.T) {
	adaptor := &TaskAdaptor{}
	request := completedTask("768P", 10, 1000, 8, 5)
	require.Equal(t, 800, adaptor.AdjustBillingOnComplete(request, nil))
	require.Equal(t, 800, adaptor.AdjustPerCallBillingOnComplete(request, nil))

	referenceVideo := completedTask("768P", 19, 1520, 10, 0)
	// Verified upstream usage for a 4-second output plus 6-second reference video is 10 seconds: $0.80.
	require.Equal(t, 800, adaptor.AdjustPerCallBillingOnComplete(referenceVideo, nil))

	sixImages := completedTask("768P", 4.5, 360, 4, 6)
	// Four output seconds cost $0.32 and the sixth image adds $0.04.
	require.Equal(t, 360, adaptor.AdjustPerCallBillingOnComplete(sixImages, nil))

	request2K := completedTask("2K", 16.25, 1625, 8, 6)
	// 8 seconds * 1.625 + one paid image at $0.04 / $0.08 = 13.5 units.
	require.Equal(t, 1350, adaptor.AdjustPerCallBillingOnComplete(request2K, nil))
}

func TestCompletionBillingKeepsReservationOnInvalidSnapshotOrUsage(t *testing.T) {
	tests := []struct {
		name   string
		mutate func(*model.Task)
	}{
		{name: "missing snapshot", mutate: func(task *model.Task) { task.PrivateData.BillingContext = nil }},
		{name: "missing units", mutate: func(task *model.Task) { delete(task.PrivateData.BillingContext.OtherRatios, billingUnitsKey) }},
		{name: "nan units", mutate: func(task *model.Task) { task.PrivateData.BillingContext.OtherRatios[billingUnitsKey] = math.NaN() }},
		{name: "missing region", mutate: func(task *model.Task) { delete(task.PrivateData.BillingContext.OtherRatios, billingRegionIntlKey) }},
		{name: "non-unit region marker", mutate: func(task *model.Task) { task.PrivateData.BillingContext.OtherRatios[billingRegionIntlKey] = 0.5 }},
		{name: "non-unit resolution marker", mutate: func(task *model.Task) { task.PrivateData.BillingContext.OtherRatios[billingResolution768PKey] = 0.5 }},
		{name: "ambiguous resolution", mutate: func(task *model.Task) { task.PrivateData.BillingContext.OtherRatios[billingResolution2KKey] = 1 }},
		{name: "resolution mismatch", mutate: func(task *model.Task) {
			task.Data, _ = common.Marshal(QueryResponse{Task: VideoTask{Resolution: "2K", Usage: &VideoTaskUsage{TotalSeconds: common.GetPointer(8), InputImageCount: common.GetPointer(0)}}})
		}},
		{name: "missing usage", mutate: func(task *model.Task) { task.Data = []byte(`{"task":{"resolution":"768P"}}`) }},
		{name: "overflow", mutate: func(task *model.Task) { task.PrivateData.BillingContext.OtherRatios[billingUnitsKey] = 1e-300 }},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			task := completedTask("768P", 10, 1000, 8, 5)
			test.mutate(task)
			require.Zero(t, (&TaskAdaptor{}).AdjustPerCallBillingOnComplete(task, nil))
		})
	}
}

func TestConvertToOpenAIVideoUsesOnlyPublicTaskFields(t *testing.T) {
	success := completedTask("768P", 10, 1000, 8, 5)
	success.Status = model.TaskStatusSuccess
	success.Progress = "100%"
	success.Properties.OriginModelName = "client-alias"
	success.PrivateData.UpstreamTaskID = "upstream-secret"
	success.PrivateData.ResultURL = "https://example.com/video.mp4"

	data, err := (&TaskAdaptor{}).ConvertToOpenAIVideo(success)
	require.NoError(t, err)
	require.Contains(t, string(data), `"id":"task_public"`)
	require.Contains(t, string(data), `"url":"https://example.com/video.mp4"`)
	require.NotContains(t, string(data), "upstream-secret")

	failure := &model.Task{
		TaskID:     "task_public",
		Status:     model.TaskStatusFailure,
		FailReason: "fallback failure",
		Data:       []byte(`{"task":{"status":"failed","error":{"code":"1026","message":"sensitive content"}}}`),
		Properties: model.Properties{OriginModelName: "client-alias"},
	}
	data, err = (&TaskAdaptor{}).ConvertToOpenAIVideo(failure)
	require.NoError(t, err)
	require.Contains(t, string(data), `"code":"1026"`)
	require.Contains(t, string(data), `"message":"sensitive content"`)
	require.NotContains(t, string(data), `"metadata"`)
}
