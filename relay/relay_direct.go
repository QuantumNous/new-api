package relay

import (
	"errors"
	"github.com/gin-gonic/gin"
	"math"
	"one-api/common"
	"one-api/dto"
	"one-api/relay/channel/claude"
	relaycommon "one-api/relay/common"
	"strings"
)

func getAndValidateDirectRequest(c *gin.Context, relayInfo *relaycommon.RelayInfo) (*dto.GeneralOpenAIRequest, error) {
	if strings.HasPrefix(relayInfo.OriginModelName, "claude") {
		directRequest := &claude.ClaudeRequest{}
		err := common.UnmarshalBodyReusable(c, directRequest)
		if err != nil {
			return nil, err
		}
		if directRequest.MaxTokens > math.MaxInt32/2 {
			return nil, errors.New("max_tokens is invalid")
		}
		if directRequest.Model == "" {
			return nil, errors.New("model is required")
		}

		return claude.ClaudeMessage2OpenAIRequest(directRequest)
	}
	return nil, errors.New("direct model not support")
}
