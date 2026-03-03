package hailuo

type SubjectReference struct {
	Type  string   `json:"type"`  // Subject type, currently only supports "character"
	Image []string `json:"image"` // Array of subject reference images (currently only supports single image)
}

type VideoRequest struct {
	Model            string             `json:"model"`
	Prompt           string             `json:"prompt,omitempty"`
	PromptOptimizer  *bool              `json:"prompt_optimizer,omitempty"`
	FastPretreatment *bool              `json:"fast_pretreatment,omitempty"`
	Duration         *int               `json:"duration,omitempty"`
	Resolution       string             `json:"resolution,omitempty"`
	CallbackURL      string             `json:"callback_url,omitempty"`
	AigcWatermark    *bool              `json:"aigc_watermark,omitempty"`
	FirstFrameImage  string             `json:"first_frame_image,omitempty"` // For image-to-video and start-end-to-video
	LastFrameImage   string             `json:"last_frame_image,omitempty"`  // For start-end-to-video
	SubjectReference []SubjectReference `json:"subject_reference,omitempty"` // For subject-reference-to-video
}

type VideoResponse struct {
	TaskID   string   `json:"task_id"`
	BaseResp BaseResp `json:"base_resp"`
}

type BaseResp struct {
	StatusCode int    `json:"status_code"`
	StatusMsg  string `json:"status_msg"`
}

type QueryTaskRequest struct {
	TaskID string `json:"task_id"`
}

type QueryTaskResponse struct {
	TaskID      string   `json:"task_id"`
	Status      string   `json:"status"`
	FileID      string   `json:"file_id,omitempty"`
	VideoWidth  int      `json:"video_width,omitempty"`
	VideoHeight int      `json:"video_height,omitempty"`
	BaseResp    BaseResp `json:"base_resp"`
}

type ErrorInfo struct {
	StatusCode int    `json:"status_code"`
	StatusMsg  string `json:"status_msg"`
}

type TaskStatusInfo struct {
	TaskID    string `json:"task_id"`
	Status    string `json:"status"`
	FileID    string `json:"file_id,omitempty"`
	VideoURL  string `json:"video_url,omitempty"`
	ErrorCode int    `json:"error_code,omitempty"`
	ErrorMsg  string `json:"error_msg,omitempty"`
}

type ModelConfig struct {
	Name                 string
	DefaultResolution    string
	SupportedDurations   []int
	SupportedResolutions []string
	HasPromptOptimizer   bool
	HasFastPretreatment  bool
}

type RetrieveFileResponse struct {
	File     FileObject `json:"file"`
	BaseResp BaseResp   `json:"base_resp"`
}

type FileObject struct {
	FileID      int64  `json:"file_id"`
	Bytes       int64  `json:"bytes"`
	CreatedAt   int64  `json:"created_at"`
	Filename    string `json:"filename"`
	Purpose     string `json:"purpose"`
	DownloadURL string `json:"download_url"`
}

func GetModelConfig(model string) ModelConfig {
	configs := map[string]ModelConfig{
		"MiniMax-Hailuo-2.3": {
			Name:                 "MiniMax-Hailuo-2.3",
			DefaultResolution:    Resolution768P,
			SupportedDurations:   []int{6, 10},
			SupportedResolutions: []string{Resolution768P, Resolution1080P},
			HasPromptOptimizer:   true,
			HasFastPretreatment:  true,
		},
		"MiniMax-Hailuo-2.3-Fast": {
			Name:                 "MiniMax-Hailuo-2.3-Fast",
			DefaultResolution:    Resolution768P,
			SupportedDurations:   []int{6, 10},
			SupportedResolutions: []string{Resolution768P, Resolution1080P},
			HasPromptOptimizer:   true,
			HasFastPretreatment:  true,
		},
		"MiniMax-Hailuo-02": {
			Name:                 "MiniMax-Hailuo-02",
			DefaultResolution:    Resolution768P,
			SupportedDurations:   []int{6, 10},
			SupportedResolutions: []string{Resolution512P, Resolution768P, Resolution1080P},
			HasPromptOptimizer:   true,
			HasFastPretreatment:  true,
		},
		"T2V-01-Director": {
			Name:                 "T2V-01-Director",
			DefaultResolution:    Resolution768P,
			SupportedDurations:   []int{6},
			SupportedResolutions: []string{Resolution768P, Resolution1080P},
			HasPromptOptimizer:   true,
			HasFastPretreatment:  false,
		},
		"T2V-01": {
			Name:                 "T2V-01",
			DefaultResolution:    Resolution720P,
			SupportedDurations:   []int{6},
			SupportedResolutions: []string{Resolution720P},
			HasPromptOptimizer:   true,
			HasFastPretreatment:  false,
		},
		"I2V-01-Director": {
			Name:                 "I2V-01-Director",
			DefaultResolution:    Resolution720P,
			SupportedDurations:   []int{6},
			SupportedResolutions: []string{Resolution720P, Resolution1080P},
			HasPromptOptimizer:   true,
			HasFastPretreatment:  false,
		},
		"I2V-01-live": {
			Name:                 "I2V-01-live",
			DefaultResolution:    Resolution720P,
			SupportedDurations:   []int{6},
			SupportedResolutions: []string{Resolution720P, Resolution1080P},
			HasPromptOptimizer:   true,
			HasFastPretreatment:  false,
		},
		"I2V-01": {
			Name:                 "I2V-01",
			DefaultResolution:    Resolution720P,
			SupportedDurations:   []int{6},
			SupportedResolutions: []string{Resolution720P, Resolution1080P},
			HasPromptOptimizer:   true,
			HasFastPretreatment:  false,
		},
		"S2V-01": {
			Name:                 "S2V-01",
			DefaultResolution:    Resolution720P,
			SupportedDurations:   []int{6},
			SupportedResolutions: []string{Resolution720P},
			HasPromptOptimizer:   true,
			HasFastPretreatment:  false,
		},
	}

	if config, exists := configs[model]; exists {
		return config
	}

	return ModelConfig{
		Name:                 model,
		DefaultResolution:    DefaultResolution,
		SupportedDurations:   []int{6},
		SupportedResolutions: []string{DefaultResolution},
		HasPromptOptimizer:   true,
		HasFastPretreatment:  false,
	}
}
