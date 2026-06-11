package listenhub

type ImageConfig struct {
	ImageSize   string `json:"imageSize,omitempty"`
	AspectRatio string `json:"aspectRatio,omitempty"`
}

type FileData struct {
	FileURI  string `json:"fileUri"`
	MimeType string `json:"mimeType"`
}

type InlineData struct {
	Data     string `json:"data"`
	MimeType string `json:"mimeType"`
}

type ReferenceImage struct {
	FileData   *FileData   `json:"fileData,omitempty"`
	InlineData *InlineData `json:"inlineData,omitempty"`
}

type ImageRequest struct {
	Provider        string           `json:"provider"`
	Model           string           `json:"model,omitempty"`
	Prompt          string           `json:"prompt"`
	ReferenceImages []ReferenceImage `json:"referenceImages,omitempty"`
	ImageConfig     *ImageConfig     `json:"imageConfig,omitempty"`
}

type InlineDataPart struct {
	MimeType string `json:"mimeType"`
	Data     string `json:"data"`
}

type ContentPart struct {
	InlineData *InlineDataPart `json:"inlineData,omitempty"`
	Text       string          `json:"text,omitempty"`
}

type CandidateContent struct {
	Parts []ContentPart `json:"parts"`
}

type Candidate struct {
	Content CandidateContent `json:"content"`
}

type ImageResponse struct {
	Candidates []Candidate `json:"candidates"`
	Error      *ErrorBody  `json:"error,omitempty"`
}

type ErrorBody struct {
	Message string `json:"message,omitempty"`
	Type    string `json:"type,omitempty"`
	Code    any    `json:"code,omitempty"`
}
