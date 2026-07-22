package sora

import (
	"testing"

	"github.com/QuantumNous/new-api/dto"
)

func TestOpenaiFacePassEnabledDefaultOn(t *testing.T) {
	if !openaiFacePassEnabled(dto.ChannelOtherSettings{}) {
		t.Fatal("nil should default to on")
	}
	off := false
	if openaiFacePassEnabled(dto.ChannelOtherSettings{OpenaiFacePass: &off}) {
		t.Fatal("explicit false should be off")
	}
	on := true
	if !openaiFacePassEnabled(dto.ChannelOtherSettings{OpenaiFacePass: &on}) {
		t.Fatal("explicit true should be on")
	}
}

func TestOpenaiFaceOptsDefaults(t *testing.T) {
	opts := openaiFaceOptsFromSettings(dto.ChannelOtherSettings{})
	if !opts.SingleEye || opts.Size != 5 {
		t.Fatalf("opts=%+v", opts)
	}
	off := false
	size := 99
	opts = openaiFaceOptsFromSettings(dto.ChannelOtherSettings{
		OpenaiFaceSingleEye: &off,
		OpenaiFaceSize:      &size,
	})
	if opts.SingleEye || opts.Size != 10 {
		t.Fatalf("opts=%+v", opts)
	}
}

func TestRewriteJSONImageURLs_ImagesArray(t *testing.T) {
	body := map[string]interface{}{
		"images": []interface{}{"https://a.example/1.png"},
		"prompt": "hi",
	}
	rewriteJSONImageURLs(body, []string{"https://face.example/out.webp"})
	imgs, ok := body["images"].([]string)
	if !ok || len(imgs) != 1 || imgs[0] != "https://face.example/out.webp" {
		t.Fatalf("images=%#v", body["images"])
	}
	if _, ok := body["input_reference"]; ok {
		t.Fatal("input_reference should be absent")
	}
}

func TestRewriteJSONImageURLs_SingleInputReference(t *testing.T) {
	body := map[string]interface{}{
		"input_reference": "https://a.example/1.png",
	}
	rewriteJSONImageURLs(body, []string{"https://face.example/out.webp"})
	if body["input_reference"] != "https://face.example/out.webp" {
		t.Fatalf("input_reference=%v", body["input_reference"])
	}
	if _, ok := body["images"]; ok {
		t.Fatal("images should be absent for single input_reference")
	}
}

func TestHasJSONImages(t *testing.T) {
	if hasJSONImages(map[string]interface{}{"prompt": "x"}) {
		t.Fatal("expected no images")
	}
	if !hasJSONImages(map[string]interface{}{"images": []interface{}{"https://a.example/1.png"}}) {
		t.Fatal("expected images")
	}
}
