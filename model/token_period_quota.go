package model

import (
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

const (
	TokenQuotaPeriodNone    = ""
	TokenQuotaPeriodDaily   = "daily"
	TokenQuotaPeriodMonthly = "monthly"
)

func NormalizeTokenQuotaPeriod(period string) string {
	normalized := strings.ToLower(strings.TrimSpace(period))
	if normalized == "none" {
		return TokenQuotaPeriodNone
	}
	return normalized
}

func ValidateTokenQuotaPeriodConfig(period string, limit int) error {
	normalized := NormalizeTokenQuotaPeriod(period)
	switch normalized {
	case TokenQuotaPeriodNone, TokenQuotaPeriodDaily, TokenQuotaPeriodMonthly:
	default:
		return errors.New("invalid token quota period")
	}

	if limit < 0 {
		return errors.New("token quota limit cannot be negative")
	}
	if normalized != TokenQuotaPeriodNone && limit <= 0 {
		return errors.New("token quota limit must be greater than zero when quota period is enabled")
	}
	return nil
}

func currentTokenQuotaWindowStart(period string, now time.Time) time.Time {
	localNow := now.In(time.Local)
	switch NormalizeTokenQuotaPeriod(period) {
	case TokenQuotaPeriodDaily:
		return time.Date(localNow.Year(), localNow.Month(), localNow.Day(), 0, 0, 0, 0, time.Local)
	case TokenQuotaPeriodMonthly:
		return time.Date(localNow.Year(), localNow.Month(), 1, 0, 0, 0, 0, time.Local)
	default:
		return time.Time{}
	}
}

func nextTokenQuotaWindowStart(period string, windowStart time.Time) time.Time {
	switch NormalizeTokenQuotaPeriod(period) {
	case TokenQuotaPeriodDaily:
		return windowStart.AddDate(0, 0, 1)
	case TokenQuotaPeriodMonthly:
		return windowStart.AddDate(0, 1, 0)
	default:
		return time.Time{}
	}
}

func (token *Token) IsPeriodQuotaEnabled() bool {
	period := NormalizeTokenQuotaPeriod(token.QuotaPeriod)
	return (period == TokenQuotaPeriodDaily || period == TokenQuotaPeriodMonthly) && token.QuotaLimit > 0
}

func (token *Token) ResetPeriodQuotaWindow(now time.Time) {
	if !token.IsPeriodQuotaEnabled() {
		token.QuotaUsedInPeriod = 0
		token.QuotaLastResetTime = 0
		token.QuotaNextResetTime = 0
		return
	}

	windowStart := currentTokenQuotaWindowStart(token.QuotaPeriod, now)
	nextReset := nextTokenQuotaWindowStart(token.QuotaPeriod, windowStart)
	token.QuotaUsedInPeriod = 0
	token.QuotaLastResetTime = windowStart.Unix()
	token.QuotaNextResetTime = nextReset.Unix()
}

func (token *Token) RefreshPeriodQuotaWindow(now time.Time) bool {
	if !token.IsPeriodQuotaEnabled() {
		token.QuotaUsedInPeriod = 0
		token.QuotaLastResetTime = 0
		token.QuotaNextResetTime = 0
		return false
	}

	if token.QuotaLastResetTime == 0 || token.QuotaNextResetTime == 0 || token.QuotaNextResetTime <= token.QuotaLastResetTime {
		token.ResetPeriodQuotaWindow(now)
		return true
	}

	if now.Unix() >= token.QuotaNextResetTime {
		token.ResetPeriodQuotaWindow(now)
		return true
	}

	return false
}

func (token *Token) ApplyPeriodQuotaConfig(period string, limit int, resetWindow bool, now time.Time) error {
	if err := ValidateTokenQuotaPeriodConfig(period, limit); err != nil {
		return err
	}

	token.QuotaPeriod = NormalizeTokenQuotaPeriod(period)
	token.QuotaLimit = limit
	if !token.IsPeriodQuotaEnabled() {
		token.QuotaPeriod = TokenQuotaPeriodNone
		token.QuotaLimit = 0
		token.QuotaUsedInPeriod = 0
		token.QuotaLastResetTime = 0
		token.QuotaNextResetTime = 0
		return nil
	}

	if resetWindow {
		token.ResetPeriodQuotaWindow(now)
		return nil
	}

	if token.QuotaUsedInPeriod < 0 {
		token.QuotaUsedInPeriod = 0
	}
	token.RefreshPeriodQuotaWindow(now)
	return nil
}

func (token *Token) PeriodQuotaExceededError() error {
	if !token.IsPeriodQuotaEnabled() {
		return nil
	}

	nextReset := "unknown"
	if token.QuotaNextResetTime > 0 {
		nextReset = time.Unix(token.QuotaNextResetTime, 0).In(time.Local).Format(time.RFC3339)
	}

	switch NormalizeTokenQuotaPeriod(token.QuotaPeriod) {
	case TokenQuotaPeriodDaily:
		return fmt.Errorf("token daily quota reached, next reset at %s", nextReset)
	case TokenQuotaPeriodMonthly:
		return fmt.Errorf("token monthly quota reached, next reset at %s", nextReset)
	default:
		return fmt.Errorf("token period quota reached, next reset at %s", nextReset)
	}
}

func (token *Token) persistPeriodQuotaState() error {
	if token == nil || token.Id == 0 {
		return nil
	}

	if err := DB.Model(&Token{}).Where("id = ?", token.Id).Select(
		"quota_period",
		"quota_limit",
		"quota_used_in_period",
		"quota_last_reset_time",
		"quota_next_reset_time",
	).Updates(token).Error; err != nil {
		return err
	}

	if common.RedisEnabled && token.Key != "" {
		if err := cacheDeleteToken(token.Key); err != nil {
			common.SysLog("failed to invalidate token cache: " + err.Error())
		}
	}
	return nil
}

func (token *Token) RefreshPeriodQuotaWindowIfNeeded() error {
	if token == nil || !token.IsPeriodQuotaEnabled() {
		return nil
	}
	if !token.RefreshPeriodQuotaWindow(time.Now()) {
		return nil
	}
	return token.persistPeriodQuotaState()
}

func adjustTokenQuotaWithPeriod(id int, key string, delta int) error {
	if id == 0 || delta == 0 {
		return nil
	}

	now := time.Now()
	accessedAt := common.GetTimestamp()
	tx := DB.Begin()
	if tx.Error != nil {
		return tx.Error
	}

	var token Token
	err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).Where("id = ?", id).First(&token).Error
	if err != nil {
		tx.Rollback()
		return err
	}

	token.QuotaPeriod = NormalizeTokenQuotaPeriod(token.QuotaPeriod)
	token.RefreshPeriodQuotaWindow(now)

	if delta > 0 && !token.UnlimitedQuota && token.RemainQuota < delta {
		tx.Rollback()
		return fmt.Errorf("token quota is not enough, token remain quota: %d, need quota: %d", token.RemainQuota, delta)
	}

	newPeriodUsed := token.QuotaUsedInPeriod
	if token.IsPeriodQuotaEnabled() {
		newPeriodUsed += delta
		if delta > 0 && newPeriodUsed > token.QuotaLimit {
			tx.Rollback()
			return token.PeriodQuotaExceededError()
		}
		if newPeriodUsed < 0 {
			newPeriodUsed = 0
		}
	}

	updates := map[string]interface{}{
		"remain_quota":  gorm.Expr("remain_quota - ?", delta),
		"used_quota":    gorm.Expr("used_quota + ?", delta),
		"accessed_time": accessedAt,
	}
	if token.IsPeriodQuotaEnabled() {
		updates["quota_period"] = token.QuotaPeriod
		updates["quota_limit"] = token.QuotaLimit
		updates["quota_used_in_period"] = newPeriodUsed
		updates["quota_last_reset_time"] = token.QuotaLastResetTime
		updates["quota_next_reset_time"] = token.QuotaNextResetTime
	}

	if err := tx.Model(&Token{}).Where("id = ?", id).Updates(updates).Error; err != nil {
		tx.Rollback()
		return err
	}
	if err := tx.Commit().Error; err != nil {
		return err
	}

	if common.RedisEnabled {
		cacheKey := key
		if cacheKey == "" {
			cacheKey = token.Key
		}
		if cacheKey != "" {
			if err := cacheDeleteToken(cacheKey); err != nil {
				common.SysLog("failed to invalidate token cache: " + err.Error())
			}
		}
	}

	return nil
}
