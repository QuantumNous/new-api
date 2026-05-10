package image_stream

// Builders that turn an OpenAI-shaped Images-API request into the
// /v1/responses payload our upstream channel speaks. The image_generation
// tool field is the bridge between the two surface shapes.

import (
	"encoding/json"

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
	Model  string             `json:"model"`
	Input  any                `json:"input"`
	Tools  []imageGenerationTool `json:"tools"`
	Stream bool               `json:"stream"`
}

// rawString unwraps json.RawMessage values that were stored as JSON strings
// into the plain string they represent. ImageRequest stores user-typed
// fields like Background/Moderation as RawMessage so they can be either
// `"opaque"` or omitted; the upstream tool field expects bare strings.
func rawString(raw json.RawMessage) string {
	if len(raw) == 0 {
		return ""
	}
	var s string
	if err := json.Unmarshal(raw, &s); err != nil {
		// fall through — caller probably passed e.g. a number; render as raw
		return string(raw)
	}
	return s
}

// buildGenerationsRequest converts the classic /v1/images/generations
// request shape into a /v1/responses payload with stream:true. The simple
// case: input is the prompt string.
func buildGenerationsRequest(req *dto.ImageRequest, modelOverride string) responsesRequest {
	tool := imageGenerationTool{Type: "image_generation"}
	if req.Size != "" {
		tool.Size = req.Size
	}
	if req.Quality != "" {
		tool.Quality = req.Quality
	}
	if of := rawString(req.OutputFormat); of != "" {
		tool.OutputFormat = of
	}
	if oc := req.OutputCompression; len(oc) > 0 {
		tool.OutputCompression = json.RawMessage(oc)
	}
	if bg := rawString(req.Background); bg != "" {
		tool.Background = bg
	}
	if mod := rawString(req.Moderation); mod != "" {
		tool.Moderation = mod
	} else {
		// Match the worker's behavior — default to "low" so casual prompts
		// don't hit upstream's overly strict default safety filter.
		tool.Moderation = "low"
	}

	model := req.Model
	if modelOverride != "" {
		model = modelOverride
	}

	return responsesRequest{
		Model:  model,
		Input:  req.Prompt,
		Tools:  []imageGenerationTool{tool},
		Stream: true,
	}
}
