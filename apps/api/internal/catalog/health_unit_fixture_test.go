package channel

import (
	"strconv"
	"testing"

	"github.com/QuantumNous/new-api/internal/common/dbx"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

// withUnitHealthDB gives each test its own in-memory SQLite database and a
// clean process cache, so unit-health state written by one case cannot leak
// into the next. It migrates the routing tables too because RecoverUnit
// restores the recovered model into the routable set (abilities + route rows)
// inside one gateway revision, not just the health row.
//
// It also isolates the two cross-cutting globals the store tests care about:
// the pool-pressure map (reset to empty) and the key-probe cascade hook
// (set to nil so a strike never fires the probe mid-test). Both are restored
// on cleanup.
func withUnitHealthDB(t *testing.T) {
	t.Helper()
	previousDB := dbx.DB
	db, err := gorm.Open(sqlite.Open("file:"+t.Name()+"?mode=memory&cache=shared"), &gorm.Config{})
	require.NoError(t, err)
	require.NoError(t, db.AutoMigrate(
		&ChannelModelHealth{},
		&Channel{}, &Ability{}, &ChannelModelRoute{},
		&GatewayConfigRevision{}, &GatewayConfigOutbox{},
	))
	dbx.DB = db
	require.NoError(t, InitializeGatewayConfigRevision())
	ClearUnitHealthCache()
	resetPressure()
	prevHook := UnitProbeFailHook
	UnitProbeFailHook = nil
	t.Cleanup(func() {
		UnitProbeFailHook = prevHook
		dbx.DB = previousDB
		ClearUnitHealthCache()
		resetPressure()
	})
}

// seedUnitHealthRow persists one unit row and mirrors it into the process
// cache, so a test exercises both the DB and the in-memory fast path. The
// caller sets the fields under test; Version is set explicitly so the CAS
// loop under test sees the expected pre-version.
func seedUnitHealthRow(t *testing.T, row *ChannelModelHealth) {
	t.Helper()
	require.NoError(t, dbx.DB.Create(row).Error)
	unitHealthLock.Lock()
	unitHealthIDM[RouteKey{ChannelId: row.ChannelId, KeyIndex: row.KeyIndex, Model: row.Model}] = stateFromRow(row)
	unitHealthLock.Unlock()
}

// withUnitHealthSetting swaps the live atomic config for the duration of a
// test and restores the previous value, so a threshold set here cannot change
// the defaults another test relies on.
func withUnitHealthSetting(t *testing.T, cfg *UnitHealthSetting) {
	t.Helper()
	previous := GetUnitHealthSetting()
	RestoreUnitHealthSetting(cfg)
	t.Cleanup(func() { RestoreUnitHealthSetting(previous) })
}

// withGatewayDispatchSetting drives a full option round-trip through the live
// atomic config (the mono set_config hot-swap path). Each field is applied via
// UpdateGatewayDispatchOption, which re-reads and patches the live value; the
// previous config is restored on cleanup so later tests see defaults again.
func withGatewayDispatchSetting(t *testing.T, cfg *UnitHealthSetting) {
	t.Helper()
	previous := *GetUnitHealthSetting()
	apply := func(c *UnitHealthSetting) {
		require.NoError(t, UpdateGatewayDispatchOption("GatewayDispatchCooldownBaseMs", strconv.FormatInt(c.CooldownBaseMs, 10)))
		require.NoError(t, UpdateGatewayDispatchOption("GatewayDispatchCooldownMaxMs", strconv.FormatInt(c.CooldownMaxMs, 10)))
		require.NoError(t, UpdateGatewayDispatchOption("GatewayDispatchCooldownRampSteps", strconv.Itoa(c.CooldownRampSteps)))
		require.NoError(t, UpdateGatewayDispatchOption("GatewayDispatchThrottleBaseMs", strconv.FormatInt(c.ThrottleBaseMs, 10)))
		require.NoError(t, UpdateGatewayDispatchOption("GatewayDispatchThrottleMaxMs", strconv.FormatInt(c.ThrottleMaxMs, 10)))
		require.NoError(t, UpdateGatewayDispatchOption("GatewayDispatchScoreDecayTauMs", strconv.FormatInt(c.ScoreDecayTauMs, 10)))
		require.NoError(t, UpdateGatewayDispatchOption("GatewayDispatchHealthAlpha", strconv.FormatFloat(c.Alpha, 'f', -1, 64)))
		require.NoError(t, UpdateGatewayDispatchOption("GatewayDispatchHealthMinRequests", strconv.Itoa(c.MinRequests)))
		require.NoError(t, UpdateGatewayDispatchOption("GatewayDispatchHealthMinScoreFloor", strconv.FormatFloat(c.MinScoreFloor, 'f', -1, 64)))
		require.NoError(t, UpdateGatewayDispatchOption("EmergencyThreshold", strconv.Itoa(c.EmergencyThreshold)))
		require.NoError(t, UpdateGatewayDispatchOption("WarningThreshold", strconv.Itoa(c.WarningThreshold)))
		require.NoError(t, UpdateGatewayDispatchOption("GatewayRetryTotalBudgetMs", strconv.FormatInt(c.RetryTotalBudgetMs, 10)))
	}
	apply(cfg)
	t.Cleanup(func() { apply(&previous) })
}

// restoreDefaultUnitHealthSetting returns the live config to its package
// default so a test that hand-built one does not leak it.
func restoreDefaultUnitHealthSetting(t *testing.T) {
	t.Helper()
	previous := GetUnitHealthSetting()
	RestoreUnitHealthSetting(DefaultUnitHealthSetting())
	t.Cleanup(func() { RestoreUnitHealthSetting(previous) })
}

// captureUnitProbeHook installs a recording sink for the key-probe hook and
// returns it; the hook is restored on cleanup. ReportOutcome runs the hook on a
// pooled goroutine, so callers that need it synchronously should poll the sink
// under its own lock or assert after the goroutine settles.
func captureUnitProbeHook(t *testing.T) *[]RouteKey {
	t.Helper()
	sink := []RouteKey{}
	prev := UnitProbeFailHook
	UnitProbeFailHook = func(key RouteKey) { sink = append(sink, key) }
	t.Cleanup(func() { UnitProbeFailHook = prev })
	return &sink
}

// withChannelHealthEnabled toggles the live health kill switch and restores the
// previous config afterwards. Flipping it off also exercises the reset hook, so
// a test that expects clean state after re-enabling should not assume otherwise.
func withChannelHealthEnabled(t *testing.T, enabled bool) {
	t.Helper()
	previous := *GetChannelHealthSetting()
	cfg := previous
	cfg.Enabled = enabled
	SetChannelHealthSetting(&cfg)
	t.Cleanup(func() {
		restore := previous
		SetChannelHealthSetting(&restore)
	})
}

// resetPressure clears the pool-pressure map so pressure cases do not see
// counters left behind by earlier tests or by the package-level init.
func resetPressure() {
	pressureLock.Lock()
	pressureIDM = map[string]*modelPressure{}
	pressureLock.Unlock()
}

// setPressure installs a known total/healthy pair for a model so a test can
// force a particular PressureLevel without seeding a full pool of rows.
func setPressure(model string, total, healthy int) {
	pressureLock.Lock()
	pressureIDM[model] = &modelPressure{total: total, healthy: healthy}
	pressureLock.Unlock()
}
