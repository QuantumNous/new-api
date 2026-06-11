package siliconflow

import "github.com/QuantumNous/new-api/dto"

type SFTokens struct {
	InputTokens  int `json:"input_tokens"`
	OutputTokens int `json:"output_tokens"`
}

type SFMeta struct {
	Tokens SFTokens `json:"tokens"`
}

type SFRerankResponse struct {
	Results []dto.RerankResponseResult `json:"results"`
	Meta    SFMeta                     `json:"meta"`
}

type SFImageRequest struct {
	Model             string   `json:"model"`
	Prompt            string   `json:"prompt"`
	NegativePrompt    string   `json:"negative_prompt,omitempty"`
	ImageSize         string   `json:"image_size,omitempty"`
	BatchSize         *uint    `json:"batch_size,omitempty"`
	Seed              *uint64  `json:"seed,omitempty"`
	NumInferenceSteps *uint    `json:"num_inference_steps,omitempty"`
	GuidanceScale     *float64 `json:"guidance_scale,omitempty"`
	Cfg               *float64 `json:"cfg,omitempty"`
	OutputFormat      string   `json:"output_format,omitempty"`
	Image             string   `json:"image,omitempty"`
	Image2            string   `json:"image2,omitempty"`
	Image3            string   `json:"image3,omitempty"`
}

type SFImageResponse struct {
	Images  []SFImageResponseItem `json:"images"`
	Timings any                   `json:"timings,omitempty"`
	Seed    any                   `json:"seed,omitempty"`
	Code    any                   `json:"code,omitempty"`
	Message string                `json:"message,omitempty"`
	Data    any                   `json:"data,omitempty"`
}

type SFImageResponseItem struct {
	Url     string `json:"url"`
	B64Json string `json:"b64_json,omitempty"`
}
