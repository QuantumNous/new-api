package apimart

import (
	"bytes"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	relaycommon "github.com/QuantumNous/new-api/relay/common"

	"github.com/gin-gonic/gin"
)

func TestParseCreateTaskID(t *testing.T) {
	body := []byte(`{"code":200,"data":{"id":"task_01JNXXXXXXXX","status":"submitted","progress":0}}`)
	id, err := parseCreateTaskID(body)
	if err != nil {
		t.Fatalf("parseCreateTaskID: %v", err)
	}
	if id != "task_01JNXXXXXXXX" {
		t.Fatalf("id = %q", id)
	}
}

func TestParseCreateTaskIDDataArray(t *testing.T) {
	body := []byte(`{"code":200,"data":[{"status":"submitted","task_id":"task_01KS1X4C4KT0J0N2G5TAXXHXZX"}]}`)
	id, err := parseCreateTaskID(body)
	if err != nil {
		t.Fatalf("parseCreateTaskID: %v", err)
	}
	if id != "task_01KS1X4C4KT0J0N2G5TAXXHXZX" {
		t.Fatalf("id = %q", id)
	}
}

func TestParseTaskResultCompleted(t *testing.T) {
	body := []byte(`{
  "code": 200,
  "data": {
    "id": "task_01K9S419324DREZFBWNSVXYR6H",
    "status": "completed",
    "progress": 100,
    "result": {
      "videos": [{
        "url": ["https://upload.apimart.ai/f/video/out.mp4"]
      }]
    }
  }
}`)
	ti, err := (&TaskAdaptor{}).ParseTaskResult(body)
	if err != nil {
		t.Fatalf("ParseTaskResult: %v", err)
	}
	if ti.Status != model.TaskStatusSuccess {
		t.Fatalf("status = %v", ti.Status)
	}
	if ti.Url != "https://upload.apimart.ai/f/video/out.mp4" {
		t.Fatalf("url = %q", ti.Url)
	}
}

func TestParseTaskResultProcessing(t *testing.T) {
	body := []byte(`{"code":200,"data":{"id":"task_x","status":"processing","progress":1}}`)
	ti, err := (&TaskAdaptor{}).ParseTaskResult(body)
	if err != nil {
		t.Fatalf("ParseTaskResult: %v", err)
	}
	if ti.Status != model.TaskStatusInProgress {
		t.Fatalf("status = %v", ti.Status)
	}
}

func TestGjsonParseStringArray(t *testing.T) {
	urls := gjsonParseStringArray([]interface{}{"https://example.com/a.png"})
	if len(urls) != 1 || urls[0] != "https://example.com/a.png" {
		t.Fatalf("urls = %#v", urls)
	}
}

func TestNormalizeApimartCreatePayloadImagesAndSize(t *testing.T) {
	payload := map[string]interface{}{
		"model":        "grok-imagine-1.0-video-apimart",
		"prompt":       "test",
		"images":       []interface{}{"https://example.com/ref.png"},
		"aspect_ratio": "3:2",
		"size":         "3:2",
		"quality":      "720p",
	}
	normalizeApimartCreatePayload(payload)
	if _, ok := payload["images"]; ok {
		t.Fatal("images should be removed")
	}
	urls, ok := payload["image_urls"].([]string)
	if !ok || len(urls) != 1 || urls[0] != "https://example.com/ref.png" {
		t.Fatalf("image_urls = %#v", payload["image_urls"])
	}
	if payload["size"] != "3:2" {
		t.Fatalf("size = %#v", payload["size"])
	}
	q, _ := payload["quality"].(string)
	if q != "720p" {
		t.Fatalf("quality = %#v", payload["quality"])
	}
}

func TestNormalizeMaps720PSizeToQuality(t *testing.T) {
	payload := map[string]interface{}{
		"images": []string{"https://example.com/a.png"},
		"size":   "720P",
	}
	normalizeApimartCreatePayload(payload)
	if payload["quality"] != "720p" {
		t.Fatalf("quality = %#v", payload["quality"])
	}
	if _, ok := payload["size"]; ok {
		t.Fatalf("size should move to quality, got %#v", payload["size"])
	}
}

func TestApimartSizeAndQualityFromRequest(t *testing.T) {
	req := relaycommon.TaskSubmitReq{
		AspectRatio: "16:9",
		Size:        "720p",
		Duration:    6,
	}
	if got := apimartSizeFromRequest(&req); got != "16:9" {
		t.Fatalf("size = %q", got)
	}
	if got := apimartQualityFromRequest(&req); got != "720p" {
		t.Fatalf("quality = %q", got)
	}
	if got := apimartDurationFromRequest(&req); got != 6 {
		t.Fatalf("duration = %d", got)
	}
}

func TestIsMiniMaxModel(t *testing.T) {
	if !isMiniMaxModel("MiniMax-H3") {
		t.Fatal("MiniMax-H3 should match")
	}
	if !isMiniMaxModel("minimax-hailuo-02") {
		t.Fatal("minimax-hailuo-02 should match")
	}
	if isMiniMaxModel("grok-imagine-1.0-video-apimart") {
		t.Fatal("grok should not match")
	}
}

func TestNormalizeMiniMaxCreatePayload(t *testing.T) {
	payload := map[string]interface{}{
		"model":        "MiniMax-H3",
		"prompt":       "test",
		"images":       []interface{}{"https://example.com/ref.png"},
		"aspect_ratio": "16:9",
		"size":         "16:9",
		"quality":      "2K",
	}
	normalizeMiniMaxCreatePayload(payload)
	if _, ok := payload["images"]; ok {
		t.Fatal("images should be removed")
	}
	if _, ok := payload["size"]; ok {
		t.Fatal("size should be removed")
	}
	if _, ok := payload["quality"]; ok {
		t.Fatal("quality should be removed")
	}
	if payload["aspect_ratio"] != "16:9" {
		t.Fatalf("aspect_ratio = %#v", payload["aspect_ratio"])
	}
	if payload["resolution"] != "2K" {
		t.Fatalf("resolution = %#v", payload["resolution"])
	}
	urls, ok := payload["image_urls"].([]string)
	if !ok || len(urls) != 1 || urls[0] != "https://example.com/ref.png" {
		t.Fatalf("image_urls = %#v", payload["image_urls"])
	}
}

func TestConvertMiniMaxTextToVideo(t *testing.T) {
	gin.SetMode(gin.TestMode)
	body := []byte(`{
		"model":"MiniMax-H3",
		"prompt":"一个男孩在海边打篮球",
		"duration":5,
		"resolution":"2K",
		"aspect_ratio":"16:9"
	}`)
	c, _ := gin.CreateTestContext(httptest.NewRecorder())
	c.Request = httptest.NewRequest(http.MethodPost, "/", bytes.NewReader(body))
	c.Request.Header.Set("Content-Type", "application/json")
	storage, err := common.CreateBodyStorage(body)
	if err != nil {
		t.Fatalf("CreateBodyStorage: %v", err)
	}
	c.Set(common.KeyBodyStorage, storage)

	req := relaycommon.TaskSubmitReq{
		Prompt:      "一个男孩在海边打篮球",
		Duration:    5,
		Resolution:  "2K",
		AspectRatio: "16:9",
	}
	payload, err := convertMiniMaxCreatePayload(c, &req, "MiniMax-H3")
	if err != nil {
		t.Fatalf("convertMiniMaxCreatePayload: %v", err)
	}
	if payload["model"] != "MiniMax-H3" {
		t.Fatalf("model = %#v", payload["model"])
	}
	if payload["resolution"] != "2K" {
		t.Fatalf("resolution = %#v", payload["resolution"])
	}
	if payload["aspect_ratio"] != "16:9" {
		t.Fatalf("aspect_ratio = %#v", payload["aspect_ratio"])
	}
	if payload["duration"] != 5 {
		t.Fatalf("duration = %#v", payload["duration"])
	}
	if _, ok := payload["quality"]; ok {
		t.Fatalf("quality should not be set for MiniMax, got %#v", payload["quality"])
	}
	if _, ok := payload["size"]; ok {
		t.Fatalf("size should not be set for MiniMax, got %#v", payload["size"])
	}
}

func TestConvertMiniMaxMultimodalReference(t *testing.T) {
	gin.SetMode(gin.TestMode)
	body := []byte(`{
		"model":"MiniMax-H3",
		"prompt":"角色说话：Follow the wind",
		"image_with_roles":[{"url":"https://cdn.example.com/char.png","role":"reference_image"}],
		"video_urls":["https://cdn.example.com/ref_motion.mp4"],
		"audio_urls":["https://cdn.example.com/ref_voice.mp3"],
		"duration":5,
		"resolution":"2K"
	}`)
	c, _ := gin.CreateTestContext(httptest.NewRecorder())
	c.Request = httptest.NewRequest(http.MethodPost, "/", bytes.NewReader(body))
	c.Request.Header.Set("Content-Type", "application/json")
	storage, err := common.CreateBodyStorage(body)
	if err != nil {
		t.Fatalf("CreateBodyStorage: %v", err)
	}
	c.Set(common.KeyBodyStorage, storage)

	req := relaycommon.TaskSubmitReq{
		Prompt:     "角色说话：Follow the wind",
		Duration:   5,
		Resolution: "2K",
	}
	payload, err := convertMiniMaxCreatePayload(c, &req, "MiniMax-H3")
	if err != nil {
		t.Fatalf("convertMiniMaxCreatePayload: %v", err)
	}
	roles, ok := payload["image_with_roles"].([]interface{})
	if !ok || len(roles) != 1 {
		t.Fatalf("image_with_roles = %#v", payload["image_with_roles"])
	}
	vids, ok := payload["video_urls"].([]interface{})
	if !ok || len(vids) != 1 || vids[0] != "https://cdn.example.com/ref_motion.mp4" {
		t.Fatalf("video_urls = %#v", payload["video_urls"])
	}
	auds, ok := payload["audio_urls"].([]interface{})
	if !ok || len(auds) != 1 || auds[0] != "https://cdn.example.com/ref_voice.mp3" {
		t.Fatalf("audio_urls = %#v", payload["audio_urls"])
	}
	if payload["resolution"] != "2K" {
		t.Fatalf("resolution = %#v", payload["resolution"])
	}
}

func TestConvertMiniMaxFirstLastFrame(t *testing.T) {
	gin.SetMode(gin.TestMode)
	body := []byte(`{
		"model":"MiniMax-H3",
		"prompt":"transition",
		"first_frame_image":"https://cdn.example.com/morning.png",
		"last_frame_image":"https://cdn.example.com/sunset.png",
		"duration":8,
		"images":["https://cdn.example.com/should-not-mix.png"]
	}`)
	c, _ := gin.CreateTestContext(httptest.NewRecorder())
	c.Request = httptest.NewRequest(http.MethodPost, "/", bytes.NewReader(body))
	c.Request.Header.Set("Content-Type", "application/json")
	storage, err := common.CreateBodyStorage(body)
	if err != nil {
		t.Fatalf("CreateBodyStorage: %v", err)
	}
	c.Set(common.KeyBodyStorage, storage)

	req := relaycommon.TaskSubmitReq{
		Prompt:   "transition",
		Duration: 8,
		Images:   []string{"https://cdn.example.com/should-not-mix.png"},
	}
	payload, err := convertMiniMaxCreatePayload(c, &req, "MiniMax-H3")
	if err != nil {
		t.Fatalf("convertMiniMaxCreatePayload: %v", err)
	}
	if payload["first_frame_image"] != "https://cdn.example.com/morning.png" {
		t.Fatalf("first_frame_image = %#v", payload["first_frame_image"])
	}
	if payload["last_frame_image"] != "https://cdn.example.com/sunset.png" {
		t.Fatalf("last_frame_image = %#v", payload["last_frame_image"])
	}
	if _, ok := payload["image_urls"]; ok {
		t.Fatalf("image_urls must not mix with I2V fields, got %#v", payload["image_urls"])
	}
}

func TestGetModelListIncludesMiniMaxH3(t *testing.T) {
	list := (&TaskAdaptor{}).GetModelList()
	found := false
	for _, m := range list {
		if m == "MiniMax-H3" {
			found = true
			break
		}
	}
	if !found {
		t.Fatalf("GetModelList missing MiniMax-H3: %v", list)
	}
}

func TestApiOriginKeepsDomesticBase(t *testing.T) {
	if got := apiOrigin("https://api.apib.ai"); got != "https://api.apib.ai" {
		t.Fatalf("apiOrigin = %q", got)
	}
	if got := apiOrigin("https://api.apib.ai/v1/videos/generations"); got != "https://api.apib.ai" {
		t.Fatalf("apiOrigin strip path = %q", got)
	}
	if got := apiOrigin("https://api.apimart.ai/"); got != "https://api.apimart.ai" {
		t.Fatalf("apiOrigin intl = %q", got)
	}
}
