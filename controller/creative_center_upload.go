package controller

import (
	"bytes"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"io"
	"mime/multipart"
	"net/http"
	"os"
	"path/filepath"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/setting/system_setting"
	"github.com/gin-gonic/gin"
)

const creativeCenterImageUploadMaxBytes int64 = 20 << 20

var creativeCenterImageExtByMime = map[string]string{
	"image/gif":  ".gif",
	"image/jpeg": ".jpg",
	"image/png":  ".png",
	"image/webp": ".webp",
}

type creativeCenterExternalUploadItem struct {
	Src string `json:"src"`
}

type creativeCenterExternalWrappedUploadResp struct {
	Data []creativeCenterExternalUploadItem `json:"data"`
}

func UploadCreativeCenterImage(c *gin.Context) {
	if system_setting.EnableCreativeCenterImageBed() {
		uploaded, err := uploadCreativeCenterImageToExternalBed(c)
		if err != nil {
			common.ApiError(c, err)
			return
		}
		common.ApiSuccess(c, uploaded)
		return
	}

	fileHeader, err := c.FormFile("file")
	if err != nil {
		common.ApiErrorMsg(c, "请选择要上传的图片")
		return
	}
	if fileHeader.Size <= 0 {
		common.ApiErrorMsg(c, "图片文件不能为空")
		return
	}
	if fileHeader.Size > creativeCenterImageUploadMaxBytes {
		common.ApiErrorMsg(c, "图片大小不能超过 20MB")
		return
	}

	src, err := fileHeader.Open()
	if err != nil {
		common.ApiError(c, err)
		return
	}
	defer src.Close()

	head := make([]byte, 512)
	headSize, err := io.ReadFull(src, head)
	if err != nil && !errors.Is(err, io.EOF) && !errors.Is(err, io.ErrUnexpectedEOF) {
		common.ApiError(c, err)
		return
	}

	contentType := http.DetectContentType(head[:headSize])
	ext, ok := creativeCenterImageExtByMime[contentType]
	if !ok {
		common.ApiErrorMsg(c, "仅支持 PNG、JPG、WEBP、GIF 图片")
		return
	}

	uploadDir := creativeCenterImageUploadDir()
	if err = os.MkdirAll(uploadDir, 0o755); err != nil {
		common.ApiError(c, err)
		return
	}

	tempFile, err := os.CreateTemp(uploadDir, "creative-center-image-*")
	if err != nil {
		common.ApiError(c, err)
		return
	}

	tempFilePath := tempFile.Name()
	tempFileClosed := false
	defer func() {
		if !tempFileClosed {
			_ = tempFile.Close()
		}
		if tempFilePath != "" {
			_ = os.Remove(tempFilePath)
		}
	}()

	hasher := sha256.New()
	writer := io.MultiWriter(tempFile, hasher)
	reader := io.MultiReader(bytes.NewReader(head[:headSize]), src)

	if _, err = io.Copy(writer, reader); err != nil {
		common.ApiError(c, err)
		return
	}
	if err = tempFile.Close(); err != nil {
		common.ApiError(c, err)
		return
	}
	tempFileClosed = true

	fileHash := hex.EncodeToString(hasher.Sum(nil))
	fileName := fileHash + ext
	finalPath := filepath.Join(uploadDir, fileName)

	if _, statErr := os.Stat(finalPath); statErr == nil {
		_ = os.Remove(tempFilePath)
		tempFilePath = ""
	} else if errors.Is(statErr, os.ErrNotExist) {
		if err = os.Rename(tempFilePath, finalPath); err != nil {
			common.ApiError(c, err)
			return
		}
		tempFilePath = ""
	} else {
		common.ApiError(c, statErr)
		return
	}

	publicPath := fmt.Sprintf("/api/public/creative-center/image/%s", fileName)
	common.ApiSuccess(c, gin.H{
		"url":          buildCreativeCenterImageAbsoluteURL(c, publicPath),
		"name":         fileHeader.Filename,
		"filename":     fileName,
		"content_type": contentType,
		"size":         fileHeader.Size,
	})
}

func GetCreativeCenterUploadedImage(c *gin.Context) {
	fileName := filepath.Base(strings.TrimSpace(c.Param("filename")))
	if fileName == "" || fileName == "." || fileName != strings.TrimSpace(c.Param("filename")) {
		c.Status(http.StatusNotFound)
		return
	}

	filePath := filepath.Join(creativeCenterImageUploadDir(), fileName)
	if _, err := os.Stat(filePath); err != nil {
		c.Status(http.StatusNotFound)
		return
	}

	c.Header("Cache-Control", "public, max-age=31536000, immutable")
	c.File(filePath)
}

func ProxyCreativeCenterRemoteImage(c *gin.Context) {
	targetURL := strings.TrimSpace(c.Query("url"))
	if targetURL == "" {
		c.Status(http.StatusBadRequest)
		return
	}
	if !strings.HasPrefix(targetURL, "https://") && !strings.HasPrefix(targetURL, "http://") {
		c.Status(http.StatusBadRequest)
		return
	}

	resp, err := service.DoDownloadRequest(targetURL, "creative center image proxy")
	if err != nil {
		c.Status(http.StatusBadGateway)
		return
	}
	defer resp.Body.Close()

	if resp.StatusCode < http.StatusOK || resp.StatusCode >= http.StatusMultipleChoices {
		c.Status(http.StatusBadGateway)
		return
	}

	head := make([]byte, 512)
	headSize, err := io.ReadFull(resp.Body, head)
	if err != nil && !errors.Is(err, io.EOF) && !errors.Is(err, io.ErrUnexpectedEOF) {
		c.Status(http.StatusBadGateway)
		return
	}

	contentType := strings.TrimSpace(resp.Header.Get("Content-Type"))
	if contentType == "" || !strings.HasPrefix(strings.ToLower(contentType), "image/") {
		contentType = http.DetectContentType(head[:headSize])
	}
	if !strings.HasPrefix(strings.ToLower(contentType), "image/") {
		c.Status(http.StatusUnsupportedMediaType)
		return
	}

	c.Header("Cache-Control", "private, max-age=300")
	c.Header("Content-Disposition", "inline")
	c.DataFromReader(
		http.StatusOK,
		-1,
		contentType,
		io.MultiReader(bytes.NewReader(head[:headSize]), resp.Body),
		nil,
	)
}

func creativeCenterImageUploadDir() string {
	return filepath.Join("data", "uploads", "creative-center")
}

func buildCreativeCenterImageAbsoluteURL(c *gin.Context, publicPath string) string {
	baseURL := strings.TrimSuffix(strings.TrimSpace(system_setting.ServerAddress), "/")
	if baseURL != "" {
		return baseURL + publicPath
	}

	scheme := strings.TrimSpace(c.GetHeader("X-Forwarded-Proto"))
	if scheme == "" {
		if c.Request.TLS != nil {
			scheme = "https"
		} else {
			scheme = "http"
		}
	}

	host := strings.TrimSpace(c.GetHeader("X-Forwarded-Host"))
	if host == "" {
		host = c.Request.Host
	}

	return fmt.Sprintf("%s://%s%s", scheme, host, publicPath)
}

func uploadCreativeCenterImageToExternalBed(c *gin.Context) (gin.H, error) {
	fileHeader, err := c.FormFile("file")
	if err != nil {
		return nil, fmt.Errorf("请选择要上传的图片")
	}
	if fileHeader.Size <= 0 {
		return nil, fmt.Errorf("图片文件不能为空")
	}
	if fileHeader.Size > creativeCenterImageUploadMaxBytes {
		return nil, fmt.Errorf("图片大小不能超过 20MB")
	}

	src, err := fileHeader.Open()
	if err != nil {
		return nil, err
	}
	defer src.Close()

	uploadURL := strings.TrimRight(strings.TrimSpace(system_setting.CreativeCenterImageBedURL), "/") + "/upload"
	uploadToken := strings.TrimSpace(system_setting.CreativeCenterImageBedApiKey)

	req, contentType, err := buildCreativeCenterExternalUploadRequest(uploadURL, uploadToken, fileHeader.Filename, src)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", contentType)

	httpClient := service.GetHttpClient()
	if httpClient == nil {
		httpClient = http.DefaultClient
	}
	resp, err := httpClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return nil, fmt.Errorf("图床上传失败，状态码 %d：%s", resp.StatusCode, strings.TrimSpace(string(respBody)))
	}

	imageURL, err := parseCreativeCenterExternalUploadURL(uploadURL, respBody)
	if err != nil {
		return nil, err
	}

	return gin.H{
		"url":      imageURL,
		"name":     fileHeader.Filename,
		"filename": filepath.Base(imageURL),
		"size":     fileHeader.Size,
	}, nil
}

func buildCreativeCenterExternalUploadRequest(uploadURL string, uploadToken string, fileName string, file io.Reader) (*http.Request, string, error) {
	pipeReader, pipeWriter := io.Pipe()
	writer := multipart.NewWriter(pipeWriter)

	go func() {
		defer pipeWriter.Close()
		defer writer.Close()

		part, err := writer.CreateFormFile("file", fileName)
		if err != nil {
			_ = pipeWriter.CloseWithError(err)
			return
		}
		if _, err = io.Copy(part, file); err != nil {
			_ = pipeWriter.CloseWithError(err)
			return
		}
	}()

	queryPrefix := "?"
	if strings.Contains(uploadURL, "?") {
		queryPrefix = "&"
	}
	requestURL := uploadURL + queryPrefix + "returnFormat=full&autoRetry=true"

	req, err := http.NewRequest(http.MethodPost, requestURL, pipeReader)
	if err != nil {
		return nil, "", err
	}
	req.Header.Set("Authorization", "Bearer "+uploadToken)
	req.Header.Set("User-Agent", "new-api creative-center uploader")
	return req, writer.FormDataContentType(), nil
}

func parseCreativeCenterExternalUploadURL(uploadURL string, respBody []byte) (string, error) {
	var directItems []creativeCenterExternalUploadItem
	if err := common.Unmarshal(respBody, &directItems); err == nil {
		if imageURL := normalizeCreativeCenterExternalImageURL(uploadURL, directItems); imageURL != "" {
			return imageURL, nil
		}
	}

	var wrapped creativeCenterExternalWrappedUploadResp
	if err := common.Unmarshal(respBody, &wrapped); err == nil {
		if imageURL := normalizeCreativeCenterExternalImageURL(uploadURL, wrapped.Data); imageURL != "" {
			return imageURL, nil
		}
	}

	return "", fmt.Errorf("图床上传成功但未返回可用图片链接")
}

func normalizeCreativeCenterExternalImageURL(uploadURL string, items []creativeCenterExternalUploadItem) string {
	if len(items) == 0 {
		return ""
	}

	src := strings.TrimSpace(items[0].Src)
	if src == "" {
		return ""
	}
	if strings.HasPrefix(src, "http://") || strings.HasPrefix(src, "https://") {
		return src
	}

	baseURL := strings.TrimSuffix(uploadURL, "/upload")
	baseURL = strings.TrimRight(baseURL, "/")
	if strings.HasPrefix(src, "/") {
		return baseURL + src
	}
	return baseURL + "/" + src
}
