package controller

import (
	"errors"
	"io"
	"net/http"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/i18n"
	"github.com/QuantumNous/new-api/service"
	"github.com/gin-gonic/gin"
)

var uploadTempMediaImage = service.UploadTempMediaImage

func UploadTempMediaImage(c *gin.Context) {
	cfg := service.CurrentTempMediaConfig()
	c.Request.Body = http.MaxBytesReader(c.Writer, c.Request.Body, cfg.MaxImageBytes+1<<20)
	file, header, err := c.Request.FormFile("file")
	if err != nil {
		if strings.Contains(strings.ToLower(err.Error()), "too large") {
			common.ApiErrorI18n(c, i18n.MsgTempMediaImageTooLarge)
			return
		}
		common.ApiErrorI18n(c, i18n.MsgTempMediaFileRequired)
		return
	}
	defer file.Close()

	contentType := header.Header.Get("Content-Type")
	if contentType == "" {
		contentType = detectTempMediaContentType(file)
	}
	result, err := uploadTempMediaImage(c.Request.Context(), service.TempMediaUploadRequest{
		UserID:      c.GetInt("id"),
		Filename:    header.Filename,
		ContentType: contentType,
		Size:        header.Size,
		Body:        file,
	})
	if err != nil {
		switch {
		case errors.Is(err, service.ErrTempMediaFileRequired):
			common.ApiErrorI18n(c, i18n.MsgTempMediaFileRequired)
		case errors.Is(err, service.ErrTempMediaImageTooLarge):
			common.ApiErrorI18n(c, i18n.MsgTempMediaImageTooLarge)
		case errors.Is(err, service.ErrTempMediaUnsupportedImage):
			common.ApiErrorI18n(c, i18n.MsgTempMediaUnsupportedImage)
		case errors.Is(err, service.ErrTempMediaStorageDisabled), errors.Is(err, service.ErrTempMediaServiceAccount):
			common.ApiErrorI18n(c, i18n.MsgTempMediaNotConfigured)
		default:
			common.SysLog("failed to upload temp media image: " + err.Error())
			common.ApiErrorI18n(c, i18n.MsgTempMediaUploadFailed)
		}
		return
	}
	common.ApiSuccess(c, result)
}

func detectTempMediaContentType(file io.ReadSeeker) string {
	buffer := make([]byte, 512)
	n, _ := file.Read(buffer)
	_, _ = file.Seek(0, io.SeekStart)
	return http.DetectContentType(buffer[:n])
}
