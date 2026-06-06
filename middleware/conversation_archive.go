package middleware

import (
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/logger"
	"github.com/QuantumNous/new-api/service/conversationarchive"
	"github.com/QuantumNous/new-api/setting/operation_setting"

	"github.com/gin-gonic/gin"
)

type conversationArchiveWriter struct {
	gin.ResponseWriter
	recorder archiveResponseRecorder
}

type archiveResponseRecorder interface {
	Write(data []byte)
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
		conversationArchiveAsync(c)
	}
}

func conversationArchiveAsync(c *gin.Context) {
	requestTime := time.Now()
	requestHeadersFile, err := getArchiveRequestHeadersSpool(c)
	if err != nil {
		logger.LogWarn(c.Request.Context(), fmt.Sprintf("会话归档写入请求头 spool 失败: %v", err))
		c.Next()
		return
	}
	requestBodyFile, sessionBody, err := getArchiveRequestBodySpool(c)
	if err != nil {
		conversationarchive.CleanupSpoolFiles(requestHeadersFile)
		logger.LogWarn(c.Request.Context(), fmt.Sprintf("会话归档写入请求体 spool 失败: %v", err))
		c.Next()
		return
	}

	requestID := c.GetString(common.RequestIdKey)
	sessionID := conversationarchive.ResolveSessionID(
		c.GetHeader(conversationarchive.SessionHeader()),
		sessionBody,
		requestID,
	)
	recorder, err := conversationarchive.NewSpoolResponseRecorder()
	if err != nil {
		conversationarchive.CleanupSpoolFiles(requestHeadersFile, requestBodyFile)
		logger.LogWarn(c.Request.Context(), fmt.Sprintf("会话归档创建响应 spool 失败: %v", err))
		c.Next()
		return
	}
	originWriter := c.Writer
	c.Writer = &conversationArchiveWriter{
		ResponseWriter: originWriter,
		recorder:       recorder,
	}

	c.Next()

	responseBodyFile, err := recorder.Close()
	if err != nil {
		conversationarchive.CleanupSpoolFiles(requestHeadersFile, requestBodyFile)
		logger.LogWarn(c.Request.Context(), fmt.Sprintf("会话归档关闭响应 spool 失败: %v", err))
		return
	}
	conversationarchive.EnqueueRaw(conversationarchive.RawRecord{
		Kind:               archiveKind(c),
		SessionID:          sessionID,
		RequestID:          requestID,
		RequestTime:        requestTime,
		ResponseTime:       time.Now(),
		RequestHeadersFile: requestHeadersFile,
		RequestBodyFile:    requestBodyFile,
		ResponseBodyFile:   responseBodyFile,
	})
}

func archiveKind(c *gin.Context) conversationarchive.ArchiveKind {
	if c != nil && c.Request != nil && c.Request.Context().Err() != nil {
		return conversationarchive.ArchiveKindAbnormal
	}
	return conversationarchive.ArchiveKindNormal
}

func shouldArchiveRequest(c *gin.Context) bool {
	if !operation_setting.IsConversationArchiveEnabled() {
		return false
	}
	if common.GetContextKeyInt(c, constant.ContextKeyUserRole) >= common.RoleAdminUser {
		return false
	}
	if c.Request == nil {
		return false
	}
	if c.Request.Method != http.MethodPost {
		return false
	}
	return c.Request.Body != nil
}

func getArchiveRequestBodySpool(c *gin.Context) (conversationarchive.SpoolFile, []byte, error) {
	storage, err := common.GetBodyStorage(c)
	if err != nil {
		return conversationarchive.SpoolFile{}, nil, err
	}
	var sessionBody []byte
	var bodyFile conversationarchive.SpoolFile
	if strings.HasPrefix(c.Request.Header.Get("Content-Type"), "application/json") {
		body, err := storage.Bytes()
		if err != nil {
			return conversationarchive.SpoolFile{}, nil, err
		}
		sessionBody = body
		bodyFile, err = conversationarchive.WriteSpoolBytes(body)
		if err != nil {
			return conversationarchive.SpoolFile{}, nil, err
		}
	} else {
		if _, err := storage.Seek(0, io.SeekStart); err != nil {
			return conversationarchive.SpoolFile{}, nil, err
		}
		bodyFile, err = conversationarchive.WriteSpoolReader(storage)
		if err != nil {
			return conversationarchive.SpoolFile{}, nil, err
		}
	}
	if _, err := storage.Seek(0, io.SeekStart); err != nil {
		conversationarchive.CleanupSpoolFiles(bodyFile)
		return conversationarchive.SpoolFile{}, nil, err
	}
	c.Request.Body = io.NopCloser(storage)
	return bodyFile, sessionBody, nil
}

func getArchiveRequestHeadersSpool(c *gin.Context) (conversationarchive.SpoolFile, error) {
	headers := map[string][]string{}
	if c != nil && c.Request != nil {
		for key, values := range c.Request.Header {
			headers[key] = append([]string(nil), values...)
		}
	}
	data, err := common.Marshal(headers)
	if err != nil {
		return conversationarchive.SpoolFile{}, err
	}
	return conversationarchive.WriteSpoolBytes(data)
}
