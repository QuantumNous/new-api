package controller

import (
	"testing"
	"time"

	"github.com/QuantumNous/new-api/model"
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

func TestCodexGovernanceProbeIntervalFallsBackToOneHour(t *testing.T) {
	got := codexGovernanceProbeInterval(&operation_setting.CodexModelGovernanceSetting{ProbeIntervalMinutes: 0})

	if got != time.Hour {
		t.Fatalf("interval = %s, want %s", got, time.Hour)
	}
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
