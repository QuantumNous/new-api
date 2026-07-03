package model

import (
	"fmt"
	"testing"
	"time"
)

func TestLogChannelCacheMissLockedBoundsTrackedKeys(t *testing.T) {
	previousMissLog := channelCacheMissLastLogged
	previousCache := group2model2channels
	t.Cleanup(func() {
		channelCacheMissLastLogged = previousMissLog
		group2model2channels = previousCache
	})

	now := time.Now()
	channelCacheMissLastLogged = make(map[string]time.Time, channelCacheMissLogMaxKeys)
	group2model2channels = map[string]map[string][]int{}
	for i := 0; i < channelCacheMissLogMaxKeys; i++ {
		channelCacheMissLastLogged[fmt.Sprintf("group\x00recent-%d", i)] = now
	}

	logChannelCacheMissLocked("group", "overflow", 0)
	if _, ok := channelCacheMissLastLogged["group\x00overflow"]; ok {
		t.Fatal("expected overflow cache miss key to be dropped when the limiter is full")
	}
	if got := len(channelCacheMissLastLogged); got != channelCacheMissLogMaxKeys {
		t.Fatalf("expected bounded miss log cache to remain at %d keys, got %d", channelCacheMissLogMaxKeys, got)
	}

	channelCacheMissLastLogged["group\x00recent-0"] = now.Add(-channelCacheMissLogInterval)
	logChannelCacheMissLocked("group", "after-expiry", 0)
	if _, ok := channelCacheMissLastLogged["group\x00after-expiry"]; !ok {
		t.Fatal("expected new cache miss key to be recorded after expired keys are pruned")
	}
	if _, ok := channelCacheMissLastLogged["group\x00recent-0"]; ok {
		t.Fatal("expected expired cache miss key to be pruned")
	}
}
