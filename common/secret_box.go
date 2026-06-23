package common

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"errors"
	"io"
	"os"
)

const modelKeyEncryptionSecretEnv = "MODEL_KEY_ENCRYPTION_SECRET"

var ErrModelKeyEncryptionSecretMissing = errors.New("MODEL_KEY_ENCRYPTION_SECRET is required")

func modelKeyEncryptionKey() ([]byte, error) {
	secret := os.Getenv(modelKeyEncryptionSecretEnv)
	if secret == "" {
		return nil, ErrModelKeyEncryptionSecretMissing
	}
	sum := sha256.Sum256([]byte(secret))
	return sum[:], nil
}

func EncryptModelKey(plaintext string) (string, error) {
	key, err := modelKeyEncryptionKey()
	if err != nil {
		return "", err
	}
	block, err := aes.NewCipher(key)
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
	ciphertext := gcm.Seal(nonce, nonce, []byte(plaintext), nil)
	return base64.StdEncoding.EncodeToString(ciphertext), nil
}

func DecryptModelKey(ciphertext string) (string, error) {
	key, err := modelKeyEncryptionKey()
	if err != nil {
		return "", err
	}
	raw, err := base64.StdEncoding.DecodeString(ciphertext)
	if err != nil {
		return "", err
	}
	block, err := aes.NewCipher(key)
	if err != nil {
		return "", err
	}
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return "", err
	}
	if len(raw) < gcm.NonceSize() {
		return "", errors.New("invalid encrypted model key")
	}
	nonce := raw[:gcm.NonceSize()]
	body := raw[gcm.NonceSize():]
	plaintext, err := gcm.Open(nil, nonce, body, nil)
	if err != nil {
		return "", err
	}
	return string(plaintext), nil
}

func MaskSecret(secret string) string {
	if secret == "" {
		return ""
	}
	runes := []rune(secret)
	if len(runes) <= 8 {
		return "****"
	}
	return string(runes[:4]) + "****" + string(runes[len(runes)-4:])
}
