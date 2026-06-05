package dto

import (
	"encoding/json"
	"strings"

	"github.com/QuantumNous/new-api/types"

	"github.com/gin-gonic/gin"
)

type OpenAIResponsesCompactionRequest struct {
	Model              string          `json:"model"`
	Input              json.RawMessage `json:"input,omitempty"`
	Instructions       json.RawMessage `json:"instructions,omitempty"`
	PreviousResponseID string          `json:"previous_response_id,omitempty"`
}

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
	if c == nil || c.Request == nil {
		return false
	}
	return strings.Contains(strings.ToLower(c.Request.Header.Get("Accept")), "text/event-stream")
}

func (r *OpenAIResponsesCompactionRequest) SetModelName(modelName string) {
	if modelName != "" {
		r.Model = modelName
	}
}
