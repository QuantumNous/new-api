package openaivideo

import (
	"bytes"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/QuantumNous/new-api/model"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/service"
	"github.com/gin-gonic/gin"
)

func TestXBSoraProviderURLsAndHeader(t *testing.T) {
	p := &xbSoraProvider{}

	if got := p.submitURL("https://example.com"); got != "https://example.com/api/v1/videos/generate" {
		t.Fatalf("submitURL host root = %q", got)
	}
	if got := p.submitURL("https://example.com/api/v1/"); got != "https://example.com/api/v1/videos/generate" {
		t.Fatalf("submitURL api base = %q", got)
	}
	if got := p.submitURL("https://localhost:3000/v1"); got != "https://localhost:3000/v1/videos/generate" {
		t.Fatalf("submitURL v1 base = %q", got)
	}
	if got := p.queryURL("https://example.com/api/v1", "task_123"); got != "https://example.com/api/v1/videos/task_123" {
		t.Fatalf("queryURL = %q", got)
	}

	req, err := http.NewRequest(http.MethodGet, "https://example.com", nil)
	if err != nil {
		t.Fatal(err)
	}
	p.setupRequestHeader(req, "sk_test")
	if got := req.Header.Get("X-API-Key"); got != "sk_test" {
		t.Fatalf("X-API-Key = %q", got)
	}
	if got := req.Header.Get("Authorization"); got != "" {
		t.Fatalf("Authorization should be empty, got %q", got)
	}
}

func TestXBSoraProviderSelection(t *testing.T) {
	if _, ok := getProviderByBaseURL("https://localhost:3000/v1").(*xbSoraProvider); !ok {
		t.Fatalf("localhost /v1 base URL should select xb-sora2 provider")
	}
	if _, ok := getProviderByBaseURL("https://example.com/api/v1").(*xbSoraProvider); !ok {
		t.Fatalf("/api/v1 base URL should select xb-sora2 provider")
	}
	if _, ok := getProviderByBaseURL("https://xgapi.top/api/v1").(*xgapiProvider); !ok {
		t.Fatalf("explicit xgapi base URL should keep xgapi provider")
	}
	if _, ok := getProviderForRelayInfo(&relaycommon.RelayInfo{
		OriginModelName: "xb-sora2",
		ChannelMeta: &relaycommon.ChannelMeta{
			ChannelBaseUrl:    "https://example.com",
			UpstreamModelName: "xb-sora2",
		},
	}).(*xbSoraProvider); !ok {
		t.Fatalf("xb-sora2 model should select xb-sora2 provider")
	}
	if _, ok := getProviderForRelayInfo(&relaycommon.RelayInfo{
		OriginModelName: "future-video-model",
		ChannelMeta: &relaycommon.ChannelMeta{
			ChannelBaseUrl:    "https://example.com",
			ChannelOther:      "xb-sora2",
			UpstreamModelName: "future-video-model",
		},
	}).(*xbSoraProvider); !ok {
		t.Fatalf("xb-sora2 channel hint should select xb-sora2 provider for future models")
	}
	if _, ok := getProviderForTaskFetch("https://example.com", map[string]any{
		"task_id":             "up_task",
		"channel_other":       "xb-sora2",
		"upstream_model_name": "future-video-model",
	}).(*xbSoraProvider); !ok {
		t.Fatalf("xb-sora2 task fetch hint should select xb-sora2 provider")
	}
}

func TestXBSoraModelMappingAndNormalize(t *testing.T) {
	p := &xbSoraProvider{}

	if got := p.mapModelForImages("xb-sora2", false); got != "xb-sora2" {
		t.Fatalf("xb-sora2 mapped to %q", got)
	}
	if got := p.mapModelForImages("sora-2-pro", false); got != "sora-2-pro(线路BF)" {
		t.Fatalf("sora-2-pro mapped to %q", got)
	}
	if got := p.mapModelForImages("openai-sora-2", true); got != "xb-sora2" {
		t.Fatalf("image request mapped to %q", got)
	}
	if got := p.mapModelForImages("future-video-model", false); got != "future-video-model" {
		t.Fatalf("unknown model should pass through, got %q", got)
	}
	if got := p.mapModelForImages("future-video-model", true); got != "future-video-model" {
		t.Fatalf("unknown image-capable model should pass through, got %q", got)
	}

	body := map[string]interface{}{
		"model":           "openai-sora-2",
		"prompt":          "test",
		"seconds":         "12",
		"size":            "720x1280",
		"input_reference": "https://example.com/a.png",
		"image":           "https://example.com/a.png",
	}
	p.normalizeJSONRequest(body, "xb-sora2", "xb-sora2", 1)

	if got := body["duration"]; got != 12 {
		t.Fatalf("duration = %#v", got)
	}
	if got := body["orientation"]; got != "portrait" {
		t.Fatalf("orientation = %#v", got)
	}
	images, ok := body["images"].([]string)
	if !ok || len(images) != 1 || images[0] != "https://example.com/a.png" {
		t.Fatalf("images = %#v", body["images"])
	}
	if _, ok := body["seconds"]; ok {
		t.Fatalf("seconds should be removed")
	}
	if _, ok := body["input_reference"]; ok {
		t.Fatalf("input_reference should be removed")
	}

	grokBody := map[string]interface{}{
		"model":       "je-grok",
		"prompt":      "test",
		"duration":    float64(6),
		"orientation": "landscape",
	}
	p.normalizeJSONRequest(grokBody, "je-grok", "je-grok", 0)

	if got := grokBody["duration"]; got != 6 {
		t.Fatalf("grok duration = %#v", got)
	}
	if got := grokBody["aspect_ratio"]; got != "1280x720" {
		t.Fatalf("grok aspect_ratio = %#v", got)
	}
	if _, ok := grokBody["orientation"]; ok {
		t.Fatalf("grok orientation should be removed")
	}
	if _, ok := grokBody["size"]; ok {
		t.Fatalf("grok size should be removed")
	}
}

func TestXBSoraParseResponses(t *testing.T) {
	p := &xbSoraProvider{}

	taskID, err := p.parseSubmitResponse([]byte(`{"code":200,"message":"ok","data":{"task_id":"up_task","status":"pending","model":"openai-sora-2"}}`))
	if err != nil {
		t.Fatalf("parseSubmitResponse error: %v", err)
	}
	if taskID != "up_task" {
		t.Fatalf("taskID = %q", taskID)
	}

	taskID, err = p.parseSubmitResponse([]byte(`{"code":"0000","msg":"success","data":{"code":200,"message":"ok","data":{"task_id":"up_task_nested","status":"pending","model":"xb-sora2"}}}`))
	if err != nil {
		t.Fatalf("parse nested parseSubmitResponse error: %v", err)
	}
	if taskID != "up_task_nested" {
		t.Fatalf("nested taskID = %q", taskID)
	}

	info, err := p.parseQueryResponse([]byte(`{"code":200,"message":"ok","data":{"task_id":"up_task","status":"completed","progress":100,"result":{"video_url":"https://cdn.example.com/a.mp4","duration":10,"format":"mp4"}}}`))
	if err != nil {
		t.Fatalf("parseQueryResponse completed error: %v", err)
	}
	if info.Status != model.TaskStatusSuccess {
		t.Fatalf("status = %q", info.Status)
	}
	if info.Url != "https://cdn.example.com/a.mp4" {
		t.Fatalf("url = %q", info.Url)
	}

	info, err = p.parseQueryResponse([]byte(`{"code":"0000","msg":"success","data":{"code":200,"message":"ok","data":{"task_id":"up_task","status":"completed","progress":100,"result":{"video_url":"https://cdn.example.com/b.mp4","duration":8,"format":"mp4"}}}}`))
	if err != nil {
		t.Fatalf("parse nested parseQueryResponse completed error: %v", err)
	}
	if info.Status != model.TaskStatusSuccess || info.Url != "https://cdn.example.com/b.mp4" {
		t.Fatalf("nested info = %+v", info)
	}

	info, err = p.parseQueryResponse([]byte(`{"code":200,"message":"ok","data":{"task_id":"up_task","status":"failed","error":{"code":"generation_failed","message":"failed upstream"}}}`))
	if err != nil {
		t.Fatalf("parseQueryResponse failed error: %v", err)
	}
	if info.Status != model.TaskStatusFailure || info.Reason != "failed upstream" {
		t.Fatalf("failed info = %+v", info)
	}
}

func TestXBSoraSubmitResponseBodyUsesPublicTaskID(t *testing.T) {
	p := &xbSoraProvider{}
	body := p.buildSubmitResponseBody(&relaycommon.RelayInfo{
		OriginModelName: "xb-sora2",
		TaskRelayInfo: &relaycommon.TaskRelayInfo{
			PublicTaskID: "task_public",
		},
	}, "upstream_task").(map[string]any)

	if body["id"] != "task_public" || body["task_id"] != "task_public" {
		t.Fatalf("public ids not used: %+v", body)
	}
	if body["model"] != "xb-sora2" {
		t.Fatalf("model = %#v", body["model"])
	}
}

func TestXBSoraAdaptorSubmitAndFetchHTTP(t *testing.T) {
	gin.SetMode(gin.TestMode)
	service.InitHttpClient()

	var submitSeen bool
	var fetchSeen bool
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if got := r.Header.Get("X-API-Key"); got != "sk_test" {
			t.Fatalf("X-API-Key = %q", got)
		}
		if got := r.Header.Get("Authorization"); got != "" {
			t.Fatalf("Authorization should be empty, got %q", got)
		}

		switch {
		case r.Method == http.MethodPost && r.URL.Path == "/api/v1/videos/generate":
			submitSeen = true
			if got := r.Header.Get("Content-Type"); got != "application/json" {
				t.Fatalf("submit Content-Type = %q", got)
			}
			body, err := io.ReadAll(r.Body)
			if err != nil {
				t.Fatal(err)
			}
			var req map[string]any
			if err := json.Unmarshal(body, &req); err != nil {
				t.Fatalf("submit body is not json: %v", err)
			}
			if req["model"] != "xb-sora2" {
				t.Fatalf("model = %#v", req["model"])
			}
			if req["duration"] != float64(12) {
				t.Fatalf("duration = %#v", req["duration"])
			}
			if req["orientation"] != "portrait" {
				t.Fatalf("orientation = %#v", req["orientation"])
			}
			for _, key := range []string{"seconds", "size", "input_reference"} {
				if _, ok := req[key]; ok {
					t.Fatalf("%s should not be sent: %#v", key, req)
				}
			}
			_, _ = w.Write([]byte(`{"code":"0000","msg":"success","data":{"code":200,"message":"ok","data":{"task_id":"up_task","status":"pending","model":"xb-sora2"}}}`))
		case r.Method == http.MethodGet && r.URL.Path == "/api/v1/videos/up_task":
			fetchSeen = true
			_, _ = w.Write([]byte(`{"code":"0000","msg":"success","data":{"code":200,"message":"ok","data":{"task_id":"up_task","status":"completed","progress":100,"model":"xb-sora2","result":{"video_url":"https://cdn.example.com/a.mp4","duration":12,"format":"mp4"}}}}`))
		default:
			t.Fatalf("unexpected upstream request: %s %s", r.Method, r.URL.Path)
		}
	}))
	defer server.Close()

	info := &relaycommon.RelayInfo{
		OriginModelName: "xb-sora2",
		ChannelMeta: &relaycommon.ChannelMeta{
			ChannelBaseUrl:    server.URL + "/api/v1",
			ApiKey:            "sk_test",
			UpstreamModelName: "xb-sora2",
		},
		TaskRelayInfo: &relaycommon.TaskRelayInfo{
			PublicTaskID: "task_public",
		},
	}
	adaptor := &TaskAdaptor{}
	adaptor.Init(info)

	body := []byte(`{"model":"xb-sora2","prompt":"test","seconds":"12","size":"720x1280","input_reference":"https://example.com/a.png"}`)
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/videos", bytes.NewReader(body))
	c.Request.Header.Set("Content-Type", "application/json")

	requestBody, err := adaptor.BuildRequestBody(c, info)
	if err != nil {
		t.Fatalf("BuildRequestBody error: %v", err)
	}
	resp, err := adaptor.DoRequest(c, info, requestBody)
	if err != nil {
		t.Fatalf("DoRequest error: %v", err)
	}
	upstreamID, _, taskErr := adaptor.DoResponse(c, resp, info)
	if taskErr != nil {
		t.Fatalf("DoResponse taskErr: %v", taskErr)
	}
	if upstreamID != "up_task" {
		t.Fatalf("upstreamID = %q", upstreamID)
	}
	if !submitSeen {
		t.Fatalf("submit endpoint was not called")
	}

	resp, err = adaptor.FetchTask(server.URL+"/api/v1", "sk_test", map[string]any{"task_id": upstreamID}, "")
	if err != nil {
		t.Fatalf("FetchTask error: %v", err)
	}
	defer resp.Body.Close()
	responseBody, err := io.ReadAll(resp.Body)
	if err != nil {
		t.Fatalf("read fetch response: %v", err)
	}
	taskInfo, err := adaptor.ParseTaskResult(responseBody)
	if err != nil {
		t.Fatalf("ParseTaskResult error: %v", err)
	}
	if taskInfo.Status != model.TaskStatusSuccess || taskInfo.Url != "https://cdn.example.com/a.mp4" {
		t.Fatalf("taskInfo = %+v", taskInfo)
	}
	if !fetchSeen {
		t.Fatalf("fetch endpoint was not called")
	}
}
