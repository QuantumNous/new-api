package facepass

import (
	"bytes"
	"image"
	"image/color"
	"image/png"
	"testing"

	_ "golang.org/x/image/webp"
)

func TestBoolDefaultTrue(t *testing.T) {
	if !BoolDefaultTrue(nil) {
		t.Fatal("nil should default true")
	}
	off := false
	if BoolDefaultTrue(&off) {
		t.Fatal("false should be false")
	}
	on := true
	if !BoolDefaultTrue(&on) {
		t.Fatal("true should be true")
	}
}

func TestClampSize(t *testing.T) {
	if ClampSize(nil) != 5 {
		t.Fatal("nil => 5")
	}
	n := 10
	if ClampSize(&n) != 10 {
		t.Fatal("10 stays")
	}
	low := 0
	if ClampSize(&low) != 1 {
		t.Fatal("0 => 1")
	}
	high := 99
	if ClampSize(&high) != 10 {
		t.Fatal("99 => 10")
	}
}

func TestCollectImageURLs(t *testing.T) {
	body := map[string]interface{}{
		"images": []interface{}{"https://a.example/1.png", "https://a.example/1.png"},
		"image":  "https://b.example/2.jpg",
	}
	urls := CollectImageURLs(body, []string{"images", "image"})
	if len(urls) != 2 {
		t.Fatalf("urls=%v", urls)
	}
}

func TestResizeMaxLongEdgeDownscales(t *testing.T) {
	img := image.NewRGBA(image.Rect(0, 0, 3200, 1800))
	for y := 0; y < 1800; y++ {
		for x := 0; x < 3200; x++ {
			img.Set(x, y, color.RGBA{R: 200, G: 100, B: 50, A: 255})
		}
	}
	out := ResizeMaxLongEdge(img, 1600)
	b := out.Bounds()
	if b.Dx() != 1600 || b.Dy() != 900 {
		t.Fatalf("got %dx%d, want 1600x900", b.Dx(), b.Dy())
	}
}

func TestResizeMaxLongEdgeNoUpscale(t *testing.T) {
	img := image.NewRGBA(image.Rect(0, 0, 800, 600))
	out := ResizeMaxLongEdge(img, 1600)
	if out.Bounds().Dx() != 800 || out.Bounds().Dy() != 600 {
		t.Fatalf("should not upscale, got %v", out.Bounds())
	}
}

func TestPreprocessToWebP(t *testing.T) {
	img := image.NewRGBA(image.Rect(0, 0, 64, 48))
	var pngBuf bytes.Buffer
	if err := png.Encode(&pngBuf, img); err != nil {
		t.Fatal(err)
	}
	webpBytes, err := PreprocessToWebP(pngBuf.Bytes())
	if err != nil {
		t.Fatal(err)
	}
	if len(webpBytes) < 20 {
		t.Fatalf("webp too small: %d", len(webpBytes))
	}
	decoded, format, err := image.Decode(bytes.NewReader(webpBytes))
	if err != nil {
		t.Fatal(err)
	}
	if format != "webp" {
		t.Fatalf("format=%q", format)
	}
	if decoded.Bounds().Dx() != 64 || decoded.Bounds().Dy() != 48 {
		t.Fatalf("decoded size %v", decoded.Bounds())
	}
}
