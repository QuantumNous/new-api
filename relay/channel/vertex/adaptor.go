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
	"github.com/QuantumNous/new-api/relaykit/relayconvert"
	"github.com/QuantumNous/new-api/relaykit/types"
	"github.com/QuantumNous/new-api/setting/model_setting"

	"github.com/gin-gonic/gin"
	"github.com/samber/lo"
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
	AccountCredentials Credentials
}

func (a *Adaptor) ConvertGeminiRequest(c *gin.Context, info *relaycommon.RelayInfo, request *dto.GeminiChatRequest) (any, error) {
	return a.convertGeminiNative(c, info, request)
}

func removeFunctionResponseID(request *dto.GeminiChatRequest) {
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
				if part.FunctionResponse == nil {
					continue
				}
				if len(part.FunctionResponse.ID) > 0 {
					part.FunctionResponse.ID = nil
				}
			}
		}
	}

	if len(request.Requests) > 0 {
		for i := range request.Requests {
			removeFunctionResponseID(&request.Requests[i])
		}
	}
}

func (a *Adaptor) ConvertClaudeRequest(c *gin.Context, info *relaycommon.RelayInfo, request *dto.ClaudeRequest) (any, error) {
	return a.convertClaudeNative(c, info, request)
}

func (a *Adaptor) ConvertAudioRequest(c *gin.Context, info *relaycommon.RelayInfo, request dto.AudioRequest) (io.Reader, error) {
	//TODO implement me
	return nil, errors.New("not implemented")
}

func (a *Adaptor) ConvertImageRequest(c *gin.Context, info *relaycommon.RelayInfo, request dto.ImageRequest) (any, error) {
	geminiAdaptor := gemini.Adaptor{}
	return geminiAdaptor.ConvertImageRequest(c, info, request)
}

func (a *Adaptor) Init(*relaycommon.RelayInfo) {}

func (a *Adaptor) nativeFormat(info *relaycommon.RelayInfo) types.RelayFormat {
	if info == nil {
		return types.RelayFormatGemini
	}
	native := info.TextNative()
	if native == "" {
		native = relaycommon.NativeTextFormat(info, types.RelayFormatGemini)
	}
	return native
}

func (a *Adaptor) getRequestUrl(info *relaycommon.RelayInfo, native types.RelayFormat, modelName, suffix string) (string, error) {
	region := GetModelRegion(info.ApiVersion, info.OriginModelName)
	if info.ChannelOtherSettings.VertexKeyType != dto.VertexKeyTypeAPIKey {
		adc := &Credentials{}
		if err := common.Unmarshal([]byte(info.ApiKey), adc); err != nil {
			return "", fmt.Errorf("failed to decode credentials file: %w", err)
		}
		a.AccountCredentials = *adc

		switch native {
		case types.RelayFormatGemini:
			return BuildGoogleModelURL(info.ChannelBaseUrl, DefaultAPIVersion, adc.ProjectID, region, modelName, suffix), nil
		case types.RelayFormatClaude:
			return BuildAnthropicModelURL(info.ChannelBaseUrl, DefaultAPIVersion, adc.ProjectID, region, modelName, suffix), nil
		case types.RelayFormatOpenAI:
			return BuildOpenSourceChatCompletionsURL(info.ChannelBaseUrl, adc.ProjectID, region), nil
		}
	} else {
		var keyPrefix string
		if strings.HasSuffix(suffix, "?alt=sse") {
			keyPrefix = "&"
		} else {
			keyPrefix = "?"
		}
		switch native {
		case types.RelayFormatGemini:
			return fmt.Sprintf(
				"%s%skey=%s",
				BuildGoogleModelURL(info.ChannelBaseUrl, DefaultAPIVersion, "", region, modelName, suffix),
				keyPrefix,
				info.ApiKey,
			), nil
		case types.RelayFormatClaude:
			return fmt.Sprintf(
				"%s%skey=%s",
				BuildAnthropicModelURL(info.ChannelBaseUrl, DefaultAPIVersion, "", region, modelName, suffix),
				keyPrefix,
				info.ApiKey,
			), nil
		}
	}
	return "", errors.New("unsupported native text format")
}

func (a *Adaptor) GetRequestURL(info *relaycommon.RelayInfo) (string, error) {
	native := a.nativeFormat(info)
	switch native {
	case types.RelayFormatGemini:
		modelName := gemini.URLModelName(info)
		suffix := "generateContent"
		if info.IsStream && !gemini.IsImageAPIRelay(info) {
			suffix = "streamGenerateContent?alt=sse"
		}
		if relayconvert.IsImagenPredictModel(modelName) {
			suffix = "predict"
		}
		return a.getRequestUrl(info, native, modelName, suffix)
	case types.RelayFormatClaude:
		suffix := "rawPredict"
		if info.IsStream {
			suffix = "streamRawPredict?alt=sse"
		}
		model := info.UpstreamModelName
		if v, ok := claudeModelMap[info.UpstreamModelName]; ok {
			model = v
		}
		return a.getRequestUrl(info, native, model, suffix)
	case types.RelayFormatOpenAI:
		return a.getRequestUrl(info, native, "", "")
	}
	return "", errors.New("unsupported native text format")
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
	native := a.nativeFormat(info)
	if native == types.RelayFormatGemini && relayconvert.IsImagenPredictModel(info.UpstreamModelName) {
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
	if native == types.RelayFormatOpenAI {
		return request, nil
	}
	return channel.ForeignTextRequest("vertex.ConvertOpenAIRequest")
}

func (a *Adaptor) ConvertRerankRequest(c *gin.Context, relayMode int, request dto.RerankRequest) (any, error) {
	return nil, nil
}

func (a *Adaptor) ConvertEmbeddingRequest(c *gin.Context, info *relaycommon.RelayInfo, request dto.EmbeddingRequest) (any, error) {
	//TODO implement me
	return nil, errors.New("not implemented")
}

func (a *Adaptor) ConvertOpenAIResponsesRequest(*gin.Context, *relaycommon.RelayInfo, dto.OpenAIResponsesRequest) (any, error) {
	return channel.ForeignTextRequest("vertex.ConvertOpenAIResponsesRequest")
}

func (a *Adaptor) convertGeminiNative(c *gin.Context, info *relaycommon.RelayInfo, request *dto.GeminiChatRequest) (any, error) {
	if model_setting.GetGeminiSettings().RemoveFunctionResponseIdEnabled {
		removeFunctionResponseID(request)
	}
	geminiAdaptor := gemini.Adaptor{}
	return geminiAdaptor.ConvertGeminiRequest(c, info, request)
}

func (a *Adaptor) convertClaudeNative(c *gin.Context, info *relaycommon.RelayInfo, request *dto.ClaudeRequest) (any, error) {
	if v, ok := claudeModelMap[info.UpstreamModelName]; ok {
		c.Set("request_model", v)
	} else {
		c.Set("request_model", request.Model)
	}
	return copyRequest(request, anthropicVersion), nil
}

func (a *Adaptor) DoRequest(c *gin.Context, info *relaycommon.RelayInfo, requestBody io.Reader) (any, error) {
	return channel.DoApiRequest(a, c, info, requestBody)
}

func (a *Adaptor) DoResponse(c *gin.Context, resp *http.Response, info *relaycommon.RelayInfo) (usage any, err *types.NewAPIError) {
	native := a.nativeFormat(info)
	claudeAdaptor := claude.Adaptor{}
	if info.IsStream {
		switch native {
		case types.RelayFormatClaude:
			return claudeAdaptor.DoResponse(c, resp, info)
		case types.RelayFormatGemini:
			if info.RelayMode == constant.RelayModeGemini {
				return gemini.GeminiTextGenerationStreamHandler(c, info, resp)
			}
			return gemini.GeminiChatStreamHandler(c, info, resp)
		case types.RelayFormatOpenAI:
			return openai.OaiStreamHandler(c, info, resp)
		}
	} else {
		switch native {
		case types.RelayFormatClaude:
			return claudeAdaptor.DoResponse(c, resp, info)
		case types.RelayFormatGemini:
			if info.RelayMode == constant.RelayModeGemini {
				return gemini.GeminiTextGenerationHandler(c, info, resp)
			}
			if gemini.IsImageAPIRelay(info) {
				return gemini.HandleGeminiImageAPIResponse(c, info, resp)
			}
			return gemini.GeminiChatHandler(c, info, resp)
		case types.RelayFormatOpenAI:
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
