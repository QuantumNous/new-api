package epay

import (
	"crypto/md5"
	"crypto/subtle"
	"encoding/hex"
	"sort"
	"strings"
)

const (
	PaymentTypeWechat  = "wxpay"
	SignTypeMD5        = "MD5"
	TradeStatusSuccess = "TRADE_SUCCESS"
)

// Sign returns a go-epay compatible signature without mutating params.
func Sign(params map[string]string, key string) string {
	keys := make([]string, 0, len(params))
	for name, value := range params {
		if name == "sign" || name == "sign_type" || value == "" {
			continue
		}
		keys = append(keys, name)
	}
	sort.Strings(keys)

	var input strings.Builder
	for index, name := range keys {
		if index > 0 {
			input.WriteByte('&')
		}
		input.WriteString(name)
		input.WriteByte('=')
		input.WriteString(params[name])
	}
	input.WriteString(key)

	digest := md5.Sum([]byte(input.String()))
	return hex.EncodeToString(digest[:])
}

// Verify compares signatures in constant time after validating the wire format.
func Verify(params map[string]string, key string) bool {
	provided := strings.ToLower(params["sign"])
	if len(provided) != md5.Size*2 {
		return false
	}
	if _, err := hex.DecodeString(provided); err != nil {
		return false
	}
	expected := Sign(params, key)
	return subtle.ConstantTimeCompare([]byte(provided), []byte(expected)) == 1
}

// CallbackAccepted implements new-api's strict Epay callback acknowledgement.
func CallbackAccepted(statusCode int, body []byte) bool {
	return statusCode >= 200 && statusCode < 300 && strings.TrimSpace(string(body)) == "success"
}
