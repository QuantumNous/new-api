package chatgpt_web

import (
	"errors"
	"io"
	"net/http"
	"strings"

	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/relay/channel"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	relayconstant "github.com/QuantumNous/new-api/relay/constant"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/types"

	"github.com/gin-gonic/gin"
)

// Adaptor 实现 ChatGPT 网页逆向渠道。
// 流程：ConvertOpenAIRequest 造 conversation 体 -> SetupRequestHeader 里 sentinel+PoW 拿令牌
// -> DoRequest 复用 channel.DoApiRequest 发 conversation -> DoResponse 解 v1 SSE 转 OpenAI。
type Adaptor struct {
	// promptTokens 在 ConvertOpenAIRequest 阶段算好，DoResponse 估算 usage 时复用。
	// 适配器实例是每请求 new 的，故可安全持有请求级状态。
	promptTokens int
}

func (a *Adaptor) Init(info *relaycommon.RelayInfo) {}

func (a *Adaptor) GetChannelName() string { return ChannelName }

func (a *Adaptor) GetModelList() []string { return ModelList }

func (a *Adaptor) GetRequestURL(info *relaycommon.RelayInfo) (string, error) {
	return strings.TrimRight(info.ChannelBaseUrl, "/") + "/backend-api/conversation", nil
}

func (a *Adaptor) ConvertOpenAIRequest(c *gin.Context, info *relaycommon.RelayInfo, request *dto.GeneralOpenAIRequest) (any, error) {
	if request == nil {
		return nil, errors.New("chatgpt-web channel: request is nil")
	}
	a.promptTokens = countPromptTokens(request.Messages, info.UpstreamModelName)
	return buildConversationRequest(request.Messages, info.UpstreamModelName), nil
}

func (a *Adaptor) SetupRequestHeader(c *gin.Context, header *http.Header, info *relaycommon.RelayInfo) error {
	key, err := ParseWebKey(info.ApiKey)
	if err != nil {
		return err
	}

	ua := defaultUA
	base := map[string]string{
		"Authorization":      "Bearer " + key.AccessToken,
		"chatgpt-account-id": key.AccountID,
		"OAI-Device-Id":      key.DeviceID,
		"OAI-Language":       "en-US",
		"User-Agent":         ua,
		"Referer":            "https://chatgpt.com/",
		"Origin":             "https://chatgpt.com",
	}
	for k, v := range base {
		header.Set(k, v)
	}
	header.Set("Content-Type", "application/json")
	header.Set("Accept", "text/event-stream")

	// 关键：发 conversation 之前，先 sentinel 换 token + 本地解 PoW。
	client, err := getHttpClient(info)
	if err != nil {
		return err
	}
	cr, err := fetchChatRequirements(client, info.ChannelBaseUrl, base)
	if err != nil {
		return err
	}
	header.Set("OpenAI-Sentinel-Chat-Requirements-Token", cr.Token)
	if cr.Proofofwork.Required {
		header.Set("OpenAI-Sentinel-Proof-Token", solveProofOfWork(cr.Proofofwork.Seed, cr.Proofofwork.Difficulty, ua))
	}
	// 注：turnstile.required 实测可不带 turnstile token；若上游某天强制，这里会在 DoResponse 报错暴露。
	return nil
}

func getHttpClient(info *relaycommon.RelayInfo) (*http.Client, error) {
	if info.ChannelSetting.Proxy != "" {
		return service.NewProxyHttpClient(info.ChannelSetting.Proxy)
	}
	return service.GetHttpClient(), nil
}

func (a *Adaptor) DoRequest(c *gin.Context, info *relaycommon.RelayInfo, requestBody io.Reader) (any, error) {
	return channel.DoApiRequest(a, c, info, requestBody)
}

func (a *Adaptor) DoResponse(c *gin.Context, resp *http.Response, info *relaycommon.RelayInfo) (usage any, err *types.NewAPIError) {
	// Responses API（/v1/responses）：把 conversation SSE 合成为 responses 事件
	if info.RelayMode == relayconstant.RelayModeResponses {
		if info.IsStream {
			return ResponsesStreamHandler(c, info, resp, a.promptTokens)
		}
		return ResponsesHandler(c, info, resp, a.promptTokens)
	}
	// Chat Completions（/v1/chat/completions）
	if info.IsStream {
		return StreamHandler(c, info, resp, a.promptTokens)
	}
	return Handler(c, info, resp, a.promptTokens)
}

// ConvertOpenAIResponsesRequest 把 /v1/responses 请求转成 ChatGPT conversation 体。
func (a *Adaptor) ConvertOpenAIResponsesRequest(c *gin.Context, info *relaycommon.RelayInfo, request dto.OpenAIResponsesRequest) (any, error) {
	body, msgs := buildResponsesConversationRequest(request, info.UpstreamModelName)
	a.promptTokens = countPromptTokens(msgs, info.UpstreamModelName)
	return body, nil
}

// ───── 不支持的端点 ─────

func (a *Adaptor) ConvertRerankRequest(c *gin.Context, relayMode int, request dto.RerankRequest) (any, error) {
	return nil, errors.New("chatgpt-web channel: rerank not supported")
}

func (a *Adaptor) ConvertEmbeddingRequest(c *gin.Context, info *relaycommon.RelayInfo, request dto.EmbeddingRequest) (any, error) {
	return nil, errors.New("chatgpt-web channel: embedding not supported")
}

func (a *Adaptor) ConvertAudioRequest(c *gin.Context, info *relaycommon.RelayInfo, request dto.AudioRequest) (io.Reader, error) {
	return nil, errors.New("chatgpt-web channel: audio not supported")
}

func (a *Adaptor) ConvertImageRequest(c *gin.Context, info *relaycommon.RelayInfo, request dto.ImageRequest) (any, error) {
	return nil, errors.New("chatgpt-web channel: image not supported")
}

func (a *Adaptor) ConvertClaudeRequest(c *gin.Context, info *relaycommon.RelayInfo, request *dto.ClaudeRequest) (any, error) {
	return nil, errors.New("chatgpt-web channel: claude messages not supported")
}

func (a *Adaptor) ConvertGeminiRequest(c *gin.Context, info *relaycommon.RelayInfo, request *dto.GeminiChatRequest) (any, error) {
	return nil, errors.New("chatgpt-web channel: gemini not supported")
}
