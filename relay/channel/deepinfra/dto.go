package deepinfra

type DeepinfraInferenceStatus struct {
	Status          string   `json:"status"`
	RuntimeMS       int      `json:"runtime_ms"`
	Cost            float64  `json:"cost"`
	TokensGenerated *int     `json:"tokens_generated"`
	TokensInput     int      `json:"tokens_input"`
}

type DeepinfraRerankResponse struct {
	RequestID       string                  `json:"request_id"`
	InferenceStatus DeepinfraInferenceStatus `json:"inference_status"`
	Scores          []float64               `json:"scores"`
	InputTokens     int                     `json:"input_tokens"`
}

type SFImageRequest struct {
	Model             string  `json:"model"`
	Prompt            string  `json:"prompt"`
	NegativePrompt    string  `json:"negative_prompt,omitempty"`
	ImageSize         string  `json:"image_size,omitempty"`
	BatchSize         uint    `json:"batch_size,omitempty"`
	Seed              uint64  `json:"seed,omitempty"`
	NumInferenceSteps uint    `json:"num_inference_steps,omitempty"`
	GuidanceScale     float64 `json:"guidance_scale,omitempty"`
	Cfg               float64 `json:"cfg,omitempty"`
	Image             string  `json:"image,omitempty"`
	Image2            string  `json:"image2,omitempty"`
	Image3            string  `json:"image3,omitempty"`
}

type DeepInfraRerankRequest struct {
	Queries   []string `json:"queries"`
	Documents []string `json:"documents"`
}
