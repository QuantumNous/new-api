package ykvideo

import (
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
)

func TestResolveUpstreamModel(t *testing.T) {
	cases := []struct {
		in, want string
	}{
		{"seedance2.0-yk-933", "videos_933_c1"},
		{"seedance2.0-ykst-933", "videos_stable"},
		{"videos_933_c1", "videos_933_c1"},
		{"videos_stable", "videos_stable"},
		{"custom-x", "custom-x"},
	}
	for _, tt := range cases {
		if got := resolveUpstreamModel(tt.in); got != tt.want {
			t.Fatalf("resolveUpstreamModel(%q)=%q want %q", tt.in, got, tt.want)
		}
	}
}

func TestAPIOrigin_StripsSuffix(t *testing.T) {
	cases := map[string]string{
		"https://zcbservice.aizfw.cn/kyyReactApiServer":                         "https://zcbservice.aizfw.cn/kyyReactApiServer",
		"https://zcbservice.aizfw.cn/kyyReactApiServer/":                        "https://zcbservice.aizfw.cn/kyyReactApiServer",
		"https://zcbservice.aizfw.cn/kyyReactApiServer/v2/model-center/tasks":   "https://zcbservice.aizfw.cn/kyyReactApiServer",
		"https://zcbservice.aizfw.cn/kyyReactApiServer/v2/model-center/tasks/":  "https://zcbservice.aizfw.cn/kyyReactApiServer",
		"https://zcbservice.aizfw.cn/kyyReactApiServer/v2":                      "https://zcbservice.aizfw.cn/kyyReactApiServer",
		"": "https://zcbservice.aizfw.cn/kyyReactApiServer",
	}
	for in, want := range cases {
		if got := apiOrigin(in); got != want {
			t.Fatalf("apiOrigin(%q)=%q want %q", in, got, want)
		}
	}
}

func TestNormalizeCreateBody_Aliases(t *testing.T) {
	body := map[string]interface{}{
		"model":  "seedance2.0-yk-933",
		"prompt": "hi",
		"seconds": "8",
		"ratio":   "16:9",
		"images":  []interface{}{"https://example.com/a.png"},
		"videos":  []interface{}{"https://example.com/a.mp4"},
		"audios":  []interface{}{"https://example.com/a.mp3"},
	}
	normalizeCreateBody(body, "seedance2.0-yk-933")
	if body["model"] != "videos_933_c1" {
		t.Fatalf("model=%v", body["model"])
	}
	if body["duration"] != 8 {
		t.Fatalf("duration=%v", body["duration"])
	}
	if body["aspect_ratio"] != "16:9" {
		t.Fatalf("aspect_ratio=%v", body["aspect_ratio"])
	}
	imgs, ok := body["reference_images"].([]string)
	if !ok || len(imgs) != 1 || imgs[0] != "https://example.com/a.png" {
		t.Fatalf("reference_images=%#v", body["reference_images"])
	}
	vids, ok := body["reference_videos"].([]string)
	if !ok || len(vids) != 1 {
		t.Fatalf("reference_videos=%#v", body["reference_videos"])
	}
	auds, ok := body["reference_audios"].([]string)
	if !ok || len(auds) != 1 {
		t.Fatalf("reference_audios=%#v", body["reference_audios"])
	}
	if _, ok := body["seconds"]; ok {
		t.Fatal("seconds should be removed")
	}
	if _, ok := body["ratio"]; ok {
		t.Fatal("ratio should be removed")
	}
}

func TestNormalizeVolcOfficialInBodyMap(t *testing.T) {
	raw := []byte(`{
		"model":"seedance2.0-ykst-933",
		"content":[
			{"type":"text","text":"羽毛飘落"},
			{"type":"image_url","image_url":{"url":"https://example.com/first.jpg"},"role":"first_frame"},
			{"type":"image_url","image_url":{"url":"https://example.com/last.jpg"},"role":"last_frame"},
			{"type":"image_url","image_url":{"url":"https://example.com/ref.jpg"},"role":"reference_image"},
			{"type":"video_url","video_url":{"url":"https://example.com/a.mp4"}},
			{"type":"audio_url","audio_url":{"url":"https://example.com/a.mp3"}}
		],
		"duration":10,
		"aspect_ratio":"16:9"
	}`)
	var body map[string]interface{}
	if err := common.Unmarshal(raw, &body); err != nil {
		t.Fatal(err)
	}
	if !normalizeVolcOfficialInBodyMap(body, raw) {
		t.Fatal("expected normalize")
	}
	if body["prompt"] != "羽毛飘落" {
		t.Fatalf("prompt=%v", body["prompt"])
	}
	if body["first_image"] != "https://example.com/first.jpg" {
		t.Fatalf("first_image=%v", body["first_image"])
	}
	if body["last_image"] != "https://example.com/last.jpg" {
		t.Fatalf("last_image=%v", body["last_image"])
	}
	imgs, ok := body["reference_images"].([]string)
	if !ok || len(imgs) != 1 || imgs[0] != "https://example.com/ref.jpg" {
		t.Fatalf("reference_images=%#v", body["reference_images"])
	}
	if _, ok := body["content"]; ok {
		t.Fatal("content should be removed")
	}
	if body["generate_audio"] != true {
		t.Fatalf("generate_audio=%v", body["generate_audio"])
	}
}

func TestNormalizeVolcOfficial_NonVolcSkipped(t *testing.T) {
	raw := []byte(`{"model":"videos_stable","prompt":"x","reference_images":["https://a.png"]}`)
	var body map[string]interface{}
	if err := common.Unmarshal(raw, &body); err != nil {
		t.Fatal(err)
	}
	if normalizeVolcOfficialInBodyMap(body, raw) {
		t.Fatal("should not normalize")
	}
}

func TestParseCreateTaskID(t *testing.T) {
	id, err := parseCreateTaskID([]byte(`{"id":"mcp_123","status":"queued"}`))
	if err != nil || id != "mcp_123" {
		t.Fatalf("id=%q err=%v", id, err)
	}
}

func TestParseTaskResult_Completed(t *testing.T) {
	a := &TaskAdaptor{}
	raw := []byte(`{
		"id":"mcp_1",
		"status":"completed",
		"progress":100,
		"result_url":"https://example.com/r.mp4",
		"video_url":"https://example.com/v.mp4"
	}`)
	info, err := a.ParseTaskResult(raw)
	if err != nil {
		t.Fatal(err)
	}
	if info.Status != model.TaskStatusSuccess {
		t.Fatalf("status=%v", info.Status)
	}
	if info.Url != "https://example.com/v.mp4" {
		t.Fatalf("url=%q", info.Url)
	}
}

func TestParseTaskResult_Failed(t *testing.T) {
	a := &TaskAdaptor{}
	raw := []byte(`{"id":"mcp_1","status":"failed","error":"bad prompt"}`)
	info, err := a.ParseTaskResult(raw)
	if err != nil {
		t.Fatal(err)
	}
	if info.Status != model.TaskStatusFailure {
		t.Fatalf("status=%v", info.Status)
	}
	if info.Reason != "bad prompt" {
		t.Fatalf("reason=%q", info.Reason)
	}
}

func TestParseTaskResult_Progress(t *testing.T) {
	a := &TaskAdaptor{}
	raw := []byte(`{"id":"mcp_1","status":"processing","progress":42}`)
	info, err := a.ParseTaskResult(raw)
	if err != nil {
		t.Fatal(err)
	}
	if info.Status != model.TaskStatusInProgress {
		t.Fatalf("status=%v", info.Status)
	}
	if info.Progress != "42%" {
		t.Fatalf("progress=%q", info.Progress)
	}
}

func TestGetModelList(t *testing.T) {
	a := &TaskAdaptor{}
	list := a.GetModelList()
	if len(list) < 2 {
		t.Fatalf("list=%v", list)
	}
	if a.GetChannelName() != "yk-video" {
		t.Fatalf("name=%q", a.GetChannelName())
	}
}
