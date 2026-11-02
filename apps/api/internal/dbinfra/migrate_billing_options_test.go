package dbinfra

import (
	"testing"

	"github.com/QuantumNous/new-api/internal/common"
	"github.com/QuantumNous/new-api/internal/settings"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestMigrateLegacyBillingOptionsCopiesLegacyMaps(t *testing.T) {
	db := useFrontendOptionMigrationDB(t)
	legacyMode := `{"old-model": "tiered_expr"}`
	legacyExpr := `{"old-model": "tier(\"base\", p * 2 + c * 3)"}`
	require.NoError(t, db.Create(&Option{Key: legacyBillingModeOptionKey, Value: legacyMode}).Error)
	require.NoError(t, db.Create(&Option{Key: legacyBillingExprOptionKey, Value: legacyExpr}).Error)

	require.NoError(t, MigrateLegacyBillingOptions())

	assert.JSONEq(t, legacyMode, requireOptionValue(t, db, "billing_setting.billing_mode"))
	assert.JSONEq(t, legacyExpr, requireOptionValue(t, db, "billing_setting.billing_expr"))
	// Legacy rows are kept so a rollback to a build that still reads the old
	// keys keeps working.
	assert.Equal(t, legacyMode, requireOptionValue(t, db, legacyBillingModeOptionKey))
	assert.Equal(t, legacyExpr, requireOptionValue(t, db, legacyBillingExprOptionKey))

	// ApplyOption records into the process-global OptionMap; isolate it like
	// the retired-frontend-options tests do.
	previousMap := common.OptionMap
	t.Cleanup(func() { common.OptionMap = previousMap })
	common.OptionMap = map[string]string{}

	// The migrated row must be accepted by the same apply path startup uses,
	// otherwise loadOptionsFromDatabase drops it silently.
	require.NoError(t, settings.ApplyOption(
		"billing_setting.billing_expr",
		requireOptionValue(t, db, "billing_setting.billing_expr")))
	assert.Equal(t,
		requireOptionValue(t, db, "billing_setting.billing_expr"),
		common.OptionMap["billing_setting.billing_expr"])
}

func TestMigrateLegacyBillingOptionsKeepsNewerTargetValues(t *testing.T) {
	db := useFrontendOptionMigrationDB(t)
	legacyMode := `{"shared": "tiered_expr", "legacy-only": "tiered_expr"}`
	targetMode := `{"shared": "ratio", "new-only": "tiered_expr"}`
	legacyExpr := `{"shared": "tier(\"legacy\", p * 1 + c * 1)", "legacy-only": "tier(\"base\", p * 2 + c * 3)"}`
	targetExpr := `{"shared": "tier(\"new\", p * 5 + c * 5)", "new-only": "tier(\"base\", p * 1 + c * 1)"}`
	require.NoError(t, db.Create(&Option{Key: legacyBillingModeOptionKey, Value: legacyMode}).Error)
	require.NoError(t, db.Create(&Option{Key: legacyBillingExprOptionKey, Value: legacyExpr}).Error)
	require.NoError(t, db.Create(&Option{Key: "billing_setting.billing_mode", Value: targetMode}).Error)
	require.NoError(t, db.Create(&Option{Key: "billing_setting.billing_expr", Value: targetExpr}).Error)

	require.NoError(t, MigrateLegacyBillingOptions())

	// The shared model keeps the newer target value; models only present in
	// the legacy row are added.
	assert.JSONEq(t,
		`{"shared": "ratio", "new-only": "tiered_expr", "legacy-only": "tiered_expr"}`,
		requireOptionValue(t, db, "billing_setting.billing_mode"))
	assert.JSONEq(t,
		`{"shared": "tier(\"new\", p * 5 + c * 5)", "new-only": "tier(\"base\", p * 1 + c * 1)", "legacy-only": "tier(\"base\", p * 2 + c * 3)"}`,
		requireOptionValue(t, db, "billing_setting.billing_expr"))
}

func TestMigrateLegacyBillingOptionsSkipsMalformedLegacyValue(t *testing.T) {
	db := useFrontendOptionMigrationDB(t)
	require.NoError(t, db.Create(&Option{Key: legacyBillingExprOptionKey, Value: `{invalid`}).Error)

	require.NoError(t, MigrateLegacyBillingOptions())

	requireOptionMissing(t, db, "billing_setting.billing_expr")
	// The malformed row stays for manual recovery.
	assert.Equal(t, `{invalid`, requireOptionValue(t, db, legacyBillingExprOptionKey))
}

func TestMigrateLegacyBillingOptionsIsIdempotent(t *testing.T) {
	db := useFrontendOptionMigrationDB(t)
	legacyExpr := `{"old-model": "tier(\"base\", p * 2 + c * 3)"}`
	require.NoError(t, db.Create(&Option{Key: legacyBillingExprOptionKey, Value: legacyExpr}).Error)

	require.NoError(t, MigrateLegacyBillingOptions())
	first := requireOptionValue(t, db, "billing_setting.billing_expr")
	require.NoError(t, MigrateLegacyBillingOptions())

	assert.Equal(t, first, requireOptionValue(t, db, "billing_setting.billing_expr"))
}

func TestMigrateLegacyBillingOptionsWithoutLegacyRowsCreatesNothing(t *testing.T) {
	db := useFrontendOptionMigrationDB(t)

	require.NoError(t, MigrateLegacyBillingOptions())

	requireOptionMissing(t, db, "billing_setting.billing_mode")
	requireOptionMissing(t, db, "billing_setting.billing_expr")
}

func TestMigrateLegacyBillingOptionsTreatsBlankTargetAsEmpty(t *testing.T) {
	db := useFrontendOptionMigrationDB(t)
	legacyExpr := `{"old-model": "tier(\"base\", p * 2 + c * 3)"}`
	require.NoError(t, db.Create(&Option{Key: legacyBillingExprOptionKey, Value: legacyExpr}).Error)
	require.NoError(t, db.Create(&Option{Key: "billing_setting.billing_expr", Value: ""}).Error)

	require.NoError(t, MigrateLegacyBillingOptions())

	assert.JSONEq(t, legacyExpr, requireOptionValue(t, db, "billing_setting.billing_expr"))
}

func TestMigrateLegacyBillingOptionsSkipsCorruptTarget(t *testing.T) {
	db := useFrontendOptionMigrationDB(t)
	legacyExpr := `{"old-model": "tier(\"base\", p * 2 + c * 3)"}`
	targetExpr := `{invalid`
	require.NoError(t, db.Create(&Option{Key: legacyBillingExprOptionKey, Value: legacyExpr}).Error)
	require.NoError(t, db.Create(&Option{Key: "billing_setting.billing_expr", Value: targetExpr}).Error)

	require.NoError(t, MigrateLegacyBillingOptions())

	// The corrupt target is newer than the legacy row and must not be
	// overwritten; the legacy row stays for manual recovery.
	assert.Equal(t, targetExpr, requireOptionValue(t, db, "billing_setting.billing_expr"))
	assert.Equal(t, legacyExpr, requireOptionValue(t, db, legacyBillingExprOptionKey))
}

func TestMigrateLegacyBillingOptionsIgnoresEmptyLegacyEntries(t *testing.T) {
	db := useFrontendOptionMigrationDB(t)
	// JSON null parses into an empty string entry, which is "not configured"
	// at runtime and must not be imported.
	require.NoError(t, db.Create(&Option{Key: legacyBillingExprOptionKey, Value: `{"old-model": null}`}).Error)

	require.NoError(t, MigrateLegacyBillingOptions())

	requireOptionMissing(t, db, "billing_setting.billing_expr")
}

func TestMigrateLegacyBillingOptionsIgnoresEmptyLegacyMap(t *testing.T) {
	db := useFrontendOptionMigrationDB(t)
	require.NoError(t, db.Create(&Option{Key: legacyBillingExprOptionKey, Value: `{}`}).Error)

	require.NoError(t, MigrateLegacyBillingOptions())

	requireOptionMissing(t, db, "billing_setting.billing_expr")
}

func TestMigrateLegacyBillingOptionsImportsIntoEmptyTargetMap(t *testing.T) {
	db := useFrontendOptionMigrationDB(t)
	legacyExpr := `{"old-model": "tier(\"base\", p * 2 + c * 3)"}`
	require.NoError(t, db.Create(&Option{Key: legacyBillingExprOptionKey, Value: legacyExpr}).Error)
	require.NoError(t, db.Create(&Option{Key: "billing_setting.billing_expr", Value: `{}`}).Error)

	require.NoError(t, MigrateLegacyBillingOptions())

	assert.JSONEq(t, legacyExpr, requireOptionValue(t, db, "billing_setting.billing_expr"))
}
