package service

import (
	"bytes"
	"errors"
	"image"
	imagedraw "image/draw"
	"image/gif"
	"image/jpeg"
	_ "image/png"

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
}

// Apply 对单张静态图片执行"缩放 + 降质量"级联压缩。
// 约束未启用或图像已在阈值内时，直接返回原字节 (Skipped=true)。
func Apply(raw []byte, mime string, c setting.ImageConstraint) (*CompressResult, error) {
	origSize := int64(len(raw))
	if !c.Enabled {
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

	// 本 Task 只覆盖"JPEG 输入 → 质量梯度编码"路径；PNG/WebP/alpha 等分支
	// 将在 Task 9-12 逐步扩展。
	if format == "jpeg" {
		encoded, q, exhausted, encErr := encodeJPEGWithLadder(resized, c.QualitySteps, c.MaxBytes)
		if encErr != nil {
			return nil, encErr
		}
		if !exhausted {
			return &CompressResult{
				Bytes: encoded,
				Mime:  "image/jpeg",
				Info: CompressionInfo{
					Resized:      didResize,
					OriginalSize: origSize,
					FinalSize:    int64(len(encoded)),
					QualityUsed:  q,
				},
			}, nil
		}
		// 所有质量档仍超标 —— 后续 Task 13 补重试缩尺寸；暂返回最后一次结果
		return &CompressResult{
			Bytes: encoded,
			Mime:  "image/jpeg",
			Info: CompressionInfo{
				Resized:      didResize,
				OriginalSize: origSize,
				FinalSize:    int64(len(encoded)),
				QualityUsed:  q,
			},
		}, nil
	}

	if format == "png" {
		hasAlpha := imageHasAlpha(resized)
		if !hasAlpha || !c.PreserveAlpha {
			// 无 alpha 或允许丢 alpha —— 转 JPEG
			target := resized
			if hasAlpha {
				target = flattenToWhiteBackground(resized)
				// Task 10 进一步添加 WARN 日志
			}
			encoded, q, exhausted, encErr := encodeJPEGWithLadder(target, c.QualitySteps, c.MaxBytes)
			if encErr != nil {
				return nil, encErr
			}
			if !exhausted {
				return &CompressResult{
					Bytes: encoded,
					Mime:  "image/jpeg",
					Info: CompressionInfo{
						Resized:       didResize,
						OriginalSize:  origSize,
						FinalSize:     int64(len(encoded)),
						QualityUsed:   q,
						FormatChanged: true,
					},
				}, nil
			}
			return &CompressResult{
				Bytes: encoded,
				Mime:  "image/jpeg",
				Info: CompressionInfo{
					Resized:       didResize,
					OriginalSize:  origSize,
					FinalSize:     int64(len(encoded)),
					QualityUsed:   q,
					FormatChanged: true,
				},
			}, nil
		}
		// PNG + alpha + PreserveAlpha —— Task 11 覆盖
	}

	// 其余格式 —— 暂返回原字节。Task 9-12 覆盖 PNG/WebP。
	return &CompressResult{
		Bytes: raw,
		Mime:  mime,
		Info: CompressionInfo{
			Resized:      didResize,
			OriginalSize: origSize,
			FinalSize:    origSize,
		},
	}, nil
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
	ErrAnimatedImageTooLarge = errors.New("animated image exceeds channel limit and gateway does not recompress animated images")
	ErrHEICNotSupported      = errors.New("HEIC/HEIF image exceeds channel limit; convert to JPEG/PNG before upload")
	ErrCannotDecode          = errors.New("cannot decode image bytes")
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
