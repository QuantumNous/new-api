package codex

import (
	"bytes"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/pkg/apicompat"
	"github.com/QuantumNous/new-api/relay/channel"
	"github.com/QuantumNous/new-api/relay/channel/openai"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	relayconstant "github.com/QuantumNous/new-api/relay/constant"
	"github.com/QuantumNous/new-api/types"

	"github.com/gin-gonic/gin"
)

type Adaptor struct {
}

func (a *Adaptor) ConvertGeminiRequest(c *gin.Context, info *relaycommon.RelayInfo, request *dto.GeminiChatRequest) (any, error) {
	return nil, errors.New("codex channel: endpoint not supported")
}

func (a *Adaptor) ConvertClaudeRequest(*gin.Context, *relaycommon.RelayInfo, *dto.ClaudeRequest) (any, error) {
	return nil, errors.New("codex channel: /v1/messages endpoint not supported")
}

func (a *Adaptor) ConvertAudioRequest(c *gin.Context, info *relaycommon.RelayInfo, request dto.AudioRequest) (io.Reader, error) {
	return nil, errors.New("codex channel: endpoint not supported")
}

func (a *Adaptor) ConvertImageRequest(c *gin.Context, info *relaycommon.RelayInfo, request dto.ImageRequest) (any, error) {
	if !IsCodexImageModel(request.Model) {
		return nil, fmt.Errorf("codex channel: image endpoint requires a gpt-image-* model, got %q", request.Model)
	}
	if err := ValidateCodexImageRequest(request); err != nil {
		return nil, err
	}

	action := "generate"
	var inputImages []string
	var mask string
	if info.RelayMode == relayconstant.RelayModeImagesEdits {
		action = "edit"
		imgs, m, err := readCodexEditImages(c)
		if err != nil {
			return nil, err
		}
		inputImages, mask = imgs, m
	}

	// 上游强制流式：本路径始终以 SSE 读取
	info.IsStream = true
	return buildCodexImageBody(request, resolveImageCarrierModel(info), action, inputImages, mask), nil
}

func (a *Adaptor) Init(info *relaycommon.RelayInfo) {
}

func (a *Adaptor) ConvertOpenAIRequest(c *gin.Context, info *relaycommon.RelayInfo, request *dto.GeneralOpenAIRequest) (any, error) {
	// 记录客户端 stream 意图（上游强制流式，与此解耦）
	if info != nil {
		if request != nil && request.Stream != nil {
			info.UserWantsStream = *request.Stream
		} else {
			info.UserWantsStream = false
		}
	}

	compatChat, err := ToCompatChatRequest(request)
	if err != nil {
		return nil, fmt.Errorf("codex chat→responses: %w", err)
	}
	compatResp, err := apicompat.ChatCompletionsToResponses(compatChat)
	if err != nil {
		return nil, fmt.Errorf("codex chat→responses: %w", err)
	}
	applyCodexConstraints(compatResp, info)
	return ensureInstructionsField(compatResp)
}

func (a *Adaptor) ConvertRerankRequest(c *gin.Context, relayMode int, request dto.RerankRequest) (any, error) {
	return nil, errors.New("codex channel: /v1/rerank endpoint not supported")
}

func (a *Adaptor) ConvertEmbeddingRequest(c *gin.Context, info *relaycommon.RelayInfo, request dto.EmbeddingRequest) (any, error) {
	return nil, errors.New("codex channel: /v1/embeddings endpoint not supported")
}

func (a *Adaptor) ConvertOpenAIResponsesRequest(c *gin.Context, info *relaycommon.RelayInfo, request dto.OpenAIResponsesRequest) (any, error) {
	isCompact := info != nil && info.RelayMode == relayconstant.RelayModeResponsesCompact

	// 关键设计：/v1/responses 路径不再走 apicompat.ResponsesRequest 的 typed roundtrip。
	// apicompat 类型只是 dto.OpenAIResponsesRequest 的严格子集；走 typed 中转会：
	//   1) 丢掉 ~13 个 dto 独有字段（Conversation/ContextManagement/Truncation/User/
	//      Metadata/MaxToolCalls/Prompt/EnableThinking/Preset/PromptCacheRetention/
	//      SafetyIdentifier/StreamOptions/TopLogProbs），
	//   2) 当客户端把 instructions 写成数组/对象/null 时 unmarshal 直接报错（dto 是
	//      json.RawMessage，apicompat 是 string）。
	// 改为序列化成 map[string]any 后直接 mutate，未知字段透传。
	raw, err := common.Marshal(&request)
	if err != nil {
		return nil, err
	}
	body := map[string]any{}
	if err := common.Unmarshal(raw, &body); err != nil {
		return nil, err
	}

	// 按真实 Codex 后端约束过滤字段；compact 还会移除其端点不接受的 tool-limit 字段。
	applyCodexConstraintsToMap(body, info, isCompact)

	if isCompact {
		// compact 模式上游不接受 store/stream 字段
		delete(body, "store")
		delete(body, "stream")
		return body, nil
	}

	// /v1/responses（非 compact）：
	//   - store: Codex 后端硬性要求 false
	//   - stream: 必须保留客户端原始意图（OaiResponsesHandler / StreamHandler 按 info.IsStream 分派）
	body["store"] = false
	if request.Stream != nil {
		body["stream"] = *request.Stream
	} else {
		// 客户端未指定 stream 字段时，让 omitempty 自然丢弃；
		// 上游缺省为非流式。
		delete(body, "stream")
	}

	return body, nil
}

func (a *Adaptor) DoRequest(c *gin.Context, info *relaycommon.RelayInfo, requestBody io.Reader) (any, error) {
	resp, err := channel.DoApiRequest(a, c, info, requestBody)
	if err != nil {
		return resp, err
	}
	// 白标(F1)：codex 图像路径上游非 200 响应若交给下游 service.RelayErrorHandler，
	// 会把上游 error.message（含 ChatGPT/OpenAI 品牌、承载模型 gpt-5.4、内部模型名）
	// 直接透传给客户端。此处在适配器 seam 拦截：把上游原文仅落服务端日志，并用一份
	// 通用脱敏 JSON 错误替换响应体，状态码保持不变，使下游 handler 无可泄露。
	// 仅作用于图像 relay mode；text/responses 路径不受影响。
	if resp != nil {
		switch info.RelayMode {
		case relayconstant.RelayModeImagesGenerations, relayconstant.RelayModeImagesEdits:
			if resp.StatusCode != http.StatusOK {
				sanitizeCodexImageErrorResponse(c, resp)
			}
		}
	}
	return resp, err
}

// sanitizeCodexImageErrorResponse 读取并落日志上游错误体(仅服务端)，随后把响应体替换为
// 通用脱敏 JSON 错误，保留原状态码。下游 service.RelayErrorHandler 解析到的将是这份
// 脱敏内容，因此不会向客户端泄露任何上游品牌/模型信息。
func sanitizeCodexImageErrorResponse(c *gin.Context, resp *http.Response) {
	var upstreamBody []byte
	if resp.Body != nil {
		upstreamBody, _ = io.ReadAll(resp.Body)
		_ = resp.Body.Close()
	}
	if len(upstreamBody) > 0 {
		common.SysError(fmt.Sprintf("codex image: upstream returned HTTP %d, body: %s",
			resp.StatusCode, common.LocalLogPreview(string(upstreamBody))))
	} else {
		common.SysError(fmt.Sprintf("codex image: upstream returned HTTP %d with empty body", resp.StatusCode))
	}

	sanitized := map[string]any{
		"error": map[string]any{
			"message": "codex image generation failed",
			"type":    "upstream_error",
		},
	}
	payload, mErr := common.Marshal(sanitized)
	if mErr != nil {
		// 极端兜底：Marshal 不应失败，但若失败用静态字面量，仍不泄露上游。
		payload = []byte(`{"error":{"message":"codex image generation failed","type":"upstream_error"}}`)
	}

	resp.Body = io.NopCloser(bytes.NewReader(payload))
	resp.ContentLength = int64(len(payload))
	if resp.Header == nil {
		resp.Header = http.Header{}
	}
	resp.Header.Set("Content-Type", "application/json")
	resp.Header.Set("Content-Length", fmt.Sprintf("%d", len(payload)))
	// 避免下游按 SSE 处理脱敏后的普通 JSON 错误体。
	resp.Header.Del("Transfer-Encoding")
}

func (a *Adaptor) DoResponse(c *gin.Context, resp *http.Response, info *relaycommon.RelayInfo) (usage any, err *types.NewAPIError) {
	switch info.RelayMode {
	case relayconstant.RelayModeResponsesCompact:
		return openai.OaiResponsesCompactionHandler(c, resp)
	case relayconstant.RelayModeResponses:
		if info.IsStream {
			return openai.OaiResponsesStreamHandler(c, info, resp)
		}
		return openai.OaiResponsesHandler(c, info, resp)
	case relayconstant.RelayModeChatCompletions:
		return RelayChatOverCodex(c, info, resp)
	case relayconstant.RelayModeImagesGenerations, relayconstant.RelayModeImagesEdits:
		return RelayImageOverCodex(c, info, resp)
	default:
		return nil, types.NewError(errors.New("codex channel: endpoint not supported"), types.ErrorCodeInvalidRequest)
	}
}

func (a *Adaptor) GetModelList() []string {
	return ModelList
}

func (a *Adaptor) GetChannelName() string {
	return ChannelName
}

func (a *Adaptor) GetRequestURL(info *relaycommon.RelayInfo) (string, error) {
	switch info.RelayMode {
	case relayconstant.RelayModeResponses:
		return relaycommon.GetFullRequestURL(info.ChannelBaseUrl, "/backend-api/codex/responses", info.ChannelType), nil
	case relayconstant.RelayModeResponsesCompact:
		return relaycommon.GetFullRequestURL(info.ChannelBaseUrl, "/backend-api/codex/responses/compact", info.ChannelType), nil
	case relayconstant.RelayModeChatCompletions:
		// chat completions 入口与 responses 共用同一上游端点（上游协议是 Responses）
		return relaycommon.GetFullRequestURL(info.ChannelBaseUrl, "/backend-api/codex/responses", info.ChannelType), nil
	case relayconstant.RelayModeImagesGenerations, relayconstant.RelayModeImagesEdits:
		return relaycommon.GetFullRequestURL(info.ChannelBaseUrl, "/backend-api/codex/responses", info.ChannelType), nil
	default:
		return "", errors.New("codex channel: only /v1/responses, /v1/responses/compact and /v1/chat/completions are supported")
	}
}

func (a *Adaptor) SetupRequestHeader(c *gin.Context, req *http.Header, info *relaycommon.RelayInfo) error {
	channel.SetupApiRequestHeader(info, c, req)

	key := strings.TrimSpace(info.ApiKey)
	if !strings.HasPrefix(key, "{") {
		return errors.New("codex channel: key must be a JSON object")
	}

	oauthKey, err := ParseOAuthKey(key)
	if err != nil {
		return err
	}

	accessToken := strings.TrimSpace(oauthKey.AccessToken)
	accountID := strings.TrimSpace(oauthKey.AccountID)

	if accessToken == "" {
		return errors.New("codex channel: access_token is required")
	}
	if accountID == "" {
		return errors.New("codex channel: account_id is required")
	}

	req.Set("Authorization", "Bearer "+accessToken)
	req.Set("chatgpt-account-id", accountID)

	if req.Get("OpenAI-Beta") == "" {
		req.Set("OpenAI-Beta", "responses=experimental")
	}
	if req.Get("originator") == "" {
		req.Set("originator", "codex_cli_rs")
	}

	// chatgpt.com/backend-api/codex/responses is strict about Content-Type.
	// Clients may omit it or include parameters like `application/json; charset=utf-8`,
	// which can be rejected by the upstream. Force the exact media type.
	req.Set("Content-Type", "application/json")
	if info.IsStream {
		req.Set("Accept", "text/event-stream")
	} else if req.Get("Accept") == "" {
		req.Set("Accept", "application/json")
	}

	return nil
}
