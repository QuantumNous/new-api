package service

import (
	"encoding/csv"
	"errors"
	"io"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"gorm.io/gorm"
)

const (
	AgentCodeStatusUnused   = "unused"
	AgentCodeStatusUsed     = "used"
	AgentCodeStatusRefunded = "refunded"
	AgentCodeStatusExpired  = "expired"

	// AgentCodeExportMaxRows bounds both database work and the amount of fresh
	// code material returned by one download.
	AgentCodeExportMaxRows = 10000

	agentQueryDefaultLimit = 10
	agentQueryMaxLimit     = 100
)

var (
	ErrAgentQueryInvalid        = errors.New("invalid agent query")
	ErrAgentExportLimitExceeded = errors.New("agent code export exceeds maximum rows")
)

type AgentOrderQuery struct {
	AgentUserID    int
	PlanID         int
	Status         string
	StartTimestamp int64
	EndTimestamp   int64
	Offset         int
	Limit          int
}

type AgentOrderRecord struct {
	ID             int    `json:"id"`
	OrderNo        string `json:"order_no"`
	AgentUserID    int    `json:"agent_user_id"`
	PlanID         int    `json:"plan_id"`
	PlanTitle      string `json:"plan_title"`
	Quantity       int    `json:"quantity"`
	UnitPrice      string `json:"unit_price"`
	TotalPrice     string `json:"total_price"`
	CodeValidDays  int    `json:"code_valid_days"`
	RefundFeeBps   int    `json:"refund_fee_bps"`
	RefundedCount  int    `json:"refunded_count"`
	RefundedAmount string `json:"refunded_amount"`
	Status         string `json:"status"`
	CreatedAt      int64  `json:"created_at"`
	UpdatedAt      int64  `json:"updated_at"`
}

type AgentCodeQuery struct {
	AgentUserID    int
	PlanID         int
	OrderID        int
	Status         string
	StartTimestamp int64
	EndTimestamp   int64
	Offset         int
	Limit          int
	// Now makes the dynamic expired state deterministic for callers that need
	// one consistent timestamp across count, rows, and CSV output. Zero means
	// the current Unix timestamp.
	Now int64
}

type AgentCodeRecord struct {
	ID          int    `json:"id"`
	Code        string `json:"code"`
	AgentUserID int    `json:"agent_user_id"`
	OrderID     int    `json:"order_id"`
	OrderNo     string `json:"order_no"`
	PlanID      int    `json:"plan_id"`
	PlanTitle   string `json:"plan_title"`
	Status      string `json:"status"`
	// CodeVisible makes masking explicit for disabled agents. A false value
	// means Code is intentionally empty because the code is still redeemable.
	CodeVisible bool  `json:"code_visible"`
	UsedUserID  int   `json:"used_user_id"`
	CreatedAt   int64 `json:"created_at"`
	ExpiredAt   int64 `json:"expired_at"`
	RedeemedAt  int64 `json:"redeemed_at"`
}

type AgentCreditLogQuery struct {
	AgentUserID    int
	EventType      string
	StartTimestamp int64
	EndTimestamp   int64
	Offset         int
	Limit          int
}

type AgentCreditLogRecord struct {
	ID             int    `json:"id"`
	AgentUserID    int    `json:"agent_user_id"`
	Delta          string `json:"delta"`
	BalanceBefore  string `json:"balance_before"`
	BalanceAfter   string `json:"balance_after"`
	EventType      string `json:"event_type"`
	BusinessKey    string `json:"business_key"`
	OrderID        int    `json:"order_id"`
	RedemptionID   int    `json:"redemption_id"`
	OperatorUserID int    `json:"operator_user_id"`
	Remark         string `json:"remark"`
	CreatedAt      int64  `json:"created_at"`
}

func ListAgentOrders(agentUserID int, query AgentOrderQuery) ([]AgentOrderRecord, int64, error) {
	if !operation_setting.GetAgentSetting().Enabled {
		return nil, 0, ErrAgentFeatureDisabled
	}
	if _, err := getAgentQueryAccount(agentUserID); err != nil {
		return nil, 0, err
	}
	query.AgentUserID = agentUserID
	return ListAdminAgentOrders(query)
}

func ListAdminAgentOrders(query AgentOrderQuery) ([]AgentOrderRecord, int64, error) {
	limit, err := validateAgentQueryPage(query.Offset, query.Limit)
	if err != nil || query.AgentUserID < 0 || query.PlanID < 0 || query.StartTimestamp < 0 || query.EndTimestamp < 0 ||
		(query.EndTimestamp != 0 && query.EndTimestamp < query.StartTimestamp) || !validAgentOrderStatus(query.Status) {
		return nil, 0, ErrAgentQueryInvalid
	}

	dbQuery := model.DB.Model(&model.AgentPurchaseOrder{})
	if query.AgentUserID > 0 {
		dbQuery = dbQuery.Where("agent_user_id = ?", query.AgentUserID)
	}
	if query.PlanID > 0 {
		dbQuery = dbQuery.Where("plan_id = ?", query.PlanID)
	}
	if query.Status != "" {
		dbQuery = dbQuery.Where("status = ?", query.Status)
	}
	if query.StartTimestamp > 0 {
		dbQuery = dbQuery.Where("created_at >= ?", query.StartTimestamp)
	}
	if query.EndTimestamp > 0 {
		dbQuery = dbQuery.Where("created_at <= ?", query.EndTimestamp)
	}

	var total int64
	if err := dbQuery.Count(&total).Error; err != nil {
		return nil, 0, err
	}
	var orders []model.AgentPurchaseOrder
	if err := dbQuery.Order("id DESC").Offset(query.Offset).Limit(limit).Find(&orders).Error; err != nil {
		return nil, 0, err
	}
	records := make([]AgentOrderRecord, 0, len(orders))
	for _, order := range orders {
		records = append(records, AgentOrderRecord{
			ID: order.Id, OrderNo: order.OrderNo, AgentUserID: order.AgentUserId,
			PlanID: order.PlanId, PlanTitle: order.PlanTitle, Quantity: order.Quantity,
			UnitPrice: FormatAgentPoints(order.UnitPrice), TotalPrice: FormatAgentPoints(order.TotalPrice),
			CodeValidDays: order.CodeValidDays, RefundFeeBps: order.RefundFeeBps,
			RefundedCount: order.RefundedCount, RefundedAmount: FormatAgentPoints(order.RefundedAmount),
			Status: order.Status, CreatedAt: order.CreatedAt, UpdatedAt: order.UpdatedAt,
		})
	}
	return records, total, nil
}

func ListAgentCodes(agentUserID int, query AgentCodeQuery) ([]AgentCodeRecord, int64, error) {
	if !operation_setting.GetAgentSetting().Enabled {
		return nil, 0, ErrAgentFeatureDisabled
	}
	account, err := getAgentQueryAccount(agentUserID)
	if err != nil {
		return nil, 0, err
	}
	query.AgentUserID = agentUserID
	records, total, err := ListAdminAgentCodes(query)
	if err != nil {
		return nil, 0, err
	}
	if account.Status != model.AgentAccountStatusActive {
		for index := range records {
			if records[index].Status == AgentCodeStatusUnused {
				records[index].Code = ""
				records[index].CodeVisible = false
			}
		}
	}
	return records, total, nil
}

func ListAdminAgentCodes(query AgentCodeQuery) ([]AgentCodeRecord, int64, error) {
	limit, err := validateAgentQueryPage(query.Offset, query.Limit)
	if err != nil {
		return nil, 0, err
	}
	now, err := validateAgentCodeQuery(&query)
	if err != nil {
		return nil, 0, err
	}
	dbQuery := buildAgentCodeQuery(query, now)
	var total int64
	if err := dbQuery.Count(&total).Error; err != nil {
		return nil, 0, err
	}
	rows, err := scanAgentCodeRows(dbQuery.Order("redemptions.id DESC").Offset(query.Offset).Limit(limit))
	if err != nil {
		return nil, 0, err
	}
	return mapAgentCodeRecords(rows, now), total, nil
}

func ListAgentCreditLogs(agentUserID int, query AgentCreditLogQuery) ([]AgentCreditLogRecord, int64, error) {
	if !operation_setting.GetAgentSetting().Enabled {
		return nil, 0, ErrAgentFeatureDisabled
	}
	if _, err := getAgentQueryAccount(agentUserID); err != nil {
		return nil, 0, err
	}
	query.AgentUserID = agentUserID
	return listAgentCreditLogRecords(query)
}

func listAgentCreditLogRecords(query AgentCreditLogQuery) ([]AgentCreditLogRecord, int64, error) {
	limit, err := validateAgentQueryPage(query.Offset, query.Limit)
	if err != nil || query.AgentUserID <= 0 || query.StartTimestamp < 0 || query.EndTimestamp < 0 ||
		(query.EndTimestamp != 0 && query.EndTimestamp < query.StartTimestamp) || !validAgentCreditEvent(query.EventType) {
		return nil, 0, ErrAgentQueryInvalid
	}
	dbQuery := model.DB.Model(&model.AgentCreditLog{}).Where("agent_user_id = ?", query.AgentUserID)
	if query.EventType != "" {
		dbQuery = dbQuery.Where("event_type = ?", query.EventType)
	}
	if query.StartTimestamp > 0 {
		dbQuery = dbQuery.Where("created_at >= ?", query.StartTimestamp)
	}
	if query.EndTimestamp > 0 {
		dbQuery = dbQuery.Where("created_at <= ?", query.EndTimestamp)
	}
	var total int64
	if err := dbQuery.Count(&total).Error; err != nil {
		return nil, 0, err
	}
	var logs []model.AgentCreditLog
	if err := dbQuery.Order("id DESC").Offset(query.Offset).Limit(limit).Find(&logs).Error; err != nil {
		return nil, 0, err
	}
	records := make([]AgentCreditLogRecord, 0, len(logs))
	for _, log := range logs {
		records = append(records, AgentCreditLogRecord{
			ID: log.Id, AgentUserID: log.AgentUserId, Delta: FormatAgentPoints(log.Delta),
			BalanceBefore: FormatAgentPoints(log.BalanceBefore), BalanceAfter: FormatAgentPoints(log.BalanceAfter),
			EventType: log.EventType, BusinessKey: log.BusinessKey, OrderID: log.OrderId,
			RedemptionID: log.RedemptionId, OperatorUserID: log.OperatorUserId,
			Remark: log.Remark, CreatedAt: log.CreatedAt,
		})
	}
	return records, total, nil
}

// ExportAgentCodes writes an ownership-scoped CSV. It loads at most one row
// beyond the limit and finishes validation before writing, so database and
// maximum-row failures never return a partial code inventory.
func ExportAgentCodes(writer io.Writer, query AgentCodeQuery) error {
	if !operation_setting.GetAgentSetting().Enabled {
		return ErrAgentFeatureDisabled
	}
	if writer == nil || query.AgentUserID <= 0 {
		return ErrAgentQueryInvalid
	}
	account, err := getAgentQueryAccount(query.AgentUserID)
	if err != nil {
		return err
	}
	if account.Status != model.AgentAccountStatusActive {
		return ErrAgentAccountDisabled
	}
	query.Offset = 0
	query.Limit = AgentCodeExportMaxRows
	now, err := validateAgentCodeQuery(&query)
	if err != nil {
		return err
	}
	dbQuery := buildAgentCodeQuery(query, now)
	rows, err := loadAgentCodeExportRows(dbQuery.Order("redemptions.id DESC").Limit(AgentCodeExportMaxRows + 1))
	if err != nil {
		return err
	}
	if len(rows) > AgentCodeExportMaxRows {
		return ErrAgentExportLimitExceeded
	}

	csvWriter := csv.NewWriter(writer)
	if err := csvWriter.Write([]string{"code", "plan", "order_no", "status", "created_at", "expired_at", "redeemed_at"}); err != nil {
		return err
	}
	for _, row := range rows {
		record := mapAgentCodeRecord(row, now)
		values := []string{
			record.Code,
			record.PlanTitle,
			record.OrderNo,
			record.Status,
			formatAgentExportTime(record.CreatedAt),
			formatAgentExportTime(record.ExpiredAt),
			formatAgentExportTime(record.RedeemedAt),
		}
		for index := range values {
			values[index] = escapeAgentCSVFormula(values[index])
		}
		if err := csvWriter.Write(values); err != nil {
			return err
		}
	}
	csvWriter.Flush()
	return csvWriter.Error()
}

type agentCodeRow struct {
	ID          int
	Code        string
	RawStatus   int
	AgentUserID int
	OrderID     int
	OrderNo     string
	PlanID      int
	PlanTitle   string
	UsedUserID  int
	CreatedAt   int64
	ExpiredAt   int64
	RedeemedAt  int64
}

var agentCodeSelectColumns = []string{
	"redemptions.id AS id",
	"redemptions.key AS code",
	"redemptions.status AS raw_status",
	"redemptions.agent_user_id AS agent_user_id",
	"redemptions.agent_order_id AS order_id",
	"agent_purchase_orders.order_no AS order_no",
	"redemptions.subscription_plan_id AS plan_id",
	"agent_purchase_orders.plan_title AS plan_title",
	"redemptions.used_user_id AS used_user_id",
	"redemptions.created_time AS created_at",
	"redemptions.expired_time AS expired_at",
	"redemptions.redeemed_time AS redeemed_at",
}

var loadAgentCodeExportRows = func(dbQuery *gorm.DB) ([]agentCodeRow, error) {
	return scanAgentCodeRows(dbQuery)
}

func buildAgentCodeQuery(query AgentCodeQuery, now int64) *gorm.DB {
	dbQuery := model.DB.Model(&model.Redemption{}).
		Joins("LEFT JOIN agent_purchase_orders ON agent_purchase_orders.id = redemptions.agent_order_id").
		Where("redemptions.type = ?", common.RedemptionCodeTypeSubscription)
	if query.AgentUserID > 0 {
		dbQuery = dbQuery.Where("redemptions.agent_user_id = ?", query.AgentUserID)
	}
	if query.PlanID > 0 {
		dbQuery = dbQuery.Where("redemptions.subscription_plan_id = ?", query.PlanID)
	}
	if query.OrderID > 0 {
		dbQuery = dbQuery.Where("redemptions.agent_order_id = ?", query.OrderID)
	}
	if query.StartTimestamp > 0 {
		dbQuery = dbQuery.Where("redemptions.created_time >= ?", query.StartTimestamp)
	}
	if query.EndTimestamp > 0 {
		dbQuery = dbQuery.Where("redemptions.created_time <= ?", query.EndTimestamp)
	}
	switch query.Status {
	case AgentCodeStatusUnused:
		dbQuery = dbQuery.Where("redemptions.status = ? AND (redemptions.expired_time = 0 OR redemptions.expired_time > ?)", common.RedemptionCodeStatusEnabled, now)
	case AgentCodeStatusExpired:
		dbQuery = dbQuery.Where("redemptions.status = ? AND redemptions.expired_time != 0 AND redemptions.expired_time <= ?", common.RedemptionCodeStatusEnabled, now)
	case AgentCodeStatusUsed:
		dbQuery = dbQuery.Where("redemptions.status = ?", common.RedemptionCodeStatusUsed)
	case AgentCodeStatusRefunded:
		dbQuery = dbQuery.Where("redemptions.status = ?", common.RedemptionCodeStatusRefunded)
	}
	return dbQuery
}

func scanAgentCodeRows(dbQuery *gorm.DB) ([]agentCodeRow, error) {
	var rows []agentCodeRow
	err := dbQuery.Select(strings.Join(agentCodeSelectColumns, ", ")).Scan(&rows).Error
	return rows, err
}

func mapAgentCodeRecords(rows []agentCodeRow, now int64) []AgentCodeRecord {
	records := make([]AgentCodeRecord, 0, len(rows))
	for _, row := range rows {
		records = append(records, mapAgentCodeRecord(row, now))
	}
	return records
}

func mapAgentCodeRecord(row agentCodeRow, now int64) AgentCodeRecord {
	status := AgentCodeStatusUnused
	switch {
	case row.RawStatus == common.RedemptionCodeStatusRefunded:
		status = AgentCodeStatusRefunded
	case row.RawStatus == common.RedemptionCodeStatusUsed:
		status = AgentCodeStatusUsed
	case row.RawStatus == common.RedemptionCodeStatusEnabled && row.ExpiredAt != 0 && row.ExpiredAt <= now:
		status = AgentCodeStatusExpired
	}
	return AgentCodeRecord{
		ID: row.ID, Code: row.Code, AgentUserID: row.AgentUserID,
		OrderID: row.OrderID, OrderNo: row.OrderNo, PlanID: row.PlanID,
		PlanTitle: row.PlanTitle, Status: status, CodeVisible: true, UsedUserID: row.UsedUserID,
		CreatedAt: row.CreatedAt, ExpiredAt: row.ExpiredAt, RedeemedAt: row.RedeemedAt,
	}
}

func validateAgentCodeQuery(query *AgentCodeQuery) (int64, error) {
	if query.AgentUserID < 0 || query.PlanID < 0 || query.OrderID < 0 || query.StartTimestamp < 0 || query.EndTimestamp < 0 || query.Now < 0 ||
		(query.EndTimestamp != 0 && query.EndTimestamp < query.StartTimestamp) || !validAgentCodeStatus(query.Status) {
		return 0, ErrAgentQueryInvalid
	}
	if query.Now == 0 {
		query.Now = time.Now().Unix()
	}
	return query.Now, nil
}

func validateAgentQueryPage(offset int, limit int) (int, error) {
	if offset < 0 {
		return 0, ErrAgentQueryInvalid
	}
	if limit == 0 {
		return agentQueryDefaultLimit, nil
	}
	if limit < 0 {
		return 0, ErrAgentQueryInvalid
	}
	if limit > agentQueryMaxLimit {
		return agentQueryMaxLimit, nil
	}
	return limit, nil
}

func getAgentQueryAccount(agentUserID int) (*model.AgentAccount, error) {
	if agentUserID <= 0 {
		return nil, ErrAgentAccountNotFound
	}
	var account model.AgentAccount
	if err := model.DB.Select("status").Where("user_id = ?", agentUserID).First(&account).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrAgentAccountNotFound
		}
		return nil, err
	}
	return &account, nil
}

func validAgentOrderStatus(status string) bool {
	switch status {
	case "", model.AgentPurchaseOrderStatusCompleted, model.AgentPurchaseOrderStatusPartiallyRefunded, model.AgentPurchaseOrderStatusRefunded:
		return true
	default:
		return false
	}
}

func validAgentCodeStatus(status string) bool {
	switch status {
	case "", AgentCodeStatusUnused, AgentCodeStatusUsed, AgentCodeStatusRefunded, AgentCodeStatusExpired:
		return true
	default:
		return false
	}
}

func validAgentCreditEvent(eventType string) bool {
	switch eventType {
	case "", model.AgentCreditEventAdminCredit, model.AgentCreditEventAdminDebit, model.AgentCreditEventPurchase, model.AgentCreditEventRefund:
		return true
	default:
		return false
	}
}

func escapeAgentCSVFormula(value string) string {
	if value == "" {
		return value
	}
	switch value[0] {
	case '=', '+', '-', '@':
		return "'" + value
	default:
		return value
	}
}

func formatAgentExportTime(timestamp int64) string {
	if timestamp == 0 {
		return ""
	}
	return time.Unix(timestamp, 0).UTC().Format(time.RFC3339)
}
