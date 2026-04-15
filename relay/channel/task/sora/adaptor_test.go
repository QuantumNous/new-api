package sora

import "testing"

func TestNormalizeGrokVideoRequestAddsResolutionAliases(t *testing.T) {
	body := map[string]interface{}{
		"model":   "grok-imagine-1.0-video",
		"quality": "high",
		"preset":  "fun",
	}

	normalizeGrokVideoRequest(body, "grok-imagine-1.0-video")

	if got := body["quality"]; got != "high" {
		t.Fatalf("expected quality to stay high, got %#v", got)
	}
	if got := body["resolution_name"]; got != "720p" {
		t.Fatalf("expected resolution_name 720p, got %#v", got)
	}

	videoConfig, ok := body["video_config"].(map[string]interface{})
	if !ok {
		t.Fatalf("expected video_config map, got %#v", body["video_config"])
	}
	if got := videoConfig["resolution_name"]; got != "720p" {
		t.Fatalf("expected video_config.resolution_name 720p, got %#v", got)
	}
	if got := videoConfig["preset"]; got != "fun" {
		t.Fatalf("expected video_config.preset fun, got %#v", got)
	}
}

func TestNormalizeGrokVideoRequestBackfillsQualityFromResolutionName(t *testing.T) {
	body := map[string]interface{}{
		"model":           "grok-imagine-1.0-video",
		"resolution_name": "720p",
	}

	normalizeGrokVideoRequest(body, "grok-imagine-1.0-video")

	if got := body["quality"]; got != "high" {
		t.Fatalf("expected quality high, got %#v", got)
	}
	if got := body["resolution_name"]; got != "720p" {
		t.Fatalf("expected resolution_name 720p, got %#v", got)
	}
}

func TestNormalizeGrokVideoRequestBackfillsSecondsFromDuration(t *testing.T) {
	body := map[string]interface{}{
		"model":    "grok-imagine-1.0-video",
		"duration": float64(10),
	}

	normalizeGrokVideoRequest(body, "grok-imagine-1.0-video")

	if got := body["seconds"]; got != "10" {
		t.Fatalf("expected seconds to be backfilled from duration, got %#v", got)
	}
}

func TestNormalizeGrokVideoRequestKeepsExplicitSeconds(t *testing.T) {
	body := map[string]interface{}{
		"model":    "grok-imagine-1.0-video",
		"duration": float64(10),
		"seconds":  "8",
	}

	normalizeGrokVideoRequest(body, "grok-imagine-1.0-video")

	if got := body["seconds"]; got != "8" {
		t.Fatalf("expected explicit seconds to be preserved, got %#v", got)
	}
}

func TestNormalizeGrokVideoRequestPromotesImageReference(t *testing.T) {
	body := map[string]interface{}{
		"model":  "grok-imagine-1.0-video",
		"image":  "https://example.com/cover.png",
		"images": []interface{}{"https://example.com/frame-2.png"},
	}

	normalizeGrokVideoRequest(body, "grok-imagine-1.0-video")

	if _, exists := body["image"]; exists {
		t.Fatalf("expected legacy image field to be removed")
	}
	if _, exists := body["images"]; exists {
		t.Fatalf("expected legacy images field to be removed")
	}

	imageReference, ok := body["image_reference"].([]interface{})
	if !ok {
		t.Fatalf("expected image_reference array, got %#v", body["image_reference"])
	}
	if len(imageReference) != 2 {
		t.Fatalf("expected 2 image references, got %#v", imageReference)
	}
	if imageReference[0] != "https://example.com/cover.png" {
		t.Fatalf("unexpected first image reference %#v", imageReference[0])
	}
	if imageReference[1] != "https://example.com/frame-2.png" {
		t.Fatalf("unexpected second image reference %#v", imageReference[1])
	}
}
