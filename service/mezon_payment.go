package service

import (
	"crypto/sha256"
	"fmt"
	"math/big"
	"net/http"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/setting"
)

// MMN chain amounts use 6 decimals (see mmn-client-js DECIMALS).
const mezonAmountDecimals = 6

const base58Alphabet = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz"

// base58Encode encodes bytes to base58 (Bitcoin alphabet), matching the
// bs58.encode implementation in mmn-client-js.
func base58Encode(input []byte) string {
	num := new(big.Int).SetBytes(input)
	mod := new(big.Int)
	var sb strings.Builder
	for num.Sign() > 0 {
		num.DivMod(num, big.NewInt(58), mod)
		sb.WriteByte(base58Alphabet[mod.Int64()])
	}
	leading := 0
	for _, b := range input {
		if b != 0 {
			break
		}
		leading++
	}
	for i := 0; i < leading; i++ {
		sb.WriteByte(base58Alphabet[0])
	}
	// reverse
	runes := []byte(sb.String())
	for i, j := 0, len(runes)-1; i < j; i, j = i+1, j-1 {
		runes[i], runes[j] = runes[j], runes[i]
	}
	return string(runes)
}

// MezonWalletAddressFromUserId derives the on-chain MMN wallet address for a
// Mezon user id: base58(sha256(userId)), mirroring
// MmnClient.getAddressFromUserId in mmn-client-js.
func MezonWalletAddressFromUserId(userId string) string {
	sum := sha256.Sum256([]byte(userId))
	return base58Encode(sum[:])
}

// IsValidMezonWalletAddress reports whether addr is a base58-encoded 32-byte
// MMN wallet (the same shape as MezonWalletAddressFromUserId).
func IsValidMezonWalletAddress(addr string) bool {
	decoded, ok := base58Decode(addr)
	return ok && len(decoded) == sha256.Size
}

func base58Decode(input string) ([]byte, bool) {
	if input == "" {
		return nil, false
	}
	num := new(big.Int)
	for i := 0; i < len(input); i++ {
		idx := strings.IndexByte(base58Alphabet, input[i])
		if idx < 0 {
			return nil, false
		}
		num.Mul(num, big.NewInt(58))
		num.Add(num, big.NewInt(int64(idx)))
	}
	decoded := num.Bytes()
	leading := 0
	for leading < len(input) && input[leading] == base58Alphabet[0] {
		leading++
	}
	result := make([]byte, leading+len(decoded))
	copy(result[leading:], decoded)
	return result, true
}

// MezonIndexerTx is the subset of the mmn-tx-explorer indexer transaction
// shape used for payment verification.
type MezonIndexerTx struct {
	Hash        string `json:"hash"`
	FromAddress string `json:"from_address"`
	ToAddress   string `json:"to_address"`
	Value       string `json:"value"`
	Status      int    `json:"status"`
	TextData    string `json:"text_data"`
	// TransactionTimestamp is the block timestamp in seconds.
	TransactionTimestamp int64 `json:"transaction_timestamp"`
}

type mezonTxDetailResponse struct {
	Data struct {
		Transaction MezonIndexerTx `json:"transaction"`
	} `json:"data"`
}

// GetMezonTransaction fetches a transaction from the MMN indexer.
// Returns nil (no error) when the transaction is not found.
func GetMezonTransaction(txHash string) (*MezonIndexerTx, error) {
	base := strings.TrimRight(setting.MezonPayment.IndexerBase, "/")
	chainId := setting.MezonPayment.ChainId
	if chainId == "" {
		chainId = "1337"
	}
	url := fmt.Sprintf("%s/%s/tx/%s/detail", base, chainId, txHash)

	client := GetHttpClient()
	req, err := http.NewRequest(http.MethodGet, url, nil)
	if err != nil {
		return nil, err
	}
	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	if resp.StatusCode == 404 {
		return nil, nil
	}
	if resp.StatusCode != 200 {
		return nil, fmt.Errorf("indexer returned status %d", resp.StatusCode)
	}
	var body mezonTxDetailResponse
	if err := common.DecodeJson(resp.Body, &body); err != nil {
		return nil, err
	}
	if body.Data.Transaction.Hash == "" {
		return nil, nil
	}
	if !strings.EqualFold(body.Data.Transaction.Hash, txHash) {
		return nil, fmt.Errorf("indexer hash mismatch")
	}
	return &body.Data.Transaction, nil
}

// MezonRawValueToDong converts a raw on-chain value string (6 decimals) to a
// whole-đồng amount. Fractional remainders are truncated.
func MezonRawValueToDong(rawValue string) (int64, error) {
	value, ok := new(big.Int).SetString(strings.TrimSpace(rawValue), 10)
	if !ok || value.Sign() < 0 {
		return 0, fmt.Errorf("invalid on-chain value %q", rawValue)
	}
	divisor := new(big.Int).Exp(big.NewInt(10), big.NewInt(mezonAmountDecimals), nil)
	dong := new(big.Int).Quo(value, divisor)
	if !dong.IsInt64() {
		return 0, fmt.Errorf("on-chain value too large: %q", rawValue)
	}
	return dong.Int64(), nil
}

// MezonTxTimestampFreshEnough guards against replaying very old transfers.
func MezonTxTimestampFreshEnough(ts int64) bool {
	if ts <= 0 {
		return false
	}
	return time.Since(time.Unix(ts, 0)) <= 30*24*time.Hour
}

type mezonTxListResponse struct {
	Data []MezonIndexerTx `json:"data"`
}

// GetMezonTransactionsForWallet queries the indexer for recent successful
// transfers from fromAddr to toAddr, returning up to limit results ordered
// newest-first.
func GetMezonTransactionsForWallet(fromAddr, toAddr string, limit int) ([]MezonIndexerTx, error) {
	base := strings.TrimRight(setting.MezonPayment.IndexerBase, "/")
	chainId := setting.MezonPayment.ChainId
	if chainId == "" {
		chainId = "1337"
	}
	if limit <= 0 || limit > 20 {
		limit = 10
	}
	url := fmt.Sprintf(
		"%s/%s/transactions?filter_from_address=%s&filter_to_address=%s&limit=%d&sort_order=desc",
		base, chainId, fromAddr, toAddr, limit,
	)

	client := GetHttpClient()
	req, err := http.NewRequest(http.MethodGet, url, nil)
	if err != nil {
		return nil, err
	}
	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	if resp.StatusCode != 200 {
		return nil, fmt.Errorf("indexer returned status %d", resp.StatusCode)
	}
	var body mezonTxListResponse
	if err := common.DecodeJson(resp.Body, &body); err != nil {
		return nil, err
	}
	return body.Data, nil
}
