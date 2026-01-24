package ali

import (
	"errors"
	"fmt"
	"io"
	"net/http"
	"strings"

	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/relay/channel"
	"github.com/QuantumNous/new-api/relay/channel/claude"
	"github.com/QuantumNous/new-api/relay/channel/openai"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/relay/constant"
	"github.com/QuantumNous/new-api/setting/model_setting"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/types"

	"github.com/gin-gonic/gin"
)

type Adaptor struct {
	IsSyncImageModel bool
}

/*
	var syncModels = []string{
		"z-image",
		"qwen-image",
		"wan2.6",
	}
*/
func supportsAliAnthropicMessages(modelName string) bool {
	// Only models with the "qwen" designation can use the Claude-compatible interface; others require conversion.
	return strings.Contains(strings.ToLower(modelName), "qwen")
}

var syncModels = []string{
	"z-image",
	"qwen-image",
	"wan2.6",
}

func isSyncImageModel(modelName string) bool {
	return model_setting.IsSyncImageModel(modelName)
}

func (a *Adaptor) ConvertGeminiRequest(*gin.Context, *relaycommon.RelayInfo, *dto.GeminiChatRequest) (any, error) {
	//TODO implement me
	return nil, errors.New("not implemented")
}

func (a *Adaptor) ConvertClaudeRequest(c *gin.Context, info *relaycommon.RelayInfo, req *dto.ClaudeRequest) (any, error) {
	if supportsAliAnthropicMessages(info.UpstreamModelName) {
		return req, nil
	}

	oaiReq, err := service.ClaudeToOpenAIRequest(*req, info)
	if err != nil {
		return nil, err
	}
	if info.SupportStreamOptions && info.IsStream {
		oaiReq.StreamOptions = &dto.StreamOptions{IncludeUsage: true}
	}
	return a.ConvertOpenAIRequest(c, info, oaiReq)
}

func (a *Adaptor) Init(info *relaycommon.RelayInfo) {
}

func (a *Adaptor) GetRequestURL(info *relaycommon.RelayInfo) (string, error) {
	var fullRequestURL string
	switch info.RelayFormat {
	case types.RelayFormatClaude:
		if supportsAliAnthropicMessages(info.UpstreamModelName) {
			fullRequestURL = fmt.Sprintf("%s/apps/anthropic/v1/messages", info.ChannelBaseUrl)
		} else {
			fullRequestURL = fmt.Sprintf("%s/compatible-mode/v1/chat/completions", info.ChannelBaseUrl)
		}
	default:
		switch info.RelayMode {
		case constant.RelayModeEmbeddings:
			fullRequestURL = fmt.Sprintf("%s/compatible-mode/v1/embeddings", info.ChannelBaseUrl)
		case constant.RelayModeRerank:
			fullRequestURL = fmt.Sprintf("%s/api/v1/services/rerank/text-rerank/text-rerank", info.ChannelBaseUrl)
		case constant.RelayModeImagesGenerations:
			if isSyncImageModel(info.OriginModelName) {
				fullRequestURL = fmt.Sprintf("%s/api/v1/services/aigc/multimodal-generation/generation", info.ChannelBaseUrl)
			} else {
				fullRequestURL = fmt.Sprintf("%s/api/v1/services/aigc/text2image/image-synthesis", info.ChannelBaseUrl)
			}
		case constant.RelayModeImagesEdits:
			if isOldWanModel(info.OriginModelName) {
				fullRequestURL = fmt.Sprintf("%s/api/v1/services/aigc/image2image/image-synthesis", info.ChannelBaseUrl)
			} else if isWanModel(info.OriginModelName) {
				fullRequestURL = fmt.Sprintf("%s/api/v1/services/aigc/image-generation/generation", info.ChannelBaseUrl)
			} else {
				fullRequestURL = fmt.Sprintf("%s/api/v1/services/aigc/multimodal-generation/generation", info.ChannelBaseUrl)
			}
		case constant.RelayModeCompletions:
			fullRequestURL = fmt.Sprintf("%s/compatible-mode/v1/completions", info.ChannelBaseUrl)
		default:
			fullRequestURL = fmt.Sprintf("%s/compatible-mode/v1/chat/completions", info.ChannelBaseUrl)
		}
	}

	return fullRequestURL, nil
}

func (a *Adaptor) SetupRequestHeader(c *gin.Context, req *http.Header, info *relaycommon.RelayInfo) error {
	channel.SetupApiRequestHeader(info, c, req)
	req.Set("Authorization", "Bearer "+info.ApiKey)
	if info.IsStream {
		req.Set("X-DashScope-SSE", "enable")
	}
	if c.GetString("plugin") != "" {
		req.Set("X-DashScope-Plugin", c.GetString("plugin"))
	}
	if info.RelayMode == constant.RelayModeImagesGenerations {
		if isSyncImageModel(info.OriginModelName) {

		} else {
			req.Set("X-DashScope-Async", "enable")
		}
	}
	if info.RelayMode == constant.RelayModeImagesEdits {
		if isWanModel(info.OriginModelName) {
			req.Set("X-DashScope-Async", "enable")
		}
		req.Set("Content-Type", "application/json")
	}
	return nil
}

func (a *Adaptor) ConvertOpenAIRequest(c *gin.Context, info *relaycommon.RelayInfo, request *dto.GeneralOpenAIRequest) (any, error) {
	if request == nil {
		return nil, errors.New("request is nil")
	}
	// docs: https://bailian.console.aliyun.com/?tab=api#/api/?type=model&url=2712216
	// fix: InternalError.Algo.InvalidParameter: The value of the enable_thinking parameter is restricted to True.
	//if strings.Contains(request.Model, "thinking") {
	//	request.EnableThinking = true
	//	request.Stream = true
	//	info.IsStream = true
	//}
	//// fix: ali parameter.enable_thinking must be set to false for non-streaming calls
	//if !info.IsStream {
	//	request.EnableThinking = false
	//}

	switch info.RelayMode {
	default:
		aliReq := requestOpenAI2Ali(*request)
		return aliReq, nil
	}
}

func (a *Adaptor) ConvertImageRequest(c *gin.Context, info *relaycommon.RelayInfo, request dto.ImageRequest) (any, error) {
	if info.RelayMode == constant.RelayModeImagesGenerations {
		if isSyncImageModel(info.OriginModelName) {
			a.IsSyncImageModel = true
		}
		aliRequest, err := oaiImage2AliImageRequest(info, request, a.IsSyncImageModel)
		if err != nil {
			return nil, fmt.Errorf("convert image request to async ali image request failed: %w", err)
		}
		return aliRequest, nil
	} else if info.RelayMode == constant.RelayModeImagesEdits {
		if isOldWanModel(info.OriginModelName) {
			return oaiFormEdit2WanxImageEdit(c, info, request)
		}
		if isSyncImageModel(info.OriginModelName) {
			if isWanModel(info.OriginModelName) {
				a.IsSyncImageModel = false
			} else {
				a.IsSyncImageModel = true
			}
		}
		// ali image edit https://bailian.console.aliyun.com/?tab=api#/api/?type=model&url=2976416
		// 如果用户使用表单，则需要解析表单数据
		if strings.Contains(c.Request.Header.Get("Content-Type"), "multipart/form-data") {
			aliRequest, err := oaiFormEdit2AliImageEdit(c, info, request)
			if err != nil {
				return nil, fmt.Errorf("convert image edit form request failed: %w", err)
			}
			return aliRequest, nil
		} else {
			aliRequest, err := oaiImage2AliImageRequest(info, request, a.IsSyncImageModel)
			if err != nil {
				return nil, fmt.Errorf("convert image request to async ali image request failed: %w", err)
			}
			return aliRequest, nil
		}
	}
	return nil, fmt.Errorf("unsupported image relay mode: %d", info.RelayMode)
}

func (a *Adaptor) ConvertRerankRequest(c *gin.Context, relayMode int, request dto.RerankRequest) (any, error) {
	return ConvertRerankRequest(request), nil
}

func (a *Adaptor) ConvertEmbeddingRequest(c *gin.Context, info *relaycommon.RelayInfo, request dto.EmbeddingRequest) (any, error) {
	return request, nil
}

func (a *Adaptor) ConvertAudioRequest(c *gin.Context, info *relaycommon.RelayInfo, request dto.AudioRequest) (io.Reader, error) {
	//TODO implement me
	return nil, errors.New("not implemented")
}

func (a *Adaptor) ConvertOpenAIResponsesRequest(c *gin.Context, info *relaycommon.RelayInfo, request dto.OpenAIResponsesRequest) (any, error) {
	//TODO implement me
	return nil, errors.New("not implemented")
}

func (a *Adaptor) DoRequest(c *gin.Context, info *relaycommon.RelayInfo, requestBody io.Reader) (any, error) {
	return channel.DoApiRequest(a, c, info, requestBody)
}

func (a *Adaptor) DoResponse(c *gin.Context, resp *http.Response, info *relaycommon.RelayInfo) (usage any, err *types.NewAPIError) {
	switch info.RelayFormat {
	case types.RelayFormatClaude:
		if supportsAliAnthropicMessages(info.UpstreamModelName) {
			if info.IsStream {
				return claude.ClaudeStreamHandler(c, resp, info, claude.RequestModeMessage)
			}

			return claude.ClaudeHandler(c, resp, info, claude.RequestModeMessage)
		}

		adaptor := openai.Adaptor{}
		return adaptor.DoResponse(c, resp, info)
	default:
		switch info.RelayMode {
		case constant.RelayModeImagesGenerations:
			err, usage = aliImageHandler(a, c, resp, info)
		case constant.RelayModeImagesEdits:
			err, usage = aliImageHandler(a, c, resp, info)
		case constant.RelayModeRerank:
			err, usage = RerankHandler(c, resp, info)
		default:
			adaptor := openai.Adaptor{}
			usage, err = adaptor.DoResponse(c, resp, info)
		}
		return usage, err
	}
}

func (a *Adaptor) GetModelList() []string {
	return ModelList
}

func (a *Adaptor) GetChannelName() string {
	return ChannelName
}
