package model

import (
	"context"
	"fmt"
	"strings"
	"sync"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/require"
	"gorm.io/driver/mysql"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/schema"
)

func TestRecallMetricRegistryContainsExactSupportedKeys(t *testing.T) {
	want := []RecallMetricKey{
		"candidates",
		"enrolled",
		"excluded",
		"opened_recipients",
		"observed_clicks",
		"messages_accepted",
		"messages_failed",
		"direct_conversions",
		"assisted_conversions",
		"no_coupon_conversions",
		"attributed_spend",
		"new_external_cash",
		"direct_topup",
		"balance_subscription",
		"online_subscription",
	}

	registry := RecallMetricRegistry()
	require.Len(t, registry, len(want))
	for _, key := range want {
		entry, ok := registry[key]
		require.True(t, ok, "missing registry key %s", key)
		require.NotEmpty(t, entry.Grain)
		require.NotEmpty(t, entry.RowGrain)
	}
}

func TestRecallMetricQueryRejectsUnsupportedFilter(t *testing.T) {
	_, err := QueryRecallMetricRows(context.Background(), RecallMetricQuery{
		CampaignID:     12,
		Metric:         "enrolled",
		ConversionKind: "direct",
		Limit:          20,
	})

	require.ErrorIs(t, err, ErrRecallMetricBadRequest)
}

func TestRecallMetricRowJSONUsesSnakeCaseAndHidesInternalMaps(t *testing.T) {
	row := RecallMetricRow{
		RowID:           11,
		RecipientID:     22,
		MessageID:       33,
		UserID:          44,
		Email:           "json-row@example.com",
		OccurredAt:      55,
		StageNo:         2,
		State:           "failed",
		ConversionKind:  "direct",
		TradeNo:         "trade-json",
		PaymentCategory: "direct_topup",
		Currency:        "USD",
		AmountMinor:     66,
		FailureCode:     "smtp_rejected",
	}

	raw, err := common.Marshal(row)
	require.NoError(t, err)
	require.Contains(t, string(raw), `"row_id":11`)
	require.Contains(t, string(raw), `"recipient_id":22`)
	require.Contains(t, string(raw), `"message_id":33`)
	require.Contains(t, string(raw), `"user_id":44`)
	require.Contains(t, string(raw), `"occurred_at":55`)
	require.Contains(t, string(raw), `"stage_no":2`)
	require.Contains(t, string(raw), `"conversion_kind":"direct"`)
	require.Contains(t, string(raw), `"trade_no":"trade-json"`)
	require.Contains(t, string(raw), `"payment_category":"direct_topup"`)
	require.Contains(t, string(raw), `"amount_minor":66`)
	require.Contains(t, string(raw), `"failure_code":"smtp_rejected"`)
	require.NotContains(t, string(raw), "RowID")
	require.NotContains(t, string(raw), "AmountMinorByCurrency")
	require.NotContains(t, string(raw), "snapshot_token")
}

func TestRecallMetricRepresentativeSQLShapesAreDialectPortable(t *testing.T) {
	dialects := map[string]gorm.Dialector{
		"sqlite":   sqlite.Open(":memory:"),
		"mysql":    mysql.New(mysql.Config{DSN: "gorm:gorm@tcp(localhost:9910)/gorm?charset=utf8&parseTime=True", SkipInitializeWithVersion: true}),
		"postgres": postgres.New(postgres.Config{DSN: "host=localhost user=gorm password=gorm dbname=gorm port=9920 sslmode=disable"}),
	}
	for name, dialector := range dialects {
		t.Run(name, func(t *testing.T) {
			db, err := gorm.Open(dialector, &gorm.Config{DryRun: true, DisableAutomaticPing: true})
			require.NoError(t, err)
			originalDB := DB
			DB = db
			t.Cleanup(func() { DB = originalDB })
			query := RecallMetricQuery{
				CampaignID: 1,
				Metric:     "opened_recipients",
				Snapshot: RecallMetricSnapshot{
					RecipientMaxID:        10,
					FactEventMaxID:        20,
					ExclusionMaxID:        30,
					CampaignRunEventMaxID: 40,
				},
				Cursor: RecallMetricCursor{SortTime: 100, RowID: 2},
				Limit:  50,
			}
			var factEvents []RecallEvent
			factQuery := recallMetricRepresentativeFactEvents(context.Background(), query, "email_open").
				Where("recall_events.created_at > ? OR (recall_events.created_at = ? AND recall_events.id > ?)", query.Cursor.SortTime, query.Cursor.SortTime, query.Cursor.RowID).
				Order("recall_events.created_at ASC").Order("recall_events.id ASC").Limit(query.Limit + 1).Find(&factEvents)
			firstCreated := db.Model(&RecallEvent{}).
				Select("recipient_id, MIN(created_at) AS created_at").
				Where("campaign_id = ? AND event_type = ? AND id <= ? AND recipient_id <> 0", query.CampaignID, "conversion", query.Snapshot.FactEventMaxID).
				Group("recipient_id")
			representatives := db.Table("recall_events AS candidates").
				Select("candidates.recipient_id, MIN(candidates.id) AS id").
				Joins("JOIN (?) AS first_created ON first_created.recipient_id = candidates.recipient_id AND first_created.created_at = candidates.created_at", firstCreated).
				Where("candidates.campaign_id = ? AND candidates.event_type = ? AND candidates.id <= ? AND candidates.recipient_id <> 0", query.CampaignID, "conversion", query.Snapshot.FactEventMaxID).
				Group("candidates.recipient_id")
			conversionQuery := db.Model(&RecallEvent{}).
				Select("recall_events.*").
				Joins("JOIN (?) AS representative_events ON representative_events.id = recall_events.id", representatives).
				Where("recall_events.created_at > ? OR (recall_events.created_at = ? AND recall_events.id > ?)", int64(100), int64(100), int64(2)).
				Order("recall_events.created_at ASC").Order("recall_events.id ASC").Limit(51).Find(&[]RecallEvent{})
			messageStateQuery := db.Model(&RecallEvent{}).
				Where("campaign_id = ? AND event_type = ? AND source = ? AND id <= ? AND recipient_id IN ?", query.CampaignID, "message_state_changed", "message_state", query.Snapshot.MessageStateEventMaxID, []int64{1, 2}).
				Order("id ASC").
				Find(&[]RecallEvent{})
			var candidateRecipients []RecallRecipient
			candidateRecipientQuery := db.Model(&RecallRecipient{}).
				Where("campaign_id = ? AND id <= ?", query.CampaignID, query.Snapshot.RecipientMaxID).
				Where("created_at > ? OR (created_at = ? AND id * 2 + ? > ?)", query.Cursor.SortTime, query.Cursor.SortTime, recallMetricCandidateRecipientSource, query.Cursor.RowID).
				Order("created_at ASC").Order("id ASC").Limit(query.Limit + 1).Find(&candidateRecipients)
			var candidateExclusions []RecallCampaignExclusion
			candidateExclusionQuery := recallMetricExclusionBaseQuery(context.Background(), query, true).
				Where("first_seen_at > ? OR (first_seen_at = ? AND id * 2 + ? > ?)", query.Cursor.SortTime, query.Cursor.SortTime, recallMetricCandidateExclusionSource, query.Cursor.RowID).
				Order("first_seen_at ASC").Order("id ASC").Limit(query.Limit + 1).Find(&candidateExclusions)
			queries := []*gorm.DB{
				db.Model(&RecallRecipient{}).Where("campaign_id = ? AND id <= ?", int64(1), int64(10)).Order("created_at ASC").Order("id ASC").Limit(51).Find(&[]RecallRecipient{}),
				db.Model(&RecallEvent{}).Where("campaign_id = ? AND event_type = ? AND id <= ? AND recipient_id > 0", int64(1), "conversion", int64(20)).Order("created_at ASC").Order("id ASC").Limit(51).Find(&[]RecallEvent{}),
				db.Model(&RecallMessage{}).Select("recall_messages.*, recall_recipients.campaign_id").Joins("JOIN recall_recipients ON recall_recipients.id = recall_messages.recipient_id").Where("recall_recipients.campaign_id = ?", int64(1)).Order("recall_messages.id ASC").Limit(51).Find(&[]recallMessageWithCampaign{}),
				factQuery,
				messageStateQuery,
				conversionQuery,
				candidateRecipientQuery,
				candidateExclusionQuery,
			}
			for _, query := range queries {
				require.NoError(t, query.Error)
				sql := query.Statement.SQL.String()
				require.NotEmpty(t, sql)
				require.NotContains(t, strings.ToUpper(sql), "UNIX_TIMESTAMP")
				require.NotContains(t, strings.ToUpper(sql), "DISTINCT ON")
			}
			require.Contains(t, factQuery.Statement.SQL.String(), "representative_events")
			require.NotContains(t, factQuery.Statement.SQL.String(), "NOT EXISTS")
			require.Contains(t, conversionQuery.Statement.SQL.String(), "representative_events")
			require.NotContains(t, conversionQuery.Statement.SQL.String(), "NOT EXISTS")
			require.Contains(t, messageStateQuery.Statement.SQL.String(), "recipient_id")
			require.NotContains(t, messageStateQuery.Statement.SQL.String(), "source_event_id LIKE")
			require.Contains(t, candidateExclusionQuery.Statement.SQL.String(), "NOT EXISTS")
			require.Contains(t, candidateRecipientQuery.Statement.SQL.String(), "id * 2")
		})
	}
}

func TestRecallEventMetricIndexesDeclared(t *testing.T) {
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	require.NoError(t, err)
	require.NoError(t, db.AutoMigrate(&RecallEvent{}))
	require.True(t, db.Migrator().HasIndex(&RecallEvent{}, "idx_recall_metric_fact_rep"))
	require.True(t, db.Migrator().HasIndex(&RecallEvent{}, "idx_recall_metric_fact_scan"))
	require.True(t, db.Migrator().HasIndex(&RecallEvent{}, "idx_recall_metric_message_state"))

	parsed, err := schema.Parse(&RecallEvent{}, &sync.Map{}, db.NamingStrategy)
	require.NoError(t, err)
	indexes := parsed.ParseIndexes()
	require.Contains(t, indexes, "idx_recall_metric_fact_rep")
	require.Contains(t, indexes, "idx_recall_metric_fact_scan")
	require.Contains(t, indexes, "idx_recall_metric_message_state")
	require.Equal(t, []string{"campaign_id", "event_type", "recipient_id", "created_at", "id"}, recallMetricIndexColumns(indexes["idx_recall_metric_fact_rep"]))
	require.Equal(t, []string{"campaign_id", "event_type", "created_at", "id", "recipient_id"}, recallMetricIndexColumns(indexes["idx_recall_metric_fact_scan"]))
	require.Equal(t, []string{"campaign_id", "event_type", "source", "message_id", "id"}, recallMetricIndexColumns(indexes["idx_recall_metric_message_state"]))
}

func TestRecallMetricConversionOuterScanPlanUsesDerivedRepresentative(t *testing.T) {
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	require.NoError(t, err)
	require.NoError(t, db.AutoMigrate(&RecallEvent{}))

	sql := db.ToSQL(func(tx *gorm.DB) *gorm.DB {
		firstCreated := tx.Model(&RecallEvent{}).
			Select("recipient_id, MIN(created_at) AS created_at").
			Where("campaign_id = ? AND event_type = ? AND id <= ? AND recipient_id <> 0", int64(1), "conversion", int64(100)).
			Group("recipient_id")
		representatives := tx.Table("recall_events AS candidates").
			Select("candidates.recipient_id, MIN(candidates.id) AS id").
			Joins("JOIN (?) AS first_created ON first_created.recipient_id = candidates.recipient_id AND first_created.created_at = candidates.created_at", firstCreated).
			Where("candidates.campaign_id = ? AND candidates.event_type = ? AND candidates.id <= ? AND candidates.recipient_id <> 0", int64(1), "conversion", int64(100)).
			Group("candidates.recipient_id")
		return tx.Model(&RecallEvent{}).
			Select("recall_events.*").
			Joins("JOIN (?) AS representative_events ON representative_events.id = recall_events.id", representatives).
			Order("recall_events.created_at ASC").Order("recall_events.id ASC").Limit(51).Find(&[]RecallEvent{})
	})
	require.NotEmpty(t, sql)
	var planRows []struct {
		ID     int
		Parent int
		Unused int
		Detail string
	}
	require.NoError(t, db.Raw("EXPLAIN QUERY PLAN "+sql).Scan(&planRows).Error)
	plan := strings.ToUpper(fmt.Sprint(planRows))
	require.Contains(t, plan, "IDX_RECALL_METRIC_FACT_REP")
	require.Contains(t, strings.ToUpper(sql), "REPRESENTATIVE_EVENTS")
	require.NotContains(t, strings.ToUpper(sql), "NOT EXISTS")
}

func recallMetricIndexColumns(index schema.Index) []string {
	columns := make([]string, 0, len(index.Fields))
	for _, field := range index.Fields {
		columns = append(columns, field.DBName)
	}
	return columns
}
