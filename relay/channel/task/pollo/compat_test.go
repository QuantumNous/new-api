package pollo

// Doubao-compatibility tests: the Pollo seedance channel must accept the same request
// bodies the Doubao seedance channel accepts — across all four client formats that funnel
// into TaskSubmitReq (new-api, Jimeng, Kling, Sora/OpenAI) — and produce the same
// OpenAI-video response shape on fetch. See relay/channel/task/doubao/README.md for the
// reference contract.

import (
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/model"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
)

func buildPayload(t *testing.T, req *relaycommon.TaskSubmitReq) (*polloRequest, *TaskAdaptor) {
	t.Helper()
	a := &TaskAdaptor{baseURL: defaultBaseURL}
	info := &relaycommon.RelayInfo{OriginModelName: "seedance-2-0"}
	info.ChannelMeta = &relaycommon.ChannelMeta{UpstreamModelName: "seedance-2-0"}
	body, err := a.convertToRequestPayload(req, info)
	if err != nil {
		t.Fatalf("convertToRequestPayload: %v", err)
	}
	return body, a
}

// ── Kling format ──────────────────────────────────────────────────────────────
// middleware.KlingRequestConvert puts the ENTIRE original Kling body into metadata,
// so kling-native keys (string duration, aspect_ratio, image, image_tail, cfg_scale...)
// arrive as metadata keys. Doubao tolerates the string-typed numbers via dto.IntValue;
// pollo must do the same and additionally map the kling keys it can honor.

func TestCompat_KlingText2Video(t *testing.T) {
	body, a := buildPayload(t, &relaycommon.TaskSubmitReq{
		Prompt: "a cat surfing",
		Model:  "seedance-2-0",
		Metadata: map[string]any{
			"model_name":       "seedance-2-0",
			"prompt":           "a cat surfing",
			"negative_prompt":  "blurry",
			"cfg_scale":        0.5,
			"mode":             "std",
			"duration":         "10", // kling sends duration as a STRING
			"aspect_ratio":     "9:16",
			"callback_url":     "https://cb.example.com/hook",
			"external_task_id": "ext-1",
		},
	})
	if a.isRef {
		t.Fatal("kling t2v must not enter ref mode")
	}
	if body.Input.Length != 10 {
		t.Fatalf("string duration \"10\" must be tolerated, got length=%d", body.Input.Length)
	}
	if body.Input.AspectRatio != "9:16" {
		t.Fatalf("aspect_ratio must map to aspectRatio, got %q", body.Input.AspectRatio)
	}
	if body.WebhookUrl != "https://cb.example.com/hook" {
		t.Fatalf("callback_url must map to webhookUrl, got %q", body.WebhookUrl)
	}
	if body.Input.Prompt != "a cat surfing" {
		t.Fatalf("prompt = %q", body.Input.Prompt)
	}
}

func TestCompat_KlingImage2Video(t *testing.T) {
	body, a := buildPayload(t, &relaycommon.TaskSubmitReq{
		Prompt: "the person waves",
		Metadata: map[string]any{
			"image":      "https://x/first.jpg",
			"image_tail": "https://x/last.jpg",
			"duration":   "5",
			"mode":       "pro",
		},
	})
	if a.isRef {
		t.Fatal("kling i2v must not enter ref mode")
	}
	if body.Input.Image != "https://x/first.jpg" {
		t.Fatalf("kling image must map to input.image, got %q", body.Input.Image)
	}
	if body.Input.ImageTail != "https://x/last.jpg" {
		t.Fatalf("kling image_tail must map to input.imageTail, got %q", body.Input.ImageTail)
	}
	if body.Input.Length != 5 {
		t.Fatalf("length = %d, want 5", body.Input.Length)
	}
}

// ── Jimeng format ─────────────────────────────────────────────────────────────
// middleware.JimengRequestConvert puts the official Jimeng body into metadata:
// req_key/prompt/image_urls/aspect_ratio/seed/frames (frames = 24*seconds + 1).

func TestCompat_JimengImageUrlsFramesSeed(t *testing.T) {
	body, a := buildPayload(t, &relaycommon.TaskSubmitReq{
		Prompt: "a dog running",
		Metadata: map[string]any{
			"req_key":      "seedance-2-0",
			"prompt":       "a dog running",
			"image_urls":   []any{"https://x/a.jpg", "https://x/b.jpg"},
			"aspect_ratio": "4:3",
			"seed":         float64(42),
			"frames":       float64(121), // 24*5+1 -> 5s
		},
	})
	if a.isRef {
		t.Fatal("jimeng i2v must not enter ref mode")
	}
	if body.Input.Image != "https://x/a.jpg" || body.Input.ImageTail != "https://x/b.jpg" {
		t.Fatalf("image_urls must map to image/imageTail, got %q / %q", body.Input.Image, body.Input.ImageTail)
	}
	if body.Input.Length != 5 {
		t.Fatalf("frames=121 must resolve to 5s, got %d", body.Input.Length)
	}
	if body.Input.Seed == nil || *body.Input.Seed != 42 {
		t.Fatalf("seed = %v, want 42", body.Input.Seed)
	}
	if body.Input.AspectRatio != "4:3" {
		t.Fatalf("aspectRatio = %q", body.Input.AspectRatio)
	}
}

func TestCompat_FramesToSeconds(t *testing.T) {
	for frames, want := range map[int]int{121: 5, 241: 10, 97: 4} {
		req := &relaycommon.TaskSubmitReq{Prompt: "x", Metadata: map[string]any{"frames": float64(frames)}}
		if got := resolveSeconds(req); got != want {
			t.Fatalf("frames=%d -> %d, want %d", frames, got, want)
		}
	}
	// top-level seconds still wins over frames
	req := &relaycommon.TaskSubmitReq{Prompt: "x", Seconds: "8", Metadata: map[string]any{"frames": float64(241)}}
	if got := resolveSeconds(req); got != 8 {
		t.Fatalf("seconds must win over frames, got %d", got)
	}
}

// ── Doubao new-api format ─────────────────────────────────────────────────────
// Doubao-style metadata: snake_case params + content[] media items + tools[].

func TestCompat_DoubaoSnakeCaseAliases(t *testing.T) {
	body, _ := buildPayload(t, &relaycommon.TaskSubmitReq{
		Prompt:  "x",
		Seconds: "5",
		Metadata: map[string]any{
			"generate_audio": true,
			"tools":          []any{map[string]any{"type": "web_search"}},
			"resolution":     "1080p",
			"ratio":          "21:9",
		},
	})
	if body.Input.GenerateAudio == nil || !bool(*body.Input.GenerateAudio) {
		t.Fatalf("generate_audio must map to generateAudio, got %v", body.Input.GenerateAudio)
	}
	if body.Input.WebSearch == nil || !bool(*body.Input.WebSearch) {
		t.Fatalf("tools web_search must map to webSearch, got %v", body.Input.WebSearch)
	}
	if body.Input.Resolution != "1080p" || body.Input.AspectRatio != "21:9" {
		t.Fatalf("resolution/ratio = %q/%q", body.Input.Resolution, body.Input.AspectRatio)
	}
}

func TestCompat_DoubaoContentVideoAudioRefs(t *testing.T) {
	body, a := buildPayload(t, &relaycommon.TaskSubmitReq{
		Prompt:  "extend this video with matching music",
		Seconds: "5",
		Metadata: map[string]any{
			"content": []any{
				map[string]any{"type": "image_url", "image_url": map[string]any{"url": "https://x/ref.jpg"}, "role": "reference_image"},
				map[string]any{"type": "video_url", "video_url": map[string]any{"url": "https://x/clip.mp4"}},
				map[string]any{"type": "audio_url", "audio_url": map[string]any{"url": "https://x/music.mp3"}},
				map[string]any{"type": "text", "text": "must be ignored"},
			},
		},
	})
	if !a.isRef {
		t.Fatal("video/audio/reference content must enter ref mode")
	}
	if len(body.Input.Refs) != 3 {
		t.Fatalf("want 3 refs, got %d", len(body.Input.Refs))
	}
	r0 := body.Input.Refs[0].(polloRef)
	r1 := body.Input.Refs[1].(polloRef)
	r2 := body.Input.Refs[2].(polloRef)
	if r0.Type != "image" || r0.Image != "https://x/ref.jpg" || r0.Name != "ref1" || r0.Order != 1 {
		t.Fatalf("ref0 = %+v", r0)
	}
	if r1.Type != "video" || r1.Video != "https://x/clip.mp4" || r1.Name != "ref2" || r1.Order != 2 {
		t.Fatalf("ref1 = %+v", r1)
	}
	if r2.Type != "audio" || r2.Audio != "https://x/music.mp3" || r2.Name != "ref3" || r2.Order != 3 {
		t.Fatalf("ref2 = %+v", r2)
	}
	// marshaled refs must carry the type-matching media field only
	raw, _ := common.Marshal(body)
	for _, want := range []string{`"video":"https://x/clip.mp4"`, `"audio":"https://x/music.mp3"`, `"image":"https://x/ref.jpg"`} {
		if !strings.Contains(string(raw), want) {
			t.Fatalf("marshaled body missing %s: %s", want, raw)
		}
	}
}

// Doubao's generate_audio defaults to false; Pollo's ref2video defaults to true.
// The adaptor must pin the Doubao default unless the client opted in.
func TestCompat_RefGenerateAudioDefaultsFalse(t *testing.T) {
	ref := map[string]any{"content": []any{
		map[string]any{"type": "image_url", "image_url": map[string]any{"url": "https://x/a.jpg"}, "role": "reference_image"},
	}}

	body, _ := buildPayload(t, &relaycommon.TaskSubmitReq{Prompt: "x", Seconds: "5", Metadata: ref})
	if body.Input.GenerateAudio == nil || bool(*body.Input.GenerateAudio) {
		t.Fatalf("ref mode must default generateAudio=false (doubao parity), got %v", body.Input.GenerateAudio)
	}

	// explicit opt-in survives
	ref["generate_audio"] = true
	body, _ = buildPayload(t, &relaycommon.TaskSubmitReq{Prompt: "x", Seconds: "5", Metadata: ref})
	if body.Input.GenerateAudio == nil || !bool(*body.Input.GenerateAudio) {
		t.Fatalf("explicit generate_audio=true must survive on ref path, got %v", body.Input.GenerateAudio)
	}
}

// Doubao sends every req.Images entry upstream; Pollo's i2v shape carries at most
// first frame + tail frame, so images[0]/images[1] map to image/imageTail.
func TestCompat_TopLevelImagesFirstAndTail(t *testing.T) {
	body, _ := buildPayload(t, &relaycommon.TaskSubmitReq{
		Prompt: "x",
		Images: []string{"https://x/1.jpg", "https://x/2.jpg"},
	})
	if body.Input.Image != "https://x/1.jpg" || body.Input.ImageTail != "https://x/2.jpg" {
		t.Fatalf("images[0]/[1] must map to image/imageTail, got %q / %q", body.Input.Image, body.Input.ImageTail)
	}
}

// metadata.prompt must never override the top-level prompt (doubao: prompt always
// comes from req.Prompt; any metadata text is rejected).
func TestCompat_PromptAlwaysTopLevel(t *testing.T) {
	body, _ := buildPayload(t, &relaycommon.TaskSubmitReq{
		Prompt:   "top-level prompt",
		Metadata: map[string]any{"prompt": "metadata prompt"},
	})
	if body.Input.Prompt != "top-level prompt" {
		t.Fatalf("prompt = %q, want top-level", body.Input.Prompt)
	}
}

// ── Output: GET /v1/videos/{id} (Sora/OpenAI format) ─────────────────────────
// ConvertToOpenAIVideo must populate the same fields the Doubao adaptor populates:
// created_at, completed_at, model, and an always-present metadata.url.

func TestCompat_ConvertToOpenAIVideo_FieldParity(t *testing.T) {
	a := &TaskAdaptor{}

	task := &model.Task{
		TaskID:     "task_abc",
		Status:     model.TaskStatusSuccess,
		Progress:   "100%",
		CreatedAt:  111,
		UpdatedAt:  222,
		Properties: model.Properties{OriginModelName: "seedance-2-0"},
	}
	task.SetData(map[string]any{
		"code": "SUCCESS",
		"data": map[string]any{
			"taskId": "up_1", "credit": 4.4,
			"generations": []any{map[string]any{"id": "g", "status": "succeed", "url": "https://cdn/x.mp4"}},
		},
	})

	raw, err := a.ConvertToOpenAIVideo(task)
	if err != nil {
		t.Fatalf("ConvertToOpenAIVideo: %v", err)
	}
	var ov dto.OpenAIVideo
	if err := common.Unmarshal(raw, &ov); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}
	if ov.ID != "task_abc" || ov.Status != dto.VideoStatusCompleted || ov.Progress != 100 {
		t.Fatalf("id/status/progress = %q/%q/%d", ov.ID, ov.Status, ov.Progress)
	}
	if ov.CreatedAt != 111 || ov.CompletedAt != 222 {
		t.Fatalf("created_at/completed_at = %d/%d, want 111/222 (doubao parity)", ov.CreatedAt, ov.CompletedAt)
	}
	if ov.Model != "seedance-2-0" {
		t.Fatalf("model = %q, want origin model (doubao parity)", ov.Model)
	}
	if ov.Metadata == nil || ov.Metadata["url"] != "https://cdn/x.mp4" {
		t.Fatalf("metadata.url = %v", ov.Metadata)
	}

	// queued task with no result yet: metadata.url must still be present (empty), like doubao
	queued := &model.Task{TaskID: "task_q", Status: model.TaskStatusQueued, Progress: "20%"}
	raw, err = a.ConvertToOpenAIVideo(queued)
	if err != nil {
		t.Fatalf("ConvertToOpenAIVideo(queued): %v", err)
	}
	ov = dto.OpenAIVideo{}
	_ = common.Unmarshal(raw, &ov)
	if ov.Metadata == nil {
		t.Fatal("metadata.url must always be present (doubao parity)")
	}
	if url, ok := ov.Metadata["url"]; !ok || url != "" {
		t.Fatalf("queued metadata.url = %v, want empty string", ov.Metadata["url"])
	}

	// failed task carries error.message
	failed := &model.Task{TaskID: "task_f", Status: model.TaskStatusFailure, Progress: "100%", FailReason: "bad prompt"}
	raw, err = a.ConvertToOpenAIVideo(failed)
	if err != nil {
		t.Fatalf("ConvertToOpenAIVideo(failed): %v", err)
	}
	ov = dto.OpenAIVideo{}
	_ = common.Unmarshal(raw, &ov)
	if ov.Error == nil || ov.Error.Message != "bad prompt" {
		t.Fatalf("error = %+v", ov.Error)
	}
}
