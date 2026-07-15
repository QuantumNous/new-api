package sd283zi

import (
	"bytes"
	"net/http/httptest"
	"testing"

	commonpkg "github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/setting/config"
	"github.com/gin-gonic/gin"
)

func TestResolveUpstreamModel(t *testing.T) {
	tests := []struct {
		in   string
		want string
	}{
		{"sd2fast", "fast"},
		{"SD2FAST", "fast"},
		{"sd2", "2.0"},
		{"SD2", "2.0"},
		{"mingiz-sd2", "xinghe-2.0"},
		{"MINGIZ-SD2", "xinghe-2.0"},
		{"mingiz", "xinghe-2.0"},
		{"fast", "fast"},
		{"2.0", "2.0"},
		{"xinghe-fast", "xinghe-fast"},
		{"custom", "custom"},
	}
	for _, tt := range tests {
		if got := resolveUpstreamModel(tt.in); got != tt.want {
			t.Fatalf("resolveUpstreamModel(%q) = %q, want %q", tt.in, got, tt.want)
		}
	}
}

func TestResolveCreateModelNamePrefersUpstreamMapping(t *testing.T) {
	info := &common.RelayInfo{
		OriginModelName: "sd2-fast",
		ChannelMeta: &common.ChannelMeta{
			UpstreamModelName: "xinghe-fast",
		},
	}
	// Client form still sends sd2-fast; mapped upstream name must win.
	if got := resolveCreateModelName(info, "sd2-fast"); got != "xinghe-fast" {
		t.Fatalf("got %q, want xinghe-fast", got)
	}
	if got := resolveCreateModelName(&common.RelayInfo{OriginModelName: "mingiz-sd2"}, "ignored"); got != "xinghe-2.0" {
		t.Fatalf("got %q, want xinghe-2.0", got)
	}
	if got := resolveCreateModelName(&common.RelayInfo{}, "sd2fast"); got != "fast" {
		t.Fatalf("got %q, want fast", got)
	}
}

func TestParseCreateTaskID(t *testing.T) {
	body := []byte(`{"status":"success","task_id":"a77e1768-c022-43c6-a3c8-9756ee11037d","task_status":"pending"}`)
	id, err := parseCreateTaskID(body)
	if err != nil {
		t.Fatalf("parseCreateTaskID failed: %v", err)
	}
	if id != "a77e1768-c022-43c6-a3c8-9756ee11037d" {
		t.Fatalf("unexpected task id: %s", id)
	}
}

func TestParseTaskResultSuccess(t *testing.T) {
	a := &TaskAdaptor{}
	body := []byte(`{"status":"success","progress":100,"video_url":"https://example.com/video.mp4"}`)
	ti, err := a.ParseTaskResult(body)
	if err != nil {
		t.Fatalf("ParseTaskResult failed: %v", err)
	}
	if ti.Status != model.TaskStatusSuccess {
		t.Fatalf("status = %s, want success", ti.Status)
	}
	if ti.Url != "https://example.com/video.mp4" {
		t.Fatalf("url = %q", ti.Url)
	}
}

func TestParseTaskResultPolling(t *testing.T) {
	a := &TaskAdaptor{}
	body := []byte(`{"status":"polling","progress":80}`)
	ti, err := a.ParseTaskResult(body)
	if err != nil {
		t.Fatalf("ParseTaskResult failed: %v", err)
	}
	if ti.Status != model.TaskStatusInProgress {
		t.Fatalf("status = %s, want in progress", ti.Status)
	}
	if ti.Progress != "80%" {
		t.Fatalf("progress = %q", ti.Progress)
	}
}

func TestParseTaskResultCreateAck(t *testing.T) {
	a := &TaskAdaptor{}
	body := []byte(`{"status":"success","task_id":"a77e1768-c022-43c6-a3c8-9756ee11037d","task_status":"pending","video_url":null}`)
	ti, err := a.ParseTaskResult(body)
	if err != nil {
		t.Fatalf("ParseTaskResult failed: %v", err)
	}
	if ti.Status != model.TaskStatusInProgress {
		t.Fatalf("status = %s, want in progress", ti.Status)
	}
}

func TestParseTaskResultSubmitted(t *testing.T) {
	a := &TaskAdaptor{}
	body := []byte(`{"status":"submitted","progress":75,"stable_video_url":"/api/video/465783a0-2177-4891-80ae-c8d16040f493","completed_at":null}`)
	ti, err := a.ParseTaskResult(body)
	if err != nil {
		t.Fatalf("ParseTaskResult failed: %v", err)
	}
	if ti.Status != model.TaskStatusInProgress {
		t.Fatalf("status = %s, want in progress", ti.Status)
	}
	if ti.Progress != "75%" {
		t.Fatalf("progress = %q", ti.Progress)
	}
}

func TestParseTaskResultCompletedWithoutURL(t *testing.T) {
	a := &TaskAdaptor{}
	body := []byte(`{"status":"success","progress":100,"completed_at":"2026-07-02T21:30:00+08:00","video_url":null,"video_path":null}`)
	ti, err := a.ParseTaskResult(body)
	if err != nil {
		t.Fatalf("ParseTaskResult failed: %v", err)
	}
	if ti.Status != model.TaskStatusFailure {
		t.Fatalf("status = %s, want failure", ti.Status)
	}
}

func TestBuildLicenseVideoURL(t *testing.T) {
	got := buildLicenseVideoURL("https://api.shishikeji.com", "task-123", "GGZ-KEY")
	want := "https://api.shishikeji.com/api/video/task-123?license_key=GGZ-KEY"
	if got != want {
		t.Fatalf("buildLicenseVideoURL = %q, want %q", got, want)
	}
}

func TestAbsolutizeUpstreamMediaURL(t *testing.T) {
	got := absolutizeUpstreamMediaURL("https://api.shishikeji.com", "/api/video/task-1")
	if got != "https://api.shishikeji.com/api/video/task-1" {
		t.Fatalf("unexpected url: %s", got)
	}
}

func TestShouldFetchVideoLinkInProgress(t *testing.T) {
	raw := `{"status":"submitted","progress":75,"stable_video_url":"/api/video/task-1"}`
	if shouldFetchVideoLink(raw) {
		t.Fatal("submitted task should not fetch video link")
	}
}

func TestShouldFetchVideoLinkComplete(t *testing.T) {
	raw := `{"status":"success","progress":100,"completed_at":"2026-07-02T21:30:00+08:00","video_path":"/app/out.mp4"}`
	if !shouldFetchVideoLink(raw) {
		t.Fatal("completed task should fetch video link")
	}
}

func TestUpstreamFileFieldName(t *testing.T) {
	tests := map[string]string{
		"files":             "files",
		"file":              "files",
		"image":             "files",
		"images":            "files",
		"reference_image":   "files",
		"reference_images":  "files",
		"input_reference":   "files",
		"audios":            "audios",
		"audio":             "audios",
		"reference_audio":   "audios",
		"videos":            "videos",
		"video":             "videos",
		"reference_video":   "videos",
		"reference_videos":  "reference_videos",
		"custom_field":      "custom_field",
	}
	for in, want := range tests {
		if got := upstreamFileFieldName(in); got != want {
			t.Fatalf("upstreamFileFieldName(%q) = %q, want %q", in, got, want)
		}
	}
}

func TestIsTextMultipartField(t *testing.T) {
	if !isTextMultipartField("prompt") {
		t.Fatal("prompt should be text field")
	}
	if isTextMultipartField("files") {
		t.Fatal("files should not be text field")
	}
}

func TestToImageURLEntry(t *testing.T) {
	entry := toImageURLEntry("https://example.com/path/image2.png?x=1")
	if entry.URL != "https://example.com/path/image2.png?x=1" {
		t.Fatalf("unexpected url: %s", entry.URL)
	}
	if entry.FileName != "image2.png" {
		t.Fatalf("unexpected file name: %s", entry.FileName)
	}
	if entry.ContentType != "image/png" {
		t.Fatalf("unexpected content type: %s", entry.ContentType)
	}
}

func TestEstimateBillingPerCallSkipsSeconds(t *testing.T) {
	gin.SetMode(gin.TestMode)
	c, _ := gin.CreateTestContext(httptest.NewRecorder())
	c.Request = httptest.NewRequest("POST", "/v1/videos", nil)
	c.Set("task_request", common.TaskSubmitReq{Seconds: "5"})

	a := &TaskAdaptor{}
	info := &common.RelayInfo{OriginModelName: "sd2fast"}
	if ratios := a.EstimateBilling(c, info); ratios != nil {
		t.Fatalf("per-call billing should not return ratios, got %#v", ratios)
	}
}

func TestEstimateBillingPerSecondUsesDuration(t *testing.T) {
	if err := config.GlobalConfig.LoadFromDB(map[string]string{
		"billing_setting.billing_mode": `{"sd2fast":"per_second"}`,
	}); err != nil {
		t.Fatalf("load billing mode: %v", err)
	}
	t.Cleanup(func() {
		_ = config.GlobalConfig.LoadFromDB(map[string]string{
			"billing_setting.billing_mode": `{}`,
		})
	})

	gin.SetMode(gin.TestMode)
	c, _ := gin.CreateTestContext(httptest.NewRecorder())
	c.Request = httptest.NewRequest("POST", "/v1/videos", nil)
	c.Set("task_request", common.TaskSubmitReq{Seconds: "5"})

	a := &TaskAdaptor{}
	info := &common.RelayInfo{OriginModelName: "sd2fast"}
	ratios := a.EstimateBilling(c, info)
	if ratios == nil || ratios["seconds"] != 5 {
		t.Fatalf("per-second billing should return seconds=5, got %#v", ratios)
	}
}

func TestNormalizeCreatePayloadMigratesVideoAndAudio(t *testing.T) {
	payload := map[string]interface{}{
		"model":                "xinghe-2.0",
		"prompt":               "x",
		"reference_video_urls": []string{"https://example.com/v.mp4"},
		"audio_urls":           []any{"https://example.com/a.mp3"},
		"aspect_ratio":         "9:16",
	}
	normalizeCreatePayload(payload)

	vids, ok := payload["video_urls"].([]string)
	if !ok || len(vids) != 1 || vids[0] != "https://example.com/v.mp4" {
		t.Fatalf("video_urls = %#v", payload["video_urls"])
	}
	if _, ok := payload["reference_video_urls"]; ok {
		t.Fatalf("legacy reference_video_urls should be removed")
	}
	auds, ok := payload["audio_urls"].([]string)
	if !ok || len(auds) != 1 || auds[0] != "https://example.com/a.mp3" {
		t.Fatalf("audio_urls = %#v", payload["audio_urls"])
	}
	if payload["ratio"] != "9:16" {
		t.Fatalf("ratio = %v", payload["ratio"])
	}
}

func TestConvertCreatePayloadOfficialAudioVideoURLs(t *testing.T) {
	gin.SetMode(gin.TestMode)
	body := `{
		"model":"mingiz-sd2",
		"prompt":"参考音频节奏",
		"duration":10,
		"ratio":"9:16",
		"resolution":"720p",
		"images":["https://example.com/i.jpg"],
		"audio_urls":["https://example.com/a.mp3"],
		"video_urls":["https://example.com/v.mp4"]
	}`
	c, _ := gin.CreateTestContext(httptest.NewRecorder())
	c.Request = httptest.NewRequest("POST", "/v1/videos", bytes.NewBufferString(body))
	c.Request.Header.Set("Content-Type", "application/json")
	bs, err := commonpkg.CreateBodyStorage([]byte(body))
	if err != nil {
		t.Fatalf("CreateBodyStorage: %v", err)
	}
	c.Set(commonpkg.KeyBodyStorage, bs)

	req := &common.TaskSubmitReq{
		Model:      "mingiz-sd2",
		Prompt:     "参考音频节奏",
		Images:     []string{"https://example.com/i.jpg"},
		Ratio:      "9:16",
		Resolution: "720p",
		Duration:   10,
	}
	info := &common.RelayInfo{
		OriginModelName: "mingiz-sd2",
		ChannelMeta: &common.ChannelMeta{
			UpstreamModelName: "mingiz-sd2",
		},
		TaskRelayInfo: &common.TaskRelayInfo{},
	}
	a := &TaskAdaptor{}
	payload, err := a.convertCreatePayload(c, req, info)
	if err != nil {
		t.Fatalf("convertCreatePayload: %v", err)
	}
	auds, ok := payload["audio_urls"].([]string)
	if !ok || len(auds) != 1 || auds[0] != "https://example.com/a.mp3" {
		t.Fatalf("audio_urls = %#v", payload["audio_urls"])
	}
	vids, ok := payload["video_urls"].([]string)
	if !ok || len(vids) != 1 || vids[0] != "https://example.com/v.mp4" {
		t.Fatalf("video_urls = %#v", payload["video_urls"])
	}
	if _, ok := payload["reference_video_urls"]; ok {
		t.Fatalf("reference_video_urls should not be sent upstream")
	}
}
