package dto

type VideoRequest struct {
	Model          string         `json:"model,omitempty" example:"kling-v1"`                                                                                                                                    // Model/style ID
	Prompt         string         `json:"prompt,omitempty" example:"An astronaut stands up and walks away"`                                                                                                      // Text prompt
	Image          string         `json:"image,omitempty" example:"https://h2.inkwai.com/bs2/upload-ylab-stunt/se/ai_portal_queue_mmu_image_upscale_aiweb/3214b798-e1b4-4b00-b7af-72b5b0417420_raw_image_0.jpg"` // Image input (URL/Base64)
	Duration       float64        `json:"duration" example:"5.0"`                                                                                                                                                // Video duration (seconds)
	Width          int            `json:"width" example:"512"`                                                                                                                                                   // Video width
	Height         int            `json:"height" example:"512"`                                                                                                                                                  // Video height
	Fps            int            `json:"fps,omitempty" example:"30"`                                                                                                                                            // Video frame rate
	Seed           int            `json:"seed,omitempty" example:"20231234"`                                                                                                                                     // Random seed
	N              int            `json:"n,omitempty" example:"1"`                                                                                                                                               // Number of videos to generate
	ResponseFormat string         `json:"response_format,omitempty" example:"url"`                                                                                                                               // Response format
	User           string         `json:"user,omitempty" example:"user-1234"`                                                                                                                                    // User identifier
	Metadata       map[string]any `json:"metadata,omitempty"`                                                                                                                                                    // Vendor-specific/custom params (e.g. negative_prompt, style, quality_level, etc.)
}

// VideoResponse video generation response after submitting the task
type VideoResponse struct {
	TaskId string `json:"task_id"`
	Status string `json:"status"`
}

// VideoTaskResponse Query the response of video generation task status
type VideoTaskResponse struct {
	TaskId   string             `json:"task_id" example:"abcd1234efgh"` // Task ID
	Status   string             `json:"status" example:"succeeded"`     // Task status
	Url      string             `json:"url,omitempty"`                  // Video resource URL (on success)
	Format   string             `json:"format,omitempty" example:"mp4"` // video format
	Metadata *VideoTaskMetadata `json:"metadata,omitempty"`             // Result metadata
	Error    *VideoTaskError    `json:"error,omitempty"`                // Error message (on failure)
}

// VideoTaskMetadata video task metadata
type VideoTaskMetadata struct {
	Duration float64 `json:"duration" example:"5.0"`  // Actual generated video duration
	Fps      int     `json:"fps" example:"30"`        // Actual frame rate
	Width    int     `json:"width" example:"512"`     // actual width
	Height   int     `json:"height" example:"512"`    // actual height
	Seed     int     `json:"seed" example:"20231234"` // Random seed to use
}

// VideoTaskError video task error message
type VideoTaskError struct {
	Code    int    `json:"code"`
	Message string `json:"message"`
}
