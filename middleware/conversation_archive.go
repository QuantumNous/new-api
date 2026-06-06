package middleware

import (
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/logger"
	"github.com/QuantumNous/new-api/service/conversationarchive"

	"github.com/gin-gonic/gin"
)

type conversationArchiveWriter struct {
	gin.ResponseWriter
	recorder *conversationarchive.ResponseRecorder
}

func (w *conversationArchiveWriter) Write(data []byte) (int, error) {
	n, err := w.ResponseWriter.Write(data)
	if n > 0 {
		w.recorder.Write(data[:n])
	}
	return n, err
}

func (w *conversationArchiveWriter) WriteString(data string) (int, error) {
	n, err := w.ResponseWriter.WriteString(data)
	if n > 0 {
		w.recorder.Write([]byte(data[:n]))
	}
	return n, err
}

func ConversationArchive() gin.HandlerFunc {
	return func(c *gin.Context) {
		if !conversationarchive.Enabled() || !shouldArchiveRequest(c) {
			c.Next()
			return
		}

		requestTime := time.Now()
		requestBodyGzip, sessionBody, err := getArchiveRequestBody(c)
		if err != nil {
			logger.LogWarn(c.Request.Context(), fmt.Sprintf("会话归档读取请求体失败: %v", err))
			c.Next()
			return
		}

		requestID := c.GetString(common.RequestIdKey)
		sessionID := conversationarchive.ResolveSessionID(
			c.GetHeader(conversationarchive.SessionHeader()),
			sessionBody,
			requestID,
		)
		recorder := conversationarchive.NewResponseRecorder()
		originWriter := c.Writer
		c.Writer = &conversationArchiveWriter{
			ResponseWriter: originWriter,
			recorder:       recorder,
		}

		c.Next()

		responseBodyGzip, err := recorder.Close()
		if err != nil {
			logger.LogWarn(c.Request.Context(), fmt.Sprintf("会话归档压缩响应体失败: %v", err))
			return
		}
		conversationarchive.Enqueue(conversationarchive.Record{
			SessionID:        sessionID,
			RequestTime:      requestTime,
			ResponseTime:     time.Now(),
			RequestBodyGzip:  requestBodyGzip,
			ResponseBodyGzip: responseBodyGzip,
		})
	}
}

func shouldArchiveRequest(c *gin.Context) bool {
	if c.Request == nil {
		return false
	}
	if c.Request.Method != http.MethodPost {
		return false
	}
	return c.Request.Body != nil
}

func getArchiveRequestBody(c *gin.Context) ([]byte, []byte, error) {
	storage, err := common.GetBodyStorage(c)
	if err != nil {
		return nil, nil, err
	}
	var sessionBody []byte
	var bodyGzip []byte
	if strings.HasPrefix(c.Request.Header.Get("Content-Type"), "application/json") {
		body, err := storage.Bytes()
		if err != nil {
			return nil, nil, err
		}
		sessionBody = body
		bodyGzip, err = conversationarchive.CompressBytes(body)
		if err != nil {
			return nil, nil, err
		}
	} else {
		if _, err := storage.Seek(0, io.SeekStart); err != nil {
			return nil, nil, err
		}
		bodyGzip, err = conversationarchive.CompressReader(storage)
		if err != nil {
			return nil, nil, err
		}
	}
	if _, err := storage.Seek(0, io.SeekStart); err != nil {
		return nil, nil, err
	}
	c.Request.Body = io.NopCloser(storage)
	return bodyGzip, sessionBody, nil
}
