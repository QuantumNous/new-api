package model

import (
	"errors"
	"fmt"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

const (
	SubscriptionDiscountEntryTypeGrantInvitee = "grant_invitee"
	SubscriptionDiscountEntryTypeGrantInviter = "grant_inviter"
	SubscriptionDiscountEntryTypeMigration    = "migration"
	SubscriptionDiscountEntryTypeReserve      = "reserve"
	SubscriptionDiscountEntryTypeCommit       = "commit"
	SubscriptionDiscountEntryTypeRelease      = "release"
)

var (
	ErrSubscriptionDiscountInvalidAmount       = errors.New("subscription discount invalid amount")
	ErrSubscriptionDiscountInsufficient        = errors.New("subscription discount insufficient available credit")
	ErrSubscriptionDiscountInvalidReservation  = errors.New("subscription discount invalid reservation")
	ErrSubscriptionDiscountReservationNotFound = errors.New("subscription discount reservation not found")
	ErrSubscriptionDiscountInvalidAccountState = errors.New("subscription discount invalid account state")
	ErrSubscriptionDiscountImmutableEntry      = errors.New("subscription discount entry is immutable")
)

type SubscriptionDiscountAccount struct {
	UserID            int   `json:"user_id" gorm:"primaryKey;autoIncrement:false"`
	AvailableUSDMinor int64 `json:"available_usd_minor" gorm:"type:bigint;not null;default:0"`
	ReservedUSDMinor  int64 `json:"reserved_usd_minor" gorm:"type:bigint;not null;default:0"`
	CreatedAt         int64 `json:"created_at" gorm:"type:bigint;not null;default:0"`
	UpdatedAt         int64 `json:"updated_at" gorm:"type:bigint;not null;default:0"`
}

func (a *SubscriptionDiscountAccount) BeforeCreate(tx *gorm.DB) error {
	return validateSubscriptionDiscountAccount(a)
}

func (a *SubscriptionDiscountAccount) BeforeUpdate(tx *gorm.DB) error {
	if a.UserID == 0 {
		return nil
	}
	return validateSubscriptionDiscountAccount(a)
}

type SubscriptionDiscountEntry struct {
	ID int64 `json:"id"`

	UserID                 int    `json:"user_id" gorm:"not null;index"`
	EntryType              string `json:"entry_type" gorm:"type:varchar(32);not null;default:'';index"`
	AvailableDeltaUSDMinor int64  `json:"available_delta_usd_minor" gorm:"type:bigint;not null;default:0"`
	ReservedDeltaUSDMinor  int64  `json:"reserved_delta_usd_minor" gorm:"type:bigint;not null;default:0"`
	AvailableAfterUSDMinor int64  `json:"available_after_usd_minor" gorm:"type:bigint;not null;default:0"`
	ReservedAfterUSDMinor  int64  `json:"reserved_after_usd_minor" gorm:"type:bigint;not null;default:0"`
	SourceType             string `json:"source_type" gorm:"type:varchar(64);not null;default:'';index"`
	SourceKey              string `json:"source_key" gorm:"type:varchar(255);not null;default:'';index"`
	OrderID                int    `json:"order_id" gorm:"not null;default:0;index"`
	TradeNo                string `json:"trade_no" gorm:"type:varchar(255);not null;default:'';index"`
	PaymentCurrency        string `json:"payment_currency" gorm:"type:varchar(16);not null;default:''"`
	AppliedAmountMinor     int64  `json:"applied_amount_minor" gorm:"type:bigint;not null;default:0"`
	PricingSnapshot        string `json:"pricing_snapshot" gorm:"type:text"`
	IdempotencyKey         string `json:"idempotency_key" gorm:"type:varchar(255);not null;uniqueIndex"`
	ExpiresAt              int64  `json:"expires_at" gorm:"type:bigint;not null;default:0;index"`
	CreatedAt              int64  `json:"created_at" gorm:"type:bigint;not null;default:0;index"`
}

func (e *SubscriptionDiscountEntry) BeforeUpdate(tx *gorm.DB) error {
	return ErrSubscriptionDiscountImmutableEntry
}

func (e *SubscriptionDiscountEntry) BeforeDelete(tx *gorm.DB) error {
	return ErrSubscriptionDiscountImmutableEntry
}

type SubscriptionDiscountGrantInput struct {
	UserID          int
	USDMinor        int64
	EntryType       string
	SourceType      string
	SourceKey       string
	IdempotencyKey  string
	PricingSnapshot string
}

type SubscriptionDiscountReservationInput struct {
	UserID             int
	USDMinor           int64
	OrderID            int
	TradeNo            string
	PaymentCurrency    string
	AppliedAmountMinor int64
	PricingSnapshot    string
	IdempotencyKey     string
	ExpiresAt          int64
}

func GetSubscriptionDiscountAccount(userID int) (*SubscriptionDiscountAccount, error) {
	if userID <= 0 {
		return nil, ErrSubscriptionDiscountInvalidAccountState
	}
	var account SubscriptionDiscountAccount
	err := DB.Where("user_id = ?", userID).First(&account).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return &SubscriptionDiscountAccount{UserID: userID}, nil
	}
	if err != nil {
		return nil, err
	}
	if err := validateSubscriptionDiscountAccount(&account); err != nil {
		return nil, err
	}
	return &account, nil
}

func GrantSubscriptionDiscountTx(tx *gorm.DB, input SubscriptionDiscountGrantInput) (bool, error) {
	if input.UserID <= 0 {
		return false, ErrSubscriptionDiscountInvalidAccountState
	}
	if input.USDMinor < 0 {
		return false, ErrSubscriptionDiscountInvalidAmount
	}
	if input.USDMinor == 0 {
		return false, nil
	}
	if strings.TrimSpace(input.IdempotencyKey) == "" {
		return false, ErrSubscriptionDiscountInvalidReservation
	}
	entryType := strings.TrimSpace(input.EntryType)
	if entryType == "" {
		entryType = SubscriptionDiscountEntryTypeGrantInvitee
	}
	if err := validateSubscriptionDiscountPricingSnapshot(input.PricingSnapshot); err != nil {
		return false, err
	}

	account, now, err := lockSubscriptionDiscountAccountTx(tx, input.UserID)
	if err != nil {
		return false, err
	}
	afterAvailable := account.AvailableUSDMinor + input.USDMinor
	entry := SubscriptionDiscountEntry{
		UserID:                 input.UserID,
		EntryType:              entryType,
		AvailableDeltaUSDMinor: input.USDMinor,
		ReservedDeltaUSDMinor:  0,
		AvailableAfterUSDMinor: afterAvailable,
		ReservedAfterUSDMinor:  account.ReservedUSDMinor,
		SourceType:             input.SourceType,
		SourceKey:              input.SourceKey,
		PricingSnapshot:        input.PricingSnapshot,
		IdempotencyKey:         input.IdempotencyKey,
		CreatedAt:              now,
	}
	created, err := createSubscriptionDiscountEntryTx(tx, &entry)
	if err != nil || !created {
		return created, err
	}
	if err := tx.Model(&SubscriptionDiscountAccount{}).
		Where("user_id = ?", input.UserID).
		Updates(map[string]any{
			"available_usd_minor": afterAvailable,
			"reserved_usd_minor":  account.ReservedUSDMinor,
			"updated_at":          now,
		}).Error; err != nil {
		return false, err
	}
	return true, nil
}

func ReserveSubscriptionDiscountTx(tx *gorm.DB, input SubscriptionDiscountReservationInput) (bool, error) {
	if input.UserID <= 0 {
		return false, ErrSubscriptionDiscountInvalidAccountState
	}
	if input.USDMinor <= 0 {
		return false, ErrSubscriptionDiscountInvalidAmount
	}
	if strings.TrimSpace(input.IdempotencyKey) == "" {
		return false, ErrSubscriptionDiscountInvalidReservation
	}
	if err := validateSubscriptionDiscountPricingSnapshot(input.PricingSnapshot); err != nil {
		return false, err
	}

	account, now, err := lockSubscriptionDiscountAccountTx(tx, input.UserID)
	if err != nil {
		return false, err
	}
	if account.AvailableUSDMinor < input.USDMinor {
		return false, ErrSubscriptionDiscountInsufficient
	}
	afterAvailable := account.AvailableUSDMinor - input.USDMinor
	afterReserved := account.ReservedUSDMinor + input.USDMinor
	entry := SubscriptionDiscountEntry{
		UserID:                 input.UserID,
		EntryType:              SubscriptionDiscountEntryTypeReserve,
		AvailableDeltaUSDMinor: -input.USDMinor,
		ReservedDeltaUSDMinor:  input.USDMinor,
		AvailableAfterUSDMinor: afterAvailable,
		ReservedAfterUSDMinor:  afterReserved,
		SourceType:             SubscriptionDiscountEntryTypeReserve,
		SourceKey:              input.IdempotencyKey,
		OrderID:                input.OrderID,
		TradeNo:                input.TradeNo,
		PaymentCurrency:        input.PaymentCurrency,
		AppliedAmountMinor:     input.AppliedAmountMinor,
		PricingSnapshot:        input.PricingSnapshot,
		IdempotencyKey:         input.IdempotencyKey,
		ExpiresAt:              input.ExpiresAt,
		CreatedAt:              now,
	}
	created, err := createSubscriptionDiscountEntryTx(tx, &entry)
	if err != nil || !created {
		return created, err
	}
	if err := tx.Model(&SubscriptionDiscountAccount{}).
		Where("user_id = ? AND available_usd_minor >= ?", input.UserID, input.USDMinor).
		Updates(map[string]any{
			"available_usd_minor": afterAvailable,
			"reserved_usd_minor":  afterReserved,
			"updated_at":          now,
		}).Error; err != nil {
		return false, err
	}
	return true, nil
}

func CommitSubscriptionDiscountTx(tx *gorm.DB, reservationKey string) (bool, error) {
	return closeSubscriptionDiscountReservationTx(tx, reservationKey, SubscriptionDiscountEntryTypeCommit)
}

func ReleaseSubscriptionDiscountTx(tx *gorm.DB, reservationKey string) (bool, error) {
	return closeSubscriptionDiscountReservationTx(tx, reservationKey, SubscriptionDiscountEntryTypeRelease)
}

func closeSubscriptionDiscountReservationTx(tx *gorm.DB, reservationKey string, entryType string) (bool, error) {
	if strings.TrimSpace(reservationKey) == "" {
		return false, ErrSubscriptionDiscountInvalidReservation
	}
	reservation, err := getSubscriptionDiscountReservationEntryTx(tx, reservationKey)
	if err != nil {
		return false, err
	}
	account, now, err := lockSubscriptionDiscountAccountTx(tx, reservation.UserID)
	if err != nil {
		return false, err
	}
	terminalExists, err := subscriptionDiscountTerminalExistsTx(tx, reservationKey)
	if err != nil || terminalExists {
		return false, err
	}

	amount := reservation.ReservedDeltaUSDMinor
	if amount <= 0 {
		return false, ErrSubscriptionDiscountInvalidReservation
	}
	if account.ReservedUSDMinor < amount {
		return false, ErrSubscriptionDiscountInvalidAccountState
	}

	availableDelta := int64(0)
	if entryType == SubscriptionDiscountEntryTypeRelease {
		availableDelta = amount
	}
	reservedDelta := -amount
	afterAvailable := account.AvailableUSDMinor + availableDelta
	afterReserved := account.ReservedUSDMinor + reservedDelta
	if afterAvailable < 0 || afterReserved < 0 {
		return false, ErrSubscriptionDiscountInvalidAccountState
	}

	entry := SubscriptionDiscountEntry{
		UserID:                 reservation.UserID,
		EntryType:              entryType,
		AvailableDeltaUSDMinor: availableDelta,
		ReservedDeltaUSDMinor:  reservedDelta,
		AvailableAfterUSDMinor: afterAvailable,
		ReservedAfterUSDMinor:  afterReserved,
		SourceType:             entryType,
		SourceKey:              reservationKey,
		OrderID:                reservation.OrderID,
		TradeNo:                reservation.TradeNo,
		PaymentCurrency:        reservation.PaymentCurrency,
		AppliedAmountMinor:     reservation.AppliedAmountMinor,
		PricingSnapshot:        reservation.PricingSnapshot,
		IdempotencyKey:         reservationKey + ":" + entryType,
		CreatedAt:              now,
	}
	created, err := createSubscriptionDiscountEntryTx(tx, &entry)
	if err != nil || !created {
		return created, err
	}
	if err := tx.Model(&SubscriptionDiscountAccount{}).
		Where("user_id = ? AND reserved_usd_minor >= ?", reservation.UserID, amount).
		Updates(map[string]any{
			"available_usd_minor": afterAvailable,
			"reserved_usd_minor":  afterReserved,
			"updated_at":          now,
		}).Error; err != nil {
		return false, err
	}
	return true, nil
}

func lockSubscriptionDiscountAccountTx(tx *gorm.DB, userID int) (*SubscriptionDiscountAccount, int64, error) {
	now := getDBTimestampTx(tx)
	account := SubscriptionDiscountAccount{
		UserID:            userID,
		AvailableUSDMinor: 0,
		ReservedUSDMinor:  0,
		CreatedAt:         now,
		UpdatedAt:         now,
	}
	if err := tx.Clauses(clause.OnConflict{DoNothing: true}).Create(&account).Error; err != nil {
		return nil, 0, err
	}
	if common.UsingSQLite {
		if err := tx.Model(&SubscriptionDiscountAccount{}).
			Where("user_id = ?", userID).
			Update("updated_at", gorm.Expr("updated_at")).Error; err != nil {
			return nil, 0, err
		}
	}
	query := tx
	if common.UsingMySQL || common.UsingPostgreSQL {
		query = query.Clauses(clause.Locking{Strength: "UPDATE"})
	}
	if err := query.Where("user_id = ?", userID).First(&account).Error; err != nil {
		return nil, 0, err
	}
	if err := validateSubscriptionDiscountAccount(&account); err != nil {
		return nil, 0, err
	}
	return &account, now, nil
}

func createSubscriptionDiscountEntryTx(tx *gorm.DB, entry *SubscriptionDiscountEntry) (bool, error) {
	result := tx.Clauses(clause.OnConflict{DoNothing: true}).Create(entry)
	if result.Error != nil {
		return false, result.Error
	}
	return result.RowsAffected > 0, nil
}

func getSubscriptionDiscountReservationEntryTx(tx *gorm.DB, reservationKey string) (*SubscriptionDiscountEntry, error) {
	var entry SubscriptionDiscountEntry
	err := tx.Where("idempotency_key = ?", reservationKey).First(&entry).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, ErrSubscriptionDiscountReservationNotFound
	}
	if err != nil {
		return nil, err
	}
	if entry.EntryType != SubscriptionDiscountEntryTypeReserve || entry.ReservedDeltaUSDMinor <= 0 {
		return nil, ErrSubscriptionDiscountInvalidReservation
	}
	return &entry, nil
}

func subscriptionDiscountTerminalExistsTx(tx *gorm.DB, reservationKey string) (bool, error) {
	var count int64
	err := tx.Model(&SubscriptionDiscountEntry{}).
		Where("source_key = ? AND entry_type IN ?", reservationKey,
			[]string{SubscriptionDiscountEntryTypeCommit, SubscriptionDiscountEntryTypeRelease}).
		Count(&count).Error
	return count > 0, err
}

func validateSubscriptionDiscountAccount(account *SubscriptionDiscountAccount) error {
	if account == nil || account.UserID <= 0 || account.AvailableUSDMinor < 0 || account.ReservedUSDMinor < 0 {
		return ErrSubscriptionDiscountInvalidAccountState
	}
	return nil
}

func validateSubscriptionDiscountPricingSnapshot(snapshot string) error {
	if strings.TrimSpace(snapshot) == "" {
		return nil
	}
	var raw any
	if err := common.Unmarshal([]byte(snapshot), &raw); err != nil {
		return fmt.Errorf("%w: invalid pricing snapshot", ErrSubscriptionDiscountInvalidReservation)
	}
	return nil
}

func getDBTimestampTx(tx *gorm.DB) int64 {
	var ts int64
	var err error
	switch {
	case common.UsingPostgreSQL:
		err = tx.Raw("SELECT EXTRACT(EPOCH FROM NOW())::bigint").Scan(&ts).Error
	case common.UsingSQLite:
		err = tx.Raw("SELECT strftime('%s','now')").Scan(&ts).Error
	default:
		err = tx.Raw("SELECT UNIX_TIMESTAMP()").Scan(&ts).Error
	}
	if err != nil || ts <= 0 {
		return common.GetTimestamp()
	}
	return ts
}
