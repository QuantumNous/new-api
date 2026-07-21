package megabyai

import (
	"bytes"
	"image"
	"image/color"
	"image/png"
	"testing"

	"github.com/QuantumNous/new-api/dto"
	_ "golang.org/x/image/webp"
)

func TestMegabyaiFacePassEnabledDefaultOn(t *testing.T) {
	if !megabyaiFacePassEnabled(dto.ChannelOtherSettings{}) {
		t.Fatal("nil should default to on")
	}
	off := false
	if megabyaiFacePassEnabled(dto.ChannelOtherSettings{MegabyaiFacePass: &off}) {
		t.Fatal("explicit false should be off")
	}
	on := true
	if !megabyaiFacePassEnabled(dto.ChannelOtherSettings{MegabyaiFacePass: &on}) {
		t.Fatal("explicit true should be on")
	}
}

func TestMegabyaiFaceSingleEyeAndSizeDefaults(t *testing.T) {
	if !megabyaiFaceSingleEye(dto.ChannelOtherSettings{}) {
		t.Fatal("singleEye nil should default true")
	}
	off := false
	if megabyaiFaceSingleEye(dto.ChannelOtherSettings{MegabyaiFaceSingleEye: &off}) {
		t.Fatal("singleEye false should be false")
	}
	if megabyaiFaceSize(dto.ChannelOtherSettings{}) != 5 {
		t.Fatal("size nil should default 5")
	}
	n := 10
	if megabyaiFaceSize(dto.ChannelOtherSettings{MegabyaiFaceSize: &n}) != 10 {
		t.Fatal("size 10 should stay 10")
	}
	low := 0
	if megabyaiFaceSize(dto.ChannelOtherSettings{MegabyaiFaceSize: &low}) != 1 {
		t.Fatal("size 0 should clamp to 1")
	}
	high := 99
	if megabyaiFaceSize(dto.ChannelOtherSettings{MegabyaiFaceSize: &high}) != 10 {
		t.Fatal("size 99 should clamp to 10")
	}
}

func TestResizeMaxLongEdgeDownscales(t *testing.T) {
	img := image.NewRGBA(image.Rect(0, 0, 3200, 1800))
	for y := 0; y < 1800; y++ {
		for x := 0; x < 3200; x++ {
			img.Set(x, y, color.RGBA{R: 200, G: 100, B: 50, A: 255})
		}
	}
	out := resizeMaxLongEdge(img, 1600)
	b := out.Bounds()
	if b.Dx() != 1600 || b.Dy() != 900 {
		t.Fatalf("got %dx%d, want 1600x900", b.Dx(), b.Dy())
	}
}

func TestResizeMaxLongEdgeNoUpscale(t *testing.T) {
	img := image.NewRGBA(image.Rect(0, 0, 800, 600))
	out := resizeMaxLongEdge(img, 1600)
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
	webpBytes, err := preprocessToWebP(pngBuf.Bytes())
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

func TestCollectImageURLs(t *testing.T) {
	body := map[string]interface{}{
		"images": []interface{}{"https://a.example/1.png", "https://a.example/1.png"},
		"image":  "https://b.example/2.jpg",
	}
	urls := collectImageURLs(body)
	if len(urls) != 2 {
		t.Fatalf("urls=%v", urls)
	}
}
