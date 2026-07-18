package common

import (
	"bytes"
	"crypto/aes"
	"crypto/cipher"
	"crypto/hmac"
	crand "crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"errors"
	"fmt"
	"io"
	"os"
	"strings"

	"golang.org/x/crypto/bcrypt"
)

const (
	encryptedStringPrefix = "enc:v1:"
	encryptedBytesPrefix  = "encb:v1:"
)

// EncryptString encrypts short application secrets before they are persisted.
// CryptoSecret must be stable across restarts; deployments should set
// CRYPTO_SECRET explicitly instead of relying on the process-local default.
func EncryptString(plaintext string) (string, error) {
	if plaintext == "" {
		return "", nil
	}
	key := cryptoKey()
	if len(key) == 0 {
		return "", errors.New("crypto secret is not configured")
	}
	block, err := aes.NewCipher(key)
	if err != nil {
		return "", fmt.Errorf("create secret cipher: %w", err)
	}
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return "", fmt.Errorf("create secret AEAD: %w", err)
	}
	nonce := make([]byte, gcm.NonceSize())
	if _, err := io.ReadFull(crand.Reader, nonce); err != nil {
		return "", fmt.Errorf("generate secret nonce: %w", err)
	}
	ciphertext := gcm.Seal(nil, nonce, []byte(plaintext), nil)
	encoded := base64.RawURLEncoding.EncodeToString(append(nonce, ciphertext...))
	return encryptedStringPrefix + encoded, nil
}

// StableCryptoSecretConfigured reports whether the process has the dedicated
// secret required for durable encrypted data. CryptoSecret has an in-memory
// random default and may otherwise fall back to SESSION_SECRET, so async image
// persistence must require CRYPTO_SECRET explicitly.
func StableCryptoSecretConfigured() bool {
	return strings.TrimSpace(os.Getenv("CRYPTO_SECRET")) != ""
}

// AsyncImageEncryptedWritesEnabled gates new encrypted row formats during a
// reader-first rolling deployment. All replicas must understand encrypted
// records before operators enable this flag.
func AsyncImageEncryptedWritesEnabled() bool {
	return GetEnvOrDefaultBool("ASYNC_IMAGE_ENCRYPTED_WRITES_ENABLED", false)
}

// EncryptBytes encrypts one bounded binary chunk without base64 expansion.
func EncryptBytes(plaintext []byte) ([]byte, error) {
	if len(plaintext) == 0 {
		return nil, nil
	}
	key := cryptoKey()
	if len(key) == 0 {
		return nil, errors.New("crypto secret is not configured")
	}
	block, err := aes.NewCipher(key)
	if err != nil {
		return nil, fmt.Errorf("create binary cipher: %w", err)
	}
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return nil, fmt.Errorf("create binary AEAD: %w", err)
	}
	nonce := make([]byte, gcm.NonceSize())
	if _, err := io.ReadFull(crand.Reader, nonce); err != nil {
		return nil, fmt.Errorf("generate binary nonce: %w", err)
	}
	sealed := make([]byte, 0, len(encryptedBytesPrefix)+len(nonce)+len(plaintext)+gcm.Overhead())
	sealed = append(sealed, encryptedBytesPrefix...)
	sealed = append(sealed, nonce...)
	sealed = gcm.Seal(sealed, nonce, plaintext, nil)
	return sealed, nil
}

// DecryptBytes reads per-chunk ciphertext and keeps legacy plaintext chunks
// compatible during and after the rolling upgrade.
func DecryptBytes(value []byte) ([]byte, error) {
	if len(value) == 0 || !bytes.HasPrefix(value, []byte(encryptedBytesPrefix)) {
		return append([]byte(nil), value...), nil
	}
	data := value[len(encryptedBytesPrefix):]
	key := cryptoKey()
	if len(key) == 0 {
		return nil, errors.New("crypto secret is not configured")
	}
	block, err := aes.NewCipher(key)
	if err != nil {
		return nil, fmt.Errorf("create binary cipher: %w", err)
	}
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return nil, fmt.Errorf("create binary AEAD: %w", err)
	}
	if len(data) < gcm.NonceSize()+gcm.Overhead() {
		return nil, errors.New("encrypted binary value is truncated")
	}
	plaintext, err := gcm.Open(nil, data[:gcm.NonceSize()], data[gcm.NonceSize():], nil)
	if err != nil {
		return nil, errors.New("encrypted binary value authentication failed")
	}
	return plaintext, nil
}

// DecryptString decrypts values written by EncryptString. Values without the
// version prefix are treated as legacy plaintext so existing pending tasks can
// finish during a rolling upgrade; newly created rows are always encrypted.
func DecryptString(value string) (string, error) {
	if value == "" || !strings.HasPrefix(value, encryptedStringPrefix) {
		return value, nil
	}
	encoded := strings.TrimPrefix(value, encryptedStringPrefix)
	data, err := base64.RawURLEncoding.DecodeString(encoded)
	if err != nil {
		return "", fmt.Errorf("decode encrypted secret: %w", err)
	}
	key := cryptoKey()
	if len(key) == 0 {
		return "", errors.New("crypto secret is not configured")
	}
	block, err := aes.NewCipher(key)
	if err != nil {
		return "", fmt.Errorf("create secret cipher: %w", err)
	}
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return "", fmt.Errorf("create secret AEAD: %w", err)
	}
	if len(data) < gcm.NonceSize() {
		return "", errors.New("encrypted secret is truncated")
	}
	plaintext, err := gcm.Open(nil, data[:gcm.NonceSize()], data[gcm.NonceSize():], nil)
	if err != nil {
		return "", errors.New("encrypted secret authentication failed")
	}
	return string(plaintext), nil
}

func cryptoKey() []byte {
	secret := strings.TrimSpace(CryptoSecret)
	if secret == "" {
		return nil
	}
	digest := sha256.Sum256([]byte(secret))
	return digest[:]
}

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
