package common

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/hmac"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"fmt"
	"io"

	"golang.org/x/crypto/bcrypt"
)

func GenerateHMACWithKey(key []byte, data string) string {
	h := hmac.New(sha256.New, key)
	h.Write([]byte(data))
	return hex.EncodeToString(h.Sum(nil))
}

func GenerateHMAC(data string) string {
	h := hmac.New(sha256.New, []byte(CryptoSecret))
	h.Write([]byte(data))
	return hex.EncodeToString(h.Sum(nil))
}

func Password2Hash(password string) (string, error) {
	passwordBytes := []byte(password)
	hashedPassword, err := bcrypt.GenerateFromPassword(passwordBytes, bcrypt.DefaultCost)
	return string(hashedPassword), err
}

func ValidatePasswordAndHash(password string, hash string) bool {
	err := bcrypt.CompareHashAndPassword([]byte(hash), []byte(password))
	return err == nil
}

func aesGCMKey(purpose string) []byte {
	sum := sha256.Sum256([]byte(purpose + ":" + CryptoSecret))
	return sum[:]
}

// EncryptAESGCM encrypts plaintext with AES-256-GCM using a key derived from
// CryptoSecret and the given purpose tag. Returns base64-raw-url-encoded
// ciphertext (nonce prepended). The purpose parameter namespaces the key so
// different callers don't share the same encryption key.
func EncryptAESGCM(plaintext, purpose string) (string, error) {
	block, err := aes.NewCipher(aesGCMKey(purpose))
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
	sealed := gcm.Seal(nonce, nonce, []byte(plaintext), nil)
	return base64.RawURLEncoding.EncodeToString(sealed), nil
}

// DecryptAESGCM reverses EncryptAESGCM. Returns an error if the ciphertext is
// malformed or the key does not match.
func DecryptAESGCM(ciphertext, purpose string) (string, error) {
	encoded, err := base64.RawURLEncoding.DecodeString(ciphertext)
	if err != nil {
		return "", fmt.Errorf("decode ciphertext: %w", err)
	}
	block, err := aes.NewCipher(aesGCMKey(purpose))
	if err != nil {
		return "", err
	}
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return "", err
	}
	if len(encoded) < gcm.NonceSize() {
		return "", fmt.Errorf("ciphertext is truncated")
	}
	plain, err := gcm.Open(nil, encoded[:gcm.NonceSize()], encoded[gcm.NonceSize():], nil)
	if err != nil {
		return "", fmt.Errorf("decrypt ciphertext: %w", err)
	}
	return string(plain), nil
}
