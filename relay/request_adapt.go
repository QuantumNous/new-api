package relay

import (
	"fmt"
	"net/http"

	rootcommon "github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/logger"
	"github.com/QuantumNous/new-api/relay/channel"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/QuantumNous/new-api/relaykit/relayconvert"
	"github.com/QuantumNous/new-api/relaykit/types"
	"github.com/gin-gonic/gin"
)

func newConvertRequestError(err error) *types.NewAPIError {
	return types.NewError(err, types.ErrorCodeConvertRequestFailed, types.ErrOptionWithStatusCode(http.StatusBadRequest), types.ErrOptionWithSkipRetry())
}

// ConvertRequestToChannelNative converts an incoming text request into the
// channel's native format via IR (From → To), then runs the adaptor's native
// Convert* hook for channel-specific dialect. Helpers and channel-test share
// this path so a test request is converted the same way as production traffic.
func ConvertRequestToChannelNative(c *gin.Context, info *relaycommon.RelayInfo, adaptor channel.Adaptor, request any) (any, error) {
	return convertRequestToChannelNative(c, info, adaptor, request)
}

func convertRequestToChannelNative(c *gin.Context, info *relaycommon.RelayInfo, adaptor channel.Adaptor, request any) (any, error) {
	if adaptor == nil {
		return nil, fmt.Errorf("adaptor is nil")
	}
	incoming, ok := relaycommon.GuessRelayFormatFromRequest(request)
	if !ok {
		return nil, fmt.Errorf("unsupported request type %T", request)
	}
	native := relaycommon.NativeTextFormat(info, incoming)
	if info != nil && info.HasTextPlan() {
		native = info.TextNative()
	}

	result, err := relayconvert.ConvertRequest(c, info, native, request)
	if err != nil {
		return nil, err
	}
	if c != nil && !result.Report.Empty() {
		logger.LogDebug(c, fmt.Sprintf("text projection losses %s→%s: %+v", result.From, result.To, result.Report.Losses))
	}
	if c != nil && rootcommon.DebugEnabled {
		if summary, summaryErr := relayconvert.SummarizeRequestConversion(result.From, result.To, request, result.Value, result.Report); summaryErr == nil {
			logger.LogDebug(c, fmt.Sprintf("text conversion summary: %+v", summary))
		}
	}
	current := result.Value
	syncUpstreamModelFromNative(info, current)
	converted, err := adaptNativeRequest(c, info, adaptor, native, current)
	if err != nil {
		return nil, err
	}
	if info != nil {
		if format, ok := relaycommon.GuessRelayFormatFromRequest(converted); ok {
			info.FinalRequestRelayFormat = format
		} else {
			info.FinalRequestRelayFormat = native
		}
	}
	return converted, nil
}

func adaptNativeRequest(c *gin.Context, info *relaycommon.RelayInfo, adaptor channel.Adaptor, native types.RelayFormat, request any) (any, error) {
	switch native {
	case types.RelayFormatGemini:
		req, ok := asGeminiChatRequest(request)
		if !ok {
			return nil, fmt.Errorf("expected Gemini generateContent request, got %T", request)
		}
		return adaptor.ConvertGeminiRequest(c, info, req)
	case types.RelayFormatClaude:
		req, ok := asClaudeRequest(request)
		if !ok {
			return nil, fmt.Errorf("expected Anthropic Messages request, got %T", request)
		}
		return adaptor.ConvertClaudeRequest(c, info, req)
	case types.RelayFormatOpenAIResponses:
		req, ok := asOpenAIResponsesRequest(request)
		if !ok {
			return nil, fmt.Errorf("expected OpenAI responses request, got %T", request)
		}
		return adaptor.ConvertOpenAIResponsesRequest(c, info, *req)
	default:
		req, ok := asOpenAIChatRequest(request)
		if !ok {
			return nil, fmt.Errorf("expected OpenAI chat completions request, got %T", request)
		}
		return adaptor.ConvertOpenAIRequest(c, info, req)
	}
}

func syncUpstreamModelFromNative(info *relaycommon.RelayInfo, request any) {
	if info == nil {
		return
	}
	// Claude conversion may strip -thinking / effort suffixes from the model
	// name. Chat and Responses keep ModelMappedHelper's upstream name; their
	// adaptors rewrite it themselves when needed.
	switch req := request.(type) {
	case *dto.ClaudeRequest:
		if req != nil && req.Model != "" {
			info.UpstreamModelName = req.Model
		}
	case dto.ClaudeRequest:
		if req.Model != "" {
			info.UpstreamModelName = req.Model
		}
	}
}

func asOpenAIChatRequest(request any) (*dto.GeneralOpenAIRequest, bool) {
	switch v := request.(type) {
	case *dto.GeneralOpenAIRequest:
		return v, v != nil
	case dto.GeneralOpenAIRequest:
		return &v, true
	default:
		return nil, false
	}
}

func asClaudeRequest(request any) (*dto.ClaudeRequest, bool) {
	switch v := request.(type) {
	case *dto.ClaudeRequest:
		return v, v != nil
	case dto.ClaudeRequest:
		return &v, true
	default:
		return nil, false
	}
}

func asGeminiChatRequest(request any) (*dto.GeminiChatRequest, bool) {
	switch v := request.(type) {
	case *dto.GeminiChatRequest:
		return v, v != nil
	case dto.GeminiChatRequest:
		return &v, true
	default:
		return nil, false
	}
}

func asOpenAIResponsesRequest(request any) (*dto.OpenAIResponsesRequest, bool) {
	switch v := request.(type) {
	case *dto.OpenAIResponsesRequest:
		return v, v != nil
	case dto.OpenAIResponsesRequest:
		return &v, true
	default:
		return nil, false
	}
}
