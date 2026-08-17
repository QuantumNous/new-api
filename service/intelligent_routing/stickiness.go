package intelligent_routing

import (
	"crypto/sha256"
	"fmt"
	"sync"
	"time"
)

const stickinessTTL = 30 * time.Minute

type StickyRoute struct {
	Model     string
	ChannelID int
}

type stickyEntry struct {
	route              StickyRoute
	task               TaskType
	expiresAt          time.Time
	validationFailures int
}

func (store *StickinessStore) RecordValidationFailure(key string) {
	if key == "" {
		return
	}
	store.mu.Lock()
	defer store.mu.Unlock()
	entry, ok := store.entries[key]
	if !ok {
		return
	}
	entry.validationFailures++
	if entry.validationFailures >= 2 {
		delete(store.entries, key)
		return
	}
	store.entries[key] = entry
}

type StickinessStore struct {
	mu      sync.Mutex
	entries map[string]stickyEntry
}

var DefaultStickinessStore StickinessStore

func (store *StickinessStore) RecordAt(key string, task TaskType, route StickyRoute, now time.Time) {
	if key == "" || route.Model == "" || route.ChannelID == 0 {
		return
	}
	store.mu.Lock()
	defer store.mu.Unlock()
	if store.entries == nil {
		store.entries = make(map[string]stickyEntry)
	}
	store.entries[key] = stickyEntry{route: route, task: task, expiresAt: now.Add(stickinessTTL)}
}

func (store *StickinessStore) Record(key string, task TaskType, route StickyRoute) {
	store.RecordAt(key, task, route, time.Now())
}

func (store *StickinessStore) GetAt(key string, task TaskType, now time.Time) (StickyRoute, bool) {
	if key == "" {
		return StickyRoute{}, false
	}
	store.mu.Lock()
	defer store.mu.Unlock()
	entry, ok := store.entries[key]
	if !ok || entry.task != task || !now.Before(entry.expiresAt) {
		if ok && !now.Before(entry.expiresAt) {
			delete(store.entries, key)
		}
		return StickyRoute{}, false
	}
	return entry.route, true
}

func (store *StickinessStore) Get(key string, task TaskType) (StickyRoute, bool) {
	return store.GetAt(key, task, time.Now())
}

func ConversationKey(account, explicitSession, firstMessage string) string {
	seed := firstMessage
	if explicitSession != "" {
		seed = explicitSession
	}
	if account == "" || seed == "" {
		return ""
	}
	return fmt.Sprintf("%x", sha256.Sum256([]byte(account+"\x00"+seed)))
}
