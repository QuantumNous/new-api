package common

import (
	"sync"
	"time"
)

type InMemoryRateLimiter struct {
	store              map[string]*[]rateLimitEntry
	mutex              sync.Mutex
	expirationDuration time.Duration
}

type rateLimitEntry struct {
	timestamp     int64
	reservationID string
}

func (l *InMemoryRateLimiter) Init(expirationDuration time.Duration) {
	l.mutex.Lock()
	defer l.mutex.Unlock()
	if l.store != nil {
		return
	}
	l.store = make(map[string]*[]rateLimitEntry)
	l.expirationDuration = expirationDuration
	if expirationDuration > 0 {
		go l.clearExpiredItems()
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
			if size == 0 || now-(*queue)[size-1].timestamp > int64(l.expirationDuration.Seconds()) {
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
	return l.requestLocked(key, maxRequestNum, duration, "")
}

// Reserve atomically records a provisional request. The caller must later
// commit or release the reservation.
func (l *InMemoryRateLimiter) Reserve(key string, maxRequestNum int, duration int64, reservationID string) bool {
	l.mutex.Lock()
	defer l.mutex.Unlock()
	return l.requestLocked(key, maxRequestNum, duration, reservationID)
}

func (l *InMemoryRateLimiter) requestLocked(key string, maxRequestNum int, duration int64, reservationID string) bool {
	if maxRequestNum <= 0 {
		return true
	}
	// [old <-- new]
	queue, ok := l.store[key]
	now := time.Now().Unix()
	entry := rateLimitEntry{timestamp: now, reservationID: reservationID}
	if ok {
		if len(*queue) < maxRequestNum {
			*queue = append(*queue, entry)
			return true
		} else {
			if now-(*queue)[0].timestamp >= duration {
				*queue = (*queue)[1:]
				*queue = append(*queue, entry)
				return true
			} else {
				return false
			}
		}
	} else {
		s := make([]rateLimitEntry, 0, maxRequestNum)
		l.store[key] = &s
		*(l.store[key]) = append(*(l.store[key]), entry)
	}
	return true
}

// CommitReservation finalizes a provisional request while preserving the
// admission timestamp used by the sliding window.
func (l *InMemoryRateLimiter) CommitReservation(key string, reservationID string) bool {
	l.mutex.Lock()
	defer l.mutex.Unlock()
	queue, ok := l.store[key]
	if !ok {
		return false
	}
	for i := range *queue {
		if (*queue)[i].reservationID == reservationID {
			(*queue)[i].reservationID = ""
			return true
		}
	}
	return false
}

// ReleaseReservation removes a provisional request that did not succeed.
func (l *InMemoryRateLimiter) ReleaseReservation(key string, reservationID string) bool {
	l.mutex.Lock()
	defer l.mutex.Unlock()
	queue, ok := l.store[key]
	if !ok {
		return false
	}
	for i := range *queue {
		if (*queue)[i].reservationID == reservationID {
			*queue = append((*queue)[:i], (*queue)[i+1:]...)
			if len(*queue) == 0 {
				delete(l.store, key)
			}
			return true
		}
	}
	return false
}

// Check reports whether a request would be allowed without recording it.
// The duration parameter's unit is seconds.
func (l *InMemoryRateLimiter) Check(key string, maxRequestNum int, duration int64) bool {
	l.mutex.Lock()
	defer l.mutex.Unlock()
	if maxRequestNum <= 0 {
		return true
	}
	queue, ok := l.store[key]
	if !ok || len(*queue) < maxRequestNum {
		return true
	}
	now := time.Now().Unix()
	return now-(*queue)[0].timestamp >= duration
}
