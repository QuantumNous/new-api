package dto

import "github.com/QuantumNous/new-api/types"

// CodexSearchRequest contains only fields owned by the gateway. The complete
// alpha search payload is forwarded from the stored request body unchanged.
type CodexSearchRequest struct {
	BaseRequest
	Model           string `json:"model"`
	MaxOutputTokens *uint  `json:"max_output_tokens,omitempty"`
}

func (r *CodexSearchRequest) GetTokenCountMeta() *types.TokenCountMeta {
	meta := &types.TokenCountMeta{TokenType: types.TokenTypeTokenizer}
	if r.MaxOutputTokens != nil {
		meta.MaxTokens = int(*r.MaxOutputTokens)
	}
	return meta
}

func (r *CodexSearchRequest) SetModelName(modelName string) {
	r.Model = modelName
}
