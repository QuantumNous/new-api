package mao

import "testing"

func TestBuildUpstreamPayload_RewritesModelAndDropsResolution(t *testing.T) {
	in := map[string]interface{}{
		"model":      "guanzhuan-seedance2.0",
		"prompt":     "hello",
		"duration":   10,
		"ratio":      "16:9",
		"resolution": "1080p",
	}
	out, err := buildUpstreamPayload(in, "guanzhuan-seedance2.0")
	if err != nil {
		t.Fatal(err)
	}
	if out["model"] != "sd-2-0-1080p" {
		t.Fatalf("model=%v", out["model"])
	}
	if _, ok := out["resolution"]; ok {
		t.Fatal("resolution must not be sent upstream")
	}
	if _, ok := out["size"]; ok {
		t.Fatal("size must not be sent upstream")
	}
}

func TestBuildUpstreamPayload_DefaultTier720p(t *testing.T) {
	in := map[string]interface{}{"model": "guanzhuan-seedance2.5", "prompt": "x"}
	out, err := buildUpstreamPayload(in, "guanzhuan-seedance2.5")
	if err != nil {
		t.Fatal(err)
	}
	if out["model"] != "sd-2-5-720p" {
		t.Fatalf("model=%v", out["model"])
	}
}

func TestBuildUpstreamPayload_MiniStripsCameraFixed(t *testing.T) {
	in := map[string]interface{}{
		"model":  "guanzhuan-seedance2.0-mini",
		"prompt": "x",
		"metadata": map[string]interface{}{
			"camera_fixed":   true,
			"generate_audio": true,
		},
	}
	out, err := buildUpstreamPayload(in, "guanzhuan-seedance2.0-mini")
	if err != nil {
		t.Fatal(err)
	}
	md, _ := out["metadata"].(map[string]interface{})
	if _, ok := md["camera_fixed"]; ok {
		t.Fatal("camera_fixed must be stripped for mini")
	}
	if md["generate_audio"] != true {
		t.Fatalf("generate_audio=%v", md["generate_audio"])
	}
}

func TestBuildUpstreamPayload_UnsupportedTier(t *testing.T) {
	in := map[string]interface{}{
		"model":      "guanzhuan-seedance2.5",
		"resolution": "1080p",
		"prompt":     "x",
	}
	_, err := buildUpstreamPayload(in, "guanzhuan-seedance2.5")
	if err == nil {
		t.Fatal("expected error")
	}
}

func TestBuildUpstreamPayload_DefaultResponseFormat(t *testing.T) {
	in := map[string]interface{}{"model": "guanzhuan-seedance2.0", "prompt": "x"}
	out, err := buildUpstreamPayload(in, "guanzhuan-seedance2.0")
	if err != nil {
		t.Fatal(err)
	}
	if out["response_format"] != "url" {
		t.Fatalf("response_format=%v", out["response_format"])
	}
}
