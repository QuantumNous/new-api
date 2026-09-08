package common

import (
	"sync"
	"time"
)

type InMemoryRateLimiter struct {
	store              map[string]*[]*int64
	mutex              sync.Mutex
	expirationDuration time.Duration
}

func (l *InMemoryRateLimiter) Init(expirationDuration time.Duration) {
	l.mutex.Lock()
	defer l.mutex.Unlock()
	if l.store == nil {
		l.store = make(map[string]*[]*int64)
		l.expirationDuration = expirationDuration
		if expirationDuration > 0 {
			go l.clearExpiredItems()
		}
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
			if size == 0 || now-*(*queue)[size-1] > int64(l.expirationDuration.Seconds()) {
				delete(l.store, key)
			}
		}
		l.mutex.Unlock()
	}
}

// Request parameter duration's unit is seconds
func (l *InMemoryRateLimiter) Request(key string, maxRequestNum int, duration int64) bool {
	l.mutex.Lock()
	defer l.mutex.Unlock()
	_, allowed := l.request(key, maxRequestNum, duration)
	return allowed
}

// request reserves a timestamp while the caller holds mutex. Pointer identity
// lets a failed call release only its own entry, including after window expiry.
func (l *InMemoryRateLimiter) request(key string, maxRequestNum int, duration int64) (*int64, bool) {
	if maxRequestNum <= 0 {
		return nil, true
	}
	// [old <-- new]
	queue, ok := l.store[key]
	now := time.Now().Unix()
	if ok {
		if len(*queue) < maxRequestNum {
			*queue = append(*queue, &now)
			return &now, true
		} else {
			if now-*(*queue)[0] >= duration {
				*queue = (*queue)[1:]
				*queue = append(*queue, &now)
				return &now, true
			} else {
				return nil, false
			}
		}
	} else {
		s := make([]*int64, 0, maxRequestNum)
		l.store[key] = &s
		*(l.store[key]) = append(*(l.store[key]), &now)
	}
	return &now, true
}

// Reserve atomically admits a call and returns an idempotent completion callback.
// Success retains the admission timestamp; failure releases the reserved slot.
func (l *InMemoryRateLimiter) Reserve(key string, maxRequestNum int, duration int64) (func(bool), bool) {
	l.mutex.Lock()
	entry, allowed := l.request(key, maxRequestNum, duration)
	l.mutex.Unlock()
	if !allowed {
		return nil, false
	}
	var once sync.Once
	return func(success bool) {
		once.Do(func() {
			if success || entry == nil {
				return
			}
			l.mutex.Lock()
			defer l.mutex.Unlock()
			if queue, ok := l.store[key]; ok {
				for i, candidate := range *queue {
					if candidate == entry {
						*queue = append((*queue)[:i], (*queue)[i+1:]...)
						if len(*queue) == 0 {
							delete(l.store, key)
						}
						return
					}
				}
			}
		})
	}, true
}

// Check reports whether a request would be allowed without recording it.
// The duration parameter's unit is seconds.
func (l *InMemoryRateLimiter) Check(key string, maxRequestNum int, duration int64) bool {
	l.mutex.Lock()
	defer l.mutex.Unlock()
	if maxRequestNum == 0 {
		return true
	}
	queue, ok := l.store[key]
	if !ok || len(*queue) < maxRequestNum {
		return true
	}
	now := time.Now().Unix()
	return now-*(*queue)[0] >= duration
}
