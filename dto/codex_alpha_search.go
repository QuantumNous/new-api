package dto

import (
	"encoding/json"
	"strings"

	"github.com/QuantumNous/new-api/types"
	"github.com/gin-gonic/gin"
)

// CodexAlphaSearchRequest is the standalone search request used by Codex CLI.
// It is not an OpenAI Responses request; unknown fields must be preserved by
// the relay path and forwarded as-is.
type CodexAlphaSearchRequest struct {
	Model    string          `json:"model,omitempty"`
	ID       string          `json:"id,omitempty"`
	Query    string          `json:"query,omitempty"`
	Commands json.RawMessage `json:"commands,omitempty"`
	Input    json.RawMessage `json:"input,omitempty"`
	Settings json.RawMessage `json:"settings,omitempty"`
}

func (r *CodexAlphaSearchRequest) GetTokenCountMeta() *types.TokenCountMeta {
	parts := make([]string, 0, 4)
	if strings.TrimSpace(r.Query) != "" {
		parts = append(parts, r.Query)
	}
	for _, raw := range []json.RawMessage{r.Commands, r.Input, r.Settings} {
		if len(raw) > 0 {
			parts = append(parts, string(raw))
		}
	}
	return &types.TokenCountMeta{
		CombineText: strings.Join(parts, "\n"),
		TokenType:   types.TokenTypeTokenizer,
	}
}

func (r *CodexAlphaSearchRequest) IsStream(c *gin.Context) bool {
	return false
}

func (r *CodexAlphaSearchRequest) SetModelName(modelName string) {
	r.Model = modelName
}
