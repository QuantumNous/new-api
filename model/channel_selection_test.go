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

func TestGetRandomSatisfiedChannelFiltersImageCapabilityBeforePriority(t *testing.T) {
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
	oneK := &Channel{Id: 65, Status: common.ChannelStatusEnabled, Weight: &weight, Priority: &highPriority}
	fourK := &Channel{Id: 108, Status: common.ChannelStatusEnabled, Weight: &weight, Priority: &lowPriority}
	oneK.SetOtherSettings(dto.ChannelOtherSettings{ImageRouting: verifiedImageRoutingProfile("gpt-image-2", []string{"1K"}, []string{"1024x1024"})})
	fourK.SetOtherSettings(dto.ChannelOtherSettings{ImageRouting: verifiedImageRoutingProfile("gpt-image-2", []string{"1K", "4K"}, []string{"1024x1024", "2880x2880"})})
	SetChannelCacheForTest(map[int]*Channel{65: oneK, 108: fourK}, map[string]map[string][]int{
		"default": {"gpt-image-2": {65, 108}},
	})

	requirement := &dto.ImageSelectionRequirement{
		Operation:   dto.ImageOperationGeneration,
		Resolution:  "4K",
		AspectRatio: "1:1",
		Size:        "2880x2880",
		Quality:     "low",
	}
	selected, err := GetRandomSatisfiedChannelWithOptions("default", "gpt-image-2", 0, ChannelSelectionOptions{
		ImageRequirement: requirement,
	})
	require.NoError(t, err)
	require.NotNil(t, selected)
	assert.Equal(t, 108, selected.Id)

	selected, err = GetRandomSatisfiedChannelWithOptions("default", "gpt-image-2", 1, ChannelSelectionOptions{
		ExcludedChannelIDs: map[int]struct{}{108: {}},
		ImageRequirement:   requirement,
	})
	require.NoError(t, err)
	assert.Nil(t, selected, "retry must not fall back to an incompatible channel")
}

func TestGetRandomSatisfiedChannelLeavesLegacyUnconfiguredChannelEligible(t *testing.T) {
	oldMemoryCacheEnabled := common.MemoryCacheEnabled
	common.MemoryCacheEnabled = true
	ClearChannelCacheForTest()
	t.Cleanup(func() {
		ClearChannelCacheForTest()
		common.MemoryCacheEnabled = oldMemoryCacheEnabled
	})

	priority := int64(10)
	weight := uint(100)
	legacy := &Channel{Id: 31, Status: common.ChannelStatusEnabled, Weight: &weight, Priority: &priority}
	SetChannelCacheForTest(map[int]*Channel{31: legacy}, map[string]map[string][]int{
		"default": {"gpt-image-2": {31}},
	})

	selected, err := GetRandomSatisfiedChannelWithOptions("default", "gpt-image-2", 0, ChannelSelectionOptions{
		ImageRequirement: &dto.ImageSelectionRequirement{
			Operation:  dto.ImageOperationGeneration,
			Resolution: "4K",
		},
	})
	require.NoError(t, err)
	require.NotNil(t, selected)
	assert.Equal(t, 31, selected.Id)
}

func TestGetRandomSatisfiedChannelRejectsUnverifiedConfiguredChannel(t *testing.T) {
	oldMemoryCacheEnabled := common.MemoryCacheEnabled
	common.MemoryCacheEnabled = true
	ClearChannelCacheForTest()
	t.Cleanup(func() {
		ClearChannelCacheForTest()
		common.MemoryCacheEnabled = oldMemoryCacheEnabled
	})

	priority := int64(10)
	weight := uint(100)
	channel := &Channel{Id: 87, Status: common.ChannelStatusEnabled, Weight: &weight, Priority: &priority}
	routing := verifiedImageRoutingProfile("gpt-image-2", []string{"4K"}, []string{"2880x2880"})
	routing.Profiles[0].VerificationStatus = dto.ImageRoutingVerificationDocsClaimed
	channel.SetOtherSettings(dto.ChannelOtherSettings{ImageRouting: routing})
	SetChannelCacheForTest(map[int]*Channel{87: channel}, map[string]map[string][]int{
		"default": {"gpt-image-2": {87}},
	})

	selected, err := GetRandomSatisfiedChannelWithOptions("default", "gpt-image-2", 0, ChannelSelectionOptions{
		ImageRequirement: &dto.ImageSelectionRequirement{
			Operation:  dto.ImageOperationGeneration,
			Resolution: "4K",
		},
	})
	require.NoError(t, err)
	assert.Nil(t, selected)
}

func TestImageSelectionRejectsInvalidRequirementEvenForLegacyChannel(t *testing.T) {
	channel := &Channel{Id: 31}
	require.False(t, ChannelSupportsImageSelection(channel, "gpt-image-2", &dto.ImageSelectionRequirement{
		Operation:  dto.ImageOperationGeneration,
		Resolution: "ultra",
	}))

	oldMemoryCacheEnabled := common.MemoryCacheEnabled
	common.MemoryCacheEnabled = true
	ClearChannelCacheForTest()
	t.Cleanup(func() {
		ClearChannelCacheForTest()
		common.MemoryCacheEnabled = oldMemoryCacheEnabled
	})
	priority := int64(10)
	weight := uint(100)
	channel.Status = common.ChannelStatusEnabled
	channel.Priority = &priority
	channel.Weight = &weight
	SetChannelCacheForTest(map[int]*Channel{31: channel}, map[string]map[string][]int{
		"default": {"gpt-image-2": {31}},
	})

	selected, err := GetRandomSatisfiedChannelWithOptions("default", "gpt-image-2", 0, ChannelSelectionOptions{
		ImageRequirement: &dto.ImageSelectionRequirement{
			Operation:  dto.ImageOperationGeneration,
			Resolution: "ultra",
		},
	})
	require.Error(t, err)
	assert.Nil(t, selected)
}

func TestChannelValidateSettingsValidatesImageRouting(t *testing.T) {
	channel := &Channel{}
	invalid := verifiedImageRoutingProfile("gpt-image-2", []string{"4K"}, []string{"2880x2880"})
	invalid.Version = 99
	channel.SetOtherSettings(dto.ChannelOtherSettings{ImageRouting: invalid})

	err := channel.ValidateSettings()
	require.Error(t, err)
	assert.Contains(t, err.Error(), "image_routing.version")

	channel.SetOtherSettings(dto.ChannelOtherSettings{ImageRouting: verifiedImageRoutingProfile(
		"gpt-image-2",
		[]string{"4K"},
		[]string{"2880x2880"},
	)})
	require.NoError(t, channel.ValidateSettings())
}

func TestChannelSupportsImageSelectionUsesVerifiedProfileAndAllowedCombination(t *testing.T) {
	channel := &Channel{Id: 108}
	channel.SetOtherSettings(dto.ChannelOtherSettings{ImageRouting: verifiedImageRoutingProfile(
		"gpt-image-2",
		[]string{"1K", "4K"},
		[]string{"1024x1024", "2880x2880"},
	)})

	assert.True(t, ChannelSupportsImageSelection(channel, "gpt-image-2", &dto.ImageSelectionRequirement{
		Operation:   dto.ImageOperationGeneration,
		Resolution:  "4K",
		AspectRatio: "1:1",
		Size:        "2880x2880",
		Quality:     "low",
	}))
	assert.False(t, ChannelSupportsImageSelection(channel, "gpt-image-2", &dto.ImageSelectionRequirement{
		Operation:   dto.ImageOperationGeneration,
		Resolution:  "4K",
		AspectRatio: "1:1",
		Size:        "1024x1024",
		Quality:     "low",
	}))

	profile, configured := ChannelImageRoutingProfile(channel, "gpt-image-2")
	require.True(t, configured)
	require.NotNil(t, profile)
	assert.Equal(t, dto.ImageRoutingProtocolImagesGenerations, profile.Protocol)
	assert.Equal(t, "/v1/images/generations", profile.UpstreamPath)
}

func TestGetChannelWithOptionsFiltersImageCapabilityWithoutMemoryCache(t *testing.T) {
	setupChannelSelectionTestDB(t)

	highPriority := int64(20)
	lowPriority := int64(10)
	weight := uint(100)
	oneK := Channel{Id: 65, Type: 1, Key: "key-65", Status: common.ChannelStatusEnabled, Name: "1k", Weight: &weight, Priority: &highPriority, Models: "gpt-image-2", Group: "default"}
	fourK := Channel{Id: 108, Type: 1, Key: "key-108", Status: common.ChannelStatusEnabled, Name: "4k", Weight: &weight, Priority: &lowPriority, Models: "gpt-image-2", Group: "default"}
	oneK.SetOtherSettings(dto.ChannelOtherSettings{ImageRouting: verifiedImageRoutingProfile("gpt-image-2", []string{"1K"}, []string{"1024x1024"})})
	fourK.SetOtherSettings(dto.ChannelOtherSettings{ImageRouting: verifiedImageRoutingProfile("gpt-image-2", []string{"4K"}, []string{"2880x2880"})})
	require.NoError(t, DB.Create(&[]Channel{oneK, fourK}).Error)
	require.NoError(t, DB.Create(&[]Ability{
		{Group: "default", Model: "gpt-image-2", ChannelId: 65, Enabled: true, Priority: &highPriority, Weight: weight},
		{Group: "default", Model: "gpt-image-2", ChannelId: 108, Enabled: true, Priority: &lowPriority, Weight: weight},
	}).Error)

	selected, err := GetChannelWithOptions("default", "gpt-image-2", 0, ChannelSelectionOptions{
		ImageRequirement: &dto.ImageSelectionRequirement{
			Operation:   dto.ImageOperationGeneration,
			Resolution:  "4K",
			AspectRatio: "1:1",
			Size:        "2880x2880",
			Quality:     "low",
		},
	})
	require.NoError(t, err)
	require.NotNil(t, selected)
	assert.Equal(t, 108, selected.Id)
}

func verifiedImageRoutingProfile(model string, resolutions []string, sizes []string) *dto.ImageRoutingConfig {
	combinations := make([]dto.ImageRoutingCombination, 0, len(resolutions))
	for i, resolution := range resolutions {
		combination := dto.ImageRoutingCombination{Resolution: resolution, AspectRatio: "1:1"}
		if i < len(sizes) {
			combination.Size = sizes[i]
		}
		combinations = append(combinations, combination)
	}
	return &dto.ImageRoutingConfig{
		Version: dto.ImageRoutingVersion1,
		Profiles: []dto.ImageRoutingProfile{
			{
				Model:               model,
				Protocol:            dto.ImageRoutingProtocolImagesGenerations,
				UpstreamPath:        "/v1/images/generations",
				Operations:          []dto.ImageOperation{dto.ImageOperationGeneration, dto.ImageOperationEdit},
				Resolutions:         append([]string(nil), resolutions...),
				AspectRatios:        []string{"1:1"},
				Sizes:               append([]string(nil), sizes...),
				Qualities:           []string{"low", "high"},
				AllowedCombinations: combinations,
				VerificationStatus:  dto.ImageRoutingVerificationProductionVerified,
			},
		},
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
