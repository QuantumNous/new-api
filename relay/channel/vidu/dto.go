package vidu

type ImageRequest struct {
	Model       string   `json:"model"`
	Images      []string `json:"images,omitempty"`
	Prompt      string   `json:"prompt"`
	Seed        int      `json:"seed,omitempty"`
	AspectRatio string   `json:"aspect_ratio,omitempty"`
	Resolution  string   `json:"resolution,omitempty"`
	Payload     string   `json:"payload,omitempty"`
	CallbackUrl string   `json:"callback_url,omitempty"`
}

type ImageResponse struct {
	TaskId      string   `json:"task_id"`
	State       string   `json:"state"`
	Model       string   `json:"model"`
	Prompt      string   `json:"prompt"`
	Images      []string `json:"images,omitempty"`
	Seed        int      `json:"seed"`
	AspectRatio string   `json:"aspect_ratio"`
	Resolution  string   `json:"resolution"`
	CallbackUrl string   `json:"callback_url,omitempty"`
	Payload     string   `json:"payload,omitempty"`
	Credits     int      `json:"credits"`
	CreatedAt   string   `json:"created_at"`
}

type TaskResultResponse struct {
	State     string        `json:"state"`
	ErrCode   string        `json:"err_code,omitempty"`
	Credits   int           `json:"credits"`
	Payload   string        `json:"payload,omitempty"`
	Creations []ImageResult `json:"creations"`
}

type ImageResult struct {
	ID       string `json:"id"`
	URL      string `json:"url"`
	CoverURL string `json:"cover_url,omitempty"`
}
