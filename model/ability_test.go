package model

import (
	"testing"

	"github.com/QuantumNous/new-api/common"
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
