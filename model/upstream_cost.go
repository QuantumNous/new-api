package model

import (
	"errors"
	"fmt"
	"strconv"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/dto"

	"gorm.io/gorm/clause"
)

// UpstreamCostRecord is the canonical CNY cost ledger. Monetary accounting is
// stored as integer micro-yuan; native values remain decimal strings so the
// original upstream unit can be audited without floating-point round trips.
type UpstreamCostRecord struct {
	Id                 int64  `json:"id"`
	RequestId          string `json:"request_id" gorm:"type:varchar(64);uniqueIndex"`
	CreatedAt          int64  `json:"created_at" gorm:"bigint;index"`
	UserId             int    `json:"user_id" gorm:"index"`
	Username           string `json:"username" gorm:"type:varchar(191);index"`
	TokenName          string `json:"token_name" gorm:"type:varchar(191);index"`
	UseGroup           string `json:"group" gorm:"column:use_group;type:varchar(64);index"`
	ChannelId          int    `json:"channel_id" gorm:"index"`
	ModelName          string `json:"model_name" gorm:"type:varchar(191);index"`
	UpstreamRequestId  string `json:"upstream_request_id" gorm:"type:varchar(128);index"`
	Status             string `json:"status" gorm:"type:varchar(16);index"`
	Mode               string `json:"mode" gorm:"type:varchar(32)"`
	Source             string `json:"source" gorm:"type:varchar(32)"`
	Reason             string `json:"reason" gorm:"type:varchar(64)"`
	NativeUnit         string `json:"native_unit" gorm:"type:varchar(32)"`
	NativeAmount       string `json:"native_amount" gorm:"type:varchar(64)"`
	RateCNYPerUnit     string `json:"rate_cny_per_unit" gorm:"type:varchar(64)"`
	AmountCNYMicros    int64  `json:"amount_cny_micros" gorm:"bigint"`
	Estimated          bool   `json:"estimated"`
	PriceVersion       string `json:"price_version" gorm:"type:varchar(64)"`
	SettlementCurrency string `json:"settlement_currency" gorm:"type:varchar(8)"`
}

func upstreamCostSnapshotFromOther(other map[string]interface{}) (*dto.UpstreamCostSnapshot, bool) {
	if other == nil {
		return nil, false
	}
	adminInfo, ok := other["admin_info"].(map[string]interface{})
	if !ok || adminInfo == nil {
		return nil, false
	}
	value, ok := adminInfo["upstream_cost"]
	if !ok || value == nil {
		return nil, false
	}
	if snapshot, ok := value.(*dto.UpstreamCostSnapshot); ok && snapshot != nil {
		return snapshot, true
	}
	raw, err := common.Marshal(value)
	if err != nil {
		return nil, false
	}
	var snapshot dto.UpstreamCostSnapshot
	if err := common.Unmarshal(raw, &snapshot); err != nil {
		return nil, false
	}
	return &snapshot, true
}

// RecordUpstreamCostFromLog persists the admin-only snapshot attached to a
// consume log. The request ID is unique, making retries idempotent.
func RecordUpstreamCostFromLog(log *Log, other map[string]interface{}) error {
	if log == nil {
		return errors.New("log is required")
	}
	snapshot, ok := upstreamCostSnapshotFromOther(other)
	if !ok {
		return nil
	}
	if snapshot.Status != dto.UpstreamCostStatusSettled && snapshot.Status != dto.UpstreamCostStatusUnpriced {
		return fmt.Errorf("unsupported upstream cost status: %s", snapshot.Status)
	}
	ensureLogRequestId(log)
	record := &UpstreamCostRecord{
		RequestId:          log.RequestId,
		CreatedAt:          log.CreatedAt,
		UserId:             log.UserId,
		Username:           log.Username,
		TokenName:          log.TokenName,
		UseGroup:           log.Group,
		ChannelId:          log.ChannelId,
		ModelName:          log.ModelName,
		UpstreamRequestId:  log.UpstreamRequestId,
		Status:             snapshot.Status,
		Mode:               snapshot.Mode,
		Source:             snapshot.Source,
		Reason:             snapshot.Reason,
		NativeUnit:         snapshot.NativeUnit,
		NativeAmount:       snapshot.NativeAmountDecimal,
		RateCNYPerUnit:     snapshot.RateCNYPerUnitDecimal,
		AmountCNYMicros:    snapshot.AmountCNYMicros,
		Estimated:          snapshot.Estimated,
		PriceVersion:       snapshot.PriceVersion,
		SettlementCurrency: snapshot.SettlementCurrency,
	}
	if record.NativeAmount == "" {
		record.NativeAmount = strconv.FormatFloat(snapshot.NativeAmount, 'f', -1, 64)
	}
	if record.RateCNYPerUnit == "" {
		record.RateCNYPerUnit = strconv.FormatFloat(snapshot.RateCNYPerUnit, 'f', -1, 64)
	}
	return DB.Clauses(clause.OnConflict{
		Columns:   []clause.Column{{Name: "request_id"}},
		DoNothing: true,
	}).Create(record).Error
}

type UpstreamCostStat struct {
	SettledRequests   int64 `json:"settled_requests"`
	UnpricedRequests  int64 `json:"unpriced_requests"`
	EstimatedRequests int64 `json:"estimated_requests"`
	AmountCNYMicros   int64 `json:"amount_cny_micros"`
}

func GetUpstreamCostStat(
	startTimestamp, endTimestamp int64,
	modelName, username, tokenName, useGroup, requestId, upstreamRequestId string,
	channelId int,
) (UpstreamCostStat, error) {
	query := DB.Model(&UpstreamCostRecord{})
	if startTimestamp > 0 {
		query = query.Where("created_at >= ?", startTimestamp)
	}
	if endTimestamp > 0 {
		query = query.Where("created_at <= ?", endTimestamp)
	}
	if modelName != "" {
		query = query.Where("model_name = ?", modelName)
	}
	if username != "" {
		query = query.Where("username = ?", username)
	}
	if tokenName != "" {
		query = query.Where("token_name = ?", tokenName)
	}
	if useGroup != "" {
		query = query.Where("use_group = ?", useGroup)
	}
	if requestId != "" {
		query = query.Where("request_id = ?", requestId)
	}
	if upstreamRequestId != "" {
		query = query.Where("upstream_request_id = ?", upstreamRequestId)
	}
	if channelId > 0 {
		query = query.Where("channel_id = ?", channelId)
	}

	var stat UpstreamCostStat
	err := query.Select(
		"COALESCE(SUM(CASE WHEN status = ? THEN 1 ELSE 0 END), 0) AS settled_requests, "+
			"COALESCE(SUM(CASE WHEN status = ? THEN 1 ELSE 0 END), 0) AS unpriced_requests, "+
			"COALESCE(SUM(CASE WHEN status = ? AND source = ? THEN 1 ELSE 0 END), 0) AS estimated_requests, "+
			"COALESCE(SUM(amount_cny_micros), 0) AS amount_cny_micros",
		dto.UpstreamCostStatusSettled,
		dto.UpstreamCostStatusUnpriced,
		dto.UpstreamCostStatusSettled,
		dto.UpstreamCostSourceBillingUnits,
	).Scan(&stat).Error
	return stat, err
}
