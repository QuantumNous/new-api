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
