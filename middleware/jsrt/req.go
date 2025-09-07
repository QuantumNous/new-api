package jsrt

import (
	"bytes"
	"io"
	"maps"
	"net/http"
	"sync"

	"github.com/gin-gonic/gin"
)

// 请求
type JSReq struct {
	Method    string            `json:"method"`
	URL       string            `json:"url"`
	Headers   map[string]string `json:"headers"`
	Body      any               `json:"body"`
	UserAgent string            `json:"userAgent"`
	RemoteIP  string            `json:"remoteIP"`
	Extra     map[string]any    `json:"extra"`
}

type JSResponse struct {
	StatusCode int               `json:"statusCode"`
	Headers    map[string]string `json:"headers"`
	Body       string            `json:"body"`
}

type responseWriter struct {
	gin.ResponseWriter
	body       *bytes.Buffer
	statusCode int
	headerMap  http.Header
	written    bool
	mu         sync.RWMutex
}

func createJSReq(c *gin.Context) *JSReq {
	var bodyBytes []byte
	if c.Request != nil && c.Request.Body != nil {
		bodyBytes, _ = io.ReadAll(c.Request.Body)
		c.Request.Body = io.NopCloser(bytes.NewBuffer(bodyBytes))
	}

	// headers map
	headers := make(map[string]string)
	if c.Request != nil && c.Request.Header != nil {
		for key, values := range c.Request.Header {
			if len(values) > 0 {
				headers[key] = values[0]
			}
		}
	}

	method := ""
	url := ""
	userAgent := ""
	remoteIP := ""
	contentType := ""

	if c.Request != nil {
		method = c.Request.Method
		if c.Request.URL != nil {
			url = c.Request.URL.String()
		}
		userAgent = c.Request.UserAgent()
		contentType = c.ContentType()
	}

	if c != nil {
		remoteIP = c.ClientIP()
	}

	parsedBody := parseBodyByType(bodyBytes, contentType)

	return &JSReq{
		Method:    method,
		URL:       url,
		Headers:   headers,
		Body:      parsedBody,
		UserAgent: userAgent,
		RemoteIP:  remoteIP,
		Extra:     make(map[string]any),
	}
}

func newResponseWriter(w gin.ResponseWriter) *responseWriter {
	return &responseWriter{
		ResponseWriter: w,
		body:           &bytes.Buffer{},
		statusCode:     200,
		headerMap:      make(http.Header),
		written:        false,
	}
}

func (w *responseWriter) Write(data []byte) (int, error) {
	w.mu.Lock()
	defer w.mu.Unlock()

	if !w.written {
		w.WriteHeader(200)
	}
	return w.body.Write(data)
}

func (w *responseWriter) WriteString(s string) (int, error) {
	w.mu.Lock()
	defer w.mu.Unlock()

	if !w.written {
		w.WriteHeader(200)
	}
	return w.body.WriteString(s)
}

func (w *responseWriter) WriteHeader(statusCode int) {
	w.mu.Lock()
	defer w.mu.Unlock()

	if w.written {
		return
	}
	w.statusCode = statusCode
	w.written = true

	maps.Copy(w.headerMap, w.ResponseWriter.Header())
}

func (w *responseWriter) Header() http.Header {
	w.mu.RLock()
	defer w.mu.RUnlock()

	if w.headerMap == nil {
		w.headerMap = make(http.Header)
	}
	return w.headerMap
}
