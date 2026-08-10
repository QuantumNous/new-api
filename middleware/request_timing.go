package middleware

import (
	"net/http"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"

	"github.com/gin-gonic/gin"
)

type requestTimingResponseWriter struct {
	gin.ResponseWriter
	session *common.RequestTimingSession
}

func (w *requestTimingResponseWriter) Write(data []byte) (int, error) {
	startedAt := time.Now()
	written, err := w.ResponseWriter.Write(data)
	if written > 0 {
		w.session.MarkClientWrite(startedAt, time.Now())
	}
	return written, err
}

func (w *requestTimingResponseWriter) WriteString(data string) (int, error) {
	startedAt := time.Now()
	written, err := w.ResponseWriter.WriteString(data)
	if written > 0 {
		w.session.MarkClientWrite(startedAt, time.Now())
	}
	return written, err
}

func RequestTiming() gin.HandlerFunc {
	return func(c *gin.Context) {
		if !shouldRecordRequestTiming(c.Request.Method, c.Request.URL.Path) {
			c.Next()
			return
		}

		session := common.NewRequestTimingSession(time.Now())
		common.SetRequestTimingSession(c, session)
		c.Writer = &requestTimingResponseWriter{
			ResponseWriter: c.Writer,
			session:        session,
		}
		c.Next()
	}
}

func shouldRecordRequestTiming(method string, path string) bool {
	if method != http.MethodPost {
		return false
	}
	switch path {
	case "/v1/chat/completions", "/v1/completions", "/v1/responses", "/v1/messages":
		return true
	}

	const prefix = "/v1beta/models/"
	if !strings.HasPrefix(path, prefix) {
		return false
	}
	modelAction := strings.TrimPrefix(path, prefix)
	for _, action := range []string{":generateContent", ":streamGenerateContent"} {
		if strings.HasSuffix(modelAction, action) {
			model := strings.TrimSuffix(modelAction, action)
			return model != "" && !strings.Contains(model, "/")
		}
	}
	return false
}
