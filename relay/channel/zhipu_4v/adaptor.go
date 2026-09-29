package zhipu_4v

import (
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"

	"github.com/QuantumNous/new-api/common"
	channelconstant "github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/relay/channel"
	"github.com/QuantumNous/new-api/relay/channel/claude"
	"github.com/QuantumNous/new-api/relay/channel/openai"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	relayconstant "github.com/QuantumNous/new-api/relay/constant"
	"github.com/QuantumNous/new-api/service/relayconvert"
	"github.com/QuantumNous/new-api/service/responsescompat"
	"github.com/QuantumNous/new-api/types"
	"github.com/samber/lo"

	"github.com/gin-gonic/gin"
)

type Adaptor struct {
}

func shouldUseZhipuClaudeCompatibleAPI(info *relaycommon.RelayInfo) bool {
	if info == nil {
		return false
	}
	// FinalRequestRelayFormat 仅在 Convert 之后才被赋值；Convert 前此 guard 不生效，
	// Responses 兼容路径此时依赖 ConvertOpenAIResponsesRequest 里的 info.RelayFormat 判断兜底。
	if info.RelayMode == relayconstant.RelayModeResponses && info.FinalRequestRelayFormat == types.RelayFormatOpenAI {
		return false
	}
	if isZhipuCodingPlanClaudeRequest(info) {
		return true
	}
	if info.RelayFormat == types.RelayFormatClaude {
		return true
	}
	return common.IsClaudeCompatibleModel(info.UpstreamModelName)
}

func isZhipuCodingPlanClaudeRequest(info *relaycommon.RelayInfo) bool {
	if !isZhipuCodingPlan(info) {
		return false
	}
	// 白名单而非黑名单：直连 /v1/chat/completions 与 /v1/messages 不经 Path2RelayMode，RelayMode 为 Unknown，
	// 必须放行；count_tokens/compact/input_tokens/moderations/edits 等显式模式不再默认送 Claude 端点。
	switch info.RelayMode {
	case relayconstant.RelayModeUnknown,
		relayconstant.RelayModeChatCompletions,
		relayconstant.RelayModeCompletions,
		relayconstant.RelayModeResponses:
		return true
	default:
		return false
	}
}

func zhipuCodingPlanAliases() []string {
	return []string{"glm-coding-plan", "glm-coding-plan-international", zcodeStartPlanBaseURL}
}

// zcodeStartPlanBaseURL 是 ZCode StartPlan 免费档（zcode.z.ai 代理）的渠道
// base 别名，密钥为 zcodeJwtToken（Bearer 鉴权），随 Coding Plan 家族路由。
const zcodeStartPlanBaseURL = "zcode-start-plan"

// 风险备案（3.14.4 解包实证）：上游仅对 start-plan 模型请求要求阿里云 captcha，当前
// 服务端 captcha.skip_model_request=true 已跳过；若翻回 false，start-plan 需
// x-aliyun-captcha-verify-param/-region 头而本实现不生成，渠道会断。

// isZhipuStartPlanBase 判定 base 是否为 StartPlan 代理：别名字面量，或
// zcode.z.ai 的 /api/v1/zcode-plan* 自定义全 URL。
func isZhipuStartPlanBase(baseURL string) bool {
	normalized := strings.TrimRight(strings.TrimSpace(baseURL), "/")
	if normalized == zcodeStartPlanBaseURL {
		return true
	}
	parsed, err := url.Parse(normalized)
	if err != nil || !strings.EqualFold(parsed.Hostname(), "zcode.z.ai") {
		return false
	}
	return strings.HasPrefix(parsed.Path, "/api/v1/zcode-plan")
}

func zhipuCodingPlanBases() map[string]channelconstant.ChannelSpecialBase {
	aliases := zhipuCodingPlanAliases()
	bases := make(map[string]channelconstant.ChannelSpecialBase, len(aliases))
	for _, alias := range aliases {
		if base, ok := channelconstant.ChannelSpecialBases[alias]; ok {
			bases[alias] = base
		}
	}
	return bases
}

func isZhipuCodingPlan(info *relaycommon.RelayInfo) bool {
	if info == nil {
		return false
	}
	return isZhipuCodingPlanBase(info.ChannelBaseUrl)
}

func isZhipuCodingPlanBase(baseURL string) bool {
	normalized := strings.TrimRight(strings.TrimSpace(baseURL), "/")
	for _, alias := range zhipuCodingPlanAliases() {
		if normalized == alias {
			return true
		}
	}
	for _, specialBase := range zhipuCodingPlanBases() {
		if normalized == strings.TrimRight(specialBase.ClaudeBaseURL, "/") ||
			normalized == strings.TrimRight(specialBase.OpenAIBaseURL, "/") {
			return true
		}
	}
	return false
}

// isZhipuZcodeMode 判定 Coding Plan 渠道是否开启 ZCode 模式：开启后仅接受
// Claude Messages(/v1/messages) 入站并注入 ZCode 设备指纹；关闭保持原有透传逻辑。
func isZhipuZcodeMode(info *relaycommon.RelayInfo) bool {
	if !isZhipuCodingPlan(info) {
		return false
	}
	return info.ChannelSetting.ZcodeModeEnabled
}

// IsZCodeModeChannel 按渠道类型、base 与设置判定渠道是否处于 ZCode 模式。
// ZCode 模式渠道仅接受 Claude Messages(/v1/messages) 入站：协议转换会丢失
// ZCode 客户端指纹，导致 Coding Plan 客户端权益（夜间 0 扣费、1.5× 加成）失效。
func IsZCodeModeChannel(channelType int, baseURL string, setting dto.ChannelSettings) bool {
	if channelType != channelconstant.ChannelTypeZhipu_v4 || !setting.ZcodeModeEnabled {
		return false
	}
	return isZhipuCodingPlanBase(baseURL)
}

func zhipuSpecialBase(baseURL string) (channelconstant.ChannelSpecialBase, bool) {
	normalized := strings.TrimRight(strings.TrimSpace(baseURL), "/")
	if specialBase, ok := channelconstant.ChannelSpecialBases[normalized]; ok {
		return specialBase, true
	}
	for _, specialBase := range zhipuCodingPlanBases() {
		if normalized == strings.TrimRight(specialBase.ClaudeBaseURL, "/") ||
			normalized == strings.TrimRight(specialBase.OpenAIBaseURL, "/") {
			return specialBase, true
		}
	}
	return channelconstant.ChannelSpecialBase{}, false
}

func setupZhipuClaudeCompatibleHeaders(c *gin.Context, req *http.Header, info *relaycommon.RelayInfo) {
	channel.SetupApiRequestHeader(info, c, req)
	if isZhipuStartPlanBase(info.ChannelBaseUrl) {
		// StartPlan 代理以 zcodeJwtToken 作 Bearer 鉴权（ZCode 桌面端行为）。
		req.Set("Authorization", "Bearer "+info.ApiKey)
	} else {
		req.Set("x-api-key", info.ApiKey)
	}
	anthropicVersion := c.Request.Header.Get("anthropic-version")
	if anthropicVersion == "" {
		anthropicVersion = "2023-06-01"
	}
	req.Set("anthropic-version", anthropicVersion)
	claude.CommonClaudeHeadersOperation(c, req, info)
	if isZhipuZcodeMode(info) {
		// 归一为官方形态：AI SDK 恒发 application/json（流式由 body.stream 决定），
		// 官方对 GLM 不带 anthropic-beta；下游二手转换带入的客户端头在此清除。
		req.Set("Content-Type", "application/json")
		req.Set("Accept", "application/json")
		req.Del("anthropic-beta")
		setupZCodeCompatibilityHeaders(req, info)
	} else if isZhipuCodingPlan(info) {
		setupZCodeTraceHeaders(req, zcodeLegacyTraceHeadersEnabled(info))
	}
}

func (a *Adaptor) ConvertGeminiRequest(*gin.Context, *relaycommon.RelayInfo, *dto.GeminiChatRequest) (any, error) {
	//TODO implement me
	return nil, errors.New("not implemented")
}

func (a *Adaptor) ConvertClaudeRequest(c *gin.Context, info *relaycommon.RelayInfo, req *dto.ClaudeRequest) (any, error) {
	applyZCodeBodyFingerprint(info, req)
	return req, nil
}

func (a *Adaptor) ConvertAudioRequest(c *gin.Context, info *relaycommon.RelayInfo, request dto.AudioRequest) (io.Reader, error) {
	//TODO implement me
	return nil, errors.New("not implemented")
}

func (a *Adaptor) ConvertImageRequest(c *gin.Context, info *relaycommon.RelayInfo, request dto.ImageRequest) (any, error) {
	return request, nil
}

func (a *Adaptor) Init(info *relaycommon.RelayInfo) {
}

func (a *Adaptor) GetRequestURL(info *relaycommon.RelayInfo) (string, error) {
	baseURL := info.ChannelBaseUrl
	if baseURL == "" {
		baseURL = channelconstant.ChannelBaseURLs[channelconstant.ChannelTypeZhipu_v4]
	}
	specialPlan, hasSpecialPlan := zhipuSpecialBase(baseURL)

	switch {
	case shouldUseZhipuClaudeCompatibleAPI(info):
		claudePath := "/v1/messages"
		if info.RelayMode == relayconstant.RelayModeClaudeCountTokens {
			claudePath = "/v1/messages/count_tokens"
		}
		if hasSpecialPlan && specialPlan.ClaudeBaseURL != "" {
			return fmt.Sprintf("%s%s", specialPlan.ClaudeBaseURL, claudePath), nil
		}
		return fmt.Sprintf("%s/api/anthropic%s", baseURL, claudePath), nil
	default:
		switch info.RelayMode {
		case relayconstant.RelayModeEmbeddings:
			if hasSpecialPlan && specialPlan.OpenAIBaseURL != "" {
				return fmt.Sprintf("%s/embeddings", specialPlan.OpenAIBaseURL), nil
			}
			return fmt.Sprintf("%s/api/paas/v4/embeddings", baseURL), nil
		case relayconstant.RelayModeImagesGenerations:
			if hasSpecialPlan && specialPlan.OpenAIBaseURL != "" {
				return fmt.Sprintf("%s/images/generations", specialPlan.OpenAIBaseURL), nil
			}
			return fmt.Sprintf("%s/api/paas/v4/images/generations", baseURL), nil
		default:
			if hasSpecialPlan && specialPlan.OpenAIBaseURL != "" {
				return fmt.Sprintf("%s/chat/completions", specialPlan.OpenAIBaseURL), nil
			}
			return fmt.Sprintf("%s/api/paas/v4/chat/completions", baseURL), nil
		}
	}
}

func (a *Adaptor) SetupRequestHeader(c *gin.Context, req *http.Header, info *relaycommon.RelayInfo) error {
	if shouldUseZhipuClaudeCompatibleAPI(info) {
		setupZhipuClaudeCompatibleHeaders(c, req, info)
		// V4 客户端签名需在 ZCode 头（含 x-session-id）就绪后按最终 URL 判定；
		// 默认关闭，仅渠道显式开启时才计算。
		if zcodeClientSigningEnabled(info) {
			if finalURL, urlErr := a.GetRequestURL(info); urlErr == nil {
				applyZCodeClientSigning(c, req, info, finalURL)
			}
		}
		return nil
	}
	channel.SetupApiRequestHeader(info, c, req)
	req.Set("Authorization", "Bearer "+info.ApiKey)
	return nil
}

func (a *Adaptor) ConvertOpenAIRequest(c *gin.Context, info *relaycommon.RelayInfo, request *dto.GeneralOpenAIRequest) (any, error) {
	if request == nil {
		return nil, errors.New("request is nil")
	}
	if shouldUseZhipuClaudeCompatibleAPI(info) {
		adaptor := claude.Adaptor{}
		converted, err := adaptor.ConvertOpenAIRequest(c, info, request)
		if err != nil {
			return nil, err
		}
		if claudeReq, ok := converted.(*dto.ClaudeRequest); ok {
			applyZCodeBodyFingerprint(info, claudeReq)
		}
		return converted, nil
	}
	if lo.FromPtrOr(request.TopP, 0) >= 1 {
		request.TopP = lo.ToPtr(0.99)
	}
	return requestOpenAI2Zhipu(*request), nil
}

func (a *Adaptor) ConvertRerankRequest(c *gin.Context, relayMode int, request dto.RerankRequest) (any, error) {
	return nil, nil
}

func (a *Adaptor) ConvertEmbeddingRequest(c *gin.Context, info *relaycommon.RelayInfo, request dto.EmbeddingRequest) (any, error) {
	return request, nil
}

func (a *Adaptor) ConvertOpenAIResponsesRequest(c *gin.Context, info *relaycommon.RelayInfo, request dto.OpenAIResponsesRequest) (any, error) {
	// Chat completions can be internally routed through the Responses relay.
	// Keep that compatibility path on OpenAI Chat so its response handler can
	// aggregate the upstream stream back into the original Chat contract.
	// shouldUseZhipuClaudeCompatibleAPI 对 nil 返回 false，短路后 info 必非 nil
	// ZCode 模式下 Responses 入站也固定转 Claude Messages，不走 OpenAI 直连。
	if shouldUseZhipuClaudeCompatibleAPI(info) && (info.RelayFormat != types.RelayFormatOpenAI || isZhipuZcodeMode(info)) {
		info.FinalRequestRelayFormat = types.RelayFormatClaude
		converted, err := relayconvert.OpenAIResponsesRequestToClaudeMessages(c, &request)
		if err != nil {
			return nil, err
		}
		applyZCodeBodyFingerprint(info, converted)
		return converted, nil
	}
	chatRequest, err := responsescompat.ConvertToOpenAIChatRequest(request)
	if err != nil {
		return nil, err
	}
	if lo.FromPtrOr(chatRequest.TopP, 0) >= 1 {
		chatRequest.TopP = lo.ToPtr(0.99)
	}
	if info != nil {
		info.FinalRequestRelayFormat = types.RelayFormatOpenAI
	}
	return requestOpenAI2Zhipu(*chatRequest), nil
}

func (a *Adaptor) DoRequest(c *gin.Context, info *relaycommon.RelayInfo, requestBody io.Reader) (any, error) {
	resp, err := channel.DoApiRequest(a, c, info, requestBody)
	if err == nil {
		// 上游验签失败（VERIFY_SIGNATURE_INVALID / VERIFY_APIKEY_EXPIRED）时
		// 作废缓存私钥，交由重试机制以新握手签名重发。
		if finalURL, urlErr := a.GetRequestURL(info); urlErr == nil {
			maybeInvalidateZCodeSigningKey(c, info, finalURL, resp)
		}
	}
	return resp, err
}

func (a *Adaptor) DoResponse(c *gin.Context, resp *http.Response, info *relaycommon.RelayInfo) (usage any, err *types.NewAPIError) {
	if info != nil && info.RelayMode == relayconstant.RelayModeResponses && info.GetFinalRequestRelayFormat() == types.RelayFormatClaude {
		if info.IsStream {
			return zhipuClaudeResponsesStreamHandler(c, info, resp)
		}
		return claude.ClaudeResponsesHandler(c, resp, info)
	}
	if info != nil && info.RelayMode == relayconstant.RelayModeResponses && info.GetFinalRequestRelayFormat() == types.RelayFormatOpenAI {
		if info.IsStream {
			return openai.ChatCompletionResponsesStreamHandler(c, info, resp)
		}
		return openai.ChatCompletionResponsesHandler(c, info, resp)
	}
	switch {
	case shouldUseZhipuClaudeCompatibleAPI(info):
		adaptor := claude.Adaptor{}
		return adaptor.DoResponse(c, resp, info)
	default:
		if info.RelayMode == relayconstant.RelayModeImagesGenerations {
			return zhipu4vImageHandler(c, resp, info)
		}
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
