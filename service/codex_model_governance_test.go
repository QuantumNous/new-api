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

func TestMoveCodexModelToPendingReviewIgnoresNotifierErrorAfterStateChange(t *testing.T) {
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

	require.NoError(t, err)
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

func TestMoveCodexModelToPendingReviewProbeNotifiesAfterReviewOnlyFinding(t *testing.T) {
	setupCodexModelGovernanceServiceDB(t)
	insertCodexModelGovernanceServiceChannel(t, 19, "gpt-5.4-codex")
	originalNotifier := notifyDingTalkCodexModelGovernance
	t.Cleanup(func() {
		notifyDingTalkCodexModelGovernance = originalNotifier
	})
	var notified []string
	notifyDingTalkCodexModelGovernance = func(record *model.CodexModelGovernanceRecord) error {
		notified = append(notified, record.ModelName+":"+record.DisabledChannelIDs)
		return nil
	}

	record, err := MoveCodexModelToPendingReview(CodexModelUnsupportedFinding{
		ModelName: "gpt-5.4-codex",
		Source:    model.CodexModelGovernanceSourceOfficialCodexNotice,
		LastError: "gpt-5.4-codex is deprecated",
	})
	require.NoError(t, err)
	require.False(t, record.AbilitiesDisabled)

	record, err = MoveCodexModelToPendingReview(CodexModelUnsupportedFinding{
		ModelName:          "gpt-5.4-codex",
		Source:             model.CodexModelGovernanceSourceProbe,
		LastError:          "probe rejected the model",
		AffectedChannelIDs: []int{19},
	})

	require.NoError(t, err)
	require.True(t, record.AbilitiesDisabled)
	require.Equal(t, []string{"gpt-5.4-codex:", "gpt-5.4-codex:19"}, notified)
}

func TestReviewCodexModelGovernanceDisableActionDisablesAndMarksReviewed(t *testing.T) {
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
	require.Equal(t, model.CodexModelGovernanceStatusUnsupportedDisabled, updated.Status)
	require.True(t, updated.AbilitiesDisabled)
	require.NotZero(t, updated.ReviewedAt)

	var ability model.Ability
	require.NoError(t, model.DB.First(&ability, "channel_id = ? AND model = ?", 15, "gpt-5.4-codex").Error)
	require.False(t, ability.Enabled)
}

func TestMoveCodexModelToPendingReviewDoesNotNotifyReviewedDisabledRecord(t *testing.T) {
	setupCodexModelGovernanceServiceDB(t)
	insertCodexModelGovernanceServiceChannel(t, 16, "gpt-5.4-codex")
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
	})
	require.NoError(t, err)
	require.Equal(t, []string{"gpt-5.4-codex"}, notified)
	require.NoError(t, ReviewCodexModelGovernance(record.ID, CodexModelGovernanceReviewActionDisable, 1001, "operator confirmed"))

	record, err = MoveCodexModelToPendingReview(CodexModelUnsupportedFinding{
		ModelName: "gpt-5.4-codex",
		Source:    model.CodexModelGovernanceSourceProbe,
		LastError: "still unsupported",
	})

	require.NoError(t, err)
	require.Equal(t, model.CodexModelGovernanceStatusUnsupportedDisabled, record.Status)
	require.Equal(t, []string{"gpt-5.4-codex"}, notified)
}

func TestMoveCodexModelToPendingReviewNotifiesReviewedDisabledRecordWhenDisabledScopeExpands(t *testing.T) {
	setupCodexModelGovernanceServiceDB(t)
	insertCodexModelGovernanceServiceChannel(t, 20, "gpt-5.4-codex")
	originalNotifier := notifyDingTalkCodexModelGovernance
	t.Cleanup(func() {
		notifyDingTalkCodexModelGovernance = originalNotifier
	})
	var notified []string
	notifyDingTalkCodexModelGovernance = func(record *model.CodexModelGovernanceRecord) error {
		notified = append(notified, record.ModelName+":"+record.DisabledChannelIDs)
		return nil
	}

	record, err := MoveCodexModelToPendingReview(CodexModelUnsupportedFinding{
		ModelName:          "gpt-5.4-codex",
		Source:             model.CodexModelGovernanceSourceProbe,
		LastError:          "probe rejected the model",
		AffectedChannelIDs: []int{20},
	})
	require.NoError(t, err)
	require.NoError(t, ReviewCodexModelGovernance(record.ID, CodexModelGovernanceReviewActionDisable, 1001, "operator confirmed"))

	insertCodexModelGovernanceServiceChannel(t, 21, "gpt-5.4-codex")
	record, err = MoveCodexModelToPendingReview(CodexModelUnsupportedFinding{
		ModelName:          "gpt-5.4-codex",
		Source:             model.CodexModelGovernanceSourceProbe,
		LastError:          "new probe rejected the model",
		AffectedChannelIDs: []int{21},
	})

	require.NoError(t, err)
	require.Equal(t, model.CodexModelGovernanceStatusUnsupportedDisabled, record.Status)
	require.Equal(t, []string{"gpt-5.4-codex:20", "gpt-5.4-codex:20,21"}, notified)
}

func TestMoveCodexModelToPendingReviewNotifiesReviewedDisabledRecordWhenReviewScopeExpands(t *testing.T) {
	setupCodexModelGovernanceServiceDB(t)
	insertCodexModelGovernanceServiceChannel(t, 22, "gpt-5.4-codex")
	originalNotifier := notifyDingTalkCodexModelGovernance
	t.Cleanup(func() {
		notifyDingTalkCodexModelGovernance = originalNotifier
	})
	var notified []string
	notifyDingTalkCodexModelGovernance = func(record *model.CodexModelGovernanceRecord) error {
		notified = append(notified, record.ModelName+":"+record.AffectedChannelIDs+":"+record.DisabledChannelIDs)
		return nil
	}

	record, err := MoveCodexModelToPendingReview(CodexModelUnsupportedFinding{
		ModelName: "gpt-5.4-codex",
		Source:    model.CodexModelGovernanceSourceOfficialCodexNotice,
		LastError: "official notice mentioned the model",
	})
	require.NoError(t, err)
	require.NoError(t, ReviewCodexModelGovernance(record.ID, CodexModelGovernanceReviewActionDisable, 1001, "operator confirmed"))

	insertCodexModelGovernanceServiceChannel(t, 23, "gpt-5.4-codex")
	record, err = MoveCodexModelToPendingReview(CodexModelUnsupportedFinding{
		ModelName: "gpt-5.4-codex",
		Source:    model.CodexModelGovernanceSourceOfficialCodexNotice,
		LastError: "official notice still mentions the model",
	})

	require.NoError(t, err)
	require.Equal(t, model.CodexModelGovernanceStatusUnsupportedDisabled, record.Status)
	require.Equal(t, []string{
		"gpt-5.4-codex:22:",
		"gpt-5.4-codex:22,23:22",
	}, notified)
}

func TestMoveCodexModelToPendingReviewDoesNotNotifyIgnoredAlertOnlyRecord(t *testing.T) {
	setupCodexModelGovernanceServiceDB(t)
	insertCodexModelGovernanceServiceChannel(t, 17, "gpt-5.4-codex")
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
		LastError: "deprecated",
	})
	require.NoError(t, err)
	require.Equal(t, []string{"gpt-5.4-codex"}, notified)
	require.NoError(t, ReviewCodexModelGovernance(record.ID, CodexModelGovernanceReviewActionIgnore, 1001, "not actionable"))

	record, err = MoveCodexModelToPendingReview(CodexModelUnsupportedFinding{
		ModelName: "gpt-5.4-codex",
		Source:    model.CodexModelGovernanceSourceOfficialCodexNotice,
		LastError: "still mentioned",
	})

	require.NoError(t, err)
	require.Equal(t, model.CodexModelGovernanceStatusIgnored, record.Status)
	require.Equal(t, []string{"gpt-5.4-codex"}, notified)
}

func TestMoveCodexModelToPendingReviewProbeNotifiesAndDisablesIgnoredAlertOnlyRecord(t *testing.T) {
	setupCodexModelGovernanceServiceDB(t)
	insertCodexModelGovernanceServiceChannel(t, 18, "gpt-5.4-codex")
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
		LastError: "deprecated",
	})
	require.NoError(t, err)
	require.NoError(t, ReviewCodexModelGovernance(record.ID, CodexModelGovernanceReviewActionIgnore, 1001, "not actionable"))

	record, err = MoveCodexModelToPendingReview(CodexModelUnsupportedFinding{
		ModelName: "gpt-5.4-codex",
		Source:    model.CodexModelGovernanceSourceProbe,
		LastError: "probe rejected the model",
	})

	require.NoError(t, err)
	require.Equal(t, model.CodexModelGovernanceStatusUnsupportedPendingReview, record.Status)
	require.True(t, record.AbilitiesDisabled)
	require.Equal(t, []string{"gpt-5.4-codex", "gpt-5.4-codex"}, notified)
	var ability model.Ability
	require.NoError(t, model.DB.First(&ability, "channel_id = ? AND model = ?", 18, "gpt-5.4-codex").Error)
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
