package model

import (
	"errors"
	"math"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/shopspring/decimal"
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

	subscriptionDiscountMaxBusinessKeyLength         = 191
	subscriptionDiscountMaxTerminalIdempotencyLength = 191
	subscriptionDiscountMaxSourceTypeLength          = 64
	subscriptionDiscountMaxTradeNoLength             = 255
)

var (
	ErrSubscriptionDiscountInvalidAmount       = errors.New("subscription discount invalid amount")
	ErrSubscriptionDiscountInsufficient        = errors.New("subscription discount insufficient available credit")
	ErrSubscriptionDiscountInvalidReservation  = errors.New("subscription discount invalid reservation")
	ErrSubscriptionDiscountReservationNotFound = errors.New("subscription discount reservation not found")
	ErrSubscriptionDiscountInvalidAccountState = errors.New("subscription discount invalid account state")
	ErrSubscriptionDiscountImmutableEntry      = errors.New("subscription discount entry is immutable")
	ErrSubscriptionDiscountInvalidEntryType    = errors.New("subscription discount invalid entry type")
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

	UserID                 int     `json:"user_id" gorm:"not null;index"`
	EntryType              string  `json:"entry_type" gorm:"type:varchar(32);not null;default:'';index"`
	AvailableDeltaUSDMinor int64   `json:"available_delta_usd_minor" gorm:"type:bigint;not null;default:0"`
	ReservedDeltaUSDMinor  int64   `json:"reserved_delta_usd_minor" gorm:"type:bigint;not null;default:0"`
	AvailableAfterUSDMinor int64   `json:"available_after_usd_minor" gorm:"type:bigint;not null;default:0"`
	ReservedAfterUSDMinor  int64   `json:"reserved_after_usd_minor" gorm:"type:bigint;not null;default:0"`
	SourceType             string  `json:"source_type" gorm:"type:varchar(64);not null;default:'';index"`
	SourceKey              string  `json:"source_key" gorm:"type:varchar(191);not null;default:'';index"`
	OrderID                int     `json:"order_id" gorm:"not null;default:0;index"`
	TradeNo                string  `json:"trade_no" gorm:"type:varchar(255);not null;default:'';index"`
	PaymentCurrency        string  `json:"payment_currency" gorm:"type:varchar(16);not null;default:''"`
	AppliedAmountMinor     int64   `json:"applied_amount_minor" gorm:"type:bigint;not null;default:0"`
	PricingSnapshot        string  `json:"pricing_snapshot" gorm:"type:text"`
	IdempotencyKey         string  `json:"idempotency_key" gorm:"type:varchar(255);not null;uniqueIndex"`
	TerminalReservationKey *string `json:"terminal_reservation_key,omitempty" gorm:"type:varchar(255);uniqueIndex"`
	ExpiresAt              int64   `json:"expires_at" gorm:"type:bigint;not null;default:0;index"`
	CreatedAt              int64   `json:"created_at" gorm:"type:bigint;not null;default:0;index"`
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
	entryType := strings.TrimSpace(input.EntryType)
	if !isValidSubscriptionDiscountGrantEntryType(entryType) {
		return false, ErrSubscriptionDiscountInvalidEntryType
	}
	sourceType, sourceKey, idempotencyKey, err := normalizeSubscriptionDiscountGrantInput(input)
	if err != nil {
		return false, err
	}
	if err := validateSubscriptionDiscountPricingSnapshot(input.PricingSnapshot); err != nil {
		return false, err
	}
	exists, err := subscriptionDiscountIdempotencyExistsTx(tx, idempotencyKey)
	if err != nil || exists {
		return false, err
	}

	account, now, accountCreated, err := lockSubscriptionDiscountAccountTx(tx, input.UserID)
	if err != nil {
		return false, err
	}
	afterAvailable, ok := checkedAddInt64(account.AvailableUSDMinor, input.USDMinor)
	if !ok {
		if accountCreated {
			if cleanupErr := deleteNewEmptySubscriptionDiscountAccountTx(tx, input.UserID); cleanupErr != nil {
				return false, cleanupErr
			}
		}
		return false, ErrSubscriptionDiscountInvalidAmount
	}
	entry := SubscriptionDiscountEntry{
		UserID:                 input.UserID,
		EntryType:              entryType,
		AvailableDeltaUSDMinor: input.USDMinor,
		ReservedDeltaUSDMinor:  0,
		AvailableAfterUSDMinor: afterAvailable,
		ReservedAfterUSDMinor:  account.ReservedUSDMinor,
		SourceType:             sourceType,
		SourceKey:              sourceKey,
		PricingSnapshot:        input.PricingSnapshot,
		IdempotencyKey:         idempotencyKey,
		CreatedAt:              now,
	}
	created, err := createSubscriptionDiscountEntryTx(tx, &entry)
	if err != nil || !created {
		if !created && accountCreated {
			if cleanupErr := deleteNewEmptySubscriptionDiscountAccountTx(tx, input.UserID); cleanupErr != nil {
				return false, cleanupErr
			}
		}
		return created, err
	}
	update := tx.Model(&SubscriptionDiscountAccount{}).
		Where("user_id = ?", input.UserID).
		Updates(map[string]any{
			"available_usd_minor": afterAvailable,
			"reserved_usd_minor":  account.ReservedUSDMinor,
			"updated_at":          now,
		})
	if update.Error != nil {
		return false, update.Error
	}
	if update.RowsAffected != 1 {
		return false, ErrSubscriptionDiscountInvalidAccountState
	}
	return true, nil
}

func subscriptionDiscountUSDToMinor(usd float64) (int64, error) {
	if math.IsNaN(usd) || math.IsInf(usd, 0) || usd < 0 {
		return 0, ErrSubscriptionDiscountInvalidAmount
	}
	minor := decimal.NewFromFloat(usd).
		Mul(decimal.NewFromInt(100)).
		Round(0)
	if minor.GreaterThan(decimal.NewFromInt(math.MaxInt64)) {
		return 0, ErrSubscriptionDiscountInvalidAmount
	}
	return minor.IntPart(), nil
}

func ReserveSubscriptionDiscountTx(tx *gorm.DB, input SubscriptionDiscountReservationInput) (bool, error) {
	if input.UserID <= 0 {
		return false, ErrSubscriptionDiscountInvalidAccountState
	}
	if input.USDMinor <= 0 {
		return false, ErrSubscriptionDiscountInvalidAmount
	}
	normalized, err := normalizeSubscriptionDiscountReservationInput(input)
	if err != nil {
		return false, err
	}
	if err := validateSubscriptionDiscountPricingSnapshot(input.PricingSnapshot); err != nil {
		return false, err
	}
	exists, err := subscriptionDiscountIdempotencyExistsTx(tx, normalized.idempotencyKey)
	if err != nil || exists {
		return false, err
	}

	account, now, accountCreated, err := lockSubscriptionDiscountAccountTx(tx, input.UserID)
	if err != nil {
		return false, err
	}
	if account.AvailableUSDMinor < input.USDMinor {
		if accountCreated {
			if cleanupErr := deleteNewEmptySubscriptionDiscountAccountTx(tx, input.UserID); cleanupErr != nil {
				return false, cleanupErr
			}
		}
		return false, ErrSubscriptionDiscountInsufficient
	}
	afterAvailable, ok := checkedSubInt64(account.AvailableUSDMinor, input.USDMinor)
	if !ok {
		return false, ErrSubscriptionDiscountInvalidAccountState
	}
	afterReserved, ok := checkedAddInt64(account.ReservedUSDMinor, input.USDMinor)
	if !ok {
		if accountCreated {
			if cleanupErr := deleteNewEmptySubscriptionDiscountAccountTx(tx, input.UserID); cleanupErr != nil {
				return false, cleanupErr
			}
		}
		return false, ErrSubscriptionDiscountInvalidAccountState
	}
	entry := SubscriptionDiscountEntry{
		UserID:                 input.UserID,
		EntryType:              SubscriptionDiscountEntryTypeReserve,
		AvailableDeltaUSDMinor: -input.USDMinor,
		ReservedDeltaUSDMinor:  input.USDMinor,
		AvailableAfterUSDMinor: afterAvailable,
		ReservedAfterUSDMinor:  afterReserved,
		SourceType:             SubscriptionDiscountEntryTypeReserve,
		SourceKey:              normalized.idempotencyKey,
		OrderID:                normalized.orderID,
		TradeNo:                normalized.tradeNo,
		PaymentCurrency:        normalized.paymentCurrency,
		AppliedAmountMinor:     normalized.appliedAmountMinor,
		PricingSnapshot:        input.PricingSnapshot,
		IdempotencyKey:         normalized.idempotencyKey,
		ExpiresAt:              normalized.expiresAt,
		CreatedAt:              now,
	}
	created, err := createSubscriptionDiscountEntryTx(tx, &entry)
	if err != nil || !created {
		if !created && accountCreated {
			if cleanupErr := deleteNewEmptySubscriptionDiscountAccountTx(tx, input.UserID); cleanupErr != nil {
				return false, cleanupErr
			}
		}
		return created, err
	}
	update := tx.Model(&SubscriptionDiscountAccount{}).
		Where("user_id = ? AND available_usd_minor >= ?", input.UserID, input.USDMinor).
		Updates(map[string]any{
			"available_usd_minor": afterAvailable,
			"reserved_usd_minor":  afterReserved,
			"updated_at":          now,
		})
	if update.Error != nil {
		return false, update.Error
	}
	if update.RowsAffected != 1 {
		return false, ErrSubscriptionDiscountInvalidAccountState
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
	reservationKey, err := normalizeSubscriptionDiscountTerminalReservationKey(reservationKey, entryType)
	if err != nil {
		return false, ErrSubscriptionDiscountInvalidReservation
	}
	reservation, err := getSubscriptionDiscountReservationEntryTx(tx, reservationKey)
	if err != nil {
		return false, err
	}
	account, now, _, err := lockSubscriptionDiscountAccountTx(tx, reservation.UserID)
	if err != nil {
		return false, err
	}
	terminalExists, err := subscriptionDiscountTerminalMarkerExistsTx(tx, reservationKey)
	if err != nil || terminalExists {
		return false, err
	}
	amount := reservation.ReservedDeltaUSDMinor
	if amount <= 0 {
		return false, ErrSubscriptionDiscountInvalidReservation
	}

	availableDelta := int64(0)
	if entryType == SubscriptionDiscountEntryTypeRelease {
		availableDelta = amount
	}
	reservedDelta := -amount
	afterAvailable, ok := checkedAddInt64(account.AvailableUSDMinor, availableDelta)
	if !ok {
		return false, ErrSubscriptionDiscountInvalidAccountState
	}
	afterReserved, ok := checkedAddInt64(account.ReservedUSDMinor, reservedDelta)
	if !ok || afterReserved < 0 {
		return false, ErrSubscriptionDiscountInvalidAccountState
	}

	terminalReservationKey := reservationKey
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
		TerminalReservationKey: &terminalReservationKey,
		CreatedAt:              now,
	}
	created, err := createSubscriptionDiscountEntryTx(tx, &entry)
	if err != nil || !created {
		return created, err
	}
	if account.ReservedUSDMinor < amount {
		return false, ErrSubscriptionDiscountInvalidAccountState
	}
	update := tx.Model(&SubscriptionDiscountAccount{}).
		Where("user_id = ? AND reserved_usd_minor >= ?", reservation.UserID, amount).
		Updates(map[string]any{
			"available_usd_minor": afterAvailable,
			"reserved_usd_minor":  afterReserved,
			"updated_at":          now,
		})
	if update.Error != nil {
		return false, update.Error
	}
	if update.RowsAffected != 1 {
		return false, ErrSubscriptionDiscountInvalidAccountState
	}
	return true, nil
}

func lockSubscriptionDiscountAccountTx(tx *gorm.DB, userID int) (*SubscriptionDiscountAccount, int64, bool, error) {
	now := getDBTimestampTx(tx)
	account := SubscriptionDiscountAccount{
		UserID:            userID,
		AvailableUSDMinor: 0,
		ReservedUSDMinor:  0,
		CreatedAt:         now,
		UpdatedAt:         now,
	}
	if common.UsingSQLite {
		err := tx.Where("user_id = ?", userID).First(&account).Error
		if errors.Is(err, gorm.ErrRecordNotFound) {
			insert := tx.Clauses(clause.OnConflict{DoNothing: true}).Create(&account)
			if insert.Error != nil {
				return nil, 0, false, insert.Error
			}
			if err := tx.Where("user_id = ?", userID).First(&account).Error; err != nil {
				return nil, 0, false, err
			}
			if err := validateSubscriptionDiscountAccount(&account); err != nil {
				return nil, 0, false, err
			}
			return &account, now, insert.RowsAffected > 0, nil
		}
		if err != nil {
			return nil, 0, false, err
		}
		if err := retrySQLiteBusy(func() error {
			return tx.Model(&SubscriptionDiscountAccount{}).
				Where("user_id = ?", userID).
				Update("updated_at", gorm.Expr("updated_at")).Error
		}); err != nil {
			return nil, 0, false, err
		}
		if err := tx.Where("user_id = ?", userID).First(&account).Error; err != nil {
			return nil, 0, false, err
		}
		if err := validateSubscriptionDiscountAccount(&account); err != nil {
			return nil, 0, false, err
		}
		return &account, now, false, nil
	}
	insert := tx.Clauses(clause.OnConflict{DoNothing: true}).Create(&account)
	if insert.Error != nil {
		return nil, 0, false, insert.Error
	}
	accountCreated := insert.RowsAffected > 0
	query := tx
	if common.UsingMySQL || common.UsingPostgreSQL {
		query = query.Clauses(clause.Locking{Strength: "UPDATE"})
	}
	if err := query.Where("user_id = ?", userID).First(&account).Error; err != nil {
		return nil, 0, false, err
	}
	if err := validateSubscriptionDiscountAccount(&account); err != nil {
		return nil, 0, false, err
	}
	return &account, now, accountCreated, nil
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

func subscriptionDiscountIdempotencyExistsTx(tx *gorm.DB, idempotencyKey string) (bool, error) {
	var count int64
	err := tx.Model(&SubscriptionDiscountEntry{}).
		Where("idempotency_key = ?", idempotencyKey).
		Count(&count).Error
	return count > 0, err
}

func subscriptionDiscountTerminalMarkerExistsTx(tx *gorm.DB, reservationKey string) (bool, error) {
	var count int64
	err := tx.Model(&SubscriptionDiscountEntry{}).
		Where("terminal_reservation_key = ?", reservationKey).
		Count(&count).Error
	return count > 0, err
}

func deleteNewEmptySubscriptionDiscountAccountTx(tx *gorm.DB, userID int) error {
	return tx.Where("user_id = ? AND available_usd_minor = 0 AND reserved_usd_minor = 0", userID).
		Delete(&SubscriptionDiscountAccount{}).Error
}

func isValidSubscriptionDiscountGrantEntryType(entryType string) bool {
	switch entryType {
	case SubscriptionDiscountEntryTypeGrantInvitee, SubscriptionDiscountEntryTypeGrantInviter, SubscriptionDiscountEntryTypeMigration:
		return true
	default:
		return false
	}
}

type normalizedSubscriptionDiscountReservationInput struct {
	idempotencyKey     string
	orderID            int
	tradeNo            string
	paymentCurrency    string
	appliedAmountMinor int64
	expiresAt          int64
}

func normalizeSubscriptionDiscountGrantInput(input SubscriptionDiscountGrantInput) (string, string, string, error) {
	sourceType := strings.TrimSpace(input.SourceType)
	if sourceType == "" || len(sourceType) > subscriptionDiscountMaxSourceTypeLength {
		return "", "", "", ErrSubscriptionDiscountInvalidReservation
	}
	sourceKey, err := normalizeSubscriptionDiscountBusinessKey(input.SourceKey)
	if err != nil {
		return "", "", "", err
	}
	idempotencyKey, err := normalizeSubscriptionDiscountBusinessKey(input.IdempotencyKey)
	if err != nil {
		return "", "", "", err
	}
	return sourceType, sourceKey, idempotencyKey, nil
}

func normalizeSubscriptionDiscountReservationInput(input SubscriptionDiscountReservationInput) (normalizedSubscriptionDiscountReservationInput, error) {
	idempotencyKey, err := normalizeSubscriptionDiscountTerminalReservationKey(input.IdempotencyKey, SubscriptionDiscountEntryTypeRelease)
	if err != nil {
		return normalizedSubscriptionDiscountReservationInput{}, err
	}
	tradeNo := strings.TrimSpace(input.TradeNo)
	if tradeNo == "" || len(tradeNo) > subscriptionDiscountMaxTradeNoLength {
		return normalizedSubscriptionDiscountReservationInput{}, ErrSubscriptionDiscountInvalidReservation
	}
	paymentCurrency, err := normalizeSubscriptionDiscountCurrency(input.PaymentCurrency)
	if err != nil {
		return normalizedSubscriptionDiscountReservationInput{}, err
	}
	if input.OrderID < 0 || input.AppliedAmountMinor < 0 || input.ExpiresAt < 0 {
		return normalizedSubscriptionDiscountReservationInput{}, ErrSubscriptionDiscountInvalidReservation
	}
	return normalizedSubscriptionDiscountReservationInput{
		idempotencyKey:     idempotencyKey,
		orderID:            input.OrderID,
		tradeNo:            tradeNo,
		paymentCurrency:    paymentCurrency,
		appliedAmountMinor: input.AppliedAmountMinor,
		expiresAt:          input.ExpiresAt,
	}, nil
}

func normalizeSubscriptionDiscountTerminalReservationKey(reservationKey string, terminalEntryType string) (string, error) {
	key, err := normalizeSubscriptionDiscountBusinessKey(reservationKey)
	if err != nil {
		return "", err
	}
	if len(key)+1+len(terminalEntryType) > subscriptionDiscountMaxTerminalIdempotencyLength {
		return "", ErrSubscriptionDiscountInvalidReservation
	}
	return key, nil
}

func normalizeSubscriptionDiscountBusinessKey(key string) (string, error) {
	key = strings.TrimSpace(key)
	if key == "" || len(key) > subscriptionDiscountMaxBusinessKeyLength {
		return "", ErrSubscriptionDiscountInvalidReservation
	}
	return key, nil
}

func normalizeSubscriptionDiscountCurrency(currency string) (string, error) {
	currency = strings.ToUpper(strings.TrimSpace(currency))
	if len(currency) != 3 {
		return "", ErrSubscriptionDiscountInvalidReservation
	}
	for _, r := range currency {
		if r < 'A' || r > 'Z' {
			return "", ErrSubscriptionDiscountInvalidReservation
		}
	}
	return currency, nil
}

func checkedAddInt64(a int64, b int64) (int64, bool) {
	if (b > 0 && a > math.MaxInt64-b) || (b < 0 && a < math.MinInt64-b) {
		return 0, false
	}
	return a + b, true
}

func checkedSubInt64(a int64, b int64) (int64, bool) {
	if b == math.MinInt64 {
		return 0, false
	}
	return checkedAddInt64(a, -b)
}

func retrySQLiteBusy(fn func() error) error {
	var err error
	for attempt := 0; attempt < 50; attempt++ {
		err = fn()
		if !common.UsingSQLite || !isSQLiteBusyError(err) {
			return err
		}
		time.Sleep(time.Duration(attempt+1) * 5 * time.Millisecond)
	}
	return err
}

func isSQLiteBusyError(err error) bool {
	if err == nil {
		return false
	}
	message := strings.ToLower(err.Error())
	return strings.Contains(message, "database is locked") || strings.Contains(message, "sqlite_busy")
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
		return ErrSubscriptionDiscountInvalidReservation
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
