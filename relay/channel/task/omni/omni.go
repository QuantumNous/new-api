package omni

import (
	"bytes"
	"fmt"
	"io"
	"math"
	"strconv"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/model"
	taskcommon "github.com/QuantumNous/new-api/relay/channel/task/taskcommon"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/gin-gonic/gin"
)

const (
	ModelGeminiOmniFlashPreview = "gemini-omni-flash-preview"
	GeminiAPIVersion            = "v1beta"
	VertexAPIVersion            = "v1beta1"
	APIRevision                 = "2026-05-20"
	MaxImages                   = 10
	MinDurationSeconds          = 3
	MaxDurationSeconds          = 10

	interactionTaskPrefix = "interactions/"
)

type inputPart struct {
	Type     string `json:"type"`
	Text     string `json:"text,omitempty"`
	MimeType string `json:"mime_type,omitempty"`
	Data     string `json:"data,omitempty"`
	URI      string `json:"uri,omitempty"`
}

type responseFormat struct {
	Type        string  `json:"type"`
	AspectRatio *string `json:"aspect_ratio,omitempty"`
}

type interactionRequest struct {
	Model                 string         `json:"model"`
	Input                 []inputPart    `json:"input"`
	ResponseFormat        responseFormat `json:"response_format"`
	PreviousInteractionID *string        `json:"previous_interaction_id,omitempty"`
	Background            bool           `json:"background"`
	Store                 bool           `json:"store"`
}

type interactionStep struct {
	Type     string      `json:"type"`
	Text     string      `json:"text,omitempty"`
	MimeType string      `json:"mime_type,omitempty"`
	Data     string      `json:"data,omitempty"`
	URI      string      `json:"uri,omitempty"`
	Content  []inputPart `json:"content"`
}

type interactionResponse struct {
	ID      string            `json:"id"`
	Model   string            `json:"model"`
	Status  string            `json:"status"`
	Steps   []interactionStep `json:"steps"`
	Outputs []interactionStep `json:"outputs"`
	Usage   struct {
		TotalTokens  int `json:"total_tokens"`
		OutputTokens int `json:"total_output_tokens"`
	} `json:"usage"`
	Error struct {
		Message string `json:"message"`
	} `json:"error"`
}

// IsModel reports whether modelName uses the Omni Interactions protocol.
func IsModel(modelName string) bool {
	return strings.TrimSpace(modelName) == ModelGeminiOmniFlashPreview
}

// IsInteractionTaskName reports whether a stored upstream task name is an interaction.
func IsInteractionTaskName(name string) bool {
	return strings.HasPrefix(strings.TrimSpace(name), interactionTaskPrefix)
}

// InteractionIDFromTaskName extracts and validates an interaction ID from task storage.
func InteractionIDFromTaskName(name string) (string, error) {
	id, ok := strings.CutPrefix(strings.TrimSpace(name), interactionTaskPrefix)
	if !ok || strings.TrimSpace(id) == "" || strings.Contains(id, "/") {
		return "", fmt.Errorf("invalid interaction task name")
	}
	return id, nil
}

// TaskName encodes an interaction ID into the provider-neutral task name format.
func TaskName(interactionID string) (string, error) {
	id := strings.TrimSpace(interactionID)
	if id == "" || strings.Contains(id, "/") {
		return "", fmt.Errorf("invalid interaction id")
	}
	return interactionTaskPrefix + id, nil
}

// ResolveDuration returns the requested Omni duration, defaulting to three seconds.
func ResolveDuration(req relaycommon.TaskSubmitReq) int {
	if req.Metadata != nil {
		for _, key := range []string{"duration_seconds", "durationSeconds"} {
			if raw, ok := req.Metadata[key]; ok {
				switch value := raw.(type) {
				case float64:
					if value == math.Trunc(value) && value <= float64(MaxDurationSeconds) {
						return int(value)
					}
					return -1
				case int:
					return value
				default:
					return -1
				}
			}
		}
	}
	if req.Duration > 0 {
		return req.Duration
	}
	if strings.TrimSpace(req.Seconds) != "" {
		seconds, err := strconv.Atoi(req.Seconds)
		if err != nil {
			return -1
		}
		return seconds
	}
	return MinDurationSeconds
}

// ResolveAspectRatio normalizes task metadata or dimensions to an Omni ratio.
func ResolveAspectRatio(req relaycommon.TaskSubmitReq) string {
	if req.Metadata != nil {
		for _, key := range []string{"aspect_ratio", "aspectRatio"} {
			if value, ok := req.Metadata[key].(string); ok && strings.TrimSpace(value) != "" {
				return strings.TrimSpace(value)
			}
		}
	}
	if strings.TrimSpace(req.Size) == "" {
		return "16:9"
	}
	parts := strings.SplitN(strings.ToLower(strings.TrimSpace(req.Size)), "x", 2)
	if len(parts) != 2 {
		return req.Size
	}
	width, widthErr := strconv.Atoi(parts[0])
	height, heightErr := strconv.Atoi(parts[1])
	if widthErr != nil || heightErr != nil || width <= 0 || height <= 0 {
		return req.Size
	}
	if width*9 == height*16 {
		return "16:9"
	}
	if width*16 == height*9 {
		return "9:16"
	}
	return req.Size
}

// ValidateRequest enforces Omni duration, aspect-ratio, and image-count limits.
func ValidateRequest(c *gin.Context, info *relaycommon.RelayInfo) error {
	req, err := relaycommon.GetTaskRequest(c)
	if err != nil {
		return err
	}
	duration := ResolveDuration(req)
	if duration < MinDurationSeconds || duration > MaxDurationSeconds {
		return fmt.Errorf("duration must be between %d and %d seconds for %s", MinDurationSeconds, MaxDurationSeconds, ModelGeminiOmniFlashPreview)
	}
	aspectRatio := ResolveAspectRatio(req)
	if aspectRatio != "16:9" && aspectRatio != "9:16" {
		return fmt.Errorf("aspect_ratio must be 16:9 or 9:16 for %s", ModelGeminiOmniFlashPreview)
	}
	imageCount := len(req.Images) + multipartImageCount(c)
	if imageCount > MaxImages {
		return fmt.Errorf("images must contain at most %d items for %s", MaxImages, ModelGeminiOmniFlashPreview)
	}
	if imageCount > 0 && info != nil {
		info.Action = constant.TaskActionGenerate
	}
	return nil
}

// BuildRequestBody maps a New API video task to a background Interactions request.
func BuildRequestBody(c *gin.Context, info *relaycommon.RelayInfo) (io.Reader, error) {
	req, err := relaycommon.GetTaskRequest(c)
	if err != nil {
		return nil, err
	}
	duration := ResolveDuration(req)
	prompt := strings.TrimSpace(req.Prompt)
	prompt += fmt.Sprintf("\n\nGenerate exactly a %d-second video.", duration)

	parts := []inputPart{{Type: "text", Text: prompt}}
	images, err := collectImageParts(c, req.Images)
	if err != nil {
		return nil, err
	}
	parts = append(parts, images...)
	if len(images) > 0 && info != nil {
		info.Action = constant.TaskActionGenerate
	}

	var previousInteractionID *string
	if req.Metadata != nil {
		if value, ok := req.Metadata["previous_interaction_id"].(string); ok {
			value = strings.TrimSpace(value)
			if value != "" {
				previousInteractionID = &value
			}
		}
	}
	aspectRatio := ResolveAspectRatio(req)
	body := interactionRequest{
		Model:                 info.UpstreamModelName,
		Input:                 parts,
		ResponseFormat:        responseFormat{Type: "video", AspectRatio: &aspectRatio},
		PreviousInteractionID: previousInteractionID,
		Background:            true,
		Store:                 true,
	}
	data, err := common.Marshal(body)
	if err != nil {
		return nil, err
	}
	return bytes.NewReader(data), nil
}

// ParseSubmitResponse validates an interaction submission and returns its task name.
func ParseSubmitResponse(body []byte) (string, error) {
	var interaction interactionResponse
	if err := common.Unmarshal(body, &interaction); err != nil {
		return "", fmt.Errorf("unmarshal interaction response failed: %w", err)
	}
	if interaction.Error.Message != "" {
		return "", fmt.Errorf("interaction request failed: %s", interaction.Error.Message)
	}
	return TaskName(interaction.ID)
}

// IsInteractionResponse distinguishes Interactions payloads from Veo operations.
func IsInteractionResponse(body []byte) bool {
	var interaction struct {
		ID     string `json:"id"`
		Status string `json:"status"`
	}
	if err := common.Unmarshal(body, &interaction); err != nil {
		return false
	}
	return strings.TrimSpace(interaction.ID) != "" || strings.TrimSpace(interaction.Status) != ""
}

// ParseTaskResult maps an Interactions lifecycle response to New API task state.
func ParseTaskResult(body []byte) (*relaycommon.TaskInfo, error) {
	var interaction interactionResponse
	if err := common.Unmarshal(body, &interaction); err != nil {
		return nil, fmt.Errorf("unmarshal interaction response failed: %w", err)
	}
	result := &relaycommon.TaskInfo{}
	if interaction.Error.Message != "" {
		result.Status = model.TaskStatusFailure
		result.Progress = taskcommon.ProgressComplete
		result.Reason = interaction.Error.Message
		return result, nil
	}

	switch strings.ToLower(strings.TrimSpace(interaction.Status)) {
	case "queued":
		result.Status = model.TaskStatusQueued
		result.Progress = taskcommon.ProgressQueued
		return result, nil
	case "in_progress", "requires_action":
		result.Status = model.TaskStatusInProgress
		result.Progress = taskcommon.ProgressInProgress
		return result, nil
	case "failed", "cancelled", "incomplete", "budget_exceeded":
		result.Status = model.TaskStatusFailure
		result.Progress = taskcommon.ProgressComplete
		result.Reason = strings.TrimSpace(interaction.Error.Message)
		if result.Reason == "" {
			result.Reason = "interaction ended with status " + interaction.Status
		}
		return result, nil
	case "completed":
		for _, steps := range [][]interactionStep{interaction.Steps, interaction.Outputs} {
			for _, step := range steps {
				if step.Type != "model_output" {
					if partURL := videoPartURL(inputPart{Type: step.Type, MimeType: step.MimeType, Data: step.Data, URI: step.URI}); partURL != "" {
						setCompletedResult(result, partURL, interaction)
						return result, nil
					}
					continue
				}
				for _, part := range step.Content {
					if partURL := videoPartURL(part); partURL != "" {
						setCompletedResult(result, partURL, interaction)
						return result, nil
					}
				}
			}
		}
		result.Status = model.TaskStatusFailure
		result.Progress = taskcommon.ProgressComplete
		result.Reason = "completed interaction did not contain video output"
		return result, nil
	default:
		result.Status = model.TaskStatusInProgress
		result.Progress = taskcommon.ProgressInProgress
		return result, nil
	}
}

func videoPartURL(part inputPart) string {
	if part.Type != "video" && !strings.HasPrefix(part.MimeType, "video/") {
		return ""
	}
	if strings.TrimSpace(part.Data) != "" {
		mimeType := strings.TrimSpace(part.MimeType)
		if mimeType == "" {
			mimeType = "video/mp4"
		}
		return "data:" + mimeType + ";base64," + part.Data
	}
	if strings.HasPrefix(part.URI, "http://") || strings.HasPrefix(part.URI, "https://") {
		return part.URI
	}
	return ""
}

func setCompletedResult(result *relaycommon.TaskInfo, videoURL string, interaction interactionResponse) {
	result.Url = videoURL
	result.Status = model.TaskStatusSuccess
	result.Progress = taskcommon.ProgressComplete
	result.CompletionTokens = interaction.Usage.OutputTokens
	result.TotalTokens = interaction.Usage.TotalTokens
}
