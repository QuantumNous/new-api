package middleware

import (
	"bytes"
	"fmt"
	"io"
	"mime/multipart"
	"net/http"
	"net/textproto"
	"net/url"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/types"

	"github.com/gin-gonic/gin"
)

func PrivacyFilter() gin.HandlerFunc {
	return func(c *gin.Context) {
		if !service.IsPrivacyFilterEnabled() || c.Request == nil || c.Request.Body == nil || c.Request.Method == http.MethodGet {
			c.Next()
			return
		}

		if err := applyPrivacyFilter(c); err != nil {
			abortWithOpenAiMessage(c, http.StatusBadRequest, service.PrivacyFilterError(err).Error(), types.ErrorCodePrivacyFilterFailed)
			return
		}

		c.Next()
	}
}

func applyPrivacyFilter(c *gin.Context) error {
	contentType := c.Request.Header.Get("Content-Type")
	switch {
	case strings.HasPrefix(contentType, "application/json"):
		return filterJSONBody(c)
	case strings.Contains(contentType, gin.MIMEPOSTForm):
		return filterURLEncodedBody(c)
	case strings.Contains(contentType, gin.MIMEMultipartPOSTForm):
		return filterMultipartBody(c)
	default:
		return nil
	}
}

func filterJSONBody(c *gin.Context) error {
	storage, err := common.GetBodyStorage(c)
	if err != nil {
		return err
	}
	body, err := storage.Bytes()
	if err != nil {
		return err
	}
	redacted, err := service.ApplyPrivacyFilterToJSON(c, body)
	if err != nil {
		return err
	}
	if bytes.Equal(body, redacted) {
		resetRequestBody(c, storage)
		return nil
	}
	return replaceRequestBody(c, redacted, "")
}

func filterURLEncodedBody(c *gin.Context) error {
	storage, err := common.GetBodyStorage(c)
	if err != nil {
		return err
	}
	body, err := storage.Bytes()
	if err != nil {
		return err
	}
	values, err := url.ParseQuery(string(body))
	if err != nil {
		return err
	}
	if err := service.ApplyPrivacyFilterToFormValues(c, values); err != nil {
		return err
	}
	redacted := []byte(values.Encode())
	if bytes.Equal(body, redacted) {
		resetRequestBody(c, storage)
		return nil
	}
	return replaceRequestBody(c, redacted, "")
}

func filterMultipartBody(c *gin.Context) error {
	form, err := common.ParseMultipartFormReusable(c)
	if err != nil {
		return err
	}
	if err := service.ApplyPrivacyFilterToFormValues(c, form.Value); err != nil {
		return err
	}

	body, contentType, err := rebuildMultipartBody(form)
	if err != nil {
		return err
	}
	if err := replaceRequestBody(c, body, contentType); err != nil {
		return err
	}
	c.Set("_original_multipart_ct", contentType)
	c.Request.MultipartForm = form
	c.Request.PostForm = url.Values(form.Value)
	return nil
}

func rebuildMultipartBody(form *multipart.Form) ([]byte, string, error) {
	var buf bytes.Buffer
	writer := multipart.NewWriter(&buf)

	for key, values := range form.Value {
		for _, value := range values {
			if err := writer.WriteField(key, value); err != nil {
				return nil, "", err
			}
		}
	}

	for fieldName, files := range form.File {
		for _, fh := range files {
			if err := copyMultipartFile(writer, fieldName, fh); err != nil {
				return nil, "", err
			}
		}
	}

	if err := writer.Close(); err != nil {
		return nil, "", err
	}
	return buf.Bytes(), writer.FormDataContentType(), nil
}

func copyMultipartFile(writer *multipart.Writer, fieldName string, fh *multipart.FileHeader) error {
	file, err := fh.Open()
	if err != nil {
		return err
	}
	defer file.Close()

	header := cloneMIMEHeader(fh.Header)
	if header.Get("Content-Disposition") == "" {
		header.Set("Content-Disposition", fmt.Sprintf(`form-data; name="%s"; filename="%s"`, escapeQuotes(fieldName), escapeQuotes(fh.Filename)))
	}
	if header.Get("Content-Type") == "" {
		header.Set("Content-Type", "application/octet-stream")
	}

	part, err := writer.CreatePart(header)
	if err != nil {
		return err
	}
	_, err = io.Copy(part, file)
	return err
}

func replaceRequestBody(c *gin.Context, body []byte, contentType string) error {
	if old, exists := c.Get(common.KeyBodyStorage); exists && old != nil {
		if storage, ok := old.(common.BodyStorage); ok {
			_ = storage.Close()
		}
	}
	storage, err := common.CreateBodyStorage(body)
	if err != nil {
		return err
	}
	c.Set(common.KeyBodyStorage, storage)
	resetRequestBody(c, storage)
	c.Request.ContentLength = int64(len(body))
	if contentType != "" {
		c.Request.Header.Set("Content-Type", contentType)
	}
	return nil
}

func resetRequestBody(c *gin.Context, storage common.BodyStorage) {
	_, _ = storage.Seek(0, io.SeekStart)
	c.Request.Body = io.NopCloser(storage)
}

func cloneMIMEHeader(header textproto.MIMEHeader) textproto.MIMEHeader {
	cloned := make(textproto.MIMEHeader, len(header))
	for key, values := range header {
		copied := make([]string, len(values))
		copy(copied, values)
		cloned[key] = copied
	}
	return cloned
}

func escapeQuotes(value string) string {
	return strings.ReplaceAll(value, `"`, `\"`)
}
