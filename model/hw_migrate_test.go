package model

import (
	"testing"

	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

// TestHwMigrateOnlyOurTables proves that HwMigrateModels migrates exactly the
// tables this fork used to list in migrateDB, and nothing else. That list is
// the contract the hook in model/main.go relies on: an upstream AutoMigrate
// rewrite cannot drop one of our tables as long as this test names them.
func TestHwMigrateOnlyOurTables(t *testing.T) {
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	require.NoError(t, err)

	ourTables := []any{
		&HwCreditPackage{},
		&HwUserSignal{},
		&HwFirstPurchaseClaim{},
		&HwFreeCreditClaim{},
		&HwSignupIp{},
		&HwAccountFlag{},
		&HwTelegramUpdate{},
		&HwTelegramLinkToken{},
		&HwOrder{},
		&HwMailLog{},
		&HwAffiliateRetry{},
		&HwPriceSnapshot{},
		&HwQualityRun{},
		&HwQualityScore{},
		&HwStatusSample{},
		&HwIncident{},
		&HwCreditExtension{},
		&HwTextOverride{},
		&HwAdminEscalation{},
		&HwAssistantHit{},
		&HwAssistantFeedback{},
		&HwPricingFeedback{},
	}

	require.NoError(t, db.AutoMigrate(&Option{}))
	require.NoError(t, HwMigrateModels(db))
	for _, table := range ourTables {
		require.True(t, db.Migrator().HasTable(table), "missing table for %T", table)
	}

	// Nothing upstream may appear: the hook only owns the list above.
	require.False(t, db.Migrator().HasTable(&Channel{}), "HwMigrateModels migrated an upstream table")

	// The one-off credit-validity migration runs here and leaves its marker, so
	// a second start does not extend packages again.
	require.True(t, db.Migrator().HasTable(&Option{}), "the data migration lost the options table")
	var marker Option
	require.NoError(t, db.Where(commonKeyCol+" = ?", hwValidityMigratedOption).First(&marker).Error)

	// Idempotent: a restart changes nothing and does not fail.
	require.NoError(t, HwMigrateModels(db))
}

// TestHwMigrateModelsRejectsNilDatabase guards the hook against a start without
// a database handle, where AutoMigrate would panic instead of reporting.
func TestHwMigrateModelsRejectsNilDatabase(t *testing.T) {
	require.Error(t, HwMigrateModels(nil))
}
