package hailuov2

type URLValue struct {
	URL string `json:"url"`
}

type ContentItem struct {
	Type     string    `json:"type"`
	Text     *string   `json:"text,omitempty"`
	ImageURL *URLValue `json:"image_url,omitempty"`
	VideoURL *URLValue `json:"video_url,omitempty"`
	AudioURL *URLValue `json:"audio_url,omitempty"`
	Role     *string   `json:"role,omitempty"`
}

type VideoRequest struct {
	Model         string        `json:"model"`
	Content       []ContentItem `json:"content"`
	Resolution    string        `json:"resolution"`
	Duration      int           `json:"duration"`
	Ratio         *string       `json:"ratio,omitempty"`
	CallbackURL   *string       `json:"callback_url,omitempty"`
	AIGCWatermark *bool         `json:"aigc_watermark,omitempty"`
}

type CreateResponse struct {
	TaskID string `json:"task_id"`
}

type QueryResponse struct {
	Task VideoTask `json:"task"`
}

type ErrorResponse struct {
	Type  string      `json:"type,omitempty"`
	Error ErrorDetail `json:"error"`
}

type ErrorDetail struct {
	Type     string `json:"type,omitempty"`
	Message  string `json:"message,omitempty"`
	HTTPCode string `json:"http_code,omitempty"`
}

type VideoTask struct {
	ID         string            `json:"id,omitempty"`
	Status     string            `json:"status"`
	Content    *VideoTaskContent `json:"content,omitempty"`
	Error      *VideoTaskError   `json:"error,omitempty"`
	Usage      *VideoTaskUsage   `json:"usage,omitempty"`
	Resolution string            `json:"resolution,omitempty"`
	Duration   *int              `json:"duration,omitempty"`
	Ratio      *string           `json:"ratio,omitempty"`
}

type VideoTaskContent struct {
	URL string `json:"url,omitempty"`
}

type VideoTaskError struct {
	Code    string `json:"code,omitempty"`
	Message string `json:"message,omitempty"`
}

type VideoTaskUsage struct {
	TotalSeconds    *int `json:"total_seconds,omitempty"`
	InputSeconds    *int `json:"input_seconds,omitempty"`
	OutputSeconds   *int `json:"output_seconds,omitempty"`
	InputImageCount *int `json:"input_image_count,omitempty"`
}
