package main

import (
	"database/sql"
	"errors"
	"fmt"
	"math"
	"regexp"
	"sort"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"gorm.io/gorm"
)

const (
	rollbackLegacyLedgerTable  = "agent_credit_logs_legacy"
	rollbackCurrentLedgerTable = "agent_credit_logs"
	rollbackSwappedLedgerTable = "agent_credit_logs_new"
)

var rollbackRunIDPattern = regexp.MustCompile(`^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$`)

type rollbackReport struct {
	RunID            string
	LedgerRows       int
	SubscriptionRows int
	QuotaGrantRows   int
	RedemptionRows   int
	UserRows         int
	AgentRows        int
	Restored         bool
}

type rollbackProjection struct {
	RunID     string `gorm:"column:run_id"`
	Kind      string `gorm:"column:kind"`
	CurrentID int64  `gorm:"column:current_id"`
	LegacyID  int64  `gorm:"column:legacy_id"`
}

type rollbackUserSnapshot struct {
	RunID        string `gorm:"column:run_id"`
	UserID       int64  `gorm:"column:user_id"`
	Quota        int64  `gorm:"column:quota"`
	UsedQuota    int64  `gorm:"column:used_quota"`
	RequestCount int64  `gorm:"column:request_count"`
	BoundAgentID int64  `gorm:"column:bound_agent_id"`
	BoundAt      int64  `gorm:"column:bound_at"`
	CreatedAt    int64  `gorm:"column:created_at"`
	LastLoginAt  int64  `gorm:"column:last_login_at"`
}

type rollbackAgentSnapshot struct {
	RunID         string `gorm:"column:run_id"`
	UserID        int64  `gorm:"column:user_id"`
	Balance       int64  `gorm:"column:balance"`
	Status        int64  `gorm:"column:status"`
	DailyGenLimit int64  `gorm:"column:daily_gen_limit"`
	UpdatedAt     int64  `gorm:"column:updated_at"`
}

type rollbackRedemptionSnapshot struct {
	RunID                string `gorm:"column:run_id"`
	RedemptionID         int64  `gorm:"column:redemption_id"`
	OriginalType         int64  `gorm:"column:original_type"`
	OriginalAgentID      int64  `gorm:"column:original_agent_id"`
	OriginalPackageID    int64  `gorm:"column:original_package_id"`
	OriginalOfferID      int64  `gorm:"column:original_offer_id"`
	OriginalOfferAmount  int64  `gorm:"column:original_offer_amount"`
	OriginalRefundType   string `gorm:"column:original_refund_type"`
	OriginalRefundValue  int64  `gorm:"column:original_refund_value"`
	OriginalDuration     int64  `gorm:"column:original_duration"`
	OriginalDurationUnit string `gorm:"column:original_duration_unit"`
	OriginalCurrency     string `gorm:"column:original_currency"`
	OriginalRetailAmount int64  `gorm:"column:original_retail_amount"`
	OriginalStatus       int64  `gorm:"column:original_status"`
	OriginalRedeemedTime int64  `gorm:"column:original_redeemed_time"`
	OriginalUsedUserID   int64  `gorm:"column:original_used_user_id"`
}

type rollbackTableSnapshot struct {
	RunID     string `gorm:"column:run_id"`
	TableName string `gorm:"column:table_name"`
	RowCount  int64  `gorm:"column:row_count"`
	MaxID     int64  `gorm:"column:max_id"`
}

type rollbackRun struct {
	RunID             string `gorm:"column:run_id"`
	CutoverAt         int64  `gorm:"column:cutover_at"`
	ProjectedAt       int64  `gorm:"column:projected_at"`
	LegacyLedgerCount int64  `gorm:"column:legacy_ledger_count"`
	LegacyLedgerMaxID int64  `gorm:"column:legacy_ledger_max_id"`
	Status            string `gorm:"column:status"`
}

type currentRedemptionCompat struct {
	Id                  int64  `gorm:"column:id"`
	Type                int64  `gorm:"column:type"`
	AgentUserID         int64  `gorm:"column:agent_user_id"`
	SubscriptionPlanID  int64  `gorm:"column:subscription_plan_id"`
	AgentID             int64  `gorm:"column:agent_id"`
	PackageID           int64  `gorm:"column:package_id"`
	OfferID             int64  `gorm:"column:offer_id"`
	OfferAmount         int64  `gorm:"column:offer_amount"`
	OfferRefundFeeType  string `gorm:"column:offer_refund_fee_type"`
	OfferRefundFeeValue int64  `gorm:"column:offer_refund_fee_value"`
	OfferDuration       int64  `gorm:"column:offer_duration"`
	OfferDurationUnit   string `gorm:"column:offer_duration_unit"`
	OfferCurrency       string `gorm:"column:offer_currency"`
	OfferRetailAmount   int64  `gorm:"column:offer_retail_amount"`
	Status              int64  `gorm:"column:status"`
	RedeemedTime        int64  `gorm:"column:redeemed_time"`
	UsedUserID          int64  `gorm:"column:used_user_id"`
}

func mapCurrentCreditEvent(event string) (string, bool) {
	switch event {
	case model.AgentCreditEventPurchase:
		return "purchase", true
	case model.AgentCreditEventRefund:
		return "refund", true
	case model.AgentCreditEventAdminCredit:
		return "topup", true
	case model.AgentCreditEventAdminDebit:
		return "deduct", true
	default:
		return "", false
	}
}

func legacyPurchaseRemark(title string, quantity int) string {
	return fmt.Sprintf("购买兑换码: %s x%d", strings.TrimSpace(title), quantity)
}

func subscriptionRemaining(total, used int64) (int64, error) {
	if total < 0 || used < 0 || used > total {
		return 0, fmt.Errorf("invalid subscription quota: total=%d used=%d", total, used)
	}
	return total - used, nil
}

func validateRollbackRunID(runID string) error {
	if !rollbackRunIDPattern.MatchString(runID) {
		return errors.New("run id must match [A-Za-z0-9][A-Za-z0-9_-]{0,63}")
	}
	return nil
}

func legacyQuotaInt(value int64) (int, error) {
	if value < 0 || value > math.MaxInt32 {
		return 0, fmt.Errorf("legacy quota is outside int32 range: %d", value)
	}
	return int(value), nil
}

func ensureRollbackMetadata(tx *gorm.DB) error {
	statements := []string{
		`CREATE TABLE IF NOT EXISTS agent_rollback_runs (
			run_id varchar(128) PRIMARY KEY,
			cutover_at bigint NOT NULL,
			projected_at bigint NOT NULL,
			legacy_ledger_count bigint NOT NULL,
			legacy_ledger_max_id bigint NOT NULL,
			status varchar(16) NOT NULL
		)`,
		`CREATE TABLE IF NOT EXISTS agent_rollback_projections (
			run_id varchar(128) NOT NULL,
			kind varchar(32) NOT NULL,
			current_id bigint NOT NULL,
			legacy_id bigint NOT NULL,
			PRIMARY KEY (run_id, kind, current_id)
		)`,
		`CREATE TABLE IF NOT EXISTS agent_rollback_user_snapshots (
			run_id varchar(128) NOT NULL,
			user_id bigint NOT NULL,
			quota bigint NOT NULL,
			used_quota bigint NOT NULL,
			request_count bigint NOT NULL,
			bound_agent_id bigint NOT NULL,
			bound_at bigint NOT NULL,
			created_at bigint NOT NULL,
			last_login_at bigint NOT NULL,
			PRIMARY KEY (run_id, user_id)
		)`,
		`CREATE TABLE IF NOT EXISTS agent_rollback_agent_snapshots (
			run_id varchar(128) NOT NULL,
			user_id bigint NOT NULL,
			balance bigint NOT NULL,
			status bigint NOT NULL,
			daily_gen_limit bigint NOT NULL,
			updated_at bigint NOT NULL,
			PRIMARY KEY (run_id, user_id)
		)`,
		`CREATE TABLE IF NOT EXISTS agent_rollback_redemption_snapshots (
			run_id varchar(128) NOT NULL,
			redemption_id bigint NOT NULL,
			original_type bigint NOT NULL,
			original_agent_id bigint NOT NULL,
			original_package_id bigint NOT NULL,
			original_offer_id bigint NOT NULL,
			original_offer_amount bigint NOT NULL,
			original_refund_type text NOT NULL,
			original_refund_value bigint NOT NULL,
			original_duration bigint NOT NULL,
			original_duration_unit text NOT NULL,
			original_currency text NOT NULL,
			original_retail_amount bigint NOT NULL,
			original_status bigint NOT NULL,
			original_redeemed_time bigint NOT NULL,
			original_used_user_id bigint NOT NULL,
			PRIMARY KEY (run_id, redemption_id)
		)`,
		`CREATE TABLE IF NOT EXISTS agent_rollback_table_snapshots (
			run_id varchar(128) NOT NULL,
			table_name varchar(64) NOT NULL,
			row_count bigint NOT NULL,
			max_id bigint NOT NULL,
			PRIMARY KEY (run_id, table_name)
		)`,
	}
	for _, statement := range statements {
		if err := tx.Exec(statement).Error; err != nil {
			return fmt.Errorf("create rollback metadata: %w", err)
		}
	}
	return nil
}

func checkRollbackShape(tx *gorm.DB) error {
	var currentCount, legacyCount, swappedCount int64
	for table, destination := range map[string]*int64{
		rollbackCurrentLedgerTable: &currentCount,
		rollbackLegacyLedgerTable:  &legacyCount,
		rollbackSwappedLedgerTable: &swappedCount,
	} {
		if err := tx.Raw("SELECT count(*) FROM information_schema.tables WHERE table_schema = current_schema() AND table_name = ?", table).Scan(destination).Error; err != nil {
			return err
		}
	}
	if currentCount != 1 || legacyCount != 1 {
		return fmt.Errorf("rollback requires current and legacy ledger tables (current=%d legacy=%d)", currentCount, legacyCount)
	}
	if swappedCount != 0 {
		return errors.New("rollback projection already active: agent_credit_logs_new exists")
	}
	return nil
}

func tableStats(tx *gorm.DB, table string) (int64, int64, error) {
	if !rollbackIdentifierAllowed(table) {
		return 0, 0, fmt.Errorf("table is not allowlisted: %s", table)
	}
	var stats struct {
		RowCount int64         `gorm:"column:row_count"`
		MaxID    sql.NullInt64 `gorm:"column:max_id"`
	}
	if err := tx.Raw(fmt.Sprintf(`SELECT count(*) AS row_count, max(id) AS max_id FROM %s`, quoteRollbackIdentifier(table))).Scan(&stats).Error; err != nil {
		return 0, 0, err
	}
	return stats.RowCount, stats.MaxID.Int64, nil
}

func rollbackIdentifierAllowed(value string) bool {
	if value == "" {
		return false
	}
	for _, r := range value {
		if (r < 'a' || r > 'z') && (r < 'A' || r > 'Z') && (r < '0' || r > '9') && r != '_' {
			return false
		}
	}
	return true
}

func quoteRollbackIdentifier(value string) string {
	return `"` + strings.ReplaceAll(value, `"`, `""`) + `"`
}

func snapshotTableStats(tx *gorm.DB, runID string, tables []string) error {
	for _, table := range tables {
		rowCount, maxID, err := tableStats(tx, table)
		if err != nil {
			return fmt.Errorf("snapshot table %s: %w", table, err)
		}
		if err := tx.Exec(`INSERT INTO agent_rollback_table_snapshots (run_id, table_name, row_count, max_id) VALUES (?, ?, ?, ?)`, runID, table, rowCount, maxID).Error; err != nil {
			return err
		}
	}
	return nil
}

func resetSequenceForTable(tx *gorm.DB, table string) error {
	if tx.Dialector.Name() != "postgres" || !rollbackIdentifierAllowed(table) {
		return nil
	}
	var sequence sql.NullString
	if err := tx.Raw("SELECT pg_get_serial_sequence(?, ?)", table, "id").Scan(&sequence).Error; err != nil {
		return err
	}
	if !sequence.Valid || sequence.String == "" {
		return nil
	}
	if err := tx.Exec(fmt.Sprintf("SELECT setval('%s', GREATEST(COALESCE((SELECT MAX(id) FROM %s), 1), 1), true)", sequence.String, quoteRollbackIdentifier(table))).Error; err != nil {
		return fmt.Errorf("reset sequence %s: %w", table, err)
	}
	return nil
}

func sequenceName(tx *gorm.DB, table string) (string, error) {
	var sequence sql.NullString
	if err := tx.Raw("SELECT pg_get_serial_sequence(?, ?)", table, "id").Scan(&sequence).Error; err != nil {
		return "", err
	}
	if !sequence.Valid || sequence.String == "" {
		return "", fmt.Errorf("no id sequence for %s", table)
	}
	return sequence.String, nil
}

func renameSequence(tx *gorm.DB, qualifiedName, newName string) error {
	if !rollbackIdentifierAllowed(newName) {
		return fmt.Errorf("invalid sequence name %s", newName)
	}
	return tx.Exec(fmt.Sprintf("ALTER SEQUENCE %s RENAME TO %s", qualifiedName, quoteRollbackIdentifier(newName))).Error
}

func convertUserTimes(tx *gorm.DB, toLegacy bool) error {
	columns := []string{"bound_at", "created_at", "last_login_at"}
	for _, column := range columns {
		var dataType string
		if err := tx.Raw("SELECT data_type FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = 'users' AND column_name = ?", column).Scan(&dataType).Error; err != nil {
			return err
		}
		switch {
		case toLegacy && dataType == "bigint":
			if err := tx.Exec(fmt.Sprintf("ALTER TABLE users ALTER COLUMN %s DROP DEFAULT", quoteRollbackIdentifier(column))).Error; err != nil {
				return fmt.Errorf("drop users.%s default: %w", column, err)
			}
			if err := tx.Exec(fmt.Sprintf("ALTER TABLE users ALTER COLUMN %s TYPE timestamptz USING CASE WHEN %s = 0 THEN NULL ELSE to_timestamp(%s) END", quoteRollbackIdentifier(column), quoteRollbackIdentifier(column), quoteRollbackIdentifier(column))).Error; err != nil {
				return fmt.Errorf("convert users.%s to timestamp: %w", column, err)
			}
		case !toLegacy && dataType == "timestamp with time zone":
			if err := tx.Exec(fmt.Sprintf("ALTER TABLE users ALTER COLUMN %s TYPE bigint USING COALESCE(EXTRACT(EPOCH FROM %s)::bigint, 0)", quoteRollbackIdentifier(column), quoteRollbackIdentifier(column))).Error; err != nil {
				return fmt.Errorf("convert users.%s to bigint: %w", column, err)
			}
			if column == "bound_at" || column == "last_login_at" {
				if err := tx.Exec(fmt.Sprintf("ALTER TABLE users ALTER COLUMN %s SET DEFAULT 0", quoteRollbackIdentifier(column))).Error; err != nil {
					return fmt.Errorf("restore users.%s default: %w", column, err)
				}
			}
		case (toLegacy && dataType == "timestamp with time zone") || (!toLegacy && dataType == "bigint"):
			continue
		default:
			return fmt.Errorf("unsupported users.%s type %q", column, dataType)
		}
	}
	return nil
}

func swapToLegacyLedger(tx *gorm.DB) error {
	currentSequence, err := sequenceName(tx, rollbackCurrentLedgerTable)
	if err != nil {
		return err
	}
	legacySequence, err := sequenceName(tx, rollbackLegacyLedgerTable)
	if err != nil {
		return err
	}
	if err := renameSequence(tx, legacySequence, "agent_credit_logs_legacy_shadow_id_seq"); err != nil {
		return err
	}
	if err := renameSequence(tx, currentSequence, "agent_credit_logs_new_id_seq"); err != nil {
		return err
	}
	if err := tx.Exec(`ALTER TABLE agent_credit_logs RENAME TO agent_credit_logs_new`).Error; err != nil {
		return err
	}
	if err := renameSequence(tx, "agent_credit_logs_legacy_shadow_id_seq", "agent_credit_logs_id_seq"); err != nil {
		return err
	}
	if err := tx.Exec(`ALTER TABLE agent_credit_logs_legacy RENAME TO agent_credit_logs`).Error; err != nil {
		return err
	}
	return resetSequenceForTable(tx, rollbackCurrentLedgerTable)
}

func swapToCurrentLedger(tx *gorm.DB) error {
	legacySequence, err := sequenceName(tx, rollbackCurrentLedgerTable)
	if err != nil {
		return err
	}
	currentSequence, err := sequenceName(tx, rollbackSwappedLedgerTable)
	if err != nil {
		return err
	}
	if err := renameSequence(tx, legacySequence, "agent_credit_logs_legacy_id_seq"); err != nil {
		return err
	}
	if err := renameSequence(tx, currentSequence, "agent_credit_logs_id_seq"); err != nil {
		return err
	}
	if err := tx.Exec(`ALTER TABLE agent_credit_logs RENAME TO agent_credit_logs_legacy`).Error; err != nil {
		return err
	}
	if err := tx.Exec(`ALTER TABLE agent_credit_logs_new RENAME TO agent_credit_logs`).Error; err != nil {
		return err
	}
	return resetSequenceForTable(tx, rollbackCurrentLedgerTable)
}

func loadRollbackRun(tx *gorm.DB, runID string) (rollbackRun, error) {
	var run rollbackRun
	if err := tx.Table("agent_rollback_runs").Where("run_id = ?", runID).First(&run).Error; err != nil {
		return rollbackRun{}, err
	}
	return run, nil
}

func loadProjections(tx *gorm.DB, runID, kind string) ([]rollbackProjection, error) {
	var projections []rollbackProjection
	query := tx.Table("agent_rollback_projections").Where("run_id = ?", runID)
	if kind != "" {
		query = query.Where("kind = ?", kind)
	}
	if err := query.Order("kind ASC, current_id ASC").Find(&projections).Error; err != nil {
		return nil, err
	}
	return projections, nil
}

func saveProjection(tx *gorm.DB, runID, kind string, currentID, legacyID int64) error {
	return tx.Exec(`INSERT INTO agent_rollback_projections (run_id, kind, current_id, legacy_id) VALUES (?, ?, ?, ?)`, runID, kind, currentID, legacyID).Error
}

func currentSubscriptionRows(tx *gorm.DB, cutoverAt int64) ([]model.UserSubscription, error) {
	var subscriptions []model.UserSubscription
	if err := tx.Where("created_at >= ?", cutoverAt).Order("id ASC").Find(&subscriptions).Error; err != nil {
		return nil, err
	}
	return subscriptions, nil
}

func currentLedgerRows(tx *gorm.DB, cutoverAt int64) ([]model.AgentCreditLog, error) {
	var logs []model.AgentCreditLog
	if err := tx.Where("created_at >= ?", cutoverAt).Order("id ASC").Find(&logs).Error; err != nil {
		return nil, err
	}
	return logs, nil
}

func loadCurrentRedemptions(tx *gorm.DB) ([]currentRedemptionCompat, error) {
	var rows []currentRedemptionCompat
	query := `SELECT id, type, agent_user_id, subscription_plan_id, agent_id, package_id, offer_id,
		offer_amount, offer_refund_fee_type, offer_refund_fee_value, offer_duration,
		offer_duration_unit, offer_currency, offer_retail_amount, status, redeemed_time, used_user_id
		FROM redemptions WHERE type IN (0, 1) ORDER BY id ASC`
	if err := tx.Raw(query).Scan(&rows).Error; err != nil {
		return nil, err
	}
	return rows, nil
}

func snapshotUsers(tx *gorm.DB, runID string) error {
	var rows []rollbackUserSnapshot
	if err := tx.Raw(`SELECT id AS user_id, quota, used_quota, request_count, bound_agent_id,
		bound_at, created_at, last_login_at FROM users ORDER BY id ASC`).Scan(&rows).Error; err != nil {
		return err
	}
	for _, row := range rows {
		if err := tx.Exec(`INSERT INTO agent_rollback_user_snapshots
			(run_id, user_id, quota, used_quota, request_count, bound_agent_id, bound_at, created_at, last_login_at)
			VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`, runID, row.UserID, row.Quota, row.UsedQuota,
			row.RequestCount, row.BoundAgentID, row.BoundAt, row.CreatedAt, row.LastLoginAt).Error; err != nil {
			return err
		}
	}
	return nil
}

func snapshotAgents(tx *gorm.DB, runID string, userIDs []int) error {
	if len(userIDs) == 0 {
		return nil
	}
	var rows []rollbackAgentSnapshot
	if err := tx.Raw(`SELECT user_id, balance, status, daily_gen_limit, updated_at FROM agent_credits WHERE user_id IN ? ORDER BY user_id ASC`, userIDs).Scan(&rows).Error; err != nil {
		return err
	}
	for _, row := range rows {
		if err := tx.Exec(`INSERT INTO agent_rollback_agent_snapshots
			(run_id, user_id, balance, status, daily_gen_limit, updated_at)
			VALUES (?, ?, ?, ?, ?, ?)`, runID, row.UserID, row.Balance, row.Status,
			row.DailyGenLimit, row.UpdatedAt).Error; err != nil {
			return err
		}
	}
	return nil
}

func snapshotRedemptions(tx *gorm.DB, runID string, rows []currentRedemptionCompat) error {
	for _, row := range rows {
		snapshot := rollbackRedemptionSnapshot{
			RunID: runID, RedemptionID: row.Id, OriginalType: row.Type,
			OriginalAgentID: row.AgentID, OriginalPackageID: row.PackageID,
			OriginalOfferID: row.OfferID, OriginalOfferAmount: row.OfferAmount,
			OriginalRefundType: row.OfferRefundFeeType, OriginalRefundValue: row.OfferRefundFeeValue,
			OriginalDuration: row.OfferDuration, OriginalDurationUnit: row.OfferDurationUnit,
			OriginalCurrency: row.OfferCurrency, OriginalRetailAmount: row.OfferRetailAmount,
			OriginalStatus: row.Status, OriginalRedeemedTime: row.RedeemedTime, OriginalUsedUserID: row.UsedUserID,
		}
		if err := tx.Table("agent_rollback_redemption_snapshots").Create(&snapshot).Error; err != nil {
			return err
		}
	}
	return nil
}

func updateLegacyRedemptions(tx *gorm.DB, rows []currentRedemptionCompat) error {
	for _, row := range rows {
		if row.Type == common.RedemptionCodeTypeQuota {
			if err := tx.Exec(`UPDATE redemptions SET type = 1 WHERE id = ?`, row.Id).Error; err != nil {
				return err
			}
			continue
		}
		if row.Type != common.RedemptionCodeTypeSubscription {
			continue
		}
		if err := tx.Exec(`UPDATE redemptions SET type = 2, agent_id = agent_user_id, package_id = subscription_plan_id WHERE id = ?`, row.Id).Error; err != nil {
			return err
		}
	}
	return nil
}

func projectLegacyLedger(tx *gorm.DB, runID string, cutoverAt int64, orders map[int]model.AgentPurchaseOrder) (int, []int, error) {
	logs, err := currentLedgerRows(tx, cutoverAt)
	if err != nil {
		return 0, nil, err
	}
	agentIDs := make([]int, 0)
	seenAgents := make(map[int]struct{})
	for _, log := range logs {
		legacyEvent, ok := mapCurrentCreditEvent(log.EventType)
		if !ok {
			return 0, nil, fmt.Errorf("unsupported current credit event %q", log.EventType)
		}
		order := orders[log.OrderId]
		remark := log.Remark
		if legacyEvent == "purchase" && order.Id != 0 {
			remark = legacyPurchaseRemark(order.PlanTitle, order.Quantity)
		}
		var legacyID int64
		if err := tx.Raw(`INSERT INTO agent_credit_logs_legacy
			(user_id, delta, before, after, change_type, source_id, operator_id, remark,
			 related_user_id, package_id, offer_id, source_type, base_amount, status, created_at)
			VALUES (?, ?, ?, ?, ?, 0, ?, ?, 0, ?, 0, 'agent_purchase_order', ?, 1, ?)
			RETURNING id`, log.AgentUserId, log.Delta, log.BalanceBefore, log.BalanceAfter,
			legacyEvent, log.OperatorUserId, remark, order.PlanId, order.TotalPrice, log.CreatedAt).Scan(&legacyID).Error; err != nil {
			return 0, nil, err
		}
		if err := saveProjection(tx, runID, "credit_log", int64(log.Id), legacyID); err != nil {
			return 0, nil, err
		}
		if _, ok := seenAgents[log.AgentUserId]; !ok {
			agentIDs = append(agentIDs, log.AgentUserId)
			seenAgents[log.AgentUserId] = struct{}{}
		}
	}
	sort.Ints(agentIDs)
	return len(logs), agentIDs, nil
}

func loadOrdersByID(tx *gorm.DB, logs []model.AgentCreditLog) (map[int]model.AgentPurchaseOrder, error) {
	ids := make([]int, 0)
	seen := make(map[int]struct{})
	for _, log := range logs {
		if log.OrderId > 0 {
			if _, ok := seen[log.OrderId]; !ok {
				ids = append(ids, log.OrderId)
				seen[log.OrderId] = struct{}{}
			}
		}
	}
	orders := make([]model.AgentPurchaseOrder, 0, len(ids))
	if len(ids) > 0 {
		if err := tx.Where("id IN ?", ids).Find(&orders).Error; err != nil {
			return nil, err
		}
	}
	result := make(map[int]model.AgentPurchaseOrder, len(orders))
	for _, order := range orders {
		result[order.Id] = order
	}
	return result, nil
}

func projectLegacySubscriptions(tx *gorm.DB, runID string, cutoverAt int64) (int, int, error) {
	subscriptions, err := currentSubscriptionRows(tx, cutoverAt)
	if err != nil {
		return 0, 0, err
	}
	packages := 0
	grants := 0
	for _, subscription := range subscriptions {
		remaining, err := subscriptionRemaining(subscription.AmountTotal, subscription.AmountUsed)
		if err != nil {
			return 0, 0, fmt.Errorf("subscription %d: %w", subscription.Id, err)
		}
		allocated, err := legacyQuotaInt(subscription.AmountTotal)
		if err != nil {
			return 0, 0, fmt.Errorf("subscription %d: %w", subscription.Id, err)
		}
		remainingInt, err := legacyQuotaInt(remaining)
		if err != nil {
			return 0, 0, fmt.Errorf("subscription %d remaining: %w", subscription.Id, err)
		}
		appliedAt := time.Unix(subscription.StartTime, 0).UTC()
		expireAt := time.Unix(subscription.EndTime, 0).UTC()
		packageRow := SourceUserPackage{
			UserId: subscription.UserId, PackageId: subscription.PlanId, QuotaAllocated: allocated,
			AppliedAt: appliedAt, ExpireAt: &expireAt, ActivatedAt: &appliedAt,
			DurationSnapshot: 0, DurationUnitSnapshot: "", ExpireGroupSnapshot: subscription.DowngradeGroup,
		}
		if subscription.Status != "active" {
			packageRow.ClearedAt = &appliedAt
			packageRow.ActivatedAt = nil
		}
		if err := tx.Create(&packageRow).Error; err != nil {
			return 0, 0, fmt.Errorf("insert legacy package for subscription %d: %w", subscription.Id, err)
		}
		if err := tx.Exec(`UPDATE user_packages SET created_at = to_timestamp(?) WHERE id = ?`, subscription.CreatedAt, packageRow.Id).Error; err != nil {
			return 0, 0, fmt.Errorf("set legacy package timestamp for subscription %d: %w", subscription.Id, err)
		}
		if err := saveProjection(tx, runID, "user_package", int64(subscription.Id), int64(packageRow.Id)); err != nil {
			return 0, 0, err
		}
		packages++
		grantStatus := 2
		if subscription.Status == "active" && remaining > 0 && subscription.EndTime > cutoverAt {
			grantStatus = 1
		}
		grant := SourceQuotaGrant{
			UserId: subscription.UserId, Total: allocated, Remaining: remainingInt, Status: grantStatus,
			GrantType: "subscription", SourceType: "user_package", SourceId: packageRow.Id,
			ExpireAt: &expireAt, Remark: "rollback compatibility projection",
			CreatedAt: time.Unix(subscription.CreatedAt, 0).UTC(),
		}
		if err := tx.Create(&grant).Error; err != nil {
			return 0, 0, fmt.Errorf("insert legacy quota grant for subscription %d: %w", subscription.Id, err)
		}
		if err := saveProjection(tx, runID, "quota_grant", int64(subscription.Id), int64(grant.Id)); err != nil {
			return 0, 0, err
		}
		if grantStatus == 1 && remaining > 0 {
			if err := tx.Model(&model.User{}).Where("id = ?", subscription.UserId).Update("quota", gorm.Expr("quota + ?", remainingInt)).Error; err != nil {
				return 0, 0, err
			}
		}
		grants++
	}
	return packages, grants, nil
}

func projectLegacyAgents(tx *gorm.DB, userIDs []int) (int, error) {
	if len(userIDs) == 0 {
		return 0, nil
	}
	var accounts []model.AgentAccount
	if err := tx.Where("user_id IN ?", userIDs).Find(&accounts).Error; err != nil {
		return 0, err
	}
	for _, account := range accounts {
		legacyStatus := 2
		if account.Status == model.AgentAccountStatusActive {
			legacyStatus = 1
		}
		updated := tx.Exec(`UPDATE agent_credits SET balance = ?, status = ?, daily_gen_limit = ?, updated_at = ? WHERE user_id = ?`, account.Balance, legacyStatus, account.DailyCodeLimit, account.UpdatedAt, account.UserId)
		if updated.Error != nil {
			return 0, updated.Error
		}
		if updated.RowsAffected != 1 {
			return 0, fmt.Errorf("legacy agent credit account %d not found", account.UserId)
		}
	}
	return len(accounts), nil
}

func projectLegacyRun(tx *gorm.DB, runID string, cutoverAt int64) (rollbackReport, error) {
	if err := validateRollbackRunID(runID); err != nil {
		return rollbackReport{}, err
	}
	if cutoverAt <= 0 {
		return rollbackReport{}, errors.New("cutover timestamp must be positive")
	}
	if err := ensureRollbackMetadata(tx); err != nil {
		return rollbackReport{}, err
	}
	if err := checkRollbackShape(tx); err != nil {
		return rollbackReport{}, err
	}
	var existing int64
	if err := tx.Table("agent_rollback_runs").Where("run_id = ?", runID).Count(&existing).Error; err != nil {
		return rollbackReport{}, err
	}
	if existing != 0 {
		return rollbackReport{}, fmt.Errorf("rollback run already exists: %s", runID)
	}
	now := common.GetTimestamp()
	if err := tx.Exec(`INSERT INTO agent_rollback_runs (run_id, cutover_at, projected_at, legacy_ledger_count, legacy_ledger_max_id, status) VALUES (?, ?, ?, 0, 0, 'projecting')`, runID, cutoverAt, now).Error; err != nil {
		return rollbackReport{}, err
	}
	if err := snapshotUsers(tx, runID); err != nil {
		return rollbackReport{}, err
	}
	if err := snapshotTableStats(tx, runID, []string{"users", "logs", "redemptions", "user_packages", "quota_grants", "agent_credits", rollbackLegacyLedgerTable}); err != nil {
		return rollbackReport{}, err
	}
	redemptions, err := loadCurrentRedemptions(tx)
	if err != nil {
		return rollbackReport{}, err
	}
	if err := snapshotRedemptions(tx, runID, redemptions); err != nil {
		return rollbackReport{}, err
	}
	if err := updateLegacyRedemptions(tx, redemptions); err != nil {
		return rollbackReport{}, err
	}
	ledgers, err := currentLedgerRows(tx, cutoverAt)
	if err != nil {
		return rollbackReport{}, err
	}
	orders, err := loadOrdersByID(tx, ledgers)
	if err != nil {
		return rollbackReport{}, err
	}
	for _, log := range ledgers {
		if (log.EventType == model.AgentCreditEventPurchase || log.EventType == model.AgentCreditEventRefund) && log.OrderId > 0 {
			if _, ok := orders[log.OrderId]; !ok {
				return rollbackReport{}, fmt.Errorf("credit log %d references missing order %d", log.Id, log.OrderId)
			}
		}
	}
	ledgerCount, agentIDs, err := projectLegacyLedger(tx, runID, cutoverAt, orders)
	if err != nil {
		return rollbackReport{}, err
	}
	if err := snapshotAgents(tx, runID, agentIDs); err != nil {
		return rollbackReport{}, err
	}
	if _, err := projectLegacyAgents(tx, agentIDs); err != nil {
		return rollbackReport{}, err
	}
	packageCount, grantCount, err := projectLegacySubscriptions(tx, runID, cutoverAt)
	if err != nil {
		return rollbackReport{}, err
	}
	for _, table := range []string{"user_packages", "quota_grants", rollbackLegacyLedgerTable} {
		if err := resetSequenceForTable(tx, table); err != nil {
			return rollbackReport{}, err
		}
	}
	if err := convertUserTimes(tx, true); err != nil {
		return rollbackReport{}, err
	}
	if err := swapToLegacyLedger(tx); err != nil {
		return rollbackReport{}, err
	}
	legacyCount, legacyMaxID, err := tableStats(tx, rollbackCurrentLedgerTable)
	if err != nil {
		return rollbackReport{}, err
	}
	if err := tx.Exec(`UPDATE agent_rollback_runs SET legacy_ledger_count = ?, legacy_ledger_max_id = ?, status = 'active' WHERE run_id = ?`, legacyCount, legacyMaxID, runID).Error; err != nil {
		return rollbackReport{}, err
	}
	return rollbackReport{RunID: runID, LedgerRows: ledgerCount, SubscriptionRows: packageCount, QuotaGrantRows: grantCount, RedemptionRows: len(redemptions), AgentRows: len(agentIDs), UserRows: 1}, nil
}

func projectLegacyRollback(targetDSN string, cutoverAt int64, runID string) (rollbackReport, error) {
	db, err := openPostgres(targetDSN)
	if err != nil {
		return rollbackReport{}, fmt.Errorf("open target database: %w", err)
	}
	sqlDB, err := db.DB()
	if err != nil {
		return rollbackReport{}, err
	}
	defer sqlDB.Close()
	var report rollbackReport
	err = db.Transaction(func(tx *gorm.DB) error {
		var txErr error
		report, txErr = projectLegacyRun(tx, runID, cutoverAt)
		return txErr
	})
	return report, err
}

func loadUserSnapshots(tx *gorm.DB, runID string) ([]rollbackUserSnapshot, error) {
	var snapshots []rollbackUserSnapshot
	if err := tx.Table("agent_rollback_user_snapshots").Where("run_id = ?", runID).Order("user_id ASC").Find(&snapshots).Error; err != nil {
		return nil, err
	}
	return snapshots, nil
}

func loadAgentSnapshots(tx *gorm.DB, runID string) ([]rollbackAgentSnapshot, error) {
	var snapshots []rollbackAgentSnapshot
	if err := tx.Table("agent_rollback_agent_snapshots").Where("run_id = ?", runID).Order("user_id ASC").Find(&snapshots).Error; err != nil {
		return nil, err
	}
	return snapshots, nil
}

func loadRedemptionSnapshots(tx *gorm.DB, runID string) ([]rollbackRedemptionSnapshot, error) {
	var snapshots []rollbackRedemptionSnapshot
	if err := tx.Table("agent_rollback_redemption_snapshots").Where("run_id = ?", runID).Order("redemption_id ASC").Find(&snapshots).Error; err != nil {
		return nil, err
	}
	return snapshots, nil
}

func loadTableSnapshots(tx *gorm.DB, runID string) ([]rollbackTableSnapshot, error) {
	var snapshots []rollbackTableSnapshot
	if err := tx.Table("agent_rollback_table_snapshots").Where("run_id = ?", runID).Order("table_name ASC").Find(&snapshots).Error; err != nil {
		return nil, err
	}
	return snapshots, nil
}

func projectionCounts(projections []rollbackProjection) map[string]int64 {
	counts := make(map[string]int64)
	for _, projection := range projections {
		counts[projection.Kind]++
	}
	return counts
}

func expectedLegacyTableName(snapshotName string) string {
	if snapshotName == rollbackLegacyLedgerTable {
		return rollbackCurrentLedgerTable
	}
	return snapshotName
}

func expectedSnapshotStats(snapshot rollbackTableSnapshot, counts map[string]int64) (int64, error) {
	rowCount := snapshot.RowCount
	if snapshot.TableName == "user_packages" {
		rowCount += counts["user_package"]
	}
	if snapshot.TableName == "quota_grants" {
		rowCount += counts["quota_grant"]
	}
	if snapshot.TableName == rollbackLegacyLedgerTable {
		rowCount += counts["credit_log"]
	}
	return rowCount, nil
}

func currentLegacyUserSnapshots(tx *gorm.DB) ([]rollbackUserSnapshot, error) {
	var rows []rollbackUserSnapshot
	if err := tx.Raw(`SELECT id AS user_id, quota, used_quota, request_count, bound_agent_id,
		COALESCE(EXTRACT(EPOCH FROM bound_at)::bigint, 0) AS bound_at,
		COALESCE(EXTRACT(EPOCH FROM created_at)::bigint, 0) AS created_at,
		COALESCE(EXTRACT(EPOCH FROM last_login_at)::bigint, 0) AS last_login_at
		FROM users ORDER BY id ASC`).Scan(&rows).Error; err != nil {
		return nil, err
	}
	return rows, nil
}

func expectedSubscriptionRemainingByUser(tx *gorm.DB, cutoverAt int64) (map[int]int64, error) {
	subscriptions, err := currentSubscriptionRows(tx, cutoverAt)
	if err != nil {
		return nil, err
	}
	remainingByUser := make(map[int]int64)
	for _, subscription := range subscriptions {
		remaining, err := subscriptionRemaining(subscription.AmountTotal, subscription.AmountUsed)
		if err != nil {
			return nil, err
		}
		if subscription.Status == "active" && subscription.EndTime > cutoverAt && remaining > 0 {
			remainingByUser[subscription.UserId] += remaining
		}
	}
	return remainingByUser, nil
}

func compareUsersDuringLegacyRun(tx *gorm.DB, run rollbackRun, projections []rollbackProjection) error {
	expected, err := loadUserSnapshots(tx, run.RunID)
	if err != nil {
		return err
	}
	current, err := currentLegacyUserSnapshots(tx)
	if err != nil {
		return err
	}
	currentByID := make(map[int64]rollbackUserSnapshot, len(current))
	for _, row := range current {
		currentByID[row.UserID] = row
	}
	remainingByUser, err := expectedSubscriptionRemainingByUser(tx, run.CutoverAt)
	if err != nil {
		return err
	}
	for _, snapshot := range expected {
		row, ok := currentByID[snapshot.UserID]
		if !ok {
			return fmt.Errorf("legacy business writes detected: user %d disappeared", snapshot.UserID)
		}
		expectedQuota := snapshot.Quota + remainingByUser[int(snapshot.UserID)]
		if row.Quota != expectedQuota || row.UsedQuota != snapshot.UsedQuota || row.RequestCount != snapshot.RequestCount ||
			row.BoundAgentID != snapshot.BoundAgentID || row.BoundAt != snapshot.BoundAt || row.CreatedAt != snapshot.CreatedAt || row.LastLoginAt != snapshot.LastLoginAt {
			return fmt.Errorf("legacy business writes detected: user %d changed", snapshot.UserID)
		}
	}
	_ = projections
	return nil
}

func compareLegacyTableStats(tx *gorm.DB, run rollbackRun, projections []rollbackProjection) error {
	snapshots, err := loadTableSnapshots(tx, run.RunID)
	if err != nil {
		return err
	}
	counts := projectionCounts(projections)
	for _, snapshot := range snapshots {
		table := expectedLegacyTableName(snapshot.TableName)
		rowCount, maxID, err := tableStats(tx, table)
		if err != nil {
			return err
		}
		expectedCount, err := expectedSnapshotStats(snapshot, counts)
		if err != nil {
			return err
		}
		expectedMaxID := snapshot.MaxID
		if snapshot.TableName == "user_packages" || snapshot.TableName == "quota_grants" || snapshot.TableName == rollbackLegacyLedgerTable {
			for _, projection := range projections {
				if (snapshot.TableName == "user_packages" && projection.Kind != "user_package") ||
					(snapshot.TableName == "quota_grants" && projection.Kind != "quota_grant") ||
					(snapshot.TableName == rollbackLegacyLedgerTable && projection.Kind != "credit_log") {
					continue
				}
				if projection.LegacyID > expectedMaxID {
					expectedMaxID = projection.LegacyID
				}
			}
		}
		if rowCount != expectedCount || maxID != expectedMaxID {
			return fmt.Errorf("legacy business writes detected: table %s changed", table)
		}
	}
	return nil
}

func compareLegacyAgents(tx *gorm.DB, runID string) error {
	snapshots, err := loadAgentSnapshots(tx, runID)
	if err != nil {
		return err
	}
	for _, snapshot := range snapshots {
		var legacy struct {
			Balance       int64 `gorm:"column:balance"`
			Status        int64 `gorm:"column:status"`
			DailyGenLimit int64 `gorm:"column:daily_gen_limit"`
		}
		if err := tx.Raw(`SELECT balance, status, daily_gen_limit FROM agent_credits WHERE user_id = ?`, snapshot.UserID).Scan(&legacy).Error; err != nil {
			return err
		}
		var current model.AgentAccount
		if err := tx.Where("user_id = ?", snapshot.UserID).First(&current).Error; err != nil {
			return err
		}
		expectedStatus := int64(2)
		if current.Status == model.AgentAccountStatusActive {
			expectedStatus = 1
		}
		if legacy.Balance != current.Balance || legacy.Status != expectedStatus || legacy.DailyGenLimit != int64(current.DailyCodeLimit) {
			return fmt.Errorf("legacy business writes detected: agent account %d changed", snapshot.UserID)
		}
	}
	return nil
}

func compareLegacyRedemptions(tx *gorm.DB, runID string) error {
	snapshots, err := loadRedemptionSnapshots(tx, runID)
	if err != nil {
		return err
	}
	for _, snapshot := range snapshots {
		var current struct {
			Type             int64 `gorm:"column:type"`
			AgentUserID      int64 `gorm:"column:agent_user_id"`
			SubscriptionPlan int64 `gorm:"column:subscription_plan_id"`
			AgentID          int64 `gorm:"column:agent_id"`
			PackageID        int64 `gorm:"column:package_id"`
			OfferID          int64 `gorm:"column:offer_id"`
			OfferAmount      int64 `gorm:"column:offer_amount"`
			Status           int64 `gorm:"column:status"`
			RedeemedTime     int64 `gorm:"column:redeemed_time"`
			UsedUserID       int64 `gorm:"column:used_user_id"`
		}
		if err := tx.Raw(`SELECT type, agent_user_id, subscription_plan_id, agent_id, package_id, offer_id,
			offer_amount, status, redeemed_time, used_user_id FROM redemptions WHERE id = ?`, snapshot.RedemptionID).Scan(&current).Error; err != nil {
			return err
		}
		expectedType := snapshot.OriginalType + 1
		if current.Type != expectedType || current.Status != snapshot.OriginalStatus || current.RedeemedTime != snapshot.OriginalRedeemedTime || current.UsedUserID != snapshot.OriginalUsedUserID {
			return fmt.Errorf("legacy business writes detected: redemption %d changed", snapshot.RedemptionID)
		}
		if snapshot.OriginalType == common.RedemptionCodeTypeQuota {
			if current.AgentID != snapshot.OriginalAgentID || current.PackageID != snapshot.OriginalPackageID || current.OfferID != snapshot.OriginalOfferID || current.OfferAmount != snapshot.OriginalOfferAmount {
				return fmt.Errorf("legacy business writes detected: redemption %d legacy fields changed", snapshot.RedemptionID)
			}
		} else if current.AgentID != current.AgentUserID || current.PackageID != current.SubscriptionPlan {
			return fmt.Errorf("legacy projection is incomplete for redemption %d", snapshot.RedemptionID)
		}
	}
	return nil
}

func legacyWritesChanged(tx *gorm.DB, run rollbackRun, projections []rollbackProjection) error {
	if err := compareUsersDuringLegacyRun(tx, run, projections); err != nil {
		return err
	}
	if err := compareLegacyTableStats(tx, run, projections); err != nil {
		return err
	}
	if err := compareLegacyAgents(tx, run.RunID); err != nil {
		return err
	}
	return compareLegacyRedemptions(tx, run.RunID)
}

func restoreRedemptions(tx *gorm.DB, runID string) error {
	snapshots, err := loadRedemptionSnapshots(tx, runID)
	if err != nil {
		return err
	}
	for _, snapshot := range snapshots {
		if err := tx.Exec(`UPDATE redemptions SET type = ?, agent_id = ?, package_id = ?, offer_id = ?, offer_amount = ?,
			offer_refund_fee_type = ?, offer_refund_fee_value = ?, offer_duration = ?, offer_duration_unit = ?,
			offer_currency = ?, offer_retail_amount = ? WHERE id = ?`, snapshot.OriginalType,
			snapshot.OriginalAgentID, snapshot.OriginalPackageID, snapshot.OriginalOfferID, snapshot.OriginalOfferAmount,
			snapshot.OriginalRefundType, snapshot.OriginalRefundValue, snapshot.OriginalDuration,
			snapshot.OriginalDurationUnit, snapshot.OriginalCurrency, snapshot.OriginalRetailAmount, snapshot.RedemptionID).Error; err != nil {
			return err
		}
	}
	return nil
}

func restoreProjectionRows(tx *gorm.DB, runID string, projections []rollbackProjection) error {
	for _, projection := range projections {
		switch projection.Kind {
		case "quota_grant":
			if err := tx.Exec(`DELETE FROM quota_grants WHERE id = ?`, projection.LegacyID).Error; err != nil {
				return err
			}
		case "user_package":
			if err := tx.Exec(`DELETE FROM user_packages WHERE id = ?`, projection.LegacyID).Error; err != nil {
				return err
			}
		case "credit_log":
			if err := tx.Exec(`DELETE FROM agent_credit_logs WHERE id = ?`, projection.LegacyID).Error; err != nil {
				return err
			}
		}
	}
	return nil
}

func restoreUsers(tx *gorm.DB, runID string) error {
	snapshots, err := loadUserSnapshots(tx, runID)
	if err != nil {
		return err
	}
	for _, snapshot := range snapshots {
		if err := tx.Exec(`UPDATE users SET quota = ?, used_quota = ?, request_count = ?, bound_agent_id = ?, bound_at = ?, created_at = ?, last_login_at = ? WHERE id = ?`,
			snapshot.Quota, snapshot.UsedQuota, snapshot.RequestCount, snapshot.BoundAgentID, snapshot.BoundAt, snapshot.CreatedAt, snapshot.LastLoginAt, snapshot.UserID).Error; err != nil {
			return err
		}
	}
	return nil
}

func restoreAgents(tx *gorm.DB, runID string) error {
	snapshots, err := loadAgentSnapshots(tx, runID)
	if err != nil {
		return err
	}
	for _, snapshot := range snapshots {
		if err := tx.Exec(`UPDATE agent_credits SET balance = ?, status = ?, daily_gen_limit = ?, updated_at = ? WHERE user_id = ?`, snapshot.Balance, snapshot.Status, snapshot.DailyGenLimit, snapshot.UpdatedAt, snapshot.UserID).Error; err != nil {
			return err
		}
	}
	return nil
}

func restoreCurrentRun(tx *gorm.DB, runID string) (rollbackReport, error) {
	if err := validateRollbackRunID(runID); err != nil {
		return rollbackReport{}, err
	}
	if err := ensureRollbackMetadata(tx); err != nil {
		return rollbackReport{}, err
	}
	run, err := loadRollbackRun(tx, runID)
	if err != nil {
		return rollbackReport{}, err
	}
	if run.Status != "active" {
		return rollbackReport{}, fmt.Errorf("rollback run %s is not active: %s", runID, run.Status)
	}
	projections, err := loadProjections(tx, runID, "")
	if err != nil {
		return rollbackReport{}, err
	}
	if err := legacyWritesChanged(tx, run, projections); err != nil {
		return rollbackReport{}, err
	}
	if err := restoreRedemptions(tx, runID); err != nil {
		return rollbackReport{}, err
	}
	if err := restoreProjectionRows(tx, runID, projections); err != nil {
		return rollbackReport{}, err
	}
	if err := convertUserTimes(tx, false); err != nil {
		return rollbackReport{}, err
	}
	if err := restoreUsers(tx, runID); err != nil {
		return rollbackReport{}, err
	}
	if err := restoreAgents(tx, runID); err != nil {
		return rollbackReport{}, err
	}
	if err := swapToCurrentLedger(tx); err != nil {
		return rollbackReport{}, err
	}
	for _, table := range []string{"user_packages", "quota_grants", rollbackLegacyLedgerTable, rollbackCurrentLedgerTable} {
		if err := resetSequenceForTable(tx, table); err != nil {
			return rollbackReport{}, err
		}
	}
	if err := tx.Exec(`UPDATE agent_rollback_runs SET status = 'restored' WHERE run_id = ?`, runID).Error; err != nil {
		return rollbackReport{}, err
	}
	return rollbackReport{RunID: runID, Restored: true}, nil
}

func restoreCurrentSchema(targetDSN string, runID string) (rollbackReport, error) {
	db, err := openPostgres(targetDSN)
	if err != nil {
		return rollbackReport{}, fmt.Errorf("open target database: %w", err)
	}
	sqlDB, err := db.DB()
	if err != nil {
		return rollbackReport{}, err
	}
	defer sqlDB.Close()
	var report rollbackReport
	err = db.Transaction(func(tx *gorm.DB) error {
		var txErr error
		report, txErr = restoreCurrentRun(tx, runID)
		return txErr
	})
	return report, err
}
