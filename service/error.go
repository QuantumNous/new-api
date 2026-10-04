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
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/types"
)

func MidjourneyErrorWrapper(code int, desc string) *dto.MidjourneyResponse {
	return &dto.MidjourneyResponse{
		NewAPIError: true,
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
	if resp.StatusCode == 524 {
		CloseResponseBodyGracefully(resp)
		return upstreamHTMLAPIError(upstreamHTMLMessage(resp.Header, "", resp.StatusCode), resp.StatusCode)
	}
	newApiErr = types.InitOpenAIError(types.ErrorCodeBadResponseStatusCode, resp.StatusCode)

	responseBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return
	}
	CloseResponseBodyGracefully(resp)
	if message := upstreamHTMLMessage(resp.Header, string(responseBody), resp.StatusCode); message != "" {
		return upstreamHTMLAPIError(message, resp.StatusCode)
	}
	defer func() {
		// JSON envelopes can carry an escaped HTML page as the error message.
		// Replace the entire error so neither metadata nor showBodyWhenFail leaks it.
		if message := upstreamHTMLMessage(nil, newApiErr.Error(), resp.StatusCode); message != "" {
			newApiErr = upstreamHTMLAPIError(message, resp.StatusCode)
			return
		}
		attachRelayErrorMetadata(newApiErr, responseBody)
	}()
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

	if common.GetJsonType(errResponse.Error) == "object" || common.GetJsonType(errResponse.Detail) == "object" {
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
	message := errResponse.ToMessage()
	if message == "" {
		// The body parsed as JSON but carried no usable error message; log the
		// raw body so the upstream failure remains diagnosable.
		logger.LogError(ctx, fmt.Sprintf("bad response status code %d with empty error message, body: %s", resp.StatusCode, responseBodyPreview))
	}
	newApiErr = types.NewOpenAIError(errors.New(message), types.ErrorCodeBadResponseStatusCode, resp.StatusCode, types.ErrOptionWithUpstreamError())
	if showBodyWhenFail {
		newApiErr.Err = buildErrWithBody(newApiErr.Error())
	}
	return
}

func attachRelayErrorMetadata(apiErr *types.NewAPIError, responseBody []byte) {
	if apiErr == nil || len(responseBody) == 0 {
		return
	}
	if !hasCostInUSDTicks(responseBody) {
		return
	}
	apiErr.Metadata = append(json.RawMessage(nil), responseBody...)
}

func hasCostInUSDTicks(responseBody []byte) bool {
	var payload struct {
		Usage struct {
			CostInUSDTicks json.RawMessage `json:"cost_in_usd_ticks"`
		} `json:"usage"`
	}
	if err := common.Unmarshal(responseBody, &payload); err != nil {
		return false
	}
	raw := strings.TrimSpace(string(payload.Usage.CostInUSDTicks))
	return raw != "" && raw != "null"
}

func ResetStatusCode(newApiErr *types.NewAPIError, statusCodeMappingStr string) {
	if newApiErr == nil {
		return
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
	codeStr := strconv.Itoa(newApiErr.StatusCode)
	if value, ok := statusCodeMapping[codeStr]; ok {
		intCode, ok := parseStatusCodeMappingValue(value)
		if !ok {
			return
		}
		newApiErr.StatusCode = intCode
	}
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
	if statusCode == 524 {
		code = string(types.ErrorCodeUpstreamTimeout)
	}
	if message := upstreamHTMLMessage(nil, text, statusCode); message != "" {
		text = message
		err = errors.New(message)
	}
	lowerText := strings.ToLower(text)
	if strings.Contains(lowerText, "post") || strings.Contains(lowerText, "dial") || strings.Contains(lowerText, "http") {
		common.SysLog(fmt.Sprintf("error: %s", text))
		//text = "请求上游地址失败"
		text = common.MaskSensitiveInfo(text)
	}
	//避免暴露内部错误
	taskError := &dto.TaskError{
		Code:       code,
		Message:    text,
		StatusCode: statusCode,
		Error:      err,
	}
	var apiErr *types.NewAPIError
	if errors.As(err, &apiErr) {
		taskError.LocalError = apiErr.IsLocalError()
	}

	return taskError
}

// TaskErrorFromAPIError 将 PreConsumeBilling 返回的 NewAPIError 转换为 TaskError。
func TaskErrorFromAPIError(apiErr *types.NewAPIError) *dto.TaskError {
	if apiErr == nil {
		return nil
	}
	oai := apiErr.ToOpenAIError()
	message := oai.Message
	if message == "" {
		message = apiErr.Error()
	}
	return &dto.TaskError{
		LocalError: apiErr.IsLocalError(),
		Code:       string(apiErr.GetErrorCode()),
		Message:    message,
		StatusCode: apiErr.StatusCode,
		Error:      apiErr,
	}
}

func TaskErrorToAPIError(taskErr *dto.TaskError) *types.NewAPIError {
	if taskErr == nil {
		return nil
	}
	var apiErr *types.NewAPIError
	if errors.As(taskErr.Error, &apiErr) {
		if apiErr.StatusCode == 0 && taskErr.StatusCode != 0 {
			apiErr.StatusCode = taskErr.StatusCode
		}
		return apiErr
	}

	message := taskErr.Message
	if message == "" && taskErr.Error != nil {
		message = taskErr.Error.Error()
	}
	if message == "" {
		message = taskErr.Code
	}
	code := taskErr.Code
	if code == "" {
		code = string(types.ErrorCodeBadResponseStatusCode)
	}
	statusCode := taskErr.StatusCode
	if statusCode == 0 {
		statusCode = http.StatusInternalServerError
	}

	oai := types.OpenAIError{
		Message: message,
		Type:    code,
		Code:    code,
	}
	if taskErr.LocalError {
		return types.WithOpenAIError(oai, statusCode, types.ErrOptionWithLocalError())
	}
	if IsViolationFeeCode(types.ErrorCode(code)) {
		return types.WithOpenAIError(oai, statusCode, types.ErrOptionWithSkipRetry())
	}
	return types.WithOpenAIError(oai, statusCode)
}

func NormalizeViolationFeeTaskError(relayInfo *relaycommon.RelayInfo, taskErr *dto.TaskError) *dto.TaskError {
	if taskErr == nil {
		return nil
	}
	apiErr := NormalizeViolationFeeErrorForRelay(relayInfo, TaskErrorToAPIError(taskErr))
	if apiErr == nil {
		return taskErr
	}
	normalized := TaskErrorFromAPIError(apiErr)
	if normalized == nil {
		return taskErr
	}
	normalized.LocalError = taskErr.LocalError
	return normalized
}

func IsViolationFeeTaskError(taskErr *dto.TaskError) bool {
	if taskErr == nil {
		return false
	}
	if IsViolationFeeCode(types.ErrorCode(taskErr.Code)) {
		return true
	}
	apiErr := TaskErrorToAPIError(taskErr)
	return apiErr != nil && IsViolationFeeCode(apiErr.GetErrorCode())
}
