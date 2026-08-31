package service

import (
	"testing"

	"github.com/stretchr/testify/require"
)

func TestRetryParam_AddExcludedChannel(t *testing.T) {
	param := &RetryParam{}

	param.AddExcludedChannel(10)
	param.AddExcludedChannel(20)
	param.AddExcludedChannel(10) // duplicate, should be ignored
	param.AddExcludedChannel(0)  // invalid, should be ignored
	param.AddExcludedChannel(-1) // invalid, should be ignored

	require.Equal(t, []int{10, 20}, param.ExcludedChannelIDs)
}
