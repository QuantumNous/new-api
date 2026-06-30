package model

import (
	"errors"
	"fmt"
	"time"

	"github.com/QuantumNous/new-api/common"
	"gorm.io/gorm"
)

type TokenQuotaPeriodMode string
type TokenQuotaExhaustedAction string
type TokenQuotaBoundaryMode string

const (
	TokenQuotaPeriodPreset5h TokenQuotaPeriodMode = "preset_5h"
	TokenQuotaPeriodDaily    TokenQuotaPeriodMode = "daily"
	TokenQuotaPeriodWeekly   TokenQuotaPeriodMode = "weekly"
	TokenQuotaPeriodMonthly  TokenQuotaPeriodMode = "monthly"
	TokenQuotaPeriodCustom   TokenQuotaPeriodMode = "custom"

	TokenQuotaExhaustRejectOnly   TokenQuotaExhaustedAction = "reject_only"
	TokenQuotaExhaustDisableToken TokenQuotaExhaustedAction = "disable_token"

	TokenQuotaBoundaryGraceful TokenQuotaBoundaryMode = "graceful_boundary"
	TokenQuotaBoundaryStrict   TokenQuotaBoundaryMode = "strict_pre_check"

	TokenQuotaCustomMinMinutes = 10
	TokenQuotaCustomMaxMinutes = 365 * 24 * 60
)

var (
	ErrTokenQuotaPolicyInvalidPeriod        = errors.New("token quota policy period is invalid")
	ErrTokenQuotaPolicyInvalidCustomMinutes = errors.New("token quota policy custom minutes is invalid")
	ErrTokenQuotaPolicyInvalidQuota         = errors.New("token quota policy quota is invalid")
	ErrTokenQuotaPolicyInvalidAnchor        = errors.New("token quota policy anchor time is invalid")
	ErrTokenQuotaPolicyInvalidAction        = errors.New("token quota policy exhausted action is invalid")
	ErrTokenQuotaPolicyInvalidBoundary      = errors.New("token quota policy boundary mode is invalid")
	ErrTokenQuotaPolicyNotFound             = errors.New("token quota policy not found")
	ErrTokenQuotaPolicyExhausted            = errors.New("token quota policy exhausted")
)

type TokenQuotaPolicy struct {
	Id                   int                       `json:"id"`
	TokenId              int                       `json:"token_id" gorm:"uniqueIndex"`
	UserId               int                       `json:"user_id" gorm:"index"`
	Enabled              bool                      `json:"enabled"`
	PeriodMode           TokenQuotaPeriodMode      `json:"period_mode" gorm:"type:varchar(32)"`
	CustomMinutes        int                       `json:"custom_minutes"`
	Quota                int                       `json:"quota"`
	UsedQuota            int                       `json:"used_quota"`
	AnchorTime           int64                     `json:"anchor_time" gorm:"bigint"`
	PeriodStart          int64                     `json:"period_start" gorm:"bigint"`
	PeriodEnd            int64                     `json:"period_end" gorm:"bigint"`
	NextResetAt          int64                     `json:"next_reset_at" gorm:"bigint;index"`
	ExhaustedAction      TokenQuotaExhaustedAction `json:"exhausted_action" gorm:"type:varchar(32)"`
	BoundaryMode         TokenQuotaBoundaryMode    `json:"boundary_mode" gorm:"type:varchar(32)"`
	AutoResume           bool                      `json:"auto_resume"`
	ExhaustedAt          int64                     `json:"exhausted_at" gorm:"bigint"`
	ExhaustedTokenStatus int                       `json:"exhausted_token_status"`
	CreatedAt            int64                     `json:"created_at" gorm:"bigint"`
	UpdatedAt            int64                     `json:"updated_at" gorm:"bigint"`
}

func (policy *TokenQuotaPolicy) BeforeCreate(_ *gorm.DB) error {
	now := common.GetTimestamp()
	if policy.CreatedAt == 0 {
		policy.CreatedAt = now
	}
	if policy.UpdatedAt == 0 {
		policy.UpdatedAt = now
	}
	return nil
}

func (policy *TokenQuotaPolicy) BeforeUpdate(_ *gorm.DB) error {
	policy.UpdatedAt = common.GetTimestamp()
	return nil
}

type TokenQuotaPolicyWindow struct {
	Start       int64
	End         int64
	NextResetAt int64
}

type TokenQuotaPolicyTemporaryDisabledError struct {
	UsedQuota   int
	Quota       int
	NextResetAt int64
	AutoResume  bool
}

func (e *TokenQuotaPolicyTemporaryDisabledError) Error() string {
	return ErrTokenQuotaPolicyExhausted.Error()
}

func (policy *TokenQuotaPolicy) Validate() error {
	if !policy.Enabled {
		return nil
	}
	if policy.Quota <= 0 {
		return ErrTokenQuotaPolicyInvalidQuota
	}
	if policy.AnchorTime <= 0 {
		return ErrTokenQuotaPolicyInvalidAnchor
	}
	switch policy.PeriodMode {
	case TokenQuotaPeriodPreset5h, TokenQuotaPeriodDaily, TokenQuotaPeriodWeekly, TokenQuotaPeriodMonthly:
	case TokenQuotaPeriodCustom:
		if !validTokenQuotaCustomMinutes(policy.CustomMinutes) {
			return ErrTokenQuotaPolicyInvalidCustomMinutes
		}
	default:
		return ErrTokenQuotaPolicyInvalidPeriod
	}
	if policy.ExhaustedAction == "" {
		policy.ExhaustedAction = TokenQuotaExhaustRejectOnly
	}
	if policy.BoundaryMode == "" {
		policy.BoundaryMode = TokenQuotaBoundaryGraceful
	}
	switch policy.ExhaustedAction {
	case TokenQuotaExhaustRejectOnly, TokenQuotaExhaustDisableToken:
	default:
		return ErrTokenQuotaPolicyInvalidAction
	}
	switch policy.BoundaryMode {
	case TokenQuotaBoundaryGraceful, TokenQuotaBoundaryStrict:
		return nil
	default:
		return ErrTokenQuotaPolicyInvalidBoundary
	}
}

func CalculateTokenQuotaPolicyWindow(mode TokenQuotaPeriodMode, customMinutes int, anchorUnix int64, nowUnix int64) (TokenQuotaPolicyWindow, error) {
	if anchorUnix <= 0 {
		return TokenQuotaPolicyWindow{}, ErrTokenQuotaPolicyInvalidAnchor
	}
	if nowUnix < anchorUnix {
		nowUnix = anchorUnix
	}

	switch mode {
	case TokenQuotaPeriodPreset5h:
		return fixedTokenQuotaPolicyWindow(anchorUnix, nowUnix, 5*time.Hour), nil
	case TokenQuotaPeriodCustom:
		if !validTokenQuotaCustomMinutes(customMinutes) {
			return TokenQuotaPolicyWindow{}, ErrTokenQuotaPolicyInvalidCustomMinutes
		}
		return fixedTokenQuotaPolicyWindow(anchorUnix, nowUnix, time.Duration(customMinutes)*time.Minute), nil
	case TokenQuotaPeriodDaily:
		return calendarTokenQuotaPolicyWindow(anchorUnix, nowUnix, 0, 0, 1), nil
	case TokenQuotaPeriodWeekly:
		return calendarTokenQuotaPolicyWindow(anchorUnix, nowUnix, 0, 0, 7), nil
	case TokenQuotaPeriodMonthly:
		return monthlyTokenQuotaPolicyWindow(anchorUnix, nowUnix), nil
	default:
		return TokenQuotaPolicyWindow{}, ErrTokenQuotaPolicyInvalidPeriod
	}
}

func GetTokenQuotaPolicyByTokenId(tokenId int) (*TokenQuotaPolicy, error) {
	var policy TokenQuotaPolicy
	err := DB.Where("token_id = ?", tokenId).First(&policy).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrTokenQuotaPolicyNotFound
		}
		return nil, err
	}
	return &policy, nil
}

func IsTokenQuotaPolicyExhausted(tokenId int, now int64) (bool, error) {
	policy, err := GetTokenQuotaPolicyByTokenId(tokenId)
	if err != nil {
		if errors.Is(err, ErrTokenQuotaPolicyNotFound) {
			return false, nil
		}
		return false, err
	}
	if !policy.Enabled {
		return false, nil
	}
	if policy.NextResetAt > 0 && now >= policy.NextResetAt {
		return false, nil
	}
	return policy.ExhaustedAt != 0 || policy.UsedQuota >= policy.Quota, nil
}

func ConsumeTokenQuotaPolicy(tokenId int, quota int) error {
	if quota < 0 {
		return errors.New("quota 不能为负数！")
	}
	if quota == 0 {
		return nil
	}
	result := DB.Model(&TokenQuotaPolicy{}).
		Where("token_id = ? AND enabled = ? AND used_quota + ? <= quota", tokenId, true, quota).
		Updates(map[string]any{
			"used_quota": gorm.Expr("used_quota + ?", quota),
			"updated_at": common.GetTimestamp(),
		})
	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected == 0 {
		return ErrTokenQuotaPolicyExhausted
	}
	return nil
}

func SettleTokenQuotaPolicyUsage(tokenId int, quota int) (bool, error) {
	if quota < 0 {
		return false, errors.New("quota 不能为负数！")
	}
	if quota == 0 {
		return false, nil
	}
	now := common.GetTimestamp()
	result := DB.Model(&TokenQuotaPolicy{}).
		Where("token_id = ? AND enabled = ?", tokenId, true).
		Updates(map[string]any{
			"used_quota":   gorm.Expr("used_quota + ?", quota),
			"exhausted_at": gorm.Expr("CASE WHEN used_quota + ? >= quota AND exhausted_at = 0 THEN ? ELSE exhausted_at END", quota, now),
			"updated_at":   now,
		})
	if result.Error != nil {
		return false, result.Error
	}
	if result.RowsAffected == 0 {
		return false, ErrTokenQuotaPolicyNotFound
	}
	policy, err := GetTokenQuotaPolicyByTokenId(tokenId)
	if err != nil {
		return false, err
	}
	return policy.ExhaustedAt != 0 || policy.UsedQuota >= policy.Quota, nil
}

func RefundTokenQuotaPolicy(tokenId int, quota int) error {
	if quota < 0 {
		return errors.New("quota 不能为负数！")
	}
	if quota == 0 {
		return nil
	}
	return DB.Model(&TokenQuotaPolicy{}).
		Where("token_id = ? AND enabled = ?", tokenId, true).
		Updates(map[string]any{
			"used_quota": gorm.Expr("CASE WHEN used_quota >= ? THEN used_quota - ? ELSE 0 END", quota, quota),
			"updated_at": common.GetTimestamp(),
		}).Error
}

func ResetTokenQuotaPolicyIfDue(tokenId int, now int64) (bool, error) {
	policy, err := GetTokenQuotaPolicyByTokenId(tokenId)
	if err != nil {
		if errors.Is(err, ErrTokenQuotaPolicyNotFound) {
			return false, nil
		}
		return false, err
	}
	if !policy.Enabled || policy.NextResetAt <= 0 || now < policy.NextResetAt {
		return false, nil
	}
	window, err := CalculateTokenQuotaPolicyWindow(policy.PeriodMode, policy.CustomMinutes, policy.AnchorTime, now)
	if err != nil {
		return false, err
	}
	result := DB.Model(&TokenQuotaPolicy{}).
		Where("id = ? AND next_reset_at = ?", policy.Id, policy.NextResetAt).
		Updates(map[string]any{
			"used_quota":             0,
			"period_start":           window.Start,
			"period_end":             window.End,
			"next_reset_at":          window.NextResetAt,
			"exhausted_at":           0,
			"exhausted_token_status": 0,
			"updated_at":             common.GetTimestamp(),
		})
	if result.Error != nil {
		return false, result.Error
	}
	return result.RowsAffected > 0, nil
}

func ResetTokenQuotaPolicyAndRestoreTokenIfDue(tokenId int, now int64) (bool, error) {
	policy, err := GetTokenQuotaPolicyByTokenId(tokenId)
	if err != nil {
		if errors.Is(err, ErrTokenQuotaPolicyNotFound) {
			return false, nil
		}
		return false, err
	}
	if !policy.Enabled || policy.NextResetAt <= 0 || now < policy.NextResetAt {
		return false, nil
	}
	window, err := CalculateTokenQuotaPolicyWindow(policy.PeriodMode, policy.CustomMinutes, policy.AnchorTime, now)
	if err != nil {
		return false, err
	}
	reset := false
	restored := false
	previousStatus := policy.ExhaustedTokenStatus
	err = DB.Transaction(func(tx *gorm.DB) error {
		updates := map[string]any{
			"used_quota":             0,
			"period_start":           window.Start,
			"period_end":             window.End,
			"next_reset_at":          window.NextResetAt,
			"exhausted_at":           0,
			"exhausted_token_status": 0,
			"updated_at":             common.GetTimestamp(),
		}
		result := tx.Model(&TokenQuotaPolicy{}).Where("id = ? AND next_reset_at = ?", policy.Id, policy.NextResetAt).Updates(updates)
		if result.Error != nil {
			return result.Error
		}
		if result.RowsAffected == 0 {
			return nil
		}
		reset = true
		if !policy.AutoResume || policy.ExhaustedAt == 0 || policy.ExhaustedTokenStatus != common.TokenStatusEnabled {
			return nil
		}
		tokenResult := tx.Model(&Token{}).
			Where("id = ? AND status = ?", tokenId, common.TokenStatusDisabled).
			Updates(map[string]any{
				"status":        policy.ExhaustedTokenStatus,
				"accessed_time": common.GetTimestamp(),
			})
		if tokenResult.Error != nil {
			return tokenResult.Error
		}
		restored = tokenResult.RowsAffected > 0
		return nil
	})
	if err != nil {
		return false, err
	}
	if restored {
		refreshTokenCacheById(tokenId)
		RecordTokenOperationLog(policy.UserId, tokenId, LogTypeSystem, fmt.Sprintf(
			"API key automatically restored after periodic quota reset, new period started, previous_status=%d, new_period_start=%d, next_reset_at=%d",
			previousStatus, window.Start, window.NextResetAt,
		), "token.quota_policy.auto_restore_reset", map[string]interface{}{
			"previous_status":  previousStatus,
			"new_period_start": window.Start,
			"next_reset_at":    window.NextResetAt,
		})
	}
	return reset, nil
}

func ResetTokenQuotaPolicyManually(tokenId int, userId int) (*TokenQuotaPolicy, error) {
	var policy TokenQuotaPolicy
	restored := false
	err := DB.Transaction(func(tx *gorm.DB) error {
		if err := tx.Where("token_id = ? AND user_id = ?", tokenId, userId).First(&policy).Error; err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				return ErrTokenQuotaPolicyNotFound
			}
			return err
		}
		if !policy.Enabled {
			return nil
		}
		previousStatus := policy.ExhaustedTokenStatus
		updates := map[string]any{
			"used_quota":             0,
			"exhausted_at":           0,
			"exhausted_token_status": 0,
			"updated_at":             common.GetTimestamp(),
		}
		if err := tx.Model(&TokenQuotaPolicy{}).Where("id = ?", policy.Id).Updates(updates).Error; err != nil {
			return err
		}
		policy.UsedQuota = 0
		policy.ExhaustedAt = 0
		policy.ExhaustedTokenStatus = 0
		if previousStatus != common.TokenStatusEnabled {
			return nil
		}
		result := tx.Model(&Token{}).
			Where("id = ? AND user_id = ? AND status = ?", tokenId, userId, common.TokenStatusDisabled).
			Updates(map[string]any{
				"status":        previousStatus,
				"accessed_time": common.GetTimestamp(),
			})
		if result.Error != nil {
			return result.Error
		}
		restored = result.RowsAffected > 0
		return nil
	})
	if err != nil {
		return nil, err
	}
	if restored {
		refreshTokenCacheById(tokenId)
	}
	RecordTokenOperationLog(userId, tokenId, LogTypeSystem, fmt.Sprintf(
		"API key periodic quota manually reset, used_quota=0, next_reset_at=%d",
		policy.NextResetAt,
	), "token.quota_policy.manual_reset", map[string]interface{}{
		"used_quota":    0,
		"next_reset_at": policy.NextResetAt,
	})
	return &policy, nil
}

func MarkTokenQuotaPolicyExhausted(tokenId int, exhaustedStatus int) error {
	now := common.GetTimestamp()
	disabled := false
	var token Token
	var policy TokenQuotaPolicy
	err := DB.Transaction(func(tx *gorm.DB) error {
		if err := tx.Where("id = ?", tokenId).First(&token).Error; err != nil {
			return err
		}
		if err := tx.Where("token_id = ?", tokenId).First(&policy).Error; err != nil {
			return err
		}
		if token.Status != exhaustedStatus {
			if err := tx.Model(&Token{}).
				Where("id = ?", tokenId).
				Updates(map[string]any{
					"status":        exhaustedStatus,
					"accessed_time": now,
				}).Error; err != nil {
				return err
			}
			disabled = true
		}
		return tx.Model(&TokenQuotaPolicy{}).
			Where("token_id = ?", tokenId).
			Updates(map[string]any{
				"exhausted_at":           gorm.Expr("CASE WHEN exhausted_at = 0 THEN ? ELSE exhausted_at END", now),
				"exhausted_token_status": gorm.Expr("CASE WHEN exhausted_token_status = 0 THEN ? ELSE exhausted_token_status END", token.Status),
				"updated_at":             now,
			}).Error
	})
	if err != nil {
		return err
	}
	if disabled {
		refreshTokenCacheById(tokenId)
		RecordTokenOperationLog(token.UserId, tokenId, LogTypeSystem, fmt.Sprintf(
			"API key temporarily disabled because periodic quota exhausted, used_quota=%d, quota=%d, next_reset_at=%d",
			policy.UsedQuota, policy.Quota, policy.NextResetAt,
		), "token.quota_policy.exhausted_disable", map[string]interface{}{
			"used_quota":    policy.UsedQuota,
			"quota":         policy.Quota,
			"next_reset_at": policy.NextResetAt,
		})
	}
	return nil
}

func FindDueTokenQuotaPolicies(now int64, limit int) ([]*TokenQuotaPolicy, error) {
	if limit <= 0 {
		limit = 100
	}
	var policies []*TokenQuotaPolicy
	err := DB.Where("enabled = ? AND next_reset_at > 0 AND next_reset_at <= ?", true, now).
		Order("next_reset_at asc, id asc").
		Limit(limit).
		Find(&policies).Error
	return policies, err
}

func SaveTokenQuotaPolicyForToken(tokenId int, userId int, policy *TokenQuotaPolicy, now int64) (*TokenQuotaPolicy, error) {
	return saveTokenQuotaPolicyForToken(DB, tokenId, userId, policy, now)
}

func saveTokenQuotaPolicyForToken(db *gorm.DB, tokenId int, userId int, policy *TokenQuotaPolicy, now int64) (*TokenQuotaPolicy, error) {
	if policy == nil {
		return nil, nil
	}
	policy.TokenId = tokenId
	policy.UserId = userId
	if policy.ExhaustedAction == "" {
		policy.ExhaustedAction = TokenQuotaExhaustRejectOnly
	}
	if policy.BoundaryMode == "" {
		policy.BoundaryMode = TokenQuotaBoundaryGraceful
	}
	if err := policy.Validate(); err != nil {
		return nil, err
	}
	var existing *TokenQuotaPolicy
	var existingPolicy TokenQuotaPolicy
	err := db.Where("token_id = ?", tokenId).First(&existingPolicy).Error
	if err == nil {
		existing = &existingPolicy
	} else if !errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, err
	}
	if !policy.Enabled && existing == nil {
		return nil, nil
	}
	if policy.Enabled {
		window, err := CalculateTokenQuotaPolicyWindow(policy.PeriodMode, policy.CustomMinutes, policy.AnchorTime, now)
		if err != nil {
			return nil, err
		}
		policy.PeriodStart = window.Start
		policy.PeriodEnd = window.End
		policy.NextResetAt = window.NextResetAt
		if existing != nil {
			policy.UsedQuota = existing.UsedQuota
			policy.ExhaustedAt = existing.ExhaustedAt
			policy.ExhaustedTokenStatus = existing.ExhaustedTokenStatus
		}
	} else {
		policy.UsedQuota = 0
		policy.PeriodStart = 0
		policy.PeriodEnd = 0
		policy.NextResetAt = 0
		policy.ExhaustedAt = 0
		policy.ExhaustedTokenStatus = 0
	}

	restoreToken := false
	disableToken := false
	err = db.Transaction(func(tx *gorm.DB) error {
		var token Token
		if err := tx.Where("id = ? AND user_id = ?", tokenId, userId).First(&token).Error; err != nil {
			return err
		}
		if policy.Enabled && policy.Quota > 0 && policy.UsedQuota >= policy.Quota {
			if policy.ExhaustedAt == 0 {
				policy.ExhaustedAt = now
			}
			if policy.ExhaustedTokenStatus == 0 {
				policy.ExhaustedTokenStatus = token.Status
			}
			disableToken = policy.ExhaustedAction == TokenQuotaExhaustDisableToken && token.Status != common.TokenStatusDisabled
		} else {
			restoreToken = existing != nil &&
				existing.ExhaustedAt != 0 &&
				existing.ExhaustedTokenStatus == common.TokenStatusEnabled &&
				token.Status == common.TokenStatusDisabled
			policy.ExhaustedAt = 0
			policy.ExhaustedTokenStatus = 0
		}

		if existing == nil {
			if err := tx.Create(policy).Error; err != nil {
				return err
			}
		} else {
			policy.Id = existing.Id
			policy.CreatedAt = existing.CreatedAt
			if err := tx.Model(existing).Select(
				"user_id",
				"enabled",
				"period_mode",
				"custom_minutes",
				"quota",
				"used_quota",
				"anchor_time",
				"period_start",
				"period_end",
				"next_reset_at",
				"exhausted_action",
				"boundary_mode",
				"auto_resume",
				"exhausted_at",
				"exhausted_token_status",
				"updated_at",
			).Updates(policy).Error; err != nil {
				return err
			}
		}
		if err := tx.Model(&Token{}).
			Where("id = ?", tokenId).
			Update("quota_policy_enabled", policy.Enabled).Error; err != nil {
			return err
		}
		if disableToken {
			return tx.Model(&Token{}).Where("id = ? AND user_id = ?", tokenId, userId).Updates(map[string]any{
				"status":        common.TokenStatusDisabled,
				"accessed_time": now,
			}).Error
		}
		if restoreToken {
			return tx.Model(&Token{}).Where("id = ? AND user_id = ? AND status = ?", tokenId, userId, common.TokenStatusDisabled).Updates(map[string]any{
				"status":        common.TokenStatusEnabled,
				"accessed_time": now,
			}).Error
		}
		return nil
	})
	if err != nil {
		return nil, err
	}
	if disableToken {
		RecordTokenOperationLog(userId, tokenId, LogTypeSystem, fmt.Sprintf(
			"API key temporarily disabled because updated periodic quota is already exhausted, used_quota=%d, quota=%d, next_reset_at=%d",
			policy.UsedQuota, policy.Quota, policy.NextResetAt,
		), "token.quota_policy.update_disable", map[string]interface{}{
			"used_quota":    policy.UsedQuota,
			"quota":         policy.Quota,
			"next_reset_at": policy.NextResetAt,
		})
	} else if restoreToken {
		RecordTokenOperationLog(userId, tokenId, LogTypeSystem, fmt.Sprintf(
			"API key automatically restored after periodic quota update, used_quota=%d, quota=%d, next_reset_at=%d",
			policy.UsedQuota, policy.Quota, policy.NextResetAt,
		), "token.quota_policy.update_restore", map[string]interface{}{
			"used_quota":    policy.UsedQuota,
			"quota":         policy.Quota,
			"next_reset_at": policy.NextResetAt,
		})
	}
	refreshTokenCacheById(tokenId)
	return policy, nil
}

func InsertTokenWithQuotaPolicy(token *Token, policy *TokenQuotaPolicy, now int64) (*TokenQuotaPolicy, error) {
	var savedPolicy *TokenQuotaPolicy
	err := DB.Transaction(func(tx *gorm.DB) error {
		if err := tx.Create(token).Error; err != nil {
			return err
		}
		if policy == nil {
			return nil
		}
		var err error
		savedPolicy, err = saveTokenQuotaPolicyForToken(tx, token.Id, token.UserId, policy, now)
		return err
	})
	if err != nil {
		return nil, err
	}
	return savedPolicy, nil
}

func UpdateTokenWithQuotaPolicy(token *Token, policy *TokenQuotaPolicy, now int64) (*TokenQuotaPolicy, error) {
	var savedPolicy *TokenQuotaPolicy
	err := DB.Transaction(func(tx *gorm.DB) error {
		if err := tx.Model(token).Select("name", "status", "expired_time", "remain_quota", "unlimited_quota",
			"model_limits_enabled", "model_limits", "allow_ips", "group", "cross_group_retry").Updates(token).Error; err != nil {
			return err
		}
		if policy == nil {
			return nil
		}
		var err error
		savedPolicy, err = saveTokenQuotaPolicyForToken(tx, token.Id, token.UserId, policy, now)
		return err
	})
	if err != nil {
		return nil, err
	}
	refreshTokenCacheById(token.Id)
	return savedPolicy, nil
}

func AttachTokenQuotaPolicy(token *Token) error {
	if token == nil || token.Id == 0 {
		return nil
	}
	policy, err := GetTokenQuotaPolicyByTokenId(token.Id)
	if err != nil {
		if errors.Is(err, ErrTokenQuotaPolicyNotFound) {
			return nil
		}
		return err
	}
	token.QuotaPolicy = policy
	return nil
}

func AttachTokenQuotaPolicies(tokens []*Token) error {
	tokenIds := make([]int, 0, len(tokens))
	for _, token := range tokens {
		if token != nil && token.Id != 0 && token.QuotaPolicyEnabled {
			tokenIds = append(tokenIds, token.Id)
		}
	}
	if len(tokenIds) == 0 {
		return nil
	}

	var policies []*TokenQuotaPolicy
	if err := DB.Where("token_id IN ?", tokenIds).Find(&policies).Error; err != nil {
		return err
	}

	policiesByTokenId := make(map[int]*TokenQuotaPolicy, len(policies))
	for _, policy := range policies {
		policiesByTokenId[policy.TokenId] = policy
	}
	for _, token := range tokens {
		if token != nil {
			token.QuotaPolicy = policiesByTokenId[token.Id]
		}
	}
	return nil
}

func validTokenQuotaCustomMinutes(minutes int) bool {
	return minutes >= TokenQuotaCustomMinMinutes && minutes <= TokenQuotaCustomMaxMinutes
}

func fixedTokenQuotaPolicyWindow(anchorUnix int64, nowUnix int64, duration time.Duration) TokenQuotaPolicyWindow {
	anchor := time.Unix(anchorUnix, 0).UTC()
	elapsed := time.Unix(nowUnix, 0).UTC().Sub(anchor)
	steps := int64(elapsed / duration)
	start := anchor.Add(time.Duration(steps) * duration)
	end := start.Add(duration)
	return TokenQuotaPolicyWindow{
		Start:       start.Unix(),
		End:         end.Unix(),
		NextResetAt: end.Unix(),
	}
}

func calendarTokenQuotaPolicyWindow(anchorUnix int64, nowUnix int64, years int, months int, days int) TokenQuotaPolicyWindow {
	start := time.Unix(anchorUnix, 0).UTC()
	now := time.Unix(nowUnix, 0).UTC()
	end := start.AddDate(years, months, days)
	for !now.Before(end) {
		start = end
		end = start.AddDate(years, months, days)
	}
	return TokenQuotaPolicyWindow{
		Start:       start.Unix(),
		End:         end.Unix(),
		NextResetAt: end.Unix(),
	}
}

func monthlyTokenQuotaPolicyWindow(anchorUnix int64, nowUnix int64) TokenQuotaPolicyWindow {
	anchor := time.Unix(anchorUnix, 0).UTC()
	now := time.Unix(nowUnix, 0).UTC()
	start := clampedMonthlyTime(anchor, 0)
	end := clampedMonthlyTime(anchor, 1)
	for !now.Before(end) {
		start = end
		monthsFromAnchor := monthsBetweenAnchor(anchor, start) + 1
		end = clampedMonthlyTime(anchor, monthsFromAnchor)
	}
	return TokenQuotaPolicyWindow{
		Start:       start.Unix(),
		End:         end.Unix(),
		NextResetAt: end.Unix(),
	}
}

func monthsBetweenAnchor(anchor time.Time, value time.Time) int {
	return (value.Year()-anchor.Year())*12 + int(value.Month()-anchor.Month())
}

func clampedMonthlyTime(anchor time.Time, monthOffset int) time.Time {
	firstOfTarget := time.Date(anchor.Year(), anchor.Month()+time.Month(monthOffset), 1, anchor.Hour(), anchor.Minute(), anchor.Second(), anchor.Nanosecond(), time.UTC)
	day := anchor.Day()
	lastDay := time.Date(firstOfTarget.Year(), firstOfTarget.Month()+1, 0, anchor.Hour(), anchor.Minute(), anchor.Second(), anchor.Nanosecond(), time.UTC).Day()
	if day > lastDay {
		day = lastDay
	}
	return time.Date(firstOfTarget.Year(), firstOfTarget.Month(), day, anchor.Hour(), anchor.Minute(), anchor.Second(), anchor.Nanosecond(), time.UTC)
}
