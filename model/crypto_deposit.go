package model

import (
	"errors"
	"fmt"
	"math/rand"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/logger"
	"github.com/shopspring/decimal"
	"gorm.io/gorm"
)

const (
	CryptoDepositStatusPending   = 0
	CryptoDepositStatusConfirmed = 1
	CryptoDepositStatusExpired   = 2
	CryptoDepositStatusCancelled = 3

	PaymentMethodBinance  = "binance"
	PaymentProviderCrypto = "crypto"
)

type CryptoDeposit struct {
	Id             int     `json:"id" gorm:"primaryKey;autoIncrement"`
	UserId         int     `json:"user_id" gorm:"index;not null"`
	OrderId        string  `json:"order_id" gorm:"uniqueIndex;type:varchar(32);not null"`
	Coin           string  `json:"coin" gorm:"type:varchar(10);not null"`
	Amount         float64 `json:"amount" gorm:"not null"`          // unique amount to send (e.g. 10.37)
	OriginalAmount float64 `json:"original_amount" gorm:"not null"` // user's requested amount (e.g. 10.00)
	Status         int     `json:"status" gorm:"default:0"`
	BinanceTxId    string  `json:"binance_tx_id" gorm:"type:varchar(128)"`
	CreatedAt      int64   `json:"created_at" gorm:"not null"`
	ConfirmedAt    int64   `json:"confirmed_at"`
	ExpiredAt      int64   `json:"expired_at" gorm:"not null"`
}

func (CryptoDeposit) TableName() string {
	return "crypto_deposits"
}

// GenerateOrderId creates a unique order ID like "TAM-a1b2c3d4"
func GenerateOrderId() string {
	const chars = "abcdefghijklmnopqrstuvwxyz0123456789"
	b := make([]byte, 8)
	for i := range b {
		b[i] = chars[rand.Intn(len(chars))]
	}
	return "TAM-" + string(b)
}

// GenerateUniqueAmount adds random cents to make the deposit amount unique
// among all currently pending deposits for the same coin.
func GenerateUniqueAmount(baseAmount float64, coin string) (float64, error) {
	// Try up to 50 times to find a unique amount
	for attempt := 0; attempt < 50; attempt++ {
		// Add random cents: 0.01 to 0.99
		cents := float64(rand.Intn(99)+1) / 100.0
		uniqueAmount := baseAmount + cents

		// Round to 2 decimal places
		uniqueAmount = float64(int(uniqueAmount*100)) / 100.0

		// Check if this amount is already used by a pending deposit
		var count int64
		coinUpper := strings.ToUpper(coin)
		err := DB.Model(&CryptoDeposit{}).
			Where("coin = ? AND amount = ? AND status = ?", coinUpper, uniqueAmount, CryptoDepositStatusPending).
			Count(&count).Error
		if err != nil {
			return 0, err
		}
		if count == 0 {
			return uniqueAmount, nil
		}
	}
	return 0, errors.New("failed to generate unique amount, too many pending deposits")
}

// CreateCryptoDeposit creates a new crypto deposit order
func CreateCryptoDeposit(userId int, coin string, amount float64) (*CryptoDeposit, error) {
	coinUpper := strings.ToUpper(coin)
	if coinUpper != "USDT" && coinUpper != "USDC" {
		return nil, errors.New("unsupported coin, only USDT and USDC are accepted")
	}

	minDeposit := float64(common.GetEnvOrDefault("CRYPTO_MIN_DEPOSIT", 5))
	if amount < minDeposit {
		return nil, fmt.Errorf("minimum deposit is $%.2f", minDeposit)
	}

	// Check if user has too many pending deposits
	var pendingCount int64
	DB.Model(&CryptoDeposit{}).Where("user_id = ? AND status = ?", userId, CryptoDepositStatusPending).Count(&pendingCount)
	if pendingCount >= 3 {
		return nil, errors.New("you have too many pending deposits, please complete or cancel them first")
	}

	// Generate unique amount
	uniqueAmount, err := GenerateUniqueAmount(amount, coinUpper)
	if err != nil {
		return nil, err
	}

	now := common.GetTimestamp()
	expiryMinutes := common.GetEnvOrDefault("CRYPTO_ORDER_EXPIRY_MINUTES", 30)

	deposit := &CryptoDeposit{
		UserId:         userId,
		OrderId:        GenerateOrderId(),
		Coin:           coinUpper,
		Amount:         uniqueAmount,
		OriginalAmount: amount,
		Status:         CryptoDepositStatusPending,
		CreatedAt:      now,
		ExpiredAt:      now + int64(expiryMinutes*60),
	}

	if err := DB.Create(deposit).Error; err != nil {
		return nil, err
	}

	return deposit, nil
}

// GetPendingDeposits returns all pending (non-expired) deposits
func GetPendingDeposits() ([]CryptoDeposit, error) {
	var deposits []CryptoDeposit
	now := common.GetTimestamp()
	err := DB.Where("status = ? AND expired_at > ?", CryptoDepositStatusPending, now).Find(&deposits).Error
	return deposits, err
}

// ConfirmCryptoDeposit marks a deposit as confirmed and credits user balance
func ConfirmCryptoDeposit(orderId string, binanceTxId string, callerIp string) error {
	return DB.Transaction(func(tx *gorm.DB) error {
		deposit := &CryptoDeposit{}
		if err := tx.Where("order_id = ?", orderId).First(deposit).Error; err != nil {
			return errors.New("deposit order not found")
		}

		if deposit.Status != CryptoDepositStatusPending {
			return errors.New("deposit already processed")
		}

		// Mark confirmed
		deposit.Status = CryptoDepositStatusConfirmed
		deposit.ConfirmedAt = common.GetTimestamp()
		deposit.BinanceTxId = binanceTxId
		if err := tx.Save(deposit).Error; err != nil {
			return err
		}

		// Calculate quota: originalAmount * QuotaPerUnit
		dAmount := decimal.NewFromFloat(deposit.OriginalAmount)
		dQuotaPerUnit := decimal.NewFromFloat(common.QuotaPerUnit)
		quotaToAdd := int(dAmount.Mul(dQuotaPerUnit).IntPart())
		if quotaToAdd <= 0 {
			return errors.New("invalid deposit amount")
		}

		// Credit user balance
		if err := tx.Model(&User{}).Where("id = ?", deposit.UserId).
			Update("quota", gorm.Expr("quota + ?", quotaToAdd)).Error; err != nil {
			return err
		}

		// Also create a TopUp record for consistency with billing history
		topUp := &TopUp{
			UserId:          deposit.UserId,
			Amount:          int64(quotaToAdd),
			Money:           deposit.OriginalAmount,
			TradeNo:         deposit.OrderId,
			PaymentMethod:   PaymentMethodBinance,
			PaymentProvider: PaymentProviderCrypto,
			CreateTime:      deposit.CreatedAt,
			CompleteTime:    deposit.ConfirmedAt,
			Status:          common.TopUpStatusSuccess,
		}
		if err := tx.Create(topUp).Error; err != nil {
			return err
		}

		// Log
		RecordTopupLog(deposit.UserId,
			fmt.Sprintf("Crypto deposit confirmed: %.2f %s, quota added: %v",
				deposit.OriginalAmount, deposit.Coin, logger.FormatQuota(quotaToAdd)),
			callerIp, PaymentMethodBinance, PaymentProviderCrypto)

		return nil
	})
}

// ExpireOldDeposits marks expired pending deposits
func ExpireOldDeposits() (int64, error) {
	now := common.GetTimestamp()
	result := DB.Model(&CryptoDeposit{}).
		Where("status = ? AND expired_at <= ?", CryptoDepositStatusPending, now).
		Update("status", CryptoDepositStatusExpired)
	return result.RowsAffected, result.Error
}

// CancelCryptoDeposit cancels a pending deposit
func CancelCryptoDeposit(orderId string, userId int) error {
	result := DB.Model(&CryptoDeposit{}).
		Where("order_id = ? AND user_id = ? AND status = ?", orderId, userId, CryptoDepositStatusPending).
		Update("status", CryptoDepositStatusCancelled)
	if result.RowsAffected == 0 {
		return errors.New("deposit not found or already processed")
	}
	return result.Error
}

// GetCryptoDepositByOrderId returns a deposit by order ID
func GetCryptoDepositByOrderId(orderId string) (*CryptoDeposit, error) {
	deposit := &CryptoDeposit{}
	err := DB.Where("order_id = ?", orderId).First(deposit).Error
	if err != nil {
		return nil, err
	}
	return deposit, nil
}

// GetUserCryptoDeposits returns a user's deposit history
func GetUserCryptoDeposits(userId int, limit int) ([]CryptoDeposit, error) {
	var deposits []CryptoDeposit
	err := DB.Where("user_id = ?", userId).Order("id DESC").Limit(limit).Find(&deposits).Error
	return deposits, err
}

// GetAllCryptoDeposits returns all deposits (admin)
func GetAllCryptoDeposits(limit int, offset int) ([]CryptoDeposit, int64, error) {
	var deposits []CryptoDeposit
	var total int64
	DB.Model(&CryptoDeposit{}).Count(&total)
	err := DB.Order("id DESC").Limit(limit).Offset(offset).Find(&deposits).Error
	return deposits, total, err
}

func init() {
	rand.Seed(time.Now().UnixNano())
}
