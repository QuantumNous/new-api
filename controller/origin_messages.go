package controller

import (
	"bytes"
	"errors"
	"fmt"
	"net/http"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/origin"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/relay/helper"
	"github.com/QuantumNous/new-api/relaykit/types"
	"github.com/QuantumNous/new-api/service"
	"github.com/gin-gonic/gin"
	"github.com/tidwall/gjson"
)

func CountOriginMessageTokens(c *gin.Context) {
	requestID := c.GetString(common.RequestIdKey)
	originKey, authenticated := origin.Credential(c)
	manager := origin.ActiveManager()
	if !authenticated || manager == nil || requestID == "" {
		writeOriginMessagesError(c, http.StatusUnauthorized, "authentication_error", "Invalid Origin Key")
		return
	}
	if c.GetHeader("anthropic-version") != "2023-06-01" {
		writeOriginMessagesError(c, http.StatusBadRequest, "invalid_request_error", "anthropic-version must be 2023-06-01")
		return
	}
	request, err := helper.GetAndValidateClaudeRequest(c)
	if err != nil {
		writeOriginMessagesError(c, http.StatusBadRequest, "invalid_request_error", "Invalid count_tokens request")
		return
	}
	if err := validateOriginMessagesBody(c, true, originKey); err != nil {
		writeOriginMessagesError(c, http.StatusBadRequest, "invalid_request_error", "Invalid count_tokens request")
		return
	}
	models, err := manager.ListModels(c.Request.Context(), originKey, requestID, "messages")
	if err != nil {
		var controlError *origin.ControlError
		switch {
		case errors.As(err, &controlError) && controlError.Status == http.StatusUnauthorized:
			writeOriginMessagesError(c, http.StatusUnauthorized, "authentication_error", "Invalid Origin Key")
		case errors.As(err, &controlError) && controlError.Status == http.StatusForbidden:
			writeOriginMessagesError(c, http.StatusForbidden, "permission_error", "Origin Key is not authorized for Messages")
		default:
			writeOriginMessagesError(c, http.StatusServiceUnavailable, "overloaded_error", "Origin Platform is unavailable")
		}
		return
	}
	modelAvailable := false
	for _, model := range models.Models {
		if model == request.Model {
			modelAvailable = true
			break
		}
	}
	if !modelAvailable {
		writeOriginMessagesError(c, http.StatusNotFound, "not_found_error", "Platform model is not available for Messages")
		return
	}
	common.SetContextKey(c, constant.ContextKeyOriginalModel, request.Model)
	info, err := relaycommon.GenRelayInfo(c, types.RelayFormatClaude, request, nil)
	if err != nil {
		writeOriginMessagesError(c, http.StatusBadRequest, "invalid_request_error", "Invalid count_tokens request")
		return
	}
	inputTokens, err := service.EstimateRequiredRequestToken(c, request.GetTokenCountMeta(), info)
	if err != nil || inputTokens < 0 {
		writeOriginMessagesError(c, http.StatusBadRequest, "invalid_request_error", "Unable to estimate input tokens")
		return
	}
	c.JSON(http.StatusOK, gin.H{"input_tokens": inputTokens})
}

func validateOriginMessagesBody(c *gin.Context, countTokens bool, originKey string) error {
	storage, err := common.GetBodyStorage(c)
	if err != nil {
		return err
	}
	body, err := storage.Bytes()
	if err != nil {
		return err
	}
	if originKey != "" && bytes.Contains(body, []byte(originKey)) {
		return errors.New("Origin Key must not be sent in the request body")
	}
	trimmed := bytes.TrimSpace(body)
	if len(trimmed) == 0 || trimmed[0] != '{' || !gjson.ValidBytes(trimmed) {
		return errors.New("invalid Origin Messages JSON object")
	}
	allowed := map[string]struct{}{
		"model": {}, "messages": {}, "system": {}, "tools": {}, "tool_choice": {}, "thinking": {},
	}
	if !countTokens {
		for _, key := range []string{"max_tokens", "stream", "stop_sequences", "temperature", "top_p", "top_k", "metadata", "service_tier"} {
			allowed[key] = struct{}{}
		}
	}
	seen := map[string]struct{}{}
	var validationErr error
	gjson.ParseBytes(trimmed).ForEach(func(key, _ gjson.Result) bool {
		name := key.String()
		if _, ok := allowed[name]; !ok {
			validationErr = fmt.Errorf("unsupported Origin Messages field: %s", name)
			return false
		}
		if _, duplicate := seen[name]; duplicate {
			validationErr = fmt.Errorf("duplicate Origin Messages field: %s", name)
			return false
		}
		seen[name] = struct{}{}
		return true
	})
	return validationErr
}

func writeOriginMessagesError(c *gin.Context, status int, errorType, message string) {
	requestID := c.GetString(common.RequestIdKey)
	c.JSON(status, gin.H{
		"type": "error",
		"error": gin.H{
			"type":    errorType,
			"message": message,
		},
		"request_id": requestID,
	})
	c.Abort()
}
