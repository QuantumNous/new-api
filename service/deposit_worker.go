package service

import (
	"fmt"
	"strconv"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
)

// StartDepositVerificationWorker starts the background goroutine that
// polls Binance API every 30 seconds to verify pending crypto deposits.
func StartDepositVerificationWorker() {
	if !IsAutoVerificationEnabled() {
		if IsCryptoDepositEnabled() {
			common.SysLog("Crypto deposit enabled (manual-confirm mode) — BINANCE_API_KEY not set, auto-verification skipped")
		} else {
			common.SysLog("Crypto deposit disabled (BINANCE_UID not set), skipping worker")
		}
		return
	}

	common.SysLog("Starting crypto deposit verification worker...")

	ticker := time.NewTicker(30 * time.Second)
	go func() {
		// Run once immediately on startup
		verifyPendingDeposits()
		expireOldDeposits()

		for range ticker.C {
			verifyPendingDeposits()
			expireOldDeposits()
		}
	}()
}

// verifyPendingDeposits checks Binance API for recent incoming transactions
// and matches them against pending deposit orders.
func verifyPendingDeposits() {
	defer func() {
		if r := recover(); r != nil {
			common.SysError(fmt.Sprintf("deposit worker panic: %v", r))
		}
	}()

	// Get all pending deposits
	pendingDeposits, err := model.GetPendingDeposits()
	if err != nil {
		common.SysError("failed to get pending deposits: " + err.Error())
		return
	}

	if len(pendingDeposits) == 0 {
		return // No pending deposits, skip API call
	}

	// Find the earliest pending deposit to determine the time window
	var earliestTime int64 = pendingDeposits[0].CreatedAt
	for _, d := range pendingDeposits {
		if d.CreatedAt < earliestTime {
			earliestTime = d.CreatedAt
		}
	}

	// Query Binance Pay transactions from earliestTime to now
	// Binance Pay API uses milliseconds
	startTimeMs := (earliestTime - 60) * 1000 // 1 minute buffer
	endTimeMs := time.Now().UnixMilli()

	transactions, err := FetchBinancePayTransactions(startTimeMs, endTimeMs)
	if err != nil {
		common.SysError("failed to fetch Binance Pay transactions: " + err.Error())
		return
	}

	// Build a lookup structure from pending deposits
	type pendingInfo struct {
		OrderId string
		Amount  float64
		Coin    string
		UserId  int
	}
	pendingList := make([]pendingInfo, 0, len(pendingDeposits))
	for _, d := range pendingDeposits {
		pendingList = append(pendingList, pendingInfo{
			OrderId: d.OrderId,
			Amount:  d.Amount,
			Coin:    d.Coin,
			UserId:  d.UserId,
		})
	}

	// Match transactions to pending deposits
	for _, tx := range transactions {
		// Get the amount and currency from the transaction
		txAmount := tx.Amount
		txCurrency := strings.ToUpper(tx.Currency)

		// Also check fundsDetail for specific coin amounts
		if len(tx.FundsDetail) > 0 {
			for _, fund := range tx.FundsDetail {
				fundCurrency := strings.ToUpper(fund.Currency)
				if fundCurrency == "USDT" || fundCurrency == "USDC" {
					txAmount = fund.Amount
					txCurrency = fundCurrency
					break
				}
			}
		}

		parsedAmount, parseErr := strconv.ParseFloat(txAmount, 64)
		if parseErr != nil {
			continue
		}

		// Try to match with pending deposits
		for _, pending := range pendingList {
			if txCurrency != pending.Coin {
				continue
			}

			// Match by exact amount (2 decimal places)
			if fmt.Sprintf("%.2f", parsedAmount) == fmt.Sprintf("%.2f", pending.Amount) {
				// Found a match! Confirm the deposit
				txId := tx.TransId
				if txId == "" {
					txId = tx.OrderId
				}

				err := model.ConfirmCryptoDeposit(pending.OrderId, txId, "system-auto")
				if err != nil {
					common.SysError(fmt.Sprintf("failed to confirm deposit %s: %v", pending.OrderId, err))
				} else {
					common.SysLog(fmt.Sprintf("✅ Crypto deposit confirmed: order=%s, amount=%.2f %s, user=%d",
						pending.OrderId, pending.Amount, pending.Coin, pending.UserId))
				}
				break // This transaction is matched, move to next
			}
		}
	}
}

// expireOldDeposits marks expired deposit orders
func expireOldDeposits() {
	affected, err := model.ExpireOldDeposits()
	if err != nil {
		common.SysError("failed to expire old deposits: " + err.Error())
		return
	}
	if affected > 0 {
		common.SysLog(fmt.Sprintf("Expired %d old crypto deposit orders", affected))
	}
}
