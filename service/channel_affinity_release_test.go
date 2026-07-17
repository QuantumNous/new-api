package service

import (
	"fmt"
	"net/http/httptest"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
)

func contextWithAffinityKey(cacheKey string) *gin.Context {
	rec := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(rec)
	setChannelAffinityContext(ctx, channelAffinityMeta{
		CacheKey:   cacheKey,
		TTLSeconds: 600,
		RuleName:   "test-rule",
		UsingGroup: "default",
	})
	return ctx
}

// withoutGlobalReleaseInterval isolates the per-key cooldown from the global
// stampede spacing, so a case that means to exercise one is not silently
// satisfied by the other.
func withoutGlobalReleaseInterval(t *testing.T) {
	t.Helper()
	old := affinityReleaseMinInterval
	affinityReleaseMinInterval = 0
	ResetChannelAffinityReleaseStateForTest()
	t.Cleanup(func() {
		affinityReleaseMinInterval = old
		ResetChannelAffinityReleaseStateForTest()
	})
}

// TestTryReleaseChannelAffinityAllowsOneMigrationPerKey is the guard that makes
// slow-channel migration safe. Each migration costs one full uncached prefill
// (23.3s measured in prod on a 240k-token prompt), and right after one the
// channel we moved to has barely been measured — so an unrated limiter would let
// a key hop channels on every request, paying that prefill each time.
func TestTryReleaseChannelAffinityAllowsOneMigrationPerKey(t *testing.T) {
	withoutGlobalReleaseInterval(t)
	key := fmt.Sprintf("affinity:%s", t.Name())

	require.True(t, TryReleaseChannelAffinity(contextWithAffinityKey(key)),
		"the first migration of a key must be allowed")

	for i := 0; i < 5; i++ {
		require.False(t, TryReleaseChannelAffinity(contextWithAffinityKey(key)),
			"a key that just migrated must stay put until the cooldown expires")
	}
}

// TestTryReleaseChannelAffinityIsPerKey: one key's migration must not permanently
// freeze every other user's — the global spacing delays them, it does not
// exempt them from ever migrating.
func TestTryReleaseChannelAffinityIsPerKey(t *testing.T) {
	withoutGlobalReleaseInterval(t)
	first := fmt.Sprintf("affinity:%s:a", t.Name())
	second := fmt.Sprintf("affinity:%s:b", t.Name())

	require.True(t, TryReleaseChannelAffinity(contextWithAffinityKey(first)))
	require.True(t, TryReleaseChannelAffinity(contextWithAffinityKey(second)),
		"a different affinity key must be free to migrate once the spacing allows")
}

// TestTryReleaseChannelAffinitySpacesOutAStampede covers the failure the per-key
// cooldown cannot: the slow verdict is per channel, so every key pinned to a
// newly-slow channel is told to leave at the same moment, each on its FIRST
// migration. Without global spacing their cold prefills land together and can
// make the destination genuinely slow, cascading onward.
func TestTryReleaseChannelAffinitySpacesOutAStampede(t *testing.T) {
	old := affinityReleaseMinInterval
	affinityReleaseMinInterval = time.Hour
	ResetChannelAffinityReleaseStateForTest()
	t.Cleanup(func() {
		affinityReleaseMinInterval = old
		ResetChannelAffinityReleaseStateForTest()
	})

	granted := 0
	for i := 0; i < 50; i++ {
		// 50 distinct keys, all evicted from the same channel at once.
		if TryReleaseChannelAffinity(contextWithAffinityKey(fmt.Sprintf("affinity:%s:%d", t.Name(), i))) {
			granted++
		}
	}
	require.Equal(t, 1, granted,
		"a channel-wide eviction must drain one key at a time, not stampede the destination")
}

// TestTryReleaseChannelAffinityWithoutKeyStaysPut: with no affinity key there is
// nothing to rate-limit against, so the safe answer is to not migrate rather
// than to migrate unbounded.
func TestTryReleaseChannelAffinityWithoutKeyStaysPut(t *testing.T) {
	withoutGlobalReleaseInterval(t)
	rec := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(rec)

	require.False(t, TryReleaseChannelAffinity(ctx))
}

// TestTryReleaseChannelAffinityGrantsOnceUnderConcurrency is why the check and
// the record are one locked step. Concurrent requests can share an affinity key,
// and if they both read "not migrated yet" before either writes, they both
// migrate and each pays a full uncached prefill. Exactly one may win.
func TestTryReleaseChannelAffinityGrantsOnceUnderConcurrency(t *testing.T) {
	withoutGlobalReleaseInterval(t)
	key := fmt.Sprintf("affinity:%s", t.Name())

	const racers = 32
	var granted atomic.Int32
	var start sync.WaitGroup
	var done sync.WaitGroup
	start.Add(1)
	for i := 0; i < racers; i++ {
		done.Add(1)
		go func() {
			defer done.Done()
			start.Wait()
			if TryReleaseChannelAffinity(contextWithAffinityKey(key)) {
				granted.Add(1)
			}
		}()
	}
	start.Done()
	done.Wait()

	require.Equal(t, int32(1), granted.Load(),
		"exactly one concurrent request may migrate the same affinity key")
}
