package xai

import (
	"encoding/json"

	"github.com/QuantumNous/new-api/relaykit/dto"
)

// ChatCompletionResponse represents the response from XAI chat completion API
type ChatCompletionResponse struct {
	Id                string                         `json:"id"`
	Object            string                         `json:"object"`
	Created           int64                          `json:"created"`
	Model             string                         `json:"model"`
	Choices           []dto.OpenAITextResponseChoice `json:"choices"`
	Usage             *dto.Usage                     `json:"usage"`
	SystemFingerprint string                         `json:"system_fingerprint"`
}

// ImageRequest is the JSON payload accepted by xAI's image generation and edit
// endpoints. Edit inputs are represented as image objects with url or file_id.
type ImageRequest struct {
	Model       string `json:"model"`
	Prompt      string `json:"prompt" binding:"required"`
	N           int    `json:"n,omitempty"`
	AspectRatio string `json:"aspect_ratio,omitempty"`
	Resolution  string `json:"resolution,omitempty"`
	Quality     string `json:"quality,omitempty"`
	// Size           string          `json:"size,omitempty"`
	ResponseFormat string            `json:"response_format,omitempty"`
	Image          json.RawMessage   `json:"image,omitempty"`
	Images         []json.RawMessage `json:"images,omitempty"`
	// Style          string          `json:"style,omitempty"`
	// User           string          `json:"user,omitempty"`
	// ExtraFields    json.RawMessage `json:"extra_fields,omitempty"`
}
