package common

import (
	"crypto/rand"
	"crypto/rsa"
	"crypto/sha256"
	"crypto/x509"
	"encoding/base64"
	"encoding/pem"
	"errors"
	"fmt"
	"sync"
)

const passwordEncryptionKeyBits = 2048

var (
	passwordEncryptionOnce sync.Once
	passwordEncryptionRWMu sync.RWMutex
	passwordEncryptionKey  *rsa.PrivateKey
	passwordEncryptionKid  string
)

// ErrPasswordEncryptionInvalid is returned when an encrypted password cannot
// be decrypted (wrong padding, unknown key id, malformed ciphertext).
var ErrPasswordEncryptionInvalid = errors.New("password encryption invalid")

// InitPasswordEncryption generates the in-memory RSA keypair used to protect
// passwords during transport. The private key never leaves the process and is
// rotated on every restart; clients fetch the public key before each submit.
func InitPasswordEncryption() error {
	var initErr error
	passwordEncryptionOnce.Do(func() {
		key, err := rsa.GenerateKey(rand.Reader, passwordEncryptionKeyBits)
		if err != nil {
			initErr = fmt.Errorf("failed to generate password encryption key: %w", err)
			return
		}
		kid, err := GenerateRandomCharsKey(12)
		if err != nil {
			initErr = fmt.Errorf("failed to generate password encryption key id: %w", err)
			return
		}
		passwordEncryptionRWMu.Lock()
		passwordEncryptionKey = key
		passwordEncryptionKid = kid
		passwordEncryptionRWMu.Unlock()
	})
	return initErr
}

// PasswordEncryptionPublicKey returns the current key id and PEM-encoded
// SubjectPublicKeyInfo for the public key used to encrypt login/register
// passwords. It must be called after InitPasswordEncryption.
func PasswordEncryptionPublicKey() (kid string, publicKeyPEM string) {
	passwordEncryptionRWMu.RLock()
	defer passwordEncryptionRWMu.RUnlock()
	if passwordEncryptionKey == nil {
		return "", ""
	}
	der, err := x509.MarshalPKIXPublicKey(&passwordEncryptionKey.PublicKey)
	if err != nil {
		return passwordEncryptionKid, ""
	}
	block := &pem.Block{Type: "PUBLIC KEY", Bytes: der}
	return passwordEncryptionKid, string(pem.EncodeToMemory(block))
}

// DecryptPasswordEncrypted base64-decodes and RSA-OAEP (SHA-256) decrypts a
// client-provided password. The supplied key id must match the current key;
// otherwise ErrPasswordEncryptionInvalid is returned.
func DecryptPasswordEncrypted(ciphertextBase64, kid string) (string, error) {
	passwordEncryptionRWMu.RLock()
	key := passwordEncryptionKey
	currentKid := passwordEncryptionKid
	passwordEncryptionRWMu.RUnlock()

	if key == nil {
		return "", ErrPasswordEncryptionInvalid
	}
	if kid == "" || kid != currentKid {
		return "", ErrPasswordEncryptionInvalid
	}
	ciphertext, err := base64.StdEncoding.DecodeString(ciphertextBase64)
	if err != nil {
		return "", ErrPasswordEncryptionInvalid
	}
	plaintext, err := rsa.DecryptOAEP(sha256.New(), rand.Reader, key, ciphertext, nil)
	if err != nil {
		return "", ErrPasswordEncryptionInvalid
	}
	return string(plaintext), nil
}

// GetPlainPassword resolves the submitted plaintext password. When an encrypted
// password is present it takes precedence; otherwise the raw plaintext is used
// for backward compatibility with non-web API clients.
func GetPlainPassword(plain, encrypted, kid string) (string, error) {
	if encrypted != "" {
		password, err := DecryptPasswordEncrypted(encrypted, kid)
		if err != nil {
			return "", err
		}
		if password == "" {
			return "", ErrPasswordEncryptionInvalid
		}
		return password, nil
	}
	if plain == "" {
		return "", ErrPasswordEncryptionInvalid
	}
	return plain, nil
}
