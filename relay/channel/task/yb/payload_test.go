package yb

import (
	"testing"

	relaycommon "github.com/QuantumNous/new-api/relay/common"
)

func TestBuildUpstreamPayloadMetadata(t *testing.T) {
	req := &relaycommon.TaskSubmitReq{
		Prompt:     "人物微笑，轻微转头",
		Image:      "asset://asset-xxx",
		Resolution: "480p",
		Ratio:      "16:9",
		Duration:   5,
	}
	info := &relaycommon.RelayInfo{
		ChannelMeta: &relaycommon.ChannelMeta{
			UpstreamModelName: "doubao-seedance-2-0-mini-260615",
		},
	}
	out, err := buildUpstreamPayload(req, info)
	if err != nil {
		t.Fatalf("buildUpstreamPayload: %v", err)
	}
	if out["model"] != "doubao-seedance-2-0-mini-260615" {
		t.Fatalf("model=%v", out["model"])
	}
	if out["prompt"] != "人物微笑，轻微转头" {
		t.Fatalf("prompt=%v", out["prompt"])
	}
	if out["image"] != "asset://asset-xxx" {
		t.Fatalf("image=%v", out["image"])
	}
	md, _ := out["metadata"].(map[string]interface{})
	if md["resolution"] != "480p" {
		t.Fatalf("metadata.resolution=%v", md["resolution"])
	}
	if md["ratio"] != "16:9" {
		t.Fatalf("metadata.ratio=%v", md["ratio"])
	}
	if md["duration"] != 5 {
		t.Fatalf("metadata.duration=%v", md["duration"])
	}
	if _, ok := out["resolution"]; ok {
		t.Fatal("top-level resolution must not be sent")
	}
	if _, ok := out["duration"]; ok {
		t.Fatal("top-level duration must not be sent")
	}
}

func TestBuildUpstreamPayloadFromMetadata(t *testing.T) {
	req := &relaycommon.TaskSubmitReq{
		Prompt: "x",
		Metadata: map[string]interface{}{
			"resolution": "720p",
			"ratio":      "9:16",
			"duration":   float64(8),
		},
	}
	info := &relaycommon.RelayInfo{OriginModelName: "m1"}
	out, err := buildUpstreamPayload(req, info)
	if err != nil {
		t.Fatalf("err=%v", err)
	}
	md, _ := out["metadata"].(map[string]interface{})
	if md["resolution"] != "720p" || md["ratio"] != "9:16" || md["duration"] != 8 {
		t.Fatalf("md=%v", md)
	}
}

func TestParseCreateTaskID(t *testing.T) {
	id, err := parseCreateTaskID([]byte(`{"id":"task_abc"}`))
	if err != nil || id != "task_abc" {
		t.Fatalf("id=%q err=%v", id, err)
	}
}

func TestParseTaskResultSuccess(t *testing.T) {
	ti, err := parseTaskResult([]byte(`{"status":"completed","url":"https://cdn.example.com/a.mp4"}`))
	if err != nil {
		t.Fatalf("err=%v", err)
	}
	if ti.Url != "https://cdn.example.com/a.mp4" {
		t.Fatalf("url=%q", ti.Url)
	}
}

func TestApiOrigin(t *testing.T) {
	cases := map[string]string{
		"https://api.yabaoai.com":                   "https://api.yabaoai.com/v1",
		"https://api.yabaoai.com/v1":                "https://api.yabaoai.com/v1",
		"https://api.yabaoai.com/v1/video/generations": "https://api.yabaoai.com/v1",
	}
	for in, want := range cases {
		if got := apiOrigin(in); got != want {
			t.Fatalf("apiOrigin(%q)=%q want %q", in, got, want)
		}
	}
}
