package sd283zi

import (
	"bytes"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/QuantumNous/new-api/common"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/gin-gonic/gin"
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
		"model":                "xinghe-2.0",
		"prompt":               "",
		"reference_video_urls": []any{},
		"audio_urls":           []any{},
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
	vids, ok := payload["reference_video_urls"].([]string)
	if !ok || len(vids) != 1 || vids[0] != "https://example.com/v.mp4" {
		t.Fatalf("reference_video_urls = %v", payload["reference_video_urls"])
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
	vids, ok := payload["reference_video_urls"].([]string)
	if !ok || len(vids) != 1 {
		t.Fatalf("reference_video_urls = %v", payload["reference_video_urls"])
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
