package novelai

import (
	"archive/zip"
	"bytes"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"math/rand/v2"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/relay/channel"
	"github.com/QuantumNous/new-api/relay/channel/openai"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	relayconstant "github.com/QuantumNous/new-api/relay/constant"
	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/QuantumNous/new-api/relaykit/types"
	"github.com/QuantumNous/new-api/service"
	"github.com/gin-gonic/gin"
)

// Adaptor relays NovelAI image generation via the official JSON endpoint.
type Adaptor struct{}

type ImageRequest struct {
	Input      string                     `json:"input"`
	Model      string                     `json:"model"`
	Action     string                     `json:"action"`
	Parameters map[string]json.RawMessage `json:"parameters"`
}

func (*Adaptor) Init(*relaycommon.RelayInfo) {}

func (*Adaptor) GetChannelName() string { return "NovelAI" }

func (*Adaptor) GetModelList() []string {
	return []string{
		"nai-diffusion-5-full",
		"nai-diffusion-5-full-medium",
		"nai-diffusion-5-curated",
		"nai-diffusion-4-5-full",
		"nai-diffusion-4-5-curated",
		"nai-diffusion-4-full",
		"nai-diffusion-4-curated-preview",
		"nai-diffusion-3",
		"nai-diffusion-furry-3",
	}
}

func (*Adaptor) GetRequestURL(info *relaycommon.RelayInfo) (string, error) {
	if info.RelayMode != relayconstant.RelayModeImagesGenerations {
		return "", errors.New("NovelAI only supports image generation")
	}
	base := strings.TrimRight(info.ChannelBaseUrl, "/")
	if base == "" {
		base = "https://image.novelai.net"
	}
	return base + "/ai/generate-image", nil
}

func (*Adaptor) SetupRequestHeader(c *gin.Context, header *http.Header, info *relaycommon.RelayInfo) error {
	channel.SetupApiRequestHeader(info, c, header)
	header.Set("Content-Type", "application/json")
	header.Set("Accept", "application/json")
	header.Set("Authorization", "Bearer "+info.ApiKey)
	return nil
}

func (*Adaptor) ConvertImageRequest(c *gin.Context, info *relaycommon.RelayInfo, request dto.ImageRequest) (any, error) {
	if info.RelayMode != relayconstant.RelayModeImagesGenerations {
		return nil, invalidRequest(errors.New("NovelAI only supports image generation"))
	}
	_, native := request.Extra["input"]
	if native || c != nil && c.Request.URL.Path == "/ai/generate-image" {
		payload := ImageRequest{Model: request.Model}
		for field, target := range map[string]any{
			"input": &payload.Input, "action": &payload.Action, "parameters": &payload.Parameters,
		} {
			if err := common.Unmarshal(request.Extra[field], target); err != nil {
				return nil, invalidRequest(fmt.Errorf("invalid NovelAI %s", field))
			}
		}
		if request.Prompt != "" && request.Prompt != payload.Input {
			return nil, invalidRequest(errors.New("NovelAI input and prompt must not conflict"))
		}
		for field := range request.Extra {
			if field != "input" && field != "action" && field != "parameters" {
				return nil, invalidRequest(fmt.Errorf("unsupported NovelAI request field: %s", field))
			}
		}
		body, err := common.Marshal(payload)
		if err != nil {
			return nil, err
		}
		if _, err := ValidateRequest(body); err != nil {
			return nil, invalidRequest(err)
		}
		return payload, nil
	}
	if raw, exists := request.Extra["action"]; exists {
		var action string
		if err := common.Unmarshal(raw, &action); err != nil || action != "generate" {
			return nil, invalidRequest(errors.New("NovelAI requires action generate"))
		}
	}
	if request.ResponseFormat != "" && request.ResponseFormat != "b64_json" {
		return nil, invalidRequest(errors.New("NovelAI supports response_format b64_json only"))
	}
	count, err := request.ImageCount(false)
	if err != nil {
		return nil, invalidRequest(err)
	}
	width, height := int64(832), int64(1216)
	if request.Size != "" && request.Size != "auto" {
		w, h, ok := strings.Cut(request.Size, "x")
		width, err = strconv.ParseInt(w, 10, 64)
		if !ok || err != nil {
			return nil, invalidRequest(errors.New("size must be WIDTHxHEIGHT"))
		}
		height, err = strconv.ParseInt(h, 10, 64)
		if err != nil {
			return nil, invalidRequest(errors.New("size must be WIDTHxHEIGHT"))
		}
	}
	scale, steps := 5.0, 23
	switch {
	case request.Model == "nai-diffusion-5-full-medium":
		scale, steps = 7, 14
	case strings.HasPrefix(request.Model, "nai-diffusion-5-"):
		scale = 7
	case strings.HasPrefix(request.Model, "nai-diffusion-4-") &&
		!strings.HasPrefix(request.Model, "nai-diffusion-4-5-"):
		scale = 5.5
	}
	defaults, err := common.Marshal(map[string]any{
		"width": width, "height": height, "steps": steps,
		"sampler": "k_euler_ancestral", "scale": scale,
		"seed": rand.Uint32(), "n_samples": count, "params_version": 4,
		"negative_prompt": "", "sm": false, "sm_dyn": false,
		"dynamic_thresholding": false,
	})
	if err != nil {
		return nil, err
	}
	var parameters map[string]json.RawMessage
	if err := common.Unmarshal(defaults, &parameters); err != nil {
		return nil, err
	}
	// extra_fields supports flat parameter overrides; native parameters
	// take precedence and retain explicit zero/false values.
	for _, raw := range []json.RawMessage{request.ExtraFields, request.Extra["parameters"]} {
		if len(raw) == 0 {
			continue
		}
		var overrides map[string]json.RawMessage
		if err := common.Unmarshal(raw, &overrides); err != nil || overrides == nil {
			return nil, invalidRequest(errors.New("NovelAI parameters must be a JSON object"))
		}
		for key, value := range overrides {
			parameters[key] = value
		}
	}
	if uc, exists := parameters["uc"]; exists {
		if _, explicit := parameters["negative_prompt"]; !explicit || string(parameters["negative_prompt"]) == `""` {
			parameters["negative_prompt"] = uc
		}
		delete(parameters, "uc")
	}
	if strings.HasPrefix(request.Model, "nai-diffusion-4") ||
		strings.HasPrefix(request.Model, "nai-diffusion-5") {
		for key, caption := range map[string]any{
			"v4_prompt":          request.Prompt,
			"v4_negative_prompt": parameters["negative_prompt"],
		} {
			if _, exists := parameters[key]; exists {
				continue
			}
			prompt, err := common.Marshal(map[string]any{
				"caption":    map[string]any{"base_caption": caption, "char_captions": []any{}},
				"use_coords": false, "use_order": true,
			})
			if err != nil {
				return nil, err
			}
			parameters[key] = prompt
		}
	}
	payload := ImageRequest{
		Input: request.Prompt, Model: request.Model,
		Action: "generate", Parameters: parameters,
	}
	body, err := common.Marshal(payload)
	if err != nil {
		return nil, err
	}
	if _, err := ValidateRequest(body); err != nil {
		return nil, invalidRequest(err)
	}
	return payload, nil
}

// ValidateRequest runs again after channel overrides/pass-through, before
// reservation. The effective n_samples, not the original OpenAI n, is billed.
func ValidateRequest(body []byte) (int, error) {
	var request struct {
		Input      string `json:"input"`
		Model      string `json:"model"`
		Action     string `json:"action"`
		Parameters struct {
			Count  *uint    `json:"n_samples"`
			Width  *int64   `json:"width"`
			Height *int64   `json:"height"`
			Steps  *float64 `json:"steps"`
			Seed   *int64   `json:"seed"`
		} `json:"parameters"`
	}
	if err := common.Unmarshal(body, &request); err != nil {
		return 0, fmt.Errorf("invalid NovelAI request: %w", err)
	}
	if strings.TrimSpace(request.Input) == "" || request.Model == "" || request.Action != "generate" {
		return 0, errors.New("NovelAI requires input, model and action generate")
	}
	p := request.Parameters
	if p.Count == nil || *p.Count < 1 || *p.Count > dto.MaxImageN {
		return 0, fmt.Errorf("parameters.n_samples must be an integer between 1 and %d", dto.MaxImageN)
	}
	for _, dimension := range []*int64{p.Width, p.Height} {
		if dimension == nil || *dimension < 64 || *dimension > 4096 || *dimension%64 != 0 {
			return 0, errors.New("NovelAI width and height must be multiples of 64 between 64 and 4096")
		}
	}
	if p.Steps == nil || *p.Steps < 1 || *p.Steps > 50 {
		return 0, errors.New("NovelAI steps must be between 1 and 50")
	}
	if p.Seed != nil && (*p.Seed < 0 || *p.Seed > 4294967295) {
		return 0, errors.New("NovelAI seed must be between 0 and 4294967295")
	}
	return int(*p.Count), nil
}

func (a *Adaptor) DoRequest(c *gin.Context, info *relaycommon.RelayInfo, body io.Reader) (any, error) {
	resp, err := channel.DoApiRequest(a, c, info, body)
	if err == nil && resp.StatusCode == http.StatusCreated {
		resp.StatusCode = http.StatusOK
	}
	return resp, err
}

func (*Adaptor) DoResponse(c *gin.Context, resp *http.Response, info *relaycommon.RelayInfo) (any, *types.NewAPIError) {
	if resp == nil || resp.Body == nil {
		return nil, types.NewError(errors.New("empty NovelAI response"), types.ErrorCodeBadResponse)
	}
	defer service.CloseResponseBodyGracefully(resp)
	var upstream struct {
		Images []map[string]json.RawMessage `json:"images"`
	}
	if err := common.DecodeJson(resp.Body, &upstream); err != nil {
		return nil, types.NewOpenAIError(err, types.ErrorCodeBadResponseBody, http.StatusBadGateway)
	}
	if len(upstream.Images) == 0 || len(upstream.Images) > dto.MaxImageN {
		return nil, types.NewOpenAIError(errors.New("NovelAI returned no images or an invalid image count"), types.ErrorCodeBadResponseBody, http.StatusBadGateway)
	}
	response := dto.ImageResponse{Created: time.Now().Unix()}
	images := make([]string, 0, len(upstream.Images))
	for _, entry := range upstream.Images {
		var image string
		if err := common.Unmarshal(entry["image"], &image); err != nil || strings.TrimSpace(image) == "" {
			return nil, types.NewOpenAIError(errors.New("NovelAI returned an empty image"), types.ErrorCodeBadResponseBody, http.StatusBadGateway)
		}
		images = append(images, image)
		response.Data = append(response.Data, dto.ImageData{B64Json: image})
	}
	if c.Request.URL.Path == "/ai/generate-image" {
		var body []byte
		contentType := "application/json"
		if strings.Contains(c.GetHeader("Accept"), "application/json") {
			var err error
			body, err = common.Marshal(upstream)
			if err != nil {
				return nil, types.NewError(err, types.ErrorCodeBadResponseBody)
			}
		} else {
			var buffer bytes.Buffer
			archive := zip.NewWriter(&buffer)
			for i, image := range images {
				data, err := base64.StdEncoding.DecodeString(image)
				if err != nil || len(data) == 0 {
					return nil, types.NewOpenAIError(errors.New("NovelAI returned invalid base64 image data"), types.ErrorCodeBadResponseBody, http.StatusBadGateway)
				}
				entry, err := archive.CreateHeader(&zip.FileHeader{Name: fmt.Sprintf("image_%d.png", i), Method: zip.Store})
				if err == nil {
					_, err = entry.Write(data)
				}
				if err != nil {
					return nil, types.NewError(err, types.ErrorCodeBadResponseBody)
				}
			}
			if err := archive.Close(); err != nil {
				return nil, types.NewError(err, types.ErrorCodeBadResponseBody)
			}
			body, contentType = buffer.Bytes(), "application/zip"
		}
		info.UpdateImageCount(int64(len(upstream.Images)))
		info.SetFirstResponseTime()
		c.Data(http.StatusCreated, contentType, body)
		return &dto.Usage{}, nil
	}
	body, err := common.Marshal(response)
	if err != nil {
		return nil, types.NewError(err, types.ErrorCodeBadResponseBody)
	}
	converted := &http.Response{
		StatusCode: http.StatusOK, Header: make(http.Header),
		Body: io.NopCloser(bytes.NewReader(body)), ContentLength: int64(len(body)),
	}
	converted.Header.Set("Content-Type", "application/json")
	if info.IsStream {
		return openai.OpenaiImageStreamHandler(c, info, converted)
	}
	return openai.OpenaiImageHandler(c, info, converted)
}

func invalidRequest(err error) *types.NewAPIError {
	return types.NewErrorWithStatusCode(err, types.ErrorCodeInvalidRequest, http.StatusBadRequest, types.ErrOptionWithSkipRetry())
}

func (*Adaptor) ConvertOpenAIRequest(*gin.Context, *relaycommon.RelayInfo, *dto.GeneralOpenAIRequest) (any, error) {
	return nil, invalidRequest(errors.New("NovelAI only supports image generation"))
}

func (*Adaptor) ConvertClaudeRequest(*gin.Context, *relaycommon.RelayInfo, *dto.ClaudeRequest) (any, error) {
	return nil, invalidRequest(errors.New("NovelAI only supports image generation"))
}

func (*Adaptor) ConvertGeminiRequest(*gin.Context, *relaycommon.RelayInfo, *dto.GeminiChatRequest) (any, error) {
	return nil, invalidRequest(errors.New("NovelAI only supports image generation"))
}

func (*Adaptor) ConvertRerankRequest(*gin.Context, int, dto.RerankRequest) (any, error) {
	return nil, invalidRequest(errors.New("NovelAI only supports image generation"))
}

func (*Adaptor) ConvertEmbeddingRequest(*gin.Context, *relaycommon.RelayInfo, dto.EmbeddingRequest) (any, error) {
	return nil, invalidRequest(errors.New("NovelAI only supports image generation"))
}

func (*Adaptor) ConvertAudioRequest(*gin.Context, *relaycommon.RelayInfo, dto.AudioRequest) (io.Reader, error) {
	return nil, invalidRequest(errors.New("NovelAI only supports image generation"))
}

func (*Adaptor) ConvertOpenAIResponsesRequest(*gin.Context, *relaycommon.RelayInfo, dto.OpenAIResponsesRequest) (any, error) {
	return nil, invalidRequest(errors.New("NovelAI only supports image generation"))
}
