package controller

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"math"
	"math/big"
	"net/http"
	"os"
	"strings"
	"sync"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/logger"
	"github.com/QuantumNous/new-api/model"
	"github.com/gin-gonic/gin"
	"github.com/shopspring/decimal"
)

// ============================================================================
// Chain config
// ============================================================================

type cryptoChainConfig struct {
	rpcEnvKey     string
	defaultRPC    string
	usdtAddress   string
	usdcAddress   string
	usdtDecimals  int
	usdcDecimals  int
	nativeCGID    string // CoinGecko ID for native coin price lookup
	nativeDecimals int
}

// ERC-20 Transfer event topic: keccak256("Transfer(address,address,uint256)")
const transferEventTopic = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef"

var cryptoChains = map[string]cryptoChainConfig{
	"eth": {
		rpcEnvKey:      "CRYPTO_RPC_ETH",
		defaultRPC:     "https://eth.llamarpc.com",
		usdtAddress:    "0xdAC17F958D2ee523a2206206994597C13D831ec7",
		usdcAddress:    "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
		usdtDecimals:   6,
		usdcDecimals:   6,
		nativeCGID:     "ethereum",
		nativeDecimals: 18,
	},
	"bsc": {
		rpcEnvKey:      "CRYPTO_RPC_BSC",
		defaultRPC:     "https://bsc-dataseed.binance.org",
		usdtAddress:    "0x55d398326f99059fF775485246999027B3197955",
		usdcAddress:    "0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d",
		usdtDecimals:   18,
		usdcDecimals:   18,
		nativeCGID:     "binancecoin",
		nativeDecimals: 18,
	},
	"polygon": {
		rpcEnvKey:      "CRYPTO_RPC_POLYGON",
		defaultRPC:     "https://polygon-rpc.com",
		usdtAddress:    "0xc2132D05D31c914a87C6611C10748AEb04B58e8F",
		usdcAddress:    "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174",
		usdtDecimals:   6,
		usdcDecimals:   6,
		nativeCGID:     "matic-network",
		nativeDecimals: 18,
	},
	"arbitrum": {
		rpcEnvKey:      "CRYPTO_RPC_ARBITRUM",
		defaultRPC:     "https://arb1.arbitrum.io/rpc",
		usdtAddress:    "0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9",
		usdcAddress:    "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
		usdtDecimals:   6,
		usdcDecimals:   6,
		nativeCGID:     "ethereum",
		nativeDecimals: 18,
	},
	"base": {
		rpcEnvKey:      "CRYPTO_RPC_BASE",
		defaultRPC:     "https://mainnet.base.org",
		usdtAddress:    "",
		usdcAddress:    "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
		usdtDecimals:   0,
		usdcDecimals:   6,
		nativeCGID:     "ethereum",
		nativeDecimals: 18,
	},
}

func getPlatformWallet() string {
	w := os.Getenv("PLATFORM_WALLET_ADDRESS")
	if w == "" {
		w = "0x33de43dad6955655ec0543f32069ac331e633c9c"
	}
	return strings.ToLower(w)
}

func getRPC(cfg cryptoChainConfig) string {
	if v := os.Getenv(cfg.rpcEnvKey); v != "" {
		return v
	}
	return cfg.defaultRPC
}

// ============================================================================
// In-memory deposit store
// ============================================================================

type depositRecord struct {
	Status    string
	UsdAdded  float64
	UserId    int
	TxHash    string
	Chain     string
	CreatedAt time.Time
}

var (
	deposits    sync.Map // depositId -> *depositRecord
	txHashIndex sync.Map // normalised txHash -> depositId
)

func init() {
	go func() {
		for {
			time.Sleep(30 * time.Minute)
			now := time.Now()
			deposits.Range(func(k, v interface{}) bool {
				rec := v.(*depositRecord)
				if now.Sub(rec.CreatedAt) > 2*time.Hour {
					deposits.Delete(k)
					txHashIndex.Delete(strings.ToLower(rec.TxHash))
				}
				return true
			})
		}
	}()
}

// ============================================================================
// JSON-RPC helpers
// ============================================================================

type jsonRPCRequest struct {
	JSONRPC string        `json:"jsonrpc"`
	Method  string        `json:"method"`
	Params  []interface{} `json:"params"`
	ID      int           `json:"id"`
}

type jsonRPCResponse struct {
	Result interface{} `json:"result"`
	Error  *struct {
		Message string `json:"message"`
	} `json:"error"`
}

func ethCall(ctx context.Context, rpcURL string, method string, params []interface{}) (interface{}, error) {
	reqBody, _ := json.Marshal(jsonRPCRequest{JSONRPC: "2.0", Method: method, Params: params, ID: 1})
	req, err := http.NewRequestWithContext(ctx, "POST", rpcURL, bytes.NewReader(reqBody))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/json")
	client := &http.Client{Timeout: 30 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	body, _ := io.ReadAll(resp.Body)
	var rpcResp jsonRPCResponse
	if err := json.Unmarshal(body, &rpcResp); err != nil {
		return nil, fmt.Errorf("JSON-RPC decode error: %w", err)
	}
	if rpcResp.Error != nil {
		return nil, fmt.Errorf("JSON-RPC error: %s", rpcResp.Error.Message)
	}
	return rpcResp.Result, nil
}

func waitForReceipt(ctx context.Context, rpcURL, txHash string) (map[string]interface{}, error) {
	deadline := time.Now().Add(120 * time.Second)
	for time.Now().Before(deadline) {
		select {
		case <-ctx.Done():
			return nil, ctx.Err()
		default:
		}
		result, err := ethCall(ctx, rpcURL, "eth_getTransactionReceipt", []interface{}{txHash})
		if err == nil && result != nil {
			if rec, ok := result.(map[string]interface{}); ok {
				return rec, nil
			}
		}
		time.Sleep(5 * time.Second)
	}
	return nil, fmt.Errorf("timed out waiting for receipt")
}

func hexToDecimal(hexStr string) (*big.Int, bool) {
	s := strings.TrimPrefix(strings.ToLower(hexStr), "0x")
	n := new(big.Int)
	_, ok := n.SetString(s, 16)
	return n, ok
}

// ============================================================================
// CoinGecko price lookup
// ============================================================================

func fetchCoinPrice(ctx context.Context, coingeckoID string) (float64, error) {
	url := fmt.Sprintf("https://api.coingecko.com/api/v3/simple/price?ids=%s&vs_currencies=usd", coingeckoID)
	req, err := http.NewRequestWithContext(ctx, "GET", url, nil)
	if err != nil {
		return 0, err
	}
	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return 0, err
	}
	defer resp.Body.Close()
	body, _ := io.ReadAll(resp.Body)

	var result map[string]map[string]float64
	if err := json.Unmarshal(body, &result); err != nil {
		return 0, err
	}
	price, ok := result[coingeckoID]["usd"]
	if !ok || price <= 0 {
		return 0, fmt.Errorf("price not found for %s", coingeckoID)
	}
	return price, nil
}

// ============================================================================
// On-chain verification
// ============================================================================

func verifyAndCredit(depositId string, rec *depositRecord, cfg cryptoChainConfig, rpcURL string) {
	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Minute)
	defer cancel()

	platformWallet := getPlatformWallet()

	receipt, err := waitForReceipt(ctx, rpcURL, rec.TxHash)
	if err != nil {
		common.SysLog(fmt.Sprintf("crypto: receipt error txHash=%s err=%v", rec.TxHash, err))
		rec.Status = "failed"
		return
	}

	statusHex, _ := receipt["status"].(string)
	if statusHex != "0x1" {
		rec.Status = "failed"
		return
	}

	var usdValue float64

	// ── 1. Try ERC-20 Transfer scan ──────────────────────────────────────────
	logsRaw, _ := receipt["logs"].([]interface{})
	for _, logRaw := range logsRaw {
		logMap, ok := logRaw.(map[string]interface{})
		if !ok {
			continue
		}
		topics, _ := logMap["topics"].([]interface{})
		if len(topics) < 3 {
			continue
		}
		topic0, _ := topics[0].(string)
		if strings.ToLower(topic0) != transferEventTopic {
			continue
		}

		// Check "to" address (topic2, padded 32 bytes)
		topic2, _ := topics[2].(string)
		toAddr := strings.TrimLeft(strings.TrimPrefix(strings.ToLower(topic2), "0x"), "0")
		platformStripped := strings.TrimLeft(strings.TrimPrefix(platformWallet, "0x"), "0")
		if toAddr != platformStripped {
			continue
		}

		// Match token contract address
		logAddr := strings.ToLower(logMap["address"].(string))
		var tokenDecimals int
		if cfg.usdtAddress != "" && strings.ToLower(cfg.usdtAddress) == logAddr {
			tokenDecimals = cfg.usdtDecimals
		} else if cfg.usdcAddress != "" && strings.ToLower(cfg.usdcAddress) == logAddr {
			tokenDecimals = cfg.usdcDecimals
		} else {
			continue
		}

		data, _ := logMap["data"].(string)
		amountBig, ok := hexToDecimal(data)
		if !ok || tokenDecimals == 0 {
			continue
		}

		dAmount := decimal.NewFromBigInt(amountBig, int32(-tokenDecimals))
		usdValue, _ = dAmount.Float64()
		break
	}

	// ── 2. Fallback: native coin transfer ────────────────────────────────────
	if usdValue <= 0 && cfg.nativeCGID != "" {
		txResult, err := ethCall(ctx, rpcURL, "eth_getTransactionByHash", []interface{}{rec.TxHash})
		if err == nil && txResult != nil {
			txMap, ok := txResult.(map[string]interface{})
			if ok {
				toField, _ := txMap["to"].(string)
				valueField, _ := txMap["value"].(string)
				if strings.ToLower(toField) == platformWallet && valueField != "" && valueField != "0x0" {
					weiAmount, ok := hexToDecimal(valueField)
					if ok {
						nativeAmt := decimal.NewFromBigInt(weiAmount, int32(-cfg.nativeDecimals))
						// Fetch price from CoinGecko
						price, err := fetchCoinPrice(ctx, cfg.nativeCGID)
						if err == nil && price > 0 {
							nativeFloat, _ := nativeAmt.Float64()
							usdValue = nativeFloat * price
						} else {
							common.SysLog(fmt.Sprintf("crypto: price lookup failed chain=%s cgid=%s err=%v", rec.Chain, cfg.nativeCGID, err))
						}
					}
				}
			}
		}
	}

	if usdValue <= 0 {
		rec.Status = "failed"
		return
	}

	// ── Credit user ───────────────────────────────────────────────────────────
	// 新用户首充优惠（crypto 按比例补）：到账 = 实付 + bonus，bonus = (1/折扣 − 1) × min(实付, 档位)。
	// 必须在本次 TopUp 写入 success 之前判定资格（否则 HasSuccessfulTopUp 会把本次算进去）。
	creditUsd := usdValue
	if eligible, _ := model.IsFirstTopupPromoEligible(rec.UserId); eligible {
		bonusBase := usdValue
		if capUsd := float64(common.FirstTopupPromoAmount); bonusBase > capUsd {
			bonusBase = capUsd
		}
		bonus := bonusBase * (1/common.FirstTopupPromoDiscount - 1)
		creditUsd = usdValue + bonus
		common.SysLog(fmt.Sprintf("crypto: first-topup promo userId=%d paid=%.4f bonus=%.4f credit=%.4f", rec.UserId, usdValue, bonus, creditUsd))
	}
	quotaToAdd := int(decimal.NewFromFloat(creditUsd).Mul(decimal.NewFromFloat(common.QuotaPerUnit)).IntPart())
	tradeNo := fmt.Sprintf("CRYPTO%dTX%s", rec.UserId, rec.TxHash[2:14])

	topUp := &model.TopUp{
		UserId:          rec.UserId,
		Amount:          int64(math.Round(creditUsd)), // 到账美元（含 bonus），与 epay 一致
		Money:           usdValue,                      // 实付（链上实收）
		TradeNo:         tradeNo,
		PaymentMethod:   "crypto",
		PaymentProvider: "crypto",
		CreateTime:      time.Now().Unix(),
		CompleteTime:    time.Now().Unix(),
		Status:          "success",
	}
	if err := topUp.Insert(); err != nil {
		common.SysLog(fmt.Sprintf("crypto: DB insert failed txHash=%s err=%v", rec.TxHash, err))
		rec.Status = "failed"
		return
	}
	if err := model.IncreaseUserQuota(rec.UserId, quotaToAdd, true); err != nil {
		common.SysLog(fmt.Sprintf("crypto: IncreaseUserQuota failed userId=%d err=%v", rec.UserId, err))
		rec.Status = "failed"
		return
	}

	rec.UsdAdded = usdValue
	rec.Status = "confirmed"
	common.SysLog(fmt.Sprintf("crypto: confirmed userId=%d txHash=%s usd=%.4f quota=%d", rec.UserId, rec.TxHash, usdValue, quotaToAdd))
	model.RecordTopupLog(rec.UserId, fmt.Sprintf("使用加密货币充值成功，充值金额: %v，支付金额：%.2f", logger.FormatQuota(quotaToAdd), usdValue), "", "crypto", "crypto")
	// Use the same tradeNo stored on the TopUp row (not rec.TxHash) — GA dedup
	// and the backfill script both key off top_ups.trade_no, so a mismatched
	// id here means the backfill never sees this as "already sent" and re-fires
	// a duplicate purchase event under a different transaction_id.
	model.OnTopupSucceeded(rec.UserId, quotaToAdd, "crypto", tradeNo)
}

// ============================================================================
// Handlers
// ============================================================================

type submitCryptoRequest struct {
	TxHash string `json:"tx_hash"`
	Chain  string `json:"chain"`
}

func SubmitCryptoDeposit(c *gin.Context) {
	userId := c.GetInt("id")
	if userId == 0 {
		c.JSON(http.StatusUnauthorized, gin.H{"success": false, "error": "unauthorized"})
		return
	}
	TouchUserCountry(userId, c.ClientIP())

	var req submitCryptoRequest
	if err := c.ShouldBindJSON(&req); err != nil || req.TxHash == "" || req.Chain == "" {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "error": "invalid request"})
		return
	}

	normHash := strings.ToLower(req.TxHash)
	chain := strings.ToLower(req.Chain)

	cfg, ok := cryptoChains[chain]
	if !ok {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "error": "unsupported chain"})
		return
	}

	if existingId, loaded := txHashIndex.Load(normHash); loaded {
		c.JSON(http.StatusOK, gin.H{"success": true, "depositId": existingId.(string)})
		return
	}

	depositId := common.GetUUID()
	rec := &depositRecord{
		Status:    "pending",
		UserId:    userId,
		TxHash:    normHash,
		Chain:     chain,
		CreatedAt: time.Now(),
	}
	deposits.Store(depositId, rec)
	txHashIndex.Store(normHash, depositId)

	go verifyAndCredit(depositId, rec, cfg, getRPC(cfg))

	c.JSON(http.StatusOK, gin.H{"success": true, "depositId": depositId})
}

func GetCryptoDeposit(c *gin.Context) {
	depositId := c.Param("id")
	val, ok := deposits.Load(depositId)
	if !ok {
		c.JSON(http.StatusNotFound, gin.H{"status": "not_found"})
		return
	}
	rec := val.(*depositRecord)
	c.JSON(http.StatusOK, gin.H{"status": rec.Status, "usdAdded": rec.UsdAdded})
}
