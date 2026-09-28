package middleware

import (
	"errors"
	"net/http"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/logger"
	"github.com/QuantumNous/new-api/model"
	relayconstant "github.com/QuantumNous/new-api/relay/constant"
	"github.com/QuantumNous/new-api/relay/helper"
	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/QuantumNous/new-api/relaykit/types"
	"github.com/QuantumNous/new-api/service"

	"github.com/gin-gonic/gin"
)

// CheckSensitiveWordBeforeChannelSelection evaluates supported relay payloads
// after the effective group is resolved and before Distribute selects a channel.
// The result is reused by billing to make one matching and audit decision per
// request, including when no channel exists for the requested model.
func CheckSensitiveWordBeforeChannelSelection(c *gin.Context, modelName string) bool {
	format, ok := sensitiveWordRelayFormat(c.Request.URL.Path)
	if !ok {
		return true
	}
	request, err := helper.GetAndValidateRequest(c, format)
	if err != nil {
		// Relay owns protocol validation. Do not turn a malformed payload into a
		// policy response merely because there is no complete DTO to inspect.
		return true
	}
	if apiErr := CheckSensitiveWordRequestBeforeChannelSelection(c, format, modelName, request); apiErr != nil {
		writeSensitiveWordRequestError(c, format, apiErr)
		return false
	}
	return true
}

// CheckSensitiveWordRequestBeforeChannelSelection evaluates an already parsed
// relay DTO before channel selection. Responses WebSocket requests do not pass
// through Distribute, so they call this shared path directly.
func CheckSensitiveWordRequestBeforeChannelSelection(c *gin.Context, format types.RelayFormat, modelName string, request dto.Request) *types.NewAPIError {
	policy, policyErr := model.GetSensitiveWordPolicyWithError()
	if policyErr != nil {
		logger.LogWarn(c, "sensitive-word policy unavailable: "+policyErr.Error())
		return newSensitiveWordRequestError(
			"敏感词审计暂时不可用，请稍后重试", types.ErrorCodeQueryDataError, http.StatusServiceUnavailable,
		)
	}
	if !policy.Enabled || !policy.CheckPrompt || request == nil {
		return nil
	}
	meta := request.GetTokenCountMeta()
	if meta == nil {
		return nil
	}

	usingGroup := common.GetContextKeyString(c, constant.ContextKeyUsingGroup)
	tokenGroup := common.GetContextKeyString(c, constant.ContextKeyTokenGroup)
	userGroup := common.GetContextKeyString(c, constant.ContextKeyUserGroup)
	candidateGroups := []string{usingGroup}
	if tokenGroup == "auto" {
		candidateGroups = service.GetRequestAutoGroups(c, userGroup)
	}

	result, err := model.CheckSensitiveRequestForGroups(model.SensitiveCheckInput{
		RequestID: c.GetString(common.RequestIdKey),
		UserID:    common.GetContextKeyInt(c, constant.ContextKeyUserId),
		Username:  common.GetContextKeyString(c, constant.ContextKeyUserName),
		TokenID:   common.GetContextKeyInt(c, constant.ContextKeyTokenId),
		TokenName: c.GetString("token_name"),
		GroupName: usingGroup,
		ModelName: modelName,
		Endpoint:  c.Request.URL.Path,
		Protocol:  string(format),
		Prompt:    meta.CombineText,
	}, candidateGroups)
	if err != nil {
		logger.LogWarn(c, "sensitive-word audit failed: "+err.Error())
		return newSensitiveWordRequestError(
			"敏感词审计暂时不可用，请稍后重试", types.ErrorCodeQueryDataError, http.StatusServiceUnavailable,
		)
	}
	common.SetContextKey(c, constant.ContextKeySensitiveWordCheckResult, result)
	if result == nil || !result.Matched || !result.Blocked {
		return nil
	}

	service.RequestPolicy(c).AddEvent(service.PolicyEvent{
		ErrorCode:   string(types.ErrorCodeSensitiveWordsDetected),
		ErrorSource: "local",
		Decision: service.PolicyDecision{
			Action: "stop", Reason: "local_rejection", Source: "global",
		},
		Health: "unchanged",
	})
	logger.LogWarn(c, "sensitive-word policy matched")
	return newSensitiveWordRequestError(result.Message, types.ErrorCodeSensitiveWordsDetected, http.StatusUnprocessableEntity)
}

func sensitiveWordRelayFormat(path string) (types.RelayFormat, bool) {
	if strings.HasPrefix(path, "/v1/messages") {
		return types.RelayFormatClaude, true
	}
	if strings.HasPrefix(path, "/v1beta/models/") || strings.HasPrefix(path, "/v1/models/") ||
		strings.HasPrefix(path, "/v1/engines/") {
		return types.RelayFormatGemini, true
	}

	switch relayconstant.Path2RelayMode(path) {
	case relayconstant.RelayModeChatCompletions, relayconstant.RelayModeCompletions, relayconstant.RelayModeModerations:
		return types.RelayFormatOpenAI, true
	case relayconstant.RelayModeEmbeddings:
		return types.RelayFormatEmbedding, true
	case relayconstant.RelayModeImagesGenerations, relayconstant.RelayModeImagesEdits, relayconstant.RelayModeEdits:
		return types.RelayFormatOpenAIImage, true
	case relayconstant.RelayModeResponses:
		return types.RelayFormatOpenAIResponses, true
	case relayconstant.RelayModeResponsesCompact:
		return types.RelayFormatOpenAIResponsesCompaction, true
	case relayconstant.RelayModeAlphaSearch:
		return types.RelayFormatOpenAIAlphaSearch, true
	case relayconstant.RelayModeAudioSpeech, relayconstant.RelayModeAudioTranscription, relayconstant.RelayModeAudioTranslation:
		return types.RelayFormatOpenAIAudio, true
	case relayconstant.RelayModeRerank:
		return types.RelayFormatRerank, true
	default:
		return "", false
	}
}

func newSensitiveWordRequestError(message string, code types.ErrorCode, status int) *types.NewAPIError {
	return types.NewOpenAIError(errors.New(message), code, status, types.ErrOptionWithSkipRetry())
}

func writeSensitiveWordRequestError(c *gin.Context, format types.RelayFormat, apiErr *types.NewAPIError) {
	c.Abort()
	if format == types.RelayFormatClaude {
		c.JSON(apiErr.StatusCode, gin.H{"type": "error", "error": apiErr.ToClaudeError()})
		return
	}
	c.JSON(apiErr.StatusCode, gin.H{"error": apiErr.ToOpenAIError()})
}
