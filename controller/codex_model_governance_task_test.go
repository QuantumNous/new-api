package controller

import (
	"context"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func resetCodexGovernanceProbeFailuresForTest() {
	codexGovernanceProbeFailureMu.Lock()
	codexGovernanceProbeFailures = make(map[codexGovernanceProbeFailureKey]int)
	codexGovernanceProbeFailureMu.Unlock()
}

func setupCodexGovernanceProbeFailureStateTestDB(t *testing.T) {
	t.Helper()

	originalDB := model.DB
	db, err := gorm.Open(sqlite.Open("file:"+t.Name()+"?mode=memory&cache=shared"), &gorm.Config{})
	require.NoError(t, err)
	sqlDB, err := db.DB()
	require.NoError(t, err)
	sqlDB.SetMaxOpenConns(1)
	require.NoError(t, db.Exec(`
CREATE TABLE codex_model_governance_probe_states (
	model_name varchar(255) NOT NULL,
	channel_id integer NOT NULL,
	consecutive_failures integer NOT NULL DEFAULT 0,
	last_failed_at bigint NOT NULL DEFAULT 0,
	last_healthy_at bigint NOT NULL DEFAULT 0,
	created_time bigint NOT NULL DEFAULT 0,
	updated_time bigint NOT NULL DEFAULT 0,
	PRIMARY KEY (model_name, channel_id)
)`).Error)
	model.DB = db

	t.Cleanup(func() {
		model.DB = originalDB
		require.NoError(t, sqlDB.Close())
	})
}

func setupBrokenCodexGovernanceProbeFailureStateTestDB(t *testing.T) {
	t.Helper()

	originalDB := model.DB
	db, err := gorm.Open(sqlite.Open("file:"+t.Name()+"?mode=memory&cache=shared"), &gorm.Config{})
	require.NoError(t, err)
	sqlDB, err := db.DB()
	require.NoError(t, err)
	sqlDB.SetMaxOpenConns(1)
	require.NoError(t, db.Exec(`
CREATE TABLE codex_model_governance_probe_states (
	model_name varchar(255) NOT NULL,
	channel_id integer NOT NULL,
	PRIMARY KEY (model_name, channel_id)
)`).Error)
	model.DB = db

	t.Cleanup(func() {
		model.DB = originalDB
		require.NoError(t, sqlDB.Close())
	})
}

func setupCodexGovernanceProbeFindingTestDB(t *testing.T) {
	t.Helper()

	originalDB := model.DB
	db, err := gorm.Open(sqlite.Open("file:"+t.Name()+"?mode=memory&cache=shared"), &gorm.Config{})
	require.NoError(t, err)
	sqlDB, err := db.DB()
	require.NoError(t, err)
	sqlDB.SetMaxOpenConns(1)
	require.NoError(t, db.AutoMigrate(&model.Channel{}, &model.Ability{}, &model.CodexModelGovernanceRecord{}))
	model.DB = db

	t.Cleanup(func() {
		model.DB = originalDB
		require.NoError(t, sqlDB.Close())
	})
}

func TestCodexGovernanceProbeIntervalFallsBackToOneHour(t *testing.T) {
	got := codexGovernanceProbeInterval(&operation_setting.CodexModelGovernanceSetting{ProbeIntervalMinutes: 0})

	if got != time.Hour {
		t.Fatalf("interval = %s, want %s", got, time.Hour)
	}
}

func TestCodexGovernanceTaskPollsDisabledSettingFrequently(t *testing.T) {
	got := codexGovernanceTaskSleepDuration(&operation_setting.CodexModelGovernanceSetting{
		Enabled:              false,
		ProbeIntervalMinutes: 1440,
	})

	require.Equal(t, time.Minute, got)
}

func TestCodexGovernanceTaskUsesProbeIntervalWhenEnabled(t *testing.T) {
	got := codexGovernanceTaskSleepDuration(&operation_setting.CodexModelGovernanceSetting{
		Enabled:              true,
		ProbeIntervalMinutes: 120,
	})

	require.Equal(t, 2*time.Hour, got)
}

func TestCodexGovernanceProbeShouldStopWhenContextCanceled(t *testing.T) {
	ctx, cancel := context.WithCancel(context.Background())
	cancel()

	require.False(t, codexGovernanceProbeShouldContinue(ctx))
}

func TestCodexGovernanceProbeShouldStopWhenGovernanceDisabled(t *testing.T) {
	setting := operation_setting.GetCodexModelGovernanceSetting()
	original := *setting
	t.Cleanup(func() {
		*setting = original
	})

	setting.Enabled = true
	setting.ProbeEnabled = true
	require.True(t, codexGovernanceProbeShouldContinue(context.Background()))

	setting.ProbeEnabled = false
	require.False(t, codexGovernanceProbeShouldContinue(context.Background()))

	setting.Enabled = false
	setting.ProbeEnabled = true
	require.False(t, codexGovernanceProbeShouldContinue(context.Background()))
}

func TestCodexGovernanceProbeRequestContextHasBoundedDeadline(t *testing.T) {
	startedAt := time.Now()
	ctx, cancel := codexGovernanceProbeRequestContext(context.Background())
	defer cancel()

	deadline, ok := ctx.Deadline()
	require.True(t, ok)
	require.Greater(t, deadline.Sub(startedAt), time.Duration(0))
	require.LessOrEqual(t, deadline.Sub(startedAt), codexGovernanceSingleProbeTimeout)
}

func TestCodexGovernanceProbeRequestContextInheritsParentCancellation(t *testing.T) {
	parent, stopParent := context.WithCancel(context.Background())
	ctx, cancel := codexGovernanceProbeRequestContext(parent)
	defer cancel()

	stopParent()

	select {
	case <-ctx.Done():
		require.ErrorIs(t, ctx.Err(), context.Canceled)
	case <-time.After(time.Second):
		t.Fatal("probe context did not inherit parent cancellation")
	}
}

func TestCodexGovernanceTaskWaitDurationUsesFixedNextRun(t *testing.T) {
	now := time.Unix(100, 0)
	nextRun := now.Add(30 * time.Second)

	require.Equal(t, 30*time.Second, codexGovernanceTaskWaitDuration(now, nextRun, true))
}

func TestCodexGovernanceTaskWaitDurationKeepsIdleWhenProbeOverruns(t *testing.T) {
	now := time.Unix(100, 0)
	nextRun := now.Add(-time.Second)

	require.Equal(t, codexGovernanceMinimumProbeIdle, codexGovernanceTaskWaitDuration(now, nextRun, true))
}

func TestClassifyCodexGovernanceProbeErrorOnlyMatchesConfiguredRules(t *testing.T) {
	patterns := []string{`The '([^']+)' model is not supported when using Codex with a ChatGPT account\.`}
	strict := classifyCodexGovernanceProbeError(
		"The 'gpt-5.3-codex' model is not supported when using Codex with a ChatGPT account.",
		patterns,
	)
	if !strict.Matched || strict.ModelName != "gpt-5.3-codex" {
		t.Fatalf("strict match = %#v, want extracted model", strict)
	}

	for _, message := range []string{"model_not_found", "unsupported model", "rate limit exceeded", "request timeout"} {
		match := classifyCodexGovernanceProbeError(message, patterns)
		if match.Matched {
			t.Fatalf("generic message %q matched: %#v", message, match)
		}
	}
}

func TestCodexGovernanceProbeUnsupportedMatchRequiresConsecutiveHits(t *testing.T) {
	resetCodexGovernanceProbeFailuresForTest()
	t.Cleanup(resetCodexGovernanceProbeFailuresForTest)

	count, escalate := recordCodexGovernanceProbeUnsupportedMatch("gpt-5.3-codex", 11)
	if count != 1 || escalate {
		t.Fatalf("first hit count/escalate = %d/%t, want 1/false", count, escalate)
	}

	count, escalate = recordCodexGovernanceProbeUnsupportedMatch("gpt-5.3-codex", 11)
	if count != codexGovernanceProbeUnsupportedConsecutiveThreshold || !escalate {
		t.Fatalf("second hit count/escalate = %d/%t, want threshold/true", count, escalate)
	}

	count, escalate = recordCodexGovernanceProbeUnsupportedMatch("gpt-5.3-codex", 11)
	if count != codexGovernanceProbeUnsupportedConsecutiveThreshold || !escalate {
		t.Fatalf("later hit count/escalate = %d/%t, want capped threshold/true", count, escalate)
	}
}

func TestCodexGovernanceProbeUnsupportedMatchResetsAfterHealthyProbe(t *testing.T) {
	resetCodexGovernanceProbeFailuresForTest()
	t.Cleanup(resetCodexGovernanceProbeFailuresForTest)

	count, escalate := recordCodexGovernanceProbeUnsupportedMatch("gpt-5.3-codex", 11)
	if count != 1 || escalate {
		t.Fatalf("first hit count/escalate = %d/%t, want 1/false", count, escalate)
	}

	resetCodexGovernanceProbeFailure("gpt-5.3-codex", 11)

	count, escalate = recordCodexGovernanceProbeUnsupportedMatch("gpt-5.3-codex", 11)
	if count != 1 || escalate {
		t.Fatalf("hit after reset count/escalate = %d/%t, want 1/false", count, escalate)
	}
}

func TestCodexGovernanceProbeUnsupportedMatchIsScopedByChannel(t *testing.T) {
	resetCodexGovernanceProbeFailuresForTest()
	t.Cleanup(resetCodexGovernanceProbeFailuresForTest)

	if _, escalate := recordCodexGovernanceProbeUnsupportedMatch("gpt-5.3-codex", 11); escalate {
		t.Fatalf("first channel first hit escalated")
	}
	if _, escalate := recordCodexGovernanceProbeUnsupportedMatch("gpt-5.3-codex", 12); escalate {
		t.Fatalf("second channel first hit escalated")
	}
	if _, escalate := recordCodexGovernanceProbeUnsupportedMatch("gpt-5.3-codex", 11); !escalate {
		t.Fatalf("first channel second hit did not escalate")
	}
}

func TestCodexGovernanceProbeUnsupportedMatchPersistsAcrossProcessLocalReset(t *testing.T) {
	setupCodexGovernanceProbeFailureStateTestDB(t)
	resetCodexGovernanceProbeFailuresForTest()
	t.Cleanup(resetCodexGovernanceProbeFailuresForTest)

	count, escalate := recordCodexGovernanceProbeUnsupportedMatch("gpt-5.3-codex", 11)
	require.Equal(t, 1, count)
	require.False(t, escalate)

	resetCodexGovernanceProbeFailuresForTest()

	count, escalate = recordCodexGovernanceProbeUnsupportedMatch("gpt-5.3-codex", 11)
	require.Equal(t, codexGovernanceProbeUnsupportedConsecutiveThreshold, count)
	require.True(t, escalate)
}

func TestCodexGovernanceProbeUnsupportedMatchDoesNotUseMemoryFallbackWhenPersistenceFails(t *testing.T) {
	setupBrokenCodexGovernanceProbeFailureStateTestDB(t)
	resetCodexGovernanceProbeFailuresForTest()
	t.Cleanup(resetCodexGovernanceProbeFailuresForTest)

	count, escalate := recordCodexGovernanceProbeUnsupportedMatch("gpt-5.3-codex", 11)
	require.Zero(t, count)
	require.False(t, escalate)

	count, escalate = recordCodexGovernanceProbeUnsupportedMatch("gpt-5.3-codex", 11)
	require.Zero(t, count)
	require.False(t, escalate)

	model.DB = nil
	count, escalate = recordCodexGovernanceProbeUnsupportedMatch("gpt-5.3-codex", 11)
	require.Equal(t, 1, count)
	require.False(t, escalate)
}

func TestCodexGovernanceProbePendingReviewResetsProbedAndMatchedFailureKeys(t *testing.T) {
	setupCodexGovernanceProbeFailureStateTestDB(t)
	resetCodexGovernanceProbeFailuresForTest()
	t.Cleanup(resetCodexGovernanceProbeFailuresForTest)

	_, escalate := recordCodexGovernanceProbeUnsupportedMatch("alias-codex", 11)
	require.False(t, escalate)
	_, escalate = recordCodexGovernanceProbeUnsupportedMatch("alias-codex", 11)
	require.True(t, escalate)

	count, escalate := recordCodexGovernanceProbeUnsupportedMatch("gpt-5.3-codex", 11)
	require.Equal(t, 1, count)
	require.False(t, escalate)

	resetCodexGovernanceProbeFailuresAfterPending("alias-codex", "gpt-5.3-codex", 11)

	count, escalate = recordCodexGovernanceProbeUnsupportedMatch("alias-codex", 11)
	require.Equal(t, 1, count)
	require.False(t, escalate)

	count, escalate = recordCodexGovernanceProbeUnsupportedMatch("gpt-5.3-codex", 11)
	require.Equal(t, 1, count)
	require.False(t, escalate)
}

func TestCodexGovernanceProbeFindingUsesConfiguredModelAsGovernanceKey(t *testing.T) {
	setupCodexGovernanceProbeFindingTestDB(t)

	match := service.CodexUnsupportedMatch{
		Matched:   true,
		ModelName: "gpt-5.3-codex-upstream",
		Pattern:   `The '([^']+)' model is not supported`,
	}
	require.NoError(t, model.DB.Create(&model.Channel{
		Id:     42,
		Type:   constant.ChannelTypeCodex,
		Status: common.ChannelStatusEnabled,
		Models: "gpt-5.3-codex-alias",
		Group:  "default",
	}).Error)
	require.NoError(t, model.DB.Create(&model.Ability{
		Group:     "default",
		Model:     "gpt-5.3-codex-alias",
		ChannelId: 42,
		Enabled:   true,
	}).Error)

	finding := codexGovernanceProbeUnsupportedFinding(
		"gpt-5.3-codex-alias",
		42,
		match,
		"The 'gpt-5.3-codex-upstream' model is not supported",
	)

	require.Equal(t, "gpt-5.3-codex-alias", finding.ModelName)
	require.Equal(t, model.CodexModelGovernanceSourceProbe, finding.Source)
	require.Equal(t, match.Pattern, finding.MatchedRule)
	require.Equal(t, []int{42}, finding.AffectedChannelIDs)
	require.Contains(t, finding.LastError, "gpt-5.3-codex-upstream")

	record, err := service.MoveCodexModelToPendingReview(finding)
	require.NoError(t, err)
	require.Equal(t, "gpt-5.3-codex-alias", record.ModelName)

	var aliasAbility model.Ability
	require.NoError(t, model.DB.First(&aliasAbility, "channel_id = ? AND model = ?", 42, "gpt-5.3-codex-alias").Error)
	require.False(t, aliasAbility.Enabled)

	var upstreamRecord model.CodexModelGovernanceRecord
	err = model.DB.First(&upstreamRecord, "model_name = ?", "gpt-5.3-codex-upstream").Error
	require.ErrorIs(t, err, gorm.ErrRecordNotFound)
}
