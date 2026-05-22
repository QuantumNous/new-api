package codex

import (
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
	return nil, errors.New("codex channel: endpoint not supported")
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

	// Roundtrip dto.OpenAIResponsesRequest -> apicompat.ResponsesRequest, apply shared constraints, then roundtrip back.
	raw, err := common.Marshal(&request)
	if err != nil {
		return nil, err
	}
	compatReq := &apicompat.ResponsesRequest{}
	if err := common.Unmarshal(raw, compatReq); err != nil {
		return nil, err
	}

	applyCodexConstraints(compatReq, info)

	if isCompact {
		// compact 模式上游不接受 store/stream 字段
		compatReq.Store = nil
		compatReq.Stream = false
		// compact 路径返回 dto 类型，保持现有 handler 类型契约
		out, err := common.Marshal(compatReq)
		if err != nil {
			return nil, err
		}
		result := dto.OpenAIResponsesRequest{}
		if err := common.Unmarshal(out, &result); err != nil {
			return nil, err
		}
		return result, nil
	}

	// 非 compact：使用 ensureInstructionsField 确保 "instructions" 键存在（Codex 后端硬性要求）
	return ensureInstructionsField(compatReq)
}

func (a *Adaptor) DoRequest(c *gin.Context, info *relaycommon.RelayInfo, requestBody io.Reader) (any, error) {
	return channel.DoApiRequest(a, c, info, requestBody)
}

func (a *Adaptor) DoResponse(c *gin.Context, resp *http.Response, info *relaycommon.RelayInfo) (usage any, err *types.NewAPIError) {
	if info.RelayMode != relayconstant.RelayModeResponses && info.RelayMode != relayconstant.RelayModeResponsesCompact {
		return nil, types.NewError(errors.New("codex channel: endpoint not supported"), types.ErrorCodeInvalidRequest)
	}

	if info.RelayMode == relayconstant.RelayModeResponsesCompact {
		return openai.OaiResponsesCompactionHandler(c, resp)
	}

	if info.IsStream {
		return openai.OaiResponsesStreamHandler(c, info, resp)
	}
	return openai.OaiResponsesHandler(c, info, resp)
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
