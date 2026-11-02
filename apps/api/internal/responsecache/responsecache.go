// Package responsecache provides an opt-in, single-node in-memory cache for
// model responses. It stores the serialized JSON response body of a relayed
// request keyed by a normalized request fingerprint. Cache hits replay the
// stored body and settle the same billing the originating miss settled.
//
// The cache is deliberately conservative: only requests whose observable
// parameters are deterministic (temperature 0, non-streaming) are eligible.
// Callers decide eligibility; this package only stores and replays bytes.
package responsecache

import (
	"crypto/sha256"
	"encoding/hex"
	"sync"
	"sync/atomic"
	"time"
)

// entry is one cached response body with its expiry.
type entry struct {
	status      int
	contentType string
	body        []byte
	usageJSON   []byte
	expiresAt   time.Time
}

// Config is the runtime configuration, hot-reloaded from the option system.
type Config struct {
	Enabled     bool
	TTLSeconds  int
	MaxEntries  int
	MaxBodySize int // 0 disables the size bound; larger bodies are not cached
}

// DefaultConfig returns the seed defaults used before any option override.
func DefaultConfig() Config {
	return Config{Enabled: false, TTLSeconds: 300, MaxEntries: 1000, MaxBodySize: 256 * 1024}
}

var (
	mu          sync.RWMutex
	cfg         = DefaultConfig()
	store       = make(map[string]*entry)
	currentSize int
	hits        int64
	misses      int64
)

// SetConfig swaps the runtime configuration (hot reload from ApplyOption).
// Disabling the cache or shrinking the entry cap below the current size
// resets the store.
func SetConfig(next Config) {
	mu.Lock()
	defer mu.Unlock()
	d := DefaultConfig()
	if next.TTLSeconds <= 0 {
		next.TTLSeconds = d.TTLSeconds
	}
	if next.MaxEntries <= 0 {
		next.MaxEntries = d.MaxEntries
	}
	if next.MaxBodySize < 0 {
		next.MaxBodySize = d.MaxBodySize
	}
	cfg = next
	if !cfg.Enabled || len(store) > cfg.MaxEntries {
		store = make(map[string]*entry)
		currentSize = 0
	}
}

// GetConfig returns a snapshot of the runtime configuration.
func GetConfig() Config {
	mu.RLock()
	defer mu.RUnlock()
	return cfg
}

// Key builds the normalized cache key from the canonical JSON request body
// (field order stable after unmarshal+marshal through the typed request
// struct) plus the resolved upstream model name. The caller must have
// stripped volatile fields before hashing.
func Key(canonicalJSON []byte, model string) string {
	h := sha256.New()
	h.Write([]byte(model))
	h.Write([]byte{0})
	h.Write(canonicalJSON)
	return hex.EncodeToString(h.Sum(nil))
}

// Payload is the cached upstream response: status, content type, body, and
// the usage record the original call settled against (so a cache hit can
// charge the same amount as the miss that produced it).
type Payload struct {
	Status      int
	ContentType string
	Body        []byte
	UsageJSON   []byte
}

// Get returns the cached payload for key if the cache is enabled and the
// entry is present and unexpired. A disabled cache short-circuits so entries
// written before the switch-off cannot be resurrected.
func Get(key string) (*Payload, bool) {
	mu.Lock()
	defer mu.Unlock()
	if !cfg.Enabled {
		return nil, false
	}
	e, ok := store[key]
	if !ok {
		return nil, false
	}
	if time.Now().After(e.expiresAt) {
		currentSize -= len(e.body)
		delete(store, key)
		return nil, false
	}
	// Copy so callers cannot mutate the cached payload after the fact.
	bodyCopy := make([]byte, len(e.body))
	copy(bodyCopy, e.body)
	var usageCopy []byte
	if e.usageJSON != nil {
		usageCopy = make([]byte, len(e.usageJSON))
		copy(usageCopy, e.usageJSON)
	}
	return &Payload{Status: e.status, ContentType: e.contentType, Body: bodyCopy, UsageJSON: usageCopy}, true
}

// Put stores payload under key, evicting expired or over-cap entries. A body
// larger than maxBodySize (when > 0) is refused. Returns whether stored.
func Put(key string, p Payload, maxBodySize int) bool {
	mu.Lock()
	defer mu.Unlock()
	if !cfg.Enabled {
		return false
	}
	if maxBodySize > 0 && len(p.Body) > maxBodySize {
		return false
	}
	if old, ok := store[key]; ok {
		currentSize -= len(old.body)
		delete(store, key)
	}
	for len(store) >= cfg.MaxEntries {
		evictOneLocked()
	}
	// Copy so callers cannot mutate the cached payload after the fact.
	bodyCopy := make([]byte, len(p.Body))
	copy(bodyCopy, p.Body)
	usageCopy := append([]byte(nil), p.UsageJSON...)
	store[key] = &entry{status: p.Status, contentType: p.ContentType, body: bodyCopy, usageJSON: usageCopy, expiresAt: time.Now().Add(time.Duration(cfg.TTLSeconds) * time.Second)}
	currentSize += len(bodyCopy)
	return true
}

// Clear drops every cached entry (admin action).
func Clear() {
	mu.Lock()
	defer mu.Unlock()
	store = make(map[string]*entry)
	currentSize = 0
}

// Stats is an observability snapshot for the admin surface.
type Stats struct {
	Entries int
	Bytes   int
	Hits    int64
	Misses  int64
}

// RecordHit / RecordMiss feed the hit-rate counters.
func RecordHit()  { atomic.AddInt64(&hits, 1) }
func RecordMiss() { atomic.AddInt64(&misses, 1) }

// GetStats returns a snapshot of size and hit/miss counters.
func GetStats() Stats {
	mu.RLock()
	defer mu.RUnlock()
	return Stats{
		Entries: len(store),
		Bytes:   currentSize,
		Hits:    atomic.LoadInt64(&hits),
		Misses:  atomic.LoadInt64(&misses),
	}
}

// evictOneLocked evicts one entry to make room: an expired one if any, else
// the oldest insert. Insert-order eviction is intentional — response
// freshness is already bounded by TTL, and a full LRU costs extra
// bookkeeping per Get on the hot path. Callers must hold mu.
func evictOneLocked() {
	if len(store) == 0 {
		return
	}
	var oldestKey string
	var oldest time.Time
	for k, e := range store {
		if oldestKey == "" || e.expiresAt.Before(oldest) {
			oldestKey = k
			oldest = e.expiresAt
		}
	}
	if oldestKey == "" {
		return
	}
	e := store[oldestKey]
	delete(store, oldestKey)
	currentSize -= len(e.body)
}
