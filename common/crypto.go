package common

import (
	"crypto/hmac"
	"crypto/rand"
	"crypto/rsa"
	"crypto/sha256"
	"crypto/x509"
	"encoding/base64"
	"encoding/hex"
	"encoding/pem"
	"errors"
	"fmt"
	"sync"

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

// Password encryption (RSA) — defense-in-depth on top of TLS.
//
// The browser encrypts the plaintext password with the RSA public key
// exposed via /api/status and sends the base64 ciphertext in the
// `password_cipher` field. The backend decrypts here and routes the
// plaintext into the existing bcrypt flow. Plaintext fallback is allowed
// while PasswordEncryptionRequired is false so non-browser clients
// (curl, SDKs) keep working during migration.

var (
	passwordEncryptionMu       sync.RWMutex
	passwordEncryptionPriv     *rsa.PrivateKey
	passwordEncryptionPubPEM   string
	passwordEncryptionRequired bool
)

// Option key names — kept as constants so call sites don't drift.
const (
	OptionKeyPasswordEncryptionPrivateKey = "PasswordEncryptionPrivateKey"
	OptionKeyPasswordEncryptionRequired   = "PasswordEncryptionRequired"
)

// PasswordEncryptionKeyBits is the RSA modulus size generated when no key
// is persisted. 2048 is the floor that's still considered acceptable for
// interactive auth defense-in-depth; raise if you have a reason.
const PasswordEncryptionKeyBits = 2048

// GeneratePasswordEncryptionKeyPair produces PEM-encoded PKCS#8 private key
// and PEM-encoded SubjectPublicKeyInfo public key. Used at startup when no
// key is persisted and by tests.
func GeneratePasswordEncryptionKeyPair() (privPEM string, pubPEM string, err error) {
	key, err := rsa.GenerateKey(rand.Reader, PasswordEncryptionKeyBits)
	if err != nil {
		return "", "", fmt.Errorf("generate rsa key: %w", err)
	}
	privDER, err := x509.MarshalPKCS8PrivateKey(key)
	if err != nil {
		return "", "", fmt.Errorf("marshal pkcs8: %w", err)
	}
	privPEM = string(pem.EncodeToMemory(&pem.Block{
		Type:  "PRIVATE KEY",
		Bytes: privDER,
	}))
	pubPEM, err = encodePublicKeyPEM(&key.PublicKey)
	if err != nil {
		return "", "", err
	}
	return privPEM, pubPEM, nil
}

func encodePublicKeyPEM(pub *rsa.PublicKey) (string, error) {
	pubDER, err := x509.MarshalPKIXPublicKey(pub)
	if err != nil {
		return "", fmt.Errorf("marshal pkix public: %w", err)
	}
	return string(pem.EncodeToMemory(&pem.Block{
		Type:  "PUBLIC KEY",
		Bytes: pubDER,
	})), nil
}

// LoadPasswordEncryptionKey parses a PEM PKCS#8 private key, populates the
// in-memory private key handle and derived public key PEM, and returns the
// public key PEM. An empty input clears any previously loaded key. Invalid
// PEM returns an error; the previous key (if any) is left intact.
func LoadPasswordEncryptionKey(privateKeyPEM string) (pubPEM string, err error) {
	if privateKeyPEM == "" {
		passwordEncryptionMu.Lock()
		defer passwordEncryptionMu.Unlock()
		passwordEncryptionPriv = nil
		passwordEncryptionPubPEM = ""
		return "", nil
	}
	block, _ := pem.Decode([]byte(privateKeyPEM))
	if block == nil {
		return "", errors.New("password encryption key: invalid PEM block")
	}
	parsed, err := x509.ParsePKCS8PrivateKey(block.Bytes)
	if err != nil {
		return "", fmt.Errorf("password encryption key: parse pkcs8: %w", err)
	}
	key, ok := parsed.(*rsa.PrivateKey)
	if !ok {
		return "", errors.New("password encryption key: not an RSA private key")
	}
	pubPEM, err = encodePublicKeyPEM(&key.PublicKey)
	if err != nil {
		return "", err
	}
	passwordEncryptionMu.Lock()
	defer passwordEncryptionMu.Unlock()
	passwordEncryptionPriv = key
	passwordEncryptionPubPEM = pubPEM
	return pubPEM, nil
}

// SetPasswordEncryptionRequired toggles the global "must encrypt" flag.
// When true, handlers reject requests that omit password_cipher.
func SetPasswordEncryptionRequired(required bool) {
	passwordEncryptionMu.Lock()
	defer passwordEncryptionMu.Unlock()
	passwordEncryptionRequired = required
}

// IsPasswordEncryptionRequired reports whether plaintext passwords are
// currently rejected by handlers.
func IsPasswordEncryptionRequired() bool {
	passwordEncryptionMu.RLock()
	defer passwordEncryptionMu.RUnlock()
	return passwordEncryptionRequired
}

// PasswordEncryptionPublicKeyPEM returns the PEM-encoded public key to
// expose to the browser. Empty when no key is loaded.
func PasswordEncryptionPublicKeyPEM() string {
	passwordEncryptionMu.RLock()
	defer passwordEncryptionMu.RUnlock()
	return passwordEncryptionPubPEM
}

// HasPasswordEncryptionKey reports whether a private key is loaded.
func HasPasswordEncryptionKey() bool {
	passwordEncryptionMu.RLock()
	defer passwordEncryptionMu.RUnlock()
	return passwordEncryptionPriv != nil
}

// DecryptPassword decodes the base64 RSA-PKCS1v15 ciphertext and decrypts
// it with the loaded private key. Returns the plaintext password. An empty
// cipher returns ("", nil) — the caller decides whether empty is allowed.
// A nil private key returns an error so callers can surface "key not
// available" instead of silently accepting plaintext.
func DecryptPassword(cipherB64 string) (string, error) {
	if cipherB64 == "" {
		return "", nil
	}
	passwordEncryptionMu.RLock()
	priv := passwordEncryptionPriv
	passwordEncryptionMu.RUnlock()
	if priv == nil {
		return "", errors.New("password encryption key not loaded")
	}
	ct, err := base64.StdEncoding.DecodeString(cipherB64)
	if err != nil {
		return "", fmt.Errorf("decode password cipher base64: %w", err)
	}
	pt, err := rsa.DecryptPKCS1v15(rand.Reader, priv, ct)
	if err != nil {
		return "", fmt.Errorf("rsa decrypt password: %w", err)
	}
	return string(pt), nil
}
