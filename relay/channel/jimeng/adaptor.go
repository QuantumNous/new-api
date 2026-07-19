package jimeng

import (
	"errors"
	"fmt"
	"io"
	"net/http"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/relay/channel"
	"github.com/QuantumNous/new-api/relay/channel/openai"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	relayconstant "github.com/QuantumNous/new-api/relay/constant"
	"github.com/QuantumNous/new-api/types"

	"github.com/gin-gonic/gin"
)

type Adaptor struct {
}

const (
	minJimengImageDimension = 256
	maxJimengImageDimension = 768
)

func (a *Adaptor) ConvertGeminiRequest(*gin.Context, *relaycommon.RelayInfo, *dto.GeminiChatRequest) (any, error) {
	//TODO implement me
	return nil, errors.New("not implemented")
}

func (a *Adaptor) ConvertClaudeRequest(*gin.Context, *relaycommon.RelayInfo, *dto.ClaudeRequest) (any, error) {
	return nil, errors.New("not implemented")
}

func (a *Adaptor) Init(info *relaycommon.RelayInfo) {
}

func (a *Adaptor) GetRequestURL(info *relaycommon.RelayInfo) (string, error) {
	return fmt.Sprintf("%s/?Action=CVProcess&Version=2022-08-31", info.ChannelBaseUrl), nil
}

func (a *Adaptor) SetupRequestHeader(c *gin.Context, header *http.Header, info *relaycommon.RelayInfo) error {
	return errors.New("not implemented")
}

func (a *Adaptor) ConvertOpenAIRequest(c *gin.Context, info *relaycommon.RelayInfo, request *dto.GeneralOpenAIRequest) (any, error) {
	if request == nil {
		return nil, errors.New("request is nil")
	}
	return request, nil
}

type LogoInfo struct {
	AddLogo         *bool    `json:"add_logo,omitempty"`
	Position        *int     `json:"position,omitempty"`
	Language        *int     `json:"language,omitempty"`
	Opacity         *float64 `json:"opacity,omitempty"`
	LogoTextContent *string  `json:"logo_text_content,omitempty"`
}

type imageRequestPayload struct {
	ReqKey     string    `json:"req_key"`                      // Service identifier, fixed value: jimeng_high_aes_general_v21_L
	Prompt     string    `json:"prompt"`                       // Prompt for image generation, supports both Chinese and English
	Seed       *int64    `json:"seed,omitempty"`               // Random seed, default -1 (random)
	Width      int       `json:"width,omitempty"`              // Image width, default 512, range [256, 768]
	Height     int       `json:"height,omitempty"`             // Image height, default 512, range [256, 768]
	UsePreLLM  *bool     `json:"use_pre_llm,omitempty"`        // Enable text expansion, default true
	UseSR      *bool     `json:"use_sr,omitempty"`             // Enable super resolution, default true
	ReturnURL  *bool     `json:"return_url,omitempty"`         // Whether to return image URL (valid for 24 hours)
	LogoInfo   *LogoInfo `json:"logo_info,omitempty"`          // Watermark information
	ImageUrls  []string  `json:"image_urls,omitempty"`         // Image URLs for input
	BinaryData []string  `json:"binary_data_base64,omitempty"` // Base64 encoded binary data
}

type imageRequestExtraFields struct {
	Seed      *int64    `json:"seed"`
	Width     *int      `json:"width"`
	Height    *int      `json:"height"`
	UsePreLLM *bool     `json:"use_pre_llm"`
	UseSR     *bool     `json:"use_sr"`
	ReturnURL *bool     `json:"return_url"`
	LogoInfo  *LogoInfo `json:"logo_info"`
}

func (a *Adaptor) ConvertImageRequest(c *gin.Context, info *relaycommon.RelayInfo, request dto.ImageRequest) (any, error) {
	if request.N != nil && *request.N > 1 {
		return nil, errors.New("jimeng image generation supports only n=1")
	}
	imageURLs, err := request.ImageInputURLs()
	if err != nil {
		return nil, fmt.Errorf("invalid unified image input: %w", err)
	}
	payload := imageRequestPayload{
		ReqKey:    request.Model,
		Prompt:    request.Prompt,
		ImageUrls: imageURLs,
	}
	if request.ResponseFormat == "" || request.ResponseFormat == "url" {
		returnURL := true
		payload.ReturnURL = &returnURL // Default to returning image URLs
	}

	if len(request.ExtraFields) > 0 {
		var extraFields imageRequestExtraFields
		if err := common.Unmarshal(request.ExtraFields, &extraFields); err != nil {
			return nil, fmt.Errorf("failed to unmarshal extra fields: %w", err)
		}
		if extraFields.Seed != nil {
			payload.Seed = extraFields.Seed
		}
		if extraFields.Width != nil {
			if *extraFields.Width < minJimengImageDimension || *extraFields.Width > maxJimengImageDimension {
				return nil, fmt.Errorf("width must be between %d and %d", minJimengImageDimension, maxJimengImageDimension)
			}
			payload.Width = *extraFields.Width
		}
		if extraFields.Height != nil {
			if *extraFields.Height < minJimengImageDimension || *extraFields.Height > maxJimengImageDimension {
				return nil, fmt.Errorf("height must be between %d and %d", minJimengImageDimension, maxJimengImageDimension)
			}
			payload.Height = *extraFields.Height
		}
		if extraFields.UsePreLLM != nil {
			payload.UsePreLLM = extraFields.UsePreLLM
		}
		if extraFields.UseSR != nil {
			payload.UseSR = extraFields.UseSR
		}
		if extraFields.ReturnURL != nil {
			payload.ReturnURL = extraFields.ReturnURL
		}
		if extraFields.LogoInfo != nil {
			payload.LogoInfo = extraFields.LogoInfo
		}
	}

	// Model routing, billing identity, prompt, and normalized image inputs are
	// authoritative gateway fields. Provider extensions may only tune the
	// allowlisted generation options above.
	payload.ReqKey = request.Model
	payload.Prompt = request.Prompt
	payload.ImageUrls = append([]string(nil), imageURLs...)
	payload.BinaryData = nil

	return payload, nil
}

func (a *Adaptor) ConvertRerankRequest(c *gin.Context, relayMode int, request dto.RerankRequest) (any, error) {
	return nil, errors.New("not implemented")
}

func (a *Adaptor) ConvertEmbeddingRequest(c *gin.Context, info *relaycommon.RelayInfo, request dto.EmbeddingRequest) (any, error) {
	return nil, errors.New("not implemented")
}

func (a *Adaptor) ConvertAudioRequest(c *gin.Context, info *relaycommon.RelayInfo, request dto.AudioRequest) (io.Reader, error) {
	return nil, errors.New("not implemented")
}

func (a *Adaptor) ConvertOpenAIResponsesRequest(c *gin.Context, info *relaycommon.RelayInfo, request dto.OpenAIResponsesRequest) (any, error) {
	return nil, errors.New("not implemented")
}

func (a *Adaptor) DoRequest(c *gin.Context, info *relaycommon.RelayInfo, requestBody io.Reader) (any, error) {
	fullRequestURL, err := a.GetRequestURL(info)
	if err != nil {
		return nil, fmt.Errorf("get request url failed: %w", err)
	}
	req, err := http.NewRequest(c.Request.Method, fullRequestURL, requestBody)
	if err != nil {
		return nil, fmt.Errorf("new request failed: %w", err)
	}
	err = Sign(c, req, info.ApiKey)
	if err != nil {
		return nil, fmt.Errorf("setup request header failed: %w", err)
	}
	headerOverride, err := channel.ResolveHeaderOverride(info, c)
	if err != nil {
		return nil, err
	}
	channel.ApplyHeaderOverrideToRequest(req, headerOverride)
	resp, err := channel.DoRequest(c, req, info)
	if err != nil {
		return nil, fmt.Errorf("do request failed: %w", err)
	}
	return resp, nil
}

func (a *Adaptor) DoResponse(c *gin.Context, resp *http.Response, info *relaycommon.RelayInfo) (usage any, err *types.NewAPIError) {
	if info.RelayMode == relayconstant.RelayModeImagesGenerations || info.RelayMode == relayconstant.RelayModeImagesEdits {
		usage, err = jimengImageHandler(c, resp, info)
	} else if info.IsStream {
		usage, err = openai.OaiStreamHandler(c, info, resp)
	} else {
		usage, err = openai.OpenaiHandler(c, info, resp)
	}
	return
}

func (a *Adaptor) GetModelList() []string {
	return ModelList
}

func (a *Adaptor) GetChannelName() string {
	return ChannelName
}
