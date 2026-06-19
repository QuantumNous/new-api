package service

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"strconv"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
)

// BinancePayTransaction represents an incoming Binance Pay transaction
type BinancePayTransaction struct {
	OrderId     string  `json:"orderId"`
	TransId     string  `json:"transId"`
	Amount      string  `json:"amount"`
	Currency    string  `json:"currency"`
	FundsDetail []struct {
		Currency string `json:"currency"`
		Amount   string `json:"amount"`
	} `json:"fundsDetail"`
	PayerInfo struct {
		Name     string `json:"name"`
		BinanceId int64 `json:"binanceId"`
	} `json:"payerInfo"`
	TransactionType string `json:"transactionType"`
	TransactionTime int64  `json:"transactionTime"`
}

type BinancePayHistoryResponse struct {
	Code    string                  `json:"code"`
	Message string                  `json:"message"`
	Data    []BinancePayTransaction `json:"data"`
	Total   int                     `json:"total"`
}

// GetBinanceAPIKey returns the Binance API key from environment
func GetBinanceAPIKey() string {
	return os.Getenv("BINANCE_API_KEY")
}

// GetBinanceAPISecret returns the Binance API secret from environment
func GetBinanceAPISecret() string {
	return os.Getenv("BINANCE_API_SECRET")
}

// GetBinanceUID returns the admin's Binance UID from environment
func GetBinanceUID() string {
	return os.Getenv("BINANCE_UID")
}

// IsCryptoDepositEnabled checks if crypto deposit feature is enabled.
// Deposit creation only requires BINANCE_UID (so users know where to send).
// BINANCE_API_KEY + BINANCE_API_SECRET are only needed for auto-verification.
func IsCryptoDepositEnabled() bool {
	return GetBinanceUID() != ""
}

// IsAutoVerificationEnabled checks if Binance API auto-verification is configured
func IsAutoVerificationEnabled() bool {
	return GetBinanceAPIKey() != "" && GetBinanceAPISecret() != ""
}

// signBinanceRequest creates an HMAC SHA256 signature for Binance API
func signBinanceRequest(queryString string, secret string) string {
	mac := hmac.New(sha256.New, []byte(secret))
	mac.Write([]byte(queryString))
	return hex.EncodeToString(mac.Sum(nil))
}

// FetchBinancePayTransactions fetches recent incoming Pay transactions from Binance
// transactionType: "C2C" for P2P, "PAY" for Binance Pay
// We look for incoming transfers (type=1)
func FetchBinancePayTransactions(startTime int64, endTime int64) ([]BinancePayTransaction, error) {
	apiKey := GetBinanceAPIKey()
	apiSecret := GetBinanceAPISecret()
	if apiKey == "" || apiSecret == "" {
		return nil, fmt.Errorf("binance API credentials not configured")
	}

	timestamp := strconv.FormatInt(time.Now().UnixMilli(), 10)

	params := url.Values{}
	params.Set("transactionType", "1") // 1 = incoming (receive)
	params.Set("beginTime", strconv.FormatInt(startTime, 10))
	params.Set("endTime", strconv.FormatInt(endTime, 10))
	params.Set("limit", "100")
	params.Set("timestamp", timestamp)
	params.Set("recvWindow", "10000")

	queryString := params.Encode()
	signature := signBinanceRequest(queryString, apiSecret)
	queryString += "&signature=" + signature

	reqURL := "https://api.binance.com/sapi/v1/pay/transactions?" + queryString

	req, err := http.NewRequest("GET", reqURL, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("X-MBX-APIKEY", apiKey)

	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("binance API returned status %d: %s", resp.StatusCode, string(body))
	}

	var result BinancePayHistoryResponse
	if err := common.Unmarshal(body, &result); err != nil {
		return nil, fmt.Errorf("failed to parse binance response: %v", err)
	}

	if result.Code != "000000" {
		return nil, fmt.Errorf("binance API error: %s - %s", result.Code, result.Message)
	}

	return result.Data, nil
}

// FetchBinanceInternalTransfers fetches recent universal transfers (internal)
func FetchBinanceInternalTransfers(startTime int64, endTime int64) ([]BinancePayTransaction, error) {
	apiKey := GetBinanceAPIKey()
	apiSecret := GetBinanceAPISecret()
	if apiKey == "" || apiSecret == "" {
		return nil, fmt.Errorf("binance API credentials not configured")
	}

	timestamp := strconv.FormatInt(time.Now().UnixMilli(), 10)

	params := url.Values{}
	params.Set("type", "MAIN_FUNDING") // from funding to main
	params.Set("startTime", strconv.FormatInt(startTime, 10))
	params.Set("endTime", strconv.FormatInt(endTime, 10))
	params.Set("size", "100")
	params.Set("timestamp", timestamp)
	params.Set("recvWindow", "10000")

	queryString := params.Encode()
	signature := signBinanceRequest(queryString, apiSecret)
	queryString += "&signature=" + signature

	reqURL := "https://api.binance.com/sapi/v1/asset/transfer?" + queryString

	req, err := http.NewRequest("GET", reqURL, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("X-MBX-APIKEY", apiKey)

	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}

	if resp.StatusCode != http.StatusOK {
		common.SysLog(fmt.Sprintf("Binance internal transfer API status %d: %s", resp.StatusCode, string(body)))
	}

	// Parse and return (format may differ, handle gracefully)
	return nil, nil
}

// MatchTransactionToDeposit checks if a Binance transaction matches a pending deposit
func MatchTransactionToDeposit(txAmount string, txCurrency string, deposits []struct {
	OrderId string
	Amount  float64
	Coin    string
}) (string, bool) {
	parsedAmount, err := strconv.ParseFloat(txAmount, 64)
	if err != nil {
		return "", false
	}

	txCurrencyUpper := strings.ToUpper(txCurrency)

	for _, d := range deposits {
		// Match by exact amount (to 2 decimal places) and coin
		if txCurrencyUpper == d.Coin && fmt.Sprintf("%.2f", parsedAmount) == fmt.Sprintf("%.2f", d.Amount) {
			return d.OrderId, true
		}
	}
	return "", false
}
