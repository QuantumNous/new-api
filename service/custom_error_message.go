package service

import (
	"errors"
	"strconv"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/types"
)

// ApplyCustomErrorMessage checks if the status_code_mapping contains a custom
// message override for the current error status code. If it does, the error
// message is replaced with the custom message in both Err and RelayError fields.
//
// The status_code_mapping field supports two value formats:
//
//  1. Simple number (original behavior, handled by ResetStatusCode):
//     {"503": 500}
//
//  2. Object with message and optional status_code:
//     {"503": {"status_code": 503, "message": "自定义错误文案"}}
//
// This function handles format 2 only. Format 1 is handled by ResetStatusCode.
func ApplyCustomErrorMessage(newApiErr *types.NewAPIError, statusCodeMappingStr string) {
	if newApiErr == nil {
		return
	}
	if statusCodeMappingStr == "" || statusCodeMappingStr == "{}" {
		return
	}
	if newApiErr.StatusCode == 200 {
		return
	}

	statusCodeMapping := make(map[string]any)
	err := common.Unmarshal([]byte(statusCodeMappingStr), &statusCodeMapping)
	if err != nil {
		return
	}

	codeStr := strconv.Itoa(newApiErr.StatusCode)
	value, ok := statusCodeMapping[codeStr]
	if !ok {
		return
	}

	// Only handle object format: {"503": {"message": "...", "status_code": 503}}
	obj, ok := value.(map[string]any)
	if !ok {
		return // simple number format, handled by ResetStatusCode
	}

	// Apply custom message to both Err and RelayError
	if message, ok := obj["message"].(string); ok && message != "" {
		// Set Err field (used by Error(), log messages, Claude format, default format)
		newApiErr.Err = errors.New(message)

		// Set RelayError field (used by ToOpenAIError() for OpenAI error format)
		if oaiErr, ok := newApiErr.RelayError.(types.OpenAIError); ok {
			oaiErr.Message = message
			newApiErr.RelayError = oaiErr
		} else if claudeErr, ok := newApiErr.RelayError.(types.ClaudeError); ok {
			claudeErr.Message = message
			newApiErr.RelayError = claudeErr
		}
	}

	// Apply status code override (same as ResetStatusCode but from object)
	if statusCodeRaw, exists := obj["status_code"]; exists {
		if intCode, ok := parseStatusCodeMappingValue(statusCodeRaw); ok {
			newApiErr.StatusCode = intCode
		}
	}
}
