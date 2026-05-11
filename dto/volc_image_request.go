package dto

import (
	"encoding/json"

	"github.com/QuantumNous/new-api/types"
	"github.com/gin-gonic/gin"
)

// VolcImageRequest represents the native Volc Ark image generation request body.
// Fields documented at https://www.volcengine.com/docs/82379/1824121.
// All fields are forwarded byte-identical to upstream; parsing is only used for
// model-name extraction and basic validation.
type VolcImageRequest struct {
	// Model is the model endpoint ID (e.g. "high-aes-general-v21-L").
	Model string `json:"model"`
	// Prompt is the text prompt for text-to-image.
	Prompt string `json:"prompt,omitempty"`
	// Image is the base64-encoded image (or URL) for image-to-image.
	// Can be a string or an array of strings.
	Image json.RawMessage `json:"image,omitempty"`
	// Size e.g. "1024x1024", "2K", "4K".
	Size string `json:"size,omitempty"`
	// ResponseFormat e.g. "url" or "b64_json".
	ResponseFormat string `json:"response_format,omitempty"`
	// N is the number of images to generate.
	N *uint `json:"n,omitempty"`
	// Watermark controls whether a Volcengine watermark is added.
	Watermark *bool `json:"watermark,omitempty"`

	// Extra captures all Volc-specific fields that are not enumerated above
	// (e.g. sequential_image_generation, optimize_prompt_options, req_key,
	// model_name, logo_info, return_url, scale, ddim_steps, etc.)
	// so that they survive the parse/marshal round-trip without loss.
	Extra map[string]json.RawMessage `json:"-"`
}

func (r *VolcImageRequest) UnmarshalJSON(data []byte) error {
	var rawMap map[string]json.RawMessage
	if err := json.Unmarshal(data, &rawMap); err != nil {
		return err
	}

	type Alias VolcImageRequest
	var known Alias
	if err := json.Unmarshal(data, &known); err != nil {
		return err
	}
	*r = VolcImageRequest(known)

	knownKeys := map[string]struct{}{
		"model": {}, "prompt": {}, "image": {}, "size": {},
		"response_format": {}, "n": {}, "watermark": {},
	}
	r.Extra = make(map[string]json.RawMessage)
	for k, v := range rawMap {
		if _, ok := knownKeys[k]; !ok {
			r.Extra[k] = v
		}
	}
	return nil
}

// GetTokenCountMeta satisfies dto.Request; Volc image billing uses a flat
// per-call quota so we return a simple 1-image count.
func (r *VolcImageRequest) GetTokenCountMeta() *types.TokenCountMeta {
	return &types.TokenCountMeta{
		CombineText:     r.Prompt,
		MaxTokens:       1584,
		ImagePriceRatio: 1.0,
	}
}

func (r *VolcImageRequest) IsStream(_ *gin.Context) bool { return false }
func (r *VolcImageRequest) SetModelName(modelName string) {
	if modelName != "" {
		r.Model = modelName
	}
}
