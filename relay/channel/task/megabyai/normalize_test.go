package megabyai

import "testing"

func TestNormalizeCreateBody_SizeToRatioResolution(t *testing.T) {
	body := map[string]interface{}{
		"model":  "videos-mini",
		"prompt": "x",
		"size":   "1280x720",
	}
	normalizeCreateBody(body)
	if body["ratio"] != "16:9" {
		t.Fatalf("ratio=%v", body["ratio"])
	}
	if body["resolution"] != "720p" {
		t.Fatalf("resolution=%v", body["resolution"])
	}
	if _, ok := body["size"]; ok {
		t.Fatal("size should be removed")
	}
}

func TestNormalizeCreateBody_ImagesToReferenceImages(t *testing.T) {
	body := map[string]interface{}{
		"images": []interface{}{"https://example.com/a.png"},
	}
	normalizeCreateBody(body)
	refs, ok := body["referenceImages"].([]string)
	if !ok || len(refs) != 1 || refs[0] != "https://example.com/a.png" {
		t.Fatalf("referenceImages=%#v", body["referenceImages"])
	}
}

func TestNormalizeCreateBody_SecondsDurationSync(t *testing.T) {
	body := map[string]interface{}{"seconds": "8"}
	normalizeCreateBody(body)
	if body["duration"] != 8 && body["duration"] != float64(8) {
		// accept int after normalize
		if v, ok := body["duration"].(int); !ok || v != 8 {
			t.Fatalf("duration=%v", body["duration"])
		}
	}
}

func TestRejectFirstLastFrame(t *testing.T) {
	if err := rejectUnsupportedFrames(map[string]interface{}{"first_image": "x"}); err == nil {
		t.Fatal("expected error")
	}
}
