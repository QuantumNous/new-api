package model

import (
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func setupCodexGovernanceTestDB(t *testing.T) *gorm.DB {
	t.Helper()

	originalDB := DB
	originalUsingSQLite := common.UsingSQLite
	originalUsingMySQL := common.UsingMySQL
	originalUsingPostgreSQL := common.UsingPostgreSQL
	originalCommonGroupCol := commonGroupCol

	db, err := gorm.Open(sqlite.Open("file:"+t.Name()+"?mode=memory&cache=shared"), &gorm.Config{})
	require.NoError(t, err)
	sqlDB, err := db.DB()
	require.NoError(t, err)
	sqlDB.SetMaxOpenConns(1)
	require.NoError(t, db.AutoMigrate(&Channel{}, &Ability{}, &CodexModelGovernanceRecord{}))

	DB = db
	common.UsingSQLite = true
	common.UsingMySQL = false
	common.UsingPostgreSQL = false
	commonGroupCol = "`group`"

	t.Cleanup(func() {
		DB = originalDB
		common.UsingSQLite = originalUsingSQLite
		common.UsingMySQL = originalUsingMySQL
		common.UsingPostgreSQL = originalUsingPostgreSQL
		commonGroupCol = originalCommonGroupCol
		require.NoError(t, sqlDB.Close())
	})

	return db
}

func insertCodexGovernanceChannel(t *testing.T, id int, channelType int, models string) {
	t.Helper()

	priority := int64(0)
	weight := uint(0)
	channel := &Channel{
		Id:       id,
		Type:     channelType,
		Key:      "test-key",
		Name:     "test-channel",
		Status:   common.ChannelStatusEnabled,
		Models:   models,
		Group:    "default",
		Priority: &priority,
		Weight:   &weight,
	}
	require.NoError(t, DB.Create(channel).Error)
	require.NoError(t, channel.AddAbilities(nil))
}

func TestCodexGovernanceDecodeChannelIDsTrimsDedupesAndIgnoresInvalid(t *testing.T) {
	got := decodeCodexModelGovernanceChannelIDs(" 3,0,abc, 2,3, -4, 2 ")

	require.Equal(t, []int{3, 2}, got)
}

func TestCodexGovernanceUpsertPendingDisablesAffectedCodexAbilities(t *testing.T) {
	setupCodexGovernanceTestDB(t)
	insertCodexGovernanceChannel(t, 11, constant.ChannelTypeCodex, "gpt-5.3-codex,gpt-5.4-codex")
	insertCodexGovernanceChannel(t, 12, constant.ChannelTypeOpenAI, "gpt-5.3-codex")
	insertCodexGovernanceChannel(t, 13, constant.ChannelTypeCodex, "gpt-5.3-codex")

	record, err := UpsertCodexModelGovernancePending(CodexModelGovernancePendingInput{
		ModelName:          "gpt-5.3-codex",
		Source:             CodexModelGovernanceSourceProbe,
		MatchedRule:        "default-unsupported",
		LastError:          "The 'gpt-5.3-codex' model is not supported when using Codex with a ChatGPT account.",
		AffectedChannelIDs: []int{11, 13, 13, 0, -1},
	})

	require.NoError(t, err)
	require.NotNil(t, record)
	require.Equal(t, CodexModelGovernanceStatusUnsupportedPendingReview, record.Status)
	require.Equal(t, "11,13", record.AffectedChannelIDs)

	var disabledCodexCount int64
	require.NoError(t, DB.Model(&Ability{}).
		Where("model = ? AND channel_id IN ? AND enabled = ?", "gpt-5.3-codex", []int{11, 13}, false).
		Count(&disabledCodexCount).Error)
	require.Equal(t, int64(2), disabledCodexCount)

	var untouchedOtherModel Ability
	require.NoError(t, DB.First(&untouchedOtherModel, "channel_id = ? AND model = ?", 11, "gpt-5.4-codex").Error)
	require.True(t, untouchedOtherModel.Enabled)

	var untouchedNonCodex Ability
	require.NoError(t, DB.First(&untouchedNonCodex, "channel_id = ? AND model = ?", 12, "gpt-5.3-codex").Error)
	require.True(t, untouchedNonCodex.Enabled)
}

func TestCodexGovernanceRemoveModelUpdatesChannelsAndAbilities(t *testing.T) {
	setupCodexGovernanceTestDB(t)
	insertCodexGovernanceChannel(t, 21, constant.ChannelTypeCodex, "gpt-5.3-codex,gpt-5.4-codex")
	insertCodexGovernanceChannel(t, 22, constant.ChannelTypeCodex, "gpt-5.3-codex")
	insertCodexGovernanceChannel(t, 23, constant.ChannelTypeOpenAI, "gpt-5.3-codex")

	require.NoError(t, RemoveCodexModelFromChannels("gpt-5.3-codex", []int{21, 22, 23}))

	var first Channel
	require.NoError(t, DB.First(&first, "id = ?", 21).Error)
	require.Equal(t, "gpt-5.4-codex", first.Models)

	var second Channel
	require.NoError(t, DB.First(&second, "id = ?", 22).Error)
	require.Empty(t, second.Models)

	var nonCodex Channel
	require.NoError(t, DB.First(&nonCodex, "id = ?", 23).Error)
	require.Equal(t, "gpt-5.3-codex", nonCodex.Models)

	var removedAbilityCount int64
	require.NoError(t, DB.Model(&Ability{}).
		Where("model = ? AND channel_id IN ?", "gpt-5.3-codex", []int{21, 22}).
		Count(&removedAbilityCount).Error)
	require.Zero(t, removedAbilityCount)

	var remainingAbility Ability
	require.NoError(t, DB.First(&remainingAbility, "channel_id = ? AND model = ?", 21, "gpt-5.4-codex").Error)
	require.True(t, remainingAbility.Enabled)
}
