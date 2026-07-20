package controller

import (
	"errors"
	"net/http"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/types"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestTaskRelayAPIErrorPreservesUpstream429Provenance(t *testing.T) {
	model.ClearChannelCooldownsForTest()
	t.Cleanup(model.ClearChannelCooldownsForTest)

	taskErr := &dto.TaskError{
		StatusCode: http.StatusTooManyRequests,
		Error:      errors.New("upstream task rate limited"),
	}
	apiErr := taskRelayAPIError(taskErr)
	require.NotNil(t, apiErr)
	assert.Equal(t, http.StatusTooManyRequests, apiErr.StatusCode)
	assert.Equal(t, http.StatusTooManyRequests, apiErr.UpstreamStatusCode)
	assert.True(t, service.IsUpstreamRateLimitError(apiErr))

	processChannelError(
		newTestContext(),
		*types.NewChannelError(9010, 1, "task-rate-limited", false, "key", false),
		apiErr,
	)
	reason, expires, cooling := model.GetChannelCooldown(9010)
	require.True(t, cooling)
	assert.Contains(t, reason, "upstream_rate_limit")
	remaining := time.Until(time.Unix(expires, 0))
	assert.Greater(t, remaining, 119*time.Minute)
	assert.Less(t, remaining, 121*time.Minute)
}

func TestTaskRelayAPIErrorLeavesLocal429Unattributed(t *testing.T) {
	localErr := &dto.TaskError{
		StatusCode: http.StatusTooManyRequests,
		LocalError: true,
		Error:      errors.New("local task rate limit"),
	}

	assert.Nil(t, taskRelayAPIError(nil))
	assert.Nil(t, taskRelayAPIError(localErr))
	assert.True(t, shouldRetryTaskRelay(newTestContext(), 1, localErr, 1), "preserve the existing task retry behavior for local 429")
	assert.False(t, shouldRetryTaskRelay(newTestContext(), 1, localErr, 0))

	pinned := newTestContext()
	pinned.Set("specific_channel_id", 1)
	assert.False(t, shouldRetryTaskRelay(pinned, 1, localErr, 1))
}
