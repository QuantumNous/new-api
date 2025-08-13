package custompass

import (
	"errors"
	"fmt"
	"net/http"
)

// CustomPass error codes
const (
	ErrCodeInvalidRequest    = "INVALID_REQUEST"
	ErrCodeInsufficientQuota = "INSUFFICIENT_QUOTA"
	ErrCodeUpstreamError     = "UPSTREAM_ERROR"
	ErrCodeUpstreamResponse  = "UPSTREAM_RESPONSE"
	ErrCodeConfigError       = "CONFIG_ERROR"
	ErrCodeTimeout           = "TIMEOUT"
	ErrCodeSystemError       = "SYSTEM_ERROR"
	ErrCodeAuthError         = "AUTH_ERROR"
	ErrCodeTaskNotFound      = "TASK_NOT_FOUND"
	ErrCodePrechargeError    = "PRECHARGE_ERROR"
	ErrCodeBillingError      = "BILLING_ERROR"
	ErrCodeConcurrencyError  = "CONCURRENCY_ERROR"
	ErrCodeModelNotFound     = "MODEL_NOT_FOUND"
)

// CustomPassError represents a structured error for CustomPass operations
type CustomPassError struct {
	Code       string `json:"code"`
	Message    string `json:"message"`
	Details    string `json:"details,omitempty"`
	HTTPStatus int    `json:"-"`
}

func (e *CustomPassError) Error() string {
	if e.Details != "" {
		return fmt.Sprintf("[%s] %s: %s", e.Code, e.Message, e.Details)
	}
	return fmt.Sprintf("[%s] %s", e.Code, e.Message)
}

// Predefined error instances
var (
	ErrInvalidRequest = &CustomPassError{
		Code:       ErrCodeInvalidRequest,
		Message:    "请求参数无效",
		HTTPStatus: http.StatusBadRequest,
	}

	ErrInsufficientQuota = &CustomPassError{
		Code:       ErrCodeInsufficientQuota,
		Message:    "用户余额不足",
		HTTPStatus: http.StatusPaymentRequired,
	}

	ErrUpstreamError = &CustomPassError{
		Code:       ErrCodeUpstreamError,
		Message:    "上游API错误",
		HTTPStatus: http.StatusBadGateway,
	}

	ErrConfigError = &CustomPassError{
		Code:       ErrCodeConfigError,
		Message:    "配置错误",
		HTTPStatus: http.StatusInternalServerError,
	}

	ErrTimeout = &CustomPassError{
		Code:       ErrCodeTimeout,
		Message:    "请求超时",
		HTTPStatus: http.StatusGatewayTimeout,
	}

	ErrSystemError = &CustomPassError{
		Code:       ErrCodeSystemError,
		Message:    "系统内部错误",
		HTTPStatus: http.StatusInternalServerError,
	}

	ErrAuthError = &CustomPassError{
		Code:       ErrCodeAuthError,
		Message:    "认证失败",
		HTTPStatus: http.StatusUnauthorized,
	}

	ErrTaskNotFound = &CustomPassError{
		Code:       ErrCodeTaskNotFound,
		Message:    "任务不存在",
		HTTPStatus: http.StatusNotFound,
	}

	ErrPrechargeError = &CustomPassError{
		Code:       ErrCodePrechargeError,
		Message:    "预扣费失败",
		HTTPStatus: http.StatusPaymentRequired,
	}

	ErrBillingError = &CustomPassError{
		Code:       ErrCodeBillingError,
		Message:    "计费错误",
		HTTPStatus: http.StatusInternalServerError,
	}

	ErrConcurrencyError = &CustomPassError{
		Code:       ErrCodeConcurrencyError,
		Message:    "并发操作冲突",
		HTTPStatus: http.StatusConflict,
	}
)

// Error creation functions
func NewInvalidRequestError(details string) *CustomPassError {
	return &CustomPassError{
		Code:       ErrCodeInvalidRequest,
		Message:    "请求参数无效",
		Details:    details,
		HTTPStatus: http.StatusBadRequest,
	}
}

func NewInsufficientQuotaError(details string) *CustomPassError {
	return &CustomPassError{
		Code:       ErrCodeInsufficientQuota,
		Message:    "用户余额不足",
		Details:    details,
		HTTPStatus: http.StatusPaymentRequired,
	}
}

func NewUpstreamError(details string) *CustomPassError {
	return &CustomPassError{
		Code:       ErrCodeUpstreamError,
		Message:    "上游API错误",
		Details:    details,
		HTTPStatus: http.StatusBadGateway,
	}
}

func NewConfigError(details string) *CustomPassError {
	return &CustomPassError{
		Code:       ErrCodeConfigError,
		Message:    "配置错误",
		Details:    details,
		HTTPStatus: http.StatusInternalServerError,
	}
}

func NewTimeoutError(details string) *CustomPassError {
	return &CustomPassError{
		Code:       ErrCodeTimeout,
		Message:    "请求超时",
		Details:    details,
		HTTPStatus: http.StatusGatewayTimeout,
	}
}

func NewSystemError(details string) *CustomPassError {
	return &CustomPassError{
		Code:       ErrCodeSystemError,
		Message:    "系统内部错误",
		Details:    details,
		HTTPStatus: http.StatusInternalServerError,
	}
}

func NewAuthError(details string) *CustomPassError {
	return &CustomPassError{
		Code:       ErrCodeAuthError,
		Message:    "认证失败",
		Details:    details,
		HTTPStatus: http.StatusUnauthorized,
	}
}

func NewTaskNotFoundError(details string) *CustomPassError {
	return &CustomPassError{
		Code:       ErrCodeTaskNotFound,
		Message:    "任务不存在",
		Details:    details,
		HTTPStatus: http.StatusNotFound,
	}
}

func NewPrechargeError(details string) *CustomPassError {
	return &CustomPassError{
		Code:       ErrCodePrechargeError,
		Message:    "预扣费失败",
		Details:    details,
		HTTPStatus: http.StatusPaymentRequired,
	}
}

func NewBillingError(details string) *CustomPassError {
	return &CustomPassError{
		Code:       ErrCodeBillingError,
		Message:    "计费错误",
		Details:    details,
		HTTPStatus: http.StatusInternalServerError,
	}
}

func NewConcurrencyError(details string) *CustomPassError {
	return &CustomPassError{
		Code:       ErrCodeConcurrencyError,
		Message:    "并发操作冲突",
		Details:    details,
		HTTPStatus: http.StatusConflict,
	}
}

// NewCustomPassError creates a new CustomPassError with code and message
func NewCustomPassError(code, message string) *CustomPassError {
	httpStatus := http.StatusInternalServerError
	switch code {
	case ErrCodeInvalidRequest:
		httpStatus = http.StatusBadRequest
	case ErrCodeInsufficientQuota, ErrCodePrechargeError:
		httpStatus = http.StatusPaymentRequired
	case ErrCodeUpstreamError, ErrCodeUpstreamResponse:
		httpStatus = http.StatusBadGateway
	case ErrCodeTimeout:
		httpStatus = http.StatusGatewayTimeout
	case ErrCodeAuthError:
		httpStatus = http.StatusUnauthorized
	case ErrCodeTaskNotFound, ErrCodeModelNotFound:
		httpStatus = http.StatusNotFound
	case ErrCodeConcurrencyError:
		httpStatus = http.StatusConflict
	}

	return &CustomPassError{
		Code:       code,
		Message:    message,
		HTTPStatus: httpStatus,
	}
}

// NewCustomPassErrorWithCause creates a new CustomPassError with code, message and cause
func NewCustomPassErrorWithCause(code, message string, cause error) *CustomPassError {
	httpStatus := http.StatusInternalServerError
	switch code {
	case ErrCodeInvalidRequest:
		httpStatus = http.StatusBadRequest
	case ErrCodeInsufficientQuota, ErrCodePrechargeError:
		httpStatus = http.StatusPaymentRequired
	case ErrCodeUpstreamError, ErrCodeUpstreamResponse:
		httpStatus = http.StatusBadGateway
	case ErrCodeTimeout:
		httpStatus = http.StatusGatewayTimeout
	case ErrCodeAuthError:
		httpStatus = http.StatusUnauthorized
	case ErrCodeTaskNotFound, ErrCodeModelNotFound:
		httpStatus = http.StatusNotFound
	case ErrCodeConcurrencyError:
		httpStatus = http.StatusConflict
	}

	details := ""
	if cause != nil {
		details = cause.Error()
	}

	return &CustomPassError{
		Code:       code,
		Message:    message,
		Details:    details,
		HTTPStatus: httpStatus,
	}
}

// IsCustomPassError checks if an error is a CustomPassError
func IsCustomPassError(err error) bool {
	var customErr *CustomPassError
	return errors.As(err, &customErr)
}

// GetCustomPassError extracts CustomPassError from error
func GetCustomPassError(err error) *CustomPassError {
	var customErr *CustomPassError
	if errors.As(err, &customErr) {
		return customErr
	}
	return nil
}

// WrapError wraps a generic error into a CustomPassError
func WrapError(err error, code, message string) *CustomPassError {
	httpStatus := http.StatusInternalServerError
	switch code {
	case ErrCodeInvalidRequest:
		httpStatus = http.StatusBadRequest
	case ErrCodeInsufficientQuota, ErrCodePrechargeError:
		httpStatus = http.StatusPaymentRequired
	case ErrCodeUpstreamError:
		httpStatus = http.StatusBadGateway
	case ErrCodeTimeout:
		httpStatus = http.StatusGatewayTimeout
	case ErrCodeAuthError:
		httpStatus = http.StatusUnauthorized
	case ErrCodeTaskNotFound, ErrCodeModelNotFound:
		httpStatus = http.StatusNotFound
	case ErrCodeConcurrencyError:
		httpStatus = http.StatusConflict
	}

	return &CustomPassError{
		Code:       code,
		Message:    message,
		Details:    err.Error(),
		HTTPStatus: httpStatus,
	}
}
