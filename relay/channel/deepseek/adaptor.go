package deepseek

import (
	"errors"
	"fmt"
	"io"
	"net/http"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/relay/channel"
	"github.com/QuantumNous/new-api/relay/channel/claude"
	"github.com/QuantumNous/new-api/relay/channel/openai"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/relay/constant"
	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/QuantumNous/new-api/relaykit/types"
	"github.com/QuantumNous/new-api/setting/reasoning"
	"github.com/gin-gonic/gin"
)

type Adaptor struct {
}

func (a *Adaptor) ConvertGeminiRequest(*gin.Context, *relaycommon.RelayInfo, *dto.GeminiChatRequest) (any, error) {
	//TODO implement me
	return nil, errors.New("not implemented")
}

func (a *Adaptor) ConvertClaudeRequest(c *gin.Context, info *relaycommon.RelayInfo, req *dto.ClaudeRequest) (any, error) {
	adaptor := claude.Adaptor{}
	convertedRequest, err := adaptor.ConvertClaudeRequest(c, info, req)
	if err != nil {
		return nil, err
	}
	claudeRequest, ok := convertedRequest.(*dto.ClaudeRequest)
	if !ok {
		return convertedRequest, nil
	}
	if err := applyDeepSeekV4ClaudeThinkingSuffix(info, claudeRequest); err != nil {
		return nil, err
	}
	return claudeRequest, nil
}

func (a *Adaptor) ConvertAudioRequest(c *gin.Context, info *relaycommon.RelayInfo, request dto.AudioRequest) (io.Reader, error) {
	//TODO implement me
	return nil, errors.New("not implemented")
}

func (a *Adaptor) ConvertImageRequest(c *gin.Context, info *relaycommon.RelayInfo, request dto.ImageRequest) (any, error) {
	//TODO implement me
	return nil, errors.New("not implemented")
}

func (a *Adaptor) Init(info *relaycommon.RelayInfo) {
}

func (a *Adaptor) GetRequestURL(info *relaycommon.RelayInfo) (string, error) {
	fimBaseUrl := info.ChannelBaseUrl
	switch info.RelayFormat {
	case types.RelayFormatClaude:
		return fmt.Sprintf("%s/anthropic/v1/messages", info.ChannelBaseUrl), nil
	default:
		if !strings.HasSuffix(info.ChannelBaseUrl, "/beta") {
			fimBaseUrl += "/beta"
		}
		switch info.RelayMode {
		case constant.RelayModeCompletions:
			return fmt.Sprintf("%s/completions", fimBaseUrl), nil
		case constant.RelayModeResponses:
			return fmt.Sprintf("%s/responses", info.ChannelBaseUrl), nil
		default:
			return fmt.Sprintf("%s/v1/chat/completions", info.ChannelBaseUrl), nil
		}
	}
}

func (a *Adaptor) SetupRequestHeader(c *gin.Context, req *http.Header, info *relaycommon.RelayInfo) error {
	channel.SetupApiRequestHeader(info, c, req)
	req.Set("Authorization", "Bearer "+info.ApiKey)
	return nil
}

func (a *Adaptor) ConvertOpenAIRequest(c *gin.Context, info *relaycommon.RelayInfo, request *dto.GeneralOpenAIRequest) (any, error) {
	if request == nil {
		return nil, errors.New("request is nil")
	}
	if err := applyDeepSeekV4OpenAIThinkingSuffix(info, request); err != nil {
		return nil, err
	}
	ensureToolCallReasoningContent(request)
	return request, nil
}

// ensureToolCallReasoningContent 保证所有携带 tool_calls 的 assistant 消息都带
// reasoning_content 字段。DeepSeek 在开启思考模式时，如果历史消息里的工具调用轮次
// 缺少 reasoning_content（例如客户端或中间路由裁剪上下文时丢弃了该字段），上游会
// 直接返回 400 "reasoning_content must be passed back to the API"。空字符串即可
// 通过该校验，已有的非空值则原样保留。
func ensureToolCallReasoningContent(request *dto.GeneralOpenAIRequest) {
	emptyReasoning := ""
	for i := range request.Messages {
		msg := &request.Messages[i]
		if msg.Role != "assistant" || len(msg.ToolCalls) == 0 {
			continue
		}
		if msg.ReasoningContent == nil {
			msg.ReasoningContent = &emptyReasoning
		}
	}
}

func applyDeepSeekV4OpenAIThinkingSuffix(info *relaycommon.RelayInfo, request *dto.GeneralOpenAIRequest) error {
	modelName := request.Model
	if info != nil && info.ChannelMeta != nil && info.UpstreamModelName != "" {
		modelName = info.UpstreamModelName
	}
	baseModel, thinkingType, effort, ok := reasoning.ParseDeepSeekV4ThinkingSuffix(modelName)
	if !ok {
		return nil
	}
	thinking, err := common.Marshal(map[string]string{
		"type": thinkingType,
	})
	if err != nil {
		return fmt.Errorf("error marshalling thinking: %w", err)
	}
	request.Model = baseModel
	request.THINKING = thinking
	request.ReasoningEffort = effort
	if info != nil {
		if info.ChannelMeta != nil {
			info.UpstreamModelName = baseModel
		}
		info.SetReasoningEffort(effort)
	}
	return nil
}

func applyDeepSeekV4ClaudeThinkingSuffix(info *relaycommon.RelayInfo, request *dto.ClaudeRequest) error {
	modelName := request.Model
	if info != nil && info.ChannelMeta != nil && info.UpstreamModelName != "" {
		modelName = info.UpstreamModelName
	}
	baseModel, thinkingType, effort, ok := reasoning.ParseDeepSeekV4ThinkingSuffix(modelName)
	if !ok {
		return nil
	}
	request.Model = baseModel
	request.Thinking = &dto.Thinking{Type: thinkingType}
	if effort == "" {
		request.OutputConfig = nil
	} else {
		outputConfig, err := common.Marshal(map[string]string{
			"effort": effort,
		})
		if err != nil {
			return fmt.Errorf("error marshalling output_config: %w", err)
		}
		request.OutputConfig = outputConfig
	}
	if info != nil {
		if info.ChannelMeta != nil {
			info.UpstreamModelName = baseModel
		}
		info.SetReasoningEffort(effort)
	}
	return nil
}

func (a *Adaptor) ConvertRerankRequest(c *gin.Context, relayMode int, request dto.RerankRequest) (any, error) {
	return nil, nil
}

func (a *Adaptor) ConvertEmbeddingRequest(c *gin.Context, info *relaycommon.RelayInfo, request dto.EmbeddingRequest) (any, error) {
	//TODO implement me
	return nil, errors.New("not implemented")
}

func (a *Adaptor) ConvertOpenAIResponsesRequest(_ *gin.Context, info *relaycommon.RelayInfo, request dto.OpenAIResponsesRequest) (any, error) {
	applyDeepSeekV4ResponsesThinkingSuffix(info, &request)
	return request, nil
}

func applyDeepSeekV4ResponsesThinkingSuffix(info *relaycommon.RelayInfo, request *dto.OpenAIResponsesRequest) {
	modelName := request.Model
	if info != nil && info.ChannelMeta != nil && info.UpstreamModelName != "" {
		modelName = info.UpstreamModelName
	}
	baseModel, thinkingType, effort, ok := reasoning.ParseDeepSeekV4ThinkingSuffix(modelName)
	if ok {
		if thinkingType == "disabled" {
			effort = "none"
		}
		request.Model = baseModel
		if request.Reasoning == nil {
			request.Reasoning = &dto.Reasoning{}
		}
		request.Reasoning.Effort = effort
		if info != nil && info.ChannelMeta != nil {
			info.UpstreamModelName = baseModel
		}
	}
	if info != nil && request.Reasoning != nil {
		info.SetReasoningEffort(request.Reasoning.Effort)
	}
}

func (a *Adaptor) DoRequest(c *gin.Context, info *relaycommon.RelayInfo, requestBody io.Reader) (any, error) {
	return channel.DoApiRequest(a, c, info, requestBody)
}

func (a *Adaptor) DoResponse(c *gin.Context, resp *http.Response, info *relaycommon.RelayInfo) (usage any, err *types.NewAPIError) {
	switch info.RelayFormat {
	case types.RelayFormatClaude:
		adaptor := claude.Adaptor{}
		return adaptor.DoResponse(c, resp, info)
	default:
		adaptor := openai.Adaptor{}
		return adaptor.DoResponse(c, resp, info)
	}
}

func (a *Adaptor) GetModelList() []string {
	return ModelList
}

func (a *Adaptor) GetChannelName() string {
	return ChannelName
}
