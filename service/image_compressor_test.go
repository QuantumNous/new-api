package service

import (
	"bytes"
	"encoding/base64"
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

func TestApply_JPEG_QualityLadderIterates(t *testing.T) {
	t.Parallel()

	// 构造一张恰好 MaxDim 尺寸（跳过缩放）的图，使 q=85 超出 MaxBytes、q=70 满足。
	// 1568×1568: q=85 ≈ 70 KB，q=70 ≈ 45 KB；MaxBytes=65_000 介于两者之间。
	raw := makeTestJPEG(t, 1568, 1568, 95)
	constraint := setting.ImageConstraint{
		Enabled:      true,
		MaxBytes:     65_000, // q=85 超标，q=70 满足
		MaxDim:       1568,
		QualitySteps: []int{85, 70, 55, 40},
	}

	result, err := Apply(raw, "image/jpeg", constraint)
	require.NoError(t, err)
	require.LessOrEqual(t, result.Info.FinalSize, constraint.MaxBytes)
	require.Contains(t, []int{85, 70, 55, 40}, result.Info.QualityUsed)
}

func TestApply_PNGWithoutAlpha_ConvertsToJPEG(t *testing.T) {
	t.Parallel()

	raw := makeTestPNG(t, 2000, 2000, false) // withAlpha=false
	constraint := setting.ImageConstraint{
		Enabled:       true,
		MaxBytes:      500_000,
		MaxDim:        1568,
		QualitySteps:  []int{85, 70, 55, 40},
		PreserveAlpha: true, // 即便 PreserveAlpha=true，没 alpha 也应转 JPEG
	}

	result, err := Apply(raw, "image/png", constraint)
	require.NoError(t, err)
	require.True(t, result.Info.FormatChanged)
	require.Equal(t, "image/jpeg", result.Mime)
	require.LessOrEqual(t, result.Info.FinalSize, constraint.MaxBytes)
}

func TestApply_PNGWithAlpha_NoPreserve_FlattensToJPEG(t *testing.T) {
	t.Parallel()

	raw := makeTestPNG(t, 2000, 2000, true) // withAlpha=true
	constraint := setting.ImageConstraint{
		Enabled:       true,
		MaxBytes:      500_000,
		MaxDim:        1568,
		QualitySteps:  []int{85, 70, 55, 40},
		PreserveAlpha: false,
	}

	result, err := Apply(raw, "image/png", constraint)
	require.NoError(t, err)
	require.True(t, result.Info.FormatChanged)
	require.Equal(t, "image/jpeg", result.Mime)

	// 验证输出 JPEG 不含 alpha 信息（所有像素应 opaque）
	out, _, err := image.Decode(bytes.NewReader(result.Bytes))
	require.NoError(t, err)
	require.False(t, imageHasAlpha(out), "flattened output should be opaque")

	require.NotEmpty(t, result.Info.Warnings, "alpha-loss path should record a warning")
	require.Contains(t, result.Info.Warnings[0], "alpha")
}

func TestApply_PNGWithAlpha_Preserve_StaysPNGResizedOnly(t *testing.T) {
	t.Parallel()

	raw := makeTestPNG(t, 3000, 3000, true)
	constraint := setting.ImageConstraint{
		Enabled:       true,
		MaxBytes:      10_000_000, // 放宽字节阈值，确保缩放足够
		MaxDim:        1568,
		QualitySteps:  []int{85, 70, 55, 40},
		PreserveAlpha: true,
	}

	result, err := Apply(raw, "image/png", constraint)
	require.NoError(t, err)
	require.Equal(t, "image/png", result.Mime)
	require.False(t, result.Info.FormatChanged)
	require.True(t, result.Info.Resized)

	// 验证输出尺寸 <= MaxDim 且仍是 PNG（有 alpha）
	cfg, format, err := image.DecodeConfig(bytes.NewReader(result.Bytes))
	require.NoError(t, err)
	require.Equal(t, "png", format)
	require.LessOrEqual(t, cfg.Width, constraint.MaxDim)
	require.LessOrEqual(t, cfg.Height, constraint.MaxDim)
}

// tinyLossyWebPBase64 是一个 1x1 lossy WebP 文件（约 26 字节），用于验证
// WebP 解码分派与 JPEG 输出编码。
const tinyLossyWebPBase64 = "UklGRhoAAABXRUJQVlA4TA0AAAAvAAAAEAcQERGIiP4HAA=="

func TestApply_WebP_DecodesAndEncodesAsJPEG(t *testing.T) {
	t.Parallel()

	raw, err := base64.StdEncoding.DecodeString(tinyLossyWebPBase64)
	require.NoError(t, err)

	// WebP 下通过 MaxDim=0 强制进入压缩路径（1×1 图宽度 1 > MaxDim 0）。
	// MaxBytes 宽松（5 MB），确保 JPEG 编码结果（~600 B）不会触发重试失败。
	constraint := setting.ImageConstraint{
		Enabled:      true,
		MaxBytes:     5_000_000,
		MaxDim:       0,
		QualitySteps: []int{85, 70, 55, 40},
	}

	result, err := Apply(raw, "image/webp", constraint)
	require.NoError(t, err)
	require.Equal(t, "image/jpeg", result.Mime)
	require.True(t, result.Info.FormatChanged)
}

func TestApply_JPEG_ImpossibleToCompress_ReturnsErrTooLarge(t *testing.T) {
	t.Parallel()

	raw := makeTestJPEG(t, 2000, 2000, 95)
	constraint := setting.ImageConstraint{
		Enabled:      true,
		MaxBytes:     500, // 极端小，任何合理质量都打不住
		MaxDim:       1568,
		QualitySteps: []int{85, 70, 55, 40},
	}

	_, err := Apply(raw, "image/jpeg", constraint)
	require.Error(t, err)
	require.True(t, errors.Is(err, ErrImageTooLargeAfterCompression),
		"want ErrImageTooLargeAfterCompression, got %v", err)
}

func TestApply_JPEG_FitsAfterRetryScale(t *testing.T) {
	t.Parallel()

	raw := makeTestJPEG(t, 3000, 3000, 92)
	constraint := setting.ImageConstraint{
		Enabled:      true,
		MaxBytes:     120_000, // 质量档可能够呛，第一轮尺寸缩了之后仍需 retry
		MaxDim:       1568,
		QualitySteps: []int{85, 70, 55, 40},
	}

	result, err := Apply(raw, "image/jpeg", constraint)
	require.NoError(t, err)
	require.LessOrEqual(t, result.Info.FinalSize, constraint.MaxBytes)
}

func TestApply_DecoderPanic_FallsBackToOriginal(t *testing.T) {
	// 不 Parallel —— 需要改包级变量
	original := decodeImage
	decodeImage = func(raw []byte) (image.Image, string, error) {
		panic("simulated decoder panic")
	}
	t.Cleanup(func() { decodeImage = original })

	raw := makeTestJPEG(t, 2000, 2000, 85)
	constraint := setting.ImageConstraint{
		Enabled:      true,
		MaxBytes:     100, // 强制进入压缩路径
		MaxDim:       1568,
		QualitySteps: []int{85, 70, 55, 40},
	}

	result, err := Apply(raw, "image/jpeg", constraint)
	require.NoError(t, err, "panic must be recovered, not propagated")
	require.NotNil(t, result)
	require.True(t, result.Info.Skipped, "panic fallback should mark Skipped=true")
	require.Equal(t, raw, result.Bytes)
	require.NotEmpty(t, result.Info.Warnings, "panic fallback should record a warning")
}
