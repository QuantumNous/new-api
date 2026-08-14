package order

import (
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"math/big"
	"regexp"
	"strings"
	"time"
)

const OrderTTL = 15 * time.Minute

var (
	moneyPattern         = regexp.MustCompile(`^(0|[1-9][0-9]*)(\.[0-9]{1,2})?$`)
	merchantOrderPattern = regexp.MustCompile(`^[A-Za-z0-9_-]{1,255}$`)
)

func ParseAmountFen(raw, maximum string) (int64, string, error) {
	if raw != strings.TrimSpace(raw) || !moneyPattern.MatchString(raw) {
		return 0, "", errors.New("money must be a plain decimal with at most two decimal places")
	}
	amount, ok := new(big.Rat).SetString(raw)
	if !ok {
		return 0, "", errors.New("money is invalid")
	}
	max, ok := new(big.Rat).SetString(maximum)
	if !ok || max.Sign() <= 0 {
		return 0, "", errors.New("configured maximum order amount is invalid")
	}
	fen := new(big.Rat).Mul(amount, big.NewRat(100, 1))
	if !fen.IsInt() || fen.Sign() <= 0 || amount.Cmp(max) > 0 {
		return 0, "", errors.New("money is outside the allowed range")
	}
	if !fen.Num().IsInt64() {
		return 0, "", errors.New("money is too large")
	}
	amountFen := fen.Num().Int64()
	return amountFen, fmt.Sprintf("%d.%02d", amountFen/100, amountFen%100), nil
}

func ValidateMerchantOrder(value string) error {
	if !merchantOrderPattern.MatchString(value) {
		return errors.New("out_trade_no must use the configured character set and be 1-255 bytes")
	}
	return nil
}

func Fingerprint(fields ...string) string {
	hash := sha256.New()
	for _, field := range fields {
		hash.Write([]byte(field))
		hash.Write([]byte{0})
	}
	return hex.EncodeToString(hash.Sum(nil))
}

func HashCashierToken(token string) string {
	digest := sha256.Sum256([]byte(token))
	return hex.EncodeToString(digest[:])
}
