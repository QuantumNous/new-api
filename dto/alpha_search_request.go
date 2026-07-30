package dto

import (
	"encoding/json"

	"github.com/QuantumNous/new-api/types"
	"github.com/gin-gonic/gin"
)

// AlphaSearchRequest preserves the original JSON so provider-specific fields
// survive while the mapped model is the only rewritten field.
type AlphaSearchRequest struct {
	Model   string          `json:"model"`
	ID      string          `json:"id,omitempty"`
	Stream  *bool           `json:"stream,omitempty"`
	RawBody json.RawMessage `json:"-"`
}

func (r *AlphaSearchRequest) GetTokenCountMeta() *types.TokenCountMeta {
	return &types.TokenCountMeta{CombineText: string(r.RawBody), TokenType: types.TokenTypeTokenizer}
}

func (r *AlphaSearchRequest) IsStream(*gin.Context) bool {
	return false
}

func (r *AlphaSearchRequest) SetModelName(modelName string) {
	if modelName != "" {
		r.Model = modelName
	}
}
