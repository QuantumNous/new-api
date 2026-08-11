package model

import (
	"fmt"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func TestRequiredChannelTypeFiltersDatabaseCandidates(t *testing.T) {
	originalDB := DB
	originalGroupCol := commonGroupCol
	originalMemoryCacheEnabled := common.MemoryCacheEnabled
	dsn := fmt.Sprintf("file:%s?mode=memory&cache=shared", strings.ReplaceAll(t.Name(), "/", "_"))
	db, err := gorm.Open(sqlite.Open(dsn), &gorm.Config{})
	require.NoError(t, err)
	require.NoError(t, db.AutoMigrate(&Channel{}, &Ability{}))
	DB = db
	commonGroupCol = "`group`"
	common.MemoryCacheEnabled = false
	t.Cleanup(func() {
		DB = originalDB
		commonGroupCol = originalGroupCol
		common.MemoryCacheEnabled = originalMemoryCacheEnabled
		sqlDB, sqlErr := db.DB()
		if sqlErr == nil {
			require.NoError(t, sqlDB.Close())
		}
	})

	highPriority := int64(100)
	lowPriority := int64(0)
	weight := uint(100)
	channels := []*Channel{
		// An enabled ability can temporarily outlive a disabled channel. The
		// legacy untyped database selector includes that ability, so type 0 must
		// preserve its selection semantics.
		{Id: 4101, Type: constant.ChannelTypeGemini, Key: "gemini", Status: common.ChannelStatusManuallyDisabled, Name: "gemini", Models: "storage:gs:bucket-a", Group: "default", Priority: &highPriority, Weight: &weight},
		{Id: 4102, Type: constant.ChannelTypeVertexAi, Key: "vertex", Status: common.ChannelStatusEnabled, Name: "vertex", Models: "storage:gs:bucket-a", Group: "default", Priority: &lowPriority, Weight: &weight},
	}
	for _, channel := range channels {
		require.NoError(t, db.Create(channel).Error)
		require.NoError(t, db.Create(&Ability{
			Group: channel.Group, Model: channel.Models, ChannelId: channel.Id,
			Enabled: true, Priority: channel.Priority, Weight: weight,
		}).Error)
	}

	t.Run("limits candidates to the requested channel type", func(t *testing.T) {
		selected, err := GetChannelByType(
			"default", "storage:gs:bucket-a", 0,
			"/vertexai/storage/v1/b/bucket-a/o", constant.ChannelTypeVertexAi,
		)

		require.NoError(t, err)
		require.NotNil(t, selected)
		assert.Equal(t, 4102, selected.Id)
		assert.Equal(t, constant.ChannelTypeVertexAi, selected.Type)
	})

	t.Run("zero preserves the unrestricted candidate set", func(t *testing.T) {
		selected, err := GetChannelByType(
			"default", "storage:gs:bucket-a", 0,
			"/vertexai/storage/v1/b/bucket-a/o", 0,
		)

		require.NoError(t, err)
		require.NotNil(t, selected)
		assert.Equal(t, 4101, selected.Id)
		assert.Equal(t, constant.ChannelTypeGemini, selected.Type)
	})
}
