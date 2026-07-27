package dto

import (
	"encoding/json"

	"github.com/QuantumNous/new-api/types"

	"github.com/gin-gonic/gin"
)

// AlphaSearchRequest is the Codex standalone web search request.
// RawBody preserves the original JSON so unknown fields are forwarded intact.
type AlphaSearchRequest struct {
	Model   string          `json:"model"`
	Id      string          `json:"id,omitempty"`
	Stream  *bool           `json:"stream,omitempty"`
	RawBody json.RawMessage `json:"-"`
}

func (r *AlphaSearchRequest) GetTokenCountMeta() *types.TokenCountMeta {
	combineText := ""
	if len(r.RawBody) > 0 {
		combineText = string(r.RawBody)
	}
	return &types.TokenCountMeta{
		CombineText: combineText,
		TokenType:   types.TokenTypeTokenizer,
	}
}

func (r *AlphaSearchRequest) IsStream(c *gin.Context) bool {
	return false
}

func (r *AlphaSearchRequest) SetModelName(modelName string) {
	if modelName != "" {
		r.Model = modelName
	}
}
