package cursor_agent

import (
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/relay/channel"
	"github.com/QuantumNous/new-api/relay/channel/claude"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	relayconstant "github.com/QuantumNous/new-api/relay/constant"
	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/QuantumNous/new-api/relaykit/relayconvert"
	"github.com/QuantumNous/new-api/relaykit/types"

	"github.com/gin-gonic/gin"
)

// Adaptor relays Cursor traffic to the official @cursor/sdk harness.
//
// Design (aligned with CPA / Claude-native channels):
//   - Client /v1/messages is passed through as Anthropic Messages (tools included).
//   - Client /v1/chat/completions and /v1/responses are converted to Messages.
//   - Model names are normalized to canonical Cursor SDK catalog SKUs.
//   - new-api keeps billing/quota; the SDK sidecar only speaks Cursor + gateway auth.
//
// Tool requests are forced to stream because the harness parks the first HTTP
// response at tool_use and resumes the same SDK run on tool_result.
type Adaptor struct{}

func (a *Adaptor) ConvertGeminiRequest(*gin.Context, *relaycommon.RelayInfo, *dto.GeminiChatRequest) (any, error) {
	return nil, errors.New("cursor_agent: Gemini endpoint is not supported")
}

// ConvertClaudeRequest passes Anthropic Messages through to /v1/messages.
func (a *Adaptor) ConvertClaudeRequest(c *gin.Context, info *relaycommon.RelayInfo, request *dto.ClaudeRequest) (any, error) {
	if request == nil {
		return nil, errors.New("cursor_agent: claude request is nil")
	}
	out := *request
	normalized, err := mapModelForHarness(request.Model, claudeRequestReasoningEffort(request))
	if err != nil {
		return nil, err
	}
	if normalized == "" {
		return nil, errors.New("cursor_agent: model is required")
	}
	out.Model = normalized
	if info != nil {
		info.UpstreamModelName = normalized
		info.FinalRequestRelayFormat = types.RelayFormatClaude
	}

	return &out, nil
}

func claudeRequestReasoningEffort(request *dto.ClaudeRequest) string {
	if request == nil {
		return ""
	}
	if effort := request.GetEfforts(); effort != "" {
		return effort
	}
	if request.Thinking == nil || (request.Thinking.Type != "enabled" && request.Thinking.Type != "adaptive") {
		return ""
	}
	switch budget := request.Thinking.GetBudgetTokens(); {
	case budget > 0 && budget <= 2048:
		return "low"
	case budget > 10000:
		return "high"
	default:
		return "medium"
	}
}

func (a *Adaptor) ConvertAudioRequest(*gin.Context, *relaycommon.RelayInfo, dto.AudioRequest) (io.Reader, error) {
	return nil, errors.New("cursor_agent: audio endpoint is not supported")
}

func (a *Adaptor) ConvertImageRequest(*gin.Context, *relaycommon.RelayInfo, dto.ImageRequest) (any, error) {
	return nil, errors.New("cursor_agent: image endpoint is not supported")
}

func (a *Adaptor) Init(*relaycommon.RelayInfo) {}

func (a *Adaptor) GetRequestURL(info *relaycommon.RelayInfo) (string, error) {
	channelBaseURL := ""
	if info != nil && info.ChannelMeta != nil {
		channelBaseURL = strings.TrimSpace(info.ChannelBaseUrl)
	}
	base := ResolveSidecarBaseURL(channelBaseURL)
	if info != nil && info.RelayMode == relayconstant.RelayModeResponsesCompact {
		return "", errors.New("cursor_agent: responses compaction is not supported by the official SDK harness")
	}
	return relaycommon.GetFullRequestURL(base, "/v1/messages", constant.ChannelTypeCursorAgent), nil
}

func (a *Adaptor) SetupRequestHeader(c *gin.Context, req *http.Header, info *relaycommon.RelayInfo) error {
	channel.SetupApiRequestHeader(info, c, req)
	apiKey := ""
	if info != nil {
		apiKey = info.ApiKey
	}
	cred, err := ParseCredential(apiKey)
	if err != nil {
		return err
	}
	// The sidecar accepts either standard bearer spelling.
	req.Set("Authorization", "Bearer "+cred.APIKey)
	req.Set("x-api-key", cred.APIKey)
	if info != nil && info.FinalRequestRelayFormat == types.RelayFormatClaude {
		anthropicVersion := c.Request.Header.Get("anthropic-version")
		if anthropicVersion == "" {
			anthropicVersion = "2023-06-01"
		}
		req.Set("anthropic-version", anthropicVersion)
		if beta := c.Request.Header.Get("anthropic-beta"); beta != "" {
			req.Set("anthropic-beta", beta)
		}
	}
	req.Set("X-Cursor-Agent-Channel", "new-api-cursor")
	channelID := 0
	if info != nil {
		channelID = info.ChannelId
	}
	req.Set("X-Cursor-Agent-Tenant", fmt.Sprintf("user:%d:token:%d:channel:%d", c.GetInt("id"), c.GetInt("token_id"), channelID))
	return nil
}

func (a *Adaptor) ConvertOpenAIRequest(c *gin.Context, info *relaycommon.RelayInfo, request *dto.GeneralOpenAIRequest) (any, error) {
	if request == nil {
		return nil, errors.New("cursor_agent: request is nil")
	}
	normalized, err := mapModelForHarness(request.Model, openAIRequestReasoningEffort(request))
	if err != nil {
		return nil, err
	}
	if normalized == "" {
		return nil, errors.New("cursor_agent: model is required")
	}
	if info != nil {
		info.UpstreamModelName = normalized
		if info.FinalRequestRelayFormat == "" {
			info.FinalRequestRelayFormat = types.RelayFormatOpenAI
		}
	}
	out := *request
	out.Model = normalized

	if err := normalizeOpenAIToolsForClaude(&out); err != nil {
		return nil, err
	}
	converted, err := relayconvert.OpenAIChatRequestToClaudeMessages(c, info, out)
	if err != nil {
		return nil, err
	}
	if info != nil {
		info.FinalRequestRelayFormat = types.RelayFormatClaude
	}
	return converted, nil
}

func normalizeOpenAIToolsForClaude(request *dto.GeneralOpenAIRequest) error {
	if request == nil {
		return nil
	}
	if len(request.Functions) > 0 {
		var functions []dto.FunctionRequest
		if err := common.Unmarshal(request.Functions, &functions); err != nil {
			return fmt.Errorf("cursor_agent: invalid legacy functions: %w", err)
		}
		for _, function := range functions {
			request.Tools = append(request.Tools, dto.ToolCallRequest{Type: "function", Function: function})
		}
		request.Functions = nil
	}
	for index := range request.Tools {
		parameters, err := openAIToolParametersObject(request.Tools[index].Function.Parameters)
		if err != nil {
			return fmt.Errorf("cursor_agent: invalid parameters for tool %q: %w", request.Tools[index].Function.Name, err)
		}
		request.Tools[index].Function.Parameters = parameters
	}
	if request.ToolChoice == nil && len(request.FunctionCall) > 0 {
		var functionCall any
		if err := common.Unmarshal(request.FunctionCall, &functionCall); err != nil {
			return fmt.Errorf("cursor_agent: invalid legacy function_call: %w", err)
		}
		switch value := functionCall.(type) {
		case string:
			request.ToolChoice = value
		case map[string]any:
			if name, ok := value["name"].(string); ok && strings.TrimSpace(name) != "" {
				request.ToolChoice = map[string]any{
					"type":     "function",
					"function": map[string]any{"name": name},
				}
			}
		}
		request.FunctionCall = nil
	}
	return nil
}

func openAIToolParametersObject(value any) (map[string]any, error) {
	parameters := map[string]any{}
	switch typed := value.(type) {
	case nil:
	case map[string]any:
		for key, field := range typed {
			parameters[key] = field
		}
	case []byte:
		if len(typed) > 0 {
			if err := common.Unmarshal(typed, &parameters); err != nil {
				return nil, err
			}
		}
	case json.RawMessage:
		if len(typed) > 0 {
			if err := common.Unmarshal(typed, &parameters); err != nil {
				return nil, err
			}
		}
	case string:
		if strings.TrimSpace(typed) != "" {
			if err := common.Unmarshal([]byte(typed), &parameters); err != nil {
				return nil, err
			}
		}
	default:
		return nil, fmt.Errorf("expected an object schema, got %T", value)
	}
	if _, ok := parameters["type"]; !ok {
		parameters["type"] = "object"
	}
	if _, ok := parameters["properties"]; !ok {
		parameters["properties"] = map[string]any{}
	}
	return parameters, nil
}

func mapModelForHarness(model, effort string) (string, error) {
	return MapSDKModelWithEffort(model, effort)
}

func openAIRequestReasoningEffort(request *dto.GeneralOpenAIRequest) string {
	if request == nil {
		return ""
	}
	if request.ReasoningEffort != "" {
		return request.ReasoningEffort
	}
	if len(request.Reasoning) > 0 {
		var reasoning dto.Reasoning
		if err := common.Unmarshal(request.Reasoning, &reasoning); err == nil && reasoning.Effort != "" {
			return reasoning.Effort
		}
	}
	if len(request.THINKING) > 0 {
		var thinking dto.Thinking
		if err := common.Unmarshal(request.THINKING, &thinking); err == nil {
			tmp := &dto.ClaudeRequest{Thinking: &thinking}
			return claudeRequestReasoningEffort(tmp)
		}
	}
	return ""
}

func (a *Adaptor) ConvertRerankRequest(*gin.Context, int, dto.RerankRequest) (any, error) {
	return nil, errors.New("cursor_agent: rerank endpoint is not supported")
}

func (a *Adaptor) ConvertEmbeddingRequest(*gin.Context, *relaycommon.RelayInfo, dto.EmbeddingRequest) (any, error) {
	return nil, errors.New("cursor_agent: embedding endpoint is not supported")
}

func (a *Adaptor) ConvertOpenAIResponsesRequest(c *gin.Context, info *relaycommon.RelayInfo, request dto.OpenAIResponsesRequest) (any, error) {
	effort := ""
	if request.Reasoning != nil {
		effort = request.Reasoning.Effort
	}
	normalized, err := mapModelForHarness(request.Model, effort)
	if err != nil {
		return nil, err
	}
	if normalized == "" {
		return nil, fmt.Errorf("cursor_agent: model is required")
	}
	request.Model = normalized
	if info != nil {
		info.UpstreamModelName = normalized
		if effort != "" {
			info.ReasoningEffort = effort
		}
	}
	converted, err := relayconvert.OpenAIResponsesRequestToClaudeMessages(c, info, &request)
	if err != nil {
		return nil, err
	}
	if info != nil {
		info.FinalRequestRelayFormat = types.RelayFormatClaude
	}
	return converted, nil
}

func (a *Adaptor) DoRequest(c *gin.Context, info *relaycommon.RelayInfo, requestBody io.Reader) (any, error) {
	return channel.DoApiRequest(a, c, info, requestBody)
}

func (a *Adaptor) DoResponse(c *gin.Context, resp *http.Response, info *relaycommon.RelayInfo) (usage any, err *types.NewAPIError) {
	rewriteCursorResponseModel(resp, info)
	if info != nil && info.RelayMode == relayconstant.RelayModeResponses && info.FinalRequestRelayFormat == types.RelayFormatClaude {
		if info.IsStream {
			return claude.ClaudeResponsesStreamHandler(c, resp, info)
		}
		return claude.ClaudeResponsesHandler(c, resp, info)
	}
	if info != nil && info.IsStream {
		return claude.ClaudeStreamHandler(c, resp, info)
	}
	return claude.ClaudeHandler(c, resp, info)
}

func (a *Adaptor) GetModelList() []string {
	return ModelList
}

func (a *Adaptor) GetChannelName() string {
	return ChannelName
}
