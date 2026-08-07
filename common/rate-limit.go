package common

import (
	"sync"
	"time"
)

type InMemoryRateLimiter struct {
	store              map[string]*[]int64
	mutex              sync.Mutex
	expirationDuration time.Duration
}

func (l *InMemoryRateLimiter) Init(expirationDuration time.Duration) {
	if l.store == nil {
		l.mutex.Lock()
		if l.store == nil {
			l.store = make(map[string]*[]int64)
			l.expirationDuration = expirationDuration
			if expirationDuration > 0 {
				go l.clearExpiredItems()
			}
		}
		l.mutex.Unlock()
	}
}

func (l *InMemoryRateLimiter) clearExpiredItems() {
	for {
		time.Sleep(l.expirationDuration)
		l.mutex.Lock()
		now := time.Now().Unix()
		for key := range l.store {
			queue := l.store[key]
			size := len(*queue)
			if size == 0 || now-(*queue)[size-1] > int64(l.expirationDuration.Seconds()) {
				delete(l.store, key)
			}
		}
		l.mutex.Unlock()
	}
}

// RequestWithRetryAfter parameter duration's unit is seconds. The returned
// retry-after value is the remaining time until the oldest request leaves the
// fixed window; it is always at least one second when the request is denied.
func (l *InMemoryRateLimiter) RequestWithRetryAfter(key string, maxRequestNum int, duration int64) (bool, int64) {
	l.mutex.Lock()
	defer l.mutex.Unlock()
	if maxRequestNum <= 0 {
		return false, 1
	}
	if duration < 1 {
		duration = 1
	}
	// [old <-- new]
	queue, ok := l.store[key]
	now := time.Now().Unix()
	if ok {
		if len(*queue) < maxRequestNum {
			*queue = append(*queue, now)
			return true, 0
		} else {
			if now-(*queue)[0] >= duration {
				*queue = (*queue)[1:]
				*queue = append(*queue, now)
				return true, 0
			} else {
				retryAfter := duration - (now - (*queue)[0])
				if retryAfter < 1 {
					retryAfter = 1
				}
				return false, retryAfter
			}
		}
	} else {
		s := make([]int64, 0, maxRequestNum)
		l.store[key] = &s
		*(l.store[key]) = append(*(l.store[key]), now)
	}
	return true, 0
}

// Request preserves the original allow/deny API for callers that do not need
// the remaining window.
func (l *InMemoryRateLimiter) Request(key string, maxRequestNum int, duration int64) bool {
	allowed, _ := l.RequestWithRetryAfter(key, maxRequestNum, duration)
	return allowed
}
