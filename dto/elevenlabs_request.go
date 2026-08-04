package dto

import (
	"github.com/QuantumNous/new-api/types"

	"github.com/gin-gonic/gin"
)

// ElevenLabsRequest is a passthrough request for ElevenLabs' native voice/SFX
// endpoints. The HTTP body is forwarded to ElevenLabs verbatim by the adaptor; this
// type only carries the path-resolved billing model and the pre-computed billable
// units (input characters for TTS, requested seconds for SFX) so the relay
// pipeline can meter the call. It satisfies dto.Request.
type ElevenLabsRequest struct {
	Model      string
	BillTokens int
}

func (r *ElevenLabsRequest) GetTokenCountMeta() *types.TokenCountMeta {
	// The precise billable amount is set on the RelayInfo estimate by ElevenLabsHelper;
	// this pre-estimate only needs to be non-negative.
	return &types.TokenCountMeta{TokenType: types.TokenTypeTextNumber}
}

func (r *ElevenLabsRequest) IsStream(c *gin.Context) bool { return false }

func (r *ElevenLabsRequest) SetModelName(modelName string) {
	if modelName != "" {
		r.Model = modelName
	}
}
