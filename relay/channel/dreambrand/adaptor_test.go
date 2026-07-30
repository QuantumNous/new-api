package dreambrand

import (
	"context"
	"errors"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync/atomic"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/dto"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	relayconstant "github.com/QuantumNous/new-api/relay/constant"
	"github.com/QuantumNous/new-api/service"
	"github.com/gin-gonic/gin"
)

func TestGetRequestURL(t *testing.T) {
	adaptor := &Adaptor{}
	info := imageRelayInfo("https://ai.dreambrand.studio/")
	got, err := adaptor.GetRequestURL(info)
	if err != nil {
		t.Fatal(err)
	}
	if got != "https://ai.dreambrand.studio/ai/v1/images/generations" {
		t.Fatalf("URL = %q", got)
	}
	info.RelayMode = relayconstant.RelayModeChatCompletions
	if _, err := adaptor.GetRequestURL(info); err == nil {
		t.Fatal("expected non-image relay mode to be rejected")
	}
}

func TestInitUsesImagePollingDefaults(t *testing.T) {
	adaptor := &Adaptor{}
	adaptor.Init(imageRelayInfo("https://ai.dreambrand.studio"))

	if adaptor.pollInterval != defaultImagePollInterval {
		t.Fatalf("poll interval = %v, want %v", adaptor.pollInterval, defaultImagePollInterval)
	}
	if adaptor.pollTimeout != defaultImagePollTimeout {
		t.Fatalf("poll timeout = %v, want %v", adaptor.pollTimeout, defaultImagePollTimeout)
	}
}

func TestConvertImageRequest(t *testing.T) {
	tests := []struct {
		name          string
		body          string
		origin        string
		upstream      string
		wantModel     string
		wantPic       string
		wantPics      []string
		wantSize      string
		wantFormat    string
		wantWatermark *bool
		wantRatio     string
	}{
		{
			name:          "official text to image",
			body:          `{"prompt":"sunset","model":"doubao-seedream-5.0-lite","size":"2K","output_format":"png","watermark":false}`,
			origin:        "doubao-seedream-5.0-lite",
			upstream:      "doubao-seedream-5.0-lite",
			wantModel:     "seedream-5.0-lite",
			wantSize:      "2K",
			wantFormat:    "png",
			wantWatermark: boolPointer(false),
		},
		{
			name:      "resolution above model maximum is passed upstream",
			body:      `{"prompt":"sunset","model":"doubao-seedream-5.0-lite","size":"2160p"}`,
			origin:    "doubao-seedream-5.0-lite",
			upstream:  "doubao-seedream-5.0-lite",
			wantModel: "seedream-5.0-lite",
			wantSize:  "2160p",
		},
		{
			name:      "legacy resolution alias is passed upstream",
			body:      `{"prompt":"sunset","model":"doubao-seedream-5.0-lite","size":"4K"}`,
			origin:    "doubao-seedream-5.0-lite",
			upstream:  "doubao-seedream-5.0-lite",
			wantModel: "seedream-5.0-lite",
			wantSize:  "4K",
		},
		{
			name:      "seedream 4.5 resolution above model maximum is passed upstream",
			body:      `{"prompt":"sunset","model":"doubao-seedream-4.5","size":"4K"}`,
			origin:    "doubao-seedream-4.5",
			upstream:  "doubao-seedream-4.5",
			wantModel: "seedream-4.5",
			wantSize:  "4K",
		},
		{
			name:          "official single image",
			body:          `{"prompt":"restyle","model":"doubao-seedream-4.5","image":"https://example.com/a.png","size":"2K","output_format":"jpeg","watermark":true}`,
			origin:        "doubao-seedream-4.5",
			upstream:      "doubao-seedream-4.5",
			wantModel:     "seedream-4.5",
			wantPic:       "https://example.com/a.png",
			wantSize:      "2K",
			wantFormat:    "jpeg",
			wantWatermark: boolPointer(true),
		},
		{
			name:          "official multiple images",
			body:          `{"prompt":"combine","model":"doubao-seedream-4.5","image":["a","b","c"],"size":"2K","output_format":"png","watermark":false}`,
			origin:        "doubao-seedream-4.5",
			upstream:      "seedream-4.5",
			wantModel:     "seedream-4.5",
			wantPic:       "a",
			wantPics:      []string{"b", "c"},
			wantSize:      "2K",
			wantFormat:    "png",
			wantWatermark: boolPointer(false),
		},
		{
			name:      "legacy images and aspect ratio",
			body:      `{"prompt":"combine","model":"doubao-seedream-4.5","images":["a","b"],"size":"2160p","aspect_ratio":"16:9"}`,
			origin:    "doubao-seedream-4.5",
			upstream:  "seedream-4.5",
			wantModel: "seedream-4.5",
			wantPic:   "a",
			wantPics:  []string{"b"},
			wantSize:  "2160p",
			wantRatio: "16:9",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			var request dto.ImageRequest
			if err := common.Unmarshal([]byte(tt.body), &request); err != nil {
				t.Fatal(err)
			}
			info := imageRelayInfo("https://ai.dreambrand.studio")
			info.OriginModelName = tt.origin
			info.UpstreamModelName = tt.upstream
			c, _ := gin.CreateTestContext(httptest.NewRecorder())
			converted, err := (&Adaptor{}).ConvertImageRequest(c, info, request)
			if err != nil {
				t.Fatal(err)
			}
			payload := converted.(imageRequestPayload)
			if payload.Model != tt.wantModel || info.UpstreamModelName != tt.wantModel {
				t.Fatalf("model = %q/%q, want %q", payload.Model, info.UpstreamModelName, tt.wantModel)
			}
			if payload.Pic != tt.wantPic || strings.Join(payload.Pics, ",") != strings.Join(tt.wantPics, ",") {
				t.Fatalf("payload references = %+v", payload)
			}
			if payload.Size != tt.wantSize || payload.OutputFormat != tt.wantFormat || payload.AspectRatio != tt.wantRatio {
				t.Fatalf("payload = %+v", payload)
			}
			if tt.wantWatermark != nil && (payload.Watermark == nil || *payload.Watermark != *tt.wantWatermark) {
				t.Fatalf("payload watermark = %v, want %v", payload.Watermark, *tt.wantWatermark)
			}
		})
	}
}

func TestConvertImageRequestValidation(t *testing.T) {
	tests := []string{
		`{"prompt":"x","model":"doubao-seedream-4.5","n":2}`,
		`{"prompt":"x","model":"doubao-seedream-4.5","n":0}`,
		`{"prompt":"x","model":"unknown-image"}`,
		`{"prompt":"x","model":"doubao-seedream-4.5","images":["1","2","3","4","5","6","7"]}`,
		`{"prompt":"x","model":"doubao-seedream-4.5","image":["1","2","3","4","5","6","7"]}`,
		`{"prompt":"x","model":"doubao-seedream-4.5","output_format":1}`,
	}
	for _, body := range tests {
		var request dto.ImageRequest
		if err := common.Unmarshal([]byte(body), &request); err != nil {
			t.Fatal(err)
		}
		info := imageRelayInfo("https://ai.dreambrand.studio")
		info.OriginModelName = request.Model
		info.UpstreamModelName = request.Model
		c, _ := gin.CreateTestContext(httptest.NewRecorder())
		if _, err := (&Adaptor{}).ConvertImageRequest(c, info, request); err == nil {
			t.Fatalf("expected validation error for %s", body)
		}
	}
}

func TestParseCreateAndQueryResponses(t *testing.T) {
	created, err := parseCreateResponse([]byte(`{"data":{"task_id":"TASK_1","status":"queued"}}`))
	if err != nil || created.TaskID != "TASK_1" {
		t.Fatalf("create response/error = %+v/%v", created, err)
	}
	queried, err := parseQueryResponse([]byte(`{"code":0,"message":"success","data":{"id":"TASK_1","status":"completed","url":"https://example.com/final.png"}}`))
	if err != nil || queried.URL != "https://example.com/final.png" || normalizeStatus(queried.Status) != "success" {
		t.Fatalf("query response/error = %+v/%v", queried, err)
	}
}

func TestDoResponsePollsUntilSuccess(t *testing.T) {
	service.InitHttpClient()
	var queries atomic.Int32
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/ai/v1/images/generations/TASK_1" {
			t.Fatalf("query path = %q", r.URL.Path)
		}
		if r.Header.Get("Authorization") != "Bearer upstream-key" {
			t.Fatalf("authorization = %q", r.Header.Get("Authorization"))
		}
		if queries.Add(1) == 1 {
			_, _ = io.WriteString(w, `{"id":"TASK_1","status":"processing"}`)
			return
		}
		_, _ = io.WriteString(w, `{"id":"TASK_1","status":"success","url":"https://example.com/final.png","created":123}`)
	}))
	defer server.Close()

	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/images/generations", nil)
	info := imageRelayInfo(server.URL)
	info.ApiKey = "upstream-key"
	adaptor := &Adaptor{pollInterval: time.Millisecond, pollTimeout: time.Second}
	resp := imageHTTPResponse(`{"id":"TASK_1","status":"queued"}`)
	usage, apiErr := adaptor.DoResponse(c, resp, info)
	if apiErr != nil {
		t.Fatal(apiErr)
	}
	if _, ok := usage.(*dto.Usage); !ok {
		t.Fatalf("usage = %T", usage)
	}
	var result dto.ImageResponse
	if err := common.Unmarshal(recorder.Body.Bytes(), &result); err != nil {
		t.Fatal(err)
	}
	if result.Created != 123 || len(result.Data) != 1 || result.Data[0].Url != "https://example.com/final.png" {
		t.Fatalf("image response = %+v", result)
	}
}

func TestDoResponseHandlesDirectURLAndUpstreamErrors(t *testing.T) {
	t.Run("direct URL", func(t *testing.T) {
		recorder := httptest.NewRecorder()
		c, _ := gin.CreateTestContext(recorder)
		c.Request = httptest.NewRequest(http.MethodPost, "/v1/images/generations", nil)
		info := imageRelayInfo("https://ai.dreambrand.studio")
		resp := imageHTTPResponse(`{"created":456,"data":[{"url":"https://example.com/direct.png","revised_prompt":"revised"}]}`)
		_, apiErr := (&Adaptor{}).DoResponse(c, resp, info)
		if apiErr != nil {
			t.Fatal(apiErr)
		}
		var result dto.ImageResponse
		if err := common.Unmarshal(recorder.Body.Bytes(), &result); err != nil {
			t.Fatal(err)
		}
		if result.Created != 456 || result.Data[0].Url != "https://example.com/direct.png" || result.Data[0].RevisedPrompt != "revised" {
			t.Fatalf("result = %+v", result)
		}
	})

	t.Run("HTTP 200 error payload", func(t *testing.T) {
		c, _ := gin.CreateTestContext(httptest.NewRecorder())
		c.Request = httptest.NewRequest(http.MethodPost, "/v1/images/generations", nil)
		resp := imageHTTPResponse(`{"code":30001,"message":"MODEL_NOT_FOUND"}`)
		if _, apiErr := (&Adaptor{}).DoResponse(c, resp, imageRelayInfo("https://ai.dreambrand.studio")); apiErr == nil || !strings.Contains(apiErr.Error(), "MODEL_NOT_FOUND") {
			t.Fatalf("API error = %v", apiErr)
		}
	})
}

func TestDoResponseHandlesFailureAndCancellation(t *testing.T) {
	service.InitHttpClient()
	t.Run("failed task", func(t *testing.T) {
		server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
			_, _ = io.WriteString(w, `{"id":"TASK_1","status":"failed","error":{"message":"generation rejected"}}`)
		}))
		defer server.Close()
		c, _ := gin.CreateTestContext(httptest.NewRecorder())
		c.Request = httptest.NewRequest(http.MethodPost, "/v1/images/generations", nil)
		resp := imageHTTPResponse(`{"id":"TASK_1"}`)
		adaptor := &Adaptor{pollInterval: time.Millisecond, pollTimeout: time.Second}
		if _, apiErr := adaptor.DoResponse(c, resp, imageRelayInfo(server.URL)); apiErr == nil || !strings.Contains(apiErr.Error(), "generation rejected") {
			t.Fatalf("API error = %v", apiErr)
		}
	})

	t.Run("cancelled context", func(t *testing.T) {
		ctx, cancel := context.WithCancel(context.Background())
		cancel()
		adaptor := &Adaptor{pollInterval: time.Millisecond, pollTimeout: time.Second}
		_, _, err := adaptor.pollImageTask(ctx, imageRelayInfo("https://ai.dreambrand.studio"), "TASK_1")
		if !errors.Is(err, context.Canceled) {
			t.Fatalf("error = %v", err)
		}
	})

	t.Run("poll timeout", func(t *testing.T) {
		server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
			_, _ = io.WriteString(w, `{"id":"TASK_1","status":"processing"}`)
		}))
		defer server.Close()
		adaptor := &Adaptor{pollInterval: time.Millisecond, pollTimeout: 5 * time.Millisecond}
		_, _, err := adaptor.pollImageTask(context.Background(), imageRelayInfo(server.URL), "TASK_1")
		if !errors.Is(err, context.DeadlineExceeded) {
			t.Fatalf("error = %v", err)
		}
	})
}

func TestDoResponseB64JSON(t *testing.T) {
	service.InitHttpClient()
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/image.png" {
			_, _ = w.Write([]byte("image-bytes"))
			return
		}
		w.WriteHeader(http.StatusNotFound)
	}))
	defer server.Close()
	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/images/generations", nil)
	c.Set("response_format", "b64_json")
	resp := imageHTTPResponse(`{"url":"` + server.URL + `/image.png"}`)
	_, apiErr := (&Adaptor{}).DoResponse(c, resp, imageRelayInfo(server.URL))
	if apiErr != nil {
		t.Fatal(apiErr)
	}
	var result dto.ImageResponse
	if err := common.Unmarshal(recorder.Body.Bytes(), &result); err != nil {
		t.Fatal(err)
	}
	if result.Data[0].Url != "" || result.Data[0].B64Json != "aW1hZ2UtYnl0ZXM=" {
		t.Fatalf("result = %+v", result)
	}
}

func TestStatusNormalization(t *testing.T) {
	tests := map[string]string{
		"created": "processing", "submitted": "processing", "queued": "processing", "pending": "processing",
		"processing": "processing", "running": "processing", "generating": "processing",
		"success": "success", "completed": "success", "done": "success",
		"failed": "failed", "error": "failed", "cancelled": "failed", "expired": "failed",
	}
	for input, want := range tests {
		if got := normalizeStatus(input); got != want {
			t.Fatalf("normalizeStatus(%q) = %q, want %q", input, got, want)
		}
	}
}

func imageRelayInfo(baseURL string) *relaycommon.RelayInfo {
	return &relaycommon.RelayInfo{
		StartTime: time.Unix(100, 0),
		RelayMode: relayconstant.RelayModeImagesGenerations,
		ChannelMeta: &relaycommon.ChannelMeta{
			ChannelBaseUrl: baseURL,
		},
	}
}

func imageHTTPResponse(body string) *http.Response {
	return &http.Response{
		StatusCode: http.StatusOK,
		Header:     make(http.Header),
		Body:       io.NopCloser(strings.NewReader(body)),
	}
}

func boolPointer(value bool) *bool {
	return &value
}
