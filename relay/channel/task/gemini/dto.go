package gemini

// GeminiVideoGenerationConfig represents the Gemini API GenerateVideosConfig.
// Reference: https://ai.google.dev/gemini-api/docs/video
type GeminiVideoGenerationConfig struct {
	AspectRatio      string `json:"aspectRatio,omitempty"`
	DurationSeconds  int    `json:"durationSeconds,omitempty"`
	NegativePrompt   string `json:"negativePrompt,omitempty"`
	PersonGeneration string `json:"personGeneration,omitempty"`
	Resolution       string `json:"resolution,omitempty"`
	NumberOfVideos   int    `json:"numberOfVideos,omitempty"`
}

// VeoImageInput represents an image input for Veo image-to-video.
// Used by both Gemini and Vertex adaptors.
type VeoImageInput struct {
	BytesBase64Encoded string `json:"bytesBase64Encoded"`
	MimeType           string `json:"mimeType"`
}

// GeminiVideoPayload is the top-level request body for the Gemini API
// models/{model}:generateVideos endpoint.
type GeminiVideoPayload struct {
	Model  string                       `json:"model,omitempty"`
	Prompt string                       `json:"prompt"`
	Image  *VeoImageInput               `json:"image,omitempty"`
	Config *GeminiVideoGenerationConfig `json:"config,omitempty"`
	// TODO: support referenceImages (style/asset references, up to 3 images)
	// TODO: support lastFrame (first+last frame interpolation, Veo 3.1)
}

type submitResponse struct {
	Name string `json:"name"`
}

type operationVideo struct {
	MimeType           string `json:"mimeType"`
	BytesBase64Encoded string `json:"bytesBase64Encoded"`
	Encoding           string `json:"encoding"`
}

type operationResponse struct {
	Name     string `json:"name"`
	Done     bool   `json:"done"`
	Response struct {
		Type                  string           `json:"@type"`
		RaiMediaFilteredCount int              `json:"raiMediaFilteredCount"`
		Videos                []operationVideo `json:"videos"`
		BytesBase64Encoded    string           `json:"bytesBase64Encoded"`
		Encoding              string           `json:"encoding"`
		Video                 string           `json:"video"`
		GenerateVideoResponse struct {
			GeneratedVideos []struct {
				Video struct {
					URI string `json:"uri"`
				} `json:"video"`
			} `json:"generatedVideos"`
		} `json:"generateVideoResponse"`
	} `json:"response"`
	Error struct {
		Message string `json:"message"`
	} `json:"error"`
}
