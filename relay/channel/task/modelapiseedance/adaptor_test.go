package modelapiseedance

import (
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/relay/channel"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/service"

	"github.com/gin-gonic/gin"
)

var (
	_ channel.TaskAdaptor          = (*TaskAdaptor)(nil)
	_ channel.OpenAIVideoConverter = (*TaskAdaptor)(nil)
)

func TestModelAPISeedanceAdaptorIdentity(t *testing.T) {
	adaptor := &TaskAdaptor{}
	if got := adaptor.GetChannelName(); got != "modelapi-seedance" {
		t.Fatalf("GetChannelName() = %q, want modelapi-seedance", got)
	}
	models := adaptor.GetModelList()
	if len(models) != 1 || models[0] != "doubao-seedance-2-5-260628" {
		t.Fatalf("GetModelList() = %v, want [doubao-seedance-2-5-260628]", models)
	}
}

func modelAPIPtrInt(v int) *int    { return &v }
func modelAPIPtrBool(v bool) *bool { return &v }

func newModelAPITestContext(body string) (*gin.Context, *httptest.ResponseRecorder) {
	gin.SetMode(gin.TestMode)
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/videos", strings.NewReader(body))
	c.Request.Header.Set("Content-Type", "application/json")
	return c, w
}

func newModelAPIRelayInfo(baseURL, key string) *relaycommon.RelayInfo {
	return &relaycommon.RelayInfo{
		OriginModelName: "client-seedance",
		ChannelMeta: &relaycommon.ChannelMeta{
			ChannelType:       constant.ChannelTypeModelAPISeedance,
			ChannelBaseUrl:    baseURL,
			ApiKey:            key,
			UpstreamModelName: "client-configured-model",
		},
		TaskRelayInfo: &relaycommon.TaskRelayInfo{PublicTaskID: "task_public"},
	}
}

func TestBuildModelAPICreateRequestMapsTextMediaRolesAndVideoAssetSelection(t *testing.T) {
	seedReq := &dto.SeedanceVideoRequest{
		Model: "client-model",
		Content: []dto.SeedanceContentItem{
			{Type: dto.SeedanceContentText, Text: "make it cinematic"},
			{Type: dto.SeedanceContentImage, ImageURL: &dto.SeedanceURLObject{URL: "https://cdn.example/ref.png"}},
			{Type: dto.SeedanceContentImage, ImageURL: &dto.SeedanceURLObject{URL: "https://cdn.example/first.png"}, Role: dto.SeedanceRoleFirstFrame},
			{Type: dto.SeedanceContentImage, ImageURL: &dto.SeedanceURLObject{URL: "https://cdn.example/last.png"}, Role: dto.SeedanceRoleLastFrame},
			{Type: dto.SeedanceContentVideo, VideoURL: &dto.SeedanceURLObject{URL: "https://cdn.example/ref.mp4"}},
			{Type: dto.SeedanceContentAudio, AudioURL: &dto.SeedanceURLObject{URL: "https://cdn.example/ref.mp3"}},
		},
		Ratio:           "16:9",
		Resolution:      "720p",
		Duration:        modelAPIPtrInt(5),
		Seed:            modelAPIPtrInt(42),
		GenerateAudio:   modelAPIPtrBool(true),
		Watermark:       modelAPIPtrBool(false),
		ReturnLastFrame: modelAPIPtrBool(false),
	}

	body := buildModelAPICreateRequest(seedReq)
	if body.Model != UpstreamModel {
		t.Fatalf("model = %q, want fixed upstream model %q", body.Model, UpstreamModel)
	}
	if len(body.Input) != 6 {
		t.Fatalf("input length = %d, want 6: %+v", len(body.Input), body.Input)
	}
	if body.Input[0].Role != "prompt" || body.Input[0].Content != "make it cinematic" {
		t.Fatalf("text input = %+v", body.Input[0])
	}
	wantRoles := []string{"reference", "first_frame", "last_frame", "reference", "reference"}
	for i, want := range wantRoles {
		if got := body.Input[i+1].Role; got != want {
			t.Fatalf("input[%d].role = %q, want %q", i+1, got, want)
		}
	}
	if body.Params == nil || body.Params.AspectRatio != "16:9" || body.Params.Resolution != "720p" {
		t.Fatalf("params not mapped: %+v", body.Params)
	}

	info, err := (&TaskAdaptor{}).ParseTaskResult([]byte(`{
		"task_id":"upstream",
		"status":"succeeded",
		"result":{"assets":[
			{"type":"thumbnail","url":"https://cdn.example/thumb.jpg"},
			{"type":"video","url":"https://cdn.example/final.mp4"}
		]}
	}`))
	if err != nil {
		t.Fatalf("ParseTaskResult error: %v", err)
	}
	if info.Url != "https://cdn.example/final.mp4" {
		t.Fatalf("selected url = %q, want non-first video asset", info.Url)
	}
}

func TestBuildRequestBodyPreservesExplicitZeroFalseAndOmitsAbsentParams(t *testing.T) {
	c, _ := newModelAPITestContext(`{
		"model":"client-model",
		"content":[{"type":"text","text":"x"},{"type":"image_url","image_url":{"url":"https://x/i.png?a=1&b=2"}}],
		"seed":0,
		"generate_audio":false,
		"watermark":false,
		"return_last_frame":false
	}`)
	reader, err := (&TaskAdaptor{}).BuildRequestBody(c, newModelAPIRelayInfo("", ""))
	if err != nil {
		t.Fatalf("BuildRequestBody error: %v", err)
	}
	endToEndRaw, err := io.ReadAll(reader)
	if err != nil {
		t.Fatalf("read BuildRequestBody: %v", err)
	}
	if !strings.Contains(string(endToEndRaw), "a=1&b=2") {
		t.Fatalf("BuildRequestBody escaped URL query: %s", endToEndRaw)
	}

	seedReq := &dto.SeedanceVideoRequest{
		Content:         []dto.SeedanceContentItem{{Type: dto.SeedanceContentText, Text: "x"}},
		Seed:            modelAPIPtrInt(0),
		GenerateAudio:   modelAPIPtrBool(false),
		Watermark:       modelAPIPtrBool(false),
		ReturnLastFrame: modelAPIPtrBool(false),
	}
	body := buildModelAPICreateRequest(seedReq)
	raw, err := common.MarshalNoHTMLEscape(body)
	if err != nil {
		t.Fatalf("marshal body: %v", err)
	}
	text := string(raw)
	for _, want := range []string{`"seed":0`, `"generate_audio":false`, `"watermark":false`, `"return_last_frame":false`} {
		if !strings.Contains(text, want) {
			t.Fatalf("body missing %s: %s", want, text)
		}
	}
	for _, omitted := range []string{"duration", "resolution", "aspect_ratio"} {
		if strings.Contains(text, omitted) {
			t.Fatalf("body should omit %s when absent: %s", omitted, text)
		}
	}
}

func TestValidateModelAPISeedanceValues(t *testing.T) {
	valid := dto.SeedanceVideoRequest{
		Content: []dto.SeedanceContentItem{
			{Type: dto.SeedanceContentText, Text: "x"},
			{Type: dto.SeedanceContentImage, ImageURL: &dto.SeedanceURLObject{URL: "https://x/ref.png"}},
			{Type: dto.SeedanceContentVideo, VideoURL: &dto.SeedanceURLObject{URL: "https://x/ref.mp4"}},
			{Type: dto.SeedanceContentAudio, AudioURL: &dto.SeedanceURLObject{URL: "https://x/ref.mp3"}},
		},
		Duration:   modelAPIPtrInt(4),
		Resolution: "480p",
		Ratio:      "adaptive",
	}
	if err := validateModelAPISeedanceRequest(&valid); err != nil {
		t.Fatalf("valid request rejected: %v", err)
	}

	tests := []struct {
		name string
		req  dto.SeedanceVideoRequest
	}{
		{name: "duration low", req: dto.SeedanceVideoRequest{Duration: modelAPIPtrInt(3)}},
		{name: "duration high", req: dto.SeedanceVideoRequest{Duration: modelAPIPtrInt(31)}},
		{name: "resolution", req: dto.SeedanceVideoRequest{Resolution: "1080p"}},
		{name: "aspect", req: dto.SeedanceVideoRequest{Ratio: "3:2"}},
		{name: "image role", req: dto.SeedanceVideoRequest{Content: []dto.SeedanceContentItem{{Type: dto.SeedanceContentImage, ImageURL: &dto.SeedanceURLObject{URL: "https://x/i.png"}, Role: "cover"}}}},
		{name: "video role", req: dto.SeedanceVideoRequest{Content: []dto.SeedanceContentItem{{Type: dto.SeedanceContentVideo, VideoURL: &dto.SeedanceURLObject{URL: "https://x/v.mp4"}, Role: "first_frame"}}}},
		{name: "audio role", req: dto.SeedanceVideoRequest{Content: []dto.SeedanceContentItem{{Type: dto.SeedanceContentAudio, AudioURL: &dto.SeedanceURLObject{URL: "https://x/a.mp3"}, Role: "narration"}}}},
		{name: "last without first", req: dto.SeedanceVideoRequest{Content: []dto.SeedanceContentItem{{Type: dto.SeedanceContentImage, ImageURL: &dto.SeedanceURLObject{URL: "https://x/last.png"}, Role: dto.SeedanceRoleLastFrame}}}},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if err := validateModelAPISeedanceRequest(&tt.req); err == nil {
				t.Fatal("expected validation error")
			}
		})
	}

	countReq := dto.SeedanceVideoRequest{}
	for i := 0; i < 31; i++ {
		countReq.Content = append(countReq.Content, dto.SeedanceContentItem{Type: dto.SeedanceContentImage, ImageURL: &dto.SeedanceURLObject{URL: "https://x/i.png"}})
	}
	if err := validateModelAPISeedanceRequest(&countReq); err == nil {
		t.Fatal("expected image count error")
	}

	videoCountReq := dto.SeedanceVideoRequest{}
	for i := 0; i < 11; i++ {
		videoCountReq.Content = append(videoCountReq.Content, dto.SeedanceContentItem{Type: dto.SeedanceContentVideo, VideoURL: &dto.SeedanceURLObject{URL: "https://x/v.mp4"}})
	}
	if err := validateModelAPISeedanceRequest(&videoCountReq); err == nil {
		t.Fatal("expected video count error")
	}

	audioCountReq := dto.SeedanceVideoRequest{}
	for i := 0; i < 11; i++ {
		audioCountReq.Content = append(audioCountReq.Content, dto.SeedanceContentItem{Type: dto.SeedanceContentAudio, AudioURL: &dto.SeedanceURLObject{URL: "https://x/a.mp3"}})
	}
	if err := validateModelAPISeedanceRequest(&audioCountReq); err == nil {
		t.Fatal("expected audio count error")
	}

	totalCountReq := dto.SeedanceVideoRequest{}
	for i := 0; i < 30; i++ {
		totalCountReq.Content = append(totalCountReq.Content, dto.SeedanceContentItem{Type: dto.SeedanceContentImage, ImageURL: &dto.SeedanceURLObject{URL: "https://x/i.png"}})
	}
	for i := 0; i < 10; i++ {
		totalCountReq.Content = append(totalCountReq.Content, dto.SeedanceContentItem{Type: dto.SeedanceContentVideo, VideoURL: &dto.SeedanceURLObject{URL: "https://x/v.mp4"}})
	}
	for i := 0; i < 11; i++ {
		totalCountReq.Content = append(totalCountReq.Content, dto.SeedanceContentItem{Type: dto.SeedanceContentAudio, AudioURL: &dto.SeedanceURLObject{URL: "https://x/a.mp3"}})
	}
	if err := validateModelAPISeedanceRequest(&totalCountReq); err == nil {
		t.Fatal("expected total media count error")
	}

	firstFrameReq := dto.SeedanceVideoRequest{Content: []dto.SeedanceContentItem{
		{Type: dto.SeedanceContentImage, ImageURL: &dto.SeedanceURLObject{URL: "https://x/first-a.png"}, Role: dto.SeedanceRoleFirstFrame},
		{Type: dto.SeedanceContentImage, ImageURL: &dto.SeedanceURLObject{URL: "https://x/first-b.png"}, Role: dto.SeedanceRoleFirstFrame},
	}}
	if err := validateModelAPISeedanceRequest(&firstFrameReq); err == nil {
		t.Fatal("expected first_frame max-one error")
	}

	lastFrameReq := dto.SeedanceVideoRequest{Content: []dto.SeedanceContentItem{
		{Type: dto.SeedanceContentImage, ImageURL: &dto.SeedanceURLObject{URL: "https://x/first.png"}, Role: dto.SeedanceRoleFirstFrame},
		{Type: dto.SeedanceContentImage, ImageURL: &dto.SeedanceURLObject{URL: "https://x/last-a.png"}, Role: dto.SeedanceRoleLastFrame},
		{Type: dto.SeedanceContentImage, ImageURL: &dto.SeedanceURLObject{URL: "https://x/last-b.png"}, Role: dto.SeedanceRoleLastFrame},
	}}
	if err := validateModelAPISeedanceRequest(&lastFrameReq); err == nil {
		t.Fatal("expected last_frame max-one error")
	}
}

func TestValidateRequestAndSetActionAcceptsAudioOnlyAndSetsFixedUpstreamModel(t *testing.T) {
	c, _ := newModelAPITestContext(`{"model":"client-model","content":[{"type":"audio_url","audio_url":{"url":"https://x/a.mp3"}}]}`)
	info := newModelAPIRelayInfo("", "")
	a := &TaskAdaptor{}
	if taskErr := a.ValidateRequestAndSetAction(c, info); taskErr != nil {
		t.Fatalf("audio-only request rejected: %+v", taskErr)
	}
	if info.UpstreamModelName != UpstreamModel {
		t.Fatalf("UpstreamModelName = %q, want %q", info.UpstreamModelName, UpstreamModel)
	}
	if info.Action != constant.TaskActionGenerate {
		t.Fatalf("Action = %q, want generate", info.Action)
	}
}

func TestBuildAndFetchPathsHeadersAndEscaping(t *testing.T) {
	service.InitHttpClient()
	a := &TaskAdaptor{}
	info := newModelAPIRelayInfo("https://api.modelapi.co///", "secret")
	a.Init(info)
	if a.baseURL != "https://api.modelapi.co" {
		t.Fatalf("baseURL = %q, want trimmed", a.baseURL)
	}
	if got, err := a.BuildRequestURL(info); err != nil || got != "https://api.modelapi.co/v1/tasks" {
		t.Fatalf("BuildRequestURL = %q, %v", got, err)
	}
	req := httptest.NewRequest(http.MethodPost, "/upstream", nil)
	if err := a.BuildRequestHeader(nil, req, info); err != nil {
		t.Fatalf("BuildRequestHeader error: %v", err)
	}
	if req.Header.Get("Authorization") != "Bearer secret" {
		t.Fatalf("Authorization = %q", req.Header.Get("Authorization"))
	}

	var gotPath, gotAuth string
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		gotPath = r.URL.EscapedPath()
		gotAuth = r.Header.Get("Authorization")
		_, _ = w.Write([]byte(`{"task_id":"ok","status":"running"}`))
	}))
	defer server.Close()
	resp, err := a.FetchTask(server.URL, "fetch-key", map[string]any{"task_id": "task/a b"}, "")
	if err != nil {
		t.Fatalf("FetchTask error: %v", err)
	}
	_ = resp.Body.Close()
	if gotPath != "/v1/tasks/task%2Fa%20b" {
		t.Fatalf("fetch path = %q", gotPath)
	}
	if gotAuth != "Bearer fetch-key" {
		t.Fatalf("fetch auth = %q", gotAuth)
	}
}

func TestInitFallsBackToDefaultBaseURL(t *testing.T) {
	a := &TaskAdaptor{}
	a.Init(newModelAPIRelayInfo("", "key"))
	if a.baseURL != constant.ChannelBaseURLs[constant.ChannelTypeModelAPISeedance] {
		t.Fatalf("baseURL = %q", a.baseURL)
	}
}

func TestDoResponseParsesExactTaskIDAndRejectsIDOnly(t *testing.T) {
	a := &TaskAdaptor{}
	info := newModelAPIRelayInfo("", "")
	c, w := newModelAPITestContext(`{}`)
	resp := &http.Response{StatusCode: http.StatusOK, Body: io.NopCloser(strings.NewReader(`{"task_id":"upstream-task","status":"pending"}`))}
	taskID, taskData, taskErr := a.DoResponse(c, resp, info)
	if taskErr != nil {
		t.Fatalf("DoResponse error: %+v", taskErr)
	}
	if taskID != "upstream-task" {
		t.Fatalf("taskID = %q", taskID)
	}
	if !strings.Contains(string(taskData), `"task_id":"upstream-task"`) {
		t.Fatalf("taskData = %s", taskData)
	}
	if strings.Contains(w.Body.String(), "upstream-task") || !strings.Contains(w.Body.String(), `"id":"task_public"`) {
		t.Fatalf("client response leaked upstream or missed public id: %s", w.Body.String())
	}

	c, _ = newModelAPITestContext(`{}`)
	resp = &http.Response{StatusCode: http.StatusOK, Body: io.NopCloser(strings.NewReader(`{"id":"wrong-field","status":"pending"}`))}
	taskID, _, taskErr = a.DoResponse(c, resp, info)
	if taskErr == nil {
		t.Fatal("expected id-only response to be rejected")
	}
	if taskID != "" {
		t.Fatalf("taskID = %q, want empty on error", taskID)
	}
	if strings.Contains(taskErr.Message, "ModelAPI") || strings.Contains(taskErr.Message, "api.modelapi.co") {
		t.Fatalf("task error leaked provider: %+v", taskErr)
	}

	c, _ = newModelAPITestContext(`{}`)
	resp = &http.Response{StatusCode: http.StatusOK, Body: io.NopCloser(strings.NewReader(`{"task_id":"upstream-task","status":"failed","error":{"message":"ModelAPI api.modelapi.co failed"}}`))}
	_, _, taskErr = a.DoResponse(c, resp, info)
	if taskErr == nil {
		t.Fatal("expected failed create response to be rejected")
	}
	if taskErr.Message != "task failed at upstream provider" {
		t.Fatalf("failed create message = %q", taskErr.Message)
	}
}

func TestParseTaskResultStatusMappingsAndFailureScrub(t *testing.T) {
	a := &TaskAdaptor{}
	tests := []struct {
		name       string
		body       string
		wantStatus string
		wantURL    string
		wantReason string
	}{
		{name: "pending queued", body: `{"task_id":"up","status":"pending"}`, wantStatus: model.TaskStatusQueued},
		{name: "polling progress", body: `{"task_id":"up","status":"polling"}`, wantStatus: model.TaskStatusInProgress},
		{name: "running progress", body: `{"task_id":"up","status":"running"}`, wantStatus: model.TaskStatusInProgress},
		{name: "unknown progress", body: `{"task_id":"up","status":"mystery"}`, wantStatus: model.TaskStatusInProgress},
		{name: "succeeded video", body: `{"task_id":"up","status":"succeeded","result":{"assets":[{"type":"image","url":"https://x/i.png"},{"type":"video","url":"https://x/v.mp4"}]}}`, wantStatus: model.TaskStatusSuccess, wantURL: "https://x/v.mp4"},
		{name: "failed scrubbed", body: `{"task_id":"up","status":"failed","error":{"code":"bad","message":"ModelAPI seedance host api.modelapi.co failed"}}`, wantStatus: model.TaskStatusFailure, wantReason: "task failed at upstream provider"},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			info, err := a.ParseTaskResult([]byte(tt.body))
			if err != nil {
				t.Fatalf("ParseTaskResult error: %v", err)
			}
			if info.Status != tt.wantStatus || info.Url != tt.wantURL || info.Reason != tt.wantReason {
				t.Fatalf("TaskInfo = %+v", info)
			}
		})
	}
	if _, err := a.ParseTaskResult([]byte(`{"task_id":"up","status":"succeeded","result":{"assets":[{"type":"image","url":"https://x/i.png"}]}}`)); err == nil {
		t.Fatal("expected missing video asset to be retryable error")
	}
}

func TestConvertToOpenAIVideoUsesPublicResultURLAndScrubsFailure(t *testing.T) {
	a := &TaskAdaptor{}
	success := &model.Task{
		TaskID:     "task_public",
		Status:     model.TaskStatusSuccess,
		Progress:   "100%",
		CreatedAt:  10,
		UpdatedAt:  20,
		Properties: model.Properties{OriginModelName: "client-model"},
		PrivateData: model.TaskPrivateData{
			ResultURL: "https://flatkey.example/v1/videos/task_public/content",
		},
		Data: []byte(`{"result":{"assets":[{"type":"video","url":"https://cdn.modelapi.co/private.mp4"}]}}`),
	}
	raw, err := a.ConvertToOpenAIVideo(success)
	if err != nil {
		t.Fatalf("ConvertToOpenAIVideo success error: %v", err)
	}
	var got dto.OpenAIVideo
	if err := common.Unmarshal(raw, &got); err != nil {
		t.Fatalf("unmarshal video: %v", err)
	}
	if got.Metadata["url"] != "https://flatkey.example/v1/videos/task_public/content" {
		t.Fatalf("metadata.url = %v", got.Metadata["url"])
	}
	if strings.Contains(string(raw), "cdn.modelapi.co") {
		t.Fatalf("success leaked upstream asset URL: %s", raw)
	}

	failure := &model.Task{
		TaskID:     "task_public",
		Status:     model.TaskStatusFailure,
		FailReason: "ModelAPI seedance failed",
	}
	raw, err = a.ConvertToOpenAIVideo(failure)
	if err != nil {
		t.Fatalf("ConvertToOpenAIVideo failure error: %v", err)
	}
	if err := common.Unmarshal(raw, &got); err != nil {
		t.Fatalf("unmarshal failure video: %v", err)
	}
	if got.Error == nil || got.Error.Message != "task failed at upstream provider" {
		t.Fatalf("failure error = %+v", got.Error)
	}
}
