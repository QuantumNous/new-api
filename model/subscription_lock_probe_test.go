package model

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

// Probe: GORM v2 silently ignores tx.Set("gorm:query_option","FOR UPDATE") (v1 syntax).
// We build a dry-run SELECT with both syntaxes and compare the generated SQL.

func TestProbe_GormV1QueryOptionIgnored(t *testing.T) {
	setupTimeQuotaTestDB(t)

	dryDB := DB.Session(&gorm.Session{DryRun: true})

	// v1 syntax (what the codebase uses — BROKEN in GORM v2)
	stmtV1 := dryDB.Set("gorm:query_option", "FOR UPDATE").
		Where("id = ?", 1).Find(&UserSubscription{}).Statement
	sqlV1 := stmtV1.SQL.String()

	// v2 syntax (correct for GORM v2+)
	stmtV2 := dryDB.Clauses(clause.Locking{Strength: "UPDATE"}).
		Where("id = ?", 1).Find(&UserSubscription{}).Statement
	sqlV2 := stmtV2.SQL.String()

	t.Logf("v1-syntax SQL: %q", sqlV1)
	t.Logf("v2-syntax SQL: %q", sqlV2)

	assert.NotContains(t, sqlV1, "FOR UPDATE", "GORM v2 silently ignores v1 query_option (BUG)")
	assert.Contains(t, sqlV2, "FOR UPDATE", "Clauses(Locking) correctly emits FOR UPDATE")
}
