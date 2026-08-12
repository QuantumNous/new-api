package siftq

type mediaURL struct {
	URL string `json:"url"`
}

type contentItem struct {
	Type     string    `json:"type"`
	Text     string    `json:"text,omitempty"`
	ImageURL *mediaURL `json:"image_url,omitempty"`
	VideoURL *mediaURL `json:"video_url,omitempty"`
	AudioURL *mediaURL `json:"audio_url,omitempty"`
	Role     string    `json:"role,omitempty"`
}

type videoRequest struct {
	Model       string        `json:"model"`
	Content     []contentItem `json:"content"`
	Resolution  string        `json:"resolution"`
	Duration    int           `json:"duration"`
	Ratio       string        `json:"ratio"`
	CallbackURL string        `json:"callback_url,omitempty"`
}

type requestOverrides struct {
	Content     []contentItem `json:"content,omitempty"`
	Duration    *int          `json:"duration,omitempty"`
	Resolution  *string       `json:"resolution,omitempty"`
	Ratio       *string       `json:"ratio,omitempty"`
	CallbackURL *string       `json:"callback_url,omitempty"`
}

type createResponse struct {
	TaskID string `json:"task_id"`
}

type errorEnvelope struct {
	Type      string `json:"type"`
	RequestID string `json:"request_id"`
	Error     struct {
		Type     string `json:"type"`
		Message  string `json:"message"`
		HTTPCode string `json:"http_code"`
	} `json:"error"`
}

type taskContent struct {
	URL    string `json:"url,omitempty"`
	Prompt string `json:"prompt,omitempty"`
}

type taskError struct {
	Code    string `json:"code"`
	Message string `json:"message"`
}

type taskUsage struct {
	TotalSeconds     int `json:"total_seconds,omitempty"`
	InputSeconds     int `json:"input_seconds,omitempty"`
	OutputSeconds    int `json:"output_seconds,omitempty"`
	InputImageCount  int `json:"input_image_count,omitempty"`
	TotalTokens      int `json:"total_tokens,omitempty"`
	PromptTokens     int `json:"prompt_tokens,omitempty"`
	CompletionTokens int `json:"completion_tokens,omitempty"`
}

type videoTask struct {
	ID         string      `json:"id"`
	Model      string      `json:"model"`
	Status     string      `json:"status"`
	Error      *taskError  `json:"error,omitempty"`
	CreatedAt  int64       `json:"created_at,omitempty"`
	UpdatedAt  int64       `json:"updated_at,omitempty"`
	Content    taskContent `json:"content,omitempty"`
	Resolution string      `json:"resolution,omitempty"`
	Duration   int         `json:"duration,omitempty"`
	Ratio      string      `json:"ratio,omitempty"`
	TaskType   string      `json:"task_type,omitempty"`
	Modality   string      `json:"modality,omitempty"`
	Usage      taskUsage   `json:"usage,omitempty"`
}

type queryResponse struct {
	Task videoTask `json:"task"`
}
