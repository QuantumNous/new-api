package sora

import (
	"bytes"
	"io"
	"mime"
	"mime/multipart"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/gin-gonic/gin"

	relaycommon "github.com/QuantumNous/new-api/relay/common"
)

func TestNormalizeGrokVideoRequestAddsResolutionAliases(t *testing.T) {
	body := map[string]interface{}{
		"model":   "grok-imagine-1.0-video",
		"quality": "high",
		"preset":  "fun",
	}

	normalizeGrokVideoRequest(body, "grok-imagine-1.0-video")

	if got := body["quality"]; got != "high" {
		t.Fatalf("expected quality to stay high, got %#v", got)
	}
	if got := body["resolution_name"]; got != "720p" {
		t.Fatalf("expected resolution_name 720p, got %#v", got)
	}

	videoConfig, ok := body["video_config"].(map[string]interface{})
	if !ok {
		t.Fatalf("expected video_config map, got %#v", body["video_config"])
	}
	if got := videoConfig["resolution_name"]; got != "720p" {
		t.Fatalf("expected video_config.resolution_name 720p, got %#v", got)
	}
	if got := videoConfig["preset"]; got != "fun" {
		t.Fatalf("expected video_config.preset fun, got %#v", got)
	}
}

func TestNormalizeGrokVideoRequestBackfillsQualityFromResolutionName(t *testing.T) {
	body := map[string]interface{}{
		"model":           "grok-imagine-1.0-video",
		"resolution_name": "720p",
	}

	normalizeGrokVideoRequest(body, "grok-imagine-1.0-video")

	if got := body["quality"]; got != "high" {
		t.Fatalf("expected quality high, got %#v", got)
	}
	if got := body["resolution_name"]; got != "720p" {
		t.Fatalf("expected resolution_name 720p, got %#v", got)
	}
}

func TestNormalizeGrokVideoRequestBackfillsSecondsFromDuration(t *testing.T) {
	body := map[string]interface{}{
		"model":    "grok-imagine-1.0-video",
		"duration": float64(10),
	}

	normalizeGrokVideoRequest(body, "grok-imagine-1.0-video")

	if got := body["seconds"]; got != "10" {
		t.Fatalf("expected seconds to be backfilled from duration, got %#v", got)
	}
}

func TestNormalizeGrokVideoRequestKeepsExplicitSeconds(t *testing.T) {
	body := map[string]interface{}{
		"model":    "grok-imagine-1.0-video",
		"duration": float64(10),
		"seconds":  "8",
	}

	normalizeGrokVideoRequest(body, "grok-imagine-1.0-video")

	if got := body["seconds"]; got != "8" {
		t.Fatalf("expected explicit seconds to be preserved, got %#v", got)
	}
}

func TestNormalizeGrokVideoRequestPromotesImageReference(t *testing.T) {
	body := map[string]interface{}{
		"model":  "grok-imagine-1.0-video",
		"image":  "https://example.com/cover.png",
		"images": []interface{}{"https://example.com/frame-2.png"},
	}

	normalizeGrokVideoRequest(body, "grok-imagine-1.0-video")

	if _, exists := body["image"]; exists {
		t.Fatalf("expected legacy image field to be removed")
	}
	if _, exists := body["images"]; exists {
		t.Fatalf("expected legacy images field to be removed")
	}

	imageReference, ok := body["image_reference"].([]interface{})
	if !ok {
		t.Fatalf("expected image_reference array, got %#v", body["image_reference"])
	}
	if len(imageReference) != 2 {
		t.Fatalf("expected 2 image references, got %#v", imageReference)
	}
	if imageReference[0] != "https://example.com/cover.png" {
		t.Fatalf("unexpected first image reference %#v", imageReference[0])
	}
	if imageReference[1] != "https://example.com/frame-2.png" {
		t.Fatalf("unexpected second image reference %#v", imageReference[1])
	}
}

func TestNormalizeSoraVideoRequestBackfillsSecondsAndSize(t *testing.T) {
	body := map[string]interface{}{
		"model":        "sora-2",
		"duration":     float64(10),
		"aspect_ratio": "16:9",
	}

	normalizeSoraVideoRequest(body, "sora-2")

	if got := body["seconds"]; got != "10" {
		t.Fatalf("expected seconds to be backfilled from duration, got %#v", got)
	}
	if got := body["size"]; got != "1280x720" {
		t.Fatalf("expected size to be backfilled from aspect_ratio, got %#v", got)
	}
	if _, exists := body["duration"]; exists {
		t.Fatalf("expected duration to be removed after normalization")
	}
	if _, exists := body["aspect_ratio"]; exists {
		t.Fatalf("expected aspect_ratio to be removed after normalization")
	}
}

func TestNormalizeSoraVideoRequestKeepsExplicitSecondsAndSize(t *testing.T) {
	body := map[string]interface{}{
		"model":        "sora-2-pro",
		"duration":     float64(10),
		"seconds":      "8",
		"aspect_ratio": "9:16",
		"size":         "1024x1792",
	}

	normalizeSoraVideoRequest(body, "sora-2-pro")

	if got := body["seconds"]; got != "8" {
		t.Fatalf("expected explicit seconds to be preserved, got %#v", got)
	}
	if got := body["size"]; got != "1024x1792" {
		t.Fatalf("expected explicit size to be preserved, got %#v", got)
	}
}

func TestBuildRequestBodyConvertsSoraInputReferenceToMultipart(t *testing.T) {
	gin.SetMode(gin.TestMode)
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = httptest.NewRequest("POST", "/v1/video/async-generations", strings.NewReader(`{
		"model": "sora2",
		"prompt": "make it cinematic",
		"duration": 10,
		"aspect_ratio": "16:9",
		"input_reference": "data:image/png;base64,aGVsbG8="
	}`))
	c.Request.Header.Set("Content-Type", "application/json")

	adaptor := &TaskAdaptor{}
	info := &relaycommon.RelayInfo{
		ChannelMeta: &relaycommon.ChannelMeta{
			UpstreamModelName: "sora-2",
		},
	}

	bodyReader, err := adaptor.BuildRequestBody(c, info)
	if err != nil {
		t.Fatalf("BuildRequestBody returned error: %v", err)
	}

	contentType := c.Request.Header.Get("Content-Type")
	mediaType, params, err := mime.ParseMediaType(contentType)
	if err != nil {
		t.Fatalf("parse media type failed: %v", err)
	}
	if mediaType != "multipart/form-data" {
		t.Fatalf("expected multipart/form-data content type, got %s", mediaType)
	}

	raw, err := io.ReadAll(bodyReader)
	if err != nil {
		t.Fatalf("read request body failed: %v", err)
	}

	reader := multipart.NewReader(bytes.NewReader(raw), params["boundary"])
	form, err := reader.ReadForm(1024 * 1024)
	if err != nil {
		t.Fatalf("read multipart form failed: %v", err)
	}
	defer form.RemoveAll()

	if got := form.Value["seconds"]; len(got) != 1 || got[0] != "10" {
		t.Fatalf("expected seconds=10, got %#v", got)
	}
	if got := form.Value["size"]; len(got) != 1 || got[0] != "1280x720" {
		t.Fatalf("expected size=1280x720, got %#v", got)
	}
	if got := form.Value["duration"]; len(got) != 0 {
		t.Fatalf("expected duration to be removed from upstream payload, got %#v", got)
	}
	if got := form.Value["aspect_ratio"]; len(got) != 0 {
		t.Fatalf("expected aspect_ratio to be removed from upstream payload, got %#v", got)
	}
	files := form.File["input_reference"]
	if len(files) != 1 {
		t.Fatalf("expected exactly one input_reference file, got %#v", files)
	}
}

func TestBuildRequestURLUsesVideoGenerationsPath(t *testing.T) {
	adaptor := &TaskAdaptor{baseURL: "https://upstream.example"}
	url, err := adaptor.BuildRequestURL(&relaycommon.RelayInfo{
		RequestURLPath:  "/v1/video/generations",
		OriginModelName: "veo31-fast",
		ChannelMeta: &relaycommon.ChannelMeta{
			UpstreamModelName: "veo31-fast",
		},
	})
	if err != nil {
		t.Fatalf("BuildRequestURL returned error: %v", err)
	}
	if url != "https://upstream.example/v1/video/generations" {
		t.Fatalf("expected video generations URL, got %s", url)
	}
}

func TestBuildRequestURLKeepsGrokOnOpenAIVideosPath(t *testing.T) {
	adaptor := &TaskAdaptor{baseURL: "https://upstream.example"}
	url, err := adaptor.BuildRequestURL(&relaycommon.RelayInfo{
		RequestURLPath:  "/v1/video/generations",
		OriginModelName: "grok-imagine-1.0-video",
		ChannelMeta: &relaycommon.ChannelMeta{
			UpstreamModelName: "grok-imagine-1.0-video",
		},
	})
	if err != nil {
		t.Fatalf("BuildRequestURL returned error: %v", err)
	}
	if url != "https://upstream.example/v1/videos" {
		t.Fatalf("expected OpenAI videos URL for Grok, got %s", url)
	}
}

func TestBuildRequestURLKeepsOpenAIVideosPath(t *testing.T) {
	adaptor := &TaskAdaptor{baseURL: "https://upstream.example"}
	url, err := adaptor.BuildRequestURL(&relaycommon.RelayInfo{
		RequestURLPath: "/v1/videos",
	})
	if err != nil {
		t.Fatalf("BuildRequestURL returned error: %v", err)
	}
	if url != "https://upstream.example/v1/videos" {
		t.Fatalf("expected OpenAI videos URL, got %s", url)
	}
}

func TestBuildTaskFetchURLUsesStoredVideoGenerationsPath(t *testing.T) {
	url, err := buildTaskFetchURL("https://upstream.example", map[string]any{
		"task_id":      "upstream-task",
		"model":        "veo31-fast",
		"request_path": "/v1/video/generations",
	})
	if err != nil {
		t.Fatalf("buildTaskFetchURL returned error: %v", err)
	}
	if url != "https://upstream.example/v1/video/generations/upstream-task" {
		t.Fatalf("expected video generations fetch URL, got %s", url)
	}
}

func TestBuildTaskFetchURLKeepsGrokOnOpenAIVideosPath(t *testing.T) {
	url, err := buildTaskFetchURL("https://upstream.example", map[string]any{
		"task_id":      "upstream-task",
		"model":        "grok-imagine-1.0-video",
		"request_path": "/v1/video/generations",
	})
	if err != nil {
		t.Fatalf("buildTaskFetchURL returned error: %v", err)
	}
	if url != "https://upstream.example/v1/videos/upstream-task" {
		t.Fatalf("expected OpenAI videos fetch URL for Grok, got %s", url)
	}
}

func TestBuildTaskFetchURLDefaultsToOpenAIVideosPath(t *testing.T) {
	url, err := buildTaskFetchURL("https://upstream.example", map[string]any{
		"task_id": "upstream-task",
	})
	if err != nil {
		t.Fatalf("buildTaskFetchURL returned error: %v", err)
	}
	if url != "https://upstream.example/v1/videos/upstream-task" {
		t.Fatalf("expected OpenAI videos fetch URL, got %s", url)
	}
}

func TestParseTaskResultAcceptsFloatProgress(t *testing.T) {
	adaptor := &TaskAdaptor{}
	taskInfo, err := adaptor.ParseTaskResult([]byte(`{"status":"completed","progress":100.0,"video_url":"https://cdn.example/video.mp4"}`))
	if err != nil {
		t.Fatalf("ParseTaskResult returned error: %v", err)
	}
	if taskInfo.Status != "SUCCESS" {
		t.Fatalf("expected success status, got %s", taskInfo.Status)
	}
	if taskInfo.Url != "https://cdn.example/video.mp4" {
		t.Fatalf("expected video url, got %s", taskInfo.Url)
	}
}
