package channel

import (
	"github.com/QuantumNous/new-api/internal/common/dbx"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// TestInitUnitHealthCacheLoadsPersistedState pins the startup hydration:
// InitUnitHealthCache must reload the persisted unit states (cooldown and
// terminal-disabled) into the in-process mirror so a restarted process keeps
// excluding quarantined units instead of silently returning them to rotation.
func TestInitUnitHealthCacheLoadsPersistedState(t *testing.T) {
	withUnitHealthDB(t)

	now := time.Now()
	nowMs := now.UnixMilli()
	coolingUntil := nowMs + 30_000
	terminalUntil := nowMs + 60_000

	require.NoError(t, dbx.DB.Create(&ChannelModelHealth{
		ChannelId: 9401, Model: "startup-cooling", Version: 4,
		EwmaScore: 0.4, RequestCount: 7,
		CooldownUntilMs: coolingUntil, LastCoolingOutcome: int(UnitFatal),
	}).Error)
	require.NoError(t, dbx.DB.Create(&ChannelModelHealth{
		ChannelId: 9402, Model: "startup-terminal", Version: 2,
		HardDisabled: true, CooldownUntilMs: terminalUntil,
	}).Error)
	ClearUnitHealthCache()

	InitUnitHealthCache()

	coolingKey := RouteKey{ChannelId: 9401, Model: "startup-cooling"}
	assert.False(t, IsUnitSelectable(coolingKey, now), "a cooling unit is not selectable")
	assert.Equal(t, coolingUntil-nowMs, CoolingRemainingMs(coolingKey, now), "the remaining window is the persisted deadline")
	cooling := UnitState(coolingKey)
	assert.Equal(t, 0.4, cooling.EwmaScore)
	assert.Equal(t, 7, cooling.RequestCount)
	assert.True(t, cooling.IsCooling(nowMs))

	terminalKey := RouteKey{ChannelId: 9402, Model: "startup-terminal"}
	assert.True(t, UnitState(terminalKey).TerminalDisabled, "a cap-of-strikes row hydrates as terminal-disabled")
	assert.False(t, IsUnitSelectable(terminalKey, now), "a terminal-disabled unit is not selectable")
}
