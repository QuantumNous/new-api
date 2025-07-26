package claude_code

import (
	"errors"
	"fmt"
	"io"
	"net/http"
	"one-api/dto"
	"one-api/relay/channel"
	"one-api/relay/channel/claude"
	relaycommon "one-api/relay/common"
	"one-api/types"
	"strings"

	"github.com/gin-gonic/gin"
)

const (
	RequestModeCompletion = 1
	RequestModeMessage    = 2
)

type Adaptor struct {
	RequestMode int
}

func (a *Adaptor) ConvertClaudeRequest(c *gin.Context, info *relaycommon.RelayInfo, request *dto.ClaudeRequest) (any, error) {
	return request, nil
}

func (a *Adaptor) ConvertAudioRequest(c *gin.Context, info *relaycommon.RelayInfo, request dto.AudioRequest) (io.Reader, error) {
	return nil, errors.New("not implemented")
}

func (a *Adaptor) ConvertImageRequest(c *gin.Context, info *relaycommon.RelayInfo, request dto.ImageRequest) (any, error) {
	return nil, errors.New("not implemented")
}

func (a *Adaptor) Init(info *relaycommon.RelayInfo) {
	if strings.HasPrefix(info.UpstreamModelName, "claude-2") || strings.HasPrefix(info.UpstreamModelName, "claude-instant") {
		a.RequestMode = RequestModeCompletion
	} else {
		a.RequestMode = RequestModeMessage
	}
}

func (a *Adaptor) GetRequestURL(info *relaycommon.RelayInfo) (string, error) {
	if a.RequestMode == RequestModeMessage {
		return fmt.Sprintf("%s/v1/messages", info.BaseUrl), nil
	} else {
		return fmt.Sprintf("%s/v1/complete", info.BaseUrl), nil
	}
}

func (a *Adaptor) SetupRequestHeader(c *gin.Context, req *http.Header, info *relaycommon.RelayInfo) error {
	channel.SetupApiRequestHeader(info, c, req)

	// Parse accesstoken|refreshtoken format and use only the access token
	accessToken := info.ApiKey
	if strings.Contains(info.ApiKey, "|") {
		parts := strings.Split(info.ApiKey, "|")
		if len(parts) >= 1 {
			accessToken = parts[0]
		}
	}

	// Claude Code specific headers - force override
	req.Set("Authorization", "Bearer "+accessToken)
	// 只有在没有设置的情况下才设置 anthropic-version
	if req.Get("anthropic-version") == "" {
		req.Set("anthropic-version", "2023-06-01")
	}
	req.Set("content-type", "application/json")

	// 只有在 user-agent 不包含 claude-cli 时才设置
	userAgent := req.Get("user-agent")
	if userAgent == "" || !strings.Contains(strings.ToLower(userAgent), "claude-cli") {
		req.Set("user-agent", "claude-cli/1.0.57 (external, cli)")
	}

	// 只有在 anthropic-beta 不包含 claude-code 时才设置
	anthropicBeta := req.Get("anthropic-beta")
	if anthropicBeta == "" || !strings.Contains(strings.ToLower(anthropicBeta), "claude-code") {
		req.Set("anthropic-beta", "claude-code-20250219,oauth-2025-04-20,interleaved-thinking-2025-05-14,fine-grained-tool-streaming-2025-05-14")
	}

	return nil
}

func (a *Adaptor) ConvertOpenAIRequest(c *gin.Context, info *relaycommon.RelayInfo, request *dto.GeneralOpenAIRequest) (any, error) {
	if request == nil {
		return nil, errors.New("request is nil")
	}

	if a.RequestMode == RequestModeCompletion {
		return claude.RequestOpenAI2ClaudeComplete(*request), nil
	} else {
		claudeRequest, err := claude.RequestOpenAI2ClaudeMessage(*request)
		if err != nil {
			return nil, err
		}
		claudeRequest.System = "You are Claude Code, Anthropic's official CLI for Claude."
		return claudeRequest, nil
	}
}

func (a *Adaptor) ConvertRerankRequest(c *gin.Context, relayMode int, request dto.RerankRequest) (any, error) {
	return nil, nil
}

func (a *Adaptor) ConvertEmbeddingRequest(c *gin.Context, info *relaycommon.RelayInfo, request dto.EmbeddingRequest) (any, error) {
	return nil, errors.New("not implemented")
}

func (a *Adaptor) ConvertOpenAIResponsesRequest(c *gin.Context, info *relaycommon.RelayInfo, request dto.OpenAIResponsesRequest) (any, error) {
	return nil, errors.New("not implemented")
}

func (a *Adaptor) DoRequest(c *gin.Context, info *relaycommon.RelayInfo, requestBody io.Reader) (any, error) {
	return channel.DoApiRequest(a, c, info, requestBody)
}

func (a *Adaptor) DoResponse(c *gin.Context, resp *http.Response, info *relaycommon.RelayInfo) (usage any, err *types.NewAPIError) {
	if info.IsStream {
		err, usage = claude.ClaudeStreamHandler(c, resp, info, a.RequestMode)
	} else {
		err, usage = claude.ClaudeHandler(c, resp, a.RequestMode, info)
	}
	return
}

func (a *Adaptor) GetModelList() []string {
	return ModelList
}

func (a *Adaptor) GetChannelName() string {
	return ChannelName
}
