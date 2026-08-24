package model

import (
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func TestGetChannelCandidatesKeepsEmptyGroupCondition(t *testing.T) {
	originalDB := DB
	originalMemoryCacheEnabled := common.MemoryCacheEnabled
	originalUsingSQLite := common.UsingSQLite
	originalUsingMySQL := common.UsingMySQL
	originalUsingPostgreSQL := common.UsingPostgreSQL

	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	require.NoError(t, err)
	require.NoError(t, db.AutoMigrate(&Channel{}, &Ability{}))
	DB = db
	common.MemoryCacheEnabled = false
	common.UsingSQLite = true
	common.UsingMySQL = false
	common.UsingPostgreSQL = false
	t.Cleanup(func() {
		DB = originalDB
		common.MemoryCacheEnabled = originalMemoryCacheEnabled
		common.UsingSQLite = originalUsingSQLite
		common.UsingMySQL = originalUsingMySQL
		common.UsingPostgreSQL = originalUsingPostgreSQL
	})

	priority := int64(0)
	weight := uint(1)
	emptyGroupChannel := &Channel{
		Id:       9101,
		Status:   common.ChannelStatusEnabled,
		Priority: &priority,
		Weight:   &weight,
	}
	otherGroupChannel := &Channel{
		Id:       9102,
		Status:   common.ChannelStatusEnabled,
		Priority: &priority,
		Weight:   &weight,
	}
	require.NoError(t, DB.Create(emptyGroupChannel).Error)
	require.NoError(t, DB.Create(otherGroupChannel).Error)
	require.NoError(t, DB.Create(&Ability{Group: "", Model: "gpt-empty-group", ChannelId: emptyGroupChannel.Id, Enabled: true, Priority: &priority, Weight: weight}).Error)
	require.NoError(t, DB.Create(&Ability{Group: "default", Model: "gpt-empty-group", ChannelId: otherGroupChannel.Id, Enabled: true, Priority: &priority, Weight: weight}).Error)

	candidates, err := GetChannelCandidatesWithFilter("", "gpt-empty-group", 0, nil)

	require.NoError(t, err)
	require.Len(t, candidates, 1)
	require.Equal(t, emptyGroupChannel.Id, candidates[0].Id)
}

func TestGetChannelCandidatesWithFilterReturnsEmptyWhenRetryExhausted(t *testing.T) {
	originalDB := DB
	originalMemoryCacheEnabled := common.MemoryCacheEnabled
	originalUsingSQLite := common.UsingSQLite
	originalUsingMySQL := common.UsingMySQL
	originalUsingPostgreSQL := common.UsingPostgreSQL

	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	require.NoError(t, err)
	require.NoError(t, db.AutoMigrate(&Channel{}, &Ability{}))
	DB = db
	common.MemoryCacheEnabled = false
	common.UsingSQLite = true
	common.UsingMySQL = false
	common.UsingPostgreSQL = false
	t.Cleanup(func() {
		DB = originalDB
		common.MemoryCacheEnabled = originalMemoryCacheEnabled
		common.UsingSQLite = originalUsingSQLite
		common.UsingMySQL = originalUsingMySQL
		common.UsingPostgreSQL = originalUsingPostgreSQL
	})

	highPriority := int64(10)
	lowPriority := int64(0)
	weight := uint(1)
	highPriorityChannel := &Channel{
		Id:       9201,
		Status:   common.ChannelStatusEnabled,
		Priority: &highPriority,
		Weight:   &weight,
	}
	lowPriorityChannel := &Channel{
		Id:       9202,
		Status:   common.ChannelStatusEnabled,
		Priority: &lowPriority,
		Weight:   &weight,
	}
	require.NoError(t, DB.Create(highPriorityChannel).Error)
	require.NoError(t, DB.Create(lowPriorityChannel).Error)
	require.NoError(t, DB.Create(&Ability{Group: "default", Model: "gpt-retry-exhausted", ChannelId: highPriorityChannel.Id, Enabled: true, Priority: &highPriority, Weight: weight}).Error)
	require.NoError(t, DB.Create(&Ability{Group: "default", Model: "gpt-retry-exhausted", ChannelId: lowPriorityChannel.Id, Enabled: true, Priority: &lowPriority, Weight: weight}).Error)

	candidates, err := GetChannelCandidatesWithFilter("default", "gpt-retry-exhausted", 99, nil)

	require.NoError(t, err)
	require.Empty(t, candidates)
}

func setupGrokMediaAbilityTestDB(t *testing.T) {
	t.Helper()
	originalDB := DB
	originalMemoryCacheEnabled := common.MemoryCacheEnabled
	originalUsingSQLite := common.UsingSQLite
	originalUsingMySQL := common.UsingMySQL
	originalUsingPostgreSQL := common.UsingPostgreSQL

	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	require.NoError(t, err)
	require.NoError(t, db.AutoMigrate(&Channel{}, &Ability{}))
	DB = db
	common.MemoryCacheEnabled = false
	common.UsingSQLite = true
	common.UsingMySQL = false
	common.UsingPostgreSQL = false
	t.Cleanup(func() {
		DB = originalDB
		common.MemoryCacheEnabled = originalMemoryCacheEnabled
		common.UsingSQLite = originalUsingSQLite
		common.UsingMySQL = originalUsingMySQL
		common.UsingPostgreSQL = originalUsingPostgreSQL
	})
}

func TestSyncGrokMediaAbilitiesAddsAndRemovesExactlyMediaRows(t *testing.T) {
	setupGrokMediaAbilityTestDB(t)
	priority := int64(7)
	weight := uint(33)
	tag := "media-tag"
	channel := &Channel{
		Id:       9301,
		Type:     constant.ChannelTypeGrokSubscription,
		Key:      `{"version":1,"type":"grok_subscription","access_token":"at","token_type":"Bearer","expires_at":2000000000}`,
		Models:   "grok-4.6",
		Group:    "default,vip",
		Status:   common.ChannelStatusEnabled,
		Priority: &priority,
		Weight:   &weight,
		Tag:      &tag,
	}
	require.NoError(t, DB.Create(channel).Error)
	require.NoError(t, DB.Create(&Ability{Group: "default", Model: "grok-4.6", ChannelId: channel.Id, Enabled: true, Priority: &priority, Weight: weight, Tag: &tag}).Error)
	require.NoError(t, DB.Create(&Ability{Group: "default", Model: "custom-image-model", ChannelId: channel.Id, Enabled: true}).Error)
	require.NoError(t, DB.Create(&Ability{Group: "default", Model: "grok-imagine-video", ChannelId: 9999, Enabled: true}).Error)

	require.NoError(t, SyncGrokMediaAbilities(channel.Id, true))

	for _, modelName := range GrokMediaAbilityModels() {
		for _, group := range []string{"default", "vip"} {
			var ability Ability
			require.NoError(t, DB.First(&ability, "channel_id = ? AND model = ? AND `group` = ?", channel.Id, modelName, group).Error)
			require.True(t, ability.Enabled)
			require.Equal(t, priority, *ability.Priority)
			require.Equal(t, weight, ability.Weight)
			require.Equal(t, tag, *ability.Tag)
		}
	}
	var text Ability
	require.NoError(t, DB.First(&text, "channel_id = ? AND model = ?", channel.Id, "grok-4.6").Error)
	require.True(t, text.Enabled)
	var custom Ability
	require.NoError(t, DB.First(&custom, "channel_id = ? AND model = ?", channel.Id, "custom-image-model").Error)
	require.True(t, custom.Enabled)

	require.NoError(t, SyncGrokMediaAbilities(channel.Id, false))

	var ownMediaCount int64
	require.NoError(t, DB.Model(&Ability{}).Where("channel_id = ? AND model IN ?", channel.Id, GrokMediaAbilityModels()).Count(&ownMediaCount).Error)
	require.Zero(t, ownMediaCount)
	require.NoError(t, DB.First(&text, "channel_id = ? AND model = ?", channel.Id, "grok-4.6").Error)
	require.NoError(t, DB.First(&custom, "channel_id = ? AND model = ?", channel.Id, "custom-image-model").Error)
	var otherChannelMedia Ability
	require.NoError(t, DB.First(&otherChannelMedia, "channel_id = ? AND model = ?", 9999, "grok-imagine-video").Error)
}
