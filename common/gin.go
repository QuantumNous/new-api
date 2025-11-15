package common

import (
	"bytes"
	"fmt"
	"io"
	"mime/multipart"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/constant"

	"github.com/gin-gonic/gin"
	"github.com/tidwall/sjson"
)

const KeyRequestBody = "key_request_body"

func GetRequestBody(c *gin.Context) ([]byte, error) {
	requestBody, _ := c.Get(KeyRequestBody)
	if requestBody != nil {
		return requestBody.([]byte), nil
	}
	requestBody, err := io.ReadAll(c.Request.Body)
	if err != nil {
		return nil, err
	}
	_ = c.Request.Body.Close()
	c.Set(KeyRequestBody, requestBody)
	return requestBody.([]byte), nil
}

func UnmarshalBodyReusable(c *gin.Context, v any) error {
	requestBody, err := GetRequestBody(c)
	if err != nil {
		return err
	}
	//if DebugEnabled {
	//	println("UnmarshalBodyReusable request body:", string(requestBody))
	//}
	contentType := c.Request.Header.Get("Content-Type")
	if strings.HasPrefix(contentType, "application/json") {
		err = Unmarshal(requestBody, v)
	} else if strings.Contains(contentType, gin.MIMEPOSTForm) {
		err = parseFormData(requestBody, v)
	} else if strings.Contains(contentType, gin.MIMEMultipartPOSTForm) {
		err = parseMultipartFormData(c, requestBody, v)
	} else {
		// skip for now
		// TODO: someday non json request have variant model, we will need to implementation this
	}
	if err != nil {
		return err
	}
	// Reset request body
	c.Request.Body = io.NopCloser(bytes.NewBuffer(requestBody))
	return nil
}

func SetContextKey(c *gin.Context, key constant.ContextKey, value any) {
	c.Set(string(key), value)
}

func GetContextKey(c *gin.Context, key constant.ContextKey) (any, bool) {
	return c.Get(string(key))
}

func GetContextKeyString(c *gin.Context, key constant.ContextKey) string {
	return c.GetString(string(key))
}

func GetContextKeyInt(c *gin.Context, key constant.ContextKey) int {
	return c.GetInt(string(key))
}

func GetContextKeyBool(c *gin.Context, key constant.ContextKey) bool {
	return c.GetBool(string(key))
}

func GetContextKeyStringSlice(c *gin.Context, key constant.ContextKey) []string {
	return c.GetStringSlice(string(key))
}

func GetContextKeyStringMap(c *gin.Context, key constant.ContextKey) map[string]any {
	return c.GetStringMap(string(key))
}

func GetContextKeyTime(c *gin.Context, key constant.ContextKey) time.Time {
	return c.GetTime(string(key))
}

func GetContextKeyType[T any](c *gin.Context, key constant.ContextKey) (T, bool) {
	if value, ok := c.Get(string(key)); ok {
		if v, ok := value.(T); ok {
			return v, true
		}
	}
	var t T
	return t, false
}

func ApiError(c *gin.Context, err error) {
	c.JSON(http.StatusOK, gin.H{
		"success": false,
		"message": err.Error(),
	})
}

func ApiErrorMsg(c *gin.Context, msg string) {
	c.JSON(http.StatusOK, gin.H{
		"success": false,
		"message": msg,
	})
}

func ApiSuccess(c *gin.Context, data any) {
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data":    data,
	})
}

func ParseMultipartFormReusable(c *gin.Context) (*multipart.Form, error) {
	requestBody, err := GetRequestBody(c)
	if err != nil {
		return nil, err
	}

	contentType := c.Request.Header.Get("Content-Type")
	boundary := ""
	if idx := strings.Index(contentType, "boundary="); idx != -1 {
		boundary = contentType[idx+9:]
	}

	reader := multipart.NewReader(bytes.NewReader(requestBody), boundary)
	form, err := reader.ReadForm(32 << 20) // 32 MB max memory
	if err != nil {
		return nil, err
	}

	// Reset request body
	c.Request.Body = io.NopCloser(bytes.NewBuffer(requestBody))
	return form, nil
}

func processFormMap(formMap map[string]any, v any) error {
	jsonData, err := Marshal(formMap)
	if err != nil {
		return err
	}

	err = Unmarshal(jsonData, v)
	if err != nil {
		return err
	}

	return nil
}

func parseFormData(data []byte, v any) error {
	values, err := url.ParseQuery(string(data))
	if err != nil {
		return err
	}
	formMap := make(map[string]any)
	for key, vals := range values {
		if len(vals) == 1 {
			formMap[key] = vals[0]
		} else {
			formMap[key] = vals
		}
	}

	return processFormMap(formMap, v)
}

func parseMultipartFormData(c *gin.Context, data []byte, v any) error {
	contentType := c.Request.Header.Get("Content-Type")
	boundary := ""
	if idx := strings.Index(contentType, "boundary="); idx != -1 {
		boundary = contentType[idx+9:]
	}

	if boundary == "" {
		return Unmarshal(data, v) // Fallback to JSON
	}

	reader := multipart.NewReader(bytes.NewReader(data), boundary)
	form, err := reader.ReadForm(32 << 20) // 32 MB max memory
	if err != nil {
		return err
	}
	defer form.RemoveAll()
	formMap := make(map[string]any)
	for key, vals := range form.Value {
		if len(vals) == 1 {
			formMap[key] = vals[0]
		} else {
			formMap[key] = vals
		}
	}

	return processFormMap(formMap, v)
}

func ReplaceRequestField(c *gin.Context, field, value string) error {
	if field == "" || value == "" {
		return nil
	}

	requestBody, err := GetRequestBody(c)
	if err != nil {
		return err
	}
	if len(requestBody) == 0 {
		return nil
	}

	contentType := c.Request.Header.Get("Content-Type")
	var patchedContentType string
	changed := false

	switch {
	case strings.HasPrefix(contentType, gin.MIMEJSON):
		updatedBody, err := sjson.SetBytes(requestBody, field, value)
		if err != nil {
			return err
		}
		requestBody = updatedBody
		changed = true
	case strings.Contains(contentType, gin.MIMEPOSTForm):
		values, err := url.ParseQuery(string(requestBody))
		if err != nil {
			return err
		}
		values.Set(field, value)
		requestBody = []byte(values.Encode())
		changed = true
	case strings.Contains(contentType, gin.MIMEMultipartPOSTForm):
		boundary := ""
		if idx := strings.Index(contentType, "boundary="); idx != -1 {
			boundary = strings.Trim(strings.TrimSpace(contentType[idx+9:]), "\"")
		}
		if boundary == "" {
			return nil
		}

		reader := multipart.NewReader(bytes.NewReader(requestBody), boundary)
		form, err := reader.ReadForm(32 << 20)
		if err != nil {
			return err
		}
		defer form.RemoveAll()

		form.Value[field] = []string{value}

		buf := &bytes.Buffer{}
		writer := multipart.NewWriter(buf)
		newBoundary := writer.Boundary()
		for key, vals := range form.Value {
			for _, val := range vals {
				if err := writer.WriteField(key, val); err != nil {
					return err
				}
			}
		}
		for key, files := range form.File {
			for _, fileHeader := range files {
				file, err := fileHeader.Open()
				if err != nil {
					return err
				}
				part, err := writer.CreateFormFile(key, fileHeader.Filename)
				if err != nil {
					_ = file.Close()
					return err
				}
				if _, err := io.Copy(part, file); err != nil {
					_ = file.Close()
					return err
				}
				_ = file.Close()
			}
		}
		if err := writer.Close(); err != nil {
			return err
		}

		requestBody = buf.Bytes()
		patchedContentType = fmt.Sprintf("multipart/form-data; boundary=%s", newBoundary)
		changed = true
	default:
		return nil
	}

	if !changed {
		return nil
	}

	c.Set(KeyRequestBody, requestBody)
	c.Request.Body = io.NopCloser(bytes.NewReader(requestBody))
	c.Request.ContentLength = int64(len(requestBody))
	c.Request.Header.Set("Content-Length", fmt.Sprintf("%d", len(requestBody)))
	if patchedContentType != "" {
		c.Request.Header.Set("Content-Type", patchedContentType)
	}
	return nil
}
