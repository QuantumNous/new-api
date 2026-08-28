package service

import (
	"testing"
)

func TestRetryParam_AddExcludedChannel(t *testing.T) {
	param := &RetryParam{}

	param.AddExcludedChannel(10)
	param.AddExcludedChannel(20)
	param.AddExcludedChannel(10) // duplicate, should be ignored
	param.AddExcludedChannel(0)  // invalid, should be ignored
	param.AddExcludedChannel(-1) // invalid, should be ignored

	if len(param.ExcludedChannelIDs) != 2 {
		t.Fatalf("expected 2 excluded channels, got %d (%v)", len(param.ExcludedChannelIDs), param.ExcludedChannelIDs)
	}

	if param.ExcludedChannelIDs[0] != 10 || param.ExcludedChannelIDs[1] != 20 {
		t.Fatalf("expected [10, 20], got %v", param.ExcludedChannelIDs)
	}
}
