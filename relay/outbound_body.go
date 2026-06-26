package relay

import (
	"github.com/QuantumNous/new-api/logger"
	relaycommon "github.com/QuantumNous/new-api/relay/common"

	"github.com/gin-gonic/gin"
)

func closeReplayableOutboundBody(c *gin.Context, body relaycommon.ReplayableBody, label string) {
	if body == nil {
		return
	}
	if err := body.Close(); err != nil {
		logger.LogError(c, "failed to close "+label+": "+err.Error())
	}
}
