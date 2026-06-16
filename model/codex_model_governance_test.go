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

func withCodexGovernanceMemoryCache(t *testing.T) {
	t.Helper()

	originalMemoryCacheEnabled := common.MemoryCacheEnabled
	channelSyncLock.Lock()
	originalGroup2Model2Channels := group2model2channels
	originalChannelsIDM := channelsIDM
	group2model2channels = nil
	channelsIDM = nil
	channelSyncLock.Unlock()
	common.MemoryCacheEnabled = true

	t.Cleanup(func() {
		common.MemoryCacheEnabled = originalMemoryCacheEnabled
		channelSyncLock.Lock()
		group2model2channels = originalGroup2Model2Channels
		channelsIDM = originalChannelsIDM
		channelSyncLock.Unlock()
	})
}

func TestCodexGovernanceTimestampFieldsUseExplicitBigintType(t *testing.T) {
	parsed, err := schema.Parse(&CodexModelGovernanceRecord{}, &sync.Map{}, schema.NamingStrategy{})
	require.NoError(t, err)

	for _, fieldName := range []string{
		"DetectedAt",
		"LastCheckedAt",
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

	insertCodexGovernanceChannelWithStatusAndTag(t, id, channelType, models, status, nil)
}

func insertCodexGovernanceChannelWithStatusAndTag(t *testing.T, id int, channelType int, models string, status int, tag *string) {
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
		Tag:      tag,
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

func TestCodexGovernanceProbeDisablesOnlyDirectChannelAndLinksAllCodexChannelsForReview(t *testing.T) {
	setupCodexGovernanceTestDB(t)
	insertCodexGovernanceChannel(t, 71, constant.ChannelTypeCodex, "gpt-5.3-codex,gpt-5.4-codex")
	insertCodexGovernanceChannel(t, 72, constant.ChannelTypeCodex, "gpt-5.3-codex")
	insertCodexGovernanceChannel(t, 73, constant.ChannelTypeOpenAI, "gpt-5.3-codex")

	record, err := UpsertCodexModelGovernancePending(CodexModelGovernancePendingInput{
		ModelName:          "gpt-5.3-codex",
		Source:             CodexModelGovernanceSourceProbe,
		MatchedRule:        "default-unsupported",
		LastError:          "The 'gpt-5.3-codex' model is not supported when using Codex with a ChatGPT account.",
		AffectedChannelIDs: []int{71},
		DisableAbilities:   true,
	})

	require.NoError(t, err)
	require.Equal(t, "71,72", record.AffectedChannelIDs)
	require.Equal(t, "71", record.DisabledChannelIDs)
	require.True(t, record.AbilitiesDisabled)

	var direct Ability
	require.NoError(t, DB.First(&direct, "channel_id = ? AND model = ?", 71, "gpt-5.3-codex").Error)
	require.False(t, direct.Enabled)

	var linked Ability
	require.NoError(t, DB.First(&linked, "channel_id = ? AND model = ?", 72, "gpt-5.3-codex").Error)
	require.True(t, linked.Enabled)

	channel, err := GetChannelById(72, true)
	require.NoError(t, err)
	require.NoError(t, channel.UpdateAbilities(nil))
	require.NoError(t, DB.First(&linked, "channel_id = ? AND model = ?", 72, "gpt-5.3-codex").Error)
	require.True(t, linked.Enabled)

	var nonCodex Ability
	require.NoError(t, DB.First(&nonCodex, "channel_id = ? AND model = ?", 73, "gpt-5.3-codex").Error)
	require.True(t, nonCodex.Enabled)
}

func TestCodexGovernanceLegacyEnablePreservesProbeDisabledChannel(t *testing.T) {
	setupCodexGovernanceTestDB(t)
	insertCodexGovernanceChannel(t, 83, constant.ChannelTypeCodex, "gpt-5.3-codex,gpt-5.4-codex")

	_, err := UpsertCodexModelGovernancePending(CodexModelGovernancePendingInput{
		ModelName:          "gpt-5.3-codex",
		Source:             CodexModelGovernanceSourceProbe,
		AffectedChannelIDs: []int{83},
		DisableAbilities:   true,
	})
	require.NoError(t, err)
	require.NoError(t, DB.Model(&Channel{}).Where("id = ?", 83).Update("status", common.ChannelStatusAutoDisabled).Error)
	require.NoError(t, UpdateAbilityStatus(83, false))

	require.True(t, UpdateChannelStatus(83, "", common.ChannelStatusEnabled, "manual restore"))

	var disabled Ability
	require.NoError(t, DB.First(&disabled, "channel_id = ? AND model = ?", 83, "gpt-5.3-codex").Error)
	require.False(t, disabled.Enabled)

	var unaffected Ability
	require.NoError(t, DB.First(&unaffected, "channel_id = ? AND model = ?", 83, "gpt-5.4-codex").Error)
	require.True(t, unaffected.Enabled)
}

func TestCodexGovernanceEnableChannelByTagPreservesProbeDisabledChannels(t *testing.T) {
	setupCodexGovernanceTestDB(t)
	tag := "codex-batch"
	insertCodexGovernanceChannelWithStatusAndTag(t, 84, constant.ChannelTypeCodex, "gpt-5.3-codex,gpt-5.4-codex", common.ChannelStatusEnabled, &tag)

	_, err := UpsertCodexModelGovernancePending(CodexModelGovernancePendingInput{
		ModelName:          "gpt-5.3-codex",
		Source:             CodexModelGovernanceSourceProbe,
		AffectedChannelIDs: []int{84},
		DisableAbilities:   true,
	})
	require.NoError(t, err)
	require.NoError(t, DB.Model(&Channel{}).Where("id = ?", 84).Update("status", common.ChannelStatusManuallyDisabled).Error)
	require.NoError(t, UpdateAbilityStatusByTag(tag, false))

	require.NoError(t, EnableChannelByTag(tag))

	var disabled Ability
	require.NoError(t, DB.First(&disabled, "channel_id = ? AND model = ?", 84, "gpt-5.3-codex").Error)
	require.False(t, disabled.Enabled)

	var unaffected Ability
	require.NoError(t, DB.First(&unaffected, "channel_id = ? AND model = ?", 84, "gpt-5.4-codex").Error)
	require.True(t, unaffected.Enabled)
}

func TestCodexGovernanceEnableChannelByTagDoesNotReapplyToNonCodexChannel(t *testing.T) {
	setupCodexGovernanceTestDB(t)
	tag := "mixed-batch"
	insertCodexGovernanceChannelWithStatusAndTag(t, 85, constant.ChannelTypeCodex, "gpt-5.3-codex", common.ChannelStatusEnabled, &tag)
	insertCodexGovernanceChannelWithStatusAndTag(t, 86, constant.ChannelTypeOpenAI, "gpt-5.3-codex", common.ChannelStatusEnabled, &tag)

	require.NoError(t, DB.Create(&CodexModelGovernanceRecord{
		ModelName:          "gpt-5.3-codex",
		Status:             CodexModelGovernanceStatusUnsupportedDisabled,
		AffectedChannelIDs: "85,86",
		DisabledChannelIDs: "85,86",
		AbilitiesDisabled:  true,
	}).Error)
	require.NoError(t, UpdateAbilityStatusByTag(tag, false))

	require.NoError(t, UpdateAbilityStatusByTag(tag, true))

	var governedCodex Ability
	require.NoError(t, DB.First(&governedCodex, "channel_id = ? AND model = ?", 85, "gpt-5.3-codex").Error)
	require.False(t, governedCodex.Enabled)

	var nonCodex Ability
	require.NoError(t, DB.First(&nonCodex, "channel_id = ? AND model = ?", 86, "gpt-5.3-codex").Error)
	require.True(t, nonCodex.Enabled)
}

func TestCodexGovernanceDisableAbilityRefreshesLocalChannelCache(t *testing.T) {
	setupCodexGovernanceTestDB(t)
	withCodexGovernanceMemoryCache(t)
	insertCodexGovernanceChannel(t, 91, constant.ChannelTypeCodex, "gpt-5.3-codex")

	InitChannelCache()
	channel, err := GetRandomSatisfiedChannel("default", "gpt-5.3-codex", 0)
	require.NoError(t, err)
	require.NotNil(t, channel)
	require.Equal(t, 91, channel.Id)

	require.NoError(t, DisableCodexModelAbilities("gpt-5.3-codex", []int{91}))

	channel, err = GetRandomSatisfiedChannel("default", "gpt-5.3-codex", 0)
	require.NoError(t, err)
	require.Nil(t, channel)
}

func TestCodexGovernanceUpdateAbilitiesKeepsGovernedModelDisabled(t *testing.T) {
	setupCodexGovernanceTestDB(t)
	insertCodexGovernanceChannel(t, 81, constant.ChannelTypeCodex, "gpt-5.3-codex,gpt-5.4-codex")

	_, err := UpsertCodexModelGovernancePending(CodexModelGovernancePendingInput{
		ModelName:          "gpt-5.3-codex",
		Source:             CodexModelGovernanceSourceProbe,
		AffectedChannelIDs: []int{81},
		DisableAbilities:   true,
	})
	require.NoError(t, err)

	channel, err := GetChannelById(81, true)
	require.NoError(t, err)
	require.NoError(t, channel.UpdateAbilities(nil))

	var disabled Ability
	require.NoError(t, DB.First(&disabled, "channel_id = ? AND model = ?", 81, "gpt-5.3-codex").Error)
	require.False(t, disabled.Enabled)

	var unaffected Ability
	require.NoError(t, DB.First(&unaffected, "channel_id = ? AND model = ?", 81, "gpt-5.4-codex").Error)
	require.True(t, unaffected.Enabled)
}

func TestCodexGovernanceUpdateAbilitiesDoesNotRecreateRemovedModel(t *testing.T) {
	setupCodexGovernanceTestDB(t)
	insertCodexGovernanceChannel(t, 82, constant.ChannelTypeCodex, "gpt-5.3-codex,gpt-5.4-codex")

	record, err := UpsertCodexModelGovernancePending(CodexModelGovernancePendingInput{
		ModelName:          "gpt-5.3-codex",
		Source:             CodexModelGovernanceSourceProbe,
		AffectedChannelIDs: []int{82},
		DisableAbilities:   true,
	})
	require.NoError(t, err)
	require.NoError(t, ReviewCodexModelGovernanceRecord(record.ID, CodexModelGovernanceStatusRemoved, 7, "confirmed"))

	channel, err := GetChannelById(82, true)
	require.NoError(t, err)
	channel.Models = "gpt-5.3-codex,gpt-5.4-codex"
	require.NoError(t, DB.Model(&Channel{}).Where("id = ?", channel.Id).Update("models", channel.Models).Error)
	require.NoError(t, channel.UpdateAbilities(nil))

	var removedCount int64
	require.NoError(t, DB.Model(&Ability{}).
		Where("channel_id = ? AND model = ?", 82, "gpt-5.3-codex").
		Count(&removedCount).Error)
	require.Zero(t, removedCount)

	var unaffected Ability
	require.NoError(t, DB.First(&unaffected, "channel_id = ? AND model = ?", 82, "gpt-5.4-codex").Error)
	require.True(t, unaffected.Enabled)
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
	require.Equal(t, "71,72", first.AffectedChannelIDs)
	require.Equal(t, "71", first.DisabledChannelIDs)

	second, err := UpsertCodexModelGovernancePending(CodexModelGovernancePendingInput{
		ModelName:          "gpt-5.3-codex",
		Source:             CodexModelGovernanceSourceProbe,
		AffectedChannelIDs: []int{72},
		DisableAbilities:   true,
	})
	require.NoError(t, err)
	require.Equal(t, "71,72", second.AffectedChannelIDs)
	require.Equal(t, "71,72", second.DisabledChannelIDs)

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

func TestCodexGovernanceUpsertPendingPreservesRemovedStatusForOfficialNotice(t *testing.T) {
	setupCodexGovernanceTestDB(t)
	insertCodexGovernanceChannel(t, 63, constant.ChannelTypeCodex, "gpt-5.3-codex,gpt-5.4-codex")

	record, err := UpsertCodexModelGovernancePending(CodexModelGovernancePendingInput{
		ModelName:          "gpt-5.3-codex",
		Source:             CodexModelGovernanceSourceProbe,
		AffectedChannelIDs: []int{63},
		DisableAbilities:   true,
	})
	require.NoError(t, err)
	require.NoError(t, ReviewCodexModelGovernanceRecord(record.ID, CodexModelGovernanceStatusRemoved, 7, "confirmed removed"))

	insertCodexGovernanceChannel(t, 64, constant.ChannelTypeCodex, "gpt-5.3-codex")
	updated, err := UpsertCodexModelGovernancePending(CodexModelGovernancePendingInput{
		ModelName:          "gpt-5.3-codex",
		Source:             CodexModelGovernanceSourceOfficialCodexNotice,
		MatchedRule:        "deprecated",
		LastError:          "official notice still mentions gpt-5.3-codex",
		AffectedChannelIDs: []int{64},
		DisableAbilities:   false,
	})

	require.NoError(t, err)
	require.Equal(t, CodexModelGovernanceStatusRemoved, updated.Status)
	require.Equal(t, "63", updated.AffectedChannelIDs)
	require.Equal(t, "63", updated.DisabledChannelIDs)
	require.True(t, updated.AbilitiesDisabled)
	require.Equal(t, 7, updated.ReviewedBy)
	require.NotZero(t, updated.ReviewedAt)
	require.Equal(t, "confirmed removed", updated.ReviewNote)

	var reintroduced Ability
	require.NoError(t, DB.First(&reintroduced, "channel_id = ? AND model = ?", 64, "gpt-5.3-codex").Error)
	require.True(t, reintroduced.Enabled)
}

func TestCodexGovernanceUpsertPendingPreservesRemovedStatusForProbeFinding(t *testing.T) {
	setupCodexGovernanceTestDB(t)
	insertCodexGovernanceChannel(t, 65, constant.ChannelTypeCodex, "gpt-5.3-codex,gpt-5.4-codex")

	record, err := UpsertCodexModelGovernancePending(CodexModelGovernancePendingInput{
		ModelName:          "gpt-5.3-codex",
		Source:             CodexModelGovernanceSourceProbe,
		AffectedChannelIDs: []int{65},
		DisableAbilities:   true,
	})
	require.NoError(t, err)
	require.NoError(t, ReviewCodexModelGovernanceRecord(record.ID, CodexModelGovernanceStatusRemoved, 7, "confirmed removed"))

	insertCodexGovernanceChannel(t, 66, constant.ChannelTypeCodex, "gpt-5.3-codex")
	updated, err := UpsertCodexModelGovernancePending(CodexModelGovernancePendingInput{
		ModelName:          "gpt-5.3-codex",
		Source:             CodexModelGovernanceSourceProbe,
		LastError:          "probe still rejects the model",
		AffectedChannelIDs: []int{66},
		DisableAbilities:   true,
	})

	require.NoError(t, err)
	require.Equal(t, CodexModelGovernanceStatusRemoved, updated.Status)
	require.Equal(t, "65", updated.AffectedChannelIDs)
	require.Equal(t, "65", updated.DisabledChannelIDs)
	require.True(t, updated.AbilitiesDisabled)
	require.Equal(t, 7, updated.ReviewedBy)
	require.NotZero(t, updated.ReviewedAt)
	require.Equal(t, "confirmed removed", updated.ReviewNote)

	var reintroduced Ability
	require.NoError(t, DB.First(&reintroduced, "channel_id = ? AND model = ?", 66, "gpt-5.3-codex").Error)
	require.True(t, reintroduced.Enabled)
}

func TestCodexGovernanceProbeUnsupportedFailureIgnoresMissingStateTable(t *testing.T) {
	originalDB := DB
	db, err := gorm.Open(sqlite.Open("file:"+t.Name()+"?mode=memory&cache=shared"), &gorm.Config{})
	require.NoError(t, err)
	sqlDB, err := db.DB()
	require.NoError(t, err)
	sqlDB.SetMaxOpenConns(1)
	DB = db
	t.Cleanup(func() {
		DB = originalDB
		require.NoError(t, sqlDB.Close())
	})

	count, escalate, err := RecordCodexModelGovernanceProbeUnsupportedFailure("gpt-5.3-codex", 11, 2)

	require.NoError(t, err)
	require.Zero(t, count)
	require.False(t, escalate)
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

func TestCodexGovernanceReviewActiveFailsWhenNoAbilitiesAreRestored(t *testing.T) {
	setupCodexGovernanceTestDB(t)
	insertCodexGovernanceChannelWithStatus(t, 62, constant.ChannelTypeCodex, "gpt-5.3-codex", common.ChannelStatusManuallyDisabled)

	record, err := UpsertCodexModelGovernancePending(CodexModelGovernancePendingInput{
		ModelName:          "gpt-5.3-codex",
		Source:             CodexModelGovernanceSourceProbe,
		AffectedChannelIDs: []int{62},
		DisableAbilities:   true,
	})
	require.NoError(t, err)

	err = ReviewCodexModelGovernanceRecord(record.ID, CodexModelGovernanceStatusActive, 7, "restore attempt")
	require.Error(t, err)
	require.Contains(t, err.Error(), "no Codex abilities were restored")

	var unchanged CodexModelGovernanceRecord
	require.NoError(t, DB.First(&unchanged, "id = ?", record.ID).Error)
	require.Equal(t, CodexModelGovernanceStatusUnsupportedPendingReview, unchanged.Status)
	require.True(t, unchanged.AbilitiesDisabled)

	var ability Ability
	require.NoError(t, DB.First(&ability, "channel_id = ? AND model = ?", 62, "gpt-5.3-codex").Error)
	require.False(t, ability.Enabled)
}
