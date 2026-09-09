package common

import (
	"sync"
	"time"
)

type InMemoryRateLimiter struct {
	store              map[string]*[]int64
	reservations       map[string]map[uint64]struct{}
	mutex              sync.Mutex
	expirationDuration time.Duration
	nextReservationID  uint64
}

func (l *InMemoryRateLimiter) Init(expirationDuration time.Duration) {
	l.mutex.Lock()
	if l.store != nil && l.reservations != nil {
		l.mutex.Unlock()
		return
	}
	startCleanup := false
	if l.store == nil {
		l.store = make(map[string]*[]int64)
		l.expirationDuration = expirationDuration
		startCleanup = expirationDuration > 0
	}
	if l.reservations == nil {
		l.reservations = make(map[string]map[uint64]struct{})
	}
	l.mutex.Unlock()
	if startCleanup {
		go l.clearExpiredItems()
	}
}

func (l *InMemoryRateLimiter) clearExpiredItems() {
	duration := l.expirationDuration
	if duration <= 0 {
		return
	}
	for {
		time.Sleep(duration)
		l.mutex.Lock()
		now := time.Now().Unix()
		for key := range l.store {
			queue := l.store[key]
			if queue == nil {
				delete(l.store, key)
				continue
			}
			size := len(*queue)
			if (size == 0 || now-(*queue)[size-1] > int64(duration.Seconds())) &&
				len(l.reservations[key]) == 0 {
				delete(l.store, key)
			}
		}
		l.mutex.Unlock()
	}
}

// Request parameter duration's unit is seconds
func (l *InMemoryRateLimiter) Request(key string, maxRequestNum int, duration int64) bool {
	if maxRequestNum <= 0 {
		return true
	}

	l.mutex.Lock()
	defer l.mutex.Unlock()
	l.ensureInitializedLocked()
	// [old <-- new]
	queue, ok := l.store[key]
	now := time.Now().Unix()
	if ok {
		if len(*queue) < maxRequestNum {
			*queue = append(*queue, now)
			return true
		} else {
			if now-(*queue)[0] >= duration {
				*queue = (*queue)[1:]
				*queue = append(*queue, now)
				return true
			} else {
				return false
			}
		}
	} else {
		s := make([]int64, 0, maxRequestNum)
		l.store[key] = &s
		*(l.store[key]) = append(*(l.store[key]), now)
	}
	return true
}

// Reserve atomically reserves one success-rate slot for an in-flight request.
// The reservation is counted together with completed successes until Commit or
// Release is called. A zero reservation ID means the limit is unlimited.
func (l *InMemoryRateLimiter) Reserve(key string, maxRequestNum int, duration int64) (uint64, bool) {
	if maxRequestNum <= 0 {
		return 0, true
	}

	l.mutex.Lock()
	defer l.mutex.Unlock()
	l.ensureInitializedLocked()

	now := time.Now().Unix()
	l.pruneExpiredQueueLocked(key, now, duration)
	queueLength := 0
	if queue := l.store[key]; queue != nil {
		queueLength = len(*queue)
	}
	if queueLength+len(l.reservations[key]) >= maxRequestNum {
		return 0, false
	}

	l.nextReservationID++
	if l.nextReservationID == 0 {
		l.nextReservationID++
	}
	if l.reservations[key] == nil {
		l.reservations[key] = make(map[uint64]struct{})
	}
	reservationID := l.nextReservationID
	l.reservations[key][reservationID] = struct{}{}
	return reservationID, true
}

// Commit converts a reservation into a completed success entry.
func (l *InMemoryRateLimiter) Commit(key string, reservationID uint64, duration int64) bool {
	if reservationID == 0 {
		return true
	}

	l.mutex.Lock()
	defer l.mutex.Unlock()
	l.ensureInitializedLocked()

	pending := l.reservations[key]
	if _, ok := pending[reservationID]; !ok {
		return false
	}
	delete(pending, reservationID)
	if len(pending) == 0 {
		delete(l.reservations, key)
	}

	now := time.Now().Unix()
	l.pruneExpiredQueueLocked(key, now, duration)
	queue := l.store[key]
	if queue == nil {
		entries := make([]int64, 0, 1)
		l.store[key] = &entries
		queue = &entries
	}
	*queue = append(*queue, now)
	return true
}

// Release returns a reservation without recording a successful request.
func (l *InMemoryRateLimiter) Release(key string, reservationID uint64) bool {
	if reservationID == 0 {
		return true
	}

	l.mutex.Lock()
	defer l.mutex.Unlock()
	if l.reservations == nil {
		return false
	}
	pending := l.reservations[key]
	if _, ok := pending[reservationID]; !ok {
		return false
	}
	delete(pending, reservationID)
	if len(pending) == 0 {
		delete(l.reservations, key)
	}
	return true
}

func (l *InMemoryRateLimiter) ensureInitializedLocked() {
	if l.store == nil {
		l.store = make(map[string]*[]int64)
	}
	if l.reservations == nil {
		l.reservations = make(map[string]map[uint64]struct{})
	}
}

func (l *InMemoryRateLimiter) pruneExpiredQueueLocked(key string, now, duration int64) {
	if duration < 0 {
		return
	}
	queue := l.store[key]
	if queue == nil {
		return
	}
	first := 0
	for first < len(*queue) && now-(*queue)[first] >= duration {
		first++
	}
	if first > 0 {
		*queue = (*queue)[first:]
	}
	if len(*queue) == 0 && len(l.reservations[key]) == 0 {
		delete(l.store, key)
	}
}
