package vertex

import (
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"one-api/dto"
	"one-api/relay/channel"
	"one-api/relay/channel/claude"
	"one-api/relay/channel/gemini"
	"one-api/relay/channel/openai"
	relaycommon "one-api/relay/common"
	"one-api/relay/constant"
	"one-api/setting/model_setting"
	"one-api/types"
	"strings"

	"github.com/gin-gonic/gin"
)

const (
	RequestModeClaude = 1
	RequestModeGemini = 2
	RequestModeLlama  = 3
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
}

const anthropicVersion = "vertex-2023-10-16"

type Adaptor struct {
	RequestMode        int
	AccountCredentials Credentials
}

func (a *Adaptor) ConvertClaudeRequest(c *gin.Context, info *relaycommon.RelayInfo, request *dto.ClaudeRequest) (any, error) {
	if v, ok := claudeModelMap[info.UpstreamModelName]; ok {
		c.Set("request_model", v)
	} else {
		c.Set("request_model", request.Model)
	}
	vertexClaudeReq := copyRequest(request, anthropicVersion)
	return vertexClaudeReq, nil
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
	if strings.HasPrefix(info.UpstreamModelName, "claude") {
		a.RequestMode = RequestModeClaude
	} else if strings.HasPrefix(info.UpstreamModelName, "gemini") {
		a.RequestMode = RequestModeGemini
	} else if strings.Contains(info.UpstreamModelName, "llama") {
		a.RequestMode = RequestModeLlama
	}
}

func (a *Adaptor) GetRequestURL(info *relaycommon.RelayInfo) (string, error) {
	adc := &Credentials{}
	if err := json.Unmarshal([]byte(info.ApiKey), adc); err != nil {
		return "", fmt.Errorf("failed to decode credentials file: %w", err)
	}
	region := GetModelRegion(info.ApiVersion, info.OriginModelName)
	a.AccountCredentials = *adc
	suffix := ""
	if a.RequestMode == RequestModeGemini {
		if model_setting.GetGeminiSettings().ThinkingAdapterEnabled {
			// 新增逻辑：处理 -thinking-<budget> 格式
			if strings.Contains(info.UpstreamModelName, "-thinking-") {
				parts := strings.Split(info.UpstreamModelName, "-thinking-")
				info.UpstreamModelName = parts[0]
			} else if strings.HasSuffix(info.UpstreamModelName, "-thinking") { // 旧的适配
				info.UpstreamModelName = strings.TrimSuffix(info.UpstreamModelName, "-thinking")
			} else if strings.HasSuffix(info.UpstreamModelName, "-nothinking") {
				info.UpstreamModelName = strings.TrimSuffix(info.UpstreamModelName, "-nothinking")
			}
		}

		if info.IsStream {
			suffix = "streamGenerateContent?alt=sse"
		} else {
			suffix = "generateContent"
		}
		if region == "global" {
			return fmt.Sprintf(
				"https://aiplatform.googleapis.com/v1/projects/%s/locations/global/publishers/google/models/%s:%s",
				adc.ProjectID,
				info.UpstreamModelName,
				suffix,
			), nil
		} else {
			return fmt.Sprintf(
				"https://%s-aiplatform.googleapis.com/v1/projects/%s/locations/%s/publishers/google/models/%s:%s",
				region,
				adc.ProjectID,
				region,
				info.UpstreamModelName,
				suffix,
			), nil
		}
	} else if a.RequestMode == RequestModeClaude {
		if info.IsStream {
			suffix = "streamRawPredict?alt=sse"
		} else {
			suffix = "rawPredict"
		}
		model := info.UpstreamModelName
		if v, ok := claudeModelMap[info.UpstreamModelName]; ok {
			model = v
		}
		if region == "global" {
			return fmt.Sprintf(
				"https://aiplatform.googleapis.com/v1/projects/%s/locations/global/publishers/anthropic/models/%s:%s",
				adc.ProjectID,
				model,
				suffix,
			), nil
		} else {
			return fmt.Sprintf(
				"https://%s-aiplatform.googleapis.com/v1/projects/%s/locations/%s/publishers/anthropic/models/%s:%s",
				region,
				adc.ProjectID,
				region,
				model,
				suffix,
			), nil
		}
	} else if a.RequestMode == RequestModeLlama {
		return fmt.Sprintf(
			"https://%s-aiplatform.googleapis.com/v1beta1/projects/%s/locations/%s/endpoints/openapi/chat/completions",
			region,
			adc.ProjectID,
			region,
		), nil
	}
	return "", errors.New("unsupported request mode")
}

func (a *Adaptor) SetupRequestHeader(c *gin.Context, req *http.Header, info *relaycommon.RelayInfo) error {
	channel.SetupApiRequestHeader(info, c, req)
	accessToken, err := getAccessToken(a, info)
	if err != nil {
		return err
	}
	req.Set("Authorization", "Bearer "+accessToken)
	return nil
}

func (a *Adaptor) ConvertOpenAIRequest(c *gin.Context, info *relaycommon.RelayInfo, request *dto.GeneralOpenAIRequest) (any, error) {
	if request == nil {
		return nil, errors.New("request is nil")
	}
	if a.RequestMode == RequestModeClaude {
		claudeReq, err := claude.RequestOpenAI2ClaudeMessage(*request)
		if err != nil {
			return nil, err
		}
		vertexClaudeReq := copyRequest(claudeReq, anthropicVersion)
		c.Set("request_model", claudeReq.Model)
		info.UpstreamModelName = claudeReq.Model
		return vertexClaudeReq, nil
	} else if a.RequestMode == RequestModeGemini {
		geminiRequest, err := gemini.CovertGemini2OpenAI(*request, info)
		if err != nil {
			return nil, err
		}
		c.Set("request_model", request.Model)
		return geminiRequest, nil
	} else if a.RequestMode == RequestModeLlama {
		return request, nil
	}
	return nil, errors.New("unsupported request mode")
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
	if info.IsStream {
		switch a.RequestMode {
		case RequestModeClaude:
			err, usage = claude.ClaudeStreamHandler(c, resp, info, claude.RequestModeMessage)
		case RequestModeGemini:
			if info.RelayMode == constant.RelayModeGemini {
				usage, err = gemini.GeminiTextGenerationStreamHandler(c, info, resp)
			} else {
				usage, err = gemini.GeminiChatStreamHandler(c, info, resp)
			}
		case RequestModeLlama:
			usage, err = openai.OaiStreamHandler(c, info, resp)
		}
	} else {
		switch a.RequestMode {
		case RequestModeClaude:
			err, usage = claude.ClaudeHandler(c, resp, claude.RequestModeMessage, info)
		case RequestModeGemini:
			if info.RelayMode == constant.RelayModeGemini {
				usage, err = gemini.GeminiTextGenerationHandler(c, info, resp)
			} else {
				usage, err = gemini.GeminiChatHandler(c, info, resp)
			}
		case RequestModeLlama:
			usage, err = openai.OpenaiHandler(c, info, resp)
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
