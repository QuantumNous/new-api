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

func TestGetChannelPreferMeasuredFastWithoutMemoryCache(t *testing.T) {
	setupChannelSelectionTestDB(t)

	oldHealthEnabled := common.AdaptiveChannelHealthEnabled
	common.AdaptiveChannelHealthEnabled = true
	clearChannelHealthForTest()
	t.Cleanup(func() {
		clearChannelHealthForTest()
		common.AdaptiveChannelHealthEnabled = oldHealthEnabled
	})

	priority := int64(10)
	weight := uint(0)
	const modelName = "gpt-5.6-sol-db-affinity"
	channels := []Channel{
		{Id: 617, Type: 1, Key: "key-617", Status: common.ChannelStatusEnabled, Name: "fast", Weight: &weight, Priority: &priority, Models: modelName, Group: "default"},
		{Id: 641, Type: 1, Key: "key-641", Status: common.ChannelStatusEnabled, Name: "slow-a", Weight: &weight, Priority: &priority, Models: modelName, Group: "default"},
		{Id: 651, Type: 1, Key: "key-651", Status: common.ChannelStatusEnabled, Name: "slow-b", Weight: &weight, Priority: &priority, Models: modelName, Group: "default"},
	}
	require.NoError(t, DB.Create(&channels).Error)
	require.NoError(t, DB.Create(&[]Ability{
		{Group: "default", Model: modelName, ChannelId: 617, Enabled: true, Priority: &priority, Weight: weight},
		{Group: "default", Model: modelName, ChannelId: 641, Enabled: true, Priority: &priority, Weight: weight},
		{Group: "default", Model: modelName, ChannelId: 651, Enabled: true, Priority: &priority, Weight: weight},
	}).Error)

	for i := 0; i < 6; i++ {
		RecordChannelOutcome(ChannelHealthKey{ChannelID: 617, Model: modelName, Path: "/v1/responses"}, ChannelOutcome{StatusCode: 200, Latency: 1500 * time.Millisecond})
		RecordChannelOutcome(ChannelHealthKey{ChannelID: 641, Model: modelName, Path: "/v1/responses"}, ChannelOutcome{StatusCode: 200, Latency: 6 * time.Second})
		RecordChannelOutcome(ChannelHealthKey{ChannelID: 651, Model: modelName, Path: "/v1/responses"}, ChannelOutcome{StatusCode: 200, Latency: 6 * time.Second})
	}

	for i := 0; i < 100; i++ {
		selected, err := GetChannelWithOptions("default", modelName, 0, ChannelSelectionOptions{
			Path:               "/v1/responses",
			PreferMeasuredFast: true,
		})
		require.NoError(t, err)
		require.NotNil(t, selected)
		assert.Equal(t, 617, selected.Id)
	}
}

func TestGetChannelPreferMeasuredFastRespectsZeroWeightWithoutMemoryCache(t *testing.T) {
	setupChannelSelectionTestDB(t)

	oldHealthEnabled := common.AdaptiveChannelHealthEnabled
	common.AdaptiveChannelHealthEnabled = true
	clearChannelHealthForTest()
	t.Cleanup(func() {
		clearChannelHealthForTest()
		common.AdaptiveChannelHealthEnabled = oldHealthEnabled
	})

	priority := int64(10)
	zeroWeight := uint(0)
	activeWeight := uint(100)
	const modelName = "gpt-5.6-sol-db-affinity-weight"
	channels := []Channel{
		{Id: 817, Type: 1, Key: "key-817", Status: common.ChannelStatusEnabled, Name: "fast-zero-weight", Weight: &zeroWeight, Priority: &priority, Models: modelName, Group: "default"},
		{Id: 841, Type: 1, Key: "key-841", Status: common.ChannelStatusEnabled, Name: "slow-active", Weight: &activeWeight, Priority: &priority, Models: modelName, Group: "default"},
	}
	require.NoError(t, DB.Create(&channels).Error)
	require.NoError(t, DB.Create(&[]Ability{
		{Group: "default", Model: modelName, ChannelId: 817, Enabled: true, Priority: &priority, Weight: zeroWeight},
		{Group: "default", Model: modelName, ChannelId: 841, Enabled: true, Priority: &priority, Weight: activeWeight},
	}).Error)

	for i := 0; i < 6; i++ {
		RecordChannelOutcome(ChannelHealthKey{ChannelID: 817, Model: modelName, Path: "/v1/responses"}, ChannelOutcome{StatusCode: 200, Latency: 1500 * time.Millisecond})
		RecordChannelOutcome(ChannelHealthKey{ChannelID: 841, Model: modelName, Path: "/v1/responses"}, ChannelOutcome{StatusCode: 200, Latency: 6 * time.Second})
	}

	selected, err := GetChannelWithOptions("default", modelName, 0, ChannelSelectionOptions{
		Path:               "/v1/responses",
		PreferMeasuredFast: true,
	})
	require.NoError(t, err)
	require.NotNil(t, selected)
	assert.Equal(t, 841, selected.Id, "the DB selector must not make a zero-weight fast channel exclusive")
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

func TestPreferMeasuredFastRespectsConfiguredZeroWeight(t *testing.T) {
	oldMemoryCacheEnabled := common.MemoryCacheEnabled
	oldHealthEnabled := common.AdaptiveChannelHealthEnabled
	common.MemoryCacheEnabled = true
	common.AdaptiveChannelHealthEnabled = true
	ClearChannelCacheForTest()
	clearChannelHealthForTest()
	t.Cleanup(func() {
		clearChannelHealthForTest()
		ClearChannelCacheForTest()
		common.MemoryCacheEnabled = oldMemoryCacheEnabled
		common.AdaptiveChannelHealthEnabled = oldHealthEnabled
	})

	priority := int64(10)
	zeroWeight := uint(0)
	activeWeight := uint(100)
	const modelName = "gpt-5.6-sol-affinity-weight"
	SetChannelCacheForTest(map[int]*Channel{
		717: {Id: 717, Status: common.ChannelStatusEnabled, Weight: &zeroWeight, Priority: &priority},
		741: {Id: 741, Status: common.ChannelStatusEnabled, Weight: &activeWeight, Priority: &priority},
	}, map[string]map[string][]int{
		"default": {modelName: {717, 741}},
	})

	for i := 0; i < 6; i++ {
		RecordChannelOutcome(ChannelHealthKey{ChannelID: 717, Model: modelName, Path: "/v1/responses"}, ChannelOutcome{StatusCode: 200, Latency: 1500 * time.Millisecond})
		RecordChannelOutcome(ChannelHealthKey{ChannelID: 741, Model: modelName, Path: "/v1/responses"}, ChannelOutcome{StatusCode: 200, Latency: 6 * time.Second})
	}

	selected, err := GetRandomSatisfiedChannelWithOptions("default", modelName, 0, ChannelSelectionOptions{
		Path:               "/v1/responses",
		PreferMeasuredFast: true,
	})
	require.NoError(t, err)
	require.NotNil(t, selected)
	assert.Equal(t, 741, selected.Id, "fast affinity preference must not revive a channel configured with zero weight")
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

func TestFastPreferenceFallsBackWhenFastLeaseIsLost(t *testing.T) {
	oldHealthEnabled := common.AdaptiveChannelHealthEnabled
	common.AdaptiveChannelHealthEnabled = true
	clearChannelHealthForTest()
	t.Cleanup(func() {
		clearChannelHealthForTest()
		common.AdaptiveChannelHealthEnabled = oldHealthEnabled
	})

	fast := &Channel{Id: 917}
	slow := &Channel{Id: 941}
	key := ChannelHealthKey{ChannelID: fast.Id, Model: "gpt-5.6-sol-fast-race", Path: "/v1/responses"}
	for i := 0; i < channelHealthFailureThreshold; i++ {
		RecordChannelOutcome(key, ChannelOutcome{StatusCode: http.StatusServiceUnavailable})
	}
	adaptiveChannelHealth.mu.Lock()
	adaptiveChannelHealth.entries[key].openUntil = time.Now().Add(-time.Second)
	adaptiveChannelHealth.mu.Unlock()
	require.True(t, AcquireChannelHealth(key), "setup should consume the fast channel's half-open probe lease")

	selected, err := selectAcquirableChannelWithFastFallback(
		[]*Channel{fast}, []int{100},
		[]*Channel{fast, slow}, []int{100, 100},
		nil, nil,
		nil, nil,
		"gpt-5.6-sol-fast-race", "/v1/responses",
	)
	require.NoError(t, err)
	require.NotNil(t, selected)
	assert.Equal(t, slow.Id, selected.Id, "losing the fast lease must fall back to the original viable pool")
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
	)
	assert.Equal(t, 29, selectedID)
}

func TestNormalizeChannelBaseURLHost(t *testing.T) {
	t.Parallel()

	assert.Equal(t, "shared.example", NormalizeChannelBaseURLHost(" https://SHARED.example:443/v1 "))
	assert.Equal(t, "shared.example", NormalizeChannelBaseURLHost("shared.example/v1"))
	assert.Empty(t, NormalizeChannelBaseURLHost(""))
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

	selected, err := GetChannel("default", "gpt-5.5", 0, "/v1/chat/completions")
	if err != nil {
		t.Fatalf("GetChannel returned error: %v", err)
	}
	if selected == nil || selected.Id != 17 {
		t.Fatalf("expected cooling fallback channel 17, got %#v", selected)
	}
}
