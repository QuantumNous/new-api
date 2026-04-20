package gemini

import "github.com/QuantumNous/new-api/common"

// VeoImageInput represents an image input for Veo image-to-video.
// Used by both Gemini and Vertex adaptors.
type VeoImageInput struct {
	BytesBase64Encoded string `json:"bytesBase64Encoded"`
	MimeType           string `json:"mimeType"`
}

// VeoInstance represents a single instance in the Veo predictLongRunning request.
type VeoInstance struct {
	Prompt string         `json:"prompt"`
	Image  *VeoImageInput `json:"image,omitempty"`
	// TODO: support referenceImages (style/asset references, up to 3 images)
	// TODO: support lastFrame (first+last frame interpolation, Veo 3.1)
}

// VeoParameters represents the parameters block for Veo predictLongRunning.
type VeoParameters struct {
	SampleCount        int    `json:"sampleCount"`
	DurationSeconds    int    `json:"durationSeconds,omitempty"`
	AspectRatio        string `json:"aspectRatio,omitempty"`
	Resolution         string `json:"resolution,omitempty"`
	NegativePrompt     string `json:"negativePrompt,omitempty"`
	PersonGeneration   string `json:"personGeneration,omitempty"`
	StorageUri         string `json:"storageUri,omitempty"`
	CompressionQuality string `json:"compressionQuality,omitempty"`
	ResizeMode         string `json:"resizeMode,omitempty"`
	Seed               *int   `json:"seed,omitempty"`
	GenerateAudio      *bool  `json:"generateAudio,omitempty"`
}

// VeoRequestPayload is the top-level request body for the Veo
// predictLongRunning endpoint (used by both Gemini and Vertex).
type VeoRequestPayload struct {
	Instances  []VeoInstance  `json:"instances"`
	Parameters *VeoParameters `json:"parameters,omitempty"`
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
	Error OperationError `json:"error"`
}

type OperationError struct {
	Message string `json:"message"`
	Code    string `json:"code"`
}

func (e *OperationError) UnmarshalJSON(data []byte) error {
	switch common.GetJsonType(data) {
	case "object":
		type operationErrorAlias OperationError
		return common.Unmarshal(data, (*operationErrorAlias)(e))
	case "string":
		return common.Unmarshal(data, &e.Message)
	default:
		return nil
	}
}
