package common

import (
	"testing"

	"github.com/QuantumNous/new-api/common"
)

func TestTaskSubmitReqUnmarshalImageObject(t *testing.T) {
	raw := []byte(`{
		"model": "grok-imagine-1.0-video-apimart",
		"prompt": "test",
		"aspect_ratio": "9:16",
		"duration": 15,
		"resolution": "720p",
		"image": {"url": "https://example.com/ref.png"}
	}`)
	var req TaskSubmitReq
	if err := common.Unmarshal(raw, &req); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}
	if !req.HasImage() {
		t.Fatal("expected HasImage")
	}
	if len(req.Images) != 1 || req.Images[0] != "https://example.com/ref.png" {
		t.Fatalf("images = %#v", req.Images)
	}
	if req.Image != "https://example.com/ref.png" {
		t.Fatalf("image = %q", req.Image)
	}
	if req.Duration != 15 {
		t.Fatalf("duration = %d", req.Duration)
	}
}

func TestTaskSubmitReqUnmarshalImageHTTPURLField(t *testing.T) {
	raw := []byte(`{
		"model": "grok-video-3",
		"prompt": "test",
		"image": {"http_url": "https://example.com/a.jpg"}
	}`)
	var req TaskSubmitReq
	if err := common.Unmarshal(raw, &req); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}
	if req.Images[0] != "https://example.com/a.jpg" {
		t.Fatalf("images = %#v", req.Images)
	}
}

func TestTaskSubmitReqUnmarshalImagesStringArray(t *testing.T) {
	raw := []byte(`{
		"prompt": "小猫在吃鱼",
		"model": "grok-video-3",
		"aspect_ratio": "3:2",
		"size": "720P",
		"images": ["https://example.com/a.png"]
	}`)
	var req TaskSubmitReq
	if err := common.Unmarshal(raw, &req); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}
	if len(req.Images) != 1 || req.Images[0] != "https://example.com/a.png" {
		t.Fatalf("images = %#v", req.Images)
	}
}

func TestTaskSubmitReqUnmarshalSecondsNumber(t *testing.T) {
	raw := []byte(`{"model":"videos-fast","prompt":"x","seconds":5}`)
	var req TaskSubmitReq
	if err := common.Unmarshal(raw, &req); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}
	if req.Seconds != "5" {
		t.Fatalf("seconds = %q", req.Seconds)
	}
}
