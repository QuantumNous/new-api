package service

import (
	"testing"

	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/stretchr/testify/require"
)

func TestBuildVideoRequestDataForLog(t *testing.T) {
	t.Parallel()

	req := &relaycommon.TaskSubmitReq{
		Model:    "sora-2",
		Prompt:   "美丽的笑容",
		Seconds:  "4",
		Size:     "1280x720",
		Duration: 4,
	}
	data := BuildVideoRequestDataForLog(req)
	require.Equal(t, "sora-2", data["model"])
	require.Equal(t, "美丽的笑容", data["prompt"])
	require.Equal(t, 4, data["duration"])
	require.Equal(t, 1, data["actual_image_count"])
	require.Equal(t, "16:9", data["aspect_ratio"])
	require.Equal(t, "720p", data["resolution"])
	require.Equal(t, "720P", data["effective_resolution"])
	require.NotContains(t, data, "seconds")
	require.NotContains(t, data, "size")
}

func TestEnrichVideoRequestDataFromStoredPayload(t *testing.T) {
	t.Parallel()

	data := EnrichVideoRequestData(map[string]interface{}{
		"model":   "sora-2",
		"prompt":  "美丽的笑容",
		"seconds": "4",
		"size":    "1280x720",
	})
	require.Equal(t, 4, data["duration"])
	require.Equal(t, "16:9", data["aspect_ratio"])
	require.Equal(t, "720p", data["resolution"])
	require.Equal(t, "720P", data["effective_resolution"])
	require.NotContains(t, data, "seconds")
	require.NotContains(t, data, "size")
}

func TestVideoResolutionFromSizeRatio(t *testing.T) {
	t.Parallel()

	require.Equal(t, "720p", videoResolutionFromSizeRatio(1.0))
	require.Equal(t, "1024p", videoResolutionFromSizeRatio(1.666667))
	require.Equal(t, "1080p", videoResolutionFromSizeRatio(2.333333))
}
