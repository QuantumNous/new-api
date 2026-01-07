package minimax

import (
	"github.com/QuantumNous/new-api/dto"
	taskhailuo "github.com/QuantumNous/new-api/relay/channel/task/hailuo"
)

type ImageGenerationRequest struct {
	Model            string                  `json:"model"`
	Prompt           string                  `json:"prompt"`
	Style            *StyleObject            `json:"style,omitempty"`
	AspectRatio      string                  `json:"aspect_ratio,omitempty"`
	Width            dto.IntValue            `json:"width,omitempty"`
	Height           dto.IntValue            `json:"height,omitempty"`
	ResponseFormat   string                  `json:"response_format,omitempty"`
	Seed             *dto.IntValue           `json:"seed,omitempty"`
	N                dto.IntValue            `json:"n,omitempty"`
	PromptOptimizer  *bool                   `json:"prompt_optimizer,omitempty"`
	AigcWatermark    *bool                   `json:"aigc_watermark,omitempty"`
	SubjectReference []ImageSubjectReference `json:"subject_reference,omitempty"`
}

type ImageSubjectReference struct {
	Type      string `json:"type"`       // e.g. "character"
	ImageFile string `json:"image_file"` // URL or data URL (base64)
}

type StyleObject struct {
	StyleType   string  `json:"style_type,omitempty"`
	StyleWeight float64 `json:"style_weight,omitempty"`
}

type ImageGenerationResponse struct {
	ID       string                   `json:"id"`
	Data     *ImageDataObject         `json:"data,omitempty"`
	Metadata *ImageGenerationMetadata `json:"metadata,omitempty"`
	BaseResp taskhailuo.BaseResp      `json:"base_resp"`
}

type ImageDataObject struct {
	ImageUrls   []string `json:"image_urls,omitempty"`
	ImageBase64 []string `json:"image_base64,omitempty"`
}

type ImageGenerationMetadata struct {
	SuccessCount dto.IntValue `json:"success_count,omitempty"`
	FailedCount  dto.IntValue `json:"failed_count,omitempty"`
}
