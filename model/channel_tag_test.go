package model

import (
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/glebarez/sqlite"
	"gorm.io/gorm"
)

func setupChannelTagTestDB(t *testing.T) {
	t.Helper()

	oldDB := DB
	oldLogDB := LOG_DB
	oldUsingSQLite := common.UsingSQLite
	oldUsingMySQL := common.UsingMySQL
	oldUsingPostgreSQL := common.UsingPostgreSQL

	common.UsingSQLite = true
	common.UsingMySQL = false
	common.UsingPostgreSQL = false

	dsn := "file:" + strings.ReplaceAll(t.Name(), "/", "_") + "?mode=memory&cache=shared"
	db, err := gorm.Open(sqlite.Open(dsn), &gorm.Config{})
	if err != nil {
		t.Fatalf("failed to open sqlite db: %v", err)
	}
	DB = db
	LOG_DB = db

	if err := db.AutoMigrate(&Channel{}, &Ability{}); err != nil {
		t.Fatalf("failed to migrate channel tag test tables: %v", err)
	}

	t.Cleanup(func() {
		DB = oldDB
		LOG_DB = oldLogDB
		common.UsingSQLite = oldUsingSQLite
		common.UsingMySQL = oldUsingMySQL
		common.UsingPostgreSQL = oldUsingPostgreSQL
		sqlDB, err := db.DB()
		if err == nil {
			_ = sqlDB.Close()
		}
	})
}

func TestTagAggregationIncludesUntaggedChannels(t *testing.T) {
	setupChannelTagTestDB(t)

	emptyTag := ""
	channels := []Channel{
		{Name: "untagged nil", Key: "key-1", Models: "gpt-test", Group: "default"},
		{Name: "untagged empty", Key: "key-2", Models: "gpt-test", Group: "default", Tag: &emptyTag},
		{Name: "tagged alpha", Key: "key-3", Models: "gpt-test", Group: "default", Tag: common.GetPointer("alpha")},
	}
	if err := DB.Create(&channels).Error; err != nil {
		t.Fatalf("failed to create channels: %v", err)
	}

	total, err := CountAllTags()
	if err != nil {
		t.Fatalf("failed to count tags: %v", err)
	}
	if total != 2 {
		t.Fatalf("expected untagged bucket plus alpha tag, got %d", total)
	}

	tags, err := GetPaginatedTags(0, 10)
	if err != nil {
		t.Fatalf("failed to get paginated tags: %v", err)
	}
	tagSet := make(map[string]bool, len(tags))
	for _, tag := range tags {
		if tag == nil {
			t.Fatal("expected tag buckets to be non-nil")
		}
		tagSet[*tag] = true
	}
	if !tagSet[""] || !tagSet["alpha"] {
		t.Fatalf("expected tags to contain untagged bucket and alpha, got %#v", tagSet)
	}

	untagged, err := GetChannelsByTag("", false, false)
	if err != nil {
		t.Fatalf("failed to get untagged channels: %v", err)
	}
	if len(untagged) != 2 {
		t.Fatalf("expected two untagged channels, got %d", len(untagged))
	}

	if err := DisableChannelByTag(""); err != nil {
		t.Fatalf("failed to disable untagged channels: %v", err)
	}
	var disabled int64
	if err := withTagCondition(DB.Model(&Channel{}), "").
		Where("status = ?", common.ChannelStatusManuallyDisabled).
		Count(&disabled).Error; err != nil {
		t.Fatalf("failed to count disabled untagged channels: %v", err)
	}
	if disabled != 2 {
		t.Fatalf("expected two disabled untagged channels, got %d", disabled)
	}
}
