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

type ImageRequest struct {
	Model          string          `json:"model"`
	Prompt         string          `json:"prompt" binding:"required"`
	N              int             `json:"n,omitempty"`
	ResponseFormat string          `json:"response_format,omitempty"`
	Quality        string          `json:"quality,omitempty"`
	AspectRatio    json.RawMessage `json:"aspect_ratio,omitempty"`
	Resolution     json.RawMessage `json:"resolution,omitempty"`
	Image          json.RawMessage `json:"image,omitempty"`
	Images         json.RawMessage `json:"images,omitempty"`
}
