package channel

import (
	"math"
	"sync"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/internal/common/dbx"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// readUnitRow returns one persisted unit row; the caller asserts on its columns.
func readUnitRow(t *testing.T, key RouteKey) *ChannelModelHealth {
	t.Helper()
	var row ChannelModelHealth
	err := dbx.DB.Where(unitPrimaryKey(key), unitPrimaryKeyArgs(key)...).First(&row).Error
	require.NoError(t, err)
	return &row
}

// TestReportOutcome_PersistsAndBumpsVersion pins the persistence seam: a single
// outcome is written through CAS and bumps the row version by exactly one.
func TestReportOutcome_PersistsAndBumpsVersion(t *testing.T) {
	withUnitHealthDB(t)
	key := RouteKey{ChannelId: 9501, KeyIndex: 0, Model: "persist-model"}
	require.NoError(t, dbx.DB.Create(&ChannelModelHealth{
		ChannelId: key.ChannelId, KeyIndex: key.KeyIndex, Model: key.Model, Version: 1,
	}).Error)

	require.NoError(t, ReportOutcome(key, UnitFatal, 0, 0, time.Now()))

	row := readUnitRow(t, key)
	assert.Equal(t, 2, row.Version, "an accepted CAS transition bumps the version by one")
	assert.Equal(t, 1, row.CooldownStreak, "one fatal climbs the ledger one rung")
	assert.Greater(t, row.CooldownUntilMs, int64(0), "the fatal arms a live cooldown")
}

// TestSettledUnitStateAgesStarvedScore pins the read-side EWMA decay: a unit
// whose score was last updated one decay constant ago must drift back toward
// 1.0 even though it receives no outcomes. Without this a starved unit keeps
// its degraded score forever and loses every P2C duel.
func TestSettledUnitStateAgesStarvedScore(t *testing.T) {
	withUnitHealthDB(t)
	cfg := freshUnitConfig()
	withUnitHealthSetting(t, cfg)
	const nowMs = int64(50_000_000)
	anchor := nowMs - cfg.ScoreDecayTauMs
	key := RouteKey{ChannelId: 9510, KeyIndex: 0, Model: "aging-model"}
	seedUnitHealthRow(t, &ChannelModelHealth{
		ChannelId: key.ChannelId, KeyIndex: key.KeyIndex, Model: key.Model, Version: 1,
		EwmaScore: 0.6, ScoreUpdatedAtMs: anchor,
	})

	st := settledUnitState(key, nowMs)
	want := 1 - (1-0.6)*math.Exp(-1)
	assert.InDelta(t, want, st.EwmaScore, 1e-9, "one tau of idle time must age the penalty")
	assert.Equal(t, nowMs, st.ScoreUpdatedAtMs, "the aging anchor advances with the read")
}

// TestAutoRecoverDisabledUnitHealthRevivesOnlyAutoMarked pins the startup
// recovery contract: a ratchet-era row (HardDisabled + AutoDisabled) is
// revived, while an operator hard-disable (HardDisabled without the auto
// marker) survives untouched.
func TestAutoRecoverDisabledUnitHealthRevivesOnlyAutoMarked(t *testing.T) {
	withUnitHealthDB(t)
	autoKey := RouteKey{ChannelId: 9520, KeyIndex: 0, Model: "auto-recovered"}
	manualKey := RouteKey{ChannelId: 9521, KeyIndex: 0, Model: "manual-kept"}
	seedUnitHealthRow(t, &ChannelModelHealth{
		ChannelId: autoKey.ChannelId, KeyIndex: autoKey.KeyIndex, Model: autoKey.Model, Version: 1,
		HardDisabled: true, AutoDisabled: true,
	})
	seedUnitHealthRow(t, &ChannelModelHealth{
		ChannelId: manualKey.ChannelId, KeyIndex: manualKey.KeyIndex, Model: manualKey.Model, Version: 1,
		HardDisabled: true,
	})

	AutoRecoverDisabledUnitHealth()

	autoRow := readUnitRow(t, autoKey)
	assert.False(t, autoRow.HardDisabled, "an auto-marked hard-disable must be revived")
	assert.False(t, autoRow.AutoDisabled, "recovery clears the auto marker")
	manualRow := readUnitRow(t, manualKey)
	assert.True(t, manualRow.HardDisabled, "an operator hard-disable must survive")
}

// TestReportOutcome_CasContentionNoLostUpdate is the multi-replica safety net:
// G concurrent writers on one row must all land (re-read on a lost race), so
// the version advances by exactly G and no transition is silently dropped.
func TestReportOutcome_CasContentionNoLostUpdate(t *testing.T) {
	withUnitHealthDB(t)
	key := RouteKey{ChannelId: 9502, KeyIndex: 0, Model: "cas-model"}
	require.NoError(t, dbx.DB.Create(&ChannelModelHealth{
		ChannelId: key.ChannelId, KeyIndex: key.KeyIndex, Model: key.Model, Version: 1,
	}).Error)

	const writers = 8
	var wg sync.WaitGroup
	for range writers {
		wg.Add(1)
		go func() {
			defer wg.Done()
			require.NoError(t, ReportOutcome(key, UnitFatal, 0, 0, time.Now()))
		}()
	}
	wg.Wait()

	row := readUnitRow(t, key)
	assert.Equal(t, 1+writers, row.Version, "no lost CAS update: version must advance by the writer count")
	assert.Equal(t, writers, row.CooldownStreak, "every transition must have been applied")
}

// TestForceRecallUnit_ClearsCooldownKeepsStreaks pins the recall contract: the
// live cooldown deadline is cleared and the slow-start ramp re-arms, but the
// cooldown ledger is preserved — recall is a fast path back, not a wipe.
func TestForceRecallUnit_ClearsCooldownKeepsStreaks(t *testing.T) {
	withUnitHealthDB(t)
	key := RouteKey{ChannelId: 9503, KeyIndex: 0, Model: "recall-model"}
	require.NoError(t, dbx.DB.Create(&ChannelModelHealth{
		ChannelId: key.ChannelId, KeyIndex: key.KeyIndex, Model: key.Model, Version: 1,
	}).Error)
	require.NoError(t, ReportOutcome(key, UnitFatal, 0, 0, time.Now()))

	require.NoError(t, ForceRecallUnit(key, time.Now()))

	row := readUnitRow(t, key)
	assert.Equal(t, int64(0), row.CooldownUntilMs, "recall clears the live deadline")
	assert.True(t, row.RampPending, "recall re-arms the slow-start ramp")
	assert.Equal(t, 1, row.CooldownStreak, "recall keeps the cooldown ledger")
	assert.True(t, row.ProbePending, "a force recall puts the unit on recovery probation")
}

// TestRecoverUnit_ClearsTerminalArmsRamp pins the admin revive: a
// hard-disabled unit clears the hard-disable flag, drops any cooldown, and
// re-enters through the ramp. The EWMA history is preserved, not reset.
func TestRecoverUnit_ClearsTerminalArmsRamp(t *testing.T) {
	withUnitHealthDB(t)
	key := RouteKey{ChannelId: 9504, KeyIndex: 0, Model: "recover-model"}
	require.NoError(t, dbx.DB.Create(&ChannelModelHealth{
		ChannelId: key.ChannelId, KeyIndex: key.KeyIndex, Model: key.Model, Version: 1,
		EwmaScore: 0.6,
	}).Error)
	require.NoError(t, DisableUnit(key, time.Now()))
	assert.True(t, readUnitRow(t, key).HardDisabled,
		"disable persists the hard-disable flag (terminal)")

	require.NoError(t, RecoverUnit(key, time.Now()))

	row := readUnitRow(t, key)
	assert.False(t, row.HardDisabled, "recover clears the hard-disable flag")
	assert.Equal(t, int64(0), row.CooldownUntilMs, "recover drops any live cooldown")
	assert.True(t, row.RampPending, "recover re-arms the slow-start ramp")
	assert.InDelta(t, 0.6, row.EwmaScore, 1e-9, "recover keeps the EWMA history")
}

// TestListUnitHealth_OmitsFreshRows pins the admin-view filter: a unit with no
// history (all defaults) is not listed — the audit surface only shows units
// that actually ran.
func TestListUnitHealth_OmitsFreshRows(t *testing.T) {
	withUnitHealthDB(t)
	liveKey := RouteKey{ChannelId: 9505, KeyIndex: 0, Model: "live-model"}
	require.NoError(t, dbx.DB.Create(&ChannelModelHealth{
		ChannelId: 9505, KeyIndex: 0, Model: "fresh-model", Version: 1,
	}).Error)
	require.NoError(t, ReportOutcome(liveKey, UnitFatal, 0, 0, time.Now()))

	views, err := ListUnitHealth(liveKey.ChannelId)
	require.NoError(t, err)

	names := map[string]bool{}
	for _, v := range views {
		names[v.Model] = true
	}
	assert.True(t, names["live-model"], "a unit with history is listed")
	assert.False(t, names["fresh-model"], "a never-ran unit is omitted from the audit")
}
