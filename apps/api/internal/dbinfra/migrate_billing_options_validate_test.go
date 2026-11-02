package dbinfra_test

// The startup chain "migrated DB row -> settings.ApplyOption -> typed billing
// config -> runtime accessors" can only be asserted with internal/billing
// linked, because the billing_setting registration lives in that package's
// init(). This file mirrors the external-test pattern of
// migrate_frontend_options_validate_test.go; the in-package tests cover the
// DB-level merge contract.

import (
	"testing"

	"github.com/QuantumNous/new-api/internal/billing"
	"github.com/QuantumNous/new-api/internal/common"
	"github.com/QuantumNous/new-api/internal/common/dbx"
	"github.com/QuantumNous/new-api/internal/dbinfra"
	"github.com/QuantumNous/new-api/internal/settings"

	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func TestMigratedLegacyBillingOptionsReachRuntimeConfig(t *testing.T) {
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	require.NoError(t, err)
	require.NoError(t, db.AutoMigrate(&dbinfra.Option{}))

	previousOptionMap := common.OptionMap
	common.OptionMap = make(map[string]string)
	t.Cleanup(func() { common.OptionMap = previousOptionMap })

	previousDB, previousType := dbx.DB, common.MainDatabaseType()
	dbx.DB = db
	common.SetMainDatabaseType(common.DatabaseTypeSQLite)
	t.Cleanup(func() {
		dbx.DB = previousDB
		common.SetMainDatabaseType(previousType)
	})

	require.NoError(t, db.Create(&dbinfra.Option{
		Key:   "ModelBillingMode",
		Value: `{"legacy-model": "tiered_expr"}`,
	}).Error)
	require.NoError(t, db.Create(&dbinfra.Option{
		Key:   "ModelBillingExpr",
		Value: `{"legacy-model": "tier(\"base\", p * 2 + c * 3)"}`,
	}).Error)

	require.NoError(t, dbinfra.MigrateLegacyBillingOptions())

	// Replay what loadOptionsFromDatabase does at startup: every option row
	// is applied through settings.ApplyOption.
	options, err := dbinfra.AllOption()
	require.NoError(t, err)
	applied := map[string]string{}
	for _, option := range options {
		require.NoError(t, settings.ApplyOption(option.Key, option.Value))
		applied[option.Key] = option.Value
	}

	assert.JSONEq(t,
		`{"legacy-model": "tiered_expr"}`,
		applied["billing_setting.billing_mode"])
	assert.JSONEq(t,
		`{"legacy-model": "tier(\"base\", p * 2 + c * 3)"}`,
		applied["billing_setting.billing_expr"])

	// The runtime accessors the relay hot path and the pricing editor
	// depend on must see the migrated data.
	assert.Equal(t, "tiered_expr", billing.GetBillingMode("legacy-model"))
	expr, ok := billing.GetBillingExpr("legacy-model")
	require.True(t, ok)
	assert.Equal(t, `tier("base", p * 2 + c * 3)`, expr)
}
