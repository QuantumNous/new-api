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
		Prompt:   "宇航员站起身走了",
		Seconds:  "12",
		Size:     "720x1280",
		Duration: 12,
	}
	data := BuildVideoRequestDataForLog(req)
	require.Equal(t, "sora-2", data["model"])
	require.Equal(t, "宇航员站起身走了", data["prompt"])
	require.Equal(t, "12", data["seconds"])
	require.Equal(t, 12, data["duration"])
	require.Equal(t, "720x1280", data["size"])
}
