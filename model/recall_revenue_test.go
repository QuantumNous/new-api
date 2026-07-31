package model

import (
	"context"
	"fmt"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func TestRecallRevenueTotalsJSONUsesSnakeCase(t *testing.T) {
	raw, err := common.Marshal(RecallRevenueTotals{
		Currency:                 "USD",
		AttributedSpendMinor:     100,
		AttributedUsers:          1,
		NewExternalCashMinor:     90,
		ExternalCashUsers:        2,
		DirectTopupMinor:         80,
		DirectTopupUsers:         3,
		BalanceSubscriptionMinor: 70,
		BalanceSubscriptionUsers: 4,
		OnlineSubscriptionMinor:  60,
		OnlineSubscriptionUsers:  5,
		UnclassifiedMinor:        50,
		UnclassifiedUsers:        6,
	})
	require.NoError(t, err)
	require.Contains(t, string(raw), `"attributed_spend_minor":100`)
	require.Contains(t, string(raw), `"online_subscription_users":5`)
	require.NotContains(t, string(raw), "AttributedSpendMinor")

	var decoded map[string]any
	require.NoError(t, common.Unmarshal(raw, &decoded))
	require.Contains(t, decoded, "currency")
	require.Contains(t, decoded, "direct_topup_users")
	require.NotContains(t, decoded, "DirectTopupUsers")
}

func TestRecallRevenueActivity14Fixture(t *testing.T) {
	setupRecallRevenueTestDB(t)

	require.NoError(t, DB.Create(&RecallCampaign{
		Id: 14, Name: "activity 14", Status: RecallCampaignCompleted, AudienceTemplate: "first_purchase",
		AudienceConfig: `{}`, ExecutionMode: "manual", CouponSource: "automatic", DiscountConfig: `{}`,
		ProductScope: `{}`, EmailSequenceConfig: `[]`,
	}).Error)
	require.NoError(t, DB.Create(&User{Id: 7824, Username: "activity-14-topup", Email: "7824@example.com", AffCode: "aff-7824"}).Error)
	require.NoError(t, DB.Create(&User{Id: 7835, Username: "activity-14-balance-sub", Email: "7835@example.com", AffCode: "aff-7835"}).Error)
	require.NoError(t, DB.Create(&RecallRecipient{
		CampaignId: 14, UserId: 7824, RecipientIdentity: RecallRecipientIdentityForUser(7824),
		EligibilitySnapshot: `{}`, EmailSnapshot: "7824@example.com", LanguageSnapshot: "en",
		State: RecallRecipientConverted, ConversionTradeNo: "act14_topup", ConversionCurrency: "USD",
		ConversionAmount: 1600, ConvertedAt: 1_700_000_100,
	}).Error)
	require.NoError(t, DB.Create(&RecallRecipient{
		CampaignId: 14, UserId: 7835, RecipientIdentity: RecallRecipientIdentityForUser(7835),
		EligibilitySnapshot: `{}`, EmailSnapshot: "7835@example.com", LanguageSnapshot: "en",
		State: RecallRecipientConverted, ConversionTradeNo: "act14_balance_sub", ConversionCurrency: "USD",
		ConversionAmount: 8000, ConvertedAt: 1_700_000_200,
	}).Error)
	require.NoError(t, DB.Create(&TopUp{
		UserId: 7824, TradeNo: "act14_topup", PaymentProvider: PaymentProviderStripe,
		Status: common.TopUpStatusSuccess, PaymentCurrency: "USD", PaymentAmountMinor: 3200,
	}).Error)
	require.NoError(t, DB.Create(&SubscriptionOrder{
		UserId: 7835, PlanId: 1, TradeNo: "act14_balance_sub", PaymentProvider: PaymentProviderBalance,
		PaymentMethod: PaymentMethodBalance, Status: common.TopUpStatusSuccess,
		PaymentCurrency: "USD", PaymentAmountMinor: 10000,
	}).Error)
	var order SubscriptionOrder
	require.NoError(t, DB.Where("trade_no = ?", "act14_balance_sub").First(&order).Error)
	require.NoError(t, DB.Create(&WalletLedgerEntry{
		UserId: 7835, EntryKey: "prepaid:act14_balance_sub", EntryType: WalletLedgerEntryTypePrepaidDebit,
		OrderId: order.Id, MoneyAmount: 80,
	}).Error)

	totals, err := GetRecallRevenueTotals(context.Background(), 14)

	require.NoError(t, err)
	require.Len(t, totals, 1)
	require.Equal(t, RecallRevenueTotals{
		Currency: "USD", AttributedSpendMinor: 9600, AttributedUsers: 2,
		NewExternalCashMinor: 1600, ExternalCashUsers: 1,
		DirectTopupMinor: 1600, DirectTopupUsers: 1,
		BalanceSubscriptionMinor: 8000, BalanceSubscriptionUsers: 1,
		OnlineSubscriptionMinor: 0, OnlineSubscriptionUsers: 0,
	}, totals[0])
}

func TestRecallRevenueCategoryConstants(t *testing.T) {
	require.Equal(t, RecallRevenueCategory("direct_topup"), RecallRevenueCategoryDirectTopUp)
	require.Equal(t, RecallRevenueCategory("balance_subscription"), RecallRevenueCategoryBalanceSubscription)
	require.Equal(t, RecallRevenueCategory("online_subscription"), RecallRevenueCategoryOnlineSubscription)
	require.Equal(t, RecallRevenueCategory("unclassified"), RecallRevenueCategoryUnclassified)
}

func TestRecallRevenueOnlineSubscriptionMirrorTakesPrecedence(t *testing.T) {
	setupRecallRevenueTestDB(t)
	seedRecallRevenueCampaign(t, 21)
	seedRecallRevenueRecipient(t, 21, 2101, "trade_online_mirror", "USD", 2500)
	require.NoError(t, DB.Create(&SubscriptionOrder{
		UserId: 2101, PlanId: 1, TradeNo: "trade_online_mirror", PaymentProvider: PaymentProviderStripe,
		Status: common.TopUpStatusSuccess, PaymentCurrency: "USD", PaymentAmountMinor: 9999,
	}).Error)
	require.NoError(t, DB.Create(&TopUp{
		UserId: 2101, TradeNo: "trade_online_mirror", PaymentProvider: PaymentProviderStripe,
		Status: common.TopUpStatusSuccess, PaymentCurrency: "USD", PaymentAmountMinor: 9999,
	}).Error)

	totals, err := GetRecallRevenueTotals(context.Background(), 21)

	require.NoError(t, err)
	require.Equal(t, []RecallRevenueTotals{{
		Currency: "USD", AttributedSpendMinor: 2500, AttributedUsers: 1,
		NewExternalCashMinor: 2500, ExternalCashUsers: 1,
		OnlineSubscriptionMinor: 2500, OnlineSubscriptionUsers: 1,
	}}, totals)
}

func TestRecallRevenueUnclassifiedEdges(t *testing.T) {
	setupRecallRevenueTestDB(t)
	seedRecallRevenueCampaign(t, 22)
	seedRecallRevenueRecipient(t, 22, 2201, "trade_wrong_user", "USD", 1000)
	seedRecallRevenueRecipient(t, 22, 2202, "trade_missing", "USD", 2000)
	seedRecallRevenueRecipient(t, 22, 2203, "trade_pending", "USD", 3000)
	require.NoError(t, DB.Create(&SubscriptionOrder{
		UserId: 9999, PlanId: 1, TradeNo: "trade_wrong_user", PaymentProvider: PaymentProviderStripe,
		Status: common.TopUpStatusSuccess,
	}).Error)
	require.NoError(t, DB.Create(&TopUp{
		UserId: 2203, TradeNo: "trade_pending", PaymentProvider: PaymentProviderStripe,
		Status: common.TopUpStatusPending,
	}).Error)

	totals, err := GetRecallRevenueTotals(context.Background(), 22)

	require.NoError(t, err)
	require.Equal(t, []RecallRevenueTotals{{
		Currency: "USD", AttributedSpendMinor: 6000, AttributedUsers: 3,
		UnclassifiedMinor: 6000, UnclassifiedUsers: 3,
	}}, totals)
}

func TestRecallRevenueKeepsCurrenciesSeparateInStableOrder(t *testing.T) {
	setupRecallRevenueTestDB(t)
	seedRecallRevenueCampaign(t, 23)
	seedRecallRevenueRecipient(t, 23, 2301, "trade_jpy", "JPY", 8000)
	seedRecallRevenueRecipient(t, 23, 2302, "trade_usd", "USD", 1200)
	require.NoError(t, DB.Create(&TopUp{
		UserId: 2301, TradeNo: "trade_jpy", PaymentProvider: PaymentProviderStripe,
		Status: common.TopUpStatusSuccess,
	}).Error)
	require.NoError(t, DB.Create(&TopUp{
		UserId: 2302, TradeNo: "trade_usd", PaymentProvider: PaymentProviderStripe,
		Status: common.TopUpStatusSuccess,
	}).Error)

	totals, err := GetRecallRevenueTotals(context.Background(), 23)

	require.NoError(t, err)
	require.Equal(t, []RecallRevenueTotals{
		{
			Currency: "JPY", AttributedSpendMinor: 8000, AttributedUsers: 1,
			NewExternalCashMinor: 8000, ExternalCashUsers: 1,
			DirectTopupMinor: 8000, DirectTopupUsers: 1,
		},
		{
			Currency: "USD", AttributedSpendMinor: 1200, AttributedUsers: 1,
			NewExternalCashMinor: 1200, ExternalCashUsers: 1,
			DirectTopupMinor: 1200, DirectTopupUsers: 1,
		},
	}, totals)
}

func TestRecallRevenueCountsSameUserOnceAcrossLegacyIdentities(t *testing.T) {
	setupRecallRevenueTestDB(t)
	seedRecallRevenueCampaign(t, 29)
	require.NoError(t, DB.Create(&User{
		Id: 2901, Username: "legacy-identity-user", Email: "legacy-identity@example.com", AffCode: "aff-legacy-identity",
	}).Error)
	require.NoError(t, DB.Create(&RecallRecipient{
		CampaignId: 29, UserId: 2901, RecipientIdentity: "legacy:first",
		EligibilitySnapshot: `{}`, EmailSnapshot: "legacy-identity@example.com", LanguageSnapshot: "en",
		State: RecallRecipientConverted, ConversionTradeNo: "trade_legacy_direct", ConversionCurrency: "USD",
		ConversionAmount: 1000, ConvertedAt: 1_700_000_101,
	}).Error)
	require.NoError(t, DB.Create(&RecallRecipient{
		CampaignId: 29, UserId: 2901, RecipientIdentity: "legacy:second",
		EligibilitySnapshot: `{}`, EmailSnapshot: "legacy-identity@example.com", LanguageSnapshot: "en",
		State: RecallRecipientConverted, ConversionTradeNo: "trade_legacy_online", ConversionCurrency: "USD",
		ConversionAmount: 2000, ConvertedAt: 1_700_000_102,
	}).Error)
	require.NoError(t, DB.Create(&TopUp{
		UserId: 2901, TradeNo: "trade_legacy_direct", PaymentProvider: "",
		Status: common.TopUpStatusSuccess,
	}).Error)
	require.NoError(t, DB.Create(&SubscriptionOrder{
		UserId: 2901, PlanId: 1, TradeNo: "trade_legacy_online", PaymentProvider: "",
		Status: common.TopUpStatusSuccess,
	}).Error)

	totals, err := GetRecallRevenueTotals(context.Background(), 29)

	require.NoError(t, err)
	require.Equal(t, []RecallRevenueTotals{{
		Currency: "USD", AttributedSpendMinor: 3000, AttributedUsers: 1,
		NewExternalCashMinor: 3000, ExternalCashUsers: 1,
		DirectTopupMinor: 1000, DirectTopupUsers: 1,
		OnlineSubscriptionMinor: 2000, OnlineSubscriptionUsers: 1,
	}}, totals)
}

func TestRecallRevenueCountsSameUserOncePerCurrencyRow(t *testing.T) {
	setupRecallRevenueTestDB(t)
	seedRecallRevenueCampaign(t, 30)
	require.NoError(t, DB.Create(&User{
		Id: 3001, Username: "cross-currency-user", Email: "cross-currency@example.com", AffCode: "aff-cross-currency",
	}).Error)
	for _, fixture := range []struct {
		identity string
		tradeNo  string
		currency string
		amount   int64
	}{
		{identity: "legacy:usd", tradeNo: "trade_cross_usd", currency: "USD", amount: 1200},
		{identity: "legacy:jpy", tradeNo: "trade_cross_jpy", currency: "JPY", amount: 8000},
	} {
		require.NoError(t, DB.Create(&RecallRecipient{
			CampaignId: 30, UserId: 3001, RecipientIdentity: fixture.identity,
			EligibilitySnapshot: `{}`, EmailSnapshot: "cross-currency@example.com", LanguageSnapshot: "en",
			State: RecallRecipientConverted, ConversionTradeNo: fixture.tradeNo, ConversionCurrency: fixture.currency,
			ConversionAmount: fixture.amount, ConvertedAt: 1_700_000_103,
		}).Error)
		require.NoError(t, DB.Create(&TopUp{
			UserId: 3001, TradeNo: fixture.tradeNo, PaymentProvider: "",
			Status: common.TopUpStatusSuccess,
		}).Error)
	}

	totals, err := GetRecallRevenueTotals(context.Background(), 30)

	require.NoError(t, err)
	require.Equal(t, []RecallRevenueTotals{
		{
			Currency: "JPY", AttributedSpendMinor: 8000, AttributedUsers: 1,
			NewExternalCashMinor: 8000, ExternalCashUsers: 1,
			DirectTopupMinor: 8000, DirectTopupUsers: 1,
		},
		{
			Currency: "USD", AttributedSpendMinor: 1200, AttributedUsers: 1,
			NewExternalCashMinor: 1200, ExternalCashUsers: 1,
			DirectTopupMinor: 1200, DirectTopupUsers: 1,
		},
	}, totals)
}

func TestRecallRevenueAuthoritativeConversionAmountWins(t *testing.T) {
	setupRecallRevenueTestDB(t)
	seedRecallRevenueCampaign(t, 24)
	seedRecallRevenueRecipient(t, 24, 2401, "trade_amount_wins", "USD", 1234)
	require.NoError(t, DB.Create(&TopUp{
		UserId: 2401, TradeNo: "trade_amount_wins", PaymentProvider: PaymentProviderStripe,
		Status: common.TopUpStatusSuccess, PaymentCurrency: "USD", PaymentAmountMinor: 999999,
	}).Error)

	totals, err := GetRecallRevenueTotals(context.Background(), 24)

	require.NoError(t, err)
	require.Equal(t, int64(1234), totals[0].AttributedSpendMinor)
	require.Equal(t, int64(1234), totals[0].NewExternalCashMinor)
	require.Equal(t, int64(1234), totals[0].DirectTopupMinor)
}

func TestRecallRevenueWalletDebitDoesNotInflateAmount(t *testing.T) {
	setupRecallRevenueTestDB(t)
	seedRecallRevenueCampaign(t, 25)
	seedRecallRevenueRecipient(t, 25, 2501, "trade_wallet_debit", "USD", 4500)
	require.NoError(t, DB.Create(&SubscriptionOrder{
		UserId: 2501, PlanId: 1, TradeNo: "trade_wallet_debit", PaymentProvider: PaymentProviderBalance,
		PaymentMethod: PaymentMethodBalance, Status: common.TopUpStatusSuccess,
	}).Error)
	var order SubscriptionOrder
	require.NoError(t, DB.Where("trade_no = ?", "trade_wallet_debit").First(&order).Error)
	require.NoError(t, DB.Create(&WalletLedgerEntry{
		UserId: 2501, EntryKey: "prepaid:trade_wallet_debit", EntryType: WalletLedgerEntryTypePrepaidDebit,
		OrderId: order.Id, MoneyAmount: 9999,
	}).Error)

	totals, err := GetRecallRevenueTotals(context.Background(), 25)

	require.NoError(t, err)
	require.Equal(t, []RecallRevenueTotals{{
		Currency: "USD", AttributedSpendMinor: 4500, AttributedUsers: 1,
		BalanceSubscriptionMinor: 4500, BalanceSubscriptionUsers: 1,
	}}, totals)
}

func TestRecallRevenueProviderFieldDoesNotGateApprovedCategories(t *testing.T) {
	setupRecallRevenueTestDB(t)
	seedRecallRevenueCampaign(t, 31)
	seedRecallRevenueRecipient(t, 31, 3101, "trade_blank_topup_provider", "USD", 1100)
	seedRecallRevenueRecipient(t, 31, 3102, "trade_blank_subscription_provider", "USD", 2200)
	require.NoError(t, DB.Create(&TopUp{
		UserId: 3101, TradeNo: "trade_blank_topup_provider", PaymentProvider: "",
		Status: common.TopUpStatusSuccess,
	}).Error)
	require.NoError(t, DB.Create(&SubscriptionOrder{
		UserId: 3102, PlanId: 1, TradeNo: "trade_blank_subscription_provider", PaymentProvider: "",
		Status: common.TopUpStatusSuccess,
	}).Error)

	totals, err := GetRecallRevenueTotals(context.Background(), 31)

	require.NoError(t, err)
	require.Equal(t, []RecallRevenueTotals{{
		Currency: "USD", AttributedSpendMinor: 3300, AttributedUsers: 2,
		NewExternalCashMinor: 3300, ExternalCashUsers: 2,
		DirectTopupMinor: 1100, DirectTopupUsers: 1,
		OnlineSubscriptionMinor: 2200, OnlineSubscriptionUsers: 1,
	}}, totals)
}

func TestRecallRevenueMultipleSuccessfulSameUserFactsAreUnclassified(t *testing.T) {
	setupRecallRevenueTestDB(t)
	seedRecallRevenueCampaign(t, 26)
	seedRecallRevenueRecipient(t, 26, 2601, "trade_ambiguous", "USD", 700)
	require.NoError(t, DB.Exec(`DROP TABLE top_ups`).Error)
	require.NoError(t, DB.Exec(`CREATE TABLE top_ups (
		id integer primary key autoincrement,
		user_id integer,
		trade_no varchar(255),
		payment_provider varchar(50),
		status text
	)`).Error)
	for i := 0; i < 2; i++ {
		require.NoError(t, DB.Exec(
			`INSERT INTO top_ups (user_id, trade_no, payment_provider, status) VALUES (?, ?, ?, ?)`,
			2601, "trade_ambiguous", PaymentProviderStripe, common.TopUpStatusSuccess,
		).Error)
	}

	totals, err := GetRecallRevenueTotals(context.Background(), 26)

	require.NoError(t, err)
	require.Equal(t, []RecallRevenueTotals{{
		Currency: "USD", AttributedSpendMinor: 700, AttributedUsers: 1,
		UnclassifiedMinor: 700, UnclassifiedUsers: 1,
	}}, totals)
}

func TestRecallRevenueRecipientUserKeyFallbacks(t *testing.T) {
	require.Equal(t, "user:42", recallRevenueRecipientUserKey(RecallRecipient{
		Id: 7, UserId: 42, RecipientIdentity: "legacy:positive-user",
	}))
	require.Equal(t, "legacy:zero-user", recallRevenueRecipientUserKey(RecallRecipient{
		Id: 8, UserId: 0, RecipientIdentity: " legacy:zero-user ",
	}))
	require.Equal(t, "recipient:9", recallRevenueRecipientUserKey(RecallRecipient{
		Id: 9, UserId: 0,
	}))
}

func TestRecallRevenuePaymentFactLookupChunksLargeCampaign(t *testing.T) {
	setupRecallRevenueTestDB(t)
	seedRecallRevenueCampaign(t, 27)
	const recipientCount = 700
	for i := 0; i < recipientCount; i++ {
		userID := 270_000 + i
		tradeNo := fmt.Sprintf("trade_chunk_%03d", i)
		seedRecallRevenueRecipient(t, 27, userID, tradeNo, "USD", 100)
		require.NoError(t, DB.Create(&TopUp{
			UserId: userID, TradeNo: tradeNo, PaymentProvider: PaymentProviderStripe,
			Status: common.TopUpStatusSuccess,
		}).Error)
	}
	captured := captureRecallRevenuePaymentFactQueries(t)

	totals, err := GetRecallRevenueTotals(context.Background(), 27)

	require.NoError(t, err)
	require.Equal(t, []RecallRevenueTotals{{
		Currency: "USD", AttributedSpendMinor: recipientCount * 100, AttributedUsers: recipientCount,
		NewExternalCashMinor: recipientCount * 100, ExternalCashUsers: recipientCount,
		DirectTopupMinor: recipientCount * 100, DirectTopupUsers: recipientCount,
	}}, totals)
	require.NotEmpty(t, *captured)
	for _, query := range *captured {
		require.LessOrEqual(t, len(query.vars), 401, query.sql)
	}
}

func TestRecallRevenueMultipleSuccessfulSubscriptionsWithMirroredTopUpAreUnclassified(t *testing.T) {
	setupRecallRevenueTestDB(t)
	seedRecallRevenueCampaign(t, 28)
	seedRecallRevenueRecipient(t, 28, 2801, "trade_ambiguous_subscription", "USD", 1700)
	require.NoError(t, DB.Exec(`DROP TABLE subscription_orders`).Error)
	require.NoError(t, DB.Exec(`CREATE TABLE subscription_orders (
		id integer primary key autoincrement,
		user_id integer,
		plan_id integer,
		trade_no varchar(255),
		payment_provider varchar(50),
		status text
	)`).Error)
	for _, provider := range []string{PaymentProviderStripe, PaymentProviderPaddle} {
		require.NoError(t, DB.Exec(
			`INSERT INTO subscription_orders (user_id, plan_id, trade_no, payment_provider, status) VALUES (?, ?, ?, ?, ?)`,
			2801, 1, "trade_ambiguous_subscription", provider, common.TopUpStatusSuccess,
		).Error)
	}
	require.NoError(t, DB.Create(&TopUp{
		UserId: 2801, TradeNo: "trade_ambiguous_subscription", PaymentProvider: PaymentProviderStripe,
		Status: common.TopUpStatusSuccess,
	}).Error)

	totals, err := GetRecallRevenueTotals(context.Background(), 28)

	require.NoError(t, err)
	require.Equal(t, []RecallRevenueTotals{{
		Currency: "USD", AttributedSpendMinor: 1700, AttributedUsers: 1,
		UnclassifiedMinor: 1700, UnclassifiedUsers: 1,
	}}, totals)
}

func setupRecallRevenueTestDB(t *testing.T) {
	t.Helper()
	originalDB := DB
	db, err := gorm.Open(sqlite.Open("file:"+t.Name()+"?mode=memory&cache=shared"), &gorm.Config{})
	require.NoError(t, err)
	DB = db
	t.Cleanup(func() { DB = originalDB })
	require.NoError(t, DB.AutoMigrate(
		&User{},
		&RecallCampaign{},
		&RecallRecipient{},
		&TopUp{},
		&SubscriptionOrder{},
		&WalletLedgerEntry{},
	))
}

type recallRevenueCapturedQuery struct {
	sql  string
	vars []any
}

func captureRecallRevenuePaymentFactQueries(t *testing.T) *[]recallRevenueCapturedQuery {
	t.Helper()
	callbackName := "recall_revenue_fact_query_capture_" + strings.NewReplacer("/", "_", " ", "_").Replace(t.Name())
	queries := make([]recallRevenueCapturedQuery, 0)
	require.NoError(t, DB.Callback().Query().After("gorm:query").Register(callbackName, func(tx *gorm.DB) {
		sql := strings.ToLower(tx.Statement.SQL.String())
		if !strings.Contains(sql, "trade_no in") ||
			(!strings.Contains(sql, "from `subscription_orders`") && !strings.Contains(sql, "from `top_ups`") &&
				!strings.Contains(sql, "from subscription_orders") && !strings.Contains(sql, "from top_ups")) {
			return
		}
		queries = append(queries, recallRevenueCapturedQuery{
			sql:  sql,
			vars: append([]any(nil), tx.Statement.Vars...),
		})
	}))
	t.Cleanup(func() {
		require.NoError(t, DB.Callback().Query().Remove(callbackName))
	})
	return &queries
}

func seedRecallRevenueCampaign(t *testing.T, campaignID int64) {
	t.Helper()
	require.NoError(t, DB.Create(&RecallCampaign{
		Id: campaignID, Name: fmt.Sprintf("revenue campaign %d", campaignID), Status: RecallCampaignCompleted,
		AudienceTemplate: "first_purchase", AudienceConfig: `{}`, ExecutionMode: "manual",
		CouponSource: "automatic", DiscountConfig: `{}`, ProductScope: `{}`, EmailSequenceConfig: `[]`,
	}).Error)
}

func seedRecallRevenueRecipient(t *testing.T, campaignID int64, userID int, tradeNo string, currency string, amountMinor int64) {
	t.Helper()
	require.NoError(t, DB.Create(&User{
		Id: userID, Username: fmt.Sprintf("revenue-user-%d", userID),
		Email: fmt.Sprintf("%d@example.com", userID), AffCode: fmt.Sprintf("aff-%d", userID),
	}).Error)
	require.NoError(t, DB.Create(&RecallRecipient{
		CampaignId: campaignID, UserId: userID, RecipientIdentity: RecallRecipientIdentityForUser(userID),
		EligibilitySnapshot: `{}`, EmailSnapshot: fmt.Sprintf("%d@example.com", userID), LanguageSnapshot: "en",
		State: RecallRecipientConverted, ConversionTradeNo: tradeNo, ConversionCurrency: currency,
		ConversionAmount: amountMinor, ConvertedAt: int64(1_700_000_000 + userID),
	}).Error)
}
