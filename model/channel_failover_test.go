package model

import (
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/relaykit/dto"
)

// setupChannelCache installs a synthetic in-memory channel cache for the given
// group/model and returns a cleanup function. Each entry is (id, priority,
// weight). All channels are created enabled.
func setupChannelCache(t *testing.T, group, modelName string, entries [][3]int) func() {
	t.Helper()

	oldMemoryCache := common.MemoryCacheEnabled
	oldGroup2model := group2model2channels
	oldChannelsIDM := channelsIDM
	oldAdvanced := channel2advancedCustomConfig

	common.MemoryCacheEnabled = true

	channelsIDM = make(map[int]*Channel)
	ids := make([]int, 0, len(entries))
	for _, e := range entries {
		id, priority, weight := e[0], e[1], e[2]
		p := int64(priority)
		w := uint(weight)
		channelsIDM[id] = &Channel{
			Id:       id,
			Status:   common.ChannelStatusEnabled,
			Priority: &p,
			Weight:   &w,
		}
		ids = append(ids, id)
	}
	group2model2channels = map[string]map[string][]int{
		group: {modelName: ids},
	}
	channel2advancedCustomConfig = make(map[int]*dto.AdvancedCustomConfig)

	return func() {
		common.MemoryCacheEnabled = oldMemoryCache
		group2model2channels = oldGroup2model
		channelsIDM = oldChannelsIDM
		channel2advancedCustomConfig = oldAdvanced
	}
}

func TestGetRandomSatisfiedChannel_ExcludesFailedChannels(t *testing.T) {
	cleanup := setupChannelCache(t, "default", "gpt-x", [][3]int{
		{1, 0, 0},
		{2, 0, 0},
		{3, 0, 0},
	})
	defer cleanup()

	// exclude ch1 -> must return ch2 or ch3, never ch1
	for i := 0; i < 20; i++ {
		ch, err := GetRandomSatisfiedChannel("default", "gpt-x", "", map[int]bool{1: true})
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if ch == nil {
			t.Fatal("expected a channel, got nil")
		}
		if ch.Id == 1 {
			t.Fatalf("excluded channel #1 was returned")
		}
	}

	// exclude ch1+ch2 -> must return ch3
	ch, err := GetRandomSatisfiedChannel("default", "gpt-x", "", map[int]bool{1: true, 2: true})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if ch == nil || ch.Id != 3 {
		t.Fatalf("expected ch3, got %v", ch)
	}

	// exclude all -> no more channels to try
	ch, err = GetRandomSatisfiedChannel("default", "gpt-x", "", map[int]bool{1: true, 2: true, 3: true})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if ch != nil {
		t.Fatalf("expected nil when all channels excluded, got #%d", ch.Id)
	}
}

// TestGetRandomSatisfiedChannel_PriorityDescentAfterExhaustion verifies bug #6:
// same-priority channels must all be tried before descending to a lower
// priority. ch1/ch2 share priority 10, ch3 has priority 5.
func TestGetRandomSatisfiedChannel_PriorityDescentAfterExhaustion(t *testing.T) {
	cleanup := setupChannelCache(t, "default", "gpt-x", [][3]int{
		{1, 10, 0},
		{2, 10, 0},
		{3, 5, 0},
	})
	defer cleanup()

	// exclude ch1 -> must still return ch2 (same top priority), not descend to ch3
	for i := 0; i < 20; i++ {
		ch, err := GetRandomSatisfiedChannel("default", "gpt-x", "", map[int]bool{1: true})
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if ch == nil || ch.Id != 2 {
			t.Fatalf("expected ch2 (same priority), got %v", ch)
		}
	}

	// exclude ch1+ch2 -> descend to ch3
	ch, err := GetRandomSatisfiedChannel("default", "gpt-x", "", map[int]bool{1: true, 2: true})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if ch == nil || ch.Id != 3 {
		t.Fatalf("expected ch3 after top priority exhausted, got %v", ch)
	}
}

// TestGetRandomSatisfiedChannel_NilExcludeBackwardCompat verifies that with no
// exclusion (first attempt), the top priority channel pool is used.
func TestGetRandomSatisfiedChannel_NilExcludeBackwardCompat(t *testing.T) {
	cleanup := setupChannelCache(t, "default", "gpt-x", [][3]int{
		{1, 10, 0},
		{2, 5, 0},
	})
	defer cleanup()

	for i := 0; i < 20; i++ {
		ch, err := GetRandomSatisfiedChannel("default", "gpt-x", "", nil)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if ch == nil || ch.Id != 1 {
			t.Fatalf("expected top-priority ch1, got %v", ch)
		}
	}
}

// TestCountAvailableChannels verifies the adaptive retry budget helper counts
// every distinct channel that can serve the group/model, across priority tiers.
// With single-key channels the count equals the number of channels.
func TestCountAvailableChannels(t *testing.T) {
	cleanup := setupChannelCache(t, "default", "gpt-x", [][3]int{
		{1, 10, 0},
		{2, 10, 0},
		{3, 5, 0},
	})
	defer cleanup()

	if n := CountAvailableChannels("default", "gpt-x", ""); n != 3 {
		t.Fatalf("expected 3 available channels, got %d", n)
	}
	if n := CountAvailableChannels("default", "nonexistent", ""); n != 0 {
		t.Fatalf("expected 0 for unknown model, got %d", n)
	}
	if n := CountAvailableChannels("nonexistent", "gpt-x", ""); n != 0 {
		t.Fatalf("expected 0 for unknown group, got %d", n)
	}
}

// TestCountEnabledKeys verifies the per-channel enabled-key count used to size
// how many times a multi-key channel may be re-selected within one request.
func TestCountEnabledKeys(t *testing.T) {
	single := &Channel{Id: 1, Key: "k1"}
	if n := single.CountEnabledKeys(); n != 1 {
		t.Fatalf("single-key channel: expected 1, got %d", n)
	}

	multi := &Channel{Id: 2, Key: "k1\nk2\nk3"}
	multi.ChannelInfo.IsMultiKey = true
	if n := multi.CountEnabledKeys(); n != 3 {
		t.Fatalf("multi-key all enabled: expected 3, got %d", n)
	}

	// Disable one key via status list -> count drops to 2.
	multi.ChannelInfo.MultiKeyStatusList = map[int]int{1: common.ChannelStatusAutoDisabled}
	if n := multi.CountEnabledKeys(); n != 2 {
		t.Fatalf("multi-key one disabled: expected 2, got %d", n)
	}

	empty := &Channel{Id: 3}
	empty.ChannelInfo.IsMultiKey = true
	if n := empty.CountEnabledKeys(); n != 0 {
		t.Fatalf("multi-key no keys: expected 0, got %d", n)
	}
}

// TestCountAvailableChannels_MultiKeyWeighted verifies the retry budget counts a
// multi-key channel once per enabled key, so every key can be tried before the
// channel is excluded from retry.
func TestCountAvailableChannels_MultiKeyWeighted(t *testing.T) {
	cleanup := setupChannelCache(t, "default", "gpt-x", [][3]int{
		{1, 10, 0},
		{2, 10, 0},
	})
	defer cleanup()

	// Make ch1 a 3-key channel; ch2 stays single-key. Expected budget: 3 + 1 = 4.
	ch1 := channelsIDM[1]
	ch1.Key = "k1\nk2\nk3"
	ch1.ChannelInfo.IsMultiKey = true

	if n := CountAvailableChannels("default", "gpt-x", ""); n != 4 {
		t.Fatalf("expected budget 4 (3 keys + 1), got %d", n)
	}
}
