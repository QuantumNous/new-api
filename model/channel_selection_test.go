package model

import (
	"fmt"
	"net/http"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/dto"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func setupChannelSelectionTestDB(t *testing.T) {
	t.Helper()

	oldDB := DB
	oldMemoryCacheEnabled := common.MemoryCacheEnabled
	oldMainDatabaseType := common.MainDatabaseType()

	common.MemoryCacheEnabled = false
	common.SetMainDatabaseType(common.DatabaseTypeSQLite)
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
		common.SetMainDatabaseType(oldMainDatabaseType)
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

	channel, err := GetChannel("default", "gpt-5.5", 0, "/v1/chat/completions")
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
		selected, err := selectAcquirableChannel(candidates, weights, "gpt-5.5", "/v1/responses", nil)
		if err != nil {
			t.Fatalf("attempt %d: selectAcquirableChannel returned error: %v", i, err)
		}
		if selected == nil || selected.Id != 17 {
			t.Fatalf("attempt %d: selected = %#v, want channel 17", i, selected)
		}
	}
}

func TestSelectAcquirableChannelTreatsLostProbeLeaseAsExhaustion(t *testing.T) {
	oldHealthEnabled := common.AdaptiveChannelHealthEnabled
	common.AdaptiveChannelHealthEnabled = true
	clearChannelHealthForTest()
	t.Cleanup(func() {
		clearChannelHealthForTest()
		common.AdaptiveChannelHealthEnabled = oldHealthEnabled
	})

	key := ChannelHealthKey{ChannelID: 41, Model: "gpt-5.6-sol", Path: "/v1/responses"}
	for i := 0; i < channelHealthFailureThreshold; i++ {
		RecordChannelOutcome(key, ChannelOutcome{StatusCode: http.StatusServiceUnavailable})
	}
	adaptiveChannelHealth.mu.Lock()
	adaptiveChannelHealth.entries[key].openUntil = time.Now().Add(-time.Second)
	adaptiveChannelHealth.mu.Unlock()
	require.True(t, AcquireChannelHealth(key))

	selected, err := selectAcquirableChannel(
		[]*Channel{{Id: 41}},
		[]int{100},
		"gpt-5.6-sol",
		"/v1/responses",
		nil,
	)
	require.NoError(t, err)
	assert.Nil(t, selected)
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

func TestGetRandomSatisfiedChannelPrefersDifferentHostAfterTransportFailure(t *testing.T) {
	oldMemoryCacheEnabled := common.MemoryCacheEnabled
	common.MemoryCacheEnabled = true
	ClearChannelCacheForTest()
	t.Cleanup(func() {
		ClearChannelCacheForTest()
		common.MemoryCacheEnabled = oldMemoryCacheEnabled
	})

	priority := int64(10)
	weight := uint(100)
	sharedURL := "https://SHARED.example:443/v1"
	otherURL := "https://other.example/v1"
	channels := map[int]*Channel{
		17: {Id: 17, Status: common.ChannelStatusEnabled, Weight: &weight, Priority: &priority, BaseURL: &sharedURL},
		29: {Id: 29, Status: common.ChannelStatusEnabled, Weight: &weight, Priority: &priority, BaseURL: &sharedURL},
		41: {Id: 41, Status: common.ChannelStatusEnabled, Weight: &weight, Priority: &priority, BaseURL: &otherURL},
	}
	SetChannelCacheForTest(channels, map[string]map[string][]int{
		"default": {"gpt-5.5": {17, 29, 41}},
	})

	selected, err := GetRandomSatisfiedChannelWithOptions("default", "gpt-5.5", 0, ChannelSelectionOptions{
		ExcludedChannelIDs:   map[int]struct{}{17: {}},
		AvoidChannelHosts:    map[string]struct{}{"shared.example": {}},
		AllowCoolingFallback: true,
		Path:                 "/v1/responses",
	})
	require.NoError(t, err)
	require.NotNil(t, selected)
	assert.Equal(t, 41, selected.Id)
}

func TestGetRandomSatisfiedChannelFallsBackToAvoidedHostWhenNoAlternative(t *testing.T) {
	oldMemoryCacheEnabled := common.MemoryCacheEnabled
	common.MemoryCacheEnabled = true
	ClearChannelCacheForTest()
	t.Cleanup(func() {
		ClearChannelCacheForTest()
		common.MemoryCacheEnabled = oldMemoryCacheEnabled
	})

	priority := int64(10)
	weight := uint(100)
	sharedURL := "https://shared.example/v1"
	channels := map[int]*Channel{
		17: {Id: 17, Status: common.ChannelStatusEnabled, Weight: &weight, Priority: &priority, BaseURL: &sharedURL},
		29: {Id: 29, Status: common.ChannelStatusEnabled, Weight: &weight, Priority: &priority, BaseURL: &sharedURL},
	}
	SetChannelCacheForTest(channels, map[string]map[string][]int{
		"default": {"gpt-5.5": {17, 29}},
	})

	selected, err := GetRandomSatisfiedChannelWithOptions("default", "gpt-5.5", 0, ChannelSelectionOptions{
		ExcludedChannelIDs: map[int]struct{}{17: {}},
		AvoidChannelHosts:  map[string]struct{}{"shared.example": {}},
		Path:               "/v1/responses",
	})
	require.NoError(t, err)
	require.NotNil(t, selected)
	assert.Equal(t, 29, selected.Id)
}

func TestSelectAcquirableChannelFallsBackToAvoidedHostAfterPreferredLeaseRace(t *testing.T) {
	oldHealthEnabled := common.AdaptiveChannelHealthEnabled
	common.AdaptiveChannelHealthEnabled = true
	clearChannelHealthForTest()
	t.Cleanup(func() {
		clearChannelHealthForTest()
		common.AdaptiveChannelHealthEnabled = oldHealthEnabled
	})

	preferredKey := ChannelHealthKey{ChannelID: 41, Model: "gpt-5.5", Path: "/v1/responses"}
	for i := 0; i < channelHealthFailureThreshold; i++ {
		RecordChannelOutcome(preferredKey, ChannelOutcome{StatusCode: http.StatusServiceUnavailable})
	}
	adaptiveChannelHealth.mu.Lock()
	adaptiveChannelHealth.entries[preferredKey].openUntil = time.Now().Add(-time.Second)
	adaptiveChannelHealth.mu.Unlock()
	require.True(t, AcquireChannelHealth(preferredKey))

	selected, err := selectAcquirableChannelWithFallback(
		[]*Channel{{Id: 41}}, []int{100},
		[]*Channel{{Id: 29}}, []int{100},
		"gpt-5.5", "/v1/responses",
		nil,
	)
	require.NoError(t, err)
	require.NotNil(t, selected)
	assert.Equal(t, 29, selected.Id)
}

func TestGetRandomSatisfiedChannelKeepsPriorityAheadOfHostPreference(t *testing.T) {
	oldMemoryCacheEnabled := common.MemoryCacheEnabled
	common.MemoryCacheEnabled = true
	ClearChannelCacheForTest()
	t.Cleanup(func() {
		ClearChannelCacheForTest()
		common.MemoryCacheEnabled = oldMemoryCacheEnabled
	})

	highPriority := int64(20)
	lowPriority := int64(10)
	weight := uint(100)
	sharedURL := "https://shared.example/v1"
	otherURL := "https://other.example/v1"
	SetChannelCacheForTest(map[int]*Channel{
		29: {Id: 29, Status: common.ChannelStatusEnabled, Weight: &weight, Priority: &highPriority, BaseURL: &sharedURL},
		41: {Id: 41, Status: common.ChannelStatusEnabled, Weight: &weight, Priority: &lowPriority, BaseURL: &otherURL},
	}, map[string]map[string][]int{
		"default": {"gpt-5.5": {29, 41}},
	})

	selected, err := GetRandomSatisfiedChannelWithOptions("default", "gpt-5.5", 0, ChannelSelectionOptions{
		AvoidChannelHosts: map[string]struct{}{"shared.example": {}},
		Path:              "/v1/responses",
	})
	require.NoError(t, err)
	require.NotNil(t, selected)
	assert.Equal(t, 29, selected.Id)
}

func TestGetRandomSatisfiedChannelCapacityRetryPrefersDifferentHostAcrossPriorities(t *testing.T) {
	oldMemoryCacheEnabled := common.MemoryCacheEnabled
	common.MemoryCacheEnabled = true
	ClearChannelCacheForTest()
	t.Cleanup(func() {
		ClearChannelCacheForTest()
		common.MemoryCacheEnabled = oldMemoryCacheEnabled
	})

	highPriority := int64(20)
	lowPriority := int64(10)
	weight := uint(100)
	failedHostURL := "https://failed.example/v1"
	otherHostURL := "https://other.example/v1"
	SetChannelCacheForTest(map[int]*Channel{
		29: {Id: 29, Status: common.ChannelStatusEnabled, Weight: &weight, Priority: &highPriority, BaseURL: &failedHostURL},
		41: {Id: 41, Status: common.ChannelStatusEnabled, Weight: &weight, Priority: &lowPriority, BaseURL: &otherHostURL},
	}, map[string]map[string][]int{
		"default": {"gpt-5.6-sol": {29, 41}},
	})

	selected, err := GetRandomSatisfiedChannelWithOptions("default", "gpt-5.6-sol", 0, ChannelSelectionOptions{
		AvoidChannelHosts:   map[string]struct{}{"failed.example": {}},
		PreferDifferentHost: true,
		Path:                "/v1/responses",
	})
	require.NoError(t, err)
	require.NotNil(t, selected)
	assert.Equal(t, 41, selected.Id)
}

func TestGetRandomSatisfiedChannelCapacityRetryStartsAtHighestDifferentHostPriority(t *testing.T) {
	oldMemoryCacheEnabled := common.MemoryCacheEnabled
	common.MemoryCacheEnabled = true
	ClearChannelCacheForTest()
	t.Cleanup(func() {
		ClearChannelCacheForTest()
		common.MemoryCacheEnabled = oldMemoryCacheEnabled
	})

	failedPriority := int64(30)
	highAlternativePriority := int64(20)
	lowAlternativePriority := int64(10)
	weight := uint(100)
	failedHostURL := "https://failed.example/v1"
	highAlternativeURL := "https://high.example/v1"
	lowAlternativeURL := "https://low.example/v1"
	SetChannelCacheForTest(map[int]*Channel{
		17: {Id: 17, Status: common.ChannelStatusEnabled, Weight: &weight, Priority: &failedPriority, BaseURL: &failedHostURL},
		29: {Id: 29, Status: common.ChannelStatusEnabled, Weight: &weight, Priority: &highAlternativePriority, BaseURL: &highAlternativeURL},
		41: {Id: 41, Status: common.ChannelStatusEnabled, Weight: &weight, Priority: &lowAlternativePriority, BaseURL: &lowAlternativeURL},
	}, map[string]map[string][]int{
		"default": {"gpt-5.6-sol": {17, 29, 41}},
	})

	selected, err := GetRandomSatisfiedChannelWithOptions("default", "gpt-5.6-sol", 1, ChannelSelectionOptions{
		AvoidChannelHosts:   map[string]struct{}{"failed.example": {}},
		PreferDifferentHost: true,
		Path:                "/v1/responses",
	})
	require.NoError(t, err)
	require.NotNil(t, selected)
	assert.Equal(t, 29, selected.Id)
}

func TestGetRandomSatisfiedChannelCapacityRetryFallsBackWhenDifferentHostCircuitIsOpen(t *testing.T) {
	oldMemoryCacheEnabled := common.MemoryCacheEnabled
	oldCircuitMode := common.UpstreamHostCircuitMode
	common.MemoryCacheEnabled = true
	common.UpstreamHostCircuitMode = common.UpstreamHostCircuitModeEnforce
	ClearChannelCacheForTest()
	ClearChannelHostCooldownsForTest()
	t.Cleanup(func() {
		ClearChannelHostCooldownsForTest()
		ClearChannelCacheForTest()
		common.UpstreamHostCircuitMode = oldCircuitMode
		common.MemoryCacheEnabled = oldMemoryCacheEnabled
	})

	highPriority := int64(20)
	lowPriority := int64(10)
	weight := uint(100)
	failedHostURL := "https://failed.example/v1"
	blockedAlternativeURL := "https://blocked.example/v1"
	SetChannelCacheForTest(map[int]*Channel{
		29: {Id: 29, Status: common.ChannelStatusEnabled, Weight: &weight, Priority: &highPriority, BaseURL: &failedHostURL},
		41: {Id: 41, Status: common.ChannelStatusEnabled, Weight: &weight, Priority: &lowPriority, BaseURL: &blockedAlternativeURL},
	}, map[string]map[string][]int{
		"default": {"gpt-5.6-sol": {29, 41}},
	})
	require.False(t, RecordChannelHostFailure("blocked.example", "gpt-5.6-sol", "/v1/responses", 41, "unavailable"))
	require.False(t, RecordChannelHostFailure("blocked.example", "gpt-5.6-sol", "/v1/responses", 41, "unavailable"))
	require.True(t, RecordChannelHostFailure("blocked.example", "gpt-5.6-sol", "/v1/responses", 42, "unavailable"))

	selected, err := GetRandomSatisfiedChannelWithOptions("default", "gpt-5.6-sol", 0, ChannelSelectionOptions{
		AvoidChannelHosts:    map[string]struct{}{"failed.example": {}},
		PreferDifferentHost:  true,
		AllowCoolingFallback: true,
		Path:                 "/v1/responses",
	})
	require.NoError(t, err)
	require.NotNil(t, selected)
	assert.Equal(t, 29, selected.Id)
}

func TestGetRandomSatisfiedChannelRetryPrefersDifferentHostWithinTargetPriority(t *testing.T) {
	oldMemoryCacheEnabled := common.MemoryCacheEnabled
	common.MemoryCacheEnabled = true
	ClearChannelCacheForTest()
	t.Cleanup(func() {
		ClearChannelCacheForTest()
		common.MemoryCacheEnabled = oldMemoryCacheEnabled
	})

	highPriority := int64(20)
	targetPriority := int64(10)
	weight := uint(100)
	sharedURL := "https://shared.example/v1"
	otherURL := "https://other.example/v1"
	SetChannelCacheForTest(map[int]*Channel{
		29: {Id: 29, Status: common.ChannelStatusEnabled, Weight: &weight, Priority: &highPriority, BaseURL: &otherURL},
		41: {Id: 41, Status: common.ChannelStatusEnabled, Weight: &weight, Priority: &targetPriority, BaseURL: &sharedURL},
		53: {Id: 53, Status: common.ChannelStatusEnabled, Weight: &weight, Priority: &targetPriority, BaseURL: &otherURL},
	}, map[string]map[string][]int{
		"default": {"gpt-5.5": {29, 41, 53}},
	})

	selected, err := GetRandomSatisfiedChannelWithOptions("default", "gpt-5.5", 1, ChannelSelectionOptions{
		AvoidChannelHosts: map[string]struct{}{"shared.example": {}},
		Path:              "/v1/responses",
	})
	require.NoError(t, err)
	require.NotNil(t, selected)
	assert.Equal(t, 53, selected.Id)
}

func TestGetChannelPrefersDifferentHostWithoutMemoryCache(t *testing.T) {
	setupChannelSelectionTestDB(t)

	priority := int64(10)
	weight := uint(100)
	sharedURL := "https://shared.example/v1"
	otherURL := "https://other.example/v1"
	channels := []Channel{
		{Id: 17, Type: 1, Key: "key-17", Status: common.ChannelStatusEnabled, Name: "failed", Weight: &weight, Priority: &priority, BaseURL: &sharedURL},
		{Id: 29, Type: 1, Key: "key-29", Status: common.ChannelStatusEnabled, Name: "same-host", Weight: &weight, Priority: &priority, BaseURL: &sharedURL},
		{Id: 41, Type: 1, Key: "key-41", Status: common.ChannelStatusEnabled, Name: "other-host", Weight: &weight, Priority: &priority, BaseURL: &otherURL},
	}
	require.NoError(t, DB.Create(&channels).Error)
	require.NoError(t, DB.Create(&[]Ability{
		{Group: "default", Model: "gpt-5.5", ChannelId: 17, Enabled: true, Priority: &priority, Weight: weight},
		{Group: "default", Model: "gpt-5.5", ChannelId: 29, Enabled: true, Priority: &priority, Weight: weight},
		{Group: "default", Model: "gpt-5.5", ChannelId: 41, Enabled: true, Priority: &priority, Weight: weight},
	}).Error)

	selected, err := GetChannelWithOptions("default", "gpt-5.5", 0, ChannelSelectionOptions{
		ExcludedChannelIDs: map[int]struct{}{17: {}},
		AvoidChannelHosts:  map[string]struct{}{"shared.example": {}},
		Path:               "/v1/responses",
	})
	require.NoError(t, err)
	require.NotNil(t, selected)
	assert.Equal(t, 41, selected.Id)
}

func TestGetChannelCapacityRetryPrefersDifferentHostAcrossPrioritiesWithoutMemoryCache(t *testing.T) {
	setupChannelSelectionTestDB(t)

	highPriority := int64(20)
	lowPriority := int64(10)
	weight := uint(100)
	failedHostURL := "https://failed.example/v1"
	otherHostURL := "https://other.example/v1"
	channels := []Channel{
		{Id: 29, Type: 1, Key: "key-29", Status: common.ChannelStatusEnabled, Name: "same-host", Weight: &weight, Priority: &highPriority, BaseURL: &failedHostURL},
		{Id: 41, Type: 1, Key: "key-41", Status: common.ChannelStatusEnabled, Name: "other-host", Weight: &weight, Priority: &lowPriority, BaseURL: &otherHostURL},
	}
	require.NoError(t, DB.Create(&channels).Error)
	require.NoError(t, DB.Create(&[]Ability{
		{Group: "default", Model: "gpt-5.6-sol", ChannelId: 29, Enabled: true, Priority: &highPriority, Weight: weight},
		{Group: "default", Model: "gpt-5.6-sol", ChannelId: 41, Enabled: true, Priority: &lowPriority, Weight: weight},
	}).Error)

	selected, err := GetChannelWithOptions("default", "gpt-5.6-sol", 0, ChannelSelectionOptions{
		AvoidChannelHosts:   map[string]struct{}{"failed.example": {}},
		PreferDifferentHost: true,
		Path:                "/v1/responses",
	})
	require.NoError(t, err)
	require.NotNil(t, selected)
	assert.Equal(t, 41, selected.Id)
}

func TestGetChannelCapacityRetryFallsBackWhenDifferentHostCircuitIsOpenWithoutMemoryCache(t *testing.T) {
	setupChannelSelectionTestDB(t)

	oldCircuitMode := common.UpstreamHostCircuitMode
	common.UpstreamHostCircuitMode = common.UpstreamHostCircuitModeEnforce
	ClearChannelHostCooldownsForTest()
	t.Cleanup(func() {
		ClearChannelHostCooldownsForTest()
		common.UpstreamHostCircuitMode = oldCircuitMode
	})

	highPriority := int64(20)
	lowPriority := int64(10)
	weight := uint(100)
	failedHostURL := "https://failed.example/v1"
	blockedAlternativeURL := "https://blocked.example/v1"
	channels := []Channel{
		{Id: 29, Type: 1, Key: "key-29", Status: common.ChannelStatusEnabled, Name: "same-host", Weight: &weight, Priority: &highPriority, BaseURL: &failedHostURL},
		{Id: 41, Type: 1, Key: "key-41", Status: common.ChannelStatusEnabled, Name: "other-host", Weight: &weight, Priority: &lowPriority, BaseURL: &blockedAlternativeURL},
	}
	require.NoError(t, DB.Create(&channels).Error)
	require.NoError(t, DB.Create(&[]Ability{
		{Group: "default", Model: "gpt-5.6-sol", ChannelId: 29, Enabled: true, Priority: &highPriority, Weight: weight},
		{Group: "default", Model: "gpt-5.6-sol", ChannelId: 41, Enabled: true, Priority: &lowPriority, Weight: weight},
	}).Error)
	require.False(t, RecordChannelHostFailure("blocked.example", "gpt-5.6-sol", "/v1/responses", 41, "unavailable"))
	require.False(t, RecordChannelHostFailure("blocked.example", "gpt-5.6-sol", "/v1/responses", 41, "unavailable"))
	require.True(t, RecordChannelHostFailure("blocked.example", "gpt-5.6-sol", "/v1/responses", 42, "unavailable"))

	selected, err := GetChannelWithOptions("default", "gpt-5.6-sol", 0, ChannelSelectionOptions{
		AvoidChannelHosts:    map[string]struct{}{"failed.example": {}},
		PreferDifferentHost:  true,
		AllowCoolingFallback: true,
		Path:                 "/v1/responses",
	})
	require.NoError(t, err)
	require.NotNil(t, selected)
	assert.Equal(t, 29, selected.Id)
}

func TestAvoidedHostLookupDoesNotOverwriteMalformedChannel(t *testing.T) {
	setupChannelSelectionTestDB(t)

	priority := int64(10)
	weight := uint(100)
	baseURL := "https://malformed.example/v1"
	channel := Channel{
		Id:            73,
		Type:          constant.ChannelTypeAdvancedCustom,
		Key:           "preserve-secret-key",
		Status:        common.ChannelStatusEnabled,
		Name:          "preserve-name",
		Weight:        &weight,
		Priority:      &priority,
		BaseURL:       &baseURL,
		Models:        "gpt-5.5",
		Group:         "default",
		OtherSettings: "{malformed",
	}
	require.NoError(t, DB.Create(&channel).Error)

	avoided := avoidedHostChannelIDs(
		[]Ability{{ChannelId: channel.Id}},
		map[string]struct{}{"malformed.example": {}},
		"/v1/responses",
		"gpt-5.5",
	)
	assert.Contains(t, avoided, channel.Id)

	var stored Channel
	require.NoError(t, DB.First(&stored, channel.Id).Error)
	assert.Equal(t, channel.Key, stored.Key)
	assert.Equal(t, channel.Status, stored.Status)
	assert.Equal(t, channel.Name, stored.Name)
	assert.Equal(t, channel.Models, stored.Models)
	assert.Equal(t, channel.Group, stored.Group)
	assert.Equal(t, channel.OtherSettings, stored.OtherSettings)
}

func TestGetChannelUsesAdvancedCustomRouteHostWithoutMemoryCache(t *testing.T) {
	setupChannelSelectionTestDB(t)

	priority := int64(10)
	weight := uint(100)
	baseA := "https://configured-a.example"
	baseB := "https://configured-b.example"
	channels := []Channel{
		{Id: 81, Type: constant.ChannelTypeAdvancedCustom, Key: "key-81", Status: common.ChannelStatusEnabled, Name: "failed-real", Weight: &weight, Priority: &priority, BaseURL: &baseA, Models: "gpt-5.5", Group: "default"},
		{Id: 82, Type: constant.ChannelTypeAdvancedCustom, Key: "key-82", Status: common.ChannelStatusEnabled, Name: "other-real", Weight: &weight, Priority: &priority, BaseURL: &baseB, Models: "gpt-5.5", Group: "default"},
	}
	channels[0].SetOtherSettings(dto.ChannelOtherSettings{AdvancedCustom: &dto.AdvancedCustomConfig{Routes: []dto.AdvancedCustomRoute{{IncomingPath: "/v1/responses", UpstreamPath: "https://failed-real.example/v1/responses"}}}})
	channels[1].SetOtherSettings(dto.ChannelOtherSettings{AdvancedCustom: &dto.AdvancedCustomConfig{Routes: []dto.AdvancedCustomRoute{{IncomingPath: "/v1/responses", UpstreamPath: "https://other-real.example/v1/responses"}}}})
	require.NoError(t, DB.Create(&channels).Error)
	require.NoError(t, DB.Create(&[]Ability{
		{Group: "default", Model: "gpt-5.5", ChannelId: 81, Enabled: true, Priority: &priority, Weight: weight},
		{Group: "default", Model: "gpt-5.5", ChannelId: 82, Enabled: true, Priority: &priority, Weight: weight},
	}).Error)

	selected, err := GetChannelWithOptions("default", "gpt-5.5", 0, ChannelSelectionOptions{
		AvoidChannelHosts: map[string]struct{}{"failed-real.example": {}},
		RequestPath:       "/v1/responses",
		Path:              "/v1/responses",
	})
	require.NoError(t, err)
	require.NotNil(t, selected)
	assert.Equal(t, 82, selected.Id)
}

func TestSelectAcquirableAbilityFallsBackToAvoidedHostAfterPreferredLeaseRace(t *testing.T) {
	oldHealthEnabled := common.AdaptiveChannelHealthEnabled
	common.AdaptiveChannelHealthEnabled = true
	clearChannelHealthForTest()
	t.Cleanup(func() {
		clearChannelHealthForTest()
		common.AdaptiveChannelHealthEnabled = oldHealthEnabled
	})

	preferredKey := ChannelHealthKey{ChannelID: 41, Model: "gpt-5.5", Path: "/v1/responses"}
	for i := 0; i < channelHealthFailureThreshold; i++ {
		RecordChannelOutcome(preferredKey, ChannelOutcome{StatusCode: http.StatusServiceUnavailable})
	}
	adaptiveChannelHealth.mu.Lock()
	adaptiveChannelHealth.entries[preferredKey].openUntil = time.Now().Add(-time.Second)
	adaptiveChannelHealth.mu.Unlock()
	require.True(t, AcquireChannelHealth(preferredKey))

	selectedID := selectAcquirableAbilityChannelIdWithFallback(
		[]Ability{{ChannelId: 41}}, []int{100},
		[]Ability{{ChannelId: 29}}, []int{100},
		"gpt-5.5", "/v1/responses",
		nil,
	)
	assert.Equal(t, 29, selectedID)
}

func TestNormalizeChannelBaseURLHost(t *testing.T) {
	t.Parallel()

	assert.Equal(t, "shared.example", NormalizeChannelBaseURLHost(" https://SHARED.example:443/v1 "))
	assert.Equal(t, "shared.example", NormalizeChannelBaseURLHost("shared.example/v1"))
	assert.Empty(t, NormalizeChannelBaseURLHost(""))
}

func TestGetRandomSatisfiedChannelSkipsCooledHostAcrossChannelIDs(t *testing.T) {
	oldMemoryCacheEnabled := common.MemoryCacheEnabled
	oldHostCircuitMode := common.UpstreamHostCircuitMode
	common.MemoryCacheEnabled = true
	common.UpstreamHostCircuitMode = "enforce"
	ClearChannelCacheForTest()
	clearChannelCooldownsForTest()
	ClearChannelHostCooldownsForTest()
	t.Cleanup(func() {
		ClearChannelHostCooldownsForTest()
		clearChannelCooldownsForTest()
		ClearChannelCacheForTest()
		common.MemoryCacheEnabled = oldMemoryCacheEnabled
		common.UpstreamHostCircuitMode = oldHostCircuitMode
	})

	priority11 := int64(11)
	priority10 := int64(10)
	weight := uint(100)
	aiccxx := "https://aiccxx.cn/v1"
	healthy := "https://healthy.example/v1"
	SetChannelCacheForTest(map[int]*Channel{
		41: {Id: 41, Status: common.ChannelStatusEnabled, Weight: &weight, Priority: &priority11, BaseURL: &aiccxx},
		42: {Id: 42, Status: common.ChannelStatusEnabled, Weight: &weight, Priority: &priority11, BaseURL: &aiccxx},
		57: {Id: 57, Status: common.ChannelStatusEnabled, Weight: &weight, Priority: &priority10, BaseURL: &healthy},
	}, map[string]map[string][]int{
		"default": {"gpt-5.6-sol": {41, 42, 57}},
	})
	RecordChannelHostFailure("aiccxx.cn", "gpt-5.6-sol", "/v1/responses", 41, "response header timeout")
	RecordChannelHostFailure("aiccxx.cn", "gpt-5.6-sol", "/v1/responses", 41, "response header timeout")
	require.True(t, RecordChannelHostFailure("aiccxx.cn", "gpt-5.6-sol", "/v1/responses", 42, "response header timeout"))
	common.UpstreamHostCircuitMode = "observe"

	observedOnly, err := GetRandomSatisfiedChannelWithOptions("default", "gpt-5.6-sol", 0, ChannelSelectionOptions{
		AllowCoolingFallback: true,
		RequestPath:          "/v1/responses",
		Path:                 "/v1/responses",
	})
	require.NoError(t, err)
	require.NotNil(t, observedOnly)
	assert.Contains(t, []int{41, 42}, observedOnly.Id, "observe mode must preserve operator priority")

	common.UpstreamHostCircuitMode = "enforce"

	selected, err := GetRandomSatisfiedChannelWithOptions("default", "gpt-5.6-sol", 0, ChannelSelectionOptions{
		AllowCoolingFallback: true,
		RequestPath:          "/v1/responses",
		Path:                 "/v1/responses",
	})

	require.NoError(t, err)
	require.NotNil(t, selected)
	assert.Equal(t, 57, selected.Id)
}

func TestGetRandomSatisfiedChannelHostCooldownFallsBackWhenOnlyHost(t *testing.T) {
	oldMemoryCacheEnabled := common.MemoryCacheEnabled
	oldHostCircuitMode := common.UpstreamHostCircuitMode
	common.MemoryCacheEnabled = true
	common.UpstreamHostCircuitMode = "enforce"
	ClearChannelCacheForTest()
	ClearChannelHostCooldownsForTest()
	t.Cleanup(func() {
		ClearChannelHostCooldownsForTest()
		ClearChannelCacheForTest()
		common.MemoryCacheEnabled = oldMemoryCacheEnabled
		common.UpstreamHostCircuitMode = oldHostCircuitMode
	})

	priority := int64(10)
	weight := uint(100)
	baseURL := "https://only.example/v1"
	SetChannelCacheForTest(map[int]*Channel{
		17: {Id: 17, Status: common.ChannelStatusEnabled, Weight: &weight, Priority: &priority, BaseURL: &baseURL},
	}, map[string]map[string][]int{
		"default": {"gpt-5.6-sol": {17}},
	})
	RecordChannelHostFailure("only.example", "gpt-5.6-sol", "/v1/responses", 17, "response header timeout")
	RecordChannelHostFailure("only.example", "gpt-5.6-sol", "/v1/responses", 17, "response header timeout")
	require.True(t, RecordChannelHostFailure("only.example", "gpt-5.6-sol", "/v1/responses", 18, "response header timeout"))

	selected, err := GetRandomSatisfiedChannelWithOptions("default", "gpt-5.6-sol", 0, ChannelSelectionOptions{
		AllowCoolingFallback: true,
		RequestPath:          "/v1/responses",
		Path:                 "/v1/responses",
	})

	require.NoError(t, err)
	require.NotNil(t, selected)
	assert.Equal(t, 17, selected.Id)
}

func TestGetChannelSkipsCooledHostWithoutMemoryCache(t *testing.T) {
	setupChannelSelectionTestDB(t)
	oldHostCircuitMode := common.UpstreamHostCircuitMode
	common.UpstreamHostCircuitMode = "enforce"
	ClearChannelHostCooldownsForTest()
	t.Cleanup(func() {
		ClearChannelHostCooldownsForTest()
		common.UpstreamHostCircuitMode = oldHostCircuitMode
	})

	priority11 := int64(11)
	priority10 := int64(10)
	weight := uint(100)
	aiccxx := "https://aiccxx.cn/v1"
	healthy := "https://healthy.example/v1"
	channels := []Channel{
		{Id: 41, Type: 1, Key: "key-41", Status: common.ChannelStatusEnabled, Name: "aiccxx-41", Weight: &weight, Priority: &priority11, BaseURL: &aiccxx, Models: "gpt-5.6-sol", Group: "default"},
		{Id: 42, Type: 1, Key: "key-42", Status: common.ChannelStatusEnabled, Name: "aiccxx-42", Weight: &weight, Priority: &priority11, BaseURL: &aiccxx, Models: "gpt-5.6-sol", Group: "default"},
		{Id: 57, Type: 1, Key: "key-57", Status: common.ChannelStatusEnabled, Name: "healthy", Weight: &weight, Priority: &priority10, BaseURL: &healthy, Models: "gpt-5.6-sol", Group: "default"},
	}
	require.NoError(t, DB.Create(&channels).Error)
	abilities := []Ability{
		{Group: "default", Model: "gpt-5.6-sol", ChannelId: 41, Enabled: true, Priority: &priority11, Weight: weight},
		{Group: "default", Model: "gpt-5.6-sol", ChannelId: 42, Enabled: true, Priority: &priority11, Weight: weight},
		{Group: "default", Model: "gpt-5.6-sol", ChannelId: 57, Enabled: true, Priority: &priority10, Weight: weight},
	}
	require.NoError(t, DB.Create(&abilities).Error)
	RecordChannelHostFailure("aiccxx.cn", "gpt-5.6-sol", "/v1/responses", 41, "response header timeout")
	RecordChannelHostFailure("aiccxx.cn", "gpt-5.6-sol", "/v1/responses", 41, "response header timeout")
	require.True(t, RecordChannelHostFailure("aiccxx.cn", "gpt-5.6-sol", "/v1/responses", 42, "response header timeout"))

	selected, err := GetChannelWithOptions("default", "gpt-5.6-sol", 0, ChannelSelectionOptions{
		AllowCoolingFallback: true,
		RequestPath:          "/v1/responses",
		Path:                 "/v1/responses",
	})

	require.NoError(t, err)
	require.NotNil(t, selected)
	assert.Equal(t, 57, selected.Id)
}

func TestGetRandomSatisfiedChannelUsesAdvancedCustomRouteHost(t *testing.T) {
	oldMemoryCacheEnabled := common.MemoryCacheEnabled
	common.MemoryCacheEnabled = true
	ClearChannelCacheForTest()
	t.Cleanup(func() {
		ClearChannelCacheForTest()
		common.MemoryCacheEnabled = oldMemoryCacheEnabled
	})

	priority := int64(10)
	weight := uint(100)
	baseA := "https://configured-a.example"
	baseB := "https://configured-b.example"
	SetChannelCacheForTest(map[int]*Channel{
		17: {Id: 17, Type: constant.ChannelTypeAdvancedCustom, Status: common.ChannelStatusEnabled, Weight: &weight, Priority: &priority, BaseURL: &baseA},
		29: {Id: 29, Type: constant.ChannelTypeAdvancedCustom, Status: common.ChannelStatusEnabled, Weight: &weight, Priority: &priority, BaseURL: &baseB},
	}, map[string]map[string][]int{
		"default": {"gpt-5.5": {17, 29}},
	})
	channel2advancedCustomConfig = map[int]*dto.AdvancedCustomConfig{
		17: {Routes: []dto.AdvancedCustomRoute{{IncomingPath: "/v1/responses", UpstreamPath: "https://failed-real.example/v1/responses"}}},
		29: {Routes: []dto.AdvancedCustomRoute{{IncomingPath: "/v1/responses", UpstreamPath: "https://other-real.example/v1/responses"}}},
	}

	selected, err := GetRandomSatisfiedChannelWithOptions("default", "gpt-5.5", 0, ChannelSelectionOptions{
		AvoidChannelHosts: map[string]struct{}{"failed-real.example": {}},
		RequestPath:       "/v1/responses",
		Path:              "/v1/responses",
	})
	require.NoError(t, err)
	require.NotNil(t, selected)
	assert.Equal(t, 29, selected.Id)
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

// TestGetRandomSatisfiedChannelUsesCoolingFallbackOnRetryWhenHealthyExhausted
// covers the last-resort fallback (B1): on a retry where the only healthy
// channel has already been tried (excluded) and the remaining candidate is
// cooling, selection must reach for the cooling channel rather than return "no
// available channel" — when cooling fallback is permitted.
func TestGetRandomSatisfiedChannelUsesCoolingFallbackOnRetryWhenHealthyExhausted(t *testing.T) {
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
	tried := &Channel{Id: 17, Type: 1, Key: "key-17", Status: common.ChannelStatusEnabled, Name: "tried", Weight: &weight, Priority: &priority, Models: "gpt-5.5", Group: "default"}
	cooling := &Channel{Id: 29, Type: 1, Key: "key-29", Status: common.ChannelStatusEnabled, Name: "cooling", Weight: &weight, Priority: &priority, Models: "gpt-5.5", Group: "default"}
	SetChannelCacheForTest(map[int]*Channel{17: tried, 29: cooling}, map[string]map[string][]int{
		"default": {"gpt-5.5": {17, 29}},
	})
	CooldownChannel(29, "upstream timeout", time.Minute)

	selected, err := GetRandomSatisfiedChannelWithOptions("default", "gpt-5.5", 1, ChannelSelectionOptions{
		ExcludedChannelIDs:   map[int]struct{}{17: {}},
		AllowCoolingFallback: true,
	})
	if err != nil {
		t.Fatalf("GetRandomSatisfiedChannelWithOptions returned error: %v", err)
	}
	if selected == nil || selected.Id != 29 {
		t.Fatalf("expected cooling fallback channel 29, got %#v", selected)
	}
}

func TestGetRandomSatisfiedChannelDoesNotFallbackToStrictCoolingChannelWithMemoryCache(t *testing.T) {
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
	channel := &Channel{Id: 17, Type: 1, Key: "key-17", Status: common.ChannelStatusEnabled, Name: "rate-limited", Weight: &weight, Priority: &priority, Models: "gpt-5.5", Group: "default"}
	SetChannelCacheForTest(map[int]*Channel{17: channel}, map[string]map[string][]int{
		"default": {"gpt-5.5": {17}},
	})
	CooldownChannelWithoutFallback(17, "upstream_rate_limit", time.Hour)

	selected, err := GetRandomSatisfiedChannelWithOptions("default", "gpt-5.5", 0, ChannelSelectionOptions{
		AllowCoolingFallback: true,
	})
	require.NoError(t, err)
	assert.Nil(t, selected, "strict cooldown must not be bypassed when healthy channels are exhausted")
}

// TestCoolingFallbackDoesNotReuseExcludedChannelOnRetry is B1's safety property:
// even with cooling fallback permitted, a channel already tried this request
// (in ExcludedChannelIDs) is never re-selected — so a channel that just failed
// cannot be immediately retried under the guise of last-resort fallback.
func TestCoolingFallbackDoesNotReuseExcludedChannelOnRetry(t *testing.T) {
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
	channel := &Channel{Id: 17, Type: 1, Key: "key-17", Status: common.ChannelStatusEnabled, Name: "tried-and-cooling", Weight: &weight, Priority: &priority, Models: "gpt-5.5", Group: "default"}
	SetChannelCacheForTest(map[int]*Channel{17: channel}, map[string]map[string][]int{
		"default": {"gpt-5.5": {17}},
	})
	CooldownChannel(17, "upstream timeout", time.Minute)

	selected, err := GetRandomSatisfiedChannelWithOptions("default", "gpt-5.5", 1, ChannelSelectionOptions{
		ExcludedChannelIDs:   map[int]struct{}{17: {}},
		AllowCoolingFallback: true,
	})
	if err != nil {
		t.Fatalf("GetRandomSatisfiedChannelWithOptions returned error: %v", err)
	}
	if selected != nil {
		t.Fatalf("excluded channel must not be reused even under cooling fallback, got %#v", selected)
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

	selected, err := GetRandomSatisfiedChannel("default", "gpt-5.5", 0, "/v1/chat/completions")
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
		channelId := selectAcquirableAbilityChannelId(candidates, weights, "gpt-5.5", "/v1/responses", nil)
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

	selected, err := GetChannel("default", "gpt-5.5", 0, "/v1/chat/completions")
	if err != nil {
		t.Fatalf("GetChannel returned error: %v", err)
	}
	if selected == nil || selected.Id != 17 {
		t.Fatalf("expected cooling fallback channel 17, got %#v", selected)
	}
}

func TestGetChannelDoesNotFallbackToStrictCoolingChannelWithoutMemoryCache(t *testing.T) {
	setupChannelSelectionTestDB(t)

	priority := int64(10)
	weight := uint(0)
	channel := Channel{Id: 17, Type: 1, Key: "key-17", Status: common.ChannelStatusEnabled, Name: "rate-limited", Weight: &weight, Priority: &priority, Models: "gpt-5.5", Group: "default"}
	require.NoError(t, DB.Create(&channel).Error)
	ability := Ability{Group: "default", Model: "gpt-5.5", ChannelId: 17, Enabled: true, Priority: &priority, Weight: weight}
	require.NoError(t, DB.Create(&ability).Error)

	CooldownChannelWithoutFallback(17, "upstream_rate_limit", time.Hour)

	selected, err := GetChannelWithOptions("default", "gpt-5.5", 0, ChannelSelectionOptions{
		AllowCoolingFallback: true,
		RequestPath:          "/v1/responses",
		Path:                 "/v1/responses",
	})
	require.NoError(t, err)
	assert.Nil(t, selected, "strict cooldown must be enforced without the memory cache")
}
