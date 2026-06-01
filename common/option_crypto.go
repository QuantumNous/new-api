package common

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"encoding/base64"
	"errors"
	"fmt"
	"io"
	"strings"

	"golang.org/x/crypto/scrypt"
)

const OptionEncryptedPrefixV1 = "enc:v1:"

var optionCryptSaltV1 = []byte("new-api:option-crypto:v1")

var (
	errOptionCryptKeyRequired = errors.New("OPTION_CRYPT_KEY is required")
	errOptionEncryptedFormat  = errors.New("invalid encrypted option format")
	errOptionKeyNotSupported  = errors.New("option key is not supported for alipay option crypto")
)

func GetOptionCryptKey() string {
	return GetEnvOrDefaultString("OPTION_CRYPT_KEY", "")
}

func IsEncryptedOptionValue(value string) bool {
	return strings.HasPrefix(value, OptionEncryptedPrefixV1)
}

func IsAlipaySensitiveOptionKey(optionKey string) bool {
	return optionKey == "AlipayPrivateKey" || optionKey == "AlipayPublicKey" || optionKey == "AlipayEncryptKey"
}

func EncryptAlipayOptionValue(optionKey string, plainText string) (string, error) {
	if !IsAlipaySensitiveOptionKey(optionKey) {
		return "", errOptionKeyNotSupported
	}
	key := GetOptionCryptKey()
	if key == "" {
		return "", errOptionCryptKeyRequired
	}

	aead, err := createOptionAEAD(key)
	if err != nil {
		return "", err
	}

	nonce := make([]byte, aead.NonceSize())
	if _, err = io.ReadFull(rand.Reader, nonce); err != nil {
		return "", err
	}

	cipherText := aead.Seal(nil, nonce, []byte(plainText), buildOptionAAD(optionKey))
	payload := append(nonce, cipherText...)
	return OptionEncryptedPrefixV1 + base64.RawStdEncoding.EncodeToString(payload), nil
}

func DecryptAlipayOptionValue(optionKey string, value string) (string, error) {
	if !IsAlipaySensitiveOptionKey(optionKey) {
		return "", errOptionKeyNotSupported
	}
	if !IsEncryptedOptionValue(value) {
		return value, nil
	}

	key := GetOptionCryptKey()
	if key == "" {
		return "", errOptionCryptKeyRequired
	}

	aead, err := createOptionAEAD(key)
	if err != nil {
		return "", err
	}

	encoded := strings.TrimPrefix(value, OptionEncryptedPrefixV1)
	payload, err := base64.RawStdEncoding.DecodeString(encoded)
	if err != nil {
		return "", errOptionEncryptedFormat
	}

	nonceSize := aead.NonceSize()
	if len(payload) < nonceSize {
		return "", errOptionEncryptedFormat
	}

	nonce := payload[:nonceSize]
	cipherText := payload[nonceSize:]
	plainText, err := aead.Open(nil, nonce, cipherText, buildOptionAAD(optionKey))
	if err != nil {
		return "", fmt.Errorf("failed to decrypt option value: %w", err)
	}
	return string(plainText), nil
}

func createOptionAEAD(optionCryptKey string) (cipher.AEAD, error) {
	key, err := deriveOptionKey(optionCryptKey)
	if err != nil {
		return nil, err
	}
	block, err := aes.NewCipher(key)
	if err != nil {
		return nil, err
	}
	return cipher.NewGCM(block)
}

func buildOptionAAD(optionKey string) []byte {
	return []byte("option-key:" + optionKey)
}

func deriveOptionKey(optionCryptKey string) ([]byte, error) {
	return scrypt.Key([]byte(optionCryptKey), optionCryptSaltV1, 1<<15, 8, 1, 32)
}
