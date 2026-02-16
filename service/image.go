package service

import (
	"github.com/QuantumNous/new-api/i18n"
	"bytes"
	"encoding/base64"
	"errors"
	"fmt"
	"image"
	"io"
	"net/http"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"

	"golang.org/x/image/webp"
)

// return image.Config, format, clean base64 string, error
func DecodeBase64ImageData(base64String string) (image.Config, string, string, error) {
	// 去除base64数据的URL前缀（如果有）
	if idx := strings.Index(base64String, ","); idx != -1 {
		base64String = base64String[idx+1:]
	}

	if len(base64String) == 0 {
		return image.Config{}, "", "", errors.New(i18n.Translate("svc.base64_string_is_empty"))
	}

	// 将base64字符串解码为字节切片
	decodedData, err := base64.StdEncoding.DecodeString(base64String)
	if err != nil {
		fmt.Println(i18n.Translate("svc.error_failed_to_decode_base64_string"))
		return image.Config{}, "", "", fmt.Errorf(i18n.Translate("svc.failed_to_decode_base64_string"), err.Error())
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
		return "", "", fmt.Errorf(i18n.Translate("svc.failed_to_download_image"), err)
	}
	defer resp.Body.Close()

	// Check HTTP status code
	if resp.StatusCode != http.StatusOK {
		return "", "", fmt.Errorf(i18n.Translate("svc.failed_to_download_image_http"), resp.StatusCode)
	}

	contentType := resp.Header.Get("Content-Type")
	if contentType != "application/octet-stream" && !strings.HasPrefix(contentType, "image/") {
		return "", "", fmt.Errorf(i18n.Translate("svc.invalid_content_type_required_image"), contentType)
	}
	maxImageSize := int64(constant.MaxFileDownloadMB * 1024 * 1024)

	// Check Content-Length if available
	if resp.ContentLength > maxImageSize {
		return "", "", fmt.Errorf(i18n.Translate("svc.image_size_exceeds_maximum_allowed_size_of_bytes"), resp.ContentLength, maxImageSize)
	}

	// Use LimitReader to prevent reading oversized images
	limitReader := io.LimitReader(resp.Body, maxImageSize)
	buffer := &bytes.Buffer{}

	written, err := io.Copy(buffer, limitReader)
	if err != nil {
		return "", "", fmt.Errorf(i18n.Translate("svc.failed_to_read_image_data"), err)
	}
	if written >= maxImageSize {
		return "", "", fmt.Errorf(i18n.Translate("svc.image_size_exceeds_maximum_allowed_size_of_bytes_a215"), maxImageSize)
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
		common.SysLog(fmt.Sprintf(i18n.Translate("svc.fail_to_get_image_from_url"), err.Error()))
		return image.Config{}, "", err
	}
	defer response.Body.Close()

	if response.StatusCode != 200 {
		err = errors.New(fmt.Sprintf(i18n.Translate("svc.fail_to_get_image_from_url_20cb"), response.Status))
		return image.Config{}, "", err
	}

	mimeType := response.Header.Get("Content-Type")

	if mimeType != "application/octet-stream" && !strings.HasPrefix(mimeType, "image/") {
		return image.Config{}, "", fmt.Errorf(i18n.Translate("svc.invalid_content_type_required_image"), mimeType)
	}

	var readData []byte
	for _, limit := range []int64{1024 * 8, 1024 * 24, 1024 * 64} {
		common.SysLog(fmt.Sprintf(i18n.Translate("svc.try_to_decode_image_config_with_limit"), limit))

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
	// 读取图片的头部信息来获取图片尺寸
	config, format, err := image.DecodeConfig(reader)
	if err != nil {
		err = errors.New(fmt.Sprintf(i18n.Translate("svc.fail_to_decode_image_config_gif_jpg_png"), err.Error()))
		common.SysLog(err.Error())
		config, err = webp.DecodeConfig(reader)
		if err != nil {
			err = errors.New(fmt.Sprintf(i18n.Translate("svc.fail_to_decode_image_config_webp"), err.Error()))
			common.SysLog(err.Error())
		}
		format = "webp"
	}
	if err != nil {
		return image.Config{}, "", err
	}
	return config, format, nil
}
