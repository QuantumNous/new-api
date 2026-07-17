package image_stream

import (
	"encoding/json"
	"strings"

	"github.com/QuantumNous/new-api/model"
)

const imageTaskObject = "image.generation.task"

type ImageTaskError struct {
	Message string `json:"message"`
	Code    string `json:"code"`
}

type ImageTaskResponse struct {
	TaskID      string           `json:"task_id"`
	Object      string           `json:"object"`
	Status      string           `json:"status"`
	Progress    string           `json:"progress"`
	CreatedAt   int64            `json:"created_at"`
	CompletedAt int64            `json:"completed_at,omitempty"`
	Result      *json.RawMessage `json:"result,omitempty"`
	Error       *ImageTaskError  `json:"error,omitempty"`
}

func BuildImageTaskResponse(task *model.Task) *ImageTaskResponse {
	if task == nil {
		return nil
	}
	return imageTaskResponse(
		task.TaskID,
		string(task.Status),
		task.Progress,
		task.SubmitTime,
		task.FinishTime,
		task.Data,
		task.FailReason,
	)
}

func imageTaskResponse(taskID, status, progress string, createdAt, completedAt int64, result []byte, failReason string) *ImageTaskResponse {
	response := &ImageTaskResponse{
		TaskID:      taskID,
		Object:      imageTaskObject,
		Status:      imageTaskStatus(status),
		CreatedAt:   createdAt,
		CompletedAt: completedAt,
	}

	switch response.Status {
	case "completed":
		response.Progress = "100%"
		if len(result) > 0 {
			raw := json.RawMessage(append([]byte(nil), result...))
			response.Result = &raw
		}
	case "failed":
		response.Progress = "100%"
		response.Error = &ImageTaskError{
			Message: failReason,
			Code:    "image_generation_failed",
		}
	case "in_progress":
		if progress != "" {
			response.Progress = progress
		} else if strings.EqualFold(status, string(model.TaskStatusFinalizing)) {
			response.Progress = "99%"
		} else {
			response.Progress = "10%"
		}
	default:
		if progress != "" {
			response.Progress = progress
		} else {
			response.Progress = "0%"
		}
	}

	return response
}

func imageTaskStatus(status string) string {
	switch strings.ToUpper(status) {
	case string(model.TaskStatusSuccess):
		return "completed"
	case string(model.TaskStatusFailure):
		return "failed"
	case string(model.TaskStatusInProgress), string(model.TaskStatusFinalizing):
		return "in_progress"
	default:
		return "queued"
	}
}
