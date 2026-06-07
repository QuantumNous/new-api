package relay

import (
	"errors"
	"net/http"

	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/relay/channel"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/types"

	"github.com/gin-gonic/gin"
)

func chatCompletionsViaResponses(c *gin.Context, info *relaycommon.RelayInfo, adaptor channel.Adaptor, request *dto.GeneralOpenAIRequest) (*dto.Usage, *types.NewAPIError) {
	_ = c
	_ = info
	_ = adaptor
	_ = request

	// Public endpoint protocol conversion has been retired. Chat Completions and
	// Claude requests must keep their original protocol semantics instead of
	// being silently rerouted to /v1/responses and wrapped back.
	return nil, types.NewErrorWithStatusCode(
		errors.New("automatic chat/completions -> responses conversion has been removed to preserve public endpoint protocol semantics"),
		types.ErrorCodeInvalidRequest,
		http.StatusBadRequest,
		types.ErrOptionWithSkipRetry(),
	)
}
