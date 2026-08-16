package model

import (
	"errors"
	"math"
	"strings"
	"sync"
	"testing"
	"unicode/utf8"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func prepareChannelContributionFeatureTables(t *testing.T) {
	t.Helper()
	require.NoError(t, DB.AutoMigrate(
		&ChannelContributionRevision{},
		&ChannelContributionModelHealth{},
		&ChannelContributionHealthState{},
		&ChannelContributionRewardAccount{},
		&ChannelContributionRewardLedger{},
	))
	clear := func() {
		DB.Exec("DELETE FROM channel_contribution_model_healths")
		DB.Exec("DELETE FROM channel_contribution_health_states")
		DB.Exec("DELETE FROM channel_contribution_reward_ledgers")
		DB.Exec("DELETE FROM channel_contribution_reward_accounts")
		DB.Exec("DELETE FROM channel_contribution_revisions")
		DB.Exec("DELETE FROM channel_contributions")
		DB.Exec("DELETE FROM abilities")
		DB.Exec("DELETE FROM channels")
		DB.Exec("DELETE FROM users")
	}
	clear()
	t.Cleanup(clear)
}

func seedApprovedContributionHealthFixture(t *testing.T, modelNames ...string) (*ChannelContribution, *ChannelContributionRevision, *Channel) {
	t.Helper()
	priority := int64(100)
	weight := uint(0)
	tag := "donate"
	channel := &Channel{
		Type:        constant.ChannelTypeOpenAI,
		Key:         "sk-health-test",
		Status:      common.ChannelStatusEnabled,
		Name:        "contributed channel",
		Weight:      &weight,
		Models:      strings.Join(modelNames, ","),
		Group:       "default",
		Priority:    &priority,
		Tag:         &tag,
		CreatedTime: 1,
	}
	require.NoError(t, channel.Insert())

	channelID := channel.Id
	contribution := &ChannelContribution{
		UserId:    42,
		Username:  "contributor",
		Status:    ChannelContributionStatusApproved,
		ChannelId: &channelID,
	}
	require.NoError(t, DB.Create(contribution).Error)
	revision := &ChannelContributionRevision{
		ContributionId: contribution.Id,
		RevisionNumber: 1,
		Name:           channel.Name,
		Type:           channel.Type,
		BaseURL:        "https://example.com",
		Key:            channel.Key,
		Group:          channel.Group,
		Models:         channel.Models,
		ModelMapping:   "{}",
		ConfigHash:     "config-v1",
		Status:         ChannelContributionRevisionStatusApproved,
	}
	require.NoError(t, DB.Create(revision).Error)
	revisionID := revision.Id
	require.NoError(t, DB.Model(&ChannelContribution{}).
		Where("id = ?", contribution.Id).
		Updates(map[string]any{
			"current_revision_id":  revisionID,
			"approved_revision_id": revisionID,
		}).Error)
	contribution.CurrentRevisionId = &revisionID
	contribution.ApprovedRevisionId = &revisionID
	return contribution, revision, channel
}

func loadContributionAbilities(t *testing.T, channelID int) map[string]Ability {
	t.Helper()
	var abilities []Ability
	require.NoError(t, DB.Where("channel_id = ?", channelID).Find(&abilities).Error)
	result := make(map[string]Ability, len(abilities))
	for _, ability := range abilities {
		result[ability.Model] = ability
	}
	return result
}

func TestApplyChannelContributionHealthCycleDisablesOnlyFailedModels(t *testing.T) {
	prepareChannelContributionFeatureTables(t)
	contribution, revision, channel := seedApprovedContributionHealthFixture(t, "model-a", "model-b")

	result, err := ApplyChannelContributionHealthCycle(
		contribution.Id,
		channel.Id,
		revision.Id,
		revision.ConfigHash,
		[]ChannelContributionModelObservation{
			{Model: "model-a", Error: "upstream unavailable"},
			{Model: "model-b", Healthy: true},
		},
		1_000,
		48*60*60,
	)
	require.NoError(t, err)
	assert.False(t, result.AllFailed)
	assert.True(t, result.StateChanged)
	assert.Equal(t, []string{"model-a"}, result.UnhealthyModels)

	abilities := loadContributionAbilities(t, channel.Id)
	assert.False(t, abilities["model-a"].Enabled)
	assert.True(t, abilities["model-b"].Enabled)
	require.NoError(t, UpdateAbilityStatus(channel.Id, true))
	assert.False(t, loadContributionAbilities(t, channel.Id)["model-a"].Enabled)
	_, _, err = FixAbility()
	require.NoError(t, err)
	assert.False(t, loadContributionAbilities(t, channel.Id)["model-a"].Enabled)
	reloadedChannel, err := GetChannelById(channel.Id, true)
	require.NoError(t, err)
	assert.Equal(t, common.ChannelStatusEnabled, reloadedChannel.Status)
	reloadedContribution, err := GetChannelContributionById(contribution.Id)
	require.NoError(t, err)
	assert.Equal(t, ChannelContributionStatusApproved, reloadedContribution.Status)
}

func TestApplyChannelContributionHealthCyclePausesManualDisableAndDeletesAfterActiveFailureWindow(t *testing.T) {
	prepareChannelContributionFeatureTables(t)
	contribution, revision, channel := seedApprovedContributionHealthFixture(t, "model-a", "model-b")
	pendingRevision := &ChannelContributionRevision{
		ContributionId: contribution.Id,
		RevisionNumber: 2,
		Name:           revision.Name,
		Type:           revision.Type,
		BaseURL:        revision.BaseURL,
		Key:            "sk-pending",
		Group:          revision.Group,
		Models:         revision.Models,
		ModelMapping:   revision.ModelMapping,
		ConfigHash:     "config-pending",
		Status:         ChannelContributionRevisionStatusPending,
	}
	require.NoError(t, DB.Create(pendingRevision).Error)
	require.NoError(t, DB.Model(&ChannelContribution{}).
		Where("id = ?", contribution.Id).
		Update("pending_revision_id", pendingRevision.Id).Error)
	failed := []ChannelContributionModelObservation{
		{Model: "model-a", Error: "failed"},
		{Model: "model-b", Error: "failed"},
	}

	result, err := ApplyChannelContributionHealthCycle(contribution.Id, channel.Id, revision.Id, revision.ConfigHash, failed, 1_000, 100)
	require.NoError(t, err)
	assert.True(t, result.AllFailed)
	assert.False(t, result.Deleted)

	changed, err := UpdateChannelStatusWithError(channel.Id, "", common.ChannelStatusManuallyDisabled, "maintenance")
	require.NoError(t, err)
	assert.True(t, changed)
	result, err = ApplyChannelContributionHealthCycle(contribution.Id, channel.Id, revision.Id, revision.ConfigHash, nil, 1_500, 100)
	require.NoError(t, err)
	assert.True(t, result.Paused)
	assert.False(t, result.Deleted)
	var state ChannelContributionHealthState
	require.NoError(t, DB.Where("contribution_id = ?", contribution.Id).First(&state).Error)
	assert.NotZero(t, state.PausedAt)

	changed, err = UpdateChannelStatusWithError(channel.Id, "", common.ChannelStatusEnabled, "maintenance complete")
	require.NoError(t, err)
	assert.True(t, changed)
	require.NoError(t, DB.Where("contribution_id = ?", contribution.Id).First(&state).Error)
	assert.Zero(t, state.PausedAt)
	require.NoError(t, DB.Model(&ChannelContributionHealthState{}).Where("contribution_id = ?", contribution.Id).Update("failure_since", int64(1_000)).Error)
	require.NoError(t, DB.Model(&ChannelContribution{}).Where("id = ?", contribution.Id).Update("unavailable_since", int64(1_000)).Error)
	require.NoError(t, PauseContributionHealthForChannel(channel.Id, 1_000))
	require.NoError(t, ResumeContributionHealthForChannel(channel.Id, 2_000))
	require.NoError(t, DB.Where("contribution_id = ?", contribution.Id).First(&state).Error)
	assert.Equal(t, int64(2_000), state.FailureSince)

	result, err = ApplyChannelContributionHealthCycle(contribution.Id, channel.Id, revision.Id, revision.ConfigHash, failed, 2_099, 100)
	require.NoError(t, err)
	assert.False(t, result.Deleted)
	result, err = ApplyChannelContributionHealthCycle(contribution.Id, channel.Id, revision.Id, revision.ConfigHash, failed, 2_100, 100)
	require.NoError(t, err)
	assert.True(t, result.Deleted)

	reloadedContribution, err := GetChannelContributionById(contribution.Id)
	require.NoError(t, err)
	assert.Equal(t, ChannelContributionStatusDeleted, reloadedContribution.Status)
	assert.Nil(t, reloadedContribution.PendingRevisionId)
	var channelCount int64
	require.NoError(t, DB.Model(&Channel{}).Where("id = ?", channel.Id).Count(&channelCount).Error)
	assert.Zero(t, channelCount)
	var revisionKey string
	require.NoError(t, DB.Model(&ChannelContributionRevision{}).Where("id = ?", revision.Id).Pluck("key", &revisionKey).Error)
	assert.Empty(t, revisionKey)
	var reloadedPending ChannelContributionRevision
	require.NoError(t, DB.First(&reloadedPending, pendingRevision.Id).Error)
	assert.Empty(t, reloadedPending.Key)
	assert.Equal(t, ChannelContributionRevisionStatusWithdrawn, reloadedPending.Status)
}

func TestApplyChannelContributionHealthCycleRejectsStaleRevisionAndConfig(t *testing.T) {
	prepareChannelContributionFeatureTables(t)
	contribution, revision, channel := seedApprovedContributionHealthFixture(t, "model-a")
	observations := []ChannelContributionModelObservation{{Model: "model-a", Error: "failed"}}

	_, err := ApplyChannelContributionHealthCycle(contribution.Id, channel.Id, revision.Id, "old-config", observations, 1_000, 100)
	require.ErrorIs(t, err, ErrStaleChannelContributionHealthProbe)
	assert.True(t, loadContributionAbilities(t, channel.Id)["model-a"].Enabled)

	nextRevision := &ChannelContributionRevision{
		ContributionId: contribution.Id,
		RevisionNumber: 2,
		Name:           revision.Name,
		Type:           revision.Type,
		BaseURL:        revision.BaseURL,
		Key:            "sk-next",
		Group:          revision.Group,
		Models:         revision.Models,
		ModelMapping:   "{}",
		ConfigHash:     "config-v2",
		Status:         ChannelContributionRevisionStatusApproved,
	}
	require.NoError(t, DB.Create(nextRevision).Error)
	require.NoError(t, DB.Model(&ChannelContribution{}).
		Where("id = ?", contribution.Id).
		Update("approved_revision_id", nextRevision.Id).Error)
	_, err = ApplyChannelContributionHealthCycle(contribution.Id, channel.Id, revision.Id, revision.ConfigHash, observations, 1_001, 100)
	require.ErrorIs(t, err, ErrStaleChannelContributionHealthProbe)
	assert.True(t, loadContributionAbilities(t, channel.Id)["model-a"].Enabled)
	var healthCount int64
	require.NoError(t, DB.Model(&ChannelContributionModelHealth{}).Where("contribution_id = ?", contribution.Id).Count(&healthCount).Error)
	assert.Zero(t, healthCount)
}

func TestResetChannelContributionHealthForRevisionClearsOldOverlayBeforeAbilityRebuild(t *testing.T) {
	prepareChannelContributionFeatureTables(t)
	contribution, revision, channel := seedApprovedContributionHealthFixture(t, "model-a", "model-b")
	_, err := ApplyChannelContributionHealthCycle(
		contribution.Id,
		channel.Id,
		revision.Id,
		revision.ConfigHash,
		[]ChannelContributionModelObservation{{Model: "model-a", Error: "failed"}, {Model: "model-b", Healthy: true}},
		1_000,
		100,
	)
	require.NoError(t, err)
	assert.False(t, loadContributionAbilities(t, channel.Id)["model-a"].Enabled)

	nextRevision := &ChannelContributionRevision{
		ContributionId: contribution.Id,
		RevisionNumber: 2,
		Name:           revision.Name,
		Type:           revision.Type,
		BaseURL:        revision.BaseURL,
		Key:            "sk-next",
		Group:          revision.Group,
		Models:         revision.Models,
		ModelMapping:   "{}",
		ConfigHash:     "config-v2",
		Status:         ChannelContributionRevisionStatusPending,
	}
	require.NoError(t, DB.Create(nextRevision).Error)
	require.NoError(t, DB.Transaction(func(tx *gorm.DB) error {
		var lockedContribution ChannelContribution
		if err := lockForUpdate(tx).Where("id = ?", contribution.Id).First(&lockedContribution).Error; err != nil {
			return err
		}
		var lockedChannel Channel
		if err := lockForUpdate(tx).Where("id = ?", channel.Id).First(&lockedChannel).Error; err != nil {
			return err
		}
		if err := ResetChannelContributionHealthForRevision(tx, &lockedContribution, nextRevision.Id, nextRevision.ConfigHash); err != nil {
			return err
		}
		return lockedChannel.UpdateAbilities(tx)
	}))
	abilities := loadContributionAbilities(t, channel.Id)
	assert.True(t, abilities["model-a"].Enabled)
	assert.True(t, abilities["model-b"].Enabled)
}

func TestHistoricalContributionHealthDoesNotDisableReusedOrdinaryChannelID(t *testing.T) {
	prepareChannelContributionFeatureTables(t)
	contribution, revision, contributed := seedApprovedContributionHealthFixture(t, "model-a")
	_, err := ApplyChannelContributionHealthCycle(
		contribution.Id,
		contributed.Id,
		revision.Id,
		revision.ConfigHash,
		[]ChannelContributionModelObservation{{Model: "model-a", Error: "failed"}},
		1_000,
		100,
	)
	require.NoError(t, err)
	assert.False(t, loadContributionAbilities(t, contributed.Id)["model-a"].Enabled)

	reusedID := contributed.Id
	require.NoError(t, DB.Transaction(func(tx *gorm.DB) error {
		if err := tx.Where("channel_id = ?", reusedID).Delete(&Ability{}).Error; err != nil {
			return err
		}
		if err := tx.Where("id = ?", reusedID).Delete(&Channel{}).Error; err != nil {
			return err
		}
		return tx.Model(&ChannelContribution{}).
			Where("id = ?", contribution.Id).
			Update("status", ChannelContributionStatusDeleted).Error
	}))

	ordinary := &Channel{
		Id:          reusedID,
		Type:        constant.ChannelTypeOpenAI,
		Key:         "sk-ordinary",
		Status:      common.ChannelStatusEnabled,
		Name:        "ordinary reused channel",
		Models:      "model-a",
		Group:       "default",
		CreatedTime: 2,
	}
	require.NoError(t, ordinary.Insert())
	assert.True(t, loadContributionAbilities(t, ordinary.Id)["model-a"].Enabled)
}

func TestChannelContributionHealthErrorPreservesUTF8WhenTruncated(t *testing.T) {
	prepareChannelContributionFeatureTables(t)
	contribution, revision, channel := seedApprovedContributionHealthFixture(t, "model-a")
	message := strings.Repeat("中", 200)

	_, err := ApplyChannelContributionHealthCycle(
		contribution.Id,
		channel.Id,
		revision.Id,
		revision.ConfigHash,
		[]ChannelContributionModelObservation{{Model: "model-a", Error: message}},
		1_000,
		100,
	)
	require.NoError(t, err)

	var health ChannelContributionModelHealth
	require.NoError(t, DB.Where("contribution_id = ? AND model = ?", contribution.Id, "model-a").First(&health).Error)
	assert.LessOrEqual(t, len(health.LastError), 500)
	assert.True(t, utf8.ValidString(health.LastError))
	assert.Equal(t, strings.Repeat("中", 166), health.LastError)
}

func TestInitChannelCacheUsesOnlyEnabledAbilities(t *testing.T) {
	prepareChannelContributionFeatureTables(t)
	_, _, channel := seedApprovedContributionHealthFixture(t, "model-a", "model-b")
	require.NoError(t, DB.Model(&Ability{}).
		Where("channel_id = ? AND model = ?", channel.Id, "model-a").
		Update("enabled", false).Error)

	originalMemoryCacheEnabled := common.MemoryCacheEnabled
	common.MemoryCacheEnabled = true
	channelSyncLock.Lock()
	originalGroupRoutes := group2model2channels
	originalChannels := channelsIDM
	originalAdvancedCustom := channel2advancedCustomConfig
	originalGeneration := channelCacheGeneration
	channelSyncLock.Unlock()
	t.Cleanup(func() {
		common.MemoryCacheEnabled = originalMemoryCacheEnabled
		channelSyncLock.Lock()
		group2model2channels = originalGroupRoutes
		channelsIDM = originalChannels
		channel2advancedCustomConfig = originalAdvancedCustom
		channelCacheGeneration = originalGeneration
		channelSyncLock.Unlock()
	})

	InitChannelCache()
	channelSyncLock.RLock()
	failedRoutes := append([]int(nil), group2model2channels["default"]["model-a"]...)
	healthyRoutes := append([]int(nil), group2model2channels["default"]["model-b"]...)
	channelSyncLock.RUnlock()
	assert.Empty(t, failedRoutes)
	assert.Equal(t, []int{channel.Id}, healthyRoutes)
}

func TestFilterNonContributionChannelsExcludesApprovedAndUnavailableChannels(t *testing.T) {
	prepareChannelContributionFeatureTables(t)
	contribution, _, contributed := seedApprovedContributionHealthFixture(t, "model-a")
	ordinary := &Channel{Name: "ordinary", Type: constant.ChannelTypeOpenAI, Key: "sk-ordinary", Status: common.ChannelStatusEnabled, Models: "model-a", Group: "default"}
	require.NoError(t, ordinary.Insert())

	filtered := FilterNonContributionChannels([]*Channel{contributed, ordinary})
	require.Len(t, filtered, 1)
	assert.Equal(t, ordinary.Id, filtered[0].Id)
	require.NoError(t, DB.Model(&ChannelContribution{}).
		Where("id = ?", contribution.Id).
		Update("status", ChannelContributionStatusUnavailable).Error)
	filtered = FilterNonContributionChannels([]*Channel{contributed, ordinary})
	require.Len(t, filtered, 1)
	assert.Equal(t, ordinary.Id, filtered[0].Id)
}

func TestPopulateContributionChannelFlagsMarksOnlyActiveContributions(t *testing.T) {
	prepareChannelContributionFeatureTables(t)
	contribution, _, contributed := seedApprovedContributionHealthFixture(t, "model-a")
	ordinary := &Channel{Name: "ordinary", Type: constant.ChannelTypeOpenAI, Key: "sk-ordinary", Status: common.ChannelStatusEnabled, Models: "model-a", Group: "default"}
	require.NoError(t, ordinary.Insert())

	channels := []*Channel{ordinary, contributed}
	require.NoError(t, PopulateContributionChannelFlags(channels))
	assert.False(t, ordinary.IsContribution)
	assert.True(t, contributed.IsContribution)

	require.NoError(t, DB.Model(&ChannelContribution{}).
		Where("id = ?", contribution.Id).
		Update("status", ChannelContributionStatusDeleted).Error)
	require.NoError(t, PopulateContributionChannelFlags(channels))
	assert.False(t, contributed.IsContribution)
}

func TestContributionChannelAdminMutationRequiresRevisionForSensitiveFields(t *testing.T) {
	prepareChannelContributionFeatureTables(t)
	_, _, channel := seedApprovedContributionHealthFixture(t, "model-a")
	originalKey := channel.Key

	_, err := UpdateChannelAtomically(channel.Id, func(current *Channel) error {
		current.Key = "sk-bypassed-review"
		return nil
	})
	require.ErrorIs(t, err, ErrChannelContributionRequiresReview)
	reloaded, err := GetChannelById(channel.Id, true)
	require.NoError(t, err)
	assert.Equal(t, originalKey, reloaded.Key)

	newPriority := int64(250)
	newWeight := uint(7)
	newTag := "reviewed-donation"
	updated, err := UpdateChannelAtomically(channel.Id, func(current *Channel) error {
		current.Priority = &newPriority
		current.Weight = &newWeight
		current.Tag = &newTag
		return nil
	})
	require.NoError(t, err)
	assert.Equal(t, originalKey, updated.Key)
	assert.Equal(t, newPriority, updated.GetPriority())
	assert.Equal(t, int(newWeight), updated.GetWeight())
	require.NotNil(t, updated.Tag)
	assert.Equal(t, newTag, *updated.Tag)

	mapping := `{"model-a":"other-upstream"}`
	err = EditChannelByTag(newTag, nil, &mapping, nil, nil, nil, nil, nil, nil)
	require.ErrorIs(t, err, ErrChannelContributionRequiresReview)
}

func TestContributionChannelPartialAdminUpdatePreservesReviewedFields(t *testing.T) {
	prepareChannelContributionFeatureTables(t)
	_, _, channel := seedApprovedContributionHealthFixture(t, "model-a")
	newTag := "partial-update"

	patch := &Channel{Id: channel.Id, Tag: &newTag}
	require.NoError(t, patch.Update())

	reloaded, err := GetChannelById(channel.Id, true)
	require.NoError(t, err)
	assert.Equal(t, channel.Name, reloaded.Name)
	assert.Equal(t, channel.Type, reloaded.Type)
	assert.Equal(t, channel.Key, reloaded.Key)
	assert.Equal(t, channel.Group, reloaded.Group)
	assert.Equal(t, channel.Models, reloaded.Models)
	require.NotNil(t, reloaded.Tag)
	assert.Equal(t, newTag, *reloaded.Tag)
}

func TestChannelContributionRewardCreditIsIdempotentAndAuditsSaturation(t *testing.T) {
	prepareChannelContributionFeatureTables(t)
	clamp := &common.QuotaClamp{
		Op:       "QuotaFromFloat",
		Kind:     common.QuotaClampOverflow,
		Original: math.MaxFloat64,
		Clamped:  common.MaxQuota,
	}
	credited, err := CreditChannelContributionReward(42, 10, 20, "request-1", common.MaxQuota, 10_000, common.MaxQuota, clamp)
	require.NoError(t, err)
	assert.True(t, credited)
	credited, err = CreditChannelContributionReward(42, 10, 20, "request-1", common.MaxQuota, 10_000, common.MaxQuota, clamp)
	require.NoError(t, err)
	assert.False(t, credited)

	account, err := GetChannelContributionRewardAccount(42)
	require.NoError(t, err)
	assert.Equal(t, int64(common.MaxQuota), account.Balance)
	assert.Equal(t, int64(common.MaxQuota), account.LifetimeEarned)
	entries, total, err := ListChannelContributionRewardLedger(42, 0, 20)
	require.NoError(t, err)
	assert.Equal(t, int64(1), total)
	require.Len(t, entries, 1)
	assert.True(t, entries[0].QuotaSaturated)
	assert.Contains(t, entries[0].QuotaSaturation, `"kind":"overflow"`)
}

func TestTransferChannelContributionRewardMovesBalanceToUserQuotaAtomically(t *testing.T) {
	prepareChannelContributionFeatureTables(t)
	user := &User{Id: 42, Username: "contributor", Quota: 100, Status: common.UserStatusEnabled}
	require.NoError(t, DB.Create(user).Error)
	credited, err := CreditChannelContributionReward(42, 10, 20, "request-1", 1_000, 500, 50, nil)
	require.NoError(t, err)
	require.True(t, credited)

	entry, err := TransferChannelContributionReward(42, 30)
	require.NoError(t, err)
	assert.Equal(t, int64(-30), entry.Amount)
	assert.Equal(t, int64(20), entry.BalanceAfter)
	account, err := GetChannelContributionRewardAccount(42)
	require.NoError(t, err)
	assert.Equal(t, int64(20), account.Balance)
	assert.Equal(t, int64(30), account.LifetimeTransferred)
	var reloadedUser User
	require.NoError(t, DB.First(&reloadedUser, 42).Error)
	assert.Equal(t, 130, reloadedUser.Quota)
	transfers, total, err := ListChannelContributionRewardTransfers(42, 0, 20)
	require.NoError(t, err)
	assert.Equal(t, int64(1), total)
	require.Len(t, transfers, 1)
	assert.Equal(t, ChannelContributionRewardEntryTransfer, transfers[0].EntryType)

	_, err = TransferChannelContributionReward(42, 21)
	require.ErrorIs(t, err, ErrChannelContributionRewardInsufficientBalance)
	account, err = GetChannelContributionRewardAccount(42)
	require.NoError(t, err)
	assert.Equal(t, int64(20), account.Balance)
}

func TestTransferChannelContributionRewardPreventsConcurrentOverspend(t *testing.T) {
	prepareChannelContributionFeatureTables(t)
	user := &User{Id: 42, Username: "contributor", Quota: 100, Status: common.UserStatusEnabled}
	require.NoError(t, DB.Create(user).Error)
	credited, err := CreditChannelContributionReward(42, 10, 20, "request-1", 1_000, 500, 50, nil)
	require.NoError(t, err)
	require.True(t, credited)

	errorsCh := make(chan error, 2)
	var transfers sync.WaitGroup
	transfers.Add(2)
	for range 2 {
		go func() {
			defer transfers.Done()
			_, transferErr := TransferChannelContributionReward(42, 30)
			errorsCh <- transferErr
		}()
	}
	transfers.Wait()
	close(errorsCh)
	succeeded := 0
	insufficient := 0
	for transferErr := range errorsCh {
		if transferErr == nil {
			succeeded++
		} else if errors.Is(transferErr, ErrChannelContributionRewardInsufficientBalance) {
			insufficient++
		}
	}
	assert.Equal(t, 1, succeeded)
	assert.Equal(t, 1, insufficient)
	account, err := GetChannelContributionRewardAccount(42)
	require.NoError(t, err)
	assert.Equal(t, int64(20), account.Balance)
	var reloadedUser User
	require.NoError(t, DB.First(&reloadedUser, 42).Error)
	assert.Equal(t, 130, reloadedUser.Quota)
}

func TestTransferChannelContributionRewardRejectsUserQuotaOverflow(t *testing.T) {
	prepareChannelContributionFeatureTables(t)
	user := &User{Id: 42, Username: "contributor", Quota: common.MaxQuota - 10, Status: common.UserStatusEnabled}
	require.NoError(t, DB.Create(user).Error)
	credited, err := CreditChannelContributionReward(42, 10, 20, "request-1", 1_000, 500, 50, nil)
	require.NoError(t, err)
	require.True(t, credited)

	_, err = TransferChannelContributionReward(42, 20)
	require.EqualError(t, err, "user quota would exceed the supported limit")
	account, err := GetChannelContributionRewardAccount(42)
	require.NoError(t, err)
	assert.Equal(t, int64(50), account.Balance)
}
