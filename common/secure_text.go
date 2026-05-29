package common

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"errors"
	"fmt"
	"io"
	"strings"
)

const secureTextPrefix = "enc:v1:"

func IsSecureText(value string) bool {
	return strings.HasPrefix(value, secureTextPrefix)
}

func EncryptSecureText(value string) (string, error) {
	if value == "" || IsSecureText(value) {
		return value, nil
	}
	aead, err := secureTextAEAD()
	if err != nil {
		return "", err
	}
	nonce := make([]byte, aead.NonceSize())
	if _, err := io.ReadFull(rand.Reader, nonce); err != nil {
		return "", fmt.Errorf("generate nonce: %w", err)
	}
	ciphertext := aead.Seal(nil, nonce, []byte(value), nil)
	payload := append(nonce, ciphertext...)
	return secureTextPrefix + base64.RawURLEncoding.EncodeToString(payload), nil
}

func DecryptSecureText(value string) (string, error) {
	if value == "" || !IsSecureText(value) {
		return value, nil
	}
	aead, err := secureTextAEAD()
	if err != nil {
		return "", err
	}
	payload, err := base64.RawURLEncoding.DecodeString(strings.TrimPrefix(value, secureTextPrefix))
	if err != nil {
		return "", fmt.Errorf("decode secure text: %w", err)
	}
	if len(payload) <= aead.NonceSize() {
		return "", errors.New("secure text payload is too short")
	}
	nonce := payload[:aead.NonceSize()]
	ciphertext := payload[aead.NonceSize():]
	plaintext, err := aead.Open(nil, nonce, ciphertext, nil)
	if err != nil {
		return "", fmt.Errorf("decrypt secure text: %w", err)
	}
	return string(plaintext), nil
}

func secureTextAEAD() (cipher.AEAD, error) {
	key := sha256.Sum256([]byte(CryptoSecret))
	block, err := aes.NewCipher(key[:])
	if err != nil {
		return nil, fmt.Errorf("create secure text cipher: %w", err)
	}
	aead, err := cipher.NewGCM(block)
	if err != nil {
		return nil, fmt.Errorf("create secure text AEAD: %w", err)
	}
	return aead, nil
}
