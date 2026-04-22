package service

import (
	"bytes"
	"errors"
	"image"
	"image/color"
	"image/color/palette"
	"image/gif"
	"image/jpeg"
	"image/png"
	"testing"

	"github.com/QuantumNous/new-api/setting"
	"github.com/stretchr/testify/require"
)

func TestApply_Disabled_ShortCircuitsAndReturnsOriginal(t *testing.T) {
	t.Parallel()

	raw := []byte("any bytes, never decoded because disabled")
	constraint := setting.ImageConstraint{Enabled: false}

	result, err := Apply(raw, "image/jpeg", constraint)
	require.NoError(t, err)
	require.NotNil(t, result)
	require.True(t, result.Info.Skipped)
	require.Equal(t, raw, result.Bytes)
	require.Equal(t, "image/jpeg", result.Mime)
}

// makeTestJPEG 构造指定尺寸的 JPEG，使用渐变避免被 JPEG 高压缩比秒杀，
// 便于测试出"文件大"的语义。quality 通常 85。
func makeTestJPEG(t *testing.T, width, height, quality int) []byte {
	t.Helper()
	img := image.NewRGBA(image.Rect(0, 0, width, height))
	for y := 0; y < height; y++ {
		for x := 0; x < width; x++ {
			img.Set(x, y, color.RGBA{
				R: uint8((x * 255) / max1(width)),
				G: uint8((y * 255) / max1(height)),
				B: uint8(((x + y) * 255) / max1(width+height)),
				A: 255,
			})
		}
	}
	var buf bytes.Buffer
	require.NoError(t, jpeg.Encode(&buf, img, &jpeg.Options{Quality: quality}))
	return buf.Bytes()
}

// makeTestPNG 构造 PNG。withAlpha=true 时使用半透明渐变（像素级非平凡 alpha）。
func makeTestPNG(t *testing.T, width, height int, withAlpha bool) []byte {
	t.Helper()
	img := image.NewRGBA(image.Rect(0, 0, width, height))
	for y := 0; y < height; y++ {
		for x := 0; x < width; x++ {
			a := uint8(255)
			if withAlpha {
				a = uint8((x * 255) / max1(width))
			}
			img.Set(x, y, color.RGBA{
				R: uint8((x * 255) / max1(width)),
				G: uint8((y * 255) / max1(height)),
				B: 128,
				A: a,
			})
		}
	}
	var buf bytes.Buffer
	require.NoError(t, png.Encode(&buf, img))
	return buf.Bytes()
}

func max1(v int) int {
	if v == 0 {
		return 1
	}
	return v
}

func TestApply_UnderThreshold_Skips(t *testing.T) {
	t.Parallel()

	raw := makeTestJPEG(t, 400, 300, 85)
	constraint := setting.ImageConstraint{
		Enabled:      true,
		MaxBytes:     5_000_000,
		MaxDim:       1568,
		QualitySteps: []int{85, 70, 55, 40},
	}

	result, err := Apply(raw, "image/jpeg", constraint)
	require.NoError(t, err)
	require.True(t, result.Info.Skipped, "small image should skip, got %+v", result.Info)
	require.Equal(t, raw, result.Bytes)
}

func TestApply_OverMaxDim_EntersCompressionPath(t *testing.T) {
	t.Parallel()

	// 图片字节本身很小（纯色小文件），但宽度远超 MaxDim
	raw := makeTestJPEG(t, 4000, 100, 85)
	constraint := setting.ImageConstraint{
		Enabled:      true,
		MaxBytes:     10_000_000, // 字节远未超
		MaxDim:       1568,
		QualitySteps: []int{85, 70, 55, 40},
	}

	result, err := Apply(raw, "image/jpeg", constraint)
	require.NoError(t, err)
	require.False(t, result.Info.Skipped, "image exceeding MaxDim must be resized, not skipped")
	require.True(t, result.Info.Resized)
}

func makeAnimatedGIF(t *testing.T, frames, widthPerFrame int) []byte {
	t.Helper()
	anim := &gif.GIF{LoopCount: 0}
	for i := 0; i < frames; i++ {
		paletted := image.NewPaletted(
			image.Rect(0, 0, widthPerFrame, widthPerFrame),
			palette.Plan9,
		)
		// 填充一个色块，确保每帧有非零字节
		for y := 0; y < widthPerFrame; y++ {
			for x := 0; x < widthPerFrame; x++ {
				paletted.Set(x, y, palette.Plan9[(i+x+y)%len(palette.Plan9)])
			}
		}
		anim.Image = append(anim.Image, paletted)
		anim.Delay = append(anim.Delay, 10)
	}
	var buf bytes.Buffer
	require.NoError(t, gif.EncodeAll(&buf, anim))
	return buf.Bytes()
}

func TestApply_AnimatedGIFOverThreshold_ReturnsError(t *testing.T) {
	t.Parallel()

	raw := makeAnimatedGIF(t, 5, 800) // 多帧大 GIF，易超阈值
	constraint := setting.ImageConstraint{
		Enabled:      true,
		MaxBytes:     1000,
		MaxDim:       1568,
		QualitySteps: []int{85, 70, 55, 40},
	}

	_, err := Apply(raw, "image/gif", constraint)
	require.Error(t, err)
	require.True(t, errors.Is(err, ErrAnimatedImageTooLarge), "want ErrAnimatedImageTooLarge, got %v", err)
}

// makeMinimalHEIC 构造最小合法 ISOBMFF 头：ftyp box with major_brand=heic。
// 足以让 detectHEIF 识别为 HEIC，但不是有效图像（不应被试图解码）。
func makeMinimalHEIC(t *testing.T) []byte {
	t.Helper()
	var buf bytes.Buffer
	// ftyp box: size=32, type=ftyp, major=heic, minor=0, compat=heic,mif1
	buf.Write([]byte{0, 0, 0, 32})
	buf.Write([]byte("ftyp"))
	buf.Write([]byte("heic"))
	buf.Write([]byte{0, 0, 0, 0})
	buf.Write([]byte("heicmif1"))
	// 追加一些填充让长度看起来合理
	buf.Write(make([]byte, 4*1024))
	return buf.Bytes()
}

func TestApply_HEIC_ReturnsErrHEICNotSupported(t *testing.T) {
	t.Parallel()

	raw := makeMinimalHEIC(t)
	constraint := setting.ImageConstraint{
		Enabled:      true,
		MaxBytes:     1000,
		MaxDim:       1568,
		QualitySteps: []int{85, 70, 55, 40},
	}

	_, err := Apply(raw, "image/heic", constraint)
	require.Error(t, err)
	require.True(t, errors.Is(err, ErrHEICNotSupported), "want ErrHEICNotSupported, got %v", err)
}

func TestApply_GarbageBytes_ReturnsErrCannotDecode(t *testing.T) {
	t.Parallel()

	// 8KB 随机字节，不是任何已知图像格式
	raw := bytes.Repeat([]byte{0xDE, 0xAD, 0xBE, 0xEF}, 2048)
	constraint := setting.ImageConstraint{
		Enabled:      true,
		MaxBytes:     1000,
		MaxDim:       1568,
		QualitySteps: []int{85, 70, 55, 40},
	}

	_, err := Apply(raw, "image/jpeg", constraint)
	require.Error(t, err)
	require.True(t, errors.Is(err, ErrCannotDecode), "want ErrCannotDecode, got %v", err)
}

func TestApply_LargeJPEG_ResizedToMaxDim(t *testing.T) {
	t.Parallel()

	raw := makeTestJPEG(t, 4000, 3000, 90)
	constraint := setting.ImageConstraint{
		Enabled:      true,
		MaxBytes:     3_750_000,
		MaxDim:       1568,
		QualitySteps: []int{85, 70, 55, 40},
	}

	result, err := Apply(raw, "image/jpeg", constraint)
	require.NoError(t, err)
	require.True(t, result.Info.Resized)
	require.LessOrEqual(t, result.Info.FinalSize, constraint.MaxBytes)

	// 反向解码验证尺寸 <= MaxDim
	cfg, _, err := image.DecodeConfig(bytes.NewReader(result.Bytes))
	require.NoError(t, err)
	require.LessOrEqual(t, cfg.Width, constraint.MaxDim)
	require.LessOrEqual(t, cfg.Height, constraint.MaxDim)
}
