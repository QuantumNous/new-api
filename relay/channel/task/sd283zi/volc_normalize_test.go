package sd283zi

import (
	"bytes"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/QuantumNous/new-api/common"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/gin-gonic/gin"
	"github.com/tidwall/gjson"
)

func TestIsVolcOfficialContent(t *testing.T) {
	tests := []struct {
		name string
		raw  string
		want bool
	}{
		{
			name: "mingiz flat format",
			raw:  `{"model":"mingiz-sd2","prompt":"一只猫","images":["https://example.com/a.jpg"]}`,
			want: false,
		},
		{
			name: "empty content",
			raw:  `{"model":"mingiz-sd2","content":[]}`,
			want: false,
		},
		{
			name: "unknown content type",
			raw:   `{"content":[{"type":"file","url":"https://example.com/a.bin"}]}`,
			want:  false,
		},
		{
			name: "official text",
			raw:  `{"content":[{"type":"text","text":"hello"}]}`,
			want: true,
		},
		{
			name: "official image_url",
			raw:  `{"content":[{"type":"image_url","image_url":{"url":"https://example.com/a.jpg"}}]}`,
			want: true,
		},
		{
			name: "official mixed",
			raw: `{
				"content":[
					{"type":"text","text":"广告"},
					{"type":"image_url","image_url":{"url":"https://example.com/a.jpg"},"role":"reference_image"}
				]
			}`,
			want: true,
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := isVolcOfficialContent([]byte(tt.raw)); got != tt.want {
				t.Fatalf("isVolcOfficialContent() = %v, want %v", got, tt.want)
			}
		})
	}
}

func TestParseVolcOfficialContent(t *testing.T) {
	raw := []byte(`{
		"model":"mingiz-sd2",
		"content":[
			{"type":"text","text":"第一段"},
			{"type":"text","text":"第二段"},
			{"type":"image_url","image_url":{"url":"https://example.com/cat.jpg"},"role":"reference_image"},
			{"type":"video_url","video_url":{"url":"https://example.com/ref.mp4"},"role":"reference_video"},
			{"type":"audio_url","audio_url":{"url":"https://example.com/a.mp3"},"role":"reference_audio"},
			{"type":"image_url","image_url":{"url":""}}
		],
		"ratio":"16:9",
		"resolution":"720p",
		"duration":8
	}`)
	n := parseVolcOfficialContent(raw, nil)
	if n.Prompt != "第一段\n第二段" {
		t.Fatalf("prompt = %q", n.Prompt)
	}
	if len(n.ImageURLs) != 1 || n.ImageURLs[0].URL != "https://example.com/cat.jpg" {
		t.Fatalf("image_urls = %+v", n.ImageURLs)
	}
	if len(n.VideoURLs) != 1 || n.VideoURLs[0] != "https://example.com/ref.mp4" {
		t.Fatalf("video_urls = %+v", n.VideoURLs)
	}
	if len(n.AudioURLs) != 1 || n.AudioURLs[0] != "https://example.com/a.mp3" {
		t.Fatalf("audio_urls = %+v", n.AudioURLs)
	}
	if !n.GenerateAudio {
		t.Fatalf("generate_audio default want true")
	}
	if n.Watermark {
		t.Fatalf("watermark default want false")
	}
}

func TestParseVolcOfficialContentBoolOverrides(t *testing.T) {
	raw := []byte(`{
		"content":[{"type":"text","text":"x"}],
		"generate_audio":false,
		"watermark":true
	}`)
	n := parseVolcOfficialContent(raw, nil)
	if n.GenerateAudio {
		t.Fatalf("generate_audio want false")
	}
	if !n.Watermark {
		t.Fatalf("watermark want true")
	}
}

func TestApplyVolcNormalized(t *testing.T) {
	payload := map[string]interface{}{
		"model":      "xinghe-2.0",
		"prompt":     "",
		"video_urls": []any{},
		"audio_urls": []any{},
	}
	n := &volcNormalized{
		Prompt:        "一只猫",
		ImageURLs:     []imageURLEntry{toImageURLEntry("https://example.com/a.jpg")},
		VideoURLs:     []string{"https://example.com/v.mp4"},
		AudioURLs:     []string{"https://example.com/a.mp3"},
		GenerateAudio: true,
		Watermark:     false,
	}
	applyVolcNormalized(payload, n)

	if payload["prompt"] != "一只猫" {
		t.Fatalf("prompt = %v", payload["prompt"])
	}
	imgs, ok := payload["image_urls"].([]imageURLEntry)
	if !ok || len(imgs) != 1 {
		t.Fatalf("image_urls = %v", payload["image_urls"])
	}
	vids, ok := payload["video_urls"].([]string)
	if !ok || len(vids) != 1 || vids[0] != "https://example.com/v.mp4" {
		t.Fatalf("video_urls = %v", payload["video_urls"])
	}
	if _, ok := payload["reference_video_urls"]; ok {
		t.Fatalf("reference_video_urls should be removed, got %v", payload["reference_video_urls"])
	}
	auds, ok := payload["audio_urls"].([]string)
	if !ok || len(auds) != 1 {
		t.Fatalf("audio_urls = %v", payload["audio_urls"])
	}
	if payload["generate_audio"] != true {
		t.Fatalf("generate_audio = %v", payload["generate_audio"])
	}
	if payload["watermark"] != false {
		t.Fatalf("watermark = %v", payload["watermark"])
	}
}

func TestDetectAndNormalizeVolcOfficial(t *testing.T) {
	gin.SetMode(gin.TestMode)
	body := `{
		"model":"mingiz-sd2",
		"content":[
			{"type":"text","text":"根据参考图生成清新果茶广告"},
			{"type":"image_url","image_url":{"url":"https://example.com/ref.jpg"},"role":"reference_image"}
		],
		"ratio":"16:9",
		"duration":8
	}`
	c, _ := gin.CreateTestContext(httptest.NewRecorder())
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/videos", bytes.NewBufferString(body))
	c.Request.Header.Set("Content-Type", "application/json")
	bs, err := common.CreateBodyStorage([]byte(body))
	if err != nil {
		t.Fatalf("CreateBodyStorage: %v", err)
	}
	c.Set(common.KeyBodyStorage, bs)

	req := &relaycommon.TaskSubmitReq{Model: "mingiz-sd2"}
	n := detectAndNormalizeVolcOfficial(c, req)
	if n == nil {
		t.Fatal("expected normalization")
	}
	if req.Prompt != "根据参考图生成清新果茶广告" {
		t.Fatalf("req.Prompt = %q", req.Prompt)
	}
	if len(req.Images) != 1 || req.Images[0] != "https://example.com/ref.jpg" {
		t.Fatalf("req.Images = %v", req.Images)
	}
	if req.GenerateAudio == nil || !*req.GenerateAudio {
		t.Fatalf("req.GenerateAudio = %v", req.GenerateAudio)
	}
	if req.Watermark == nil || *req.Watermark {
		t.Fatalf("req.Watermark = %v", req.Watermark)
	}
}

func TestDetectAndNormalizeVolcOfficialReplacesPartialImages(t *testing.T) {
	gin.SetMode(gin.TestMode)
	body := `{
		"model":"mingiz-sd2",
		"image":"https://example.com/only-first.jpg",
		"content":[
			{"type":"text","text":"双参考图"},
			{"type":"image_url","image_url":{"url":"https://example.com/a.jpg"},"role":"reference_image"},
			{"type":"image_url","image_url":{"url":"https://example.com/b.jpg"},"role":"reference_image"}
		]
	}`
	c, _ := gin.CreateTestContext(httptest.NewRecorder())
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/videos", bytes.NewBufferString(body))
	bs, err := common.CreateBodyStorage([]byte(body))
	if err != nil {
		t.Fatalf("CreateBodyStorage: %v", err)
	}
	c.Set(common.KeyBodyStorage, bs)

	// Simulate prior flat parse keeping only the singular image field.
	req := &relaycommon.TaskSubmitReq{
		Model:  "mingiz-sd2",
		Image:  "https://example.com/only-first.jpg",
		Images: []string{"https://example.com/only-first.jpg"},
	}
	n := detectAndNormalizeVolcOfficial(c, req)
	if n == nil {
		t.Fatal("expected normalization")
	}
	if len(n.ImageURLs) != 2 {
		t.Fatalf("volcNorm images = %d, want 2", len(n.ImageURLs))
	}
	if len(req.Images) != 2 {
		t.Fatalf("req.Images = %#v, want 2 from content[]", req.Images)
	}
	if req.Images[0] != "https://example.com/a.jpg" || req.Images[1] != "https://example.com/b.jpg" {
		t.Fatalf("req.Images = %#v", req.Images)
	}
}

func TestConvertCreatePayloadVolcOfficialTwoImages(t *testing.T) {
	gin.SetMode(gin.TestMode)
	body := `{
		"model":"mingiz-sd2",
		"image":"https://cdn.example.com/same/path/image.jpg?id=1",
		"content":[
			{"type":"text","text":"两张参考图"},
			{"type":"image_url","image_url":{"url":"https://cdn.example.com/same/path/image.jpg?id=1"},"role":"reference_image"},
			{"type":"image_url","image_url":"https://cdn.example.com/same/path/image.jpg?id=2","role":"reference_image"}
		],
		"ratio":"16:9",
		"resolution":"720p",
		"duration":8
	}`
	c, _ := gin.CreateTestContext(httptest.NewRecorder())
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/videos", bytes.NewBufferString(body))
	c.Request.Header.Set("Content-Type", "application/json")
	bs, err := common.CreateBodyStorage([]byte(body))
	if err != nil {
		t.Fatalf("CreateBodyStorage: %v", err)
	}
	c.Set(common.KeyBodyStorage, bs)

	req := &relaycommon.TaskSubmitReq{
		Model:      "mingiz-sd2",
		Image:      "https://cdn.example.com/same/path/image.jpg?id=1",
		Images:     []string{"https://cdn.example.com/same/path/image.jpg?id=1"},
		Ratio:      "16:9",
		Resolution: "720p",
		Duration:   8,
	}
	info := &relaycommon.RelayInfo{
		OriginModelName: "mingiz-sd2",
		ChannelMeta: &relaycommon.ChannelMeta{
			UpstreamModelName: "mingiz-sd2",
		},
		TaskRelayInfo: &relaycommon.TaskRelayInfo{},
	}
	a := &TaskAdaptor{}
	payload, err := a.convertCreatePayload(c, req, info)
	if err != nil {
		t.Fatalf("convertCreatePayload: %v", err)
	}
	imgs, ok := payload["image_urls"].([]imageURLEntry)
	if !ok || len(imgs) != 2 {
		t.Fatalf("image_urls = %#v, want 2 entries", payload["image_urls"])
	}
	if imgs[0].URL != "https://cdn.example.com/same/path/image.jpg?id=1" {
		t.Fatalf("image[0] = %s", imgs[0].URL)
	}
	if imgs[1].URL != "https://cdn.example.com/same/path/image.jpg?id=2" {
		t.Fatalf("image[1] = %s", imgs[1].URL)
	}
	if imgs[0].FileName == imgs[1].FileName {
		t.Fatalf("file_name should be unique, both = %q", imgs[0].FileName)
	}
}

func TestExtractVolcMediaURLVariants(t *testing.T) {
	raw := []byte(`[
		{"type":"image_url","image_url":{"url":"https://a.example/1.jpg"}},
		{"type":"image_url","image_url":"https://a.example/2.jpg"},
		{"type":"image_url","url":"https://a.example/3.jpg"}
	]`)
	arr := gjson.ParseBytes(raw).Array()
	if got := extractVolcMediaURL(arr[0], "image_url"); got != "https://a.example/1.jpg" {
		t.Fatalf("object form = %q", got)
	}
	if got := extractVolcMediaURL(arr[1], "image_url"); got != "https://a.example/2.jpg" {
		t.Fatalf("string form = %q", got)
	}
	if got := extractVolcMediaURL(arr[2], "image_url"); got != "https://a.example/3.jpg" {
		t.Fatalf("top-level url = %q", got)
	}
}

func TestDetectAndNormalizeVolcOfficialSkipMingiz(t *testing.T) {
	gin.SetMode(gin.TestMode)
	body := `{"model":"mingiz-sd2","prompt":"一只猫","images":["https://example.com/a.jpg"]}`
	c, _ := gin.CreateTestContext(httptest.NewRecorder())
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/videos", bytes.NewBufferString(body))
	bs, err := common.CreateBodyStorage([]byte(body))
	if err != nil {
		t.Fatalf("CreateBodyStorage: %v", err)
	}
	c.Set(common.KeyBodyStorage, bs)

	req := &relaycommon.TaskSubmitReq{Model: "mingiz-sd2", Prompt: "一只猫", Images: []string{"https://example.com/a.jpg"}}
	if n := detectAndNormalizeVolcOfficial(c, req); n != nil {
		t.Fatalf("expected nil for mingiz format, got %+v", n)
	}
}

func TestCoerce83ziResolution(t *testing.T) {
	tests := []struct {
		in       string
		fromVolc bool
		want     string
	}{
		{"720p", false, "720p"},
		{"1080p", false, "1080p"},
		{"480p", false, "720p"},
		{"", false, ""},
		{"", true, "720p"},
		{"2k", true, "720p"},
	}
	for _, tt := range tests {
		got := coerce83ziResolution(tt.in, tt.fromVolc)
		if got != tt.want {
			t.Fatalf("coerce83ziResolution(%q, %v) = %q, want %q", tt.in, tt.fromVolc, got, tt.want)
		}
	}
}

func TestNormalize83ziResolutionCoerces480p(t *testing.T) {
	payload := map[string]interface{}{"resolution": "480p"}
	normalize83ziResolution(payload, true)
	if payload["resolution"] != "720p" {
		t.Fatalf("resolution = %v, want 720p", payload["resolution"])
	}
}

func TestConvertCreatePayloadVolcOfficial(t *testing.T) {
	gin.SetMode(gin.TestMode)
	body := `{
		"model":"mingiz-sd2",
		"content":[
			{"type":"text","text":"一只橘猫在窗边打哈欠"},
			{"type":"image_url","image_url":{"url":"https://example.com/cat.jpg"}},
			{"type":"video_url","video_url":{"url":"https://example.com/ref.mp4"}},
			{"type":"audio_url","audio_url":{"url":"https://example.com/bg.mp3"}}
		],
		"ratio":"16:9",
		"resolution":"480p",
		"duration":10
	}`
	c, _ := gin.CreateTestContext(httptest.NewRecorder())
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/videos", bytes.NewBufferString(body))
	c.Request.Header.Set("Content-Type", "application/json")
	bs, err := common.CreateBodyStorage([]byte(body))
	if err != nil {
		t.Fatalf("CreateBodyStorage: %v", err)
	}
	c.Set(common.KeyBodyStorage, bs)

	req := &relaycommon.TaskSubmitReq{
		Model:      "mingiz-sd2",
		Ratio:      "16:9",
		Resolution: "480p",
		Duration:   10,
	}
	info := &relaycommon.RelayInfo{
		OriginModelName: "mingiz-sd2",
		ChannelMeta: &relaycommon.ChannelMeta{
			UpstreamModelName: "mingiz-sd2",
		},
		TaskRelayInfo: &relaycommon.TaskRelayInfo{},
	}
	a := &TaskAdaptor{}
	payload, err := a.convertCreatePayload(c, req, info)
	if err != nil {
		t.Fatalf("convertCreatePayload: %v", err)
	}
	if payload["model"] != "xinghe-2.0" {
		t.Fatalf("model = %v", payload["model"])
	}
	if payload["prompt"] != "一只橘猫在窗边打哈欠" {
		t.Fatalf("prompt = %v", payload["prompt"])
	}
	if payload["ratio"] != "16:9" {
		t.Fatalf("ratio = %v", payload["ratio"])
	}
	if payload["resolution"] != "720p" {
		t.Fatalf("resolution = %v, want 720p (coerced from 480p)", payload["resolution"])
	}
	if payload["generate_audio"] != true {
		t.Fatalf("generate_audio = %v", payload["generate_audio"])
	}
	if payload["watermark"] != false {
		t.Fatalf("watermark = %v", payload["watermark"])
	}
	vids, ok := payload["video_urls"].([]string)
	if !ok || len(vids) != 1 {
		t.Fatalf("video_urls = %v", payload["video_urls"])
	}
	if _, ok := payload["reference_video_urls"]; ok {
		t.Fatalf("reference_video_urls should be removed, got %v", payload["reference_video_urls"])
	}
	auds, ok := payload["audio_urls"].([]string)
	if !ok || len(auds) != 1 {
		t.Fatalf("audio_urls = %v", payload["audio_urls"])
	}
	imgs, ok := payload["image_urls"].([]imageURLEntry)
	if !ok || len(imgs) != 1 {
		t.Fatalf("image_urls = %v", payload["image_urls"])
	}
}
