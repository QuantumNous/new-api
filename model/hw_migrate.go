package model

// Every table this fork adds, migrated in one call so model/main.go keeps a
// single hook line instead of a list of our types in the middle of the
// upstream migration. Keeping the list here also means an upstream AutoMigrate
// rewrite cannot silently drop one of our tables.
//
// The order inside this file is the order of the migration: the legacy shape is
// removed first, because AutoMigrate only adds columns and would keep the old
// one forever; then the tables are created; then the one-off data migrations
// run on the tables that now exist.

import (
	"fmt"

	"github.com/QuantumNous/new-api/common"

	"gorm.io/gorm"
)

// HwMigrateModels brings the database to our schema: it drops the legacy
// shapes that AutoMigrate cannot fix, creates or updates every table of this
// fork, and runs the one-off data migrations. It is idempotent, so a restart
// changes nothing the second time.
func HwMigrateModels(db *gorm.DB) error {
	if db == nil {
		return fmt.Errorf("migrate models: no database handle")
	}
	if err := hwDropLegacyUserSignalsTable(db); err != nil {
		return err
	}
	if err := db.AutoMigrate(
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
	); err != nil {
		return err
	}
	if _, err := HwMigrateCreditValidity(db, common.GetTimestamp()); err != nil {
		return fmt.Errorf("migrate credit validity: %w", err)
	}
	return nil
}
