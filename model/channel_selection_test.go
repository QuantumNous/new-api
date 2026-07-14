package model

import (
	"fmt"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/glebarez/sqlite"
	"gorm.io/gorm"
)

func setupChannelSelectionTestDB(t *testing.T) {
	t.Helper()

	oldDB := DB
	oldMemoryCacheEnabled := common.MemoryCacheEnabled
	oldUsingSQLite := common.UsingSQLite
	oldUsingPostgreSQL := common.UsingPostgreSQL
	oldUsingMySQL := common.UsingMySQL

	common.MemoryCacheEnabled = false
	common.UsingSQLite = true
	common.UsingPostgreSQL = false
	common.UsingMySQL = false
	initCol()

	dsn := fmt.Sprintf("file:channel-selection-%d?mode=memory&cache=shared", time.Now().UnixNano())
	db, err := gorm.Open(sqlite.Open(dsn), &gorm.Config{})
	if err != nil {
		t.Fatalf("open sqlite test db: %v", err)
	}
	DB = db
	if err := DB.AutoMigrate(&Channel{}, &Ability{}); err != nil {
		t.Fatalf("migrate test db: %v", err)
	}
	clearChannelCooldownsForTest()

	t.Cleanup(func() {
		clearChannelCooldownsForTest()
		DB = oldDB
		common.MemoryCacheEnabled = oldMemoryCacheEnabled
		common.UsingSQLite = oldUsingSQLite
		common.UsingPostgreSQL = oldUsingPostgreSQL
		common.UsingMySQL = oldUsingMySQL
		initCol()
	})
}

func TestGetChannelSkipsCoolingChannelWithoutMemoryCache(t *testing.T) {
	setupChannelSelectionTestDB(t)

	priority := int64(10)
	weight := uint(0)
	channels := []Channel{
		{Id: 17, Type: 1, Key: "key-17", Status: common.ChannelStatusEnabled, Name: "cooling", Weight: &weight, Priority: &priority, Models: "gpt-5.5", Group: "default"},
		{Id: 29, Type: 1, Key: "key-29", Status: common.ChannelStatusEnabled, Name: "available", Weight: &weight, Priority: &priority, Models: "gpt-5.5", Group: "default"},
	}
	if err := DB.Create(&channels).Error; err != nil {
		t.Fatalf("seed channels: %v", err)
	}
	abilities := []Ability{
		{Group: "default", Model: "gpt-5.5", ChannelId: 17, Enabled: true, Priority: &priority, Weight: weight},
		{Group: "default", Model: "gpt-5.5", ChannelId: 29, Enabled: true, Priority: &priority, Weight: weight},
	}
	if err := DB.Create(&abilities).Error; err != nil {
		t.Fatalf("seed abilities: %v", err)
	}

	CooldownChannel(17, "Insufficient account balance", time.Minute)

	channel, err := GetChannel("default", "gpt-5.5", 0)
	if err != nil {
		t.Fatalf("GetChannel returned error: %v", err)
	}
	if channel == nil || channel.Id != 29 {
		t.Fatalf("expected channel 29, got %#v", channel)
	}
}

func TestGetRandomSatisfiedChannelSkipsOpenHealthKey(t *testing.T) {
	oldMemoryCacheEnabled := common.MemoryCacheEnabled
	oldHealthEnabled := common.AdaptiveChannelHealthEnabled
	common.MemoryCacheEnabled = true
	common.AdaptiveChannelHealthEnabled = true
	ClearChannelCacheForTest()
	clearChannelCooldownsForTest()
	clearChannelHealthForTest()
	t.Cleanup(func() {
		clearChannelHealthForTest()
		clearChannelCooldownsForTest()
		ClearChannelCacheForTest()
		common.MemoryCacheEnabled = oldMemoryCacheEnabled
		common.AdaptiveChannelHealthEnabled = oldHealthEnabled
	})

	priority := int64(10)
	weight := uint(100)
	unhealthy := &Channel{Id: 17, Status: common.ChannelStatusEnabled, Weight: &weight, Priority: &priority}
	healthy := &Channel{Id: 29, Status: common.ChannelStatusEnabled, Weight: &weight, Priority: &priority}
	SetChannelCacheForTest(map[int]*Channel{17: unhealthy, 29: healthy}, map[string]map[string][]int{
		"default": {"gpt-5.5": {17, 29}},
	})

	key := ChannelHealthKey{ChannelID: 17, Model: "gpt-5.5", Path: "/v1/responses"}
	for i := 0; i < channelHealthFailureThreshold; i++ {
		RecordChannelOutcome(key, ChannelOutcome{StatusCode: 503})
	}

	selected, err := GetRandomSatisfiedChannelWithOptions("default", "gpt-5.5", 0, ChannelSelectionOptions{Path: "/v1/responses"})
	if err != nil {
		t.Fatalf("GetRandomSatisfiedChannelWithOptions returned error: %v", err)
	}
	if selected == nil || selected.Id != 29 {
		t.Fatalf("selected channel = %#v, want healthy channel 29", selected)
	}
}

// TestSelectAcquirableChannelFallsBackWhenInitialPickLosesAcquireRace
// reproduces the "forward-only retry" bug: the weighted-selection loop must
// try every candidate (wrapping around), not just those at or after the
// randomly chosen starting index. Channel 29's health lease is pre-consumed
// (simulating a concurrent request that already won the half-open probe),
// so every call must fall back to channel 17 regardless of which index the
// weighted-random pick starts at.
func TestSelectAcquirableChannelFallsBackWhenInitialPickLosesAcquireRace(t *testing.T) {
	oldHealthEnabled := common.AdaptiveChannelHealthEnabled
	common.AdaptiveChannelHealthEnabled = true
	clearChannelHealthForTest()
	t.Cleanup(func() {
		clearChannelHealthForTest()
		common.AdaptiveChannelHealthEnabled = oldHealthEnabled
	})

	healthy := &Channel{Id: 17}
	consumed := &Channel{Id: 29}
	candidates := []*Channel{healthy, consumed}
	weights := []int{100, 100}

	key29 := ChannelHealthKey{ChannelID: 29, Model: "gpt-5.5", Path: "/v1/responses"}
	for i := 0; i < channelHealthFailureThreshold; i++ {
		RecordChannelOutcome(key29, ChannelOutcome{StatusCode: 503})
	}
	adaptiveChannelHealth.mu.Lock()
	adaptiveChannelHealth.entries[key29].openUntil = time.Now().Add(-time.Second)
	adaptiveChannelHealth.mu.Unlock()
	if !AcquireChannelHealth(key29) {
		t.Fatal("setup: expected to win the initial probe lease for channel 29")
	}

	// Regardless of which candidate the weighted-random pick starts at,
	// channel 29's lease is already taken, so every call must resolve to
	// the still-healthy channel 17 instead of "channel not found".
	const attempts = 20
	for i := 0; i < attempts; i++ {
		selected, err := selectAcquirableChannel(candidates, weights, "gpt-5.5", "/v1/responses")
		if err != nil {
			t.Fatalf("attempt %d: selectAcquirableChannel returned error: %v", i, err)
		}
		if selected == nil || selected.Id != 17 {
			t.Fatalf("attempt %d: selected = %#v, want channel 17", i, selected)
		}
	}
}

func TestGetRandomSatisfiedChannelExcludesAttemptedChannelOnRetry(t *testing.T) {
	oldMemoryCacheEnabled := common.MemoryCacheEnabled
	common.MemoryCacheEnabled = true
	ClearChannelCacheForTest()
	clearChannelCooldownsForTest()
	t.Cleanup(func() {
		clearChannelCooldownsForTest()
		ClearChannelCacheForTest()
		common.MemoryCacheEnabled = oldMemoryCacheEnabled
	})

	priority := int64(10)
	weight := uint(0)
	failed := &Channel{Id: 17, Status: common.ChannelStatusEnabled, Weight: &weight, Priority: &priority}
	healthy := &Channel{Id: 29, Status: common.ChannelStatusEnabled, Weight: &weight, Priority: &priority}
	SetChannelCacheForTest(map[int]*Channel{17: failed, 29: healthy}, map[string]map[string][]int{
		"default": {"gpt-5.5": {17, 29}},
	})

	selected, err := GetRandomSatisfiedChannelWithOptions("default", "gpt-5.5", 1, ChannelSelectionOptions{
		ExcludedChannelIDs:   map[int]struct{}{17: {}},
		AllowCoolingFallback: false,
	})
	if err != nil {
		t.Fatalf("GetRandomSatisfiedChannelWithOptions returned error: %v", err)
	}
	if selected == nil || selected.Id != 29 {
		t.Fatalf("expected unattempted channel 29, got %#v", selected)
	}
}

func TestGetRandomSatisfiedChannelDoesNotReuseCoolingChannelOnRetry(t *testing.T) {
	oldMemoryCacheEnabled := common.MemoryCacheEnabled
	common.MemoryCacheEnabled = true
	ClearChannelCacheForTest()
	clearChannelCooldownsForTest()
	t.Cleanup(func() {
		clearChannelCooldownsForTest()
		ClearChannelCacheForTest()
		common.MemoryCacheEnabled = oldMemoryCacheEnabled
	})

	priority := int64(10)
	weight := uint(0)
	channel := &Channel{Id: 17, Status: common.ChannelStatusEnabled, Weight: &weight, Priority: &priority}
	SetChannelCacheForTest(map[int]*Channel{17: channel}, map[string]map[string][]int{
		"default": {"gpt-5.5": {17}},
	})
	CooldownChannel(17, "upstream timeout", time.Minute)

	selected, err := GetRandomSatisfiedChannelWithOptions("default", "gpt-5.5", 1, ChannelSelectionOptions{
		AllowCoolingFallback: false,
	})
	if err != nil {
		t.Fatalf("GetRandomSatisfiedChannelWithOptions returned error: %v", err)
	}
	if selected != nil {
		t.Fatalf("expected no healthy retry channel, got %#v", selected)
	}
}

func TestGetRandomSatisfiedChannelReturnsCoolingChannelWhenAllCandidatesCoolingWithMemoryCache(t *testing.T) {
	oldMemoryCacheEnabled := common.MemoryCacheEnabled
	common.MemoryCacheEnabled = true
	ClearChannelCacheForTest()
	clearChannelCooldownsForTest()
	t.Cleanup(func() {
		clearChannelCooldownsForTest()
		ClearChannelCacheForTest()
		common.MemoryCacheEnabled = oldMemoryCacheEnabled
	})

	priority := int64(10)
	weight := uint(0)
	channel := &Channel{Id: 17, Type: 1, Key: "key-17", Status: common.ChannelStatusEnabled, Name: "cooling", Weight: &weight, Priority: &priority, Models: "gpt-5.5", Group: "default"}
	SetChannelCacheForTest(map[int]*Channel{17: channel}, map[string]map[string][]int{
		"default": {"gpt-5.5": {17}},
	})
	CooldownChannel(17, "Insufficient account balance", time.Minute)

	selected, err := GetRandomSatisfiedChannel("default", "gpt-5.5", 0)
	if err != nil {
		t.Fatalf("GetRandomSatisfiedChannel returned error: %v", err)
	}
	if selected == nil || selected.Id != 17 {
		t.Fatalf("expected cooling fallback channel 17, got %#v", selected)
	}
}

// TestSelectAcquirableAbilityChannelIdFallsBackWhenInitialPickLosesAcquireRace
// is the DB-path (Ability-based) counterpart of
// TestSelectAcquirableChannelFallsBackWhenInitialPickLosesAcquireRace: it
// proves GetChannelWithOptions's weighted-selection loop has the same
// wrap-around fallback as the cache path, deterministically rather than
// relying on goroutine-scheduling luck to observe a lost probe-lease race.
func TestSelectAcquirableAbilityChannelIdFallsBackWhenInitialPickLosesAcquireRace(t *testing.T) {
	oldHealthEnabled := common.AdaptiveChannelHealthEnabled
	common.AdaptiveChannelHealthEnabled = true
	clearChannelHealthForTest()
	t.Cleanup(func() {
		clearChannelHealthForTest()
		common.AdaptiveChannelHealthEnabled = oldHealthEnabled
	})

	candidates := []Ability{
		{ChannelId: 17},
		{ChannelId: 29},
	}
	weights := []int{100, 100}

	key29 := ChannelHealthKey{ChannelID: 29, Model: "gpt-5.5", Path: "/v1/responses"}
	for i := 0; i < channelHealthFailureThreshold; i++ {
		RecordChannelOutcome(key29, ChannelOutcome{StatusCode: 503})
	}
	adaptiveChannelHealth.mu.Lock()
	adaptiveChannelHealth.entries[key29].openUntil = time.Now().Add(-time.Second)
	adaptiveChannelHealth.mu.Unlock()
	if !AcquireChannelHealth(key29) {
		t.Fatal("setup: expected to win the initial probe lease for channel 29")
	}

	const attempts = 20
	for i := 0; i < attempts; i++ {
		channelId := selectAcquirableAbilityChannelId(candidates, weights, "gpt-5.5", "/v1/responses")
		if channelId != 17 {
			t.Fatalf("attempt %d: selectAcquirableAbilityChannelId = %d, want 17", i, channelId)
		}
	}
}

func TestGetChannelReturnsCoolingChannelWhenAllCandidatesCoolingWithoutMemoryCache(t *testing.T) {
	setupChannelSelectionTestDB(t)

	priority := int64(10)
	weight := uint(0)
	channel := Channel{Id: 17, Type: 1, Key: "key-17", Status: common.ChannelStatusEnabled, Name: "cooling", Weight: &weight, Priority: &priority, Models: "gpt-5.5", Group: "default"}
	if err := DB.Create(&channel).Error; err != nil {
		t.Fatalf("seed channel: %v", err)
	}
	ability := Ability{Group: "default", Model: "gpt-5.5", ChannelId: 17, Enabled: true, Priority: &priority, Weight: weight}
	if err := DB.Create(&ability).Error; err != nil {
		t.Fatalf("seed ability: %v", err)
	}

	CooldownChannel(17, "Insufficient account balance", time.Minute)

	selected, err := GetChannel("default", "gpt-5.5", 0)
	if err != nil {
		t.Fatalf("GetChannel returned error: %v", err)
	}
	if selected == nil || selected.Id != 17 {
		t.Fatalf("expected cooling fallback channel 17, got %#v", selected)
	}
}
