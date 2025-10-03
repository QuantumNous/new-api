package ionet

import (
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
)

func TestDecodeWithFlexibleTimesDeploymentDetail(t *testing.T) {
	payload := []byte(`{"data":{"created_at":"2025-10-03T06:46:25.316056","compute_minutes_served":15,"compute_minutes_remaining":45,"container_config":{"entrypoint":[],"env_variables":{},"traffic_port":0,"image_url":"example"}}}`)

	var resp struct {
		Data struct {
			CreatedAt               time.Time                 `json:"created_at"`
			ComputeMinutesServed    int                       `json:"compute_minutes_served"`
			ComputeMinutesRemaining int                       `json:"compute_minutes_remaining"`
			ContainerConfig         DeploymentContainerConfig `json:"container_config"`
		} `json:"data"`
	}

	err := decodeWithFlexibleTimes(payload, &resp)
	assert.NoError(t, err)

	expectedTime := time.Date(2025, 10, 3, 6, 46, 25, 316056000, time.UTC)
	assert.True(t, resp.Data.CreatedAt.Equal(expectedTime))
	assert.Equal(t, 15, resp.Data.ComputeMinutesServed)
	assert.Equal(t, 45, resp.Data.ComputeMinutesRemaining)
}

func TestDecodeWithFlexibleTimesNestedLogs(t *testing.T) {
	payload := []byte(`{"logs":[{"timestamp":"2025-10-03T06:46:25.316056","message":"started"},{"timestamp":"2025-10-03T06:47:00Z","message":"running"}]}`)

	var resp struct {
		Logs []struct {
			Timestamp time.Time `json:"timestamp"`
			Message   string    `json:"message"`
		} `json:"logs"`
	}

	err := decodeWithFlexibleTimes(payload, &resp)
	assert.NoError(t, err)

	firstExpected := time.Date(2025, 10, 3, 6, 46, 25, 316056000, time.UTC)
	secondExpected := time.Date(2025, 10, 3, 6, 47, 0, 0, time.UTC)
	assert.Len(t, resp.Logs, 2)
	assert.True(t, resp.Logs[0].Timestamp.Equal(firstExpected))
	assert.True(t, resp.Logs[1].Timestamp.Equal(secondExpected))
	assert.Equal(t, "started", resp.Logs[0].Message)
	assert.Equal(t, "running", resp.Logs[1].Message)
}
