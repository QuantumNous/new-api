package httpserver

import (
	"crypto/rand"
	"encoding/hex"
	"html"
	"net/http"
	"regexp"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
)

const MaxRequestBodyBytes int64 = 1 << 20

const RequestIDHeader = "X-Request-ID"

var requestIDPattern = regexp.MustCompile(`^[A-Za-z0-9_-]{16,64}$`)

type SecurityOptions struct {
	TrustedProxies  []string
	RequestObserver interface {
		ObserveRequest(route, method string, status int, duration time.Duration)
	}
	RequestLogger interface {
		LogRequest(requestID, method, route string, status int, duration time.Duration)
	}
}

func applySecurityMiddleware(router *gin.Engine, options SecurityOptions) error {
	if err := router.SetTrustedProxies(options.TrustedProxies); err != nil {
		return err
	}
	router.Use(requestIDMiddleware(), requestBodyLimitMiddleware(), securityHeadersMiddleware(), requestObservationMiddleware(options.RequestObserver, options.RequestLogger))
	return nil
}

func requestObservationMiddleware(observer interface {
	ObserveRequest(route, method string, status int, duration time.Duration)
}, logger interface {
	LogRequest(requestID, method, route string, status int, duration time.Duration)
}) gin.HandlerFunc {
	return func(context *gin.Context) {
		started := time.Now()
		context.Next()
		route := context.FullPath()
		if observer != nil {
			observer.ObserveRequest(route, context.Request.Method, context.Writer.Status(), time.Since(started))
		}
		if logger != nil {
			requestID, _ := context.Get(RequestIDHeader)
			logger.LogRequest(requestID.(string), context.Request.Method, route, context.Writer.Status(), time.Since(started))
		}
	}
}

func requestIDMiddleware() gin.HandlerFunc {
	return func(context *gin.Context) {
		requestID := context.GetHeader(RequestIDHeader)
		if !requestIDPattern.MatchString(requestID) {
			requestID = newRequestID()
		}
		context.Header(RequestIDHeader, requestID)
		context.Set(RequestIDHeader, requestID)
		context.Next()
	}
}

func requestBodyLimitMiddleware() gin.HandlerFunc {
	return func(context *gin.Context) {
		if context.Request.Body != nil {
			context.Request.Body = http.MaxBytesReader(context.Writer, context.Request.Body, MaxRequestBodyBytes)
		}
		context.Next()
	}
}

func securityHeadersMiddleware() gin.HandlerFunc {
	return func(context *gin.Context) {
		context.Header("Cache-Control", "no-store")
		context.Header("Content-Security-Policy", "default-src 'self'; img-src 'self' data:; base-uri 'none'; frame-ancestors 'none'; form-action 'self'")
		context.Header("Referrer-Policy", "no-referrer")
		context.Header("X-Content-Type-Options", "nosniff")
		context.Header("X-Frame-Options", "DENY")
		context.Next()
	}
}

func AbortErrorPage(context *gin.Context, status int) {
	context.Abort()
	context.Data(status, "text/html; charset=utf-8", []byte(MinimalErrorPage(status)))
}

func MinimalErrorPage(status int) string {
	return "<!doctype html><html><head><meta charset=\"utf-8\"><title>Request unavailable</title></head><body><h1>Request unavailable</h1><p>Status " + html.EscapeString(http.StatusText(status)) + "</p></body></html>"
}

func newRequestID() string {
	bytes := make([]byte, 16)
	if _, err := rand.Read(bytes); err != nil {
		return strings.Repeat("0", 32)
	}
	return hex.EncodeToString(bytes)
}
