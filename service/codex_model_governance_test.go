package service

import (
	"errors"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/model"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func setupCodexModelGovernanceServiceDB(t *testing.T) {
	t.Helper()
	originalDB := model.DB
	t.Cleanup(func() {
		model.DB = originalDB
	})
	db, err := gorm.Open(sqlite.Open("file:"+t.Name()+"?mode=memory&cache=shared"), &gorm.Config{})
	require.NoError(t, err)
	sqlDB, err := db.DB()
	require.NoError(t, err)
	sqlDB.SetMaxOpenConns(1)
	model.DB = db
	require.NoError(t, db.AutoMigrate(&model.Channel{}, &model.Ability{}, &model.CodexModelGovernanceRecord{}))
}

func insertCodexModelGovernanceServiceChannel(t *testing.T, id int, models string) {
	t.Helper()
	channel := model.Channel{
		Id:     id,
		Type:   constant.ChannelTypeCodex,
		Status: common.ChannelStatusEnabled,
		Name:   "codex",
		Models: models,
		Group:  "default",
		Key:    `{"access_token":"token","account_id":"acct"}`,
	}
	require.NoError(t, model.DB.Create(&channel).Error)
	require.NoError(t, channel.AddAbilities(nil))
}

func TestMoveCodexModelToPendingReviewDisablesAbilitiesAndNotifiesOnce(t *testing.T) {
	setupCodexModelGovernanceServiceDB(t)
	insertCodexModelGovernanceServiceChannel(t, 11, "gpt-5.3-codex,gpt-5.5-codex")
	originalNotifier := notifyDingTalkCodexModelGovernance
	t.Cleanup(func() {
		notifyDingTalkCodexModelGovernance = originalNotifier
	})
	var notified []string
	notifyDingTalkCodexModelGovernance = func(record *model.CodexModelGovernanceRecord) error {
		notified = append(notified, record.ModelName)
		return nil
	}

	record, err := MoveCodexModelToPendingReview(CodexModelUnsupportedFinding{
		ModelName:   "gpt-5.3-codex",
		Source:      model.CodexModelGovernanceSourceProbe,
		MatchedRule: "strict",
		LastError:   "The 'gpt-5.3-codex' model is not supported when using Codex with a ChatGPT account.",
	})
	require.NoError(t, err)
	require.NotNil(t, record)
	require.Equal(t, model.CodexModelGovernanceStatusUnsupportedPendingReview, record.Status)
	require.Equal(t, []string{"gpt-5.3-codex"}, notified)

	var disabledAbility model.Ability
	require.NoError(t, model.DB.First(&disabledAbility, "channel_id = ? AND model = ?", 11, "gpt-5.3-codex").Error)
	require.False(t, disabledAbility.Enabled)

	_, err = MoveCodexModelToPendingReview(CodexModelUnsupportedFinding{
		ModelName:   "gpt-5.3-codex",
		Source:      model.CodexModelGovernanceSourceProbe,
		MatchedRule: "strict",
		LastError:   "The 'gpt-5.3-codex' model is not supported when using Codex with a ChatGPT account.",
	})
	require.NoError(t, err)
	require.Equal(t, []string{"gpt-5.3-codex"}, notified)
}

func TestMoveCodexModelToPendingReviewReturnsNotifierErrorAfterStateChange(t *testing.T) {
	setupCodexModelGovernanceServiceDB(t)
	insertCodexModelGovernanceServiceChannel(t, 12, "gpt-5.4-codex")
	originalNotifier := notifyDingTalkCodexModelGovernance
	t.Cleanup(func() {
		notifyDingTalkCodexModelGovernance = originalNotifier
	})
	notifyDingTalkCodexModelGovernance = func(record *model.CodexModelGovernanceRecord) error {
		return errors.New("dingtalk down")
	}

	record, err := MoveCodexModelToPendingReview(CodexModelUnsupportedFinding{
		ModelName: "gpt-5.4-codex",
		Source:    model.CodexModelGovernanceSourceProbe,
		LastError: "probe error",
	})

	require.Error(t, err)
	require.Contains(t, err.Error(), "dingtalk down")
	require.NotNil(t, record)
	var disabledAbility model.Ability
	require.NoError(t, model.DB.First(&disabledAbility, "channel_id = ? AND model = ?", 12, "gpt-5.4-codex").Error)
	require.False(t, disabledAbility.Enabled)
}

func TestMoveCodexModelToPendingReviewOfficialNoticeAlertsWithoutDisabling(t *testing.T) {
	setupCodexModelGovernanceServiceDB(t)
	insertCodexModelGovernanceServiceChannel(t, 14, "gpt-5.4-codex")
	originalNotifier := notifyDingTalkCodexModelGovernance
	t.Cleanup(func() {
		notifyDingTalkCodexModelGovernance = originalNotifier
	})
	var notified []string
	notifyDingTalkCodexModelGovernance = func(record *model.CodexModelGovernanceRecord) error {
		notified = append(notified, record.ModelName)
		return nil
	}

	record, err := MoveCodexModelToPendingReview(CodexModelUnsupportedFinding{
		ModelName: "gpt-5.4-codex",
		Source:    model.CodexModelGovernanceSourceOfficialCodexNotice,
		LastError: "gpt-5.4-codex is deprecated",
	})

	require.NoError(t, err)
	require.NotNil(t, record)
	require.Equal(t, model.CodexModelGovernanceStatusUnsupportedPendingReview, record.Status)
	require.False(t, record.AbilitiesDisabled)
	require.Equal(t, []string{"gpt-5.4-codex"}, notified)

	var ability model.Ability
	require.NoError(t, model.DB.First(&ability, "channel_id = ? AND model = ?", 14, "gpt-5.4-codex").Error)
	require.True(t, ability.Enabled, "official notice findings must not auto-disable abilities")
}

func TestReviewCodexModelGovernanceDisableActionDisablesAndKeepsPending(t *testing.T) {
	setupCodexModelGovernanceServiceDB(t)
	insertCodexModelGovernanceServiceChannel(t, 15, "gpt-5.4-codex")
	originalNotifier := notifyDingTalkCodexModelGovernance
	t.Cleanup(func() {
		notifyDingTalkCodexModelGovernance = originalNotifier
	})
	notifyDingTalkCodexModelGovernance = func(record *model.CodexModelGovernanceRecord) error { return nil }

	record, err := MoveCodexModelToPendingReview(CodexModelUnsupportedFinding{
		ModelName: "gpt-5.4-codex",
		Source:    model.CodexModelGovernanceSourceOfficialCodexNotice,
	})
	require.NoError(t, err)
	require.False(t, record.AbilitiesDisabled)

	require.NoError(t, ReviewCodexModelGovernance(record.ID, CodexModelGovernanceReviewActionDisable, 1001, "operator confirmed"))

	updated, err := model.GetCodexModelGovernanceRecord(record.ID)
	require.NoError(t, err)
	require.Equal(t, model.CodexModelGovernanceStatusUnsupportedPendingReview, updated.Status)
	require.True(t, updated.AbilitiesDisabled)

	var ability model.Ability
	require.NoError(t, model.DB.First(&ability, "channel_id = ? AND model = ?", 15, "gpt-5.4-codex").Error)
	require.False(t, ability.Enabled)
}

func TestReviewCodexModelGovernanceMapsActionsToModelStatuses(t *testing.T) {
	setupCodexModelGovernanceServiceDB(t)
	insertCodexModelGovernanceServiceChannel(t, 13, "gpt-5.3-codex,gpt-5.5-codex")
	originalNotifier := notifyDingTalkCodexModelGovernance
	t.Cleanup(func() {
		notifyDingTalkCodexModelGovernance = originalNotifier
	})
	notifyDingTalkCodexModelGovernance = func(record *model.CodexModelGovernanceRecord) error { return nil }
	record, err := MoveCodexModelToPendingReview(CodexModelUnsupportedFinding{
		ModelName: "gpt-5.3-codex",
		Source:    model.CodexModelGovernanceSourceProbe,
	})
	require.NoError(t, err)

	require.NoError(t, ReviewCodexModelGovernance(record.ID, CodexModelGovernanceReviewActionRestore, 1001, "verified recovered"))
	restored, err := model.GetCodexModelGovernanceRecord(record.ID)
	require.NoError(t, err)
	require.Equal(t, model.CodexModelGovernanceStatusActive, restored.Status)
	var restoredAbility model.Ability
	require.NoError(t, model.DB.First(&restoredAbility, "channel_id = ? AND model = ?", 13, "gpt-5.3-codex").Error)
	require.True(t, restoredAbility.Enabled)

	require.NoError(t, ReviewCodexModelGovernance(record.ID, CodexModelGovernanceReviewActionConfirmRemove, 1001, "confirmed unsupported"))
	removed, err := model.GetCodexModelGovernanceRecord(record.ID)
	require.NoError(t, err)
	require.Equal(t, model.CodexModelGovernanceStatusRemoved, removed.Status)
	channel, err := model.GetChannelById(13, true)
	require.NoError(t, err)
	require.Equal(t, "gpt-5.5-codex", channel.Models)
}
