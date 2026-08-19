package groksubscription

import (
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/relay/channel"
	"github.com/QuantumNous/new-api/relay/channel/openai"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	relayconstant "github.com/QuantumNous/new-api/relay/constant"
	"github.com/QuantumNous/new-api/types"
	"github.com/gin-gonic/gin"
)

var errUnsupportedEndpoint = errors.New("grok subscription channel: endpoint not supported")

// Adaptor 是 Grok Subscription 渠道适配器。里程碑 A 仅文本（CLI proxy）。
type Adaptor struct{}

func (a *Adaptor) Init(info *relaycommon.RelayInfo) {}

// GetRequestURL 里程碑 A：文本全部落 CLI proxy 的 /v1/responses（Chat/Claude 经 bridge 转 Responses）。
func (a *Adaptor) GetRequestURL(info *relaycommon.RelayInfo) (string, error) {
	if info == nil {
		return "", errUnsupportedEndpoint
	}
	switch info.RelayMode {
	case relayconstant.RelayModeResponses, relayconstant.RelayModeChatCompletions, relayconstant.RelayModeResponsesCompact:
		return CLIProxyBase + CLIResponsesPath, nil
	default:
		if info.RelayFormat == types.RelayFormatClaude {
			return CLIProxyBase + CLIResponsesPath, nil
		}
		return "", errUnsupportedEndpoint
	}
}

// SetupRequestHeader 注入 OAuth Bearer + CLI identity（仅 CLI proxy）。
// credential 提供逻辑在 Task 8（刷新 lease）接入；此处先解析版本化 JSON 取 access_token。
func (a *Adaptor) SetupRequestHeader(c *gin.Context, header *http.Header, info *relaycommon.RelayInfo) error {
	// info.ApiKey 是 *ChannelMeta 指针嵌入的 promoted field：ChannelMeta 为 nil 时
	// 解引用 info.ApiKey 会 panic。生产路径 InitChannelMeta 恒先构造 ChannelMeta，
	// 此处仍 fail closed 防御，避免误用路径下崩溃。
	if c == nil || info == nil || info.ChannelMeta == nil {
		return errors.New("grok subscription channel: invalid relay context")
	}
	// 纵深防御：注入 Bearer / CLI identity 前，先断言目标 host 就是 CLI proxy。
	// 里程碑 A GetRequestURL 恒定路由到 CLI proxy；里程碑 B 一旦让 URL 动态化
	// （媒体 host），这道 guard 能阻止把凭证发到非 CLI proxy 主机。
	targetURL, err := a.GetRequestURL(info)
	if err != nil {
		return err
	}
	parsed, err := url.Parse(targetURL)
	if err != nil {
		return errors.New("grok subscription channel: invalid upstream url")
	}
	if !IsAllowedTextHost(parsed.Hostname()) {
		return errors.New("grok subscription channel: text credentials only allowed to CLI proxy")
	}
	cred, err := ParseCredential(info.ApiKey)
	if err != nil {
		return fmt.Errorf("grok subscription channel: %w", err)
	}
	channel.SetupApiRequestHeader(info, c, header)
	header.Set("Authorization", "Bearer "+cred.AccessToken)
	// CLI identity 仅发往 CLI proxy。
	header.Set(HeaderXAITokenAuth, HeaderXAITokenAuthValue)
	header.Set(HeaderGrokClientVersion, CLIClientVersion())
	header.Set(HeaderGrokClientID, GrokClientIDValue)
	header.Set("User-Agent", CLIUserAgentPrefix+CLIClientVersion())
	header.Set("X-Request-Id", common.GetUUID())
	return nil
}

func (a *Adaptor) ConvertOpenAIRequest(c *gin.Context, info *relaycommon.RelayInfo, request *dto.GeneralOpenAIRequest) (any, error) {
	if request == nil {
		return nil, errors.New("request is nil")
	}
	// 记录客户端 stream 意图（上游 CLI proxy 强制流式，与此解耦；C1 修复）。
	// request 已在函数开头的 nil 守卫处保证非 nil，故此处只判 Stream 指针。
	if info != nil {
		if request.Stream != nil {
			info.UserWantsStream = *request.Stream
		} else {
			info.UserWantsStream = false
		}
	}
	// CLI proxy 只暴露 /v1/responses，没有原生 Chat Completions 端点。
	// 当通用 Chat→Responses bridge 未生效（默认全局策略关闭）时，请求以
	// RelayModeChatCompletions 落到此 plain 路径；adaptor 自行把 Chat 转成
	// Responses 体，保证不依赖任何可变全局开关（回包由 DoResponse 的 Chat
	// 分支用共享 Responses→Chat handler 转回）。
	responsesBody, err := chatCompletionsRequestToResponsesBody(request)
	if err != nil {
		return nil, err
	}
	if responsesBody.Model == "" && info != nil && info.ChannelMeta != nil {
		responsesBody.Model = info.UpstreamModelName
	}
	return responsesBody, nil
}

func (a *Adaptor) ConvertOpenAIResponsesRequest(c *gin.Context, info *relaycommon.RelayInfo, request dto.OpenAIResponsesRequest) (any, error) {
	// info.UpstreamModelName 是 *ChannelMeta 的 promoted field：ChannelMeta 为 nil
	// 时解引用会 panic，必须与 ConvertOpenAIRequest 一致做 nil 防御。
	if request.Model == "" && info != nil && info.ChannelMeta != nil {
		request.Model = info.UpstreamModelName
	}
	// compact 端点：clean-room 把请求改造成服务端 summary 指令的普通非流式
	// Responses turn（设计 §8.3/§9——不调不存在的上游 compact path）。BuildCompactTurn
	// 追加 summary item、强制 stream/store=false、经 include 请求 encrypted reasoning、
	// 并剥离工具配置。非 compact 路径保持返回 dto（正常 Responses 请求行为不变）。
	if info != nil && info.RelayMode == relayconstant.RelayModeResponsesCompact {
		raw, err := common.Marshal(&request)
		if err != nil {
			return nil, err
		}
		out, err := BuildCompactTurn(raw)
		if err != nil {
			return nil, err
		}
		return json.RawMessage(out), nil
	}
	return request, nil
}

func (a *Adaptor) ConvertClaudeRequest(c *gin.Context, info *relaycommon.RelayInfo, request *dto.ClaudeRequest) (any, error) {
	// Claude 经 NewAPI Claude->Responses bridge，Grok 不在 adaptor 直接透传 Claude。
	return nil, errUnsupportedEndpoint
}

func (a *Adaptor) DoRequest(c *gin.Context, info *relaycommon.RelayInfo, requestBody io.Reader) (any, error) {
	return channel.DoApiRequest(a, c, info, requestBody)
}

func (a *Adaptor) DoResponse(c *gin.Context, resp *http.Response, info *relaycommon.RelayInfo) (any, *types.NewAPIError) {
	switch info.RelayMode {
	case relayconstant.RelayModeResponsesCompact:
		// Grok 上游走 CLI proxy /v1/responses，回普通 Responses JSON（非 OpenAI
		// compact 格式），故用本包 clean-room handler，而非
		// openai.OaiResponsesCompactionHandler（后者解析上游 compact 格式）。
		return grokCompactResponseHandler(c, resp, info)
	case relayconstant.RelayModeResponses:
		if info.IsStream {
			return openai.OaiResponsesStreamHandler(c, info, resp)
		}
		return openai.OaiResponsesHandler(c, info, resp)
	case relayconstant.RelayModeChatCompletions:
		// 上游（CLI proxy）恒返回 Responses SSE；用客户端原始 stream 意图
		// （info.UserWantsStream）而非 info.IsStream 决定回写形式（C1 修复）。
		return RelayChatOverGrok(c, info, resp)
	default:
		if info.IsStream {
			return openai.OaiStreamHandler(c, info, resp)
		}
		return openai.OpenaiHandler(c, info, resp)
	}
}

func (a *Adaptor) GetModelList() []string { return DefaultModelList }
func (a *Adaptor) GetChannelName() string { return ChannelName }

// 里程碑 A 不支持的能力（里程碑 B 实现）。
func (a *Adaptor) ConvertRerankRequest(*gin.Context, int, dto.RerankRequest) (any, error) {
	return nil, errUnsupportedEndpoint
}
func (a *Adaptor) ConvertEmbeddingRequest(*gin.Context, *relaycommon.RelayInfo, dto.EmbeddingRequest) (any, error) {
	return nil, errUnsupportedEndpoint
}
func (a *Adaptor) ConvertAudioRequest(*gin.Context, *relaycommon.RelayInfo, dto.AudioRequest) (io.Reader, error) {
	return nil, errUnsupportedEndpoint
}
func (a *Adaptor) ConvertImageRequest(*gin.Context, *relaycommon.RelayInfo, dto.ImageRequest) (any, error) {
	return nil, errUnsupportedEndpoint
}
func (a *Adaptor) ConvertGeminiRequest(*gin.Context, *relaycommon.RelayInfo, *dto.GeminiChatRequest) (any, error) {
	return nil, errUnsupportedEndpoint
}
