package main

import (
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func TestBuildLegacyMigrationPreservesPlansSubscriptionsAndWalletQuota(t *testing.T) {
	now := time.Unix(1_800_000_000, 0)
	activeUntil := now.Add(30 * 24 * time.Hour)
	dataset := legacyDataset{
		Users: []legacyUserState{{Id: 10, Quota: 900, Group: "pro"}},
		Packages: []SourcePackage{
			{Id: 8, Name: "pro", ProductType: "subscription", Duration: 30, DurationUnit: "day", QuotaUSD: 100, Status: 1, AgentPrice: 7000, RetailPrice: 8900},
			{Id: 17, Name: "historical-card", ProductType: "card_key", Duration: 30, DurationUnit: "day", QuotaUSD: 0.01, Status: 2, AgentPrice: 45000, RetailPrice: 52000},
		},
		Offers: []SourceOffer{
			{Id: 21, PackageId: 8, OfferType: "agent", Amount: 7000, RefundFeeType: "fixed", RefundFeeValue: 500, Status: 1},
			{Id: 39, PackageId: 17, OfferType: "agent", Amount: 45000, RefundFeeType: "percent", RefundFeeValue: 1000, Status: 1},
		},
		UserPackages: []SourceUserPackage{{Id: 100, UserId: 10, PackageId: 8, QuotaAllocated: 800, AppliedAt: now, ExpireAt: &activeUntil, ActivatedAt: &now}},
		QuotaGrants: []SourceQuotaGrant{
			{Id: 1, UserId: 10, Remaining: 800, Status: 1, SourceType: "user_package", SourceId: 100},
			{Id: 2, UserId: 10, Remaining: 100, Status: 1, SourceType: "admin"},
		},
	}

	migration, err := buildLegacyMigration(dataset, now)
	require.NoError(t, err)
	require.Len(t, migration.Plans, 2)
	assert.True(t, migration.Plans[0].Enabled)
	assert.False(t, migration.Plans[1].Enabled)
	require.Len(t, migration.Offers, 2)
	assert.True(t, migration.Offers[0].Enabled)
	assert.False(t, migration.Offers[1].Enabled)
	assert.Equal(t, 1000, migration.Offers[1].RefundFeeBps)
	require.Len(t, migration.Subscriptions, 1)
	assert.Equal(t, int64(800), migration.Subscriptions[0].AmountTotal)
	assert.Equal(t, int64(0), migration.Subscriptions[0].AmountUsed)
	assert.Equal(t, "active", migration.Subscriptions[0].Status)
	assert.Equal(t, map[int]int64{10: 100}, migration.WalletQuotaByUser)
}

func TestBuildLegacyMigrationCreatesAuditableAgentLedgerAndOrder(t *testing.T) {
	now := time.Unix(1_800_000_000, 0)
	dataset := legacyDataset{
		Users:    []legacyUserState{{Id: 315, Quota: 0, Group: "default"}},
		Packages: []SourcePackage{{Id: 8, Name: "pro", ProductType: "subscription", Duration: 30, DurationUnit: "day", QuotaUSD: 100, Status: 1, AgentPrice: 7000, RetailPrice: 8900}},
		Offers:   []SourceOffer{{Id: 21, PackageId: 8, OfferType: "agent", Amount: 7000, RefundFeeType: "fixed", RefundFeeValue: 500, Status: 1}},
		Credits:  []SourceAgentCredit{{Id: 1, UserId: 315, Balance: 86_000, Status: 1, DailyGenLimit: 200, CreatedAt: now.Unix(), UpdatedAt: now.Unix()}},
		CreditLogs: []SourceAgentCreditLog{
			{Id: 1, UserId: 315, Delta: 100_000, Before: 0, After: 100_000, ChangeType: "topup", CreatedAt: now.Unix() - 10},
			{Id: 2, UserId: 315, Delta: -14_000, Before: 100_000, After: 86_000, ChangeType: "purchase", Remark: "购买兑换码: pro x2", CreatedAt: now.Unix()},
		},
		Redemptions: []SourceRedemption{
			{Id: 51, Key: "code-1", Status: common.RedemptionCodeStatusEnabled, Type: 2, PackageId: 8, AgentId: 315, CreatedTime: now.Unix()},
			{Id: 52, Key: "code-2", Status: common.RedemptionCodeStatusRefunded, Type: 2, PackageId: 8, AgentId: 315, CreatedTime: now.Unix() + 1},
		},
	}

	migration, err := buildLegacyMigration(dataset, now)
	require.NoError(t, err)
	require.Len(t, migration.Accounts, 1)
	assert.Equal(t, int64(86_000), migration.Accounts[0].Balance)
	require.Len(t, migration.CreditLogs, 2)
	assert.Equal(t, "legacy-agent-credit:1", migration.CreditLogs[0].Log.BusinessKey)
	assert.Equal(t, int64(86_000), migration.CreditLogs[0].Log.Delta+migration.CreditLogs[1].Log.Delta)
	require.Len(t, migration.Orders, 1)
	assert.Equal(t, 315, migration.Orders[0].Order.AgentUserId)
	assert.Equal(t, 2, migration.Orders[0].Order.Quantity)
	assert.Equal(t, int64(7000), migration.Orders[0].Order.UnitPrice)
	assert.Equal(t, model.AgentPurchaseOrderStatusPartiallyRefunded, migration.Orders[0].Order.Status)
	assert.Equal(t, []int{51, 52}, migration.Orders[0].SourceRedemptionIDs)
}

func TestBuildLegacyMigrationRejectsQuotaMismatch(t *testing.T) {
	now := time.Unix(1_800_000_000, 0)
	_, err := buildLegacyMigration(legacyDataset{
		Users:       []legacyUserState{{Id: 10, Quota: 100}},
		QuotaGrants: []SourceQuotaGrant{{UserId: 10, Remaining: 99, Status: 1, SourceType: "admin"}},
	}, now)
	require.ErrorContains(t, err, "quota mismatch")
}

func TestBuildLegacyMigrationTracksZeroWalletUsers(t *testing.T) {
	now := time.Unix(1_800_000_000, 0)
	migration, err := buildLegacyMigration(legacyDataset{
		Users:        []legacyUserState{{Id: 11, Quota: 800}},
		Packages:     []SourcePackage{{Id: 8, Name: "pro", ProductType: "subscription", Duration: 30, DurationUnit: "day", QuotaUSD: 100, Status: 1, AgentPrice: 7000}},
		UserPackages: []SourceUserPackage{{Id: 101, UserId: 11, PackageId: 8, QuotaAllocated: 800, AppliedAt: now, ActivatedAt: &now}},
		QuotaGrants:  []SourceQuotaGrant{{Id: 1, UserId: 11, Remaining: 800, Status: 1, SourceType: "user_package", SourceId: 101}},
	}, now)
	require.NoError(t, err)
	assert.Contains(t, migration.WalletQuotaByUser, 11)
	assert.Equal(t, int64(0), migration.WalletQuotaByUser[11])
}

func TestRestoreLegacyPlanEnabledPreservesDisabledPlans(t *testing.T) {
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	require.NoError(t, err)
	require.NoError(t, db.AutoMigrate(&model.SubscriptionPlan{}))
	plans := []model.SubscriptionPlan{
		{Id: 8, Title: "pro", Currency: "CNY", DurationUnit: "day", DurationValue: 30, Enabled: true},
		{Id: 12, Title: "historical", Currency: "CNY", DurationUnit: "day", DurationValue: 30, Enabled: false},
	}
	enabledByID := legacyPlanEnabledByID(plans)
	require.NoError(t, db.Session(&gorm.Session{SkipHooks: true}).Create(&plans).Error)

	require.NoError(t, restoreLegacyPlanEnabled(db, enabledByID))
	var stored []model.SubscriptionPlan
	require.NoError(t, db.Order("id ASC").Find(&stored).Error)
	require.Len(t, stored, 2)
	assert.True(t, stored[0].Enabled)
	assert.False(t, stored[1].Enabled)
}
