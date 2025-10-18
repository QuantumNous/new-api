package modelscope

type MSImageResponse struct {
	TaskId       string           `json:"task_id,omitempty"`
	TaskStatus   string           `json:"task_status,omitempty"`
	OutputImages []string    `json:"output_images,omitempty"`
}

type MSImageRequest struct {
	Model          string `json:"model"`
	Prompt         string `json:"prompt"`
	NegativePrompt string `json:"negative_prompt,omitempty"`
	Seed           int64  `json:"seed,omitempty"`
	Steps          int64  `json:"steps,omitempty"`
	Guidance       float32 `json:"guidance,omitempty"`
	ImageUrl       string  `json:"image_url,omitempty"`
	Size           string `json:"size,omitempty"`
}
