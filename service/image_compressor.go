package service

import (
	"bytes"
	"errors"
	"fmt"
	"image"
	imagedraw "image/draw"
	"image/gif"
	"image/jpeg"
	"image/png"

	"golang.org/x/image/draw"
	_ "golang.org/x/image/webp"

	"github.com/QuantumNous/new-api/setting"
)

// CompressResult 是 Apply 的返回值。Bytes 为最终编码字节（可能就是输入原字节）；
// Info 描述发生了什么。
type CompressResult struct {
	Bytes []byte
	Mime  string
	Info  CompressionInfo
}

// CompressionInfo 记录压缩路径上的决策与数值，便于日志与测试断言。
type CompressionInfo struct {
	Skipped       bool
	Resized       bool
	OriginalSize  int64
	FinalSize     int64
	QualityUsed   int
	FormatChanged bool
	Warnings      []string
}

// Apply 对单张静态图片执行"缩放 + 降质量"级联压缩。
// 约束未启用或图像已在阈值内时，直接返回原字节 (Skipped=true)。
func Apply(raw []byte, mime string, c setting.ImageConstraint) (result *CompressResult, err error) {
	defer func() {
		if r := recover(); r != nil {
			result = &CompressResult{
				Bytes: raw,
				Mime:  mime,
				Info: CompressionInfo{
					Skipped:      true,
					OriginalSize: int64(len(raw)),
					FinalSize:    int64(len(raw)),
					Warnings: []string{
						fmt.Sprintf("image compression panicked and was bypassed: %v", r),
					},
				},
			}
			err = nil
		}
	}()

	origSize := int64(len(raw))
	if !c.Enabled {
		return skipped(raw, mime, origSize), nil
	}

	// 运维失误防护：MaxDim/QualitySteps 非法时，把约束视同未启用而非让流水线产出退化结果。
	if c.MaxDim <= 0 || len(c.QualitySteps) == 0 {
		return skipped(raw, mime, origSize), nil
	}

	// 低成本尺寸探测：DecodeConfig 仅读文件头，不展开像素。
	cfg, _, cfgErr := image.DecodeConfig(bytes.NewReader(raw))
	widthOK, heightOK := true, true
	if cfgErr == nil {
		widthOK = cfg.Width <= c.MaxDim
		heightOK = cfg.Height <= c.MaxDim
	}
	if origSize <= c.MaxBytes && widthOK && heightOK {
		return skipped(raw, mime, origSize), nil
	}

	if isAnimated(raw, mime) {
		return nil, ErrAnimatedImageTooLarge
	}

	if mime == "image/heic" || mime == "image/heif" || detectHEICMagic(raw) {
		return nil, ErrHEICNotSupported
	}

	img, format, err := decodeImage(raw)
	if err != nil {
		return nil, err
	}
	resized, didResize := resizeIfNeeded(img, c.MaxDim)

	switch format {
	case "jpeg":
		return runJPEGPath(resized, didResize, origSize, c, false, nil)
	case "png":
		hasAlpha := imageHasAlpha(resized)
		if hasAlpha && c.PreserveAlpha {
			encoded, _, _, perr := compressPNGNoLossWithRetry(resized, c.MaxBytes)
			if perr != nil {
				return nil, perr
			}
			return &CompressResult{
				Bytes: encoded,
				Mime:  "image/png",
				Info: CompressionInfo{
					Resized:      didResize,
					OriginalSize: origSize,
					FinalSize:    int64(len(encoded)),
				},
			}, nil
		}
		target := resized
		var warnings []string
		if hasAlpha {
			target = flattenToWhiteBackground(resized)
			warnings = append(warnings, "alpha channel flattened to white background (PNG → JPEG)")
		}
		return runJPEGPath(target, didResize, origSize, c, true, warnings)
	case "webp":
		hasAlpha := imageHasAlpha(resized)
		if hasAlpha && c.PreserveAlpha {
			encoded, _, _, perr := compressPNGNoLossWithRetry(resized, c.MaxBytes)
			if perr != nil {
				return nil, perr
			}
			return &CompressResult{
				Bytes: encoded,
				Mime:  "image/png",
				Info: CompressionInfo{
					Resized:       didResize,
					OriginalSize:  origSize,
					FinalSize:     int64(len(encoded)),
					FormatChanged: true,
				},
			}, nil
		}
		target := resized
		var warnings []string
		if hasAlpha {
			target = flattenToWhiteBackground(resized)
			warnings = append(warnings, "alpha channel flattened to white background (WebP → JPEG)")
		}
		return runJPEGPath(target, didResize, origSize, c, true, warnings)
	default:
		// GIF/其他静态格式 —— 当前不支持静态 GIF 重编码，返回解码错误
		return nil, ErrCannotDecode
	}
}

func skipped(raw []byte, mime string, origSize int64) *CompressResult {
	return &CompressResult{
		Bytes: raw,
		Mime:  mime,
		Info: CompressionInfo{
			Skipped:      true,
			OriginalSize: origSize,
			FinalSize:    origSize,
		},
	}
}

var (
	ErrAnimatedImageTooLarge         = errors.New("animated image exceeds channel limit and gateway does not recompress animated images")
	ErrHEICNotSupported              = errors.New("HEIC/HEIF image exceeds channel limit; convert to JPEG/PNG before upload")
	ErrCannotDecode                  = errors.New("cannot decode image bytes")
	ErrImageTooLargeAfterCompression = errors.New("image cannot be compressed below channel limit")
)

// isAnimated 根据 MIME 与字节内容判定是否为动图。
// 不解码完整像素，只做"帧数/标志位"级别的轻检查。
func isAnimated(raw []byte, mime string) bool {
	switch mime {
	case "image/gif":
		g, err := gif.DecodeAll(bytes.NewReader(raw))
		if err != nil {
			return false
		}
		return len(g.Image) > 1
	case "image/apng":
		return true
	case "image/png":
		// APNG 在 IHDR 之后、IDAT 之前会有一个 acTL chunk
		return bytes.Contains(raw, []byte("acTL"))
	case "image/webp":
		// Animated WebP: VP8X chunk with bit 1 (animation flag) set.
		// 最简检测：文件内含 "ANIM" chunk。
		return bytes.Contains(raw, []byte("ANIM"))
	}
	return false
}

// detectHEICMagic 检查 ISOBMFF ftyp box，判断是否为 HEIC/HEIF。
// 与 file_service.go 的 detectHEIF 逻辑一致，这里独立一份以避免跨模块依赖。
func detectHEICMagic(raw []byte) bool {
	if len(raw) < 12 {
		return false
	}
	if string(raw[4:8]) != "ftyp" {
		return false
	}
	brand := string(raw[8:12])
	switch brand {
	case "heic", "heix", "hevc", "hevx", "heim", "heis",
		"mif1", "msf1":
		return true
	}
	return false
}

// decodeImage 尝试解码为 image.Image。成功时返回图像、源格式名（"jpeg"/"png"/"gif"/"webp"）。
// 失败时返回 ErrCannotDecode 包装。
// 使用包级变量以便测试注入 panic（见 Task 14）。
var decodeImage = func(raw []byte) (image.Image, string, error) {
	img, format, err := image.Decode(bytes.NewReader(raw))
	if err != nil {
		return nil, "", errors.Join(ErrCannotDecode, err)
	}
	return img, format, nil
}

// resizeIfNeeded 把图像最长边约束到 maxDim（等比缩放）。返回新图与是否发生了缩放。
func resizeIfNeeded(img image.Image, maxDim int) (image.Image, bool) {
	b := img.Bounds()
	w, h := b.Dx(), b.Dy()
	longest := w
	if h > longest {
		longest = h
	}
	if longest <= maxDim {
		return img, false
	}
	scale := float64(maxDim) / float64(longest)
	newW := int(float64(w) * scale)
	newH := int(float64(h) * scale)
	if newW < 1 {
		newW = 1
	}
	if newH < 1 {
		newH = 1
	}
	dst := image.NewRGBA(image.Rect(0, 0, newW, newH))
	draw.CatmullRom.Scale(dst, dst.Bounds(), img, b, draw.Over, nil)
	return dst, true
}

// encodeJPEG 以指定质量编码为 JPEG 字节。
func encodeJPEG(img image.Image, quality int) ([]byte, error) {
	var buf bytes.Buffer
	if err := jpeg.Encode(&buf, img, &jpeg.Options{Quality: quality}); err != nil {
		return nil, err
	}
	return buf.Bytes(), nil
}

// encodePNG 使用 BestCompression 编码 PNG。
func encodePNG(img image.Image) ([]byte, error) {
	enc := png.Encoder{CompressionLevel: png.BestCompression}
	var buf bytes.Buffer
	if err := enc.Encode(&buf, img); err != nil {
		return nil, err
	}
	return buf.Bytes(), nil
}

// encodeJPEGWithLadder 依次尝试 QualitySteps，返回第一个 <= maxBytes 的编码结果。
// 全部超标时返回最后一次的结果与 didExhaust=true。
func encodeJPEGWithLadder(img image.Image, steps []int, maxBytes int64) (bytes []byte, quality int, didExhaust bool, err error) {
	var lastEncoded []byte
	var lastQ int
	for _, q := range steps {
		enc, encErr := encodeJPEG(img, q)
		if encErr != nil {
			return nil, 0, false, encErr
		}
		if int64(len(enc)) <= maxBytes {
			return enc, q, false, nil
		}
		lastEncoded = enc
		lastQ = q
	}
	return lastEncoded, lastQ, true, nil
}

// compressJPEGLadderWithRetry 在给定初始 img 上，尝试质量梯度；
// 失败则把图缩到 0.75×，最多重试 2 轮。返回 Err 或成功结果。
func compressJPEGLadderWithRetry(
	initial image.Image,
	steps []int,
	maxBytes int64,
) (encoded []byte, quality int, finalW int, finalH int, retries int, err error) {
	current := initial
	for attempt := 0; attempt <= 2; attempt++ {
		enc, q, exhausted, encErr := encodeJPEGWithLadder(current, steps, maxBytes)
		if encErr != nil {
			return nil, 0, 0, 0, attempt, encErr
		}
		if !exhausted {
			b := current.Bounds()
			return enc, q, b.Dx(), b.Dy(), attempt, nil
		}
		// 缩 0.75× 再来
		b := current.Bounds()
		newW := int(float64(b.Dx()) * 0.75)
		newH := int(float64(b.Dy()) * 0.75)
		if newW < 1 || newH < 1 {
			break
		}
		smaller := image.NewRGBA(image.Rect(0, 0, newW, newH))
		draw.CatmullRom.Scale(smaller, smaller.Bounds(), current, b, draw.Over, nil)
		current = smaller
	}
	b := current.Bounds()
	return nil, 0, b.Dx(), b.Dy(), 2, ErrImageTooLargeAfterCompression
}

// compressPNGNoLossWithRetry 处理 PNG alpha 保留路径：尺寸缩到 0.75×，最多 2 轮。
func compressPNGNoLossWithRetry(
	initial image.Image,
	maxBytes int64,
) (encoded []byte, finalW int, finalH int, err error) {
	current := initial
	for attempt := 0; attempt <= 2; attempt++ {
		enc, encErr := encodePNG(current)
		if encErr != nil {
			return nil, 0, 0, encErr
		}
		if int64(len(enc)) <= maxBytes {
			b := current.Bounds()
			return enc, b.Dx(), b.Dy(), nil
		}
		b := current.Bounds()
		newW := int(float64(b.Dx()) * 0.75)
		newH := int(float64(b.Dy()) * 0.75)
		if newW < 1 || newH < 1 {
			break
		}
		smaller := image.NewRGBA(image.Rect(0, 0, newW, newH))
		draw.CatmullRom.Scale(smaller, smaller.Bounds(), current, b, draw.Over, nil)
		current = smaller
	}
	return nil, 0, 0, ErrImageTooLargeAfterCompression
}

// runJPEGPath 是 JPEG 输出分支的共用通路。 formatChanged 描述本次是否发生
// 格式转换（源即 JPEG 传 false；PNG→JPEG / WebP→JPEG 传 true）。
// warnings 为空切片或 nil 表示无告警。
func runJPEGPath(
	img image.Image,
	didResize bool,
	origSize int64,
	c setting.ImageConstraint,
	formatChanged bool,
	warnings []string,
) (*CompressResult, error) {
	encoded, q, _, _, _, err := compressJPEGLadderWithRetry(img, c.QualitySteps, c.MaxBytes)
	if err != nil {
		return nil, err
	}
	return &CompressResult{
		Bytes: encoded,
		Mime:  "image/jpeg",
		Info: CompressionInfo{
			Resized:       didResize,
			OriginalSize:  origSize,
			FinalSize:     int64(len(encoded)),
			QualityUsed:   q,
			FormatChanged: formatChanged,
			Warnings:      warnings,
		},
	}, nil
}

// imageHasAlpha 判断图像是否包含非 opaque 像素。
// 对支持 Opaque() 的类型（包括 *image.RGBA、*image.NRGBA）先走 O(1) 快速路径；
// 否则退化为按像素扫描。
func imageHasAlpha(img image.Image) bool {
	type opaqueChecker interface {
		Opaque() bool
	}
	if o, ok := img.(opaqueChecker); ok {
		return !o.Opaque()
	}
	b := img.Bounds()
	for y := b.Min.Y; y < b.Max.Y; y++ {
		for x := b.Min.X; x < b.Max.X; x++ {
			_, _, _, a := img.At(x, y).RGBA()
			if a < 0xFFFF {
				return true
			}
		}
	}
	return false
}

// flattenToWhiteBackground 把带 alpha 的图像复合到白色底，返回不含 alpha 的 RGBA。
func flattenToWhiteBackground(src image.Image) image.Image {
	b := src.Bounds()
	dst := image.NewRGBA(b)
	white := image.NewUniform(image.White)
	imagedraw.Draw(dst, b, white, image.Point{}, imagedraw.Src)
	imagedraw.Draw(dst, b, src, b.Min, imagedraw.Over)
	return dst
}
