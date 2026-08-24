package model

import (
	"testing"

	"github.com/QuantumNous/new-api/dto"
	"github.com/stretchr/testify/require"
)

func TestTaskToOpenAIVideoReturnsStructuredPreparationFailureWithoutResultURL(t *testing.T) {
	task := Task{
		TaskID:     "task_failed_assets",
		Status:     TaskStatusFailure,
		FailReason: "raw https://signed.example/private?token=secret",
		PrivateData: TaskPrivateData{
			ErrorCode:    "asset_channel_unavailable",
			ErrorMessage: "asset channel unavailable",
		},
	}

	video := task.ToOpenAIVideo()

	require.Equal(t, dto.VideoStatusFailed, video.Status)
	require.Equal(t, &dto.OpenAIVideoError{
		Code:    "asset_channel_unavailable",
		Message: "asset channel unavailable",
	}, video.Error)
	_, hasURL := video.Metadata["url"]
	require.False(t, hasURL)
}

func TestTaskToOpenAIVideoUsesSafeGenericErrorForLegacyFailure(t *testing.T) {
	task := Task{
		TaskID:     "task_legacy_failed",
		Status:     TaskStatusFailure,
		FailReason: "raw https://signed.example/private?token=secret",
	}

	video := task.ToOpenAIVideo()

	require.Equal(t, &dto.OpenAIVideoError{
		Code:    "task_failed",
		Message: "Task failed",
	}, video.Error)
	require.NotContains(t, video.Error.Message, "secret")
	_, hasURL := video.Metadata["url"]
	require.False(t, hasURL)
}
