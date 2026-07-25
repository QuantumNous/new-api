package model

import (
	"context"
	"fmt"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/require"
	"gorm.io/driver/mysql"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

func TestRecallAttributionCandidateDiscoveryIsBoundedAndAdvancesCursor(t *testing.T) {
	db := setupRecallAttributionDiscoveryTestDB(t)
	const (
		limit          = 2
		maxScannedRows = 8 * limit
		orderCount     = 64
		nowUnix        = int64(1_700_000_300)
	)

	progress := make([]RecallEvent, 0, maxScannedRows)
	for i := 1; i <= orderCount; i++ {
		candidate := createRecallAttributionDiscoveryOrder(t, i, nowUnix+int64(i))
		if i <= maxScannedRows {
			progress = append(progress, RecallEvent{
				EventType: recallAttributionProgressTerminal, Source: recallAttributionProgressSource,
				SourceEventId: recallAttributionSourceEventID(candidate), EventData: `{"attempt":1}`, CreatedAt: nowUnix,
			})
		}
	}
	require.NoError(t, DB.Create(&progress).Error)

	stats := &recallAttributionQueryStats{}
	require.NoError(t, db.Callback().Query().After("gorm:query").Register("test:recall_attribution_bounded_discovery", stats.observe))
	require.NoError(t, db.Callback().Row().After("gorm:row").Register("test:recall_attribution_bounded_discovery", stats.observe))
	t.Cleanup(func() {
		db.Callback().Query().Remove("test:recall_attribution_bounded_discovery")
		db.Callback().Row().Remove("test:recall_attribution_bounded_discovery")
	})

	first, err := ListRecallAttributionCandidatesWithContext(context.Background(), nowUnix, limit)
	require.NoError(t, err)
	require.Empty(t, first, "one batch must stop after its bounded scan instead of walking all history")
	require.LessOrEqual(t, stats.maxVariables, 32, "candidate discovery must not expand user IDs into an unbounded IN list")

	stats.reset()
	second, err := ListRecallAttributionCandidatesWithContext(context.Background(), nowUnix, limit)
	require.NoError(t, err)
	require.Len(t, second, limit)
	require.Equal(t, "trade_discovery_17", second[0].TradeNo)
	require.LessOrEqual(t, stats.maxVariables, 32)
}

func TestRecallAttributionCandidateDiscoveryAdvancesPastIrrelevantRawHistory(t *testing.T) {
	setupRecallAttributionDiscoveryTestDB(t)
	const (
		limit          = 2
		maxScannedRows = 8 * limit
		nowUnix        = int64(1_700_000_300)
	)
	userID := 20_001
	require.NoError(t, DB.Create(&RecallRecipient{
		CampaignId: 1, UserId: userID, EligibilitySnapshot: `{}`,
		EmailSnapshot: "relevant@example.com", LanguageSnapshot: "en",
		State: RecallRecipientCodeReady, CreatedAt: nowUnix,
	}).Error)
	for i := 1; i <= maxScannedRows; i++ {
		require.NoError(t, DB.Create(&TopUp{
			UserId: userID, TradeNo: fmt.Sprintf("trade_irrelevant_%d", i), GatewayTradeNo: fmt.Sprintf("cs_irrelevant_%d", i),
			PaymentProvider: PaymentProviderEpay, Status: common.TopUpStatusSuccess,
			CreateTime: nowUnix + int64(i), CompleteTime: nowUnix + int64(i),
		}).Error)
	}
	want := RecallAttributionCandidate{
		TradeNo: "trade_relevant_17", UserId: userID, CheckoutSessionId: "cs_relevant_17",
		OrderCreatedAt: nowUnix + maxScannedRows + 1, EnrolledAt: nowUnix,
	}
	require.NoError(t, DB.Create(&TopUp{
		UserId: userID, TradeNo: want.TradeNo, GatewayTradeNo: want.CheckoutSessionId,
		PaymentProvider: PaymentProviderStripe, Status: common.TopUpStatusSuccess,
		CreateTime: want.OrderCreatedAt, CompleteTime: want.OrderCreatedAt,
	}).Error)

	first, err := ListRecallAttributionCandidatesWithContext(context.Background(), nowUnix+100, limit)
	require.NoError(t, err)
	require.Empty(t, first, "one call must stop after its bounded physical raw-row budget")
	second, err := ListRecallAttributionCandidatesWithContext(context.Background(), nowUnix+100, limit)
	require.NoError(t, err)
	require.Contains(t, second, want)
}

func TestRecallAttributionCandidateDiscoveryFiltersOnlyWithinBoundedRawPages(t *testing.T) {
	db := setupRecallAttributionDiscoveryTestDB(t)
	const (
		pageSize = 2
		nowUnix  = int64(1_700_000_300)
		userID   = 30_001
	)
	require.NoError(t, DB.Create(&RecallRecipient{
		CampaignId: 1, UserId: userID, EligibilitySnapshot: `{}`,
		EmailSnapshot: "bounded@example.com", LanguageSnapshot: "en",
		State: RecallRecipientCodeReady, CreatedAt: nowUnix,
	}).Error)
	topUps := []TopUp{
		{UserId: userID, TradeNo: "trade_epay", GatewayTradeNo: "cs_epay", PaymentProvider: PaymentProviderEpay, Status: common.TopUpStatusSuccess, CreateTime: nowUnix + 1},
		{UserId: userID, TradeNo: "trade_pending", GatewayTradeNo: "cs_pending", PaymentProvider: PaymentProviderStripe, Status: common.TopUpStatusPending, CreateTime: nowUnix + 2},
		{UserId: userID + 1, TradeNo: "trade_no_recipient", GatewayTradeNo: "cs_no_recipient", PaymentProvider: PaymentProviderStripe, Status: common.TopUpStatusSuccess, CreateTime: nowUnix + 3},
		{UserId: userID, TradeNo: "trade_pre_enrollment", GatewayTradeNo: "cs_pre_enrollment", PaymentProvider: PaymentProviderStripe, Status: common.TopUpStatusSuccess, CreateTime: nowUnix - 1},
		{UserId: userID, TradeNo: "trade_bounded", GatewayTradeNo: "cs_bounded", PaymentProvider: PaymentProviderStripe, Status: common.TopUpStatusSuccess, CreateTime: nowUnix + 4},
	}
	for i := range topUps {
		require.NoError(t, DB.Create(&topUps[i]).Error)
	}
	rawPage, err := listRecallAttributionOrderPageWithContext(context.Background(), recallAttributionCursor{Phase: recallAttributionPhaseTopUp}, pageSize)
	require.NoError(t, err)
	require.Len(t, rawPage, pageSize)
	stats := &recallAttributionQueryStats{}
	require.NoError(t, db.Callback().Query().After("gorm:query").Register("test:recall_attribution_bounded_page_filters", stats.observe))
	require.NoError(t, db.Callback().Row().After("gorm:row").Register("test:recall_attribution_bounded_page_filters", stats.observe))
	t.Cleanup(func() {
		db.Callback().Query().Remove("test:recall_attribution_bounded_page_filters")
		db.Callback().Row().Remove("test:recall_attribution_bounded_page_filters")
	})

	got, err := ListRecallAttributionCandidatesWithContext(context.Background(), nowUnix+100, pageSize)
	require.NoError(t, err)
	require.Contains(t, got, RecallAttributionCandidate{
		TradeNo: "trade_bounded", UserId: userID, CheckoutSessionId: "cs_bounded",
		OrderCreatedAt: nowUnix + 4, EnrolledAt: nowUnix,
	})
	require.Positive(t, stats.maxEnrollmentVariables)
	require.LessOrEqual(t, stats.maxEnrollmentVariables, len(recallClaimActiveRecipientStates())+pageSize)
	require.Positive(t, stats.maxDuplicateVariables)
	require.LessOrEqual(t, stats.maxDuplicateVariables, 2+pageSize)
}

func TestRecallAttributionCandidateCursorWrapsToRevisitDueRetry(t *testing.T) {
	setupRecallAttributionDiscoveryTestDB(t)
	const nowUnix = int64(1_700_000_300)
	firstOrder := createRecallAttributionDiscoveryOrder(t, 1, nowUnix+1)
	secondOrder := createRecallAttributionDiscoveryOrder(t, 2, nowUnix+2)

	first, err := ListRecallAttributionCandidatesWithContext(context.Background(), nowUnix, 1)
	require.NoError(t, err)
	require.Equal(t, []RecallAttributionCandidate{firstOrder}, first)
	firstLease, acquired, err := LeaseRecallAttributionCandidateWithContext(context.Background(), firstOrder, nowUnix, nowUnix+900)
	require.NoError(t, err)
	require.True(t, acquired)
	updated, err := RetryRecallAttributionCandidateWithContext(context.Background(), firstOrder, firstLease, nowUnix+60, "test_retry")
	require.NoError(t, err)
	require.True(t, updated)

	second, err := ListRecallAttributionCandidatesWithContext(context.Background(), nowUnix, 1)
	require.NoError(t, err)
	require.Equal(t, []RecallAttributionCandidate{secondOrder}, second)
	secondLease, acquired, err := LeaseRecallAttributionCandidateWithContext(context.Background(), secondOrder, nowUnix, nowUnix+900)
	require.NoError(t, err)
	require.True(t, acquired)
	updated, err = CompleteRecallAttributionCandidateWithContext(context.Background(), secondOrder, secondLease, nowUnix, "test_terminal")
	require.NoError(t, err)
	require.True(t, updated)

	none, err := ListRecallAttributionCandidatesWithContext(context.Background(), nowUnix, 1)
	require.NoError(t, err)
	require.Empty(t, none)
	cursorEvent := RecallEvent{}
	require.NoError(t, DB.Where("source = ? AND source_event_id = ? AND event_type = ?", recallAttributionProgressSource, "cursor:v1", "reconciliation_cursor").First(&cursorEvent).Error)
	require.NotContains(t, cursorEvent.EventData, firstOrder.TradeNo)
	require.NotContains(t, cursorEvent.EventData, firstOrder.CheckoutSessionId)

	due, err := ListRecallAttributionCandidatesWithContext(context.Background(), nowUnix+120, 1)
	require.NoError(t, err)
	require.Equal(t, []RecallAttributionCandidate{firstOrder}, due, "cursor wrap must eventually revisit retry work after it becomes due")
}

func TestRecallAttributionCandidateDiscoveryHandlesLargeLimitWithoutOverflow(t *testing.T) {
	setupRecallAttributionDiscoveryTestDB(t)
	const nowUnix = int64(1_700_000_300)
	want := createRecallAttributionDiscoveryOrder(t, 1, nowUnix+1)

	got, err := ListRecallAttributionCandidatesWithContext(context.Background(), nowUnix, int(^uint(0)>>1))
	require.NoError(t, err)
	require.NotEmpty(t, got)
	require.Equal(t, want, got[0])
}

func TestRecallAttributionCandidateDiscoveryDoesNotDuplicateCandidatesAfterCursorWrap(t *testing.T) {
	setupRecallAttributionDiscoveryTestDB(t)
	const nowUnix = int64(1_700_000_300)
	want := createRecallAttributionDiscoveryOrder(t, 1, nowUnix+1)

	got, err := ListRecallAttributionCandidatesWithContext(context.Background(), nowUnix, 2)
	require.NoError(t, err)
	require.Equal(t, []RecallAttributionCandidate{want}, got)
}

func TestRecallAttributionOrderPageSQLSupportsAllDatabaseDialects(t *testing.T) {
	silentLogger := logger.Default.LogMode(logger.Silent)
	sqliteDB, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{Logger: silentLogger})
	require.NoError(t, err)
	sqlDB, err := sqliteDB.DB()
	require.NoError(t, err)
	t.Cleanup(func() { _ = sqlDB.Close() })
	mysqlDB, err := gorm.Open(mysql.New(mysql.Config{Conn: sqlDB, SkipInitializeWithVersion: true}), &gorm.Config{
		DryRun: true, DisableAutomaticPing: true, Logger: silentLogger,
	})
	require.NoError(t, err)
	postgresDB, err := gorm.Open(postgres.New(postgres.Config{Conn: sqlDB}), &gorm.Config{
		DryRun: true, DisableAutomaticPing: true, Logger: silentLogger,
	})
	require.NoError(t, err)

	dialects := map[string]*gorm.DB{
		"sqlite":     sqliteDB.Session(&gorm.Session{DryRun: true}),
		"mysql":      mysqlDB,
		"postgresql": postgresDB,
	}
	for name, dialectDB := range dialects {
		for _, phase := range []string{recallAttributionPhaseSubscription, recallAttributionPhaseTopUp} {
			t.Run(name+"/"+phase, func(t *testing.T) {
				generateSQL := func(limit int) string {
					return strings.ToLower(dialectDB.ToSQL(func(tx *gorm.DB) *gorm.DB {
						rows := make([]recallAttributionOrderRow, 0)
						return recallAttributionOrderPageQueryWithContext(context.Background(), tx, recallAttributionCursor{Phase: phase}, limit).Find(&rows)
					}))
				}
				generatedSQL := generateSQL(10)
				require.Contains(t, generatedSQL, "where recall_orders.id >")
				require.Contains(t, generatedSQL, "order by recall_orders.id asc")
				require.Contains(t, generatedSQL, "limit 10")
				require.NotContains(t, generatedSQL, "payment_provider =")
				require.NotContains(t, generatedSQL, "status =")
				require.NotContains(t, generatedSQL, "create_time >")
				require.NotContains(t, generatedSQL, "recall_recipients")
				require.NotContains(t, generatedSQL, " join ")
				require.Contains(t, generateSQL(1_000), "limit 200")
			})
		}
	}
}

func TestRecallAttributionOrderPageSQLiteUsesPrimaryKeyRangeWithoutTempSort(t *testing.T) {
	setupRecallAttributionDiscoveryTestDB(t)
	generatedSQL := DB.ToSQL(func(tx *gorm.DB) *gorm.DB {
		rows := make([]recallAttributionOrderRow, 0)
		return recallAttributionOrderPageQueryWithContext(context.Background(), tx, recallAttributionCursor{Phase: recallAttributionPhaseTopUp}, 10).Find(&rows)
	})
	var planRows []struct {
		Detail string `gorm:"column:detail"`
	}
	require.NoError(t, DB.Raw("EXPLAIN QUERY PLAN "+generatedSQL).Scan(&planRows).Error)
	details := make([]string, 0, len(planRows))
	for _, row := range planRows {
		details = append(details, strings.ToLower(row.Detail))
	}
	plan := strings.Join(details, "\n")
	require.Contains(t, plan, "integer primary key")
	require.NotContains(t, plan, "temp b-tree")
}

func TestRecallAttributionCursorCASDoesNotOverwriteConcurrentAdvance(t *testing.T) {
	setupRecallAttributionDiscoveryTestDB(t)
	const nowUnix = int64(1_700_000_300)
	_, expectedData, err := loadRecallAttributionCursorWithContext(context.Background(), nowUnix)
	require.NoError(t, err)
	advanced := recallAttributionCursor{Phase: recallAttributionPhaseTopUp, OrderId: 20}
	require.NoError(t, storeRecallAttributionCursorWithContext(context.Background(), expectedData, advanced, nowUnix+1))

	stale := recallAttributionCursor{Phase: recallAttributionPhaseSubscription, OrderId: 10}
	require.NoError(t, storeRecallAttributionCursorWithContext(context.Background(), expectedData, stale, nowUnix+2))
	stored, _, err := loadRecallAttributionCursorWithContext(context.Background(), nowUnix+3)
	require.NoError(t, err)
	require.Equal(t, advanced, stored)
}

func TestRecallAttributionCursorNormalizesLegacyCreateTimeData(t *testing.T) {
	setupRecallAttributionDiscoveryTestDB(t)
	const nowUnix = int64(1_700_000_300)
	legacyData := `{"phase":"topup","order_created_at":1700000200,"order_id":7}`
	require.NoError(t, DB.Create(&RecallEvent{
		EventType: recallAttributionCursorEventType, Source: recallAttributionProgressSource,
		SourceEventId: recallAttributionCursorSourceID, EventData: legacyData, CreatedAt: nowUnix,
	}).Error)

	cursor, expectedData, err := loadRecallAttributionCursorWithContext(context.Background(), nowUnix+1)
	require.NoError(t, err)
	require.Equal(t, recallAttributionCursor{Phase: recallAttributionPhaseTopUp, OrderId: 7}, cursor)
	require.Equal(t, legacyData, expectedData)
	require.NoError(t, storeRecallAttributionCursorWithContext(context.Background(), expectedData, cursor, nowUnix+2))
	stored := RecallEvent{}
	require.NoError(t, DB.Where("source = ? AND source_event_id = ?", recallAttributionProgressSource, recallAttributionCursorSourceID).First(&stored).Error)
	require.JSONEq(t, `{"phase":"topup","order_id":7}`, stored.EventData)
}

type recallAttributionQueryStats struct {
	maxVariables           int
	maxEnrollmentVariables int
	maxDuplicateVariables  int
}

func (s *recallAttributionQueryStats) observe(tx *gorm.DB) {
	sql := strings.ToLower(tx.Statement.SQL.String())
	if strings.Contains(sql, "recall_recipients") && strings.Contains(sql, "user_id in") && len(tx.Statement.Vars) > s.maxEnrollmentVariables {
		s.maxEnrollmentVariables = len(tx.Statement.Vars)
	}
	if strings.Contains(sql, "subscription_orders") && strings.Contains(sql, "trade_no in") && len(tx.Statement.Vars) > s.maxDuplicateVariables {
		s.maxDuplicateVariables = len(tx.Statement.Vars)
	}
	if len(tx.Statement.Vars) > s.maxVariables {
		s.maxVariables = len(tx.Statement.Vars)
	}
}

func (s *recallAttributionQueryStats) reset() {
	*s = recallAttributionQueryStats{}
}

func setupRecallAttributionDiscoveryTestDB(t *testing.T) *gorm.DB {
	t.Helper()
	db, _ := setupRecallRepositoryTestDB(t)
	require.NoError(t, DB.AutoMigrate(&TopUp{}, &SubscriptionOrder{}))
	return db
}

func createRecallAttributionDiscoveryOrder(t *testing.T, index int, createdAt int64) RecallAttributionCandidate {
	t.Helper()
	userID := 10_000 + index
	tradeNo := fmt.Sprintf("trade_discovery_%d", index)
	sessionID := fmt.Sprintf("cs_discovery_%d", index)
	enrolledAt := createdAt - 100
	require.NoError(t, DB.Create(&RecallRecipient{
		CampaignId: int64(index), UserId: userID, EligibilitySnapshot: `{}`,
		EmailSnapshot: fmt.Sprintf("user-%d@example.com", index), LanguageSnapshot: "en",
		State: RecallRecipientCodeReady, CreatedAt: enrolledAt,
	}).Error)
	require.NoError(t, DB.Create(&TopUp{
		UserId: userID, TradeNo: tradeNo, GatewayTradeNo: sessionID,
		PaymentProvider: PaymentProviderStripe, Status: common.TopUpStatusSuccess,
		CreateTime: createdAt, CompleteTime: createdAt + 1,
	}).Error)
	return RecallAttributionCandidate{
		TradeNo: tradeNo, UserId: userID, CheckoutSessionId: sessionID,
		OrderCreatedAt: createdAt, EnrolledAt: enrolledAt,
	}
}
