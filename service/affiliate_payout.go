package service

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"errors"
	"io"
	"strings"

	"github.com/QuantumNous/new-api/common"
)

const affiliatePayoutEncryptionPrefix = "affiliate-v1:"

func EncryptAffiliatePayoutDetails(value string) (string, error) {
	value = strings.TrimSpace(value)
	if value == "" || len(value) > 1000 {
		return "", errors.New("invalid payout account")
	}
	key := sha256.Sum256([]byte(common.CryptoSecret))
	block, err := aes.NewCipher(key[:])
	if err != nil {
		return "", err
	}
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return "", err
	}
	nonce := make([]byte, gcm.NonceSize())
	if _, err := io.ReadFull(rand.Reader, nonce); err != nil {
		return "", err
	}
	payload := gcm.Seal(nonce, nonce, []byte(value), nil)
	return affiliatePayoutEncryptionPrefix + base64.RawStdEncoding.EncodeToString(payload), nil
}

func DecryptAffiliatePayoutDetails(value string) (string, error) {
	if !strings.HasPrefix(value, affiliatePayoutEncryptionPrefix) {
		return "", errors.New("invalid encrypted payout account")
	}
	payload, err := base64.RawStdEncoding.DecodeString(strings.TrimPrefix(value, affiliatePayoutEncryptionPrefix))
	if err != nil {
		return "", err
	}
	key := sha256.Sum256([]byte(common.CryptoSecret))
	block, err := aes.NewCipher(key[:])
	if err != nil {
		return "", err
	}
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return "", err
	}
	if len(payload) < gcm.NonceSize() {
		return "", errors.New("invalid encrypted payout account")
	}
	plain, err := gcm.Open(nil, payload[:gcm.NonceSize()], payload[gcm.NonceSize():], nil)
	if err != nil {
		return "", err
	}
	return string(plain), nil
}

func MaskAffiliatePayoutDetails(value string) string {
	value = strings.TrimSpace(value)
	if len(value) <= 4 {
		return strings.Repeat("*", len(value))
	}
	if len(value) <= 8 {
		return value[:2] + strings.Repeat("*", len(value)-4) + value[len(value)-2:]
	}
	return value[:3] + strings.Repeat("*", 5) + value[len(value)-3:]
}
