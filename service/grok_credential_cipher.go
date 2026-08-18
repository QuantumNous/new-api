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

const grokCredentialCipherEnv = "GROK_CREDENTIAL_CIPHER_KEY"

const grokSensitiveFieldPKCEVerifier = "pkce_verifier"

type GrokCredentialCipher interface {
	Encrypt(sessionID, field, plaintext string) (string, error)
	Decrypt(sessionID, field, envelope string) (string, error)
}

type grokCredentialCipher struct {
	aead   cipher.AEAD
	random io.Reader
}

func newGrokCredentialCipher(key []byte, random io.Reader) (GrokCredentialCipher, error) {
	if len(key) != 32 {
		return nil, errors.New("grok credential cipher key must be 32 bytes")
	}
	if random == nil {
		return nil, errors.New("grok credential cipher random reader is required")
	}
	block, err := aes.NewCipher(key)
	if err != nil {
		return nil, errors.New("grok credential cipher initialization failed")
	}
	aead, err := cipher.NewGCM(block)
	if err != nil {
		return nil, errors.New("grok credential cipher initialization failed")
	}
	return &grokCredentialCipher{aead: aead, random: random}, nil
}

func loadGrokCredentialCipherFromEnv() (GrokCredentialCipher, error) {
	encoded := strings.TrimSpace(os.Getenv(grokCredentialCipherEnv))
	if encoded == "" {
		return nil, errors.New("grok credential cipher key is invalid")
	}
	key, err := base64.StdEncoding.DecodeString(encoded)
	if err != nil || len(key) != 32 {
		return nil, errors.New("grok credential cipher key is invalid")
	}
	return newGrokCredentialCipher(key, rand.Reader)
}

func grokSensitiveAAD(sessionID, field string) []byte {
	return []byte("grok-subscription:v1:" + sessionID + ":" + field)
}

func (c *grokCredentialCipher) Encrypt(sessionID, field, plaintext string) (string, error) {
	if !isValidGrokSensitiveContext(sessionID, field) || plaintext == "" {
		return "", errors.New("grok credential cipher inputs are required")
	}
	nonce := make([]byte, c.aead.NonceSize())
	if _, err := io.ReadFull(c.random, nonce); err != nil {
		return "", errors.New("grok credential cipher nonce generation failed")
	}
	ciphertext := c.aead.Seal(nil, nonce, []byte(plaintext), grokSensitiveAAD(sessionID, field))
	payload := make([]byte, 0, len(nonce)+len(ciphertext))
	payload = append(payload, nonce...)
	payload = append(payload, ciphertext...)
	return "v1:" + base64.RawURLEncoding.EncodeToString(payload), nil
}

func (c *grokCredentialCipher) Decrypt(sessionID, field, envelope string) (string, error) {
	if !isValidGrokSensitiveContext(sessionID, field) {
		return "", errors.New("grok credential cipher inputs are required")
	}
	if !strings.HasPrefix(envelope, "v1:") {
		return "", errors.New("grok credential cipher envelope is invalid")
	}
	payload, err := base64.RawURLEncoding.DecodeString(strings.TrimPrefix(envelope, "v1:"))
	if err != nil || len(payload) <= c.aead.NonceSize() {
		return "", errors.New("grok credential cipher envelope is invalid")
	}
	nonce := payload[:c.aead.NonceSize()]
	ciphertext := payload[c.aead.NonceSize():]
	plaintext, err := c.aead.Open(nil, nonce, ciphertext, grokSensitiveAAD(sessionID, field))
	if err != nil {
		return "", errors.New("grok credential cipher envelope is invalid")
	}
	return string(plaintext), nil
}

func isValidGrokSensitiveContext(sessionID, field string) bool {
	if sessionID == "" || len(sessionID) > 64 || field != grokSensitiveFieldPKCEVerifier {
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
