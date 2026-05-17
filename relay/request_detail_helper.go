package relay

import (
	"bytes"
	"io"
	"net/http"
	"strings"
	"sync"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	relaycommon "github.com/QuantumNous/new-api/relay/common"

	"github.com/gin-gonic/gin"
)

func buildRecordDetailFunc(c *gin.Context, info *relaycommon.RelayInfo, reqBody string, httpResp **http.Response) func() {
	requestId := c.GetString(common.RequestIdKey)
	userId := c.GetInt("id")
	var recordOnce sync.Once
	return func() {
		recordOnce.Do(func() {
			reqHeaders := ""
			if v, exists := c.Get("upstream_request_headers"); exists {
				if h, ok := v.(http.Header); ok {
					reqHeaders = model.MarshalHeaders(sanitizeRecordedHeaders(h))
				}
			}
			respHeaders := ""
			if *httpResp != nil {
				respHeaders = model.MarshalHeaders(sanitizeRecordedHeaders((*httpResp).Header))
			}
			respBody := ""
			if !info.IsStream {
				if v, exists := c.Get("upstream_response_body"); exists {
					respBody, _ = v.(string)
				} else if v, exists := c.Get("upstream_response_body_buf"); exists {
					if buf, ok := v.(*bytes.Buffer); ok {
						respBody = buf.String()
					}
				}
			}
			if respBody == "" && *httpResp != nil && (*httpResp).Body != nil {
				if bodyBytes, readErr := io.ReadAll((*httpResp).Body); readErr == nil && len(bodyBytes) > 0 {
					respBody = string(bodyBytes)
				}
			}
			go model.RecordRequestDetail(requestId, userId, reqHeaders, reqBody, respHeaders, respBody)
		})
	}
}

func sanitizeRecordedHeaders(headers http.Header) http.Header {
	sanitized := headers.Clone()
	for key := range sanitized {
		if isSensitiveHeader(key) {
			sanitized[key] = []string{"[redacted]"}
		}
	}
	return sanitized
}

func isSensitiveHeader(key string) bool {
	switch strings.ToLower(key) {
	case "authorization",
		"proxy-authorization",
		"cookie",
		"set-cookie",
		"x-api-key",
		"x-api-token",
		"api-key",
		"api-token":
		return true
	default:
		return false
	}
}
