package service

import (
	"bytes"
	"encoding/base64"
	"image"
	"image/color"
	"image/png"
	"math/rand"
	"strings"
	"testing"
)

func noisyPNGDataURL(t *testing.T, w, h int, alpha uint8) string {
	t.Helper()
	img := image.NewRGBA(image.Rect(0, 0, w, h))
	rnd := rand.New(rand.NewSource(42))
	for y := 0; y < h; y++ {
		for x := 0; x < w; x++ {
			img.Set(x, y, color.RGBA{R: uint8(rnd.Intn(256)), G: uint8(rnd.Intn(256)), B: uint8(rnd.Intn(256)), A: alpha})
		}
	}
	var buf bytes.Buffer
	if err := png.Encode(&buf, img); err != nil {
		t.Fatal(err)
	}
	return "data:image/png;base64," + base64.StdEncoding.EncodeToString(buf.Bytes())
}

func TestCompressImageDataURL(t *testing.T) {
	dataURL := noisyPNGDataURL(t, 2000, 1500, 255)
	compressed, err := CompressImageDataURL(dataURL)
	if err != nil {
		t.Fatalf("CompressImageDataURL error: %v", err)
	}
	if !strings.HasPrefix(compressed, "data:image/jpeg;base64,") {
		t.Fatalf("expected jpeg data url, got prefix: %s", compressed[:40])
	}
	if len(compressed) >= len(dataURL) {
		t.Fatalf("expected compressed smaller: before=%d after=%d", len(dataURL), len(compressed))
	}
}

func TestCompressImageDataURLSmallImageSkipped(t *testing.T) {
	img := image.NewRGBA(image.Rect(0, 0, 64, 64))
	for y := 0; y < 64; y++ {
		for x := 0; x < 64; x++ {
			img.Set(x, y, color.RGBA{R: 200, G: 100, B: 50, A: 255})
		}
	}
	var buf bytes.Buffer
	if err := png.Encode(&buf, img); err != nil {
		t.Fatal(err)
	}
	dataURL := "data:image/png;base64," + base64.StdEncoding.EncodeToString(buf.Bytes())
	if _, err := CompressImageDataURL(dataURL); err == nil {
		t.Fatal("expected error for image that cannot be made smaller")
	}
}

func TestCompressImageDataURLTransparentPNG(t *testing.T) {
	dataURL := noisyPNGDataURL(t, 1200, 800, 200)
	compressed, err := CompressImageDataURL(dataURL)
	if err != nil {
		t.Fatalf("CompressImageDataURL error: %v", err)
	}
	if len(compressed) >= len(dataURL) {
		t.Fatalf("expected compressed smaller: before=%d after=%d", len(dataURL), len(compressed))
	}
}
