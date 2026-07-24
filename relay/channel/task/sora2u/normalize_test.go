package sora2u

import (
	"strings"
	"testing"
)

func TestNormalizeCreateBody_SecondsToDuration(t *testing.T) {
	body := map[string]interface{}{"seconds": "8"}
	normalizeCreateBody(body)
	if got := asPositiveInt(body["duration"]); got != 8 {
		t.Fatalf("duration=%v", body["duration"])
	}
}

func TestNormalizeCreateBody_SizeToAspectRatio(t *testing.T) {
	body := map[string]interface{}{"size": "720x1280"}
	normalizeCreateBody(body)
	if body["aspect_ratio"] != "9:16" {
		t.Fatalf("aspect_ratio=%v", body["aspect_ratio"])
	}
}

func TestNormalizeCreateBody_ImageURLToReferenceURL(t *testing.T) {
	body := map[string]interface{}{"image_url": "https://cdn.example.com/a.png"}
	normalizeCreateBody(body)
	if body["reference_url"] != "https://cdn.example.com/a.png" {
		t.Fatalf("reference_url=%v", body["reference_url"])
	}
	if _, ok := body["image_url"]; ok {
		t.Fatal("image_url should be removed")
	}
}

func TestNormalizeCreateBody_ImageAliasToReference(t *testing.T) {
	body := map[string]interface{}{"image": "abc123"}
	normalizeCreateBody(body)
	ref, _ := body["reference"].(string)
	if ref == "" {
		t.Fatalf("reference=%v", body["reference"])
	}
	if !strings.HasPrefix(ref, "data:") && ref != "abc123" {
		t.Fatalf("unexpected reference=%q", ref)
	}
}

func TestAPIOrigin_StripsAPISuffix(t *testing.T) {
	if got := apiOrigin("https://sora2u.com/api"); got != "https://sora2u.com" {
		t.Fatalf("got=%q", got)
	}
	if got := apiOrigin("https://sora2u.com"); got != "https://sora2u.com" {
		t.Fatalf("got=%q", got)
	}
	if got := apiOrigin("https://sora2u.com/api/v1/videos"); got != "https://sora2u.com" {
		t.Fatalf("got=%q", got)
	}
}
