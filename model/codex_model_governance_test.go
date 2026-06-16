package model

import (
	"sync"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
	"gorm.io/gorm/schema"
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

func TestCodexGovernanceTimestampFieldsUseExplicitBigintType(t *testing.T) {
	parsed, err := schema.Parse(&CodexModelGovernanceRecord{}, &sync.Map{}, schema.NamingStrategy{})
	require.NoError(t, err)

	for _, fieldName := range []string{
		"DetectedAt",
		"LastCheckedAt",
		"LastAlertedAt",
		"ReviewedAt",
		"CreatedTime",
		"UpdatedTime",
	} {
		field := parsed.LookUpField(fieldName)
		require.NotNil(t, field, fieldName)
		require.Equal(t, "bigint", field.TagSettings["TYPE"], fieldName)
	}
}

func insertCodexGovernanceChannel(t *testing.T, id int, channelType int, models string) {
	t.Helper()
	insertCodexGovernanceChannelWithStatus(t, id, channelType, models, common.ChannelStatusEnabled)
}

func insertCodexGovernanceChannelWithStatus(t *testing.T, id int, channelType int, models string, status int) {
	t.Helper()

	priority := int64(0)
	weight := uint(0)
	channel := &Channel{
		Id:       id,
		Type:     channelType,
		Key:      "test-key",
		Name:     "test-channel",
		Status:   status,
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
		DisableAbilities:   true,
	})

	require.NoError(t, err)
	require.NotNil(t, record)
	require.Equal(t, CodexModelGovernanceStatusUnsupportedPendingReview, record.Status)
	require.Equal(t, "11,13", record.AffectedChannelIDs)
	require.True(t, record.AbilitiesDisabled)

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

func TestCodexGovernanceMemoryCacheSkipsDisabledAbilities(t *testing.T) {
	setupCodexGovernanceTestDB(t)
	originalMemoryCacheEnabled := common.MemoryCacheEnabled
	originalGroupCache := group2model2channels
	originalChannelCache := channelsIDM
	t.Cleanup(func() {
		common.MemoryCacheEnabled = originalMemoryCacheEnabled
		group2model2channels = originalGroupCache
		channelsIDM = originalChannelCache
	})
	common.MemoryCacheEnabled = true
	insertCodexGovernanceChannel(t, 14, constant.ChannelTypeCodex, "gpt-5.3-codex,gpt-5.4-codex")
	require.NoError(t, DisableCodexModelAbilities("gpt-5.3-codex", []int{14}))

	InitChannelCache()

	disabledChannel, err := GetRandomSatisfiedChannel("default", "gpt-5.3-codex", 0)
	require.NoError(t, err)
	require.Nil(t, disabledChannel)
	enabledChannel, err := GetRandomSatisfiedChannel("default", "gpt-5.4-codex", 0)
	require.NoError(t, err)
	require.NotNil(t, enabledChannel)
	require.Equal(t, 14, enabledChannel.Id)
}

func TestCodexGovernanceUpsertPendingRollsBackRecordWhenAbilityDisableFails(t *testing.T) {
	originalDB := DB
	originalUsingSQLite := common.UsingSQLite
	originalUsingMySQL := common.UsingMySQL
	originalUsingPostgreSQL := common.UsingPostgreSQL
	db, err := gorm.Open(sqlite.Open("file:"+t.Name()+"?mode=memory&cache=shared"), &gorm.Config{})
	require.NoError(t, err)
	sqlDB, err := db.DB()
	require.NoError(t, err)
	sqlDB.SetMaxOpenConns(1)
	require.NoError(t, db.AutoMigrate(&Channel{}, &CodexModelGovernanceRecord{}))
	DB = db
	common.UsingSQLite = true
	common.UsingMySQL = false
	common.UsingPostgreSQL = false
	t.Cleanup(func() {
		DB = originalDB
		common.UsingSQLite = originalUsingSQLite
		common.UsingMySQL = originalUsingMySQL
		common.UsingPostgreSQL = originalUsingPostgreSQL
		require.NoError(t, sqlDB.Close())
	})

	channel := &Channel{
		Id:     17,
		Type:   constant.ChannelTypeCodex,
		Key:    "test-key",
		Name:   "test-channel",
		Status: common.ChannelStatusEnabled,
		Models: "gpt-5.3-codex",
		Group:  "default",
	}
	require.NoError(t, DB.Create(channel).Error)

	record, err := UpsertCodexModelGovernancePending(CodexModelGovernancePendingInput{
		ModelName:          "gpt-5.3-codex",
		Source:             CodexModelGovernanceSourceProbe,
		AffectedChannelIDs: []int{17},
		DisableAbilities:   true,
	})

	require.Error(t, err)
	require.Nil(t, record)
	var count int64
	require.NoError(t, DB.Model(&CodexModelGovernanceRecord{}).Where("model_name = ?", "gpt-5.3-codex").Count(&count).Error)
	require.Zero(t, count)
}

func TestCodexGovernanceUpsertPendingMergesAffectedChannelsAcrossProbeRuns(t *testing.T) {
	setupCodexGovernanceTestDB(t)
	insertCodexGovernanceChannel(t, 71, constant.ChannelTypeCodex, "gpt-5.3-codex")
	insertCodexGovernanceChannel(t, 72, constant.ChannelTypeCodex, "gpt-5.3-codex")

	first, err := UpsertCodexModelGovernancePending(CodexModelGovernancePendingInput{
		ModelName:          "gpt-5.3-codex",
		Source:             CodexModelGovernanceSourceProbe,
		AffectedChannelIDs: []int{71},
		DisableAbilities:   true,
	})
	require.NoError(t, err)
	require.Equal(t, "71", first.AffectedChannelIDs)

	second, err := UpsertCodexModelGovernancePending(CodexModelGovernancePendingInput{
		ModelName:          "gpt-5.3-codex",
		Source:             CodexModelGovernanceSourceProbe,
		AffectedChannelIDs: []int{72},
		DisableAbilities:   true,
	})
	require.NoError(t, err)
	require.Equal(t, "71,72", second.AffectedChannelIDs)

	require.NoError(t, ReviewCodexModelGovernanceRecord(second.ID, CodexModelGovernanceStatusActive, 7, "restore all"))

	var restoredCount int64
	require.NoError(t, DB.Model(&Ability{}).
		Where("model = ? AND channel_id IN ? AND enabled = ?", "gpt-5.3-codex", []int{71, 72}, true).
		Count(&restoredCount).Error)
	require.Equal(t, int64(2), restoredCount)
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

func TestCodexGovernanceRemoveModelPreservesOtherModelDisabledAbility(t *testing.T) {
	setupCodexGovernanceTestDB(t)
	insertCodexGovernanceChannel(t, 24, constant.ChannelTypeCodex, "gpt-5.3-codex,gpt-5.4-codex")
	require.NoError(t, DisableCodexModelAbilities("gpt-5.4-codex", []int{24}))

	require.NoError(t, RemoveCodexModelFromChannels("gpt-5.3-codex", []int{24}))

	var removedCount int64
	require.NoError(t, DB.Model(&Ability{}).
		Where("channel_id = ? AND model = ?", 24, "gpt-5.3-codex").
		Count(&removedCount).Error)
	require.Zero(t, removedCount)

	var remainingAbility Ability
	require.NoError(t, DB.First(&remainingAbility, "channel_id = ? AND model = ?", 24, "gpt-5.4-codex").Error)
	require.False(t, remainingAbility.Enabled)
}

func TestCodexGovernanceRestoreDoesNotEnableDisabledChannels(t *testing.T) {
	setupCodexGovernanceTestDB(t)
	insertCodexGovernanceChannelWithStatus(t, 31, constant.ChannelTypeCodex, "gpt-5.3-codex", common.ChannelStatusManuallyDisabled)
	insertCodexGovernanceChannelWithStatus(t, 32, constant.ChannelTypeCodex, "gpt-5.3-codex", common.ChannelStatusEnabled)

	require.NoError(t, DisableCodexModelAbilities("gpt-5.3-codex", []int{31, 32}))
	require.NoError(t, RestoreCodexModelAbilities("gpt-5.3-codex", []int{31, 32}))

	var disabledChannelAbility Ability
	require.NoError(t, DB.First(&disabledChannelAbility, "channel_id = ? AND model = ?", 31, "gpt-5.3-codex").Error)
	require.False(t, disabledChannelAbility.Enabled)

	var enabledChannelAbility Ability
	require.NoError(t, DB.First(&enabledChannelAbility, "channel_id = ? AND model = ?", 32, "gpt-5.3-codex").Error)
	require.True(t, enabledChannelAbility.Enabled)
}

func TestCodexGovernanceUpsertPendingWithoutDisableKeepsAbilitiesEnabled(t *testing.T) {
	setupCodexGovernanceTestDB(t)
	insertCodexGovernanceChannel(t, 41, constant.ChannelTypeCodex, "gpt-5.3-codex")

	record, err := UpsertCodexModelGovernancePending(CodexModelGovernancePendingInput{
		ModelName:          "gpt-5.3-codex",
		Source:             CodexModelGovernanceSourceOfficialCodexNotice,
		MatchedRule:        "deprecated",
		LastError:          "gpt-5.3-codex is deprecated",
		AffectedChannelIDs: []int{41},
		DisableAbilities:   false,
	})

	require.NoError(t, err)
	require.NotNil(t, record)
	require.Equal(t, CodexModelGovernanceStatusUnsupportedPendingReview, record.Status)
	require.False(t, record.AbilitiesDisabled)

	var ability Ability
	require.NoError(t, DB.First(&ability, "channel_id = ? AND model = ?", 41, "gpt-5.3-codex").Error)
	require.True(t, ability.Enabled)
}

func TestCodexGovernanceGetRecordByModelName(t *testing.T) {
	setupCodexGovernanceTestDB(t)
	record, err := UpsertCodexModelGovernancePending(CodexModelGovernancePendingInput{
		ModelName: "gpt-5.3-codex",
		Source:    CodexModelGovernanceSourceOfficialCodexNotice,
	})
	require.NoError(t, err)

	got, err := GetCodexModelGovernanceRecordByModelName(" gpt-5.3-codex ")
	require.NoError(t, err)
	require.Equal(t, record.ID, got.ID)

	_, err = GetCodexModelGovernanceRecordByModelName("missing-codex")
	require.ErrorIs(t, err, gorm.ErrRecordNotFound)
}

func TestCodexGovernanceReviewDisableActionStoresReviewedDisabledStatus(t *testing.T) {
	setupCodexGovernanceTestDB(t)
	insertCodexGovernanceChannel(t, 51, constant.ChannelTypeCodex, "gpt-5.3-codex")

	record, err := UpsertCodexModelGovernancePending(CodexModelGovernancePendingInput{
		ModelName:          "gpt-5.3-codex",
		Source:             CodexModelGovernanceSourceOfficialCodexNotice,
		AffectedChannelIDs: []int{51},
		DisableAbilities:   false,
	})
	require.NoError(t, err)
	require.False(t, record.AbilitiesDisabled)

	require.NoError(t, ReviewCodexModelGovernanceRecord(record.ID, CodexModelGovernanceStatusUnsupportedDisabled, 7, "operator disable"))

	var updated CodexModelGovernanceRecord
	require.NoError(t, DB.First(&updated, "id = ?", record.ID).Error)
	require.Equal(t, CodexModelGovernanceStatusUnsupportedDisabled, updated.Status)
	require.True(t, updated.AbilitiesDisabled)
	require.Equal(t, 7, updated.ReviewedBy)
	require.NotZero(t, updated.ReviewedAt)

	var ability Ability
	require.NoError(t, DB.First(&ability, "channel_id = ? AND model = ?", 51, "gpt-5.3-codex").Error)
	require.False(t, ability.Enabled)
}

func TestCodexGovernanceUpsertPendingPreservesReviewedDisabledStatus(t *testing.T) {
	setupCodexGovernanceTestDB(t)
	insertCodexGovernanceChannel(t, 52, constant.ChannelTypeCodex, "gpt-5.3-codex")

	record, err := UpsertCodexModelGovernancePending(CodexModelGovernancePendingInput{
		ModelName:          "gpt-5.3-codex",
		Source:             CodexModelGovernanceSourceOfficialCodexNotice,
		AffectedChannelIDs: []int{52},
		DisableAbilities:   false,
	})
	require.NoError(t, err)
	require.NoError(t, ReviewCodexModelGovernanceRecord(record.ID, CodexModelGovernanceStatusUnsupportedDisabled, 7, "operator disable"))

	updated, err := UpsertCodexModelGovernancePending(CodexModelGovernancePendingInput{
		ModelName:          "gpt-5.3-codex",
		Source:             CodexModelGovernanceSourceProbe,
		LastError:          "still unsupported",
		AffectedChannelIDs: []int{52},
		DisableAbilities:   true,
	})

	require.NoError(t, err)
	require.Equal(t, CodexModelGovernanceStatusUnsupportedDisabled, updated.Status)
	require.True(t, updated.AbilitiesDisabled)
	require.Equal(t, "still unsupported", updated.LastError)
}

func TestCodexGovernanceReviewRejectsIgnoreWhenAbilitiesAreDisabled(t *testing.T) {
	setupCodexGovernanceTestDB(t)
	insertCodexGovernanceChannel(t, 53, constant.ChannelTypeCodex, "gpt-5.3-codex")

	record, err := UpsertCodexModelGovernancePending(CodexModelGovernancePendingInput{
		ModelName:          "gpt-5.3-codex",
		Source:             CodexModelGovernanceSourceProbe,
		AffectedChannelIDs: []int{53},
		DisableAbilities:   true,
	})
	require.NoError(t, err)

	err = ReviewCodexModelGovernanceRecord(record.ID, CodexModelGovernanceStatusIgnored, 7, "false positive")

	require.Error(t, err)
	require.Contains(t, err.Error(), "restore or remove")
	var updated CodexModelGovernanceRecord
	require.NoError(t, DB.First(&updated, "id = ?", record.ID).Error)
	require.Equal(t, CodexModelGovernanceStatusUnsupportedPendingReview, updated.Status)
	require.True(t, updated.AbilitiesDisabled)
	var ability Ability
	require.NoError(t, DB.First(&ability, "channel_id = ? AND model = ?", 53, "gpt-5.3-codex").Error)
	require.False(t, ability.Enabled)
}

func TestCodexGovernanceUpsertKeepsIgnoredAlertOnlyFindingIgnored(t *testing.T) {
	setupCodexGovernanceTestDB(t)
	insertCodexGovernanceChannel(t, 54, constant.ChannelTypeCodex, "gpt-5.3-codex")

	record, err := UpsertCodexModelGovernancePending(CodexModelGovernancePendingInput{
		ModelName:          "gpt-5.3-codex",
		Source:             CodexModelGovernanceSourceOfficialCodexNotice,
		MatchedRule:        "deprecated",
		AffectedChannelIDs: []int{54},
		DisableAbilities:   false,
	})
	require.NoError(t, err)
	require.NoError(t, ReviewCodexModelGovernanceRecord(record.ID, CodexModelGovernanceStatusIgnored, 7, "not actionable"))

	updated, err := UpsertCodexModelGovernancePending(CodexModelGovernancePendingInput{
		ModelName:          "gpt-5.3-codex",
		Source:             CodexModelGovernanceSourceOfficialCodexNotice,
		MatchedRule:        "deprecated",
		LastError:          "still mentioned",
		AffectedChannelIDs: []int{54},
		DisableAbilities:   false,
	})

	require.NoError(t, err)
	require.Equal(t, CodexModelGovernanceStatusIgnored, updated.Status)
	require.False(t, updated.AbilitiesDisabled)
	require.Equal(t, "still mentioned", updated.LastError)
}

func TestCodexGovernanceProbeReopensIgnoredAlertOnlyFinding(t *testing.T) {
	setupCodexGovernanceTestDB(t)
	insertCodexGovernanceChannel(t, 55, constant.ChannelTypeCodex, "gpt-5.3-codex")

	record, err := UpsertCodexModelGovernancePending(CodexModelGovernancePendingInput{
		ModelName:          "gpt-5.3-codex",
		Source:             CodexModelGovernanceSourceOfficialCodexNotice,
		AffectedChannelIDs: []int{55},
		DisableAbilities:   false,
	})
	require.NoError(t, err)
	require.NoError(t, ReviewCodexModelGovernanceRecord(record.ID, CodexModelGovernanceStatusIgnored, 7, "not actionable"))

	updated, err := UpsertCodexModelGovernancePending(CodexModelGovernancePendingInput{
		ModelName:          "gpt-5.3-codex",
		Source:             CodexModelGovernanceSourceProbe,
		LastError:          "upstream rejected the model",
		AffectedChannelIDs: []int{55},
		DisableAbilities:   true,
	})

	require.NoError(t, err)
	require.Equal(t, CodexModelGovernanceStatusUnsupportedPendingReview, updated.Status)
	require.True(t, updated.AbilitiesDisabled)
	require.Zero(t, updated.ReviewedAt)
	require.Zero(t, updated.ReviewedBy)
	require.Empty(t, updated.ReviewNote)
	var ability Ability
	require.NoError(t, DB.First(&ability, "channel_id = ? AND model = ?", 55, "gpt-5.3-codex").Error)
	require.False(t, ability.Enabled)
}

func TestCodexGovernanceUpsertReopenClearsReviewMetadata(t *testing.T) {
	setupCodexGovernanceTestDB(t)
	insertCodexGovernanceChannel(t, 56, constant.ChannelTypeCodex, "gpt-5.3-codex")

	record, err := UpsertCodexModelGovernancePending(CodexModelGovernancePendingInput{
		ModelName:          "gpt-5.3-codex",
		Source:             CodexModelGovernanceSourceOfficialCodexNotice,
		AffectedChannelIDs: []int{56},
		DisableAbilities:   false,
	})
	require.NoError(t, err)
	require.NoError(t, ReviewCodexModelGovernanceRecord(record.ID, CodexModelGovernanceStatusActive, 7, "recovered"))

	updated, err := UpsertCodexModelGovernancePending(CodexModelGovernancePendingInput{
		ModelName:          "gpt-5.3-codex",
		Source:             CodexModelGovernanceSourceOfficialCodexNotice,
		LastError:          "new notice",
		AffectedChannelIDs: []int{56},
		DisableAbilities:   false,
	})

	require.NoError(t, err)
	require.Equal(t, CodexModelGovernanceStatusUnsupportedPendingReview, updated.Status)
	require.Zero(t, updated.ReviewedAt)
	require.Zero(t, updated.ReviewedBy)
	require.Empty(t, updated.ReviewNote)
}

func TestCodexGovernanceRestoreAfterRemovedReturnsExplicitError(t *testing.T) {
	setupCodexGovernanceTestDB(t)
	insertCodexGovernanceChannel(t, 61, constant.ChannelTypeCodex, "gpt-5.3-codex,gpt-5.4-codex")

	record, err := UpsertCodexModelGovernancePending(CodexModelGovernancePendingInput{
		ModelName:          "gpt-5.3-codex",
		Source:             CodexModelGovernanceSourceProbe,
		AffectedChannelIDs: []int{61},
		DisableAbilities:   true,
	})
	require.NoError(t, err)

	require.NoError(t, ReviewCodexModelGovernanceRecord(record.ID, CodexModelGovernanceStatusRemoved, 7, "confirmed"))

	err = ReviewCodexModelGovernanceRecord(record.ID, CodexModelGovernanceStatusActive, 7, "rollback attempt")
	require.Error(t, err)
	require.Contains(t, err.Error(), "removed")

	var unchanged CodexModelGovernanceRecord
	require.NoError(t, DB.First(&unchanged, "id = ?", record.ID).Error)
	require.Equal(t, CodexModelGovernanceStatusRemoved, unchanged.Status)
}
