package middleware

import (
	"fmt"
	"net"
	"net/http"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/gin-gonic/gin"
)

const requestLogClientIPKey = "client_ip"

func SetUpLogger(server *gin.Engine) {
	server.Use(gin.LoggerWithFormatter(func(param gin.LogFormatterParams) string {
		var requestID string
		if param.Keys != nil {
			requestID = param.Keys[common.RequestIdKey].(string)
		}

		clientIP := extractClientIP(param.Request)
		if clientIP == "" {
			clientIP = param.ClientIP
		}
		if clientIP == "" {
			clientIP = "unknown"
		}

		return fmt.Sprintf("[GIN] %s | %s | %3d | %13v | %15s | %7s %s\n",
			param.TimeStamp.Format("2006/01/02 - 15:04:05"),
			requestID,
			param.StatusCode,
			param.Latency,
			requestLogClientIPKey+"="+clientIP,
			param.Method,
			param.Path,
		)
	}))
}

func extractClientIP(r *http.Request) string {
	if r == nil {
		return ""
	}

	if xff := strings.TrimSpace(r.Header.Get("X-Forwarded-For")); xff != "" {
		first := strings.TrimSpace(strings.Split(xff, ",")[0])
		if ip := normalizeIP(first); ip != "" {
			return ip
		}
	}

	if xrip := strings.TrimSpace(r.Header.Get("X-Real-IP")); xrip != "" {
		if ip := normalizeIP(xrip); ip != "" {
			return ip
		}
	}

	host, _, err := net.SplitHostPort(strings.TrimSpace(r.RemoteAddr))
	if err == nil {
		if ip := normalizeIP(host); ip != "" {
			return ip
		}
	}

	if ip := normalizeIP(strings.TrimSpace(r.RemoteAddr)); ip != "" {
		return ip
	}

	return ""
}

func normalizeIP(v string) string {
	v = strings.TrimSpace(v)
	if v == "" {
		return ""
	}

	if strings.HasPrefix(v, "[") && strings.Contains(v, "]") {
		v = strings.TrimPrefix(v, "[")
		v = strings.SplitN(v, "]", 2)[0]
	}

	if strings.Contains(v, ":") && !strings.Contains(v, ".") {
		if ip := net.ParseIP(v); ip != nil {
			return ip.String()
		}
	}

	if ip := net.ParseIP(v); ip != nil {
		return ip.String()
	}

	return ""
}
