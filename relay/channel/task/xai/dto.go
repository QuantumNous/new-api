package xai

// VideoGenerationRequest is the request body for xAI video generation API.
// Docs: POST /v1/videos/generations
type VideoGenerationRequest struct {
	Model       string              `json:"model"`
	Prompt      string              `json:"prompt"`
	Duration    int                 `json:"duration,omitempty"`
	AspectRatio string              `json:"aspect_ratio,omitempty"`
	Resolution  string              `json:"resolution,omitempty"`
	Seed        *int                `json:"seed,omitempty"`
	Image       *VideoInputImageURL `json:"image,omitempty"`
}

type VideoInputImageURL struct {
	URL string `json:"url"`
}

type submitResponse struct {
	RequestID string `json:"request_id"`
}

type statusResponse struct {
	Status string `json:"status"`
	Model  string `json:"model,omitempty"`
	Video  *struct {
		URL               string `json:"url,omitempty"`
		Duration          int    `json:"duration,omitempty"`
		RespectModeration *bool  `json:"respect_moderation,omitempty"`
	} `json:"video,omitempty"`
	Error *struct {
		Message string `json:"message,omitempty"`
		Code    string `json:"code,omitempty"`
	} `json:"error,omitempty"`
}

type requestMetadata struct {
	Duration    *int   `json:"duration,omitempty"`
	AspectRatio string `json:"aspect_ratio,omitempty"`
	Resolution  string `json:"resolution,omitempty"`
	Seed        *int   `json:"seed,omitempty"`
}
