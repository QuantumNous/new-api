package model

import (
	"errors"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/bytedance/gopkg/util/gopool"
	"gorm.io/gorm"
)

const (
	QuotaSourcePaid          = "paid"
	QuotaSourceGift          = "gift"
	QuotaSourceTrial         = "trial"
	QuotaSourceLegacyUnknown = "legacy_unknown"

	QuotaSourceEventCredit = "credit"
	QuotaSourceEventDebit  = "debit"
	QuotaSourceEventRefund = "refund"
)

type UserQuotaSourceBalance struct {
	Id        int    `json:"id" gorm:"primaryKey"`
	UserId    int    `json:"user_id" gorm:"type:int;not null;index;uniqueIndex:idx_user_quota_source_balance,priority:1"`
	Source    string `json:"source" gorm:"type:varchar(32);not null;index;uniqueIndex:idx_user_quota_source_balance,priority:2"`
	Balance   int64  `json:"balance" gorm:"bigint;not null;default:0"`
	CreatedAt int64  `json:"created_at" gorm:"autoCreateTime;column:created_at;index"`
	UpdatedAt int64  `json:"updated_at" gorm:"autoUpdateTime;column:updated_at;index"`
}

func (UserQuotaSourceBalance) TableName() string {
	return "user_quota_source_balances"
}

type UserQuotaSourceEvent struct {
	Id           int    `json:"id" gorm:"primaryKey"`
	UserId       int    `json:"user_id" gorm:"type:int;not null;index"`
	Source       string `json:"source" gorm:"type:varchar(32);not null;index"`
	EventType    string `json:"event_type" gorm:"type:varchar(32);not null;index"`
	Amount       int64  `json:"amount" gorm:"bigint;not null"`
	BalanceAfter int64  `json:"balance_after" gorm:"bigint;not null;default:0"`
	SourceLogId  int    `json:"source_log_id" gorm:"type:int;not null;default:0;index"`
	RelatedType  string `json:"related_type" gorm:"type:varchar(64);not null;default:'';index:idx_quota_source_related,priority:1"`
	RelatedId    string `json:"related_id" gorm:"type:varchar(128);not null;default:'';index:idx_quota_source_related,priority:2"`
	RequestId    string `json:"request_id" gorm:"type:varchar(128);not null;default:'';index"`
	Remark       string `json:"remark" gorm:"type:varchar(255);not null;default:''"`
	CreatedAt    int64  `json:"created_at" gorm:"autoCreateTime;column:created_at;index"`
}

func (UserQuotaSourceEvent) TableName() string {
	return "user_quota_source_events"
}

type UserQuotaSourceSegment struct {
	Source string `json:"source"`
	Amount int64  `json:"amount"`
}

type UserQuotaSourceBreakdown struct {
	Paid          int64 `json:"paid"`
	Gift          int64 `json:"gift"`
	Trial         int64 `json:"trial"`
	LegacyUnknown int64 `json:"legacy_unknown"`
	Total         int64 `json:"total"`
}

func QuotaSourceSidecarModels() []interface{} {
	return []interface{}{
		&UserQuotaSourceBalance{},
		&UserQuotaSourceEvent{},
	}
}

func QuotaSourceSidecarTableNames() []string {
	models := QuotaSourceSidecarModels()
	names := make([]string, 0, len(models))
	for _, model := range models {
		if namer, ok := model.(affiliateTableNamer); ok {
			names = append(names, namer.TableName())
		}
	}
	return names
}

func SumQuotaSourceSegments(segments []UserQuotaSourceSegment) UserQuotaSourceBreakdown {
	breakdown := UserQuotaSourceBreakdown{}
	for _, segment := range segments {
		if segment.Amount <= 0 {
			continue
		}
		breakdown.Total += segment.Amount
		switch normalizeQuotaSource(segment.Source) {
		case QuotaSourcePaid:
			breakdown.Paid += segment.Amount
		case QuotaSourceGift:
			breakdown.Gift += segment.Amount
		case QuotaSourceTrial:
			breakdown.Trial += segment.Amount
		default:
			breakdown.LegacyUnknown += segment.Amount
		}
	}
	return breakdown
}

func IncreaseUserQuotaWithSource(id int, quota int, source string, relatedType string, relatedId string, requestId string, remark string) error {
	if quota < 0 {
		return errors.New("quota 不能为负数！")
	}
	if quota == 0 {
		return nil
	}
	source = normalizeQuotaSource(source)
	if source == "" {
		return errors.New("quota source is required")
	}
	if err := DB.Transaction(func(tx *gorm.DB) error {
		if err := tx.Model(&User{}).Where("id = ?", id).Update("quota", gorm.Expr("quota + ?", quota)).Error; err != nil {
			return err
		}
		return CreditUserQuotaSourceTx(tx, id, source, quota, relatedType, relatedId, requestId, remark)
	}); err != nil {
		return err
	}
	gopool.Go(func() {
		if err := cacheIncrUserQuota(id, int64(quota)); err != nil {
			common.SysLog("failed to increase user quota cache: " + err.Error())
		}
	})
	return nil
}

func DecreaseUserQuotaWithSource(id int, quota int, relatedType string, relatedId string, requestId string, remark string) ([]UserQuotaSourceSegment, error) {
	if quota < 0 {
		return nil, errors.New("quota 不能为负数！")
	}
	if quota == 0 {
		return nil, nil
	}
	var segments []UserQuotaSourceSegment
	if err := DB.Transaction(func(tx *gorm.DB) error {
		var user User
		if err := tx.Set("gorm:query_option", "FOR UPDATE").Select("id", "quota").Where("id = ?", id).First(&user).Error; err != nil {
			return err
		}
		var err error
		segments, err = consumeUserQuotaSourcesTx(tx, id, quota, user.Quota, relatedType, relatedId, requestId, remark)
		if err != nil {
			return err
		}
		return tx.Model(&User{}).Where("id = ?", id).Update("quota", gorm.Expr("quota - ?", quota)).Error
	}); err != nil {
		return nil, err
	}
	gopool.Go(func() {
		if err := cacheDecrUserQuota(id, int64(quota)); err != nil {
			common.SysLog("failed to decrease user quota cache: " + err.Error())
		}
	})
	return segments, nil
}

func IncreaseUserQuotaFromSourceSegments(id int, segments []UserQuotaSourceSegment, relatedType string, relatedId string, requestId string, remark string) error {
	total := SumQuotaSourceSegments(segments).Total
	if total <= 0 {
		return nil
	}
	if err := DB.Transaction(func(tx *gorm.DB) error {
		if err := tx.Model(&User{}).Where("id = ?", id).Update("quota", gorm.Expr("quota + ?", total)).Error; err != nil {
			return err
		}
		for _, segment := range compactQuotaSourceSegments(segments) {
			if segment.Amount <= 0 {
				continue
			}
			if err := creditUserQuotaSourceTx(tx, id, normalizeQuotaSource(segment.Source), segment.Amount, QuotaSourceEventRefund, relatedType, relatedId, requestId, remark); err != nil {
				return err
			}
		}
		return nil
	}); err != nil {
		return err
	}
	gopool.Go(func() {
		if err := cacheIncrUserQuota(id, total); err != nil {
			common.SysLog("failed to refund user quota cache: " + err.Error())
		}
	})
	return nil
}

func CreditUserQuotaSource(userId int, source string, amount int, relatedType string, relatedId string, requestId string, remark string) error {
	if amount <= 0 {
		return nil
	}
	return DB.Transaction(func(tx *gorm.DB) error {
		return CreditUserQuotaSourceTx(tx, userId, source, amount, relatedType, relatedId, requestId, remark)
	})
}

func CreditUserQuotaSourceTx(tx *gorm.DB, userId int, source string, amount int, relatedType string, relatedId string, requestId string, remark string) error {
	return creditUserQuotaSourceTx(tx, userId, normalizeQuotaSource(source), int64(amount), QuotaSourceEventCredit, relatedType, relatedId, requestId, remark)
}

func creditUserQuotaSourceTx(tx *gorm.DB, userId int, source string, amount int64, eventType string, relatedType string, relatedId string, requestId string, remark string) error {
	if amount <= 0 {
		return nil
	}
	if source == "" {
		return errors.New("quota source is required")
	}
	balance, err := findOrCreateQuotaSourceBalanceTx(tx, userId, source)
	if err != nil {
		return err
	}
	balance.Balance += amount
	if err := tx.Model(&UserQuotaSourceBalance{}).Where("id = ?", balance.Id).Updates(map[string]interface{}{
		"balance":    balance.Balance,
		"updated_at": common.GetTimestamp(),
	}).Error; err != nil {
		return err
	}
	return tx.Create(&UserQuotaSourceEvent{
		UserId:       userId,
		Source:       source,
		EventType:    eventType,
		Amount:       amount,
		BalanceAfter: balance.Balance,
		RelatedType:  strings.TrimSpace(relatedType),
		RelatedId:    strings.TrimSpace(relatedId),
		RequestId:    strings.TrimSpace(requestId),
		Remark:       strings.TrimSpace(remark),
	}).Error
}

func consumeUserQuotaSourcesTx(tx *gorm.DB, userId int, amount int, currentUserQuota int, relatedType string, relatedId string, requestId string, remark string) ([]UserQuotaSourceSegment, error) {
	if amount <= 0 {
		return nil, nil
	}
	balances, err := quotaSourceBalancesBySourceTx(tx, userId)
	if err != nil {
		return nil, err
	}
	var tracked int64
	for _, balance := range balances {
		if balance.Balance > 0 {
			tracked += balance.Balance
		}
	}
	untrackedLegacy := int64(currentUserQuota) - tracked
	if untrackedLegacy < 0 {
		untrackedLegacy = 0
	}

	remaining := int64(amount)
	segments := make([]UserQuotaSourceSegment, 0, 4)
	for _, source := range []string{QuotaSourceLegacyUnknown, QuotaSourceTrial, QuotaSourceGift, QuotaSourcePaid} {
		if remaining <= 0 {
			break
		}
		var available int64
		if balance, ok := balances[source]; ok {
			available += balance.Balance
		}
		if source == QuotaSourceLegacyUnknown {
			available += untrackedLegacy
		}
		if available <= 0 {
			continue
		}
		take := available
		if take > remaining {
			take = remaining
		}
		if err := debitQuotaSourceTx(tx, balances, userId, source, take, relatedType, relatedId, requestId, remark); err != nil {
			return nil, err
		}
		segments = append(segments, UserQuotaSourceSegment{Source: source, Amount: take})
		remaining -= take
	}
	if remaining > 0 {
		uncoveredRemark := strings.TrimSpace(remark)
		if uncoveredRemark != "" {
			uncoveredRemark += "; "
		}
		uncoveredRemark += "uncovered by source balances"
		if err := tx.Create(&UserQuotaSourceEvent{
			UserId:      userId,
			Source:      QuotaSourceLegacyUnknown,
			EventType:   QuotaSourceEventDebit,
			Amount:      remaining,
			RelatedType: strings.TrimSpace(relatedType),
			RelatedId:   strings.TrimSpace(relatedId),
			RequestId:   strings.TrimSpace(requestId),
			Remark:      uncoveredRemark,
		}).Error; err != nil {
			return nil, err
		}
		segments = append(segments, UserQuotaSourceSegment{Source: QuotaSourceLegacyUnknown, Amount: remaining})
	}
	return compactQuotaSourceSegments(segments), nil
}

func debitQuotaSourceTx(tx *gorm.DB, balances map[string]*UserQuotaSourceBalance, userId int, source string, amount int64, relatedType string, relatedId string, requestId string, remark string) error {
	if amount <= 0 {
		return nil
	}
	var balanceAfter int64
	if balance, ok := balances[source]; ok && balance.Balance > 0 {
		debitFromBalance := amount
		if debitFromBalance > balance.Balance {
			debitFromBalance = balance.Balance
		}
		balance.Balance -= debitFromBalance
		balanceAfter = balance.Balance
		if err := tx.Model(&UserQuotaSourceBalance{}).Where("id = ?", balance.Id).Updates(map[string]interface{}{
			"balance":    balance.Balance,
			"updated_at": common.GetTimestamp(),
		}).Error; err != nil {
			return err
		}
	}
	return tx.Create(&UserQuotaSourceEvent{
		UserId:       userId,
		Source:       source,
		EventType:    QuotaSourceEventDebit,
		Amount:       amount,
		BalanceAfter: balanceAfter,
		RelatedType:  strings.TrimSpace(relatedType),
		RelatedId:    strings.TrimSpace(relatedId),
		RequestId:    strings.TrimSpace(requestId),
		Remark:       strings.TrimSpace(remark),
	}).Error
}

func quotaSourceBalancesBySourceTx(tx *gorm.DB, userId int) (map[string]*UserQuotaSourceBalance, error) {
	var rows []UserQuotaSourceBalance
	if err := tx.Set("gorm:query_option", "FOR UPDATE").Where("user_id = ?", userId).Find(&rows).Error; err != nil {
		return nil, err
	}
	balances := make(map[string]*UserQuotaSourceBalance, len(rows))
	for i := range rows {
		rows[i].Source = normalizeQuotaSource(rows[i].Source)
		if rows[i].Source == "" {
			continue
		}
		balances[rows[i].Source] = &rows[i]
	}
	return balances, nil
}

func findOrCreateQuotaSourceBalanceTx(tx *gorm.DB, userId int, source string) (*UserQuotaSourceBalance, error) {
	var balance UserQuotaSourceBalance
	result := tx.Set("gorm:query_option", "FOR UPDATE").Where("user_id = ? AND source = ?", userId, source).Limit(1).Find(&balance)
	if result.Error != nil {
		return nil, result.Error
	}
	if result.RowsAffected > 0 {
		return &balance, nil
	}
	balance = UserQuotaSourceBalance{
		UserId:  userId,
		Source:  source,
		Balance: 0,
	}
	if err := tx.Create(&balance).Error; err != nil {
		return nil, err
	}
	return &balance, nil
}

func normalizeQuotaSource(source string) string {
	switch strings.TrimSpace(source) {
	case QuotaSourcePaid:
		return QuotaSourcePaid
	case QuotaSourceGift:
		return QuotaSourceGift
	case QuotaSourceTrial:
		return QuotaSourceTrial
	case QuotaSourceLegacyUnknown:
		return QuotaSourceLegacyUnknown
	default:
		return ""
	}
}

func compactQuotaSourceSegments(segments []UserQuotaSourceSegment) []UserQuotaSourceSegment {
	if len(segments) == 0 {
		return nil
	}
	ordered := make([]UserQuotaSourceSegment, 0, len(segments))
	indexBySource := map[string]int{}
	for _, segment := range segments {
		source := normalizeQuotaSource(segment.Source)
		if source == "" || segment.Amount <= 0 {
			continue
		}
		if idx, ok := indexBySource[source]; ok {
			ordered[idx].Amount += segment.Amount
			continue
		}
		indexBySource[source] = len(ordered)
		ordered = append(ordered, UserQuotaSourceSegment{Source: source, Amount: segment.Amount})
	}
	return ordered
}
