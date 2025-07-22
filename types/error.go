package types

import (
	"errors"
	"fmt"
	"net/http"
	"strings"
)

type OpenAIError struct {
	Message string `json:"message"`
	Type    string `json:"type"`
	Param   string `json:"param"`
	Code    any    `json:"code"`
}

type ClaudeError struct {
	Message string `json:"message,omitempty"`
	Type    string `json:"type,omitempty"`
}

type ErrorType string

const (
	ErrorTypeNewAPIError     ErrorType = "new_api_error"
	ErrorTypeOpenAIError     ErrorType = "openai_error"
	ErrorTypeClaudeError     ErrorType = "claude_error"
	ErrorTypeMidjourneyError ErrorType = "midjourney_error"
	ErrorTypeGeminiError     ErrorType = "gemini_error"
	ErrorTypeRerankError     ErrorType = "rerank_error"
)

type ErrorCode string

const (
	ErrorCodeInvalidRequest         ErrorCode = "invalid_request"
	ErrorCodeSensitiveWordsDetected ErrorCode = "sensitive_words_detected"

	// new api error
	ErrorCodeCountTokenFailed  ErrorCode = "count_token_failed"
	ErrorCodeModelPriceError   ErrorCode = "model_price_error"
	ErrorCodeInvalidApiType    ErrorCode = "invalid_api_type"
	ErrorCodeJsonMarshalFailed ErrorCode = "json_marshal_failed"
	ErrorCodeDoRequestFailed   ErrorCode = "do_request_failed"
	ErrorCodeGetChannelFailed  ErrorCode = "get_channel_failed"

	// channel error
	ErrorCodeChannelNoAvailableKey       ErrorCode = "channel:no_available_key"
	ErrorCodeChannelParamOverrideInvalid ErrorCode = "channel:param_override_invalid"
	ErrorCodeChannelModelMappedError     ErrorCode = "channel:model_mapped_error"
	ErrorCodeChannelAwsClientError       ErrorCode = "channel:aws_client_error"
	ErrorCodeChannelInvalidKey           ErrorCode = "channel:invalid_key"
	ErrorCodeChannelResponseTimeExceeded ErrorCode = "channel:response_time_exceeded"

	// client request error
	ErrorCodeReadRequestBodyFailed ErrorCode = "read_request_body_failed"
	ErrorCodeConvertRequestFailed  ErrorCode = "convert_request_failed"
	ErrorCodeAccessDenied          ErrorCode = "access_denied"

	// response error
	ErrorCodeReadResponseBodyFailed ErrorCode = "read_response_body_failed"
	ErrorCodeBadResponseStatusCode  ErrorCode = "bad_response_status_code"
	ErrorCodeBadResponse            ErrorCode = "bad_response"
	ErrorCodeBadResponseBody        ErrorCode = "bad_response_body"

	// sql error
	ErrorCodeQueryDataError  ErrorCode = "query_data_error"
	ErrorCodeUpdateDataError ErrorCode = "update_data_error"

	// quota error
	ErrorCodeInsufficientUserQuota      ErrorCode = "insufficient_user_quota"
	ErrorCodePreConsumeTokenQuotaFailed ErrorCode = "pre_consume_token_quota_failed"
)

type NewAPIError struct {
	Err        error
	RelayError any
	ErrorType  ErrorType
	errorCode  ErrorCode
	StatusCode int
}

func (e *NewAPIError) GetErrorCode() ErrorCode {
	if e == nil {
		return ""
	}
	return e.errorCode
}

func (e *NewAPIError) Error() string {
	if e == nil {
		return ""
	}
	if e.Err == nil {
		// fallback message when underlying error is missing
		return string(e.errorCode)
	}
	return e.Err.Error()
}

func (e *NewAPIError) SetMessage(message string) {
	e.Err = errors.New(message)
}

func (e *NewAPIError) ToOpenAIError() OpenAIError {
	switch e.ErrorType {
	case ErrorTypeOpenAIError:
		return e.RelayError.(OpenAIError)
	case ErrorTypeClaudeError:
		claudeError := e.RelayError.(ClaudeError)
		return OpenAIError{
			Message: e.Error(),
			Type:    claudeError.Type,
			Param:   "",
			Code:    e.errorCode,
		}
	default:
		return OpenAIError{
			Message: e.Error(),
			Type:    string(e.ErrorType),
			Param:   "",
			Code:    e.errorCode,
		}
	}
}

func (e *NewAPIError) ToClaudeError() ClaudeError {
	switch e.ErrorType {
	case ErrorTypeOpenAIError:
		openAIError := e.RelayError.(OpenAIError)
		return ClaudeError{
			Message: e.Error(),
			Type:    fmt.Sprintf("%v", openAIError.Code),
		}
	case ErrorTypeClaudeError:
		return e.RelayError.(ClaudeError)
	default:
		return ClaudeError{
			Message: e.Error(),
			Type:    string(e.ErrorType),
		}
	}
}

func NewError(err error, errorCode ErrorCode) *NewAPIError {
	return &NewAPIError{
		Err:        err,
		RelayError: nil,
		ErrorType:  ErrorTypeNewAPIError,
		StatusCode: http.StatusInternalServerError,
		errorCode:  errorCode,
	}
}

func NewOpenAIError(err error, errorCode ErrorCode, statusCode int) *NewAPIError {
	openaiError := OpenAIError{
		Message: err.Error(),
		Type:    string(errorCode),
	}
	return WithOpenAIError(openaiError, statusCode)
}

func NewErrorWithStatusCode(err error, errorCode ErrorCode, statusCode int) *NewAPIError {
	return &NewAPIError{
		Err:        err,
		RelayError: nil,
		ErrorType:  ErrorTypeNewAPIError,
		StatusCode: statusCode,
		errorCode:  errorCode,
	}
}

func WithOpenAIError(openAIError OpenAIError, statusCode int) *NewAPIError {
	code, ok := openAIError.Code.(string)
	if !ok {
		code = fmt.Sprintf("%v", openAIError.Code)
	}
	return &NewAPIError{
		RelayError: openAIError,
		ErrorType:  ErrorTypeOpenAIError,
		StatusCode: statusCode,
		Err:        errors.New(openAIError.Message),
		errorCode:  ErrorCode(code),
	}
}

func WithClaudeError(claudeError ClaudeError, statusCode int) *NewAPIError {
	return &NewAPIError{
		RelayError: claudeError,
		ErrorType:  ErrorTypeClaudeError,
		StatusCode: statusCode,
		Err:        errors.New(claudeError.Message),
		errorCode:  ErrorCode(claudeError.Type),
	}
}

func IsChannelError(err *NewAPIError) bool {
	if err == nil {
		return false
	}
	return strings.HasPrefix(string(err.errorCode), "channel:")
}

func IsLocalError(err *NewAPIError) bool {
	if err == nil {
		return false
	}

	return err.ErrorType == ErrorTypeNewAPIError
}
