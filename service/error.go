package service

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"math"
	"net/http"
	"strconv"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/logger"
	"github.com/QuantumNous/new-api/types"
)

func MidjourneyErrorWrapper(code int, desc string) *dto.MidjourneyResponse {
	return &dto.MidjourneyResponse{
		Code:        code,
		Description: desc,
	}
}

func MidjourneyErrorWithStatusCodeWrapper(code int, desc string, statusCode int) *dto.MidjourneyResponseWithStatusCode {
	return &dto.MidjourneyResponseWithStatusCode{
		StatusCode: statusCode,
		Response:   *MidjourneyErrorWrapper(code, desc),
	}
}

//// OpenAIErrorWrapper wraps an error into an OpenAIErrorWithStatusCode
//func OpenAIErrorWrapper(err error, code string, statusCode int) *dto.OpenAIErrorWithStatusCode {
//	text := err.Error()
//	lowerText := strings.ToLower(text)
//	if !strings.HasPrefix(lowerText, "get file base64 from url") && !strings.HasPrefix(lowerText, "mime type is not supported") {
//		if strings.Contains(lowerText, "post") || strings.Contains(lowerText, "dial") || strings.Contains(lowerText, "http") {
//			common.SysLog(fmt.Sprintf("error: %s", text))
//			text = "请求上游地址失败"
//		}
//	}
//	openAIError := dto.OpenAIError{
//		Message: text,
//		Type:    "new_api_error",
//		Code:    code,
//	}
//	return &dto.OpenAIErrorWithStatusCode{
//		Error:      openAIError,
//		StatusCode: statusCode,
//	}
//}
//
//func OpenAIErrorWrapperLocal(err error, code string, statusCode int) *dto.OpenAIErrorWithStatusCode {
//	openaiErr := OpenAIErrorWrapper(err, code, statusCode)
//	openaiErr.LocalError = true
//	return openaiErr
//}

func ClaudeErrorWrapper(err error, code string, statusCode int) *dto.ClaudeErrorWithStatusCode {
	text := err.Error()
	lowerText := strings.ToLower(text)
	if !strings.HasPrefix(lowerText, "get file base64 from url") {
		if strings.Contains(lowerText, "post") || strings.Contains(lowerText, "dial") || strings.Contains(lowerText, "http") {
			common.SysLog(fmt.Sprintf("error: %s", text))
			text = "请求上游地址失败"
		}
	}
	claudeError := types.ClaudeError{
		Message: text,
		Type:    "new_api_error",
	}
	return &dto.ClaudeErrorWithStatusCode{
		Error:      claudeError,
		StatusCode: statusCode,
	}
}

func ClaudeErrorWrapperLocal(err error, code string, statusCode int) *dto.ClaudeErrorWithStatusCode {
	claudeErr := ClaudeErrorWrapper(err, code, statusCode)
	claudeErr.LocalError = true
	return claudeErr
}

func RelayErrorHandler(ctx context.Context, resp *http.Response, showBodyWhenFail bool) (newApiErr *types.NewAPIError) {
	newApiErr = types.InitOpenAIError(types.ErrorCodeBadResponseStatusCode, resp.StatusCode)

	responseBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return
	}
	CloseResponseBodyGracefully(resp)
	var errResponse dto.GeneralErrorResponse
	responseBodyText := string(responseBody)
	responseBodyPreview := common.LocalLogPreview(responseBodyText)
	buildErrWithBody := func(message string) error {
		if message == "" {
			return fmt.Errorf("bad response status code %d, body: %s", resp.StatusCode, responseBodyText)
		}
		return fmt.Errorf("bad response status code %d, message: %s, body: %s", resp.StatusCode, message, responseBodyText)
	}

	err = common.Unmarshal(responseBody, &errResponse)
	if err != nil {
		if showBodyWhenFail {
			newApiErr.Err = buildErrWithBody("")
		} else {
			logger.LogError(ctx, fmt.Sprintf("bad response status code %d, body: %s", resp.StatusCode, responseBodyPreview))
			newApiErr.Err = fmt.Errorf("bad response status code %d", resp.StatusCode)
		}
		return
	}

	if common.GetJsonType(errResponse.Error) == "object" {
		// General format error (OpenAI, Anthropic, Gemini, etc.)
		oaiError := errResponse.TryToOpenAIError()
		if oaiError != nil {
			newApiErr = types.WithOpenAIError(*oaiError, resp.StatusCode)
			if showBodyWhenFail {
				newApiErr.Err = buildErrWithBody(newApiErr.Error())
			}
			return
		}
	}
	newApiErr = types.NewOpenAIError(errors.New(errResponse.ToMessage()), types.ErrorCodeBadResponseStatusCode, resp.StatusCode)
	if showBodyWhenFail {
		newApiErr.Err = buildErrWithBody(newApiErr.Error())
	}
	return
}

func ResetStatusCode(newApiErr *types.NewAPIError, statusCodeMappingStr string) {
	if newApiErr == nil {
		return
	}
	if newApiErr.OriginalStatusCode == 0 {
		newApiErr.OriginalStatusCode = newApiErr.StatusCode
	}
	if statusCodeMappingStr == "" || statusCodeMappingStr == "{}" {
		return
	}
	statusCodeMapping := make(map[string]any)
	err := common.Unmarshal([]byte(statusCodeMappingStr), &statusCodeMapping)
	if err != nil {
		return
	}
	if newApiErr.StatusCode == http.StatusOK {
		return
	}
	codeStr := strconv.Itoa(newApiErr.GetOriginalStatusCode())
	if value, ok := statusCodeMapping[codeStr]; ok {
		intCode, ok := parseStatusCodeMappingValue(value)
		if !ok {
			return
		}
		newApiErr.StatusCode = intCode
	}
}

type statusCodeResponseMappingEntry struct {
	StatusCode *int
	Message    *string
	Type       *string
	Code       *string
}

func ApplyStatusCodeResponseMapping(newApiErr *types.NewAPIError, statusCodeResponseMappingStr string) bool {
	if newApiErr == nil {
		return false
	}
	entry, ok := matchStatusCodeResponseMapping(newApiErr.GetOriginalStatusCode(), statusCodeResponseMappingStr)
	if !ok {
		return false
	}
	if entry.StatusCode != nil {
		newApiErr.StatusCode = *entry.StatusCode
	}
	if entry.Message != nil || entry.Type != nil || entry.Code != nil {
		newApiErr.SetResponseOverride(types.ErrorResponseOverride{
			Message: entry.Message,
			Type:    entry.Type,
			Code:    entry.Code,
		})
	}
	return entry.Message != nil
}

// ResolveStatusCodeWithResponseMapping returns the HTTP status that will be sent
// to clients after status code response mapping is applied. The input error is
// not mutated.
func ResolveStatusCodeWithResponseMapping(newApiErr *types.NewAPIError, statusCodeResponseMappingStr string) int {
	if newApiErr == nil {
		return 0
	}
	entry, ok := matchStatusCodeResponseMapping(newApiErr.GetOriginalStatusCode(), statusCodeResponseMappingStr)
	if ok && entry.StatusCode != nil {
		return *entry.StatusCode
	}
	return newApiErr.StatusCode
}

// FormatErrorLogWithStatusCodeResponseMapping returns the error log content that
// matches the user-facing response after status code response mapping is applied.
// It does not mutate the original error (so retry / auto-disable keep using the
// pre-response-mapping status code and message).
func FormatErrorLogWithStatusCodeResponseMapping(newApiErr *types.NewAPIError, statusCodeResponseMappingStr string) string {
	if newApiErr == nil {
		return ""
	}
	entry, ok := matchStatusCodeResponseMapping(newApiErr.GetOriginalStatusCode(), statusCodeResponseMappingStr)
	if !ok {
		return newApiErr.MaskSensitiveErrorWithStatusCode()
	}

	statusCode := newApiErr.StatusCode
	if entry.StatusCode != nil {
		statusCode = *entry.StatusCode
	}

	message := newApiErr.MaskSensitiveError()
	if entry.Message != nil {
		message = common.MaskSensitiveInfo(*entry.Message)
	}
	if statusCode == 0 {
		return message
	}
	if message == "" {
		return fmt.Sprintf("status_code=%d", statusCode)
	}
	return fmt.Sprintf("status_code=%d, %s", statusCode, message)
}

func ApplyStatusCodeResponseMappingToTaskError(taskErr *dto.TaskError, statusCodeResponseMappingStr string) bool {
	if taskErr == nil {
		return false
	}
	statusCode := taskErr.OriginalStatusCode
	if statusCode == 0 {
		statusCode = taskErr.StatusCode
	}
	entry, ok := matchStatusCodeResponseMapping(statusCode, statusCodeResponseMappingStr)
	if !ok {
		return false
	}
	if entry.StatusCode != nil {
		taskErr.StatusCode = *entry.StatusCode
	}
	if entry.Message != nil {
		taskErr.Message = *entry.Message
		taskErr.Error = errors.New(*entry.Message)
	}
	if entry.Code != nil {
		taskErr.Code = *entry.Code
	}
	return entry.Message != nil
}

func ValidateStatusCodeResponseMapping(statusCodeResponseMappingStr string) error {
	if statusCodeResponseMappingStr == "" || statusCodeResponseMappingStr == "{}" {
		return nil
	}
	var rawMapping map[string]any
	if err := common.Unmarshal([]byte(statusCodeResponseMappingStr), &rawMapping); err != nil {
		return fmt.Errorf("status_code_response_mapping must be a valid JSON object: %w", err)
	}
	for rawStatusCode, rawEntry := range rawMapping {
		statusCode, err := strconv.Atoi(rawStatusCode)
		if err != nil || !isValidHTTPStatusCode(statusCode) {
			return fmt.Errorf("status_code_response_mapping key %q must be a valid HTTP status code", rawStatusCode)
		}
		entry, ok := rawEntry.(map[string]any)
		if !ok {
			return fmt.Errorf("status_code_response_mapping entry for %s must be a JSON object", rawStatusCode)
		}
		for field, rawValue := range entry {
			switch field {
			case "status_code":
				targetStatusCode, ok := parseStatusCodeMappingValue(rawValue)
				if !ok || !isValidHTTPStatusCode(targetStatusCode) {
					return fmt.Errorf("status_code_response_mapping status_code for %s must be a valid HTTP status code", rawStatusCode)
				}
			case "message", "type", "code":
				if _, ok := rawValue.(string); !ok {
					return fmt.Errorf("status_code_response_mapping %s for %s must be a string", field, rawStatusCode)
				}
			default:
				return fmt.Errorf("status_code_response_mapping field %q for %s is not supported", field, rawStatusCode)
			}
		}
	}
	return nil
}

func matchStatusCodeResponseMapping(statusCode int, statusCodeResponseMappingStr string) (statusCodeResponseMappingEntry, bool) {
	if statusCode == 0 || statusCodeResponseMappingStr == "" || statusCodeResponseMappingStr == "{}" {
		return statusCodeResponseMappingEntry{}, false
	}
	var statusCodeResponseMapping map[string]map[string]any
	if err := common.Unmarshal([]byte(statusCodeResponseMappingStr), &statusCodeResponseMapping); err != nil {
		return statusCodeResponseMappingEntry{}, false
	}
	rawEntry, ok := statusCodeResponseMapping[strconv.Itoa(statusCode)]
	if !ok {
		return statusCodeResponseMappingEntry{}, false
	}
	entry := statusCodeResponseMappingEntry{}
	if rawStatusCode, ok := rawEntry["status_code"]; ok {
		if statusCode, valid := parseStatusCodeMappingValue(rawStatusCode); valid && isValidHTTPStatusCode(statusCode) {
			entry.StatusCode = common.GetPointer(statusCode)
		}
	}
	if message, ok := rawEntry["message"].(string); ok {
		entry.Message = common.GetPointer(message)
	}
	if errorType, ok := rawEntry["type"].(string); ok {
		entry.Type = common.GetPointer(errorType)
	}
	if errorCode, ok := rawEntry["code"].(string); ok {
		entry.Code = common.GetPointer(errorCode)
	}
	if entry.StatusCode == nil && entry.Message == nil && entry.Type == nil && entry.Code == nil {
		return statusCodeResponseMappingEntry{}, false
	}
	return entry, true
}

func isValidHTTPStatusCode(statusCode int) bool {
	return statusCode >= http.StatusContinue && statusCode <= 599
}

func parseStatusCodeMappingValue(value any) (int, bool) {
	switch v := value.(type) {
	case string:
		if v == "" {
			return 0, false
		}
		statusCode, err := strconv.Atoi(v)
		if err != nil {
			return 0, false
		}
		return statusCode, true
	case float64:
		if v != math.Trunc(v) {
			return 0, false
		}
		return int(v), true
	case int:
		return v, true
	case json.Number:
		statusCode, err := strconv.Atoi(v.String())
		if err != nil {
			return 0, false
		}
		return statusCode, true
	default:
		return 0, false
	}
}

func TaskErrorWrapperLocal(err error, code string, statusCode int) *dto.TaskError {
	openaiErr := TaskErrorWrapper(err, code, statusCode)
	openaiErr.LocalError = true
	return openaiErr
}

func TaskErrorWrapper(err error, code string, statusCode int) *dto.TaskError {
	text := err.Error()
	lowerText := strings.ToLower(text)
	if strings.Contains(lowerText, "post") || strings.Contains(lowerText, "dial") || strings.Contains(lowerText, "http") {
		common.SysLog(fmt.Sprintf("error: %s", text))
		//text = "请求上游地址失败"
		text = common.MaskSensitiveInfo(text)
	}
	//避免暴露内部错误
	taskError := &dto.TaskError{
		Code:               code,
		Message:            text,
		StatusCode:         statusCode,
		OriginalStatusCode: statusCode,
		Error:              err,
	}

	return taskError
}

// TaskErrorFromAPIError 将 PreConsumeBilling 返回的 NewAPIError 转换为 TaskError。
func TaskErrorFromAPIError(apiErr *types.NewAPIError) *dto.TaskError {
	if apiErr == nil {
		return nil
	}
	return &dto.TaskError{
		Code:               string(apiErr.GetErrorCode()),
		Message:            apiErr.Err.Error(),
		StatusCode:         apiErr.StatusCode,
		OriginalStatusCode: apiErr.GetOriginalStatusCode(),
		Error:              apiErr.Err,
	}
}
