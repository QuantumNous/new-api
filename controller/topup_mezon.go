package controller

import (
	"fmt"
	"math"
	"regexp"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/i18n"
	"github.com/QuantumNous/new-api/logger"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/setting"

	"github.com/gin-gonic/gin"
	"github.com/shopspring/decimal"
)

// MezonTxHashPattern matches MMN transaction hashes (64 hex chars).
var MezonTxHashPattern = regexp.MustCompile(`^[0-9a-fA-F]{64}$`)

// IsMezonTopUpEnabled reports whether the Mezon đồng payment method is
// configured and usable.
func IsMezonTopUpEnabled() bool {
	return setting.MezonPayment.Enabled && setting.MezonPayment.TreasuryAddress != ""
}

type MezonPayRequest struct {
	TxHash string `json:"tx_hash"`
}

// RequestMezonPay credits quota for a Mezon đồng transfer that the user has
// already made to the treasury wallet. The transaction is verified against
// the public MMN indexer: it must be successful, sent from the wallet derived
// from the user's Mezon OAuth identity, and addressed to the treasury. Each
// transaction hash can only be redeemed once (enforced by the unique
// topups.trade_no constraint).
func RequestMezonPay(c *gin.Context) {
	if !IsMezonTopUpEnabled() {
		common.ApiErrorI18n(c, i18n.MsgPaymentMezonDisabled)
		return
	}

	var req MezonPayRequest
	if err := common.DecodeJson(c.Request.Body, &req); err != nil {
		common.ApiError(c, err)
		return
	}
	txHash := strings.ToLower(strings.TrimSpace(req.TxHash))
	if !MezonTxHashPattern.MatchString(txHash) {
		common.ApiErrorI18n(c, i18n.MsgPaymentMezonInvalidHash)
		return
	}

	userId := c.GetInt("id")

	// Resolve the user's Mezon wallet address from their OAuth binding.
	bindings, err := model.GetUserOAuthBindingsByUserId(userId)
	if err != nil || len(bindings) == 0 {
		common.ApiErrorI18n(c, i18n.MsgPaymentMezonNotBound)
		return
	}
	boundAddresses := make(map[string]bool, len(bindings))
	for _, binding := range bindings {
		if binding.ProviderUserId != "" {
			boundAddresses[service.MezonWalletAddressFromUserId(binding.ProviderUserId)] = true
		}
	}

	tx, err := service.GetMezonTransaction(txHash)
	if err != nil {
		logger.LogError(c.Request.Context(), fmt.Sprintf("Mezon topup indexer query failed user_id=%d tx=%s error=%q", userId, txHash, err.Error()))
		common.ApiErrorI18n(c, i18n.MsgPaymentMezonIndexerError)
		return
	}
	if tx == nil {
		common.ApiErrorI18n(c, i18n.MsgPaymentMezonTxNotFound)
		return
	}
	// status 2 = success on the MMN indexer.
	if tx.Status != 2 {
		common.ApiErrorI18n(c, i18n.MsgPaymentMezonTxNotSuccess)
		return
	}
	if !strings.EqualFold(tx.ToAddress, setting.MezonPayment.TreasuryAddress) {
		common.ApiErrorI18n(c, i18n.MsgPaymentMezonWrongRecipient)
		return
	}
	if !boundAddresses[tx.FromAddress] {
		common.ApiErrorI18n(c, i18n.MsgPaymentMezonWrongSender)
		return
	}
	if !service.MezonTxTimestampFreshEnough(tx.TransactionTimestamp) {
		common.ApiErrorI18n(c, i18n.MsgPaymentMezonTxTooOld)
		return
	}

	dong, err := service.MezonRawValueToDong(tx.Value)
	if err != nil || dong <= 0 {
		common.ApiErrorI18n(c, i18n.MsgPaymentMezonInvalidAmount)
		return
	}
	// Fixed 1:1 credit: 1 dong → 1 mzđ (raw balance units). No QPU scaling,
	// no exchange rate, no artificial cap beyond int32.
	quotaToAdd, overflow := mezonDongToQuota(dong, userId)
	if overflow {
		common.ApiErrorI18n(c, i18n.MsgPaymentMezonAmountTooLarge)
		return
	}
	if quotaToAdd <= 0 {
		common.ApiErrorI18n(c, i18n.MsgPaymentMezonInvalidAmount)
		return
	}

	topUp := &model.TopUp{
		UserId:          userId,
		Amount:          dong,
		Money:           float64(dong),
		TradeNo:         "mezon:" + txHash,
		PaymentMethod:   model.PaymentMethodMezon,
		PaymentProvider: model.PaymentProviderMezon,
		CreateTime:      time.Now().Unix(),
		CompleteTime:    time.Now().Unix(),
		Status:          common.TopUpStatusSuccess,
	}
	if err := topUp.Insert(); err != nil {
		errMsg := strings.ToLower(err.Error())
		if strings.Contains(errMsg, "duplicate") || strings.Contains(errMsg, "unique") {
			common.ApiErrorI18n(c, i18n.MsgPaymentMezonTxUsed)
			return
		}
		common.ApiError(c, err)
		return
	}

	if err := model.IncreaseUserQuota(userId, quotaToAdd, true); err != nil {
		logger.LogError(c.Request.Context(), fmt.Sprintf("Mezon topup credit failed user_id=%d tx=%s quota=%d error=%q", userId, txHash, quotaToAdd, err.Error()))
		common.ApiError(c, err)
		return
	}

	logger.LogInfo(c.Request.Context(), fmt.Sprintf("Mezon top-up successful user_id=%d tx=%s dong=%d mzd=%d client_ip=%s", userId, txHash, dong, quotaToAdd, c.ClientIP()))
	model.RecordTopupLog(
		userId,
		fmt.Sprintf(
			"Mezon top-up successful: transferred %d dong, credited %d mzđ (1:1), tx %s",
			dong,
			quotaToAdd,
			txHash,
		),
		c.ClientIP(),
		model.PaymentMethodMezon,
		model.PaymentProviderMezon,
	)
	common.ApiSuccess(c, gin.H{"quota_added": quotaToAdd, "dong": dong, "mzd": quotaToAdd})
}

// mezonDongToQuota converts whole đồng to balance credit at fixed 1:1.
// 1 dong = 1 mzđ credit unit (same number the admin "add quota" path uses).
// Group top-up ratio still applies. No QuotaPerUnit scaling.
func mezonDongToQuota(dong int64, userId int) (quota int, overflow bool) {
	if dong <= 0 {
		return 0, false
	}
	group, err := model.GetUserGroup(userId, true)
	if err != nil {
		return 0, false
	}
	topupGroupRatio := common.GetTopupGroupRatio(group)
	if topupGroupRatio == 0 {
		topupGroupRatio = 1
	}
	return mezonDongToQuotaAmount(dong, topupGroupRatio)
}

// mezonDongToQuotaAmount is the pure conversion used by mezonDongToQuota and tests.
// credit = dong / groupRatio (1:1). Reject only if the result exceeds MaxInt32.
func mezonDongToQuotaAmount(dong int64, topupGroupRatio float64) (quota int, overflow bool) {
	if dong <= 0 || topupGroupRatio <= 0 {
		return 0, false
	}
	raw := decimal.NewFromInt(dong).Div(decimal.NewFromFloat(topupGroupRatio))
	if !raw.IsPositive() {
		return 0, false
	}
	// Same ceiling as the rest of the balance column (int32).
	if raw.GreaterThan(decimal.NewFromInt(int64(math.MaxInt32))) {
		return 0, true
	}
	i64 := raw.Round(0).IntPart()
	if i64 <= 0 || i64 > int64(math.MaxInt32) {
		return 0, true
	}
	return int(i64), false
}

// MezonUserTx is a single transaction returned by GetMezonUserTransactions.
type MezonUserTx struct {
	Hash      string `json:"hash"`
	Value     string `json:"value"`
	Dong      int64  `json:"dong"`
	Timestamp int64  `json:"timestamp"`
	Claimed   bool   `json:"claimed"`
}

// GetMezonUserTransactions returns recent Mezon đồng transfers from the
// current user's wallet to the treasury, with a flag indicating whether each
// transaction has already been claimed.
func GetMezonUserTransactions(c *gin.Context) {
	if !IsMezonTopUpEnabled() {
		common.ApiSuccess(c, []MezonUserTx{})
		return
	}

	userId := c.GetInt("id")

	bindings, err := model.GetUserOAuthBindingsByUserId(userId)
	if err != nil || len(bindings) == 0 {
		// No Mezon account bound — return empty list, not an error.
		common.ApiSuccess(c, []MezonUserTx{})
		return
	}

	treasury := setting.MezonPayment.TreasuryAddress

	// Collect transactions from all bound Mezon identities.
	var allTxs []service.MezonIndexerTx
	for _, binding := range bindings {
		if binding.ProviderUserId == "" {
			continue
		}
		walletAddr := service.MezonWalletAddressFromUserId(binding.ProviderUserId)
		txs, qErr := service.GetMezonTransactionsForWallet(walletAddr, treasury, 10)
		if qErr != nil {
			logger.LogError(c.Request.Context(), fmt.Sprintf(
				"Mezon tx list indexer query failed user_id=%d wallet=%s error=%q",
				userId, walletAddr, qErr.Error()))
			continue
		}
		allTxs = append(allTxs, txs...)
	}

	claimed, err := model.GetMezonClaimedHashes(userId)
	if err != nil {
		common.ApiError(c, err)
		return
	}

	result := make([]MezonUserTx, 0, len(allTxs))
	for _, tx := range allTxs {
		if tx.Status != 2 {
			continue
		}
		if !strings.EqualFold(tx.ToAddress, treasury) {
			continue
		}
		dong, dErr := service.MezonRawValueToDong(tx.Value)
		if dErr != nil || dong <= 0 {
			continue
		}
		result = append(result, MezonUserTx{
			Hash:      tx.Hash,
			Value:     tx.Value,
			Dong:      dong,
			Timestamp: tx.TransactionTimestamp,
			Claimed:   claimed[tx.Hash],
		})
	}

	common.ApiSuccess(c, result)
}
