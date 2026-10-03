package dto

import (
	"encoding/json"
	"strings"

	"github.com/QuantumNous/new-api/types"
	"github.com/gin-gonic/gin"
)

// CohereNativeRequest retains routing and billing fields while its original JSON body is forwarded unchanged.
type CohereNativeRequest struct {
	Model     string            `json:"model"`
	Stream    bool              `json:"stream"`
	MaxTokens *uint             `json:"max_tokens,omitempty"`
	Messages  []Message         `json:"messages,omitempty"`
	Texts     []string          `json:"texts,omitempty"`
	Query     string            `json:"query,omitempty"`
	Documents []json.RawMessage `json:"documents,omitempty"`
}

func (r *CohereNativeRequest) SetModelName(name string)     { r.Model = name }
func (r *CohereNativeRequest) IsStream(_ *gin.Context) bool { return r.Stream }
func (r *CohereNativeRequest) GetTokenCountMeta() *types.TokenCountMeta {
	parts := make([]string, 0, len(r.Texts)+len(r.Documents)+len(r.Messages)+1)
	parts = append(parts, r.Query)
	parts = append(parts, r.Texts...)
	for _, document := range r.Documents {
		parts = append(parts, string(document))
	}
	for _, message := range r.Messages {
		if message.IsStringContent() {
			parts = append(parts, message.StringContent())
		}
	}
	return &types.TokenCountMeta{TokenType: types.TokenTypeTokenizer, CombineText: strings.Join(parts, "\n")}
}
