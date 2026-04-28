package common

import (
	"sync"
	"sync/atomic"
)

// channelConcurrency 存储每个渠道的当前并发计数
var channelConcurrency sync.Map // map[int]*atomic.Int64

// getOrCreateCounter 获取或创建渠道的并发计数器
func getOrCreateCounter(channelId int) *atomic.Int64 {
	if counter, ok := channelConcurrency.Load(channelId); ok {
		return counter.(*atomic.Int64)
	}
	newCounter := &atomic.Int64{}
	actual, _ := channelConcurrency.LoadOrStore(channelId, newCounter)
	return actual.(*atomic.Int64)
}

// ConcurrencyAcquire 尝试获取渠道的并发许可
// 如果当前并发数已达到 maxConcurrency，返回 false
// maxConcurrency <= 0 时不限制，直接返回 true
func ConcurrencyAcquire(channelId int, maxConcurrency int) bool {
	if maxConcurrency <= 0 {
		return true
	}
	counter := getOrCreateCounter(channelId)
	// 先加 1，再检查是否超限
	current := counter.Add(1)
	if current > int64(maxConcurrency) {
		// 超限，回退
		counter.Add(-1)
		return false
	}
	return true
}

// ConcurrencyRelease 释放渠道的并发许可
func ConcurrencyRelease(channelId int) {
	counter := getOrCreateCounter(channelId)
	// 防止降到负数
	for {
		current := counter.Load()
		if current <= 0 {
			return
		}
		if counter.CompareAndSwap(current, current-1) {
			return
		}
	}
}

// ConcurrencyGetCurrent 获取渠道的当前并发数
func ConcurrencyGetCurrent(channelId int) int64 {
	counter := getOrCreateCounter(channelId)
	return counter.Load()
}
