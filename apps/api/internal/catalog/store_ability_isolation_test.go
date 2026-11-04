package channel

// Model-level isolation (DisableChannelModel) must hold across every unrelated
// ability-table mutation. Production exhibited the failure loop this file pins:
// the health system isolated a failing model (abilities enabled=false), but
// route rows stayed enabled so the model kept receiving traffic, and the next
// channel edit rebuilt the abilities back to enabled, resurrecting the model in
// the marketplace while its upstream was still dead.
//
// The invariant under test: route rows derive their enabled flag from the
// ability rows of the same (channel, model) pair, and ability rebuilds keep
// existing per-model isolation. A whole-channel disable/enable cycle is the
// documented reset: it clears isolation wholesale, abilities and routes
// together.

import (
	"testing"

	"github.com/QuantumNous/new-api/internal/common"
	"github.com/QuantumNous/new-api/internal/common/dbx"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func setupIsolationTest(t *testing.T) {
	t.Helper()

	previousDB := dbx.DB
	previousMain := common.MainDatabaseType()
	previousLog := common.LogDatabaseType()
	common.SetDatabaseTypes(common.DatabaseTypeSQLite, common.DatabaseTypeSQLite)
	dbx.InitColumns()

	db, err := gorm.Open(sqlite.Open("file:"+t.Name()+"?mode=memory&cache=shared"), &gorm.Config{})
	require.NoError(t, err)
	require.NoError(t, db.AutoMigrate(
		&Channel{}, &Ability{}, &ChannelModelRoute{}, &ChannelModelHealth{},
		&GatewayConfigRevision{}, &GatewayConfigOutbox{},
	))
	dbx.DB = db
	require.NoError(t, InitializeGatewayConfigRevision())

	memoryCacheEnabled := common.MemoryCacheEnabled
	common.MemoryCacheEnabled = false
	t.Cleanup(func() {
		dbx.DB = previousDB
		common.SetDatabaseTypes(previousMain, previousLog)
		dbx.InitColumns()
		common.MemoryCacheEnabled = memoryCacheEnabled
		if sqlDB, err := db.DB(); err == nil {
			_ = sqlDB.Close()
		}
	})
}

func seedIsolationChannel(t *testing.T, id int, models string) Channel {
	t.Helper()

	channel := Channel{
		Id: id, Type: 1, Name: "isolation", Key: "sk-isolation",
		Models: models, Group: "g1,g2", Status: common.ChannelStatusEnabled,
	}
	require.NoError(t, channel.Insert())
	return channel
}

func abilityEnabledByModel(t *testing.T, channelID int) map[string]bool {
	t.Helper()

	rows := []Ability{}
	require.NoError(t, dbx.DB.Where("channel_id = ?", channelID).Find(&rows).Error)
	enabled := make(map[string]bool)
	for _, row := range rows {
		previous, seen := enabled[row.Model]
		if seen {
			require.Equal(t, previous, row.Enabled,
				"ability rows of one model must not disagree across groups")
		}
		enabled[row.Model] = row.Enabled
	}
	return enabled
}

func routeEnabledByAlias(t *testing.T, channelID int) map[string]bool {
	t.Helper()

	rows := []ChannelModelRoute{}
	require.NoError(t, dbx.DB.Where("channel_id = ?", channelID).Find(&rows).Error)
	enabled := make(map[string]bool)
	for _, row := range rows {
		previous, seen := enabled[row.PublicModelAlias]
		if seen {
			require.Equal(t, previous, row.Enabled,
				"route rows of one alias must not disagree across groups")
		}
		enabled[row.PublicModelAlias] = row.Enabled
	}
	return enabled
}

func TestDisableChannelModelDisablesAbilitiesAndRoutes(t *testing.T) {
	setupIsolationTest(t)
	seedIsolationChannel(t, 9101, "model-a,model-b")

	require.NoError(t, DisableChannelModel(9101, "model-a"))

	abilities := abilityEnabledByModel(t, 9101)
	assert.False(t, abilities["model-a"], "isolated model ability rows must be disabled")
	assert.True(t, abilities["model-b"], "healthy model ability rows must stay enabled")

	routes := routeEnabledByAlias(t, 9101)
	assert.False(t, routes["model-a"],
		"isolated model route rows must be disabled, or the model keeps receiving traffic")
	assert.True(t, routes["model-b"], "healthy model route rows must stay enabled")
}

// TestAutoDisableChannelModelMarkedAndRecoverable pins the auto-disabled
// marker: an automatic disable marks the ability rows, a manual disable does
// not, and automatic recovery revives only the marked rows.
func TestAutoDisableChannelModelMarkedAndRecoverable(t *testing.T) {
	setupIsolationTest(t)
	seedIsolationChannel(t, 9110, "auto-model,manual-model")

	require.NoError(t, AutoDisableChannelModel(9110, "auto-model"))
	require.NoError(t, DisableChannelModel(9110, "manual-model"))

	assertAbilityMarker := func(model string, wantEnabled, wantAuto bool) {
		t.Helper()
		var rows []Ability
		require.NoError(t, dbx.DB.Where("channel_id = ? AND model = ?", 9110, model).Find(&rows).Error)
		require.NotEmpty(t, rows)
		for _, row := range rows {
			assert.Equal(t, wantEnabled, row.Enabled, "model %s enabled", model)
			assert.Equal(t, wantAuto, row.AutoDisabled, "model %s auto_disabled marker", model)
		}
	}

	assertAbilityMarker("auto-model", false, true)
	assertAbilityMarker("manual-model", false, false)

	require.NoError(t, RestoreAutoDisabledChannelModel(9110, "auto-model"))
	require.NoError(t, RestoreAutoDisabledChannelModel(9110, "manual-model"))

	assertAbilityMarker("auto-model", true, false)
	assertAbilityMarker("manual-model", false, false)
}

func TestChannelEditPreservesModelIsolation(t *testing.T) {
	setupIsolationTest(t)
	channel := seedIsolationChannel(t, 9102, "model-a,model-b")
	require.NoError(t, DisableChannelModel(9102, "model-a"))

	// The exact production trigger: an admin edit that keeps the isolated
	// model in the list must not resurrect it.
	channel.Models = "model-a,model-b,model-c"
	require.NoError(t, channel.Update())

	abilities := abilityEnabledByModel(t, 9102)
	assert.False(t, abilities["model-a"], "channel edit must preserve model isolation")
	assert.True(t, abilities["model-b"])
	assert.True(t, abilities["model-c"], "newly added model must be enabled")

	routes := routeEnabledByAlias(t, 9102)
	assert.False(t, routes["model-a"], "route rows must stay derived from isolated abilities")
	assert.True(t, routes["model-b"])
	assert.True(t, routes["model-c"])
}

func TestRemoveAndReaddModelClearsIsolation(t *testing.T) {
	setupIsolationTest(t)
	channel := seedIsolationChannel(t, 9103, "model-a,model-b")
	require.NoError(t, DisableChannelModel(9103, "model-a"))

	// Removing the model drops its rows entirely; re-adding creates fresh
	// ones. That round trip is the explicit admin recovery path.
	channel.Models = "model-b"
	require.NoError(t, channel.Update())
	channel.Models = "model-a,model-b"
	require.NoError(t, channel.Update())

	abilities := abilityEnabledByModel(t, 9103)
	assert.True(t, abilities["model-a"], "re-added model must start enabled")
	routes := routeEnabledByAlias(t, 9103)
	assert.True(t, routes["model-a"], "re-added model must be routable again")
}

func TestChannelStatusCycleResetsIsolationWholesale(t *testing.T) {
	setupIsolationTest(t)
	seedIsolationChannel(t, 9104, "model-a,model-b")
	require.NoError(t, DisableChannelModel(9104, "model-a"))

	require.True(t, StoreUpdateChannelStatus(9104, "", common.ChannelStatusManuallyDisabled, "test"),
		"disabling an enabled channel must take effect")
	assert.Equal(t, map[string]bool{"model-a": false, "model-b": false}, abilityEnabledByModel(t, 9104))
	assert.Equal(t, map[string]bool{"model-a": false, "model-b": false}, routeEnabledByAlias(t, 9104),
		"routes must follow the disabled channel's abilities")

	require.True(t, StoreUpdateChannelStatus(9104, "", common.ChannelStatusEnabled, "test"),
		"re-enabling a disabled channel must take effect")
	assert.Equal(t, map[string]bool{"model-a": true, "model-b": true}, abilityEnabledByModel(t, 9104))
	assert.Equal(t, map[string]bool{"model-a": true, "model-b": true}, routeEnabledByAlias(t, 9104),
		"a re-enabled channel must not leave route rows disabled behind enabled abilities")
}

func TestDisableChannelModelIsolatesMultipleModels(t *testing.T) {
	setupIsolationTest(t)
	channel := seedIsolationChannel(t, 9106, "model-a,model-b,model-c")
	require.NoError(t, DisableChannelModel(9106, "model-a"))
	require.NoError(t, DisableChannelModel(9106, "model-c"))

	// An unrelated edit that keeps both isolated models in the list must not
	// resurrect either of them.
	channel.Models = "model-a,model-b,model-c,model-d"
	require.NoError(t, channel.Update())

	abilities := abilityEnabledByModel(t, 9106)
	assert.False(t, abilities["model-a"])
	assert.False(t, abilities["model-c"], "every isolated model must survive an edit")
	assert.True(t, abilities["model-b"])
	assert.True(t, abilities["model-d"])
	routes := routeEnabledByAlias(t, 9106)
	assert.False(t, routes["model-a"])
	assert.False(t, routes["model-c"])
	assert.True(t, routes["model-b"])
	assert.True(t, routes["model-d"])
}

func TestTagStatusFlipDoesNotLeakAcrossChannels(t *testing.T) {
	setupIsolationTest(t)

	tag := "flip-me"
	tagged := Channel{
		Id: 9107, Type: 1, Name: "tagged", Key: "sk-tagged",
		Models: "model-a,model-b", Group: "g1", Tag: &tag,
		Status: common.ChannelStatusEnabled,
	}
	untagged := Channel{
		Id: 9108, Type: 1, Name: "untagged", Key: "sk-untagged",
		Models: "model-a,model-b", Group: "g1",
		Status: common.ChannelStatusEnabled,
	}
	require.NoError(t, tagged.Insert())
	require.NoError(t, untagged.Insert())
	require.NoError(t, DisableChannelModel(9107, "model-a"))
	require.NoError(t, DisableChannelModel(9108, "model-a"))

	require.NoError(t, DisableChannelByTag(tag))
	require.NoError(t, EnableChannelByTag(tag))

	// The tag flip resets isolation on channels carrying the tag, and must
	// leave channels outside the tag untouched.
	assert.Equal(t, map[string]bool{"model-a": true, "model-b": true},
		abilityEnabledByModel(t, 9107), "tag flip resets isolation on tagged channels")
	assert.Equal(t, map[string]bool{"model-a": true, "model-b": true},
		routeEnabledByAlias(t, 9107))
	assert.Equal(t, map[string]bool{"model-a": false, "model-b": true},
		abilityEnabledByModel(t, 9108), "untagged channel isolation must be untouched")
	assert.Equal(t, map[string]bool{"model-a": false, "model-b": true},
		routeEnabledByAlias(t, 9108))
}

func TestBatchSetChannelTagStampsNewTagAndKeepsIsolation(t *testing.T) {
	setupIsolationTest(t)
	seedIsolationChannel(t, 9109, "model-a,model-b")
	require.NoError(t, DisableChannelModel(9109, "model-a"))

	newTag := "batch-tag"
	require.NoError(t, BatchSetChannelTag([]int{9109}, &newTag))

	// The ability rows are rebuilt inside the same transaction that wrote the
	// tag, so they must carry the new tag — reading the channel back through a
	// pooled connection used to stamp the pre-update tag.
	rows := []Ability{}
	require.NoError(t, dbx.DB.Where("channel_id = ?", 9109).Find(&rows).Error)
	require.NotEmpty(t, rows)
	for _, row := range rows {
		require.NotNil(t, row.Tag, "rebuilt ability rows must carry the batch tag")
		assert.Equal(t, newTag, *row.Tag)
	}

	// Re-tagging is not a reset: an isolated model stays isolated in both tables.
	assert.Equal(t, map[string]bool{"model-a": false, "model-b": true}, abilityEnabledByModel(t, 9109))
	assert.Equal(t, map[string]bool{"model-a": false, "model-b": true}, routeEnabledByAlias(t, 9109))
}

func TestRouteDeriveDisablesAliasWithoutAbilityRow(t *testing.T) {
	setupIsolationTest(t)
	seedIsolationChannel(t, 9110, "model-a,model-b")

	// An ability-only rewrite (the shape the upstream model sync used to leave
	// behind) drops model-b's ability rows while its route rows survive. The
	// next sync must stop that alias serving instead of trusting the stale row.
	require.NoError(t, dbx.DB.Where("channel_id = ? AND model = ?", 9110, "model-b").
		Delete(&Ability{}).Error)
	require.NoError(t, dbx.DB.Transaction(func(tx *gorm.DB) error {
		return deriveRouteEnabledFromAbilities(tx, 9110)
	}))

	routes := routeEnabledByAlias(t, 9110)
	assert.True(t, routes["model-a"])
	assert.False(t, routes["model-b"],
		"an alias with no ability row must not keep serving")
}

func TestRebuildChannelRoutingSyncsAddedAndRemovedModels(t *testing.T) {
	setupIsolationTest(t)
	channel := seedIsolationChannel(t, 9111, "model-a,model-b")

	// The upstream model sync mutates the model list and then rebuilds; route
	// rows must follow, or added models are unroutable and removed models keep
	// serving.
	channel.Models = "model-a,model-c"
	require.NoError(t, dbx.DB.Model(&Channel{}).Where("id = ?", 9111).
		Update("models", channel.Models).Error)
	require.NoError(t, channel.RebuildChannelRouting())

	assert.Equal(t, map[string]bool{"model-a": true, "model-c": true},
		abilityEnabledByModel(t, 9111))
	assert.Equal(t, map[string]bool{"model-a": true, "model-c": true},
		routeEnabledByAlias(t, 9111), "route rows must match the rebuilt model list")
}

func TestFixAbilityReseedsRoutesFromRebuiltAbilities(t *testing.T) {
	setupIsolationTest(t)
	seedIsolationChannel(t, 9105, "model-a,model-b")
	require.NoError(t, DisableChannelModel(9105, "model-a"))

	success, failed, err := FixAbility()
	require.NoError(t, err)
	require.Equal(t, 1, success)
	require.Equal(t, 0, failed)

	// FixAbility is the explicit full-reset: rebuilt abilities are all enabled
	// for an enabled channel, and the route rows must not keep stale disabled
	// flags from before the reset.
	assert.Equal(t, map[string]bool{"model-a": true, "model-b": true}, abilityEnabledByModel(t, 9105))
	assert.Equal(t, map[string]bool{"model-a": true, "model-b": true}, routeEnabledByAlias(t, 9105))
}
