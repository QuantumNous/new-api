package claude

import (
	"errors"
	"fmt"
	"io"
	"net/http"
	"strings"

	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/relay/channel"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/setting/model_setting"
	"github.com/QuantumNous/new-api/types"

	"github.com/gin-gonic/gin"
)

type Adaptor struct {
}

func (a *Adaptor) ConvertGeminiRequest(*gin.Context, *relaycommon.RelayInfo, *dto.GeminiChatRequest) (any, error) {
	//TODO implement me
	return nil, errors.New("not implemented")
}

func (a *Adaptor) ConvertClaudeRequest(c *gin.Context, info *relaycommon.RelayInfo, request *dto.ClaudeRequest) (any, error) {
	return request, nil
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
	baseURL := fmt.Sprintf("%s/v1/messages", info.ChannelBaseUrl)
	if info.IsClaudeBetaQuery {
		baseURL = baseURL + "?beta=true"
	}
	return baseURL, nil
}

func CommonClaudeHeadersOperation(c *gin.Context, req *http.Header, info *relaycommon.RelayInfo) {
	// 1) 写入模型默认头（可能包含默认 anthropic-beta 等）
	model_setting.GetClaudeSettings().WriteHeaders(info.OriginModelName, req)

	// 2) 合并并透传来访 anthropic-beta（保持去重与顺序）
	incomingBeta := GetAnthropicBetaFromHeaders(c.Request.Header)
	if incomingBeta != "" {
		merged := MergeAnthropicBeta(req.Get("Anthropic-Beta"), incomingBeta)
		if merged != "" {
			req.Set("anthropic-beta", merged)
		}
	}
}

func (a *Adaptor) SetupRequestHeader(c *gin.Context, req *http.Header, info *relaycommon.RelayInfo) error {
	channel.SetupApiRequestHeader(info, c, req)
	req.Set("x-api-key", info.ApiKey)
	anthropicVersion := c.Request.Header.Get("anthropic-version")
	if anthropicVersion == "" {
		anthropicVersion = "2023-06-01"
	}
	req.Set("anthropic-version", anthropicVersion)
	CommonClaudeHeadersOperation(c, req, info)

	// 白名单请求头透传（可选）
	if info.ChannelOtherSettings.PassThroughClaudeHeaders {
		// 默认白名单
		allowed := map[string]bool{
			"anthropic-beta":               true,
			"x-stainless-lang":             true,
			"x-stainless-os":               true,
			"x-stainless-package-version":  true,
			"x-stainless-runtime":          true,
			"x-stainless-runtime-version":  true,
		}
		if info.ChannelOtherSettings.PassThroughClaudeUA {
			allowed["user-agent"] = true
		}
		// 附加白名单（小写）
		for _, h := range info.ChannelOtherSettings.ClaudeAllowedHeaders {
			allowed[strings.ToLower(h)] = true
		}
		// 拷贝白名单内的请求头（来访 -> 上游），不覆盖已设置的关键认证头
		for name, values := range c.Request.Header {
			ln := strings.ToLower(name)
			if !allowed[ln] {
				continue
			}
			// 跳过必须由网关控制的认证/版本头
			if ln == "x-api-key" || ln == "authorization" || ln == "anthropic-version" {
				continue
			}
			canon := http.CanonicalHeaderKey(name)
			req.Del(canon)
			for _, v := range values {
				req.Add(canon, v)
			}
		}
	}
	return nil
}

func (a *Adaptor) ConvertOpenAIRequest(c *gin.Context, info *relaycommon.RelayInfo, request *dto.GeneralOpenAIRequest) (any, error) {
	if request == nil {
		return nil, errors.New("request is nil")
	}
	return RequestOpenAI2ClaudeMessage(c, *request)
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
	info.FinalRequestRelayFormat = types.RelayFormatClaude
	if info.IsStream {
		return ClaudeStreamHandler(c, resp, info)
	} else {
		return ClaudeHandler(c, resp, info)
	}
}

func (a *Adaptor) GetModelList() []string {
	return ModelList
}

func (a *Adaptor) GetChannelName() string {
	return ChannelName
}
