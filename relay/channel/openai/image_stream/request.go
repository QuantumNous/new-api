package image_stream

// Builders that turn an OpenAI-shaped Images-API request into the
// /v1/responses payload our upstream channel speaks. The image_generation
// tool field is the bridge between the two surface shapes.

import (
	"bytes"
	"encoding/json"
	"errors"
	"fmt"
	"strconv"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/dto"
)

type imageGenerationTool struct {
	Type              string `json:"type"`
	Size              string `json:"size,omitempty"`
	Quality           string `json:"quality,omitempty"`
	OutputFormat      string `json:"output_format,omitempty"`
	OutputCompression any    `json:"output_compression,omitempty"`
	Background        string `json:"background,omitempty"`
	Moderation        string `json:"moderation,omitempty"`
}

type responsesRequest struct {
	Model  string                `json:"model"`
	Input  any                   `json:"input"`
	Tools  []imageGenerationTool `json:"tools"`
	Stream bool                  `json:"stream"`
}

const maxResponsesImageOutputs = 1

// imageRequestValidationError marks errors caused by the persisted client
// request itself. The async worker uses this marker to avoid retrying or
// cooling a healthy upstream channel for a deterministic 4xx failure.
type imageRequestValidationError struct {
	err error
}

func (e *imageRequestValidationError) Error() string {
	if e == nil || e.err == nil {
		return "invalid image request"
	}
	return e.err.Error()
}

func (e *imageRequestValidationError) Unwrap() error {
	if e == nil {
		return nil
	}
	return e.err
}

// rawStringField decodes fields whose upstream representation is required to
// be a JSON string. ImageRequest keeps a few provider-specific fields as raw
// JSON for compatibility, so validating the type here prevents values such as
// an object or array from being silently stringified into the Responses tool.
func rawStringField(raw json.RawMessage, field string) (string, error) {
	trimmed := bytes.TrimSpace(raw)
	if len(trimmed) == 0 || common.GetJsonType(trimmed) == "null" {
		return "", nil
	}
	if common.GetJsonType(trimmed) != "string" {
		return "", fmt.Errorf("%s must be a string", field)
	}
	var value string
	if err := common.Unmarshal(trimmed, &value); err != nil {
		return "", fmt.Errorf("%s must be a string: %w", field, err)
	}
	return value, nil
}

// gptImageSizeFromUnifiedOptions maps the gateway's model-neutral
// aspect_ratio/resolution controls to the size field accepted by the OpenAI
// Responses image_generation tool. GPT Image 2 accepts the 15 official
// resolution/aspect combinations plus automatic sizing at 1K.
func gptImageSizeFromUnifiedOptions(req *dto.ImageRequest, model string) (string, error) {
	if req == nil {
		return "", errors.New("image request is required")
	}
	capabilities := common.ImageModelCapabilitiesForModel(model)
	frozenRequirement, hasFrozenRequirement := req.ImageSelectionRequirement()
	if req.Size != "" {
		size := strings.TrimSpace(req.Size)
		if capabilities.Family == common.ImageModelFamilyGPTImage2 {
			if capabilities.SupportsSize(size) {
				return size, nil
			}
			return "", fmt.Errorf("size %q is not supported by model %s; use one of the 15 official sizes or auto", size, model)
		}
		if capabilities.Family == common.ImageModelFamilyGPTImage {
			if capabilities.SupportsSize(size) {
				return size, nil
			}
			return "", fmt.Errorf("size %q is not supported by model %s", size, model)
		}
		return size, nil
	}

	rawAspect, hasAspect := req.Extra["aspect_ratio"]
	rawResolution, hasResolution := req.Extra["resolution"]
	if hasFrozenRequirement {
		if !hasAspect && frozenRequirement.AspectRatio != "" {
			rawAspect, hasAspect = json.RawMessage(nil), true
			encoded, err := common.Marshal(frozenRequirement.AspectRatio)
			if err != nil {
				return "", fmt.Errorf("encode frozen aspect_ratio: %w", err)
			}
			rawAspect = encoded
		}
		if !hasResolution && frozenRequirement.Resolution != "" {
			rawResolution, hasResolution = json.RawMessage(nil), true
			encoded, err := common.Marshal(frozenRequirement.Resolution)
			if err != nil {
				return "", fmt.Errorf("encode frozen resolution: %w", err)
			}
			rawResolution = encoded
		}
		if !hasAspect && !hasResolution && frozenRequirement.Size != "" {
			return frozenRequirement.Size, nil
		}
	}
	if !hasAspect && !hasResolution {
		return "", nil
	}

	aspectRatio := "1:1"
	if hasAspect {
		value, err := rawStringField(rawAspect, "aspect_ratio")
		if err != nil {
			return "", err
		}
		if value != "" {
			aspectRatio = strings.ToLower(strings.TrimSpace(value))
		}
	}
	resolution := "1K"
	if hasResolution {
		value, err := rawStringField(rawResolution, "resolution")
		if err != nil {
			return "", err
		}
		if value != "" {
			resolution = strings.ToUpper(strings.TrimSpace(value))
		}
	}
	if resolution != "1K" && resolution != "2K" && resolution != "4K" {
		return "", fmt.Errorf("unsupported resolution %q", resolution)
	}

	if capabilities.Family != common.ImageModelFamilyGPTImage2 {
		if resolution != "1K" {
			return "", fmt.Errorf("resolution %s is not supported by model %s", resolution, model)
		}
		if size, ok := common.ImageModelCapabilitiesForModel("gpt-image-1").SizeFor(resolution, aspectRatio); ok {
			return size, nil
		}
		return "", fmt.Errorf("aspect_ratio %s is not supported by model %s", aspectRatio, model)
	}
	size, ok := capabilities.SizeFor(resolution, aspectRatio)
	if ok {
		return size, nil
	}
	if aspectRatio == "auto" {
		return "", fmt.Errorf("aspect_ratio %q is only supported with resolution 1K by model %s", aspectRatio, model)
	}
	return "", fmt.Errorf("aspect_ratio %q is not supported by model %s; use one of 1:1, 16:9, 9:16, 3:4, or 4:3", aspectRatio, model)
}

// NormalizeUnifiedGPTImageDimensions converts the public aspect_ratio and
// resolution controls into the size field understood by both OpenAI image
// executors. It also removes the gateway-only aliases before provider relay.
func NormalizeUnifiedGPTImageDimensions(req *dto.ImageRequest, model string) error {
	if req == nil {
		return errors.New("image request is required")
	}
	size, err := gptImageSizeFromUnifiedOptions(req, model)
	if err != nil {
		return err
	}
	if size != "" {
		req.Size = size
	}
	delete(req.Extra, "aspect_ratio")
	delete(req.Extra, "resolution")
	return nil
}

// buildEditsRequest converts /v1/images/edits multipart input into a
// /v1/responses payload. The user message is an array of content parts:
//
//	{ "type": "input_text",  "text": <prompt> }
//
// followed by one or more
//
//	{ "type": "input_image", "image_url": <data:URI> }
//
// parts — one per normalized image source (file, URL, or pre-formed data:URI).
func buildEditsRequest(prompt string, images []NormalizedImage, model, modelOverride, size, quality, outputFormat, background, moderation string, outputCompression any) responsesRequest {
	tool := imageGenerationTool{Type: "image_generation"}
	if size != "" {
		tool.Size = size
	}
	if quality != "" {
		tool.Quality = quality
	}
	if outputFormat != "" {
		tool.OutputFormat = outputFormat
	}
	if outputCompression != nil {
		tool.OutputCompression = outputCompression
	}
	if background != "" {
		tool.Background = background
	}
	if moderation != "" {
		tool.Moderation = moderation
	} else {
		tool.Moderation = "low"
	}

	content := []map[string]any{
		{"type": "input_text", "text": prompt},
	}
	for _, img := range images {
		content = append(content, map[string]any{
			"type":      "input_image",
			"image_url": img.DataURI,
		})
	}

	if modelOverride != "" {
		model = modelOverride
	}

	return responsesRequest{
		Model: model,
		Input: []map[string]any{
			{"role": "user", "content": content},
		},
		Tools:  []imageGenerationTool{tool},
		Stream: true,
	}
}

// buildGenerationsRequest is the compatibility wrapper retained for callers
// that only need a best-effort request value. New call sites should use
// buildGenerationsRequestWithError so malformed image inputs cannot be sent
// upstream silently.
func buildGenerationsRequest(req *dto.ImageRequest, modelOverride string) responsesRequest {
	built, err := buildGenerationsRequestWithError(req, modelOverride)
	if err != nil {
		return responsesRequest{}
	}
	return built
}

// ValidateAsyncOpenAIImageRequest validates the model-specific fields that are
// translated into the Responses image_generation tool. It is intentionally
// exported so the relay can run this dry-run before reference images are
// copied into object storage.
func ValidateAsyncOpenAIImageRequest(req *dto.ImageRequest, model string) error {
	return validateAsyncOpenAIImageRequest(req, model, true)
}

// validateAsyncOpenAIImageRequest validates the fields shared by the OpenAI
// Responses executor and the compatibility adaptor. The output-count limit is
// executor-specific: the Responses image_generation tool currently accepts
// one image, while an adaptor may legitimately support a larger batch.
func validateAsyncOpenAIImageRequest(req *dto.ImageRequest, model string, enforceOutputCount bool) error {
	if req == nil {
		return errors.New("image request is required")
	}
	capabilities := common.ImageModelCapabilitiesForModel(model)
	if enforceOutputCount && req.N != nil {
		maxOutputs := capabilities.MaxOutputImages
		if capabilities.Family == common.ImageModelFamilyGPTImage || capabilities.Family == common.ImageModelFamilyGPTImage2 {
			maxOutputs = maxResponsesImageOutputs
		}
		if maxOutputs > 0 && *req.N > uint(maxOutputs) {
			return fmt.Errorf("n must be between 1 and %d for model %s", maxOutputs, model)
		}
	}
	_, err := buildGenerationsRequestWithError(req, model)
	return err
}

// buildGenerationsRequestWithError converts the classic
// /v1/images/generations request shape into a /v1/responses payload with
// stream:true. Text-only requests retain the historical string `input` shape;
// requests carrying an image use a user content array with input_text and one
// input_image part per source URL/data URI.
func buildGenerationsRequestWithError(req *dto.ImageRequest, modelOverride string) (responsesRequest, error) {
	if req == nil {
		return responsesRequest{}, errors.New("image request is required")
	}

	model := req.Model
	if modelOverride != "" {
		model = modelOverride
	}
	tool := imageGenerationTool{Type: "image_generation"}
	toolSize, err := gptImageSizeFromUnifiedOptions(req, model)
	if err != nil {
		return responsesRequest{}, err
	}
	if toolSize != "" {
		tool.Size = toolSize
	}
	if req.Quality != "" {
		quality := strings.ToLower(strings.TrimSpace(req.Quality))
		capabilities := common.ImageModelCapabilitiesForModel(model)
		if (capabilities.Family == common.ImageModelFamilyGPTImage || capabilities.Family == common.ImageModelFamilyGPTImage2) && !capabilities.SupportsQuality(quality) {
			return responsesRequest{}, fmt.Errorf("quality %q is not supported by model %s", req.Quality, model)
		}
		tool.Quality = quality
	}
	of, err := rawStringField(req.OutputFormat, "output_format")
	if err != nil {
		return responsesRequest{}, err
	}
	if of != "" {
		of = strings.ToLower(strings.TrimSpace(of))
		if strings.EqualFold(of, "jpg") {
			of = "jpeg"
		}
		switch of {
		case "png", "jpeg", "webp":
		default:
			return responsesRequest{}, fmt.Errorf("unsupported output_format %q", of)
		}
		tool.OutputFormat = of
	}
	if oc := req.OutputCompression; len(oc) > 0 {
		trimmed := bytes.TrimSpace(oc)
		if common.GetJsonType(trimmed) != "number" {
			return responsesRequest{}, errors.New("output_compression must be an integer between 0 and 100")
		}
		compression, err := strconv.Atoi(string(trimmed))
		if err != nil || compression < 0 || compression > 100 {
			return responsesRequest{}, errors.New("output_compression must be an integer between 0 and 100")
		}
		tool.OutputCompression = compression
	}
	bg, err := rawStringField(req.Background, "background")
	if err != nil {
		return responsesRequest{}, err
	}
	bg = strings.ToLower(strings.TrimSpace(bg))
	if bg != "" {
		switch bg {
		case "auto", "opaque", "transparent":
		default:
			return responsesRequest{}, fmt.Errorf("unsupported background %q", bg)
		}
		tool.Background = bg
	}
	mod, err := rawStringField(req.Moderation, "moderation")
	if err != nil {
		return responsesRequest{}, err
	}
	mod = strings.ToLower(strings.TrimSpace(mod))
	if mod != "" {
		switch mod {
		case "auto", "low":
		default:
			return responsesRequest{}, fmt.Errorf("unsupported moderation %q", mod)
		}
		tool.Moderation = mod
	} else {
		// Match the worker's behavior — default to "low" so casual prompts
		// don't hit upstream's overly strict default safety filter.
		tool.Moderation = "low"
	}

	input, err := buildGenerationsInput(req)
	if err != nil {
		return responsesRequest{}, err
	}

	return responsesRequest{
		Model:  model,
		Input:  input,
		Tools:  []imageGenerationTool{tool},
		Stream: true,
	}, nil
}

// buildGenerationsInput preserves the string input shape for ordinary text
// generation. When image sources are present, it emits the Responses API
// multimodal content structure expected by gpt-image models.
func buildGenerationsInput(req *dto.ImageRequest) (any, error) {
	if req == nil {
		return nil, errors.New("image request is required")
	}
	urls, err := req.ImageInputURLs()
	if err != nil {
		return nil, fmt.Errorf("invalid images: %w", err)
	}

	// `image` predates the normalized `images` field and remains accepted by a
	// number of OpenAI-compatible clients. Prefer canonical Images when both
	// fields are present; use the singular field as a fallback.
	if len(urls) == 0 && len(bytes.TrimSpace(req.Image)) > 0 && common.GetJsonType(req.Image) != "null" {
		singular := dto.ImageRequest{Images: append(json.RawMessage(nil), req.Image...)}
		urls, err = singular.ImageInputURLs()
		if err != nil {
			return nil, fmt.Errorf("invalid image: %w", err)
		}
	}
	if len(urls) == 0 {
		return req.Prompt, nil
	}

	content := make([]map[string]any, 0, len(urls)+1)
	content = append(content, map[string]any{
		"type": "input_text",
		"text": req.Prompt,
	})
	for _, imageURL := range urls {
		content = append(content, map[string]any{
			"type":      "input_image",
			"image_url": imageURL,
		})
	}

	return []map[string]any{{
		"role":    "user",
		"content": content,
	}}, nil
}
