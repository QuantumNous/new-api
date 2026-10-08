package vertex

import (
	"errors"
	"fmt"
	"io"
	"net/http"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/relay/channel"
	"github.com/QuantumNous/new-api/relay/channel/claude"
	"github.com/QuantumNous/new-api/relay/channel/gemini"
	"github.com/QuantumNous/new-api/relay/channel/openai"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/relay/constant"
	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/QuantumNous/new-api/relaykit/types"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/setting/model_setting"

	"github.com/gin-gonic/gin"
	"github.com/samber/lo"
)

const (
	RequestModeClaude     = 1
	RequestModeGemini     = 2
	RequestModeOpenSource = 3
)

var claudeModelMap = map[string]string{
	"claude-3-sonnet-20240229":   "claude-3-sonnet@20240229",
	"claude-3-opus-20240229":     "claude-3-opus@20240229",
	"claude-3-haiku-20240307":    "claude-3-haiku@20240307",
	"claude-3-5-sonnet-20240620": "claude-3-5-sonnet@20240620",
	"claude-3-5-sonnet-20241022": "claude-3-5-sonnet-v2@20241022",
	"claude-3-7-sonnet-20250219": "claude-3-7-sonnet@20250219",
	"claude-sonnet-4-20250514":   "claude-sonnet-4@20250514",
	"claude-opus-4-20250514":     "claude-opus-4@20250514",
	"claude-opus-4-1-20250805":   "claude-opus-4-1@20250805",
	"claude-sonnet-4-5-20250929": "claude-sonnet-4-5@20250929",
	"claude-haiku-4-5-20251001":  "claude-haiku-4-5@20251001",
	"claude-opus-4-5-20251101":   "claude-opus-4-5@20251101",
	"claude-opus-4-6":            "claude-opus-4-6",
	"claude-opus-4-7":            "claude-opus-4-7",
	"claude-opus-4-8":            "claude-opus-4-8",
}

const anthropicVersion = "vertex-2023-10-16"

type Adaptor struct {
	RequestMode        int
	AccountCredentials Credentials
}

func (a *Adaptor) ConvertGeminiRequest(c *gin.Context, info *relaycommon.RelayInfo, request *dto.GeminiChatRequest) (any, error) {
	// Vertex AI's generateContent schema does not expose the Gemini API's
	// function-call identity fields. Strip both sides at this provider boundary.
	if model_setting.GetGeminiSettings().RemoveFunctionResponseIdEnabled {
		removeFunctionCallIDs(request)
	}
	geminiAdaptor := gemini.Adaptor{}
	return geminiAdaptor.ConvertGeminiRequest(c, info, request)
}

func removeFunctionCallIDs(request *dto.GeminiChatRequest) {
	if request == nil {
		return
	}

	if len(request.Contents) > 0 {
		for i := range request.Contents {
			if len(request.Contents[i].Parts) == 0 {
				continue
			}
			for j := range request.Contents[i].Parts {
				part := &request.Contents[i].Parts[j]
				if part.FunctionCall != nil {
					part.FunctionCall.ID = ""
				}
				if part.FunctionResponse != nil && len(part.FunctionResponse.ID) > 0 {
					part.FunctionResponse.ID = nil
				}
			}
		}
	}

	if len(request.Requests) > 0 {
		for i := range request.Requests {
			removeFunctionCallIDs(&request.Requests[i])
		}
	}
}

func (a *Adaptor) ConvertClaudeRequest(c *gin.Context, info *relaycommon.RelayInfo, request *dto.ClaudeRequest) (any, error) {
	if request == nil {
		return nil, errors.New("request is nil")
	}
	switch a.RequestMode {
	case RequestModeGemini:
		if err := validateClaudeGeminiRequest(request); err != nil {
			return nil, err
		}
		result, err := service.ConvertRequest(c, info, types.RelayFormatGemini, request)
		if err != nil {
			return nil, err
		}
		if err := types.RejectConversionLoss(types.ConversionLossPolicySafe, result.Diagnostics); err != nil {
			return nil, err
		}
		geminiRequest, ok := result.Value.(*dto.GeminiChatRequest)
		if !ok {
			return nil, fmt.Errorf("expected Gemini generateContent request, got %T", result.Value)
		}
		// Rebuild assistant history in source order: the Chat bridge groups
		// tool calls and omits accompanying text and signed thinking.
		modelIndex := 0
		toolResults := make(map[string][]bool)
		for _, message := range request.Messages {
			if message.Role != "assistant" {
				if !message.IsStringContent() {
					blocks, err := message.ParseContent()
					if err != nil {
						return nil, err
					}
					for _, block := range blocks {
						if block.Type == "tool_result" {
							failed := block.IsError != nil && *block.IsError
							toolResults[block.ToolUseId] = append(toolResults[block.ToolUseId], failed)
						}
					}
				}
				continue
			}
			for modelIndex < len(geminiRequest.Contents) && geminiRequest.Contents[modelIndex].Role != "model" {
				modelIndex++
			}
			if message.IsStringContent() {
				if message.GetStringContent() != "" {
					modelIndex++
				}
				continue
			}
			blocks, err := message.ParseContent()
			if err != nil {
				return nil, err
			}
			if len(blocks) == 0 {
				continue
			}
			if modelIndex >= len(geminiRequest.Contents) {
				return nil, errors.New("unsupported Anthropic assistant history for Vertex Gemini")
			}
			var parts []dto.GeminiPart
			for _, block := range blocks {
				if block.Type == "thinking" && block.Thinking != nil {
					part := dto.GeminiPart{Thought: true, Text: *block.Thinking}
					if block.Signature != "" {
						part.ThoughtSignature, err = common.Marshal(block.Signature)
						if err != nil {
							return nil, err
						}
					}
					parts = append(parts, part)
					continue
				}
				blockRequest := *request
				blockRequest.Messages = []dto.ClaudeMessage{{Role: "assistant", Content: []dto.ClaudeMediaMessage{block}}}
				converted, err := service.ConvertRequest(c, info, types.RelayFormatGemini, &blockRequest)
				if err != nil {
					return nil, err
				}
				if err := types.RejectConversionLoss(types.ConversionLossPolicySafe, converted.Diagnostics); err != nil {
					return nil, err
				}
				for _, content := range converted.Value.(*dto.GeminiChatRequest).Contents {
					for _, part := range content.Parts {
						if content.Role != "model" {
							return nil, errors.New("unsupported Anthropic assistant content for Vertex Gemini")
						}
						if part.FunctionCall != nil && block.Signature != "" {
							part.ThoughtSignature, err = common.Marshal(block.Signature)
							if err != nil {
								return nil, err
							}
						}
						parts = append(parts, part)
					}
				}
			}
			geminiRequest.Contents[modelIndex].Parts = parts
			modelIndex++
		}
		for i := range geminiRequest.Contents {
			for j := range geminiRequest.Contents[i].Parts {
				response := geminiRequest.Contents[i].Parts[j].FunctionResponse
				if response == nil {
					continue
				}
				var id string
				if len(response.ID) > 0 {
					if err := common.Unmarshal(response.ID, &id); err != nil {
						return nil, err
					}
				}
				results := toolResults[id]
				if len(results) == 0 {
					continue
				}
				key := "output"
				if results[0] {
					key = "error"
				}
				response.Response = map[string]any{key: response.Response}
				toolResults[id] = results[1:]
			}
		}
		c.Set("request_model", info.UpstreamModelName)
		return a.ConvertGeminiRequest(c, info, geminiRequest)
	case RequestModeClaude:
		// Keep the native Vertex Anthropic envelope for Claude models.
	default:
		return nil, errors.New("Anthropic Messages is unsupported for this Vertex request mode")
	}
	claudeAdaptor := claude.Adaptor{}
	if _, err := claudeAdaptor.ConvertClaudeRequest(c, info, request); err != nil {
		return nil, err
	}
	if v, ok := claudeModelMap[info.UpstreamModelName]; ok {
		c.Set("request_model", v)
	} else {
		c.Set("request_model", request.Model)
	}
	vertexClaudeReq := copyRequest(request, anthropicVersion)
	return vertexClaudeReq, nil
}

func validateClaudeGeminiRequest(request *dto.ClaudeRequest) error {
	for _, field := range []struct {
		name    string
		present bool
	}{
		{"prompt", request.Prompt != ""},
		{"max_tokens_to_sample", request.MaxTokensToSample != nil},
		{"inference_geo", request.InferenceGeo != ""},
		{"safeguards", len(request.Safeguards) > 0},
		{"context_management", len(request.ContextManagement) > 0},
		{"output_format", len(request.OutputFormat) > 0},
		{"container", len(request.Container) > 0},
		{"mcp_servers", len(request.McpServers) > 0},
	} {
		if field.present {
			return fmt.Errorf("Anthropic %s is unsupported for Vertex Gemini", field.name)
		}
	}
	if len(request.OutputConfig) > 0 {
		var config map[string]any
		if err := common.Unmarshal(request.OutputConfig, &config); err != nil {
			return err
		}
		for name := range config {
			if name != "effort" {
				return fmt.Errorf("Anthropic output_config.%s is unsupported for Vertex Gemini", name)
			}
		}
	}
	if request.System != nil && !request.IsStringSystem() {
		for _, block := range request.ParseSystem() {
			if block.Type != "text" {
				return errors.New("Anthropic non-text system blocks are unsupported for Vertex Gemini")
			}
		}
	}
	for messageIndex, message := range request.Messages {
		if message.IsStringContent() {
			continue
		}
		blocks, err := message.ParseContent()
		if err != nil {
			return err
		}
		var hasThought, hasContent bool
		for blockIndex, block := range blocks {
			path := fmt.Sprintf("messages[%d].content[%d]", messageIndex, blockIndex)
			switch block.Type {
			case "thinking":
				if message.Role != "assistant" || block.Thinking == nil {
					return fmt.Errorf("%s: unsupported Anthropic thinking history for Vertex Gemini", path)
				}
				hasThought = true
			case "text", "input_text", "image", "document", "tool_use":
				hasContent = true
			case "tool_result":
				hasContent = true
				if !block.IsStringContent() {
					for _, part := range block.ParseMediaContent() {
						if part.Type != "text" && part.Type != "input_text" && part.Type != "image" {
							return fmt.Errorf("%s: unsupported Anthropic tool-result block %q for Vertex Gemini", path, part.Type)
						}
					}
				}
			default:
				return fmt.Errorf("%s: unsupported Anthropic content block %q for Vertex Gemini", path, block.Type)
			}
		}
		if hasThought && !hasContent {
			return fmt.Errorf("messages[%d]: thinking-only history is unsupported for Vertex Gemini", messageIndex)
		}
	}
	return nil
}

func (a *Adaptor) ConvertAudioRequest(c *gin.Context, info *relaycommon.RelayInfo, request dto.AudioRequest) (io.Reader, error) {
	//TODO implement me
	return nil, errors.New("not implemented")
}

func (a *Adaptor) ConvertImageRequest(c *gin.Context, info *relaycommon.RelayInfo, request dto.ImageRequest) (any, error) {
	geminiAdaptor := gemini.Adaptor{}
	return geminiAdaptor.ConvertImageRequest(c, info, request)
}

func (a *Adaptor) Init(info *relaycommon.RelayInfo) {
	if strings.HasPrefix(info.UpstreamModelName, "claude") {
		a.RequestMode = RequestModeClaude
	} else if strings.Contains(info.UpstreamModelName, "llama") ||
		// open source models
		strings.Contains(info.UpstreamModelName, "-maas") {
		a.RequestMode = RequestModeOpenSource
	} else {
		a.RequestMode = RequestModeGemini
	}
}

func (a *Adaptor) getRequestUrl(info *relaycommon.RelayInfo, modelName, suffix string) (string, error) {
	region := GetModelRegion(info.ApiVersion, info.OriginModelName)
	if info.ChannelOtherSettings.VertexKeyType != dto.VertexKeyTypeAPIKey {
		adc := &Credentials{}
		if err := common.Unmarshal([]byte(info.ApiKey), adc); err != nil {
			return "", fmt.Errorf("failed to decode credentials file: %w", err)
		}
		a.AccountCredentials = *adc

		if a.RequestMode == RequestModeGemini {
			return BuildGoogleModelURL(info.ChannelBaseUrl, DefaultAPIVersion, adc.ProjectID, region, modelName, suffix), nil
		} else if a.RequestMode == RequestModeClaude {
			return BuildAnthropicModelURL(info.ChannelBaseUrl, DefaultAPIVersion, adc.ProjectID, region, modelName, suffix), nil
		} else if a.RequestMode == RequestModeOpenSource {
			return BuildOpenSourceChatCompletionsURL(info.ChannelBaseUrl, adc.ProjectID, region), nil
		}
	} else {
		var keyPrefix string
		if strings.HasSuffix(suffix, "?alt=sse") {
			keyPrefix = "&"
		} else {
			keyPrefix = "?"
		}
		if a.RequestMode == RequestModeGemini {
			return fmt.Sprintf(
				"%s%skey=%s",
				BuildGoogleModelURL(info.ChannelBaseUrl, DefaultAPIVersion, "", region, modelName, suffix),
				keyPrefix,
				info.ApiKey,
			), nil
		} else if a.RequestMode == RequestModeClaude {
			return fmt.Sprintf(
				"%s%skey=%s",
				BuildAnthropicModelURL(info.ChannelBaseUrl, DefaultAPIVersion, "", region, modelName, suffix),
				keyPrefix,
				info.ApiKey,
			), nil
		}
	}
	return "", errors.New("unsupported request mode")
}

func (a *Adaptor) GetRequestURL(info *relaycommon.RelayInfo) (string, error) {
	suffix := ""
	if a.RequestMode == RequestModeGemini {
		if info.IsStream {
			suffix = "streamGenerateContent?alt=sse"
		} else {
			suffix = "generateContent"
		}

		if strings.HasPrefix(info.UpstreamModelName, "imagen") {
			suffix = "predict"
		}
		return a.getRequestUrl(info, info.UpstreamModelName, suffix)
	} else if a.RequestMode == RequestModeClaude {
		if info.IsStream {
			suffix = "streamRawPredict?alt=sse"
		} else {
			suffix = "rawPredict"
		}
		model := info.UpstreamModelName
		if v, ok := claudeModelMap[info.UpstreamModelName]; ok {
			model = v
		}
		return a.getRequestUrl(info, model, suffix)
	} else if a.RequestMode == RequestModeOpenSource {
		return a.getRequestUrl(info, "", "")
	}
	return "", errors.New("unsupported request mode")
}

func (a *Adaptor) SetupRequestHeader(c *gin.Context, req *http.Header, info *relaycommon.RelayInfo) error {
	channel.SetupApiRequestHeader(info, c, req)
	if info.ChannelOtherSettings.VertexKeyType != dto.VertexKeyTypeAPIKey {
		accessToken, err := getAccessToken(a, info)
		if err != nil {
			return err
		}
		req.Set("Authorization", "Bearer "+accessToken)
	}
	if a.AccountCredentials.ProjectID != "" {
		req.Set("x-goog-user-project", a.AccountCredentials.ProjectID)
	}
	if strings.Contains(info.UpstreamModelName, "claude") {
		claude.CommonClaudeHeadersOperation(c, req, info)
	}
	return nil
}

func (a *Adaptor) ConvertOpenAIRequest(c *gin.Context, info *relaycommon.RelayInfo, request *dto.GeneralOpenAIRequest) (any, error) {
	if request == nil {
		return nil, errors.New("request is nil")
	}
	if a.RequestMode == RequestModeGemini && strings.HasPrefix(info.UpstreamModelName, "imagen") {
		prompt := ""
		for _, m := range request.Messages {
			if m.Role == "user" {
				prompt = m.StringContent()
				if prompt != "" {
					break
				}
			}
		}
		if prompt == "" {
			if p, ok := request.Prompt.(string); ok {
				prompt = p
			}
		}
		if prompt == "" {
			return nil, errors.New("prompt is required for image generation")
		}

		imgReq := dto.ImageRequest{
			Model:  request.Model,
			Prompt: prompt,
			N:      lo.ToPtr(uint(1)),
			Size:   "1024x1024",
		}
		if request.N != nil && *request.N > 0 {
			imgReq.N = lo.ToPtr(uint(*request.N))
		}
		if request.Size != "" {
			imgReq.Size = request.Size
		}
		if len(request.ExtraBody) > 0 {
			var extra map[string]any
			if err := common.Unmarshal(request.ExtraBody, &extra); err == nil {
				if n, ok := extra["n"].(float64); ok && n > 0 {
					imgReq.N = lo.ToPtr(uint(n))
				}
				if size, ok := extra["size"].(string); ok {
					imgReq.Size = size
				}
				// accept aspectRatio in extra body (top-level or under parameters)
				if ar, ok := extra["aspectRatio"].(string); ok && ar != "" {
					imgReq.Size = ar
				}
				if params, ok := extra["parameters"].(map[string]any); ok {
					if ar, ok := params["aspectRatio"].(string); ok && ar != "" {
						imgReq.Size = ar
					}
				}
			}
		}
		c.Set("request_model", request.Model)
		return a.ConvertImageRequest(c, info, imgReq)
	}
	if a.RequestMode == RequestModeClaude {
		result, err := service.ConvertRequest(c, info, types.RelayFormatClaude, request)
		if err != nil {
			return nil, err
		}
		claudeReq, ok := result.Value.(*dto.ClaudeRequest)
		if !ok {
			return nil, fmt.Errorf("expected Anthropic Messages request, got %T", result.Value)
		}
		vertexClaudeReq := copyRequest(claudeReq, anthropicVersion)
		c.Set("request_model", claudeReq.Model)
		info.UpstreamModelName = claudeReq.Model
		return vertexClaudeReq, nil
	} else if a.RequestMode == RequestModeGemini {
		result, err := service.ConvertRequest(c, info, types.RelayFormatGemini, request)
		if err != nil {
			return nil, err
		}
		geminiRequest, ok := result.Value.(*dto.GeminiChatRequest)
		if !ok {
			return nil, fmt.Errorf("expected Gemini generateContent request, got %T", result.Value)
		}
		if model_setting.GetGeminiSettings().RemoveFunctionResponseIdEnabled {
			removeFunctionCallIDs(geminiRequest)
		}
		c.Set("request_model", request.Model)
		return geminiRequest, nil
	} else if a.RequestMode == RequestModeOpenSource {
		return request, nil
	}
	return nil, errors.New("unsupported request mode")
}

func (a *Adaptor) ConvertRerankRequest(c *gin.Context, relayMode int, request dto.RerankRequest) (any, error) {
	return nil, nil
}

func (a *Adaptor) ConvertEmbeddingRequest(c *gin.Context, info *relaycommon.RelayInfo, request dto.EmbeddingRequest) (any, error) {
	//TODO implement me
	return nil, errors.New("not implemented")
}

func (a *Adaptor) ConvertOpenAIResponsesRequest(c *gin.Context, info *relaycommon.RelayInfo, request dto.OpenAIResponsesRequest) (any, error) {
	// TODO implement me
	return nil, errors.New("not implemented")
}

func (a *Adaptor) DoRequest(c *gin.Context, info *relaycommon.RelayInfo, requestBody io.Reader) (any, error) {
	return channel.DoApiRequest(a, c, info, requestBody)
}

func (a *Adaptor) DoResponse(c *gin.Context, resp *http.Response, info *relaycommon.RelayInfo) (usage any, err *types.NewAPIError) {
	claudeAdaptor := claude.Adaptor{}
	if info.IsStream {
		switch a.RequestMode {
		case RequestModeClaude:
			return claudeAdaptor.DoResponse(c, resp, info)
		case RequestModeGemini:
			if info.RelayMode == constant.RelayModeGemini {
				return gemini.GeminiTextGenerationStreamHandler(c, info, resp)
			} else {
				return gemini.GeminiChatStreamHandler(c, info, resp)
			}
		case RequestModeOpenSource:
			return openai.OaiStreamHandler(c, info, resp)
		}
	} else {
		switch a.RequestMode {
		case RequestModeClaude:
			return claudeAdaptor.DoResponse(c, resp, info)
		case RequestModeGemini:
			if info.RelayMode == constant.RelayModeGemini {
				return gemini.GeminiTextGenerationHandler(c, info, resp)
			} else {
				if strings.HasPrefix(info.UpstreamModelName, "imagen") {
					return gemini.GeminiImageHandler(c, info, resp)
				}
				return gemini.GeminiChatHandler(c, info, resp)
			}
		case RequestModeOpenSource:
			return openai.OpenaiHandler(c, info, resp)
		}
	}
	return
}

func (a *Adaptor) GetModelList() []string {
	var modelList []string
	for i, s := range ModelList {
		modelList = append(modelList, s)
		ModelList[i] = s
	}
	for i, s := range claude.ModelList {
		modelList = append(modelList, s)
		claude.ModelList[i] = s
	}
	for i, s := range gemini.ModelList {
		modelList = append(modelList, s)
		gemini.ModelList[i] = s
	}
	return modelList
}

func (a *Adaptor) GetChannelName() string {
	return ChannelName
}
