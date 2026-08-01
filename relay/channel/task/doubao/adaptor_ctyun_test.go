package doubao

import (
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"slices"
	"strings"
	"testing"

	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/service"
	"github.com/gin-gonic/gin"
)

func TestBuildTaskCollectionURL(t *testing.T) {
	tests := []struct {
		name    string
		baseURL string
		want    string
	}{
		{
			name:    "ctyun explicit v1",
			baseURL: "https://ai.ctaigw.cn/v1/",
			want:    "https://ai.ctaigw.cn/v1/contents/generations/tasks",
		},
		{
			name:    "volcengine legacy base",
			baseURL: "https://ark.cn-beijing.volces.com",
			want:    "https://ark.cn-beijing.volces.com/api/v3/contents/generations/tasks",
		},
		{
			name:    "volcengine explicit api v3",
			baseURL: "https://ark.cn-beijing.volces.com/api/v3/",
			want:    "https://ark.cn-beijing.volces.com/api/v3/contents/generations/tasks",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := buildTaskCollectionURL(tt.baseURL); got != tt.want {
				t.Fatalf("buildTaskCollectionURL() = %q, want %q", got, tt.want)
			}
		})
	}
}

func TestTaskAdaptorBuildRequestURLForCtyun(t *testing.T) {
	adaptor := &TaskAdaptor{}
	adaptor.Init(&relaycommon.RelayInfo{ChannelMeta: &relaycommon.ChannelMeta{ChannelBaseUrl: "https://ai.ctaigw.cn/v1"}})

	got, err := adaptor.BuildRequestURL(nil)
	if err != nil {
		t.Fatalf("BuildRequestURL() error = %v", err)
	}
	want := "https://ai.ctaigw.cn/v1/contents/generations/tasks"
	if got != want {
		t.Fatalf("BuildRequestURL() = %q, want %q", got, want)
	}
}

func TestFetchTaskUsesCtyunV1AndBearerAuth(t *testing.T) {
	service.InitHttpClient()
	var gotPath string
	var gotAuthorization string
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		gotPath = r.URL.EscapedPath()
		gotAuthorization = r.Header.Get("Authorization")
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"id":"cgt-2025-test","status":"pending"}`))
	}))
	defer server.Close()

	adaptor := &TaskAdaptor{}
	resp, err := adaptor.FetchTask(server.URL+"/v1", "test-key", map[string]any{
		"task_id": "cgt-2025-test",
	}, "")
	if err != nil {
		t.Fatalf("FetchTask() error = %v", err)
	}
	defer resp.Body.Close()
	_, _ = io.ReadAll(resp.Body)

	if gotPath != "/v1/contents/generations/tasks/cgt-2025-test" {
		t.Fatalf("request path = %q", gotPath)
	}
	if gotAuthorization != "Bearer test-key" {
		t.Fatalf("Authorization = %q", gotAuthorization)
	}
}

func TestCtyunModelsAreAdvertised(t *testing.T) {
	for _, model := range []string{"cdance2.0-fast-0611", "cdance2.0-0611"} {
		if !slices.Contains(ModelList, model) {
			t.Fatalf("ModelList does not contain %q", model)
		}
	}
}

func TestIsCtyunVideoBaseURL(t *testing.T) {
	tests := []struct {
		baseURL string
		want    bool
	}{
		{"https://ai.ctaigw.cn/v1", true},
		{"https://AI.CTAIGW.CN/v1/", true},
		{"https://ai.ctaigw.cn/api/v3", false},
		{"https://ai.ctaigw.cn.evil.example/v1", false},
		{"https://ark.cn-beijing.volces.com/v1", false},
	}

	for _, tt := range tests {
		if got := IsCtyunVideoBaseURL(tt.baseURL); got != tt.want {
			t.Errorf("IsCtyunVideoBaseURL(%q) = %v, want %v", tt.baseURL, got, tt.want)
		}
	}
}

func TestBuildRequestBodyForCtyun(t *testing.T) {
	gin.SetMode(gin.TestMode)
	ctx, _ := gin.CreateTestContext(nil)
	ctx.Set("task_request", relaycommon.TaskSubmitReq{
		Prompt:   "a quiet lake at sunrise",
		Model:    "cdance2.0-fast-0611",
		Duration: 5,
		Size:     "720P",
		Metadata: map[string]interface{}{
			"ratio":          "16:9",
			"generate_audio": false,
			"watermark":      true,
		},
	})

	adaptor := &TaskAdaptor{}
	adaptor.Init(&relaycommon.RelayInfo{ChannelMeta: &relaycommon.ChannelMeta{ChannelBaseUrl: "https://ai.ctaigw.cn/v1"}})
	info := &relaycommon.RelayInfo{ChannelMeta: &relaycommon.ChannelMeta{ChannelBaseUrl: "https://ai.ctaigw.cn/v1"}}
	bodyReader, err := adaptor.BuildRequestBody(ctx, info)
	if err != nil {
		t.Fatalf("BuildRequestBody() error = %v", err)
	}
	bodyBytes, err := io.ReadAll(bodyReader)
	if err != nil {
		t.Fatalf("ReadAll() error = %v", err)
	}
	var got requestPayload
	if err := json.Unmarshal(bodyBytes, &got); err != nil {
		t.Fatalf("unmarshal request body: %v", err)
	}
	if got.Model != "cdance2.0-fast-0611" || got.Resolution != "720p" || got.Ratio != "16:9" {
		t.Fatalf("unexpected request payload: %+v", got)
	}
	if got.Duration == nil || int(*got.Duration) != 5 {
		t.Fatalf("duration = %v, want 5", got.Duration)
	}
	if got.GenerateAudio == nil || bool(*got.GenerateAudio) {
		t.Fatalf("generate_audio = %v, want false", got.GenerateAudio)
	}
	if got.Watermark == nil || !bool(*got.Watermark) {
		t.Fatalf("watermark = %v, want true", got.Watermark)
	}
	if len(got.Content) != 1 || got.Content[0].Type != "text" || got.Content[0].Text != "a quiet lake at sunrise" {
		t.Fatalf("content = %+v", got.Content)
	}
}

func TestBuildRequestBodyKeepsVolcenginePayloadSemantics(t *testing.T) {
	gin.SetMode(gin.TestMode)
	ctx, _ := gin.CreateTestContext(nil)
	ctx.Set("task_request", relaycommon.TaskSubmitReq{
		Prompt:   "legacy payload",
		Model:    "seedance-1-0-pro-250528",
		Duration: 10,
		Seconds:  "8",
		Size:     "720p",
		Metadata: map[string]interface{}{
			"duration": 5,
		},
	})

	adaptor := &TaskAdaptor{}
	adaptor.Init(&relaycommon.RelayInfo{ChannelMeta: &relaycommon.ChannelMeta{ChannelBaseUrl: "https://ark.cn-beijing.volces.com"}})
	info := &relaycommon.RelayInfo{ChannelMeta: &relaycommon.ChannelMeta{ChannelBaseUrl: "https://ark.cn-beijing.volces.com"}}
	bodyReader, err := adaptor.BuildRequestBody(ctx, info)
	if err != nil {
		t.Fatalf("BuildRequestBody() error = %v", err)
	}
	bodyBytes, err := io.ReadAll(bodyReader)
	if err != nil {
		t.Fatalf("ReadAll() error = %v", err)
	}
	var got requestPayload
	if err := json.Unmarshal(bodyBytes, &got); err != nil {
		t.Fatalf("unmarshal request body: %v", err)
	}
	if got.Duration == nil || int(*got.Duration) != 8 {
		t.Fatalf("legacy Volcengine duration = %v, want seconds override 8", got.Duration)
	}
	if got.Resolution != "" {
		t.Fatalf("legacy Volcengine resolution = %q, want provider default", got.Resolution)
	}
}

func TestBuildRequestBodyKeepsVolcengineMetadataDuration(t *testing.T) {
	gin.SetMode(gin.TestMode)
	ctx, _ := gin.CreateTestContext(nil)
	ctx.Set("task_request", relaycommon.TaskSubmitReq{
		Prompt:   "legacy metadata duration",
		Model:    "seedance-1-0-pro-250528",
		Duration: 10,
		Metadata: map[string]interface{}{
			"duration": 5,
		},
	})

	adaptor := &TaskAdaptor{}
	adaptor.Init(&relaycommon.RelayInfo{ChannelMeta: &relaycommon.ChannelMeta{ChannelBaseUrl: "https://ark.cn-beijing.volces.com"}})
	info := &relaycommon.RelayInfo{ChannelMeta: &relaycommon.ChannelMeta{ChannelBaseUrl: "https://ark.cn-beijing.volces.com"}}
	bodyReader, err := adaptor.BuildRequestBody(ctx, info)
	if err != nil {
		t.Fatalf("BuildRequestBody() error = %v", err)
	}
	bodyBytes, err := io.ReadAll(bodyReader)
	if err != nil {
		t.Fatalf("ReadAll() error = %v", err)
	}
	var got requestPayload
	if err := json.Unmarshal(bodyBytes, &got); err != nil {
		t.Fatalf("unmarshal request body: %v", err)
	}
	if got.Duration == nil || int(*got.Duration) != 5 {
		t.Fatalf("legacy Volcengine duration = %v, want metadata duration 5", got.Duration)
	}
}

func TestBuildRequestBodyRejectsUnsupportedCtyunCombination(t *testing.T) {
	gin.SetMode(gin.TestMode)
	for _, req := range []relaycommon.TaskSubmitReq{
		{Prompt: "test", Model: "cdance2.0-fast-0611", Size: "4K"},
		{Prompt: "test", Model: "unknown-video-model", Size: "720p"},
	} {
		ctx, _ := gin.CreateTestContext(nil)
		ctx.Set("task_request", req)
		adaptor := &TaskAdaptor{}
		adaptor.Init(&relaycommon.RelayInfo{ChannelMeta: &relaycommon.ChannelMeta{ChannelBaseUrl: "https://ai.ctaigw.cn/v1"}})
		info := &relaycommon.RelayInfo{ChannelMeta: &relaycommon.ChannelMeta{ChannelBaseUrl: "https://ai.ctaigw.cn/v1"}}

		if _, err := adaptor.BuildRequestBody(ctx, info); err == nil {
			t.Fatalf("request must be rejected locally: %+v", req)
		}
	}
}

func TestParseCtyunTaskStatusesAndUsage(t *testing.T) {
	adaptor := &TaskAdaptor{}
	tests := []struct {
		name       string
		body       string
		wantStatus string
		wantURL    string
		wantTokens int
	}{
		{"pending", `{"status":"pending"}`, "QUEUED", "", 0},
		{"running", `{"status":"running"}`, "IN_PROGRESS", "", 0},
		{"success", `{"status":"succeeded","content":{"video_url":"https://example.test/video.mp4"},"usage":{"total_tokens":123}}`, "SUCCESS", "https://example.test/video.mp4", 123},
		{"failed", `{"status":"failed","error":{"message":"blocked"}}`, "FAILURE", "", 0},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, err := adaptor.ParseTaskResult([]byte(tt.body))
			if err != nil {
				t.Fatalf("ParseTaskResult() error = %v", err)
			}
			if got.Status != tt.wantStatus || got.Url != tt.wantURL || got.TotalTokens != tt.wantTokens {
				t.Fatalf("ParseTaskResult() = %+v", got)
			}
		})
	}
}

func TestDoResponseRejectsMissingUpstreamTaskID(t *testing.T) {
	gin.SetMode(gin.TestMode)
	ctx, _ := gin.CreateTestContext(nil)
	resp := &http.Response{
		StatusCode: http.StatusOK,
		Body:       io.NopCloser(strings.NewReader(`{"id":""}`)),
	}
	adaptor := &TaskAdaptor{}
	_, _, taskErr := adaptor.DoResponse(ctx, resp, &relaycommon.RelayInfo{TaskRelayInfo: &relaycommon.TaskRelayInfo{PublicTaskID: "task_public"}})
	if taskErr == nil || taskErr.Code != "invalid_response" {
		t.Fatalf("taskErr = %+v, want invalid_response", taskErr)
	}
}
