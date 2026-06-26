package model

import (
	"sync"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/types"

	"github.com/stretchr/testify/require"
)
// cooldownTestMu serializes the selector tests below so two parallel
// tests don't both yank the global channelSyncLock-protected pool out
// from under each other. The cooldown map itself is concurrent-safe;
// the candidate pool mutator is not (only InitChannelCache writes
// it under the lock, and these tests do too).
var cooldownTestMu sync.Mutex

// buildCandidatePool installs an in-memory candidate pool for tests that
// doesn't touch the database. It mirrors the shape of
// group2model2channels[group][model] = []int{channelId,...} that
// InitChannelCache would produce, plus the matching entries in
// channelsIDM so the selector can resolve them. Each test should
// restore prior state via t.Cleanup so subsequent tests are
// independent.
func buildCandidatePool(t *testing.T, group, model string, channels []*Channel) {
	t.Helper()
	channelSyncLock.Lock()
	defer channelSyncLock.Unlock()

	// Snapshot prior state for restoration.
	priorGroup := group2model2channels
	priorIDM := channelsIDM
	priorAdvanced := channel2advancedCustomConfig

	if group2model2channels == nil {
		group2model2channels = make(map[string]map[string][]int)
	}
	if channelsIDM == nil {
		channelsIDM = make(map[int]*Channel)
	}
	if channel2advancedCustomConfig == nil {
		channel2advancedCustomConfig = make(map[int]*dto.AdvancedCustomConfig)
	}
	if _, ok := group2model2channels[group]; !ok {
		group2model2channels[group] = make(map[string][]int)
	}
	group2model2channels[group][model] = make([]int, 0, len(channels))
	for _, c := range channels {
		group2model2channels[group][model] = append(group2model2channels[group][model], c.Id)
		channelsIDM[c.Id] = c
	}

	t.Cleanup(func() {
		channelSyncLock.Lock()
		defer channelSyncLock.Unlock()
		group2model2channels = priorGroup
		channelsIDM = priorIDM
		channel2advancedCustomConfig = priorAdvanced
	})
}

// makeTestChannel constructs a minimal *Channel for selector tests. We
// set only the fields the selector reads (Id, Status, Priority,
// Weight, Group, Models, ChannelInfo). Other fields stay zero, which
// is fine because the selector never dereferences them on this path.
func makeTestChannel(id int, priority int64, weight uint, isMultiKey bool) *Channel {
	c := &Channel{
		Id:      id,
		Status:  common.ChannelStatusEnabled,
		Group:   "test-group",
		Models:  "test-model",
		Priority: &priority,
		Weight:  &weight,
	}
	if isMultiKey {
		c.ChannelInfo = ChannelInfo{IsMultiKey: true, MultiKeyMode: constant.MultiKeyModeRandom}
	}
	return c
}

// TestGetRandomSatisfiedChannel_FiltersCooldown verifies the
// channel-level cooldown actually blocks a single candidate from the
// selector. This is the regression test for the user-reported issue
// "cooldown doesn't seem to be respected".
func TestGetRandomSatisfiedChannel_FiltersCooldown(t *testing.T) {
	cooldownTestMu.Lock()
	defer cooldownTestMu.Unlock()

	commonMemoryCache := common.MemoryCacheEnabled
	common.MemoryCacheEnabled = true
	t.Cleanup(func() { common.MemoryCacheEnabled = commonMemoryCache })

	c1 := makeTestChannel(9001, 0, 1, false)
	c2 := makeTestChannel(9002, 0, 1, false)
	buildCandidatePool(t, "test-cooldown-grp", "test-cooldown-mdl", []*Channel{c1, c2})

	// Mark c1 in cooldown.
	until := time.Now().Add(1 * time.Hour)
	MarkCooldown(c1.Id, until)
	t.Cleanup(func() { ClearCooldown(c1.Id) })

	// Run the selector many times — it must never return c1.
	for i := 0; i < 100; i++ {
		got, err := GetRandomSatisfiedChannel("test-cooldown-grp", "test-cooldown-mdl", 0, "")
		require.NoError(t, err)
		require.NotNil(t, got, "selector returned nil but c2 is available")
		require.Equal(t, c2.Id, got.Id,
			"selector returned a channel in cooldown (c1) on iteration %d", i)
	}
}

// TestGetRandomSatisfiedChannel_AllInCooldownReturnsNil verifies that
// when every channel in a priority bucket is in cooldown, the
// selector returns (nil, nil) so the outer retry loop can move on
// (next priority / next group) instead of returning a stale channel.
func TestGetRandomSatisfiedChannel_AllInCooldownReturnsNil(t *testing.T) {
	cooldownTestMu.Lock()
	defer cooldownTestMu.Unlock()

	commonMemoryCache := common.MemoryCacheEnabled
	common.MemoryCacheEnabled = true
	t.Cleanup(func() { common.MemoryCacheEnabled = commonMemoryCache })

	c1 := makeTestChannel(9101, 0, 1, false)
	c2 := makeTestChannel(9102, 0, 1, false)
	buildCandidatePool(t, "test-cooldown-all-grp", "test-cooldown-all-mdl", []*Channel{c1, c2})

	until := time.Now().Add(1 * time.Hour)
	MarkCooldown(c1.Id, until)
	MarkCooldown(c2.Id, until)
	t.Cleanup(func() {
		ClearCooldown(c1.Id)
		ClearCooldown(c2.Id)
	})

	got, err := GetRandomSatisfiedChannel("test-cooldown-all-grp", "test-cooldown-all-mdl", 0, "")
	require.NoError(t, err)
	require.Nil(t, got, "all channels in cooldown, selector should return nil")
}

// TestGetNextEnabledKey_SkipsCooldownKey verifies the per-key cooldown
// overlay inside GetNextEnabledKey. A multi-key channel where only
// one key is in cooldown must continue to serve requests on the
// other keys; the selector must not return "no available key" just
// because one credential is sick.
func TestGetNextEnabledKey_SkipsCooldownKey(t *testing.T) {
	cooldownTestMu.Lock()
	defer cooldownTestMu.Unlock()

	commonMemoryCache := common.MemoryCacheEnabled
	common.MemoryCacheEnabled = true
	t.Cleanup(func() { common.MemoryCacheEnabled = commonMemoryCache })

	priority := int64(0)
	weight := uint(1)
	c := &Channel{
		Id:       9201,
		Status:   common.ChannelStatusEnabled,
		Group:    "test-key-grp",
		Models:   "test-key-mdl",
		Priority: &priority,
		Weight:   &weight,
		ChannelInfo: ChannelInfo{
			IsMultiKey:   true,
			MultiKeySize: 3,
			MultiKeyMode: constant.MultiKeyModeRandom,
		},
		Key: "key-0\nkey-1\nkey-2",
	}
	// Initialise the multi-key status list so all keys start enabled.
	c.ChannelInfo.MultiKeyStatusList = map[int]int{0: 1, 1: 1, 2: 1}
	if channelsIDM == nil {
		channelsIDM = make(map[int]*Channel)
	}
	channelsIDM[c.Id] = c
	t.Cleanup(func() { delete(channelsIDM, c.Id) })

	// Mark only key 1 in cooldown.
	MarkKeyCooldown(c.Id, 1, time.Now().Add(1*time.Hour))
	t.Cleanup(func() { ClearKeyCooldown(c.Id, 1) })

	// Sample many times; we should never see index 1. The probability
	// of never hitting a specific index in 200 random picks with 3
	// enabled keys is (2/3)^200, effectively zero — a flake here would
	// indicate GetNextEnabledKey is leaking the cooldown filter.
	seen := make(map[int]int)
	for i := 0; i < 200; i++ {
		key, idx, err := c.GetNextEnabledKey()
		if err != nil {
			t.Fatalf("iteration %d: unexpected error: %v (key=%q)", i, err, key)
		}
		require.NotEmpty(t, key)
		seen[idx]++
		require.NotEqual(t, 1, idx,
		)
	}
	// With three keys, we expect both 0 and 2 to be picked. If
	// sampling happened to miss one, the test still passes; we
	// only care that 1 is excluded.
	require.Equal(t, 0, seen[1])
}

// TestGetNextEnabledKey_AllKeysCooldownReturnsError verifies that
// when every key is in cooldown, GetNextEnabledKey returns the
// "no enabled keys" error so the upstream retry loop can mark the
// channel as unselectable for this request.
func TestGetNextEnabledKey_AllKeysCooldownReturnsError(t *testing.T) {
	cooldownTestMu.Lock()
	defer cooldownTestMu.Unlock()

	commonMemoryCache := common.MemoryCacheEnabled
	common.MemoryCacheEnabled = true
	t.Cleanup(func() { common.MemoryCacheEnabled = commonMemoryCache })

	priority := int64(0)
	weight := uint(1)
	c := &Channel{
		Id:       9202,
		Status:   common.ChannelStatusEnabled,
		Group:    "test-key-grp-2",
		Models:   "test-key-mdl-2",
		Priority: &priority,
		Weight:   &weight,
		ChannelInfo: ChannelInfo{
			IsMultiKey:   true,
			MultiKeySize: 2,
			MultiKeyMode: constant.MultiKeyModeRandom,
		},
		Key: "key-0\nkey-1",
	}
	c.ChannelInfo.MultiKeyStatusList = map[int]int{0: 1, 1: 1}
	if channelsIDM == nil {
		channelsIDM = make(map[int]*Channel)
	}
	channelsIDM[c.Id] = c
	t.Cleanup(func() { delete(channelsIDM, c.Id) })

	MarkKeyCooldown(c.Id, 0, time.Now().Add(1*time.Hour))
	MarkKeyCooldown(c.Id, 1, time.Now().Add(1*time.Hour))
	t.Cleanup(func() {
		ClearKeyCooldown(c.Id, 0)
		ClearKeyCooldown(c.Id, 1)
	})

	_, _, err := c.GetNextEnabledKey()
	require.Error(t, err)
	require.Equal(t, types.ErrorCodeChannelNoAvailableKey, err.GetErrorCode())
}

// TestGetNextEnabledKey_SingleKeyHonoursCooldown is the regression
// test for the 2026-06-20 incident: a single-key channel with
// its only key in cooldown must surface ErrorCodeChannelNoAvailableKey,
// not return the broken key. Without this, a 3600s business
// cooldown on a single-key channel would be invisible to the
// distributor (the early return bypassed the cooldown check)
// and the user would keep seeing the upstream 400 until the
// operator cleared the cooldown manually.
func TestGetNextEnabledKey_SingleKeyHonoursCooldown(t *testing.T) {
	cooldownTestMu.Lock()
	defer cooldownTestMu.Unlock()

	commonMemoryCache := common.MemoryCacheEnabled
	common.MemoryCacheEnabled = true
	t.Cleanup(func() { common.MemoryCacheEnabled = commonMemoryCache })

	priority := int64(0)
	weight := uint(1)
	c := &Channel{
		Id:       9210,
		Status:   common.ChannelStatusEnabled,
		Group:    "test-singlekey-grp",
		Models:   "test-singlekey-mdl",
		Priority: &priority,
		Weight:   &weight,
		// Note: IsMultiKey is the zero value (false). This is the
		// configuration that triggered the production incident.
		ChannelInfo: ChannelInfo{IsMultiKey: false},
		Key:        "sk-xxxx",
	}

	MarkKeyCooldown(c.Id, 0, time.Now().Add(1*time.Hour))
	t.Cleanup(func() { ClearKeyCooldown(c.Id, 0) })

	_, _, err := c.GetNextEnabledKey()
	require.Error(t, err)
	require.Equal(t, types.ErrorCodeChannelNoAvailableKey, err.GetErrorCode(),
		"single-key channel with the only key in cooldown must return the no-key error, not the broken key")
}

// TestGetNextEnabledKey_SingleKeyNoCooldownReturnsKey is the
// happy-path companion: when no cooldown is set, the single-key
// channel must continue to return its key (regression guard
// for the fix above; without it, an over-eager fix could break
// the common case).
func TestGetNextEnabledKey_SingleKeyNoCooldownReturnsKey(t *testing.T) {
	cooldownTestMu.Lock()
	defer cooldownTestMu.Unlock()

	commonMemoryCache := common.MemoryCacheEnabled
	common.MemoryCacheEnabled = true
	t.Cleanup(func() { common.MemoryCacheEnabled = commonMemoryCache })

	priority := int64(0)
	weight := uint(1)
	c := &Channel{
		Id:          9211,
		Status:      common.ChannelStatusEnabled,
		Group:       "test-singlekey-ok-grp",
		Models:      "test-singlekey-ok-mdl",
		Priority:    &priority,
		Weight:      &weight,
		ChannelInfo: ChannelInfo{IsMultiKey: false},
		Key:         "sk-yyyy",
	}

	key, idx, err := c.GetNextEnabledKey()
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	require.Equal(t, "sk-yyyy", key)
	require.Equal(t, 0, idx)
}


// TestGetRandomSatisfiedChannel_SkipsSingleKeyWhenCooldown is the
// regression test for the 2026-06-20 production incident: a
// single-key channel whose key 0 is in cooldown must NOT be
// returned by the selector. Without this, the selector handed
// the channel to the distributor, the distributor called
// GetNextEnabledKey and got NoAvailableKey, and the controller
// retried into the same channel — an infinite no-channel
// retry loop that surfaced as the user repeatedly seeing
// the upstream 400.
func TestGetRandomSatisfiedChannel_SkipsSingleKeyWhenCooldown(t *testing.T) {
	cooldownTestMu.Lock()
	defer cooldownTestMu.Unlock()

	commonMemoryCache := common.MemoryCacheEnabled
	common.MemoryCacheEnabled = true
	t.Cleanup(func() { common.MemoryCacheEnabled = commonMemoryCache })

	// Build a pool with one single-key channel and one healthy
	// single-key channel at the same priority. The selector
	// must skip the cooldowned one and pick the healthy one.
	cooldowned := makeTestChannel(9301, 0, 1, false)
	healthy := makeTestChannel(9302, 0, 1, false)
	buildCandidatePool(t, "test-sel-singlekey-grp", "test-sel-singlekey-mdl",
		[]*Channel{cooldowned, healthy})

	MarkKeyCooldown(cooldowned.Id, 0, time.Now().Add(1*time.Hour))
	t.Cleanup(func() { ClearKeyCooldown(cooldowned.Id, 0) })

	for i := 0; i < 50; i++ {
		got, err := GetRandomSatisfiedChannel(
			"test-sel-singlekey-grp", "test-sel-singlekey-mdl", 0, "")
		require.NoError(t, err)
		require.NotNil(t, got, "selector returned nil but healthy channel is available")
		require.Equal(t, healthy.Id, got.Id,
			"selector must skip the cooldowned single-key channel (iteration %d)", i)
	}
}

// TestGetRandomSatisfiedChannel_SkipsMultiKeyWhenAllCooldown is
// the multi-key counterpart: when every key of a multi-key
// channel is in cooldown, the channel is effectively unusable
// and the selector must skip it even though the channel-level
// cooldown map is empty. This is what allows a multi-key
// channel to "self-disable" via per-key cooldowns without
// relying on the legacy whole-channel auto-disable path.
func TestGetRandomSatisfiedChannel_SkipsMultiKeyWhenAllCooldown(t *testing.T) {
	cooldownTestMu.Lock()
	defer cooldownTestMu.Unlock()

	commonMemoryCache := common.MemoryCacheEnabled
	common.MemoryCacheEnabled = true
	t.Cleanup(func() { common.MemoryCacheEnabled = commonMemoryCache })

	// 3-key channel with all keys cooldowned, plus a healthy
	// single-key channel as a control. The selector must pick
	// the control, not the all-cooldowned one.
	priority := int64(0)
	weight := uint(1)
	broken := &Channel{
		Id:       9401,
		Status:   common.ChannelStatusEnabled,
		Group:    "test-sel-multikey-grp",
		Models:   "test-sel-multikey-mdl",
		Priority: &priority,
		Weight:   &weight,
		ChannelInfo: ChannelInfo{
			IsMultiKey:   true,
			MultiKeySize: 3,
			MultiKeyMode: constant.MultiKeyModeRandom,
		},
		Key: "key-0\nkey-1\nkey-2",
	}
	broken.ChannelInfo.MultiKeyStatusList = map[int]int{0: 1, 1: 1, 2: 1}
	healthy := makeTestChannel(9402, 0, 1, false)
	buildCandidatePool(t, "test-sel-multikey-grp", "test-sel-multikey-mdl",
		[]*Channel{broken, healthy})

	MarkKeyCooldown(broken.Id, 0, time.Now().Add(1*time.Hour))
	MarkKeyCooldown(broken.Id, 1, time.Now().Add(1*time.Hour))
	MarkKeyCooldown(broken.Id, 2, time.Now().Add(1*time.Hour))
	t.Cleanup(func() {
		ClearKeyCooldown(broken.Id, 0)
		ClearKeyCooldown(broken.Id, 1)
		ClearKeyCooldown(broken.Id, 2)
	})

	for i := 0; i < 50; i++ {
		got, err := GetRandomSatisfiedChannel(
			"test-sel-multikey-grp", "test-sel-multikey-mdl", 0, "")
		require.NoError(t, err)
		require.NotNil(t, got, "selector returned nil but healthy channel is available")
		require.Equal(t, healthy.Id, got.Id,
			"selector must skip multi-key channel when all keys in cooldown (iteration %d)", i)
	}
}


// TestGetRandomSatisfiedChannel_SingleChannelFastPath_RespectsPerKeyCooldown
// is the regression test for the 2026-06-20 production incident.
func TestGetRandomSatisfiedChannel_SingleChannelFastPath_RespectsPerKeyCooldown(t *testing.T) {
	cooldownTestMu.Lock()
	defer cooldownTestMu.Unlock()

	commonMemoryCache := common.MemoryCacheEnabled
	common.MemoryCacheEnabled = true
	t.Cleanup(func() { common.MemoryCacheEnabled = commonMemoryCache })

	// Single-key channel: this is the exact shape the production
	// incident exposed — a group with one channel, that channel
	// has one key, and the key is in cooldown. Before this fix
	// the fast path returned the channel regardless and the
	// controller's retry loop picked the same channel forever.
	c := makeTestChannel(9501, 0, 1, false)
	c.Key = "sk-only-key"
	buildCandidatePool(t, "test-fastpath-grp", "test-fastpath-mdl", []*Channel{c})

	MarkKeyCooldown(c.Id, 0, time.Now().Add(1*time.Hour))
	t.Cleanup(func() { ClearKeyCooldown(c.Id, 0) })

	for i := 0; i < 20; i++ {
		got, err := GetRandomSatisfiedChannel(
			"test-fastpath-grp", "test-fastpath-mdl", 0, "")
		require.NoError(t, err)
		require.Nil(t, got,
			"single-channel fast path must return nil when the only key is in cooldown (iteration %d)", i)
	}
}

// TestGetRandomSatisfiedChannel_SingleChannelFastPath_MultiKeyAllCooldown
// is the multi-key counterpart: a single-channel-in-group
// multi-key channel with every key in cooldown must also be
// skipped, even though the channel-level cooldown map is empty.
// Without this, the controller's retry loop hands the same
// channel to the distributor, the distributor returns
// NoAvailableKey, and the user sees repeated upstream failures.
func TestGetRandomSatisfiedChannel_SingleChannelFastPath_MultiKeyAllCooldown(t *testing.T) {
	cooldownTestMu.Lock()
	defer cooldownTestMu.Unlock()

	commonMemoryCache := common.MemoryCacheEnabled
	common.MemoryCacheEnabled = true
	t.Cleanup(func() { common.MemoryCacheEnabled = commonMemoryCache })

	priority := int64(0)
	weight := uint(1)
	c := &Channel{
		Id:       9502,
		Status:   common.ChannelStatusEnabled,
		Group:    "test-fastpath-multi-grp",
		Models:   "test-fastpath-multi-mdl",
		Priority: &priority,
		Weight:   &weight,
		ChannelInfo: ChannelInfo{
			IsMultiKey:   true,
			MultiKeySize: 3,
			MultiKeyMode: constant.MultiKeyModeRandom,
		},
		Key: "key-0\nkey-1\nkey-2",
	}
	c.ChannelInfo.MultiKeyStatusList = map[int]int{
		0: common.ChannelStatusEnabled,
		1: common.ChannelStatusEnabled,
		2: common.ChannelStatusEnabled,
	}
	buildCandidatePool(t, "test-fastpath-multi-grp", "test-fastpath-multi-mdl", []*Channel{c})

	MarkKeyCooldown(c.Id, 0, time.Now().Add(1*time.Hour))
	MarkKeyCooldown(c.Id, 1, time.Now().Add(1*time.Hour))
	MarkKeyCooldown(c.Id, 2, time.Now().Add(1*time.Hour))
	t.Cleanup(func() {
		ClearKeyCooldown(c.Id, 0)
		ClearKeyCooldown(c.Id, 1)
		ClearKeyCooldown(c.Id, 2)
	})

	for i := 0; i < 20; i++ {
		got, err := GetRandomSatisfiedChannel(
			"test-fastpath-multi-grp", "test-fastpath-multi-mdl", 0, "")
		require.NoError(t, err)
		require.Nil(t, got,
			"single-channel fast path must return nil when all multi-key slots are in cooldown (iteration %d)", i)
	}
}
