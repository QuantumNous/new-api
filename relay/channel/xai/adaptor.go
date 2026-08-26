package xai

import (
	"errors"
	"io"
	"net/http"
	"strings"

	"github.com/QuantumNous/new-api/relay/channel"
	"github.com/QuantumNous/new-api/relay/channel/openai"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/QuantumNous/new-api/relaykit/types"

	"github.com/QuantumNous/new-api/relay/constant"

	"github.com/gin-gonic/gin"
	"github.com/samber/lo"
)

type Adaptor struct {
}

func (a *Adaptor) ConvertGeminiRequest(*gin.Context, *relaycommon.RelayInfo, *dto.GeminiChatRequest) (any, error) {
	return channel.ForeignTextRequest("xai.ConvertGeminiRequest")
}

func (a *Adaptor) ConvertClaudeRequest(*gin.Context, *relaycommon.RelayInfo, *dto.ClaudeRequest) (any, error) {
	return channel.ForeignTextRequest("xai.ConvertClaudeRequest")
}

func (a *Adaptor) ConvertAudioRequest(c *gin.Context, info *relaycommon.RelayInfo, request dto.AudioRequest) (io.Reader, error) {
	//not available
	return nil, errors.New("not available")
}

func (a *Adaptor) ConvertImageRequest(c *gin.Context, info *relaycommon.RelayInfo, request dto.ImageRequest) (any, error) {
	if info != nil && info.RelayMode == constant.RelayModeImagesEdits {
		if c == nil || c.Request == nil || !strings.HasPrefix(strings.ToLower(c.Request.Header.Get("Content-Type")), "application/json") {
			return nil, errors.New("xAI image edits require application/json")
		}
		if len(request.Image) == 0 && len(request.Images) == 0 {
			return nil, errors.New("xAI image edits require image or images")
		}
	}

	imageCount := int(lo.FromPtrOr(request.N, uint(1)))
	if imageCount > maxXAIImageCount {
		return nil, errors.New("xAI image requests support at most 10 images")
	}
	xaiRequest := ImageRequest{
		Model:          request.Model,
		Prompt:         request.Prompt,
		N:              imageCount,
		ResponseFormat: request.ResponseFormat,
		Quality:        request.Quality,
		AspectRatio:    request.Extra["aspect_ratio"],
		Resolution:     request.Extra["resolution"],
		Image:          request.Image,
		Images:         request.Images,
	}
	return xaiRequest, nil
}

func (a *Adaptor) Init(info *relaycommon.RelayInfo) {
}

func (a *Adaptor) GetRequestURL(info *relaycommon.RelayInfo) (string, error) {
	baseURL := strings.TrimRight(info.ChannelBaseUrl, "/")
	switch info.RelayMode {
	case constant.RelayModeImagesGenerations:
		return baseURL + xAIImageGenerationsPath, nil
	case constant.RelayModeImagesEdits:
		return baseURL + xAIImageEditsPath, nil
	}
	if path, ok := info.OpenAICompatibleRequestPath(); ok {
		return relaycommon.GetFullRequestURL(info.ChannelBaseUrl, path, info.ChannelType), nil
	}
	return relaycommon.GetFullRequestURL(info.ChannelBaseUrl, info.RequestURLPath, info.ChannelType), nil
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

	modelName := request.Model
	if info != nil && info.UpstreamModelName != "" {
		modelName = info.UpstreamModelName
	}

	// Gemini→Chat can surface Gemini-only sampling fields. xAI's Chat API
	// rejects top_k, and reasoning_effort is currently supported only by the
	// grok-3-mini family; keep provider-specific cleanup in the xAI adaptor.
	request.TopK = nil
	request.EnableThinking = nil
	request.ThinkingBudget = nil
	request.Think = nil
	request.THINKING = nil
	if !strings.HasPrefix(modelName, "grok-3-mini") {
		request.ReasoningEffort = ""
		request.Reasoning = nil
	}

	if strings.HasSuffix(modelName, "-search") {
		modelName = strings.TrimSuffix(modelName, "-search")
		request.Model = modelName
		if info != nil {
			info.UpstreamModelName = modelName
		}
		toMap := request.ToMap()
		toMap["search_parameters"] = map[string]any{
			"mode": "on",
		}
		return toMap, nil
	}
	if strings.HasPrefix(request.Model, "grok-3-mini") {
		if lo.FromPtrOr(request.MaxCompletionTokens, uint(0)) == 0 && lo.FromPtrOr(request.MaxTokens, uint(0)) != 0 {
			request.MaxCompletionTokens = request.MaxTokens
			request.MaxTokens = nil
		}
		if strings.HasSuffix(request.Model, "-high") {
			request.ReasoningEffort = "high"
			request.Model = strings.TrimSuffix(request.Model, "-high")
		} else if strings.HasSuffix(request.Model, "-low") {
			request.ReasoningEffort = "low"
			request.Model = strings.TrimSuffix(request.Model, "-low")
		}
		if info != nil {
			info.SetReasoningEffort(request.ReasoningEffort)
			info.UpstreamModelName = request.Model
		}
	}
	return request, nil
}

func (a *Adaptor) ConvertRerankRequest(c *gin.Context, relayMode int, request dto.RerankRequest) (any, error) {
	return nil, nil
}

func (a *Adaptor) ConvertEmbeddingRequest(c *gin.Context, info *relaycommon.RelayInfo, request dto.EmbeddingRequest) (any, error) {
	//not available
	return nil, errors.New("not available")
}

func (a *Adaptor) ConvertOpenAIResponsesRequest(c *gin.Context, info *relaycommon.RelayInfo, request dto.OpenAIResponsesRequest) (any, error) {
	if request.Model == "" && info != nil {
		request.Model = info.UpstreamModelName
	}
	return request, nil
}

func (a *Adaptor) DoRequest(c *gin.Context, info *relaycommon.RelayInfo, requestBody io.Reader) (any, error) {
	return channel.DoApiRequest(a, c, info, requestBody)
}

func (a *Adaptor) DoResponse(c *gin.Context, resp *http.Response, info *relaycommon.RelayInfo) (usage any, err *types.NewAPIError) {
	switch info.RelayMode {
	case constant.RelayModeImagesGenerations, constant.RelayModeImagesEdits:
		return openai.OpenaiImageHandler(c, info, resp)
	}
	if info.TextPlanApplies() && info.TextNative() == types.RelayFormatOpenAIResponses {
		return openai.DoPlannedTextResponse(c, info, resp)
	}
	switch info.RelayMode {
	case constant.RelayModeResponses:
		if info.IsStream {
			usage, err = openai.OaiResponsesStreamHandler(c, info, resp)
		} else {
			usage, err = openai.OaiResponsesHandler(c, info, resp)
		}
	default:
		if info.IsStream {
			usage, err = xAIStreamHandler(c, info, resp)
		} else {
			usage, err = xAIHandler(c, info, resp)
		}
	}
	return
}

func (a *Adaptor) GetModelList() []string {
	return ModelList
}

func (a *Adaptor) GetChannelName() string {
	return ChannelName
}
