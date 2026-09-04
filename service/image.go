package service

import (
	"bytes"
	"encoding/base64"
	"errors"
	"fmt"
	"image"
	"image/color"
	"image/draw"
	_ "image/gif"
	"image/jpeg"
	_ "image/png"
	"io"
	"net/http"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"

	ximagedraw "golang.org/x/image/draw"
	"golang.org/x/image/webp"
)

// return image.Config, format, clean base64 string, error
func DecodeBase64ImageData(base64String string) (image.Config, string, string, error) {
	// 去除base64数据的URL前缀（如果有）
	if idx := strings.Index(base64String, ","); idx != -1 {
		base64String = base64String[idx+1:]
	}

	if len(base64String) == 0 {
		return image.Config{}, "", "", errors.New("base64 string is empty")
	}

	// 将base64字符串解码为字节切片
	decodedData, err := base64.StdEncoding.DecodeString(base64String)
	if err != nil {
		fmt.Println("Error: Failed to decode base64 string")
		return image.Config{}, "", "", fmt.Errorf("failed to decode base64 string: %s", err.Error())
	}

	// 创建一个bytes.Buffer用于存储解码后的数据
	reader := bytes.NewReader(decodedData)
	config, format, err := getImageConfig(reader)
	return config, format, base64String, err
}

func DecodeBase64FileData(base64String string) (string, string, error) {
	var mimeType string
	var idx int
	idx = strings.Index(base64String, ",")
	if idx == -1 {
		_, file_type, base64, err := DecodeBase64ImageData(base64String)
		return "image/" + file_type, base64, err
	}
	mimeType = base64String[:idx]
	base64String = base64String[idx+1:]
	idx = strings.Index(mimeType, ";")
	if idx == -1 {
		_, file_type, base64, err := DecodeBase64ImageData(base64String)
		return "image/" + file_type, base64, err
	}
	mimeType = mimeType[:idx]
	idx = strings.Index(mimeType, ":")
	if idx == -1 {
		_, file_type, base64, err := DecodeBase64ImageData(base64String)
		return "image/" + file_type, base64, err
	}
	mimeType = mimeType[idx+1:]
	return mimeType, base64String, nil
}

// GetImageFromUrl 获取图片的类型和base64编码的数据
func GetImageFromUrl(url string) (mimeType string, data string, err error) {
	resp, err := DoDownloadRequest(url)
	if err != nil {
		return "", "", fmt.Errorf("failed to download image: %w", err)
	}
	defer resp.Body.Close()

	// Check HTTP status code
	if resp.StatusCode != http.StatusOK {
		return "", "", fmt.Errorf("failed to download image: HTTP %d", resp.StatusCode)
	}

	contentType := resp.Header.Get("Content-Type")
	if contentType != "application/octet-stream" && !strings.HasPrefix(contentType, "image/") {
		return "", "", fmt.Errorf("invalid content type: %s, required image/*", contentType)
	}
	maxImageSize := int64(constant.MaxFileDownloadMB * 1024 * 1024)

	// Check Content-Length if available
	if resp.ContentLength > maxImageSize {
		return "", "", fmt.Errorf("image size %d exceeds maximum allowed size of %d bytes", resp.ContentLength, maxImageSize)
	}

	// Use LimitReader to prevent reading oversized images
	limitReader := io.LimitReader(resp.Body, maxImageSize)
	buffer := &bytes.Buffer{}

	written, err := io.Copy(buffer, limitReader)
	if err != nil {
		return "", "", fmt.Errorf("failed to read image data: %w", err)
	}
	if written >= maxImageSize {
		return "", "", fmt.Errorf("image size exceeds maximum allowed size of %d bytes", maxImageSize)
	}

	data = base64.StdEncoding.EncodeToString(buffer.Bytes())
	mimeType = contentType

	// Handle application/octet-stream type
	if mimeType == "application/octet-stream" {
		_, format, _, err := DecodeBase64ImageData(data)
		if err != nil {
			return "", "", err
		}
		mimeType = "image/" + format
	}

	return mimeType, data, nil
}

func DecodeUrlImageData(imageUrl string) (image.Config, string, error) {
	response, err := DoDownloadRequest(imageUrl)
	if err != nil {
		common.SysLog(fmt.Sprintf("fail to get image from url: %s", err.Error()))
		return image.Config{}, "", err
	}
	defer response.Body.Close()

	if response.StatusCode != 200 {
		err = errors.New(fmt.Sprintf("fail to get image from url: %s", response.Status))
		return image.Config{}, "", err
	}

	mimeType := response.Header.Get("Content-Type")

	if mimeType != "application/octet-stream" && !strings.HasPrefix(mimeType, "image/") {
		return image.Config{}, "", fmt.Errorf("invalid content type: %s, required image/*", mimeType)
	}

	var readData []byte
	for _, limit := range []int64{1024 * 8, 1024 * 24, 1024 * 64} {
		common.SysLog(fmt.Sprintf("try to decode image config with limit: %d", limit))

		// 从response.Body读取更多的数据直到达到当前的限制
		additionalData := make([]byte, limit-int64(len(readData)))
		n, _ := io.ReadFull(response.Body, additionalData)
		readData = append(readData, additionalData[:n]...)

		// 使用io.MultiReader组合已经读取的数据和response.Body
		limitReader := io.MultiReader(bytes.NewReader(readData), response.Body)

		var config image.Config
		var format string
		config, format, err = getImageConfig(limitReader)
		if err == nil {
			return config, format, nil
		}
	}

	return image.Config{}, "", err // 返回最后一个错误
}

func getImageConfig(reader io.Reader) (image.Config, string, error) {
	// Read all data so we can retry with different decoders
	data, readErr := io.ReadAll(reader)
	if readErr != nil {
		return image.Config{}, "", fmt.Errorf("failed to read image data: %w", readErr)
	}

	// 读取图片的头部信息来获取图片尺寸
	config, format, err := image.DecodeConfig(bytes.NewReader(data))
	if err == nil {
		return config, format, nil
	}
	common.SysLog(fmt.Sprintf("fail to decode image config(gif, jpg, png): %s", err.Error()))

	config, err = webp.DecodeConfig(bytes.NewReader(data))
	if err == nil {
		return config, "webp", nil
	}
	common.SysLog(fmt.Sprintf("fail to decode image config(webp): %s", err.Error()))

	// Try HEIF/HEIC: parse ISOBMFF ispe box for dimensions
	if heifMime := detectHEIF(data); heifMime != "" {
		formatName := "heif"
		if heifMime == "image/heic" {
			formatName = "heic"
		}
		if w, h, ok := parseHEIFDimensions(data); ok {
			return image.Config{Width: w, Height: h}, formatName, nil
		}
		return image.Config{}, "", fmt.Errorf("failed to decode HEIF/HEIC image dimensions")
	}

	return image.Config{}, "", err
}

// 413 Payload Too Large 恢复时对 base64 图片的压缩档位（降采样边长 + JPEG 质量）
var bodyImageCompressSteps = []struct {
	maxDim  int
	quality int
}{
	{1536, 80},
	{1024, 70},
	{768, 65},
	{512, 60},
}

// 超大图片解码会占用大量内存，超过该像素数（约 40MP）时跳过压缩
const maxCompressImagePixels = 40_000_000

// CompressImageDataURL 将 base64 data URL 图片降采样并重编码为 JPEG，
// 用于上游 413 Payload Too Large 时缩减请求体体积。
// 依次尝试多档压缩并返回体积最小的一档；解码失败、GIF 动画或
// 压缩后没有变小则返回错误。
func CompressImageDataURL(dataURL string) (string, error) {
	idx := strings.Index(dataURL, ",")
	if idx == -1 {
		return "", errors.New("invalid data url")
	}
	raw, err := base64.StdEncoding.DecodeString(dataURL[idx+1:])
	if err != nil {
		return "", fmt.Errorf("failed to decode base64 image: %w", err)
	}

	img, format, err := image.Decode(bytes.NewReader(raw))
	if err != nil {
		// webp 需要显式解码
		img, err = webp.Decode(bytes.NewReader(raw))
		if err != nil {
			return "", fmt.Errorf("failed to decode image: %w", err)
		}
		format = "webp"
	}
	if format == "gif" {
		// 动图跳过压缩，避免丢失动画
		return "", errors.New("gif animation is not compressed")
	}

	bounds := img.Bounds()
	if int64(bounds.Dx())*int64(bounds.Dy()) > maxCompressImagePixels {
		return "", fmt.Errorf("image too large to compress safely (%dx%d)", bounds.Dx(), bounds.Dy())
	}

	var best string
	var bestLen int
	for _, step := range bodyImageCompressSteps {
		scaled := scaleImageToMaxDim(img, step.maxDim)
		flat := flattenToWhite(scaled)
		var buf bytes.Buffer
		if err := jpeg.Encode(&buf, flat, &jpeg.Options{Quality: step.quality}); err != nil {
			continue
		}
		newDataURL := "data:image/jpeg;base64," + base64.StdEncoding.EncodeToString(buf.Bytes())
		if best == "" || len(newDataURL) < bestLen {
			best = newDataURL
			bestLen = len(newDataURL)
		}
	}
	if best == "" || bestLen >= len(dataURL) {
		return "", errors.New("compressed image is not smaller")
	}
	return best, nil
}

// scaleImageToMaxDim 等比缩放到最长边不超过 maxDim（未超限时原样返回）
func scaleImageToMaxDim(img image.Image, maxDim int) image.Image {
	bounds := img.Bounds()
	w, h := bounds.Dx(), bounds.Dy()
	if w <= maxDim && h <= maxDim {
		return img
	}
	if w <= 0 || h <= 0 {
		return img
	}
	ratio := float64(maxDim) / float64(max(w, h))
	nw := int(float64(w) * ratio)
	nh := int(float64(h) * ratio)
	if nw < 1 {
		nw = 1
	}
	if nh < 1 {
		nh = 1
	}
	dst := image.NewRGBA(image.Rect(0, 0, nw, nh))
	ximagedraw.BiLinear.Scale(dst, dst.Bounds(), img, bounds, ximagedraw.Over, nil)
	return dst
}

// flattenToWhite 将透明背景合成到白色底上，避免 PNG 透明区域转 JPEG 后变黑
func flattenToWhite(img image.Image) image.Image {
	bounds := img.Bounds()
	dst := image.NewRGBA(bounds)
	draw.Draw(dst, bounds, image.NewUniform(color.White), image.Point{}, draw.Src)
	draw.Draw(dst, bounds, img, bounds.Min, draw.Over)
	return dst
}
