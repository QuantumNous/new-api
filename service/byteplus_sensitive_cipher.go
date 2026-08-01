package service

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"encoding/base64"
	"errors"
	"io"
	"os"
	"strings"
)

const bytePlusSensitiveCipherEnv = "BYTEPLUS_REAL_PERSON_CIPHER_KEY"

const (
	bytePlusSensitiveFieldBytedToken    = "byted_token"
	bytePlusSensitiveFieldH5Link        = "h5_link"
	bytePlusSensitiveFieldCallbackToken = "callback_token"
)

type BytePlusSensitiveCipher interface {
	Encrypt(sessionID, field, plaintext string) (string, error)
	Decrypt(sessionID, field, envelope string) (string, error)
}

type bytePlusSensitiveCipher struct {
	aead   cipher.AEAD
	random io.Reader
}

func newBytePlusSensitiveCipher(key []byte, random io.Reader) (BytePlusSensitiveCipher, error) {
	if len(key) != 32 {
		return nil, errors.New("byteplus sensitive cipher key must be 32 bytes")
	}
	if random == nil {
		return nil, errors.New("byteplus sensitive cipher random reader is required")
	}
	block, err := aes.NewCipher(key)
	if err != nil {
		return nil, errors.New("byteplus sensitive cipher initialization failed")
	}
	aead, err := cipher.NewGCM(block)
	if err != nil {
		return nil, errors.New("byteplus sensitive cipher initialization failed")
	}
	return &bytePlusSensitiveCipher{aead: aead, random: random}, nil
}

func loadBytePlusSensitiveCipherFromEnv() (BytePlusSensitiveCipher, error) {
	encoded := strings.TrimSpace(os.Getenv(bytePlusSensitiveCipherEnv))
	if encoded == "" {
		return nil, errors.New("byteplus sensitive cipher key is invalid")
	}
	key, err := base64.StdEncoding.DecodeString(encoded)
	if err != nil || len(key) != 32 {
		return nil, errors.New("byteplus sensitive cipher key is invalid")
	}
	return newBytePlusSensitiveCipher(key, rand.Reader)
}

func bytePlusSensitiveAAD(sessionID, field string) []byte {
	return []byte("byteplus-real-person:v1:" + sessionID + ":" + field)
}

func (c *bytePlusSensitiveCipher) Encrypt(sessionID, field, plaintext string) (string, error) {
	if !isValidBytePlusSensitiveContext(sessionID, field) || plaintext == "" {
		return "", errors.New("byteplus sensitive cipher inputs are required")
	}
	nonce := make([]byte, c.aead.NonceSize())
	if _, err := io.ReadFull(c.random, nonce); err != nil {
		return "", errors.New("byteplus sensitive cipher nonce generation failed")
	}
	ciphertext := c.aead.Seal(nil, nonce, []byte(plaintext), bytePlusSensitiveAAD(sessionID, field))
	payload := make([]byte, 0, len(nonce)+len(ciphertext))
	payload = append(payload, nonce...)
	payload = append(payload, ciphertext...)
	return "v1:" + base64.RawURLEncoding.EncodeToString(payload), nil
}

func (c *bytePlusSensitiveCipher) Decrypt(sessionID, field, envelope string) (string, error) {
	if !isValidBytePlusSensitiveContext(sessionID, field) {
		return "", errors.New("byteplus sensitive cipher inputs are required")
	}
	if !strings.HasPrefix(envelope, "v1:") {
		return "", errors.New("byteplus sensitive cipher envelope is invalid")
	}
	payload, err := base64.RawURLEncoding.DecodeString(strings.TrimPrefix(envelope, "v1:"))
	if err != nil || len(payload) <= c.aead.NonceSize() {
		return "", errors.New("byteplus sensitive cipher envelope is invalid")
	}
	nonce := payload[:c.aead.NonceSize()]
	ciphertext := payload[c.aead.NonceSize():]
	plaintext, err := c.aead.Open(nil, nonce, ciphertext, bytePlusSensitiveAAD(sessionID, field))
	if err != nil {
		return "", errors.New("byteplus sensitive cipher envelope is invalid")
	}
	return string(plaintext), nil
}

func isValidBytePlusSensitiveContext(sessionID, field string) bool {
	if sessionID == "" || len(sessionID) > 64 || !isAllowedBytePlusSensitiveField(field) {
		return false
	}
	for i := 0; i < len(sessionID); i++ {
		ch := sessionID[i]
		if (ch >= 'a' && ch <= 'z') || (ch >= 'A' && ch <= 'Z') || (ch >= '0' && ch <= '9') || ch == '_' || ch == '-' {
			continue
		}
		return false
	}
	return true
}

func isAllowedBytePlusSensitiveField(field string) bool {
	switch field {
	case bytePlusSensitiveFieldBytedToken, bytePlusSensitiveFieldH5Link, bytePlusSensitiveFieldCallbackToken:
		return true
	default:
		return false
	}
}
