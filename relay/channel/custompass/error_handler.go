package custompass

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"net"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"one-api/common"
)

// ErrorHandler handles CustomPass errors and provides structured error responses
type ErrorHandler struct{}

// NewErrorHandler creates a new error handler
func NewErrorHandler() *ErrorHandler {
	return &ErrorHandler{}
}

// HandleError processes errors and returns appropriate HTTP responses
func (h *ErrorHandler) HandleError(c *gin.Context, err error) {
	if err == nil {
		return
	}

	// Extract request context for logging
	requestID := c.GetString("request_id")
	userID := c.GetInt("user_id")
	channelID := c.GetInt("channel_id")

	// Check if it's already a CustomPassError
	if customErr := GetCustomPassError(err); customErr != nil {
		h.logError(requestID, userID, channelID, customErr, err)
		c.JSON(customErr.HTTPStatus, customErr)
		return
	}

	// Classify and wrap the error
	customErr := h.classifyError(err)
	h.logError(requestID, userID, channelID, customErr, err)
	c.JSON(customErr.HTTPStatus, customErr)
}

// classifyError converts generic errors into CustomPassError
func (h *ErrorHandler) classifyError(err error) *CustomPassError {
	switch {
	// Network and timeout errors
	case isTimeoutError(err):
		return NewTimeoutError(err.Error())
	case isNetworkError(err):
		return NewUpstreamError("网络连接失败: " + err.Error())

	// Database errors
	case isDatabaseError(err):
		return h.classifyDatabaseError(err)

	// Context errors
	case errors.Is(err, context.Canceled):
		return NewTimeoutError("请求被取消")
	case errors.Is(err, context.DeadlineExceeded):
		return NewTimeoutError("请求超时")

	// HTTP errors
	case isHTTPError(err):
		return h.classifyHTTPError(err)

	// Configuration errors
	case isConfigError(err):
		return NewConfigError(err.Error())

	// Authentication errors
	case isAuthError(err):
		return NewAuthError(err.Error())

	// Default to system error
	default:
		return NewSystemError(err.Error())
	}
}

// classifyDatabaseError handles database-specific errors
func (h *ErrorHandler) classifyDatabaseError(err error) *CustomPassError {
	switch {
	case errors.Is(err, sql.ErrNoRows):
		return NewTaskNotFoundError("记录不存在")
	case isDuplicateKeyError(err):
		return NewConcurrencyError("数据重复，请重试")
	case isDeadlockError(err):
		return NewConcurrencyError("数据库死锁，请重试")
	case isConnectionError(err):
		return NewSystemError("数据库连接失败")
	default:
		return NewSystemError("数据库操作失败: " + err.Error())
	}
}

// classifyHTTPError handles HTTP-specific errors
func (h *ErrorHandler) classifyHTTPError(err error) *CustomPassError {
	errStr := err.Error()
	switch {
	case strings.Contains(errStr, "400"):
		return NewInvalidRequestError("请求参数错误")
	case strings.Contains(errStr, "401"):
		return NewAuthError("认证失败")
	case strings.Contains(errStr, "402"):
		return NewInsufficientQuotaError("余额不足")
	case strings.Contains(errStr, "403"):
		return NewAuthError("权限不足")
	case strings.Contains(errStr, "404"):
		return NewTaskNotFoundError("资源不存在")
	case strings.Contains(errStr, "429"):
		return NewUpstreamError("请求频率过高")
	case strings.Contains(errStr, "500"):
		return NewUpstreamError("上游服务器错误")
	case strings.Contains(errStr, "502"):
		return NewUpstreamError("网关错误")
	case strings.Contains(errStr, "503"):
		return NewUpstreamError("服务不可用")
	case strings.Contains(errStr, "504"):
		return NewTimeoutError("网关超时")
	default:
		return NewUpstreamError("HTTP请求失败: " + err.Error())
	}
}

// logError logs error details with structured logging
func (h *ErrorHandler) logError(requestID string, userID, channelID int, customErr *CustomPassError, originalErr error) {
	// Build log message with structured information
	logMsg := fmt.Sprintf("CustomPass error - Code: %s, Message: %s, HTTPStatus: %d",
		customErr.Code, customErr.Message, customErr.HTTPStatus)

	if requestID != "" {
		logMsg += fmt.Sprintf(", RequestID: %s", requestID)
	}
	if userID > 0 {
		logMsg += fmt.Sprintf(", UserID: %d", userID)
	}
	if channelID > 0 {
		logMsg += fmt.Sprintf(", ChannelID: %d", channelID)
	}
	if customErr.Details != "" {
		logMsg += fmt.Sprintf(", Details: %s", customErr.Details)
	}
	if originalErr != nil {
		logMsg += fmt.Sprintf(", OriginalError: %s", originalErr.Error())
	}

	// Create context for logging
	ctx := context.Background()
	if requestID != "" {
		ctx = context.WithValue(ctx, common.RequestIdKey, requestID)
	}

	// Log based on error severity
	switch customErr.Code {
	case ErrCodeSystemError, ErrCodeConfigError, ErrCodeBillingError:
		common.LogError(ctx, logMsg)
	case ErrCodeTimeout, ErrCodeUpstreamError, ErrCodeConcurrencyError:
		common.LogWarn(ctx, logMsg)
	default:
		common.LogInfo(ctx, logMsg)
	}
}

// Error classification helper functions
func isTimeoutError(err error) bool {
	if netErr, ok := err.(net.Error); ok && netErr.Timeout() {
		return true
	}
	return errors.Is(err, context.DeadlineExceeded) ||
		strings.Contains(err.Error(), "timeout") ||
		strings.Contains(err.Error(), "deadline exceeded")
}

func isNetworkError(err error) bool {
	if _, ok := err.(net.Error); ok {
		return true
	}
	return strings.Contains(err.Error(), "connection refused") ||
		strings.Contains(err.Error(), "no such host") ||
		strings.Contains(err.Error(), "network is unreachable")
}

func isDatabaseError(err error) bool {
	return errors.Is(err, sql.ErrNoRows) ||
		errors.Is(err, sql.ErrTxDone) ||
		errors.Is(err, sql.ErrConnDone) ||
		strings.Contains(err.Error(), "database") ||
		strings.Contains(err.Error(), "sql")
}

func isDuplicateKeyError(err error) bool {
	errStr := strings.ToLower(err.Error())
	return strings.Contains(errStr, "duplicate") ||
		strings.Contains(errStr, "unique constraint") ||
		strings.Contains(errStr, "duplicate key")
}

func isDeadlockError(err error) bool {
	errStr := strings.ToLower(err.Error())
	return strings.Contains(errStr, "deadlock") ||
		strings.Contains(errStr, "lock wait timeout")
}

func isConnectionError(err error) bool {
	errStr := strings.ToLower(err.Error())
	return strings.Contains(errStr, "connection") ||
		strings.Contains(errStr, "connect")
}

func isHTTPError(err error) bool {
	errStr := err.Error()
	return strings.Contains(errStr, "HTTP") ||
		strings.Contains(errStr, "status code") ||
		strings.Contains(errStr, "400") ||
		strings.Contains(errStr, "401") ||
		strings.Contains(errStr, "403") ||
		strings.Contains(errStr, "404") ||
		strings.Contains(errStr, "500") ||
		strings.Contains(errStr, "502") ||
		strings.Contains(errStr, "503") ||
		strings.Contains(errStr, "504")
}

func isConfigError(err error) bool {
	errStr := strings.ToLower(err.Error())
	return strings.Contains(errStr, "config") ||
		strings.Contains(errStr, "configuration") ||
		strings.Contains(errStr, "invalid setting") ||
		strings.Contains(errStr, "missing required")
}

func isAuthError(err error) bool {
	errStr := strings.ToLower(err.Error())
	return strings.Contains(errStr, "unauthorized") ||
		strings.Contains(errStr, "authentication") ||
		strings.Contains(errStr, "invalid token") ||
		strings.Contains(errStr, "access denied")
}

// RecoverFromPanic recovers from panics and converts them to errors
func (h *ErrorHandler) RecoverFromPanic(c *gin.Context) {
	if r := recover(); r != nil {
		var err error
		switch x := r.(type) {
		case string:
			err = errors.New(x)
		case error:
			err = x
		default:
			err = errors.New("unknown panic")
		}

		// Log panic with context
		requestID := c.GetString("request_id")
		ctx := context.Background()
		if requestID != "" {
			ctx = context.WithValue(ctx, common.RequestIdKey, requestID)
		}

		logMsg := fmt.Sprintf("CustomPass panic recovered - Panic: %v, Error: %s", r, err.Error())
		common.LogError(ctx, logMsg)

		customErr := NewSystemError("系统发生异常: " + err.Error())
		c.JSON(customErr.HTTPStatus, customErr)
		c.Abort()
	}
}

// ValidateAndHandleError validates input and handles validation errors
func (h *ErrorHandler) ValidateAndHandleError(c *gin.Context, validator func() error) bool {
	if err := validator(); err != nil {
		h.HandleError(c, NewInvalidRequestError(err.Error()))
		return false
	}
	return true
}

// HandleUpstreamError specifically handles upstream API errors
func (h *ErrorHandler) HandleUpstreamError(c *gin.Context, statusCode int, body []byte) {
	var customErr *CustomPassError

	switch statusCode {
	case http.StatusBadRequest:
		customErr = NewInvalidRequestError("上游API参数错误: " + string(body))
	case http.StatusUnauthorized:
		customErr = NewAuthError("上游API认证失败: " + string(body))
	case http.StatusPaymentRequired:
		customErr = NewInsufficientQuotaError("上游API余额不足: " + string(body))
	case http.StatusForbidden:
		customErr = NewAuthError("上游API权限不足: " + string(body))
	case http.StatusNotFound:
		customErr = NewTaskNotFoundError("上游API资源不存在: " + string(body))
	case http.StatusTooManyRequests:
		customErr = NewUpstreamError("上游API请求频率过高: " + string(body))
	case http.StatusInternalServerError:
		customErr = NewUpstreamError("上游API服务器错误: " + string(body))
	case http.StatusBadGateway:
		customErr = NewUpstreamError("上游API网关错误: " + string(body))
	case http.StatusServiceUnavailable:
		customErr = NewUpstreamError("上游API服务不可用: " + string(body))
	case http.StatusGatewayTimeout:
		customErr = NewTimeoutError("上游API网关超时: " + string(body))
	default:
		customErr = NewUpstreamError("上游API未知错误: " + string(body))
	}

	h.HandleError(c, customErr)
}
