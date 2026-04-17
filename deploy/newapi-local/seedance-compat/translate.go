package main

import (
	"encoding/json"
	"errors"
	"strconv"
	"strings"
)

type seedanceRequest struct {
	Model                 string        `json:"model"`
	Content               []contentItem `json:"content"`
	CallbackURL           string        `json:"callback_url,omitempty"`
	ReturnLastFrame       *bool         `json:"return_last_frame,omitempty"`
	ServiceTier           string        `json:"service_tier,omitempty"`
	ExecutionExpiresAfter *int          `json:"execution_expires_after,omitempty"`
	GenerateAudio         *bool         `json:"generate_audio,omitempty"`
	Draft                 *bool         `json:"draft,omitempty"`
	Resolution            string        `json:"resolution,omitempty"`
	Ratio                 string        `json:"ratio,omitempty"`
	Duration              any           `json:"duration,omitempty"`
	Frames                *int          `json:"frames,omitempty"`
	Seed                  *int          `json:"seed,omitempty"`
	CameraFixed           *bool         `json:"camera_fixed,omitempty"`
	Watermark             *bool         `json:"watermark,omitempty"`
}

type contentItem struct {
	Type     string         `json:"type,omitempty"`
	Text     string         `json:"text,omitempty"`
	ImageURL map[string]any `json:"image_url,omitempty"`
	VideoURL map[string]any `json:"video_url,omitempty"`
	AudioURL map[string]any `json:"audio_url,omitempty"`
	Role     string         `json:"role,omitempty"`
}

type newAPIRequest struct {
	Prompt   string         `json:"prompt"`
	Model    string         `json:"model,omitempty"`
	Seconds  string         `json:"seconds,omitempty"`
	Metadata map[string]any `json:"metadata,omitempty"`
}

func BuildNewAPIRequestFromSeedance(body []byte) (*newAPIRequest, error) {
	var req seedanceRequest
	if err := json.Unmarshal(body, &req); err != nil {
		return nil, errors.New("invalid seedance request body")
	}
	if strings.TrimSpace(req.Model) == "" {
		return nil, errors.New("model is required")
	}

	prompt := extractPrompt(req.Content)
	if prompt == "" {
		return nil, errors.New("content.text is required")
	}

	seconds := normalizeDuration(req.Duration)
	if seconds == "" {
		return nil, errors.New("duration is required")
	}

	metadata := map[string]any{
		"content": contentItemsToAny(req.Content),
	}
	if secondsInt, err := strconv.Atoi(seconds); err == nil {
		metadata["duration"] = secondsInt
	}
	if req.Resolution != "" {
		metadata["resolution"] = req.Resolution
	}
	if req.Ratio != "" {
		metadata["ratio"] = req.Ratio
	}
	if req.Watermark != nil {
		metadata["watermark"] = *req.Watermark
	}
	if req.ServiceTier != "" {
		metadata["service_tier"] = req.ServiceTier
	}
	if req.CallbackURL != "" {
		metadata["callback_url"] = req.CallbackURL
	}
	if req.ReturnLastFrame != nil {
		metadata["return_last_frame"] = *req.ReturnLastFrame
	}
	if req.ExecutionExpiresAfter != nil {
		metadata["execution_expires_after"] = *req.ExecutionExpiresAfter
	}
	if req.GenerateAudio != nil {
		metadata["generate_audio"] = *req.GenerateAudio
	}
	if req.Draft != nil {
		metadata["draft"] = *req.Draft
	}
	if req.Frames != nil {
		metadata["frames"] = *req.Frames
	}
	if req.Seed != nil {
		metadata["seed"] = *req.Seed
	}
	if req.CameraFixed != nil {
		metadata["camera_fixed"] = *req.CameraFixed
	}

	return &newAPIRequest{
		Prompt:   prompt,
		Model:    req.Model,
		Seconds:  seconds,
		Metadata: metadata,
	}, nil
}

func BuildSeedanceSubmitResponseFromNewAPI(body []byte) ([]byte, error) {
	var src map[string]any
	if err := json.Unmarshal(body, &src); err != nil {
		return nil, err
	}

	resp := map[string]any{
		"id":         src["id"],
		"task_id":    src["task_id"],
		"model":      src["model"],
		"status":     src["status"],
		"created_at": src["created_at"],
	}
	return json.Marshal(resp)
}

func extractPrompt(content []contentItem) string {
	for _, item := range content {
		if item.Type == "text" && strings.TrimSpace(item.Text) != "" {
			return item.Text
		}
	}
	return ""
}

func normalizeDuration(v any) string {
	switch value := v.(type) {
	case float64:
		return strconv.Itoa(int(value))
	case string:
		return strings.TrimSpace(value)
	default:
		return ""
	}
}

func contentItemsToAny(items []contentItem) []any {
	out := make([]any, 0, len(items))
	for _, item := range items {
		entry := map[string]any{}
		if item.Type != "" {
			entry["type"] = item.Type
		}
		if item.Text != "" {
			entry["text"] = item.Text
		}
		if item.ImageURL != nil {
			entry["image_url"] = item.ImageURL
		}
		if item.VideoURL != nil {
			entry["video_url"] = item.VideoURL
		}
		if item.AudioURL != nil {
			entry["audio_url"] = item.AudioURL
		}
		if item.Role != "" {
			entry["role"] = item.Role
		}
		out = append(out, entry)
	}
	return out
}
