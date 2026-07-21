package megabyai

import (
	"bytes"
	"fmt"
	"image"
	"image/draw"
	_ "image/jpeg"
	_ "image/png"

	"github.com/KarpelesLab/gowebp"
	xdraw "golang.org/x/image/draw"
	_ "golang.org/x/image/webp"
)

const maxLongEdge = 1600
const webpQuality = 80

// preprocessToWebP decodes image bytes, downscales so the longest edge is at most
// maxLongEdge (never upscales), and encodes lossy WebP (~quality 80).
func preprocessToWebP(src []byte) ([]byte, error) {
	if len(src) == 0 {
		return nil, fmt.Errorf("empty image data")
	}
	img, _, err := image.Decode(bytes.NewReader(src))
	if err != nil {
		return nil, fmt.Errorf("decode image: %w", err)
	}
	img = resizeMaxLongEdge(img, maxLongEdge)

	var buf bytes.Buffer
	if err := gowebp.Encode(&buf, img, &gowebp.Options{
		Lossy:   true,
		Quality: webpQuality,
		Method:  4,
	}); err != nil {
		return nil, fmt.Errorf("encode webp: %w", err)
	}
	return buf.Bytes(), nil
}

func resizeMaxLongEdge(img image.Image, maxEdge int) image.Image {
	b := img.Bounds()
	w, h := b.Dx(), b.Dy()
	if w <= 0 || h <= 0 {
		return img
	}
	long := w
	if h > w {
		long = h
	}
	if long <= maxEdge {
		return img
	}
	scale := float64(maxEdge) / float64(long)
	nw := int(float64(w)*scale + 0.5)
	nh := int(float64(h)*scale + 0.5)
	if nw < 1 {
		nw = 1
	}
	if nh < 1 {
		nh = 1
	}
	dst := image.NewRGBA(image.Rect(0, 0, nw, nh))
	xdraw.CatmullRom.Scale(dst, dst.Bounds(), img, b, draw.Over, nil)
	return dst
}
