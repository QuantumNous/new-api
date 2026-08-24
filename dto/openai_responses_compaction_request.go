package dto

import (
	"strings"

	"github.com/QuantumNous/new-api/types"

	"github.com/gin-gonic/gin"
)

// OpenAIResponsesCompactionRequest intentionally shares the complete field
// layout of OpenAIResponsesRequest. Compact has different stream semantics,
// but maintaining a second partial DTO silently drops newly supported
// Responses fields during request binding before the Codex adaptor can apply
// its endpoint-specific allow/deny rules.
type OpenAIResponsesCompactionRequest OpenAIResponsesRequest

func (r *OpenAIResponsesCompactionRequest) GetTokenCountMeta() *types.TokenCountMeta {
	var parts []string
	if len(r.Instructions) > 0 {
		parts = append(parts, string(r.Instructions))
	}
	if len(r.Input) > 0 {
		parts = append(parts, string(r.Input))
	}
	return &types.TokenCountMeta{
		CombineText: strings.Join(parts, "\n"),
	}
}

func (r *OpenAIResponsesCompactionRequest) IsStream(c *gin.Context) bool {
	return false
}

func (r *OpenAIResponsesCompactionRequest) SetModelName(modelName string) {
	if modelName != "" {
		r.Model = modelName
	}
}
