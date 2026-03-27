package middleware

import (
	"bytes"
	"encoding/base64"
	"encoding/json"
	"io"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/service/audit"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"github.com/QuantumNous/new-api/types"

	"github.com/bytedance/gopkg/util/gopool"
	"github.com/gin-gonic/gin"
)

func AuditMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		if !operation_setting.IsAuditEnabled() {
			c.Next()
			return
		}

		startTime := time.Now()
		requestID := c.GetString(common.RequestIdKey)

		var requestBody []byte
		var files []audit.AuditFile
		contentType := c.GetHeader("Content-Type")

		if strings.HasPrefix(contentType, "multipart/form-data") {
			requestBody, files = extractMultipartData(c)
		} else if c.Request.Body != nil {
			bodyBytes, err := io.ReadAll(c.Request.Body)
			if err == nil {
				requestBody = bodyBytes
				c.Request.Body = io.NopCloser(bytes.NewBuffer(bodyBytes))
			}
		}

		blw := &bodyLogWriter{body: bytes.NewBufferString(""), ResponseWriter: c.Writer}
		c.Writer = blw

		c.Next()

		if c.Writer.Status() >= 400 {
			return
		}

		record := &audit.AuditRecord{
			RequestID:   requestID,
			Timestamp:   startTime,
			TokenKey:    maskTokenKey(common.GetContextKeyString(c, constant.ContextKeyTokenKey)),
			TokenID:     common.GetContextKeyInt(c, constant.ContextKeyTokenId),
			UserID:      common.GetContextKeyInt(c, constant.ContextKeyUserId),
			UserEmail:   common.GetContextKeyString(c, constant.ContextKeyUserEmail),
			Model:       c.GetString("original_model"),
			RelayMode:   c.GetInt("relay_mode"),
			RelayFormat: getRelayFormatFromPath(c.Request.URL.Path),
			RequestBody: json.RawMessage(requestBody),
			Files:       files,
			Metadata: map[string]interface{}{
				"client_ip":      c.ClientIP(),
				"user_agent":     c.GetHeader("User-Agent"),
				"request_method": c.Request.Method,
				"request_path":   c.Request.URL.Path,
				"status_code":    c.Writer.Status(),
				"latency_ms":     time.Since(startTime).Milliseconds(),
				"channel_id":     common.GetContextKeyInt(c, constant.ContextKeyChannelId),
				"channel_type":   common.GetContextKeyInt(c, constant.ContextKeyChannelType),
				"channel_name":   common.GetContextKeyString(c, constant.ContextKeyChannelName),
			},
		}

		gopool.Go(func() {
			auditLogger := audit.GetAuditLogger()
			auditLogger.Log(record)
		})
	}
}

type bodyLogWriter struct {
	gin.ResponseWriter
	body *bytes.Buffer
}

func (w bodyLogWriter) Write(b []byte) (int, error) {
	w.body.Write(b)
	return w.ResponseWriter.Write(b)
}

func extractMultipartData(c *gin.Context) ([]byte, []audit.AuditFile) {
	var requestBody map[string]interface{} = make(map[string]interface{})
	var files []audit.AuditFile

	err := c.Request.ParseMultipartForm(32 << 20)
	if err != nil {
		return nil, nil
	}

	if c.Request.MultipartForm != nil {
		for key, values := range c.Request.MultipartForm.Value {
			if len(values) == 1 {
				requestBody[key] = values[0]
			} else {
				requestBody[key] = values
			}
		}

		setting := operation_setting.GetAuditSetting()
		for key, fileHeaders := range c.Request.MultipartForm.File {
			for _, fh := range fileHeaders {
				file, err := fh.Open()
				if err != nil {
					continue
				}
				data, err := io.ReadAll(file)
				file.Close()
				if err != nil {
					continue
				}

				if int64(len(data)) > setting.MaxFileSize {
					continue
				}

				files = append(files, audit.AuditFile{
					Filename:    fh.Filename,
					ContentType: fh.Header.Get("Content-Type"),
					Size:        int64(len(data)),
					Base64Data:  base64.StdEncoding.EncodeToString(data),
				})

				_ = key
			}
		}
	}

	if model := c.PostForm("model"); model != "" {
		requestBody["model"] = model
	}

	jsonData, err := json.Marshal(requestBody)
	if err != nil {
		return nil, files
	}
	return jsonData, files
}

func maskTokenKey(key string) string {
	if len(key) <= 8 {
		return "****"
	}
	return key[:4] + "****" + key[len(key)-4:]
}

func getRelayFormatFromPath(path string) string {
	switch {
	case strings.HasPrefix(path, "/v1/messages"):
		return string(types.RelayFormatClaude)
	case strings.HasPrefix(path, "/v1beta/"):
		return string(types.RelayFormatGemini)
	case strings.HasPrefix(path, "/v1/responses"):
		return string(types.RelayFormatOpenAIResponses)
	case strings.HasPrefix(path, "/v1/embeddings"):
		return string(types.RelayFormatEmbedding)
	case strings.HasPrefix(path, "/v1/audio"):
		return string(types.RelayFormatOpenAIAudio)
	case strings.HasPrefix(path, "/v1/images"):
		return string(types.RelayFormatOpenAIImage)
	case strings.HasPrefix(path, "/v1/rerank"):
		return string(types.RelayFormatRerank)
	case strings.HasPrefix(path, "/mj/"):
		return string(types.RelayFormatMjProxy)
	case strings.HasPrefix(path, "/suno/"):
		return string(types.RelayFormatTask)
	default:
		return string(types.RelayFormatOpenAI)
	}
}

func ExtractFilesFromDTORequest(req dto.Request) []audit.AuditFile {
	files := make([]audit.AuditFile, 0)
	if req == nil {
		return files
	}

	switch r := req.(type) {
	case *dto.GeneralOpenAIRequest:
		for _, msg := range r.Messages {
			if msg.Content == nil {
				continue
			}
			if contents, ok := msg.Content.([]dto.MediaContent); ok {
				for _, content := range contents {
					if content.Type == dto.ContentTypeImageURL {
						imageMedia := content.GetImageMedia()
						if imageMedia != nil {
							url := imageMedia.Url
							if strings.HasPrefix(url, "data:") {
								parts := strings.SplitN(url, ",", 2)
								if len(parts) == 2 {
									mimePart := parts[0]
									data := parts[1]
									if strings.HasSuffix(mimePart, ";base64") {
										mimeType := strings.TrimSuffix(mimePart, ";base64")
										decoded, err := base64.StdEncoding.DecodeString(data)
										if err == nil {
											files = append(files, audit.AuditFile{
												Filename:    "embedded_image",
												ContentType: mimeType,
												Size:        int64(len(decoded)),
												Base64Data:  data,
											})
										}
									}
								}
							}
						}
					}
				}
			}
		}
	}

	return files
}
