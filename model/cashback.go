package model

import (
	"crypto/sha256"
	"database/sql"
	"encoding/hex"
	"errors"
	"fmt"
	"net"
	"regexp"
	"sort"
	"strconv"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/setting/operation_setting"

	"github.com/shopspring/decimal"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

type CashbackDirection string
type CashbackReviewStatus string
type CashbackSettlementStatus string
type CashbackRiskLevel string
type CashbackCompletionSource string
type CashbackIncidentKind string
type CashbackDeviceSource string
type CashbackReviewSource string

const (
	CashbackDirectionInviter CashbackDirection = "inviter"
	CashbackDirectionInvitee CashbackDirection = "invitee"

	CashbackReviewPending  CashbackReviewStatus = "pending"
	CashbackReviewApproved CashbackReviewStatus = "approved"
	CashbackReviewRejected CashbackReviewStatus = "rejected"

	CashbackReviewAutomatic CashbackReviewSource = "automatic"
	CashbackReviewManual    CashbackReviewSource = "manual"

	CashbackSettlementFrozen    CashbackSettlementStatus = "frozen"
	CashbackSettlementIssued    CashbackSettlementStatus = "issued"
	CashbackSettlementCanceled  CashbackSettlementStatus = "canceled"
	CashbackSettlementReclaimed CashbackSettlementStatus = "reclaimed"
	CashbackSettlementDebt      CashbackSettlementStatus = "debt"

	CashbackRiskLow    CashbackRiskLevel = "low"
	CashbackRiskMedium CashbackRiskLevel = "medium"
	CashbackRiskHigh   CashbackRiskLevel = "high"
	CashbackRiskSevere CashbackRiskLevel = "severe"

	CashbackCompletionProviderCallback CashbackCompletionSource = "provider_callback"
	CashbackCompletionVerifiedReturn   CashbackCompletionSource = "verified_return"
	CashbackCompletionAdminManual      CashbackCompletionSource = "admin_manual"

	CashbackIncidentRefund     CashbackIncidentKind = "refund"
	CashbackIncidentChargeback CashbackIncidentKind = "chargeback"
	CashbackIncidentDispute    CashbackIncidentKind = "dispute"

	CashbackDeviceSourceRegistration CashbackDeviceSource = "registration"
	CashbackDeviceSourceLogin        CashbackDeviceSource = "login"
	CashbackDeviceSourceTopUp        CashbackDeviceSource = "topup"

	// CashbackIneligiblePartnerOAuth marks orders a partner assistant placed on
	// the payer's behalf; they never earn cashback.
	CashbackIneligiblePartnerOAuth = "partner_oauth"

	CashbackDeviceSignalHeader  = "X-Device-Signal"
	CashbackDeviceSignalMissing = "missing"
	CashbackDeviceSignalInvalid = "invalid"
	CashbackDeviceSignalValid   = "valid"
)

var (
	ErrCashbackInvalidInput        = errors.New("invalid cashback input")
	ErrCashbackInvalidState        = errors.New("invalid cashback state transition")
	ErrCashbackNotFound            = errors.New("cashback record not found")
	ErrCashbackOrderContextMissing = errors.New("required cashback order context is missing")
	ErrCashbackHardBlocked         = errors.New("cashback is blocked by current risk facts")
	ErrCashbackReviewReason        = errors.New("cashback review reason is required")
	ErrCashbackNotMature           = errors.New("cashback is not yet available")
	ErrCashbackRefundRate          = errors.New("invalid cumulative refund rate")
	ErrCashbackDebtNotFound        = errors.New("cashback debt not found")
	cashbackDeviceSignalPattern    = regexp.MustCompile(`^v1:[0-9a-fA-F]{64}$`)
)

type CashbackOrderContext struct {
	ID                            int64                    `json:"id" gorm:"primaryKey"`
	TopUpID                       int                      `json:"top_up_id" gorm:"not null;uniqueIndex"`
	CampaignID                    int64                    `json:"campaign_id" gorm:"type:bigint;not null;default:0;index"`
	TradeNo                       string                   `json:"trade_no" gorm:"type:varchar(255);not null;index"`
	UserID                        int                      `json:"user_id" gorm:"not null;index;index:idx_cashback_principal_debt,priority:1"`
	PaymentProvider               string                   `json:"payment_provider" gorm:"type:varchar(50);not null"`
	BaseQuota                     int                      `json:"base_quota" gorm:"type:bigint;not null"`
	FaceAmount                    int64                    `json:"face_amount" gorm:"type:bigint;not null;default:0"`
	QuotaPerFaceUnit              string                   `json:"quota_per_face_unit" gorm:"type:varchar(128);not null;default:''"`
	CreditedQuota                 int                      `json:"credited_quota" gorm:"type:bigint;not null;default:0"`
	RequestIP                     string                   `json:"request_ip" gorm:"type:varchar(64);index"`
	RequestUserAgentHash          string                   `json:"request_user_agent_hash" gorm:"type:char(64);index"`
	DeviceFingerprintHash         string                   `json:"device_fingerprint_hash" gorm:"type:char(64);index"`
	DeviceSignalStatus            string                   `json:"device_signal_status" gorm:"type:varchar(16);not null;default:'missing'"`
	EligibleAfterFirstEnable      bool                     `json:"eligible_after_first_enable" gorm:"not null;default:false"`
	IneligibleReason              string                   `json:"ineligible_reason" gorm:"type:varchar(32)"`
	CompletionSource              CashbackCompletionSource `json:"completion_source" gorm:"type:varchar(32);index"`
	CompletionProvider            string                   `json:"completion_provider" gorm:"type:varchar(50)"`
	IncidentKind                  CashbackIncidentKind     `json:"incident_kind" gorm:"type:varchar(20);index"`
	IncidentReason                string                   `json:"incident_reason" gorm:"type:text"`
	IncidentEvidenceRef           string                   `json:"incident_evidence_ref" gorm:"type:varchar(1000)"`
	IncidentReportedBy            int                      `json:"incident_reported_by" gorm:"index"`
	IncidentReportedAt            int64                    `json:"incident_reported_at" gorm:"type:bigint;index"`
	CumulativeRefundRateBPS       int                      `json:"cumulative_refund_rate_bps" gorm:"not null;default:0"`
	PrincipalReversalTargetQuota  int                      `json:"principal_reversal_target_quota" gorm:"type:bigint;not null;default:0"`
	PrincipalRecoveredQuota       int                      `json:"principal_recovered_quota" gorm:"type:bigint;not null;default:0"`
	PrincipalOutstandingDebtQuota int                      `json:"principal_outstanding_debt_quota" gorm:"type:bigint;not null;default:0;index:idx_cashback_principal_debt,priority:2"`
	PrincipalDebtResolvedAt       int64                    `json:"principal_debt_resolved_at" gorm:"type:bigint"`
	PrincipalDebtResolvedBy       int                      `json:"principal_debt_resolved_by"`
	PrincipalDebtResolutionReason string                   `json:"principal_debt_resolution_reason" gorm:"type:text"`
	CreatedAt                     int64                    `json:"created_at" gorm:"autoCreateTime;type:bigint;index"`
	UpdatedAt                     int64                    `json:"updated_at" gorm:"autoUpdateTime;type:bigint"`
}

type CashbackReward struct {
	ID                      int64                    `json:"id" gorm:"primaryKey"`
	TopUpID                 int                      `json:"top_up_id" gorm:"not null;uniqueIndex:ux_cashback_topup_direction,priority:1;index"`
	TradeNo                 string                   `json:"trade_no" gorm:"type:varchar(255);not null;index"`
	Direction               CashbackDirection        `json:"direction" gorm:"type:varchar(16);not null;uniqueIndex:ux_cashback_topup_direction,priority:2;index"`
	InviteeID               int                      `json:"invitee_id" gorm:"not null;index"`
	InviterID               int                      `json:"inviter_id" gorm:"not null;index"`
	BeneficiaryID           int                      `json:"beneficiary_id" gorm:"not null;index:idx_cashback_beneficiary_created,priority:1;index:idx_cashback_beneficiary_debt,priority:1;index:idx_cashback_beneficiary_paid,priority:1"`
	BaseQuota               int                      `json:"base_quota" gorm:"type:bigint;not null"`
	RateBPS                 int                      `json:"rate_bps" gorm:"not null"`
	Strategy                string                   `json:"strategy" gorm:"type:varchar(20);not null;default:''"`
	FixedPerHundred         int                      `json:"fixed_per_hundred" gorm:"not null;default:0"`
	CalculatedQuota         int                      `json:"calculated_quota" gorm:"type:bigint;not null"`
	RewardQuota             int                      `json:"reward_quota" gorm:"type:bigint;not null"`
	CapReason               string                   `json:"cap_reason" gorm:"type:varchar(128)"`
	SettlementDays          int                      `json:"settlement_days" gorm:"not null"`
	ConfigVersion           int64                    `json:"config_version" gorm:"type:bigint;not null"`
	PaidAt                  int64                    `json:"paid_at" gorm:"type:bigint;not null;index;index:idx_cashback_beneficiary_paid,priority:2"`
	AvailableAt             int64                    `json:"available_at" gorm:"type:bigint;not null;index:idx_cashback_settlement_scan,priority:3"`
	ReviewStatus            CashbackReviewStatus     `json:"review_status" gorm:"type:varchar(16);not null;index:idx_cashback_settlement_scan,priority:1;index"`
	ReviewedBy              int                      `json:"reviewed_by" gorm:"index"`
	ReviewSource            CashbackReviewSource     `json:"review_source" gorm:"type:varchar(16);not null;default:''"`
	ReviewedAt              int64                    `json:"reviewed_at" gorm:"type:bigint"`
	ReviewReason            string                   `json:"review_reason" gorm:"type:text"`
	SettlementStatus        CashbackSettlementStatus `json:"settlement_status" gorm:"type:varchar(16);not null;index:idx_cashback_settlement_scan,priority:2;index"`
	IssuedAt                int64                    `json:"issued_at" gorm:"type:bigint;index"`
	RiskLevel               CashbackRiskLevel        `json:"risk_level" gorm:"type:varchar(16);not null;index"`
	RiskSnapshot            string                   `json:"risk_snapshot" gorm:"type:text;not null"`
	ConfigSnapshot          string                   `json:"config_snapshot" gorm:"type:text;not null"`
	BlockingReason          string                   `json:"blocking_reason" gorm:"type:text"`
	RecoveredQuota          int                      `json:"recovered_quota" gorm:"type:bigint;not null;default:0"`
	OutstandingDebtQuota    int                      `json:"outstanding_debt_quota" gorm:"type:bigint;not null;default:0;index:idx_cashback_beneficiary_debt,priority:2"`
	DebtResolvedAt          int64                    `json:"debt_resolved_at" gorm:"type:bigint"`
	DebtResolvedBy          int                      `json:"debt_resolved_by"`
	DebtResolutionReason    string                   `json:"debt_resolution_reason" gorm:"type:text"`
	LastSettlementError     string                   `json:"last_settlement_error" gorm:"type:text"`
	NextSettlementAttemptAt int64                    `json:"next_settlement_attempt_at" gorm:"type:bigint;not null;default:0;index"`
	CreatedAt               int64                    `json:"created_at" gorm:"autoCreateTime;type:bigint;index:idx_cashback_beneficiary_created,priority:2;index"`
	UpdatedAt               int64                    `json:"updated_at" gorm:"autoUpdateTime;type:bigint"`
}

type CashbackDeviceLink struct {
	ID                    int64                `json:"id" gorm:"primaryKey"`
	UserID                int                  `json:"user_id" gorm:"not null;uniqueIndex:ux_cashback_user_device,priority:1;index;index:idx_cashback_device_user,priority:2"`
	DeviceFingerprintHash string               `json:"device_fingerprint_hash" gorm:"type:char(64);not null;uniqueIndex:ux_cashback_user_device,priority:2;index:idx_cashback_device_user,priority:1"`
	DeviceSignalStatus    string               `json:"device_signal_status" gorm:"type:varchar(16);not null;default:'valid';index"`
	FirstSeenAt           int64                `json:"first_seen_at" gorm:"type:bigint;not null;index"`
	LastSeenAt            int64                `json:"last_seen_at" gorm:"type:bigint;not null;index"`
	FirstIP               string               `json:"first_ip" gorm:"type:varchar(64);index"`
	LastIP                string               `json:"last_ip" gorm:"type:varchar(64);index"`
	FirstUserAgentHash    string               `json:"first_user_agent_hash" gorm:"type:char(64)"`
	LastUserAgentHash     string               `json:"last_user_agent_hash" gorm:"type:char(64)"`
	Source                CashbackDeviceSource `json:"source" gorm:"type:varchar(20);not null"`
}

type CashbackRequestMetadata struct {
	RequestIP        string
	UserAgent        string
	DeviceSignal     string
	FaceAmount       int64
	QuotaPerFaceUnit string
	// IneligibleReason excludes the order from cashback at creation time. Such
	// orders keep their context for principal accounting but record no request
	// evidence, because the request did not come from the payer's browser.
	IneligibleReason string
}

// cashbackTransaction uses READ COMMITTED so aggregate reads performed after
// beneficiary row locks observe rewards committed by the previous lock holder.
// Under MySQL's default REPEATABLE READ, an earlier configuration read could
// otherwise pin a stale snapshot and let concurrent top-ups exceed the 24-hour
// cashback cap.
func cashbackTransaction(fn func(*gorm.DB) error) error {
	return DB.Transaction(fn, &sql.TxOptions{Isolation: sql.LevelReadCommitted})
}

func validCashbackDirection(direction CashbackDirection) bool {
	return direction == CashbackDirectionInviter || direction == CashbackDirectionInvitee
}

func validCashbackReviewStatus(status CashbackReviewStatus) bool {
	return status == CashbackReviewPending || status == CashbackReviewApproved || status == CashbackReviewRejected
}

func validCashbackSettlementStatus(status CashbackSettlementStatus) bool {
	switch status {
	case CashbackSettlementFrozen, CashbackSettlementIssued, CashbackSettlementCanceled, CashbackSettlementReclaimed, CashbackSettlementDebt:
		return true
	default:
		return false
	}
}

func validCashbackRiskLevel(level CashbackRiskLevel) bool {
	switch level {
	case CashbackRiskLow, CashbackRiskMedium, CashbackRiskHigh, CashbackRiskSevere:
		return true
	default:
		return false
	}
}

func validCashbackCompletionSource(source CashbackCompletionSource) bool {
	switch source {
	case "", CashbackCompletionProviderCallback, CashbackCompletionVerifiedReturn, CashbackCompletionAdminManual:
		return true
	default:
		return false
	}
}

func validCashbackIncidentKind(kind CashbackIncidentKind) bool {
	switch kind {
	case "", CashbackIncidentRefund, CashbackIncidentChargeback, CashbackIncidentDispute:
		return true
	default:
		return false
	}
}

func validCashbackDeviceSource(source CashbackDeviceSource) bool {
	switch source {
	case CashbackDeviceSourceRegistration, CashbackDeviceSourceLogin, CashbackDeviceSourceTopUp:
		return true
	default:
		return false
	}
}

func validCashbackDeviceSignalStatus(status string) bool {
	return status == CashbackDeviceSignalMissing || status == CashbackDeviceSignalInvalid || status == CashbackDeviceSignalValid
}

func (context *CashbackOrderContext) BeforeSave(_ *gorm.DB) error {
	if context.TopUpID <= 0 || context.UserID <= 0 || strings.TrimSpace(context.TradeNo) == "" || strings.TrimSpace(context.PaymentProvider) == "" ||
		context.BaseQuota <= 0 || context.BaseQuota > common.MaxWalletQuota {
		return errors.New("invalid cashback order context")
	}
	if !validCashbackDeviceSignalStatus(context.DeviceSignalStatus) {
		return errors.New("invalid cashback device signal status")
	}
	if context.DeviceSignalStatus == CashbackDeviceSignalValid && len(context.DeviceFingerprintHash) != sha256.Size*2 {
		return errors.New("invalid cashback device fingerprint hash")
	}
	if context.FaceAmount < 0 || (context.FaceAmount == 0) != (context.QuotaPerFaceUnit == "") {
		return errors.New("invalid cashback face basis")
	}
	if context.FaceAmount > 0 {
		factor, err := decimal.NewFromString(context.QuotaPerFaceUnit)
		if err != nil || factor.LessThanOrEqual(decimal.Zero) || context.FaceAmount > common.MaxWalletQuota {
			return errors.New("invalid cashback face conversion")
		}
		basis := decimal.NewFromInt(context.FaceAmount).Mul(factor)
		if basis.LessThan(decimal.NewFromInt(int64(context.BaseQuota-1))) || basis.GreaterThan(decimal.NewFromInt(int64(context.BaseQuota+1))) {
			return errors.New("cashback face conversion does not match principal")
		}
	}
	if context.CampaignID < 0 || (context.IneligibleReason != "" && context.IneligibleReason != CashbackIneligiblePartnerOAuth) {
		return ErrCashbackInvalidInput
	}
	if context.CreditedQuota < 0 || context.CreditedQuota > common.MaxWalletQuota {
		return errors.New("invalid cashback credited quota")
	}
	if !validCashbackCompletionSource(context.CompletionSource) || !validCashbackIncidentKind(context.IncidentKind) {
		return errors.New("invalid cashback order state")
	}
	if context.CumulativeRefundRateBPS < 0 || context.CumulativeRefundRateBPS > operation_setting.CashbackRateBasisPoints {
		return ErrCashbackRefundRate
	}
	if context.PrincipalReversalTargetQuota < 0 || context.PrincipalRecoveredQuota < 0 || context.PrincipalOutstandingDebtQuota < 0 ||
		context.PrincipalReversalTargetQuota > context.CreditedQuota || context.PrincipalRecoveredQuota > context.PrincipalReversalTargetQuota {
		return errors.New("invalid cashback principal accounting")
	}
	return nil
}

func (reward *CashbackReward) BeforeCreate(_ *gorm.DB) error {
	if reward.ReviewStatus == "" {
		reward.ReviewStatus = CashbackReviewPending
	}
	if reward.SettlementStatus == "" {
		reward.SettlementStatus = CashbackSettlementFrozen
	}
	if reward.RiskLevel == "" {
		reward.RiskLevel = CashbackRiskLow
	}
	return reward.validate()
}

func (reward *CashbackReward) BeforeSave(_ *gorm.DB) error {
	return reward.validate()
}

func (reward *CashbackReward) validate() error {
	if reward.TopUpID <= 0 || strings.TrimSpace(reward.TradeNo) == "" || reward.InviteeID <= 0 || reward.BeneficiaryID <= 0 || !validCashbackDirection(reward.Direction) {
		return errors.New("invalid cashback reward relationship")
	}
	if reward.InviterID < 0 || reward.InviterID == reward.InviteeID ||
		(reward.Direction == CashbackDirectionInviter && (reward.InviterID == 0 || reward.BeneficiaryID != reward.InviterID)) ||
		(reward.Direction == CashbackDirectionInvitee && reward.BeneficiaryID != reward.InviteeID) {
		return errors.New("invalid cashback reward relationship")
	}
	if reward.ReviewSource != "" && reward.ReviewSource != CashbackReviewAutomatic && reward.ReviewSource != CashbackReviewManual {
		return errors.New("invalid cashback review source")
	}
	if reward.BaseQuota <= 0 || reward.BaseQuota > common.MaxWalletQuota || reward.RateBPS < 0 || reward.RateBPS > operation_setting.CashbackRateBasisPoints {
		return errors.New("invalid cashback reward calculation")
	}
	if reward.Strategy != "" && reward.Strategy != operation_setting.CashbackStrategyRate && reward.Strategy != operation_setting.CashbackStrategyPerHundred && reward.Strategy != operation_setting.CashbackStrategyTiered {
		return errors.New("invalid cashback reward strategy")
	}
	if reward.Strategy == operation_setting.CashbackStrategyTiered && reward.RateBPS != 0 {
		return errors.New("invalid tiered cashback rate")
	}
	if reward.FixedPerHundred < 0 || reward.FixedPerHundred > 100 ||
		(reward.Strategy == operation_setting.CashbackStrategyPerHundred && (reward.FixedPerHundred == 0 || reward.RateBPS != 0)) ||
		(reward.Strategy != operation_setting.CashbackStrategyPerHundred && reward.FixedPerHundred != 0) {
		return errors.New("invalid cashback reward fixed amount")
	}
	if reward.CalculatedQuota < 0 || reward.CalculatedQuota > reward.BaseQuota || reward.RewardQuota < 0 || reward.RewardQuota > reward.CalculatedQuota {
		return errors.New("invalid cashback reward quota")
	}
	if reward.SettlementDays < operation_setting.CashbackMinSettlementDays || reward.SettlementDays > operation_setting.CashbackMaxSettlementDays {
		return errors.New("invalid cashback settlement days")
	}
	if !validCashbackReviewStatus(reward.ReviewStatus) || !validCashbackSettlementStatus(reward.SettlementStatus) || !validCashbackRiskLevel(reward.RiskLevel) ||
		reward.PaidAt <= 0 || reward.AvailableAt < reward.PaidAt {
		return errors.New("invalid cashback reward state")
	}
	if reward.SettlementStatus == CashbackSettlementIssued && (reward.ReviewStatus != CashbackReviewApproved || reward.IssuedAt <= 0) {
		return errors.New("issued cashback reward is missing approval evidence")
	}
	if strings.TrimSpace(reward.RiskSnapshot) == "" || strings.TrimSpace(reward.ConfigSnapshot) == "" {
		return errors.New("cashback reward snapshots are required")
	}
	if reward.NextSettlementAttemptAt < 0 || reward.RecoveredQuota < 0 || reward.OutstandingDebtQuota < 0 || reward.RecoveredQuota+reward.OutstandingDebtQuota > reward.RewardQuota {
		return errors.New("invalid cashback reward recovery")
	}
	return nil
}

func (link *CashbackDeviceLink) BeforeSave(_ *gorm.DB) error {
	if link.UserID <= 0 || len(link.DeviceFingerprintHash) != sha256.Size*2 || !validCashbackDeviceSignalStatus(link.DeviceSignalStatus) ||
		!validCashbackDeviceSource(link.Source) || link.FirstSeenAt <= 0 || link.LastSeenAt < link.FirstSeenAt {
		return errors.New("invalid cashback device link")
	}
	return nil
}

func ParseCashbackDeviceSignal(raw string) (hash string, status string) {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return "", CashbackDeviceSignalMissing
	}
	if len(raw) > 128 || !cashbackDeviceSignalPattern.MatchString(raw) {
		return "", CashbackDeviceSignalInvalid
	}
	digest := sha256.Sum256([]byte("cashback-device-signal-v1:" + strings.ToLower(raw)))
	return hex.EncodeToString(digest[:]), CashbackDeviceSignalValid
}

func HashCashbackUserAgent(userAgent string) string {
	userAgent = strings.TrimSpace(userAgent)
	if userAgent == "" || len(userAgent) > 1024 {
		return ""
	}
	digest := sha256.Sum256([]byte(userAgent))
	return hex.EncodeToString(digest[:])
}

func normalizeCashbackIP(ip string) string {
	ip = strings.TrimSpace(ip)
	parsed := net.ParseIP(ip)
	if parsed == nil {
		return ""
	}
	return parsed.String()
}

func RecordCashbackDeviceLink(userID int, rawSignal, ip, userAgent string, source CashbackDeviceSource) error {
	if userID <= 0 || !validCashbackDeviceSource(source) {
		return errors.New("invalid cashback device link input")
	}
	deviceHash, status := ParseCashbackDeviceSignal(rawSignal)
	deviceHash = cashbackDeviceLinkHash(userID, deviceHash)
	if DB == nil || !DB.Migrator().HasTable(&CashbackDeviceLink{}) {
		return nil
	}
	return upsertCashbackDeviceLinkTx(DB, userID, deviceHash, status, normalizeCashbackIP(ip), HashCashbackUserAgent(userAgent), source, time.Now().Unix())
}

func cashbackDeviceLinkHash(userID int, deviceHash string) string {
	if deviceHash != "" {
		return deviceHash
	}
	digest := sha256.Sum256([]byte("cashback-account-signal-v1:" + strconv.Itoa(userID)))
	return hex.EncodeToString(digest[:])
}

func upsertCashbackDeviceLinkTx(tx *gorm.DB, userID int, deviceHash, signalStatus, ip, userAgentHash string, source CashbackDeviceSource, now int64) error {
	if deviceHash == "" {
		return nil
	}
	link := CashbackDeviceLink{
		UserID:                userID,
		DeviceFingerprintHash: deviceHash,
		DeviceSignalStatus:    signalStatus,
		FirstSeenAt:           now,
		LastSeenAt:            now,
		FirstIP:               ip,
		LastIP:                ip,
		FirstUserAgentHash:    userAgentHash,
		LastUserAgentHash:     userAgentHash,
		Source:                source,
	}
	return tx.Clauses(clause.OnConflict{
		Columns: []clause.Column{{Name: "user_id"}, {Name: "device_fingerprint_hash"}},
		DoUpdates: clause.Assignments(map[string]interface{}{
			"device_signal_status": signalStatus,
			"last_seen_at":         now,
			"last_ip":              ip,
			"last_user_agent_hash": userAgentHash,
			"source":               source,
		}),
	}).Create(&link).Error
}

func InsertOnlineTopUp(topUp *TopUp, baseQuota int, metadata CashbackRequestMetadata) error {
	return DB.Transaction(func(tx *gorm.DB) error {
		return InsertOnlineTopUpTx(tx, topUp, baseQuota, metadata)
	})
}

// InsertOnlineTopUpTx creates the order and its cashback context inside the
// caller's transaction, so callers can commit other order records atomically.
func InsertOnlineTopUpTx(tx *gorm.DB, topUp *TopUp, baseQuota int, metadata CashbackRequestMetadata) error {
	if topUp == nil {
		return errors.New("top-up is required")
	}
	if baseQuota <= 0 || baseQuota > common.MaxWalletQuota || metadata.FaceAmount <= 0 || metadata.QuotaPerFaceUnit == "" {
		return ErrInvalidTopUpQuota
	}
	if metadata.IneligibleReason != "" && metadata.IneligibleReason != CashbackIneligiblePartnerOAuth {
		return ErrCashbackInvalidInput
	}
	excluded := metadata.IneligibleReason != ""
	if excluded {
		metadata.RequestIP, metadata.UserAgent, metadata.DeviceSignal = "", "", ""
	}
	if err := tx.Create(topUp).Error; err != nil {
		return err
	}
	firstEnabledAt, err := cashbackFirstEnabledAtTx(tx)
	if err != nil {
		return err
	}

	// Persist the activation decision with every new online order. Payment
	// completion must not try to reconstruct transaction ordering from two
	// second-resolution timestamps.
	orderPlacedAt, err := getDBTimestampOnStrict(tx)
	if err != nil {
		return err
	}
	eligibleAfterFirstEnable := firstEnabledAt > 0 && topUp.CreateTime >= firstEnabledAt && orderPlacedAt >= firstEnabledAt
	var campaignID int64
	if eligibleAfterFirstEnable && !excluded {
		setting, err := loadCashbackSettingTx(tx)
		if err != nil {
			return err
		}
		if setting.InviteeEnabled {
			var campaign CashbackCampaign
			err := tx.Where("start_at <= ? AND end_at > ? AND (stopped_at = 0 OR stopped_at > ?) AND start_at <= ? AND end_at > ?",
				orderPlacedAt, orderPlacedAt, orderPlacedAt, topUp.CreateTime, topUp.CreateTime).
				Order("id desc").First(&campaign).Error
			if err != nil && !errors.Is(err, gorm.ErrRecordNotFound) {
				return err
			}
			if err == nil {
				campaignID = campaign.ID
			}
		}
	}
	deviceHash, deviceStatus := ParseCashbackDeviceSignal(metadata.DeviceSignal)
	requestIP := normalizeCashbackIP(metadata.RequestIP)
	userAgentHash := HashCashbackUserAgent(metadata.UserAgent)
	context := CashbackOrderContext{
		TopUpID:                  topUp.Id,
		CampaignID:               campaignID,
		TradeNo:                  topUp.TradeNo,
		UserID:                   topUp.UserId,
		PaymentProvider:          topUp.PaymentProvider,
		BaseQuota:                baseQuota,
		FaceAmount:               metadata.FaceAmount,
		QuotaPerFaceUnit:         metadata.QuotaPerFaceUnit,
		RequestIP:                requestIP,
		RequestUserAgentHash:     userAgentHash,
		DeviceFingerprintHash:    deviceHash,
		DeviceSignalStatus:       deviceStatus,
		EligibleAfterFirstEnable: eligibleAfterFirstEnable,
		IneligibleReason:         metadata.IneligibleReason,
	}
	if err := tx.Create(&context).Error; err != nil {
		return err
	}
	if excluded {
		return nil
	}
	return upsertCashbackDeviceLinkTx(
		tx,
		topUp.UserId,
		cashbackDeviceLinkHash(topUp.UserId, deviceHash),
		deviceStatus,
		requestIP,
		userAgentHash,
		CashbackDeviceSourceTopUp,
		time.Now().Unix(),
	)
}

func cashbackFirstEnabledAtTx(tx *gorm.DB) (int64, error) {
	if tx == nil {
		return 0, errors.New("database is required")
	}
	if !tx.Migrator().HasTable(&Option{}) {
		return 0, nil
	}
	var option Option
	key := operation_setting.CashbackSettingName + ".first_enabled_at"
	if err := tx.Where(map[string]any{"key": key}).First(&option).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return 0, nil
		}
		return 0, err
	}
	firstEnabledAt, err := strconv.ParseInt(strings.TrimSpace(option.Value), 10, 64)
	if err != nil || firstEnabledAt < 0 {
		return 0, errors.New("invalid cashback first enabled time")
	}
	return firstEnabledAt, nil
}

func cashbackOrderContextRequiredTx(tx *gorm.DB, topUp *TopUp) (bool, error) {
	if topUp == nil {
		return false, errors.New("top-up is required")
	}
	firstEnabledAt, err := cashbackFirstEnabledAtTx(tx)
	if err != nil {
		return false, err
	}
	// Context-less equality is reserved for legacy/in-flight orders created
	// before the activation commit. New code always persists an order context,
	// including while cashback is disabled.
	return firstEnabledAt > 0 && topUp.CreateTime > firstEnabledAt, nil
}

func lockCashbackUsersTx(tx *gorm.DB, userIDs ...int) (map[int]User, error) {
	unique := make(map[int]struct{}, len(userIDs))
	ids := make([]int, 0, len(userIDs))
	for _, userID := range userIDs {
		if userID <= 0 {
			continue
		}
		if _, exists := unique[userID]; exists {
			continue
		}
		unique[userID] = struct{}{}
		ids = append(ids, userID)
	}
	sort.Ints(ids)
	if len(ids) == 0 {
		return map[int]User{}, nil
	}
	var users []User
	if err := lockForUpdate(tx.Unscoped()).Where("id IN ?", ids).Order("id asc").Find(&users).Error; err != nil {
		return nil, err
	}
	result := make(map[int]User, len(users))
	for _, user := range users {
		result[user.Id] = user
	}
	return result, nil
}

func eligibleCashbackCompletionSource(source CashbackCompletionSource) bool {
	return source == CashbackCompletionProviderCallback || source == CashbackCompletionVerifiedReturn
}

func CashbackDeviceHashShort(hash string) string {
	if len(hash) <= 12 {
		return hash
	}
	return hash[:12]
}

func cashbackQuotedTradeNoColumn() string {
	if common.UsingMainDatabase(common.DatabaseTypePostgreSQL) {
		return `"trade_no"`
	}
	return "`trade_no`"
}

func cashbackTopUpRefQuery(tx *gorm.DB, tradeNo string) *gorm.DB {
	return tx.Where(fmt.Sprintf("%s = ?", cashbackQuotedTradeNoColumn()), tradeNo)
}
