package main

import (
	"encoding/json"
	"errors"
	"strconv"
	"strings"
)

type newAPIRequest struct {
	Prompt   string         `json:"prompt"`
	Model    string         `json:"model,omitempty"`
	Seconds  string         `json:"seconds,omitempty"`
	Metadata map[string]any `json:"metadata,omitempty"`
}

func BuildNewAPIRequestFromSeedance(body []byte) (*newAPIRequest, error) {
	var raw map[string]any
	if err := json.Unmarshal(body, &raw); err != nil {
		return nil, errors.New("invalid seedance request body")
	}
	model, _ := raw["model"].(string)
	if strings.TrimSpace(model) == "" {
		return nil, errors.New("model is required")
	}

	content, ok := raw["content"].([]any)
	if !ok || len(content) == 0 {
		return nil, errors.New("content is required")
	}
	prompt := extractPrompt(content)
	if prompt == "" {
		return nil, errors.New("content.text is required")
	}

	seconds := normalizeDuration(raw["duration"])
	if seconds == "" {
		return nil, errors.New("duration is required")
	}

	metadata := cloneMap(raw)

	return &newAPIRequest{
		Prompt:   prompt,
		Model:    model,
		Seconds:  seconds,
		Metadata: metadata,
	}, nil
}

func BuildSeedanceSubmitResponseFromNewAPI(body []byte) ([]byte, error) {
	return BuildSeedanceTaskResponseFromNewAPI(body)
}

func BuildSeedanceTaskResponseFromNewAPI(body []byte) ([]byte, error) {
	var src map[string]any
	if err := json.Unmarshal(body, &src); err != nil {
		return nil, err
	}

	resp := normalizeSeedanceTaskResponse(src)
	if _, ok := resp["task_id"]; !ok {
		if id, ok := resp["id"]; ok {
			resp["task_id"] = id
		}
	}
	replaceResponseIDWithTaskID(resp)
	removeInternalResponseFields(resp)
	if status, ok := resp["status"].(string); ok {
		resp["status"] = mapSeedanceStatus(status)
	}
	if _, ok := resp["updated_at"]; !ok {
		if completedAt, ok := resp["completed_at"]; ok {
			resp["updated_at"] = completedAt
		}
	}
	if videoURL := extractResultVideoURL(resp); videoURL == "" {
		videoURL = extractResultVideoURL(src)
	}
	if videoURL, _ := respVideoURL(resp, src); videoURL != "" {
		resp["content"] = map[string]any{
			"video_url": videoURL,
		}
	}
	return json.Marshal(resp)
}

func replaceResponseIDWithTaskID(resp map[string]any) {
	taskID, ok := resp["task_id"]
	if !ok {
		return
	}
	if existingID, ok := resp["id"]; ok && existingID != taskID {
		resp["upstream_id"] = existingID
	}
	resp["id"] = taskID
}

func removeInternalResponseFields(resp map[string]any) {
	delete(resp, "user_id")
	delete(resp, "channel_id")
	delete(resp, "properties")
	delete(resp, "platform")
	delete(resp, "group")
	delete(resp, "quota")
}

func normalizeSeedanceTaskResponse(src map[string]any) map[string]any {
	if src == nil {
		return map[string]any{}
	}

	data, ok := src["data"].(map[string]any)
	if !ok || len(src) == 1 {
		return cloneMap(src)
	}

	// NewAPI may wrap the actual Ark task object under data.data while keeping
	// compatibility fields such as task_id/status on the outer data object.
	resp := cloneMap(data)
	if inner, ok := data["data"].(map[string]any); ok {
		mergeMap(resp, inner)
		delete(resp, "data")
	}
	delete(resp, "code")
	delete(resp, "message")
	return resp
}

func extractPrompt(content []any) string {
	for _, item := range content {
		itemMap, ok := item.(map[string]any)
		if !ok {
			continue
		}
		itemType, _ := itemMap["type"].(string)
		itemText, _ := itemMap["text"].(string)
		if itemType == "text" && strings.TrimSpace(itemText) != "" {
			return itemText
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

func mapSeedanceStatus(status string) string {
	switch strings.ToLower(strings.TrimSpace(status)) {
	case "queued", "pending":
		return "queued"
	case "in_progress", "processing", "running":
		return "processing"
	case "completed", "succeeded", "success":
		return "succeeded"
	case "failed", "failure":
		return "failed"
	default:
		return status
	}
}

func extractResultVideoURL(src map[string]any) string {
	if metadata, ok := src["metadata"].(map[string]any); ok {
		if url, _ := metadata["url"].(string); strings.TrimSpace(url) != "" {
			return url
		}
	}
	if content, ok := src["content"].([]any); ok && len(content) > 0 {
		if first, ok := content[0].(map[string]any); ok {
			if url, _ := first["url"].(string); strings.TrimSpace(url) != "" {
				return url
			}
			if url, _ := first["video_url"].(string); strings.TrimSpace(url) != "" {
				return url
			}
		}
	}
	if content, ok := src["content"].(map[string]any); ok {
		if url, _ := content["video_url"].(string); strings.TrimSpace(url) != "" {
			return url
		}
	}
	return ""
}

func respVideoURL(candidates ...map[string]any) (string, bool) {
	for _, candidate := range candidates {
		if url := extractResultVideoURL(candidate); url != "" {
			return url, true
		}
	}
	return "", false
}

func mergeMap(dst map[string]any, src map[string]any) {
	for k, v := range src {
		dst[k] = v
	}
}

func cloneMap(src map[string]any) map[string]any {
	if src == nil {
		return nil
	}
	raw, err := json.Marshal(src)
	if err != nil {
		return map[string]any{}
	}
	var dst map[string]any
	if err := json.Unmarshal(raw, &dst); err != nil {
		return map[string]any{}
	}
	return dst
}
