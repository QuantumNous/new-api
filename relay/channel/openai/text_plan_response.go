package openai

import (
	"net/http"

	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/relaykit/types"

	"github.com/gin-gonic/gin"
)

// DoPlannedTextResponse parses the upstream body in Plan.Native and projects
// it to RelayFormat (the client). Used when a TextPlan has been built so
// Chat→Responses no longer depends on rewriting RelayMode.
func DoPlannedTextResponse(c *gin.Context, info *relaycommon.RelayInfo, resp *http.Response) (any, *types.NewAPIError) {
	native := info.TextNative()
	client := info.RelayFormat
	switch native {
	case types.RelayFormatOpenAIResponses:
		if client == types.RelayFormatOpenAIResponses {
			if info.IsStream {
				return OaiResponsesStreamHandler(c, info, resp)
			}
			return OaiResponsesHandler(c, info, resp)
		}
		if info.IsStream {
			return OaiResponsesToChatStreamHandler(c, info, resp)
		}
		if resp != nil && relaycommon.IsEventStreamContentType(resp.Header.Get("Content-Type")) {
			return OaiResponsesToChatBufferedStreamHandler(c, info, resp)
		}
		return OaiResponsesToChatHandler(c, info, resp)
	default:
		if client == types.RelayFormatOpenAIResponses {
			if info.IsStream {
				return OaiChatToResponsesStreamHandler(c, info, resp)
			}
			return OaiChatToResponsesHandler(c, info, resp)
		}
		if info.IsStream {
			return OaiStreamHandler(c, info, resp)
		}
		return OpenaiHandler(c, info, resp)
	}
}
