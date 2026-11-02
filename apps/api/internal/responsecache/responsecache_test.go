package responsecache

import (
	"fmt"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// resetState pins an isolated store/config per test; without it one test's
// entries leak into the next and break the entry-count assertions.
func resetState(t *testing.T, cfg Config) {
	t.Helper()
	Clear()
	hits, misses = 0, 0
	SetConfig(cfg)
	t.Cleanup(func() {
		Clear()
		SetConfig(DefaultConfig())
	})
}

func TestKeyIsDeterministicAndDiscriminates(t *testing.T) {
	a := Key([]byte(`{"model":"gpt-4o"}`), "gpt-4o")
	b := Key([]byte(`{"model":"gpt-4o"}`), "gpt-4o")
	c := Key([]byte(`{"model":"gpt-4o","messages":[]}`), "gpt-4o")
	d := Key([]byte(`{"model":"gpt-4o"}`), "gpt-4o-mini")

	require.Equal(t, a, b, "identical body+model must produce one key")
	require.NotEqual(t, a, c, "different body must produce a different key")
	require.NotEqual(t, a, d, "different model must produce a different key")
}

func TestPutGetRoundTripAndIsolation(t *testing.T) {
	resetState(t, Config{Enabled: true, TTLSeconds: 60, MaxEntries: 10, MaxBodySize: 1024})

	key := Key([]byte(`{}`), "m")
	body := []byte(`{"choices":[{"message":{"content":"hi"}}]}`)
	usageJSON := []byte(`{"prompt_tokens":10,"completion_tokens":5,"total_tokens":15}`)
	require.True(t, Put(key, Payload{Status: 200, ContentType: "application/json", Body: body, UsageJSON: usageJSON}, 1024))

	// Mutating the caller's slice must not corrupt the cached payload.
	body[0] = 'X'

	got, ok := Get(key)
	require.True(t, ok)
	assert.Equal(t, 200, got.Status)
	assert.Equal(t, "application/json", got.ContentType)
	assert.Equal(t, `{"choices":[{"message":{"content":"hi"}}]}`, string(got.Body))

	// Mutating the returned copy must not corrupt the stored payload either.
	got.Body[1] = 'Y'
	got.UsageJSON[0] = 'Y'
	again, ok := Get(key)
	require.True(t, ok)
	assert.Equal(t, `{"choices":[{"message":{"content":"hi"}}]}`, string(again.Body),
		"Get must hand out a copy, not the stored buffer")
	assert.Equal(t, usageJSON, again.UsageJSON,
		"UsageJSON must round-trip and be isolated from caller mutations")
}

func TestPutRefusedWhenDisabledOrOversized(t *testing.T) {
	resetState(t, Config{Enabled: false, TTLSeconds: 60, MaxEntries: 10, MaxBodySize: 1024})
	key := Key([]byte(`{}`), "m")
	assert.False(t, Put(key, Payload{Status: 200, Body: []byte(`{}`)}, 1024),
		"Put must be a no-op while the cache is disabled")

	SetConfig(Config{Enabled: true, TTLSeconds: 60, MaxEntries: 10, MaxBodySize: 8})
	assert.False(t, Put(key, Payload{Status: 200, Body: []byte(`{"too":"long"}`)}, 8),
		"bodies above MaxBodySize must be refused, not evicted-in")
	_, ok := Get(key)
	assert.False(t, ok)
}

func TestExpiryAndClear(t *testing.T) {
	resetState(t, Config{Enabled: true, TTLSeconds: 1, MaxEntries: 10, MaxBodySize: 1024})
	key := Key([]byte(`{}`), "m")
	require.True(t, Put(key, Payload{Status: 200, Body: []byte(`{}`)}, 1024))

	_, ok := Get(key)
	require.True(t, ok)

	// Force expiry without sleeping a full second.
	mu.Lock()
	store[key].expiresAt = time.Now().Add(-time.Second)
	mu.Unlock()

	_, ok = Get(key)
	assert.False(t, ok, "expired entries must be dropped on read")
	stats := GetStats()
	assert.Equal(t, 0, stats.Entries, "expiry must reclaim the entry")

	require.True(t, Put(key, Payload{Status: 200, Body: []byte(`{}`)}, 1024))
	Clear()
	_, ok = Get(key)
	assert.False(t, ok, "Clear must empty the store")
}

func TestEvictionRespectsMaxEntries(t *testing.T) {
	resetState(t, Config{Enabled: true, TTLSeconds: 60, MaxEntries: 3, MaxBodySize: 1024})

	keys := make([]string, 0, 5)
	for i := range 5 {
		k := Key([]byte(fmt.Sprintf(`{"i":%d}`, i)), "m")
		keys = append(keys, k)
		require.True(t, Put(k, Payload{Status: 200, Body: []byte(`{}`)}, 1024))
	}

	assert.Equal(t, 3, GetStats().Entries, "entry cap must hold")
	// The two oldest inserts must be gone, the newest three present.
	for i, k := range keys {
		_, ok := Get(k)
		if i < 2 {
			assert.False(t, ok, "key %d was inserted first and must be evicted", i)
		} else {
			assert.True(t, ok, "key %d was inserted last and must survive", i)
		}
	}
}

func TestSetConfigDisablingResetsStore(t *testing.T) {
	resetState(t, Config{Enabled: true, TTLSeconds: 60, MaxEntries: 10, MaxBodySize: 1024})
	key := Key([]byte(`{}`), "m")
	require.True(t, Put(key, Payload{Status: 200, Body: []byte(`{}`)}, 1024))

	SetConfig(Config{Enabled: false, TTLSeconds: 60, MaxEntries: 10, MaxBodySize: 1024})
	assert.Equal(t, 0, GetStats().Entries, "disabling the cache must drop all entries")

	// Re-enabling must start from an empty store, not resurrect entries.
	SetConfig(Config{Enabled: true, TTLSeconds: 60, MaxEntries: 10, MaxBodySize: 1024})
	_, ok := Get(key)
	assert.False(t, ok)
}

// TestGetShortCircuitsWhenDisabled pins the privacy guard: entries surviving a
// switch-off must not be readable even before any new write triggers a reset.
func TestGetShortCircuitsWhenDisabled(t *testing.T) {
	resetState(t, Config{Enabled: true, TTLSeconds: 60, MaxEntries: 10, MaxBodySize: 1024})
	key := Key([]byte(`{}`), "m")
	require.True(t, Put(key, Payload{Status: 200, Body: []byte(`{}`)}, 1024))

	// Flip the runtime config off without going through SetConfig's store
	// reset (simulating a hot option toggle with no subsequent write).
	mu.Lock()
	cfg.Enabled = false
	mu.Unlock()

	_, ok := Get(key)
	assert.False(t, ok, "a disabled cache must not serve stored conversation bodies")
	assert.Equal(t, 1, GetStats().Entries, "entries remain until evicted, but are unreadable")
}

func TestStatsCounters(t *testing.T) {
	resetState(t, Config{Enabled: true, TTLSeconds: 60, MaxEntries: 10, MaxBodySize: 1024})
	RecordHit()
	RecordHit()
	RecordMiss()

	stats := GetStats()
	assert.Equal(t, int64(2), stats.Hits)
	assert.Equal(t, int64(1), stats.Misses)
	assert.Equal(t, 0, stats.Entries)
}
