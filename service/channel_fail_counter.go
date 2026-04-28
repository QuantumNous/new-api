package service

import (
	"fmt"
	"sync"
)

var channelFailCounts sync.Map // key: "channelId:usingKey" -> *int64 protected by channelFailMu

var channelFailMu sync.Mutex

func channelFailKey(channelId int, usingKey string) string {
	return fmt.Sprintf("%d:%s", channelId, usingKey)
}

// IncrementChannelFailCount increases the consecutive-failure counter for the
// given channel + key combination and returns the new count.
func IncrementChannelFailCount(channelId int, usingKey string) int {
	channelFailMu.Lock()
	defer channelFailMu.Unlock()

	k := channelFailKey(channelId, usingKey)
	count := 0
	if v, ok := channelFailCounts.Load(k); ok {
		count = v.(int)
	}
	count++
	channelFailCounts.Store(k, count)
	return count
}

// ResetChannelFailCount clears the counter for the given channel + key.
func ResetChannelFailCount(channelId int, usingKey string) {
	channelFailCounts.Delete(channelFailKey(channelId, usingKey))
}
