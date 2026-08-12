package mao

import (
	"encoding/json"
	"testing"
)

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
		t.Fatal("resolution must not be sent upstream at top level")
	}
	if _, ok := out["size"]; ok {
		t.Fatal("size must not be sent upstream")
	}
	md, _ := out["metadata"].(map[string]interface{})
	if md["resolution"] != "1080p" {
		t.Fatalf("metadata.resolution=%v, want 1080p", md["resolution"])
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
	md, _ := out["metadata"].(map[string]interface{})
	if md["resolution"] != "720p" {
		t.Fatalf("metadata.resolution=%v, want 720p", md["resolution"])
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

func TestBuildUpstreamPayload_TopLevelCameraFixed(t *testing.T) {
	in := map[string]interface{}{
		"model":        "guanzhuan-seedance2.0",
		"prompt":       "x",
		"camera_fixed": true,
	}
	out, err := buildUpstreamPayload(in, "guanzhuan-seedance2.0")
	if err != nil {
		t.Fatal(err)
	}
	md, _ := out["metadata"].(map[string]interface{})
	if md["camera_fixed"] != true {
		t.Fatalf("metadata.camera_fixed=%v, want true", md["camera_fixed"])
	}

	mini := map[string]interface{}{
		"model":        "guanzhuan-seedance2.0-mini",
		"prompt":       "x",
		"camera_fixed": true,
	}
	outMini, err := buildUpstreamPayload(mini, "guanzhuan-seedance2.0-mini")
	if err != nil {
		t.Fatal(err)
	}
	mdMini, _ := outMini["metadata"].(map[string]interface{})
	if mdMini != nil {
		if _, ok := mdMini["camera_fixed"]; ok {
			t.Fatal("top-level camera_fixed must be stripped for mini")
		}
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

func TestBuildUpstreamPayload_AfterVolcNormalize(t *testing.T) {
	raw := []byte(`{
	  "model":"guanzhuan-seedance2.0",
	  "content":[
	    {"type":"text","text":"run"},
	    {"type":"image_url","role":"first_frame","image_url":{"url":"https://a/first.jpg"}},
	    {"type":"image_url","role":"last_frame","image_url":{"url":"https://a/last.jpg"}},
	    {"type":"video_url","video_url":{"url":"https://a/v.mp4"}}
	  ],
	  "resolution":"1080p"
	}`)
	var body map[string]interface{}
	if err := json.Unmarshal(raw, &body); err != nil {
		t.Fatal(err)
	}
	if !normalizeVolcOfficialInBodyMap(body, raw) {
		t.Fatal("expected normalize")
	}
	out, err := buildUpstreamPayload(body, "guanzhuan-seedance2.0")
	if err != nil {
		t.Fatal(err)
	}
	if out["model"] != "sd-2-0-1080p" {
		t.Fatalf("model=%v", out["model"])
	}
	if _, ok := out["content"]; ok {
		t.Fatal("content must not be present")
	}
	if out["image"] != "https://a/first.jpg" {
		t.Fatalf("image=%v", out["image"])
	}
	if out["last_frame"] != "https://a/last.jpg" {
		t.Fatalf("last_frame=%v", out["last_frame"])
	}
	vids := asStringSlice(out["videos"])
	if len(vids) != 1 || vids[0] != "https://a/v.mp4" {
		t.Fatalf("videos=%v", out["videos"])
	}
	md, _ := out["metadata"].(map[string]interface{})
	if md["generate_audio"] != true {
		t.Fatalf("metadata.generate_audio=%v", md["generate_audio"])
	}
	if md["watermark"] != false {
		t.Fatalf("metadata.watermark=%v, want false", md["watermark"])
	}
	if md["resolution"] != "1080p" {
		t.Fatalf("metadata.resolution=%v, want 1080p", md["resolution"])
	}
}

func TestBuildUpstreamPayload_MapsImagesAliasToReferenceImages(t *testing.T) {
	in := map[string]interface{}{
		"model":    "guanzhuan-seedance2.0-mini",
		"prompt":   "keep character",
		"images":   []interface{}{"https://cdn.example.com/ref.png"},
		"duration": 5,
		"ratio":    "16:9",
	}
	out, err := buildUpstreamPayload(in, "guanzhuan-seedance2.0-mini")
	if err != nil {
		t.Fatal(err)
	}
	if _, ok := out["image"]; ok {
		t.Fatalf("image=%v, single images[] must not become first frame", out["image"])
	}
	md, _ := out["metadata"].(map[string]interface{})
	refs := asStringSlice(md["reference_images"])
	if len(refs) != 1 || refs[0] != "https://cdn.example.com/ref.png" {
		t.Fatalf("reference_images=%v", refs)
	}
}

func TestBuildUpstreamPayload_MapsInputReferenceToReferenceImages(t *testing.T) {
	in := map[string]interface{}{
		"model":           "guanzhuan-seedance2.0",
		"prompt":          "run",
		"input_reference": "https://cdn.example.com/ref.jpg",
		"reference_images": []interface{}{
			"https://cdn.example.com/ref1.png",
			"https://cdn.example.com/ref2.png",
		},
	}
	out, err := buildUpstreamPayload(in, "guanzhuan-seedance2.0")
	if err != nil {
		t.Fatal(err)
	}
	if _, ok := out["image"]; ok {
		t.Fatalf("image=%v, input_reference must not become first frame", out["image"])
	}
	md, _ := out["metadata"].(map[string]interface{})
	refs := asStringSlice(md["reference_images"])
	if len(refs) != 3 {
		t.Fatalf("reference_images=%v", refs)
	}
}

func TestBuildUpstreamPayload_FirstImageAliasSetsFirstFrame(t *testing.T) {
	in := map[string]interface{}{
		"model":       "guanzhuan-seedance2.0",
		"prompt":      "x",
		"first_image": "https://cdn.example.com/first.jpg",
		"images":      []interface{}{"https://cdn.example.com/ref.png"},
	}
	out, err := buildUpstreamPayload(in, "guanzhuan-seedance2.0")
	if err != nil {
		t.Fatal(err)
	}
	if out["image"] != "https://cdn.example.com/first.jpg" {
		t.Fatalf("image=%v", out["image"])
	}
	md, _ := out["metadata"].(map[string]interface{})
	refs := asStringSlice(md["reference_images"])
	if len(refs) != 1 || refs[0] != "https://cdn.example.com/ref.png" {
		t.Fatalf("reference_images=%v", refs)
	}
}

func TestBuildUpstreamPayload_KeepsExplicitImageAndAddsRefs(t *testing.T) {
	in := map[string]interface{}{
		"model":  "guanzhuan-seedance2.0",
		"prompt": "x",
		"image":  "https://cdn.example.com/first.jpg",
		"images": []interface{}{"https://cdn.example.com/ref.png"},
	}
	out, err := buildUpstreamPayload(in, "guanzhuan-seedance2.0")
	if err != nil {
		t.Fatal(err)
	}
	if out["image"] != "https://cdn.example.com/first.jpg" {
		t.Fatalf("image=%v", out["image"])
	}
	md, _ := out["metadata"].(map[string]interface{})
	refs := asStringSlice(md["reference_images"])
	if len(refs) != 1 || refs[0] != "https://cdn.example.com/ref.png" {
		t.Fatalf("reference_images=%v", refs)
	}
}

func TestBuildUpstreamPayload_MetadataResolutionFallback(t *testing.T) {
	in := map[string]interface{}{
		"model":  "guanzhuan-seedance2.0",
		"prompt": "x",
		"metadata": map[string]interface{}{
			"resolution":     "1080p",
			"ratio":          "16:9",
			"generate_audio": false,
			"watermark":      false,
		},
	}
	out, err := buildUpstreamPayload(in, "guanzhuan-seedance2.0")
	if err != nil {
		t.Fatal(err)
	}
	if out["model"] != "sd-2-0-1080p" {
		t.Fatalf("model=%v, want sd-2-0-1080p", out["model"])
	}
	if _, ok := out["resolution"]; ok {
		t.Fatal("top-level resolution must not be sent")
	}
	md, _ := out["metadata"].(map[string]interface{})
	if md["resolution"] != "1080p" {
		t.Fatalf("metadata.resolution=%v", md["resolution"])
	}
}

func TestBuildUpstreamPayload_TopLevelResolutionWinsOverMetadata(t *testing.T) {
	in := map[string]interface{}{
		"model":      "guanzhuan-seedance2.0",
		"prompt":     "x",
		"resolution": "720p",
		"metadata": map[string]interface{}{
			"resolution": "1080p",
		},
	}
	out, err := buildUpstreamPayload(in, "guanzhuan-seedance2.0")
	if err != nil {
		t.Fatal(err)
	}
	if out["model"] != "sd-2-0-720p" {
		t.Fatalf("model=%v, want sd-2-0-720p", out["model"])
	}
	md, _ := out["metadata"].(map[string]interface{})
	if md["resolution"] != "720p" {
		t.Fatalf("metadata.resolution=%v, want synced 720p", md["resolution"])
	}
}
