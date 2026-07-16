package service

import (
	"testing"

	"github.com/QuantumNous/new-api/model"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func newChannelRetryTestContext(t *testing.T) *gin.Context {
	t.Helper()
	gin.SetMode(gin.TestMode)
	c, _ := gin.CreateTestContext(nil)
	require.NotNil(t, c)
	return c
}

func TestChannelRetryKeepsChannelUntilAttemptsAreExhausted(t *testing.T) {
	c := newChannelRetryTestContext(t)
	maxAttempts := 3
	channel := &model.Channel{Id: 14, RetryAttempts: &maxAttempts}

	InitializeChannelRetry(c, channel)

	assert.True(t, RecordChannelFailure(c, channel.Id))
	assert.True(t, RecordChannelFailure(c, channel.Id))
	assert.False(t, RecordChannelFailure(c, channel.Id))
	assert.Zero(t, GetLockedRetryChannelID(c))
	_, excluded := GetExcludedRetryChannelIDs(c)[channel.Id]
	assert.True(t, excluded)
}

func TestChannelRetryDefaultsToOneAttempt(t *testing.T) {
	c := newChannelRetryTestContext(t)
	channel := &model.Channel{Id: 9}

	InitializeChannelRetry(c, channel)

	assert.False(t, RecordChannelFailure(c, channel.Id))
	_, excluded := GetExcludedRetryChannelIDs(c)[channel.Id]
	assert.True(t, excluded)
}

func TestChannelRetryStartsFreshForNewChannel(t *testing.T) {
	c := newChannelRetryTestContext(t)
	firstAttempts := 2
	secondAttempts := 3
	first := &model.Channel{Id: 1, RetryAttempts: &firstAttempts}
	second := &model.Channel{Id: 2, RetryAttempts: &secondAttempts}

	InitializeChannelRetry(c, first)
	require.True(t, RecordChannelFailure(c, first.Id))
	InitializeChannelRetry(c, second)

	assert.Equal(t, second.Id, GetLockedRetryChannelID(c))
	assert.True(t, RecordChannelFailure(c, second.Id))
	assert.True(t, RecordChannelFailure(c, second.Id))
}
