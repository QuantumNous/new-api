// Package helper provides utility functions for relay operations
// model_correction.go - Model name correction for user convenience
package helper

import (
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/logger"
	"github.com/QuantumNous/new-api/middleware"

	"github.com/gin-gonic/gin"
)

// CorrectModelName applies model alias and deprecated model forwarding
// This function should be called after GetAndValidateRequest
// Returns: corrected model name, whether any correction was applied
func CorrectModelName(c *gin.Context, request dto.Request) string {
	originalModel := getModelName(request)
	if originalModel == "" {
		return originalModel
	}

	// Apply corrections in order: deprecated first, then alias
	currentModel := originalModel
	wasCorrected := false

	// 1. Check for deprecated models
	if replacement, deprecated, reason := middleware.GetReplacementForDeprecated(c, currentModel); deprecated {
		currentModel = replacement
		wasCorrected = true
		logger.LogInfo(c, "[ModelCorrection] Deprecated model forwarded: %s -> %s (%s)",
			originalModel, replacement, reason)
	}

	// 2. Check for model aliases
	if resolved, aliased := middleware.ResolveModelAlias(c, currentModel); aliased {
		currentModel = resolved
		wasCorrected = true
	}

	// Update the request if correction was applied
	if wasCorrected && currentModel != originalModel {
		request.SetModelName(currentModel)
		logger.LogInfo(c, "[ModelCorrection] Model corrected: %s -> %s", originalModel, currentModel)
	}

	return currentModel
}

// getModelName extracts model name from different request types
func getModelName(request dto.Request) string {
	switch r := request.(type) {
	case *dto.GeneralOpenAIRequest:
		return r.Model
	case *dto.ClaudeRequest:
		return r.Model
	case *dto.ImageRequest:
		return r.Model
	case *dto.AudioRequest:
		return r.Model
	case *dto.EmbeddingRequest:
		return r.Model
	case *dto.RerankRequest:
		return r.Model
	case *dto.GeminiChatRequest:
		return r.Model
	default:
		return ""
	}
}
