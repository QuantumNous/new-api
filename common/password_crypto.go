package common

import (
	"context"
	"crypto/rand"
	"crypto/rsa"
	"crypto/sha256"
	"crypto/x509"
	"encoding/base64"
	"encoding/json"
	"encoding/pem"
	"errors"
	"fmt"
	"sync"
	"time"
)

const passwordEncryptionKeyBits = 2048

const (
	// passwordEncryptionRedisKey is the Redis key that holds the keypair shared
	// by all request-serving replicas. It is only used when Redis is enabled.
	passwordEncryptionRedisKey = "new-api:password-encryption-key"
	// passwordEncryptionRedisTTL controls how often the shared key rotates when
	// Redis is enabled. Replicas refresh the TTL while syncing, so a healthy
	// deployment keeps one stable key across restarts.
	passwordEncryptionRedisTTL = 7 * 24 * time.Hour
	// passwordEncryptionSyncInterval throttles how often a replica reloads the
	// shared key from Redis.
	passwordEncryptionSyncInterval = time.Minute
)

var (
	passwordEncryptionOnce     sync.Once
	passwordEncryptionRWMu     sync.RWMutex
	passwordEncryptionKey      *rsa.PrivateKey
	passwordEncryptionKid      string
	passwordEncryptionSyncedAt time.Time
)

// ErrPasswordEncryptionInvalid is returned when an encrypted password cannot
// be decrypted (wrong padding, unknown key id, malformed ciphertext).
var ErrPasswordEncryptionInvalid = errors.New("password encryption invalid")

// passwordEncryptionSharedKey is the Redis representation of the keypair shared
// across replicas.
type passwordEncryptionSharedKey struct {
	Kid        string `json:"kid"`
	PrivateKey string `json:"private_key"` // base64-encoded PKCS#8 DER
}

// InitPasswordEncryption prepares the RSA keypair used to protect passwords
// during transport. When Redis is enabled, all replicas share one active
// keypair: a replica adopts an existing shared key or atomically publishes a
// freshly generated one, so a request encrypted with a key fetched from one
// instance can be decrypted by any other instance. Without Redis the key is
// kept in process memory only and rotated on every restart, which is safe for
// single-instance deployments.
func InitPasswordEncryption() error {
	var initErr error
	passwordEncryptionOnce.Do(func() {
		// 1. Adopt the keypair already shared by other replicas when one exists.
		if loadPasswordEncryptionSharedKey() {
			return
		}
		// 2. No shared key yet: generate a fresh one.
		key, kid, err := generatePasswordEncryptionKey()
		if err != nil {
			initErr = err
			return
		}
		// 3. Publish it atomically so concurrently starting replicas converge on
		//    one key; if another replica won the race, adopt its key instead.
		if RedisEnabled && RDB != nil {
			if storePasswordEncryptionSharedKey(key, kid) {
				setPasswordEncryptionKey(key, kid)
				return
			}
			if loadPasswordEncryptionSharedKey() {
				return
			}
		}
		setPasswordEncryptionKey(key, kid)
	})
	return initErr
}

// generatePasswordEncryptionKey creates a fresh RSA keypair and key id.
func generatePasswordEncryptionKey() (*rsa.PrivateKey, string, error) {
	key, err := rsa.GenerateKey(rand.Reader, passwordEncryptionKeyBits)
	if err != nil {
		return nil, "", fmt.Errorf("failed to generate password encryption key: %w", err)
	}
	kid, err := GenerateRandomCharsKey(12)
	if err != nil {
		return nil, "", fmt.Errorf("failed to generate password encryption key id: %w", err)
	}
	return key, kid, nil
}

// setPasswordEncryptionKey replaces the active in-memory keypair.
func setPasswordEncryptionKey(key *rsa.PrivateKey, kid string) {
	passwordEncryptionRWMu.Lock()
	defer passwordEncryptionRWMu.Unlock()
	passwordEncryptionKey = key
	passwordEncryptionKid = kid
	passwordEncryptionSyncedAt = time.Now()
}

// storePasswordEncryptionSharedKey publishes the keypair to Redis only when no
// key is stored yet (SETNX), so replicas that start concurrently converge on a
// single active key instead of clobbering each other.
func storePasswordEncryptionSharedKey(key *rsa.PrivateKey, kid string) bool {
	if !RedisEnabled || RDB == nil {
		return false
	}
	der, err := x509.MarshalPKCS8PrivateKey(key)
	if err != nil {
		return false
	}
	payload, err := json.Marshal(passwordEncryptionSharedKey{
		Kid:        kid,
		PrivateKey: base64.StdEncoding.EncodeToString(der),
	})
	if err != nil {
		return false
	}
	ok, err := RDB.SetNX(
		context.Background(),
		passwordEncryptionRedisKey,
		payload,
		passwordEncryptionRedisTTL,
	).Result()
	return err == nil && ok
}

// loadPasswordEncryptionSharedKey loads the keypair shared by all replicas from
// Redis (when enabled) and adopts it as the active key. It reports whether a
// shared key is now active.
func loadPasswordEncryptionSharedKey() bool {
	if !RedisEnabled || RDB == nil {
		return false
	}
	ctx := context.Background()
	raw, err := RDB.Get(ctx, passwordEncryptionRedisKey).Result()
	if err != nil {
		return false
	}
	var payload passwordEncryptionSharedKey
	if err := json.Unmarshal([]byte(raw), &payload); err != nil {
		return false
	}
	if payload.Kid == "" || payload.PrivateKey == "" {
		return false
	}
	der, err := base64.StdEncoding.DecodeString(payload.PrivateKey)
	if err != nil {
		return false
	}
	parsed, err := x509.ParsePKCS8PrivateKey(der)
	if err != nil {
		return false
	}
	key, ok := parsed.(*rsa.PrivateKey)
	if !ok || key.N == nil {
		return false
	}
	// Refresh the TTL so a healthy deployment keeps one stable key.
	_ = RDB.Expire(ctx, passwordEncryptionRedisKey, passwordEncryptionRedisTTL).Err()
	setPasswordEncryptionKey(key, payload.Kid)
	return true
}

// ensurePasswordEncryptionSynced periodically reloads the shared key so a
// replica converges on the key used by the rest of the deployment even when it
// started before the key existed (for example when Redis becomes available
// later). It also publishes the local key when no shared key exists yet.
func ensurePasswordEncryptionSynced() {
	if !RedisEnabled || RDB == nil {
		return
	}
	passwordEncryptionRWMu.RLock()
	lastSync := passwordEncryptionSyncedAt
	passwordEncryptionRWMu.RUnlock()
	if time.Since(lastSync) < passwordEncryptionSyncInterval {
		return
	}
	if loadPasswordEncryptionSharedKey() {
		return
	}
	passwordEncryptionRWMu.RLock()
	key := passwordEncryptionKey
	kid := passwordEncryptionKid
	passwordEncryptionRWMu.RUnlock()
	if key != nil {
		storePasswordEncryptionSharedKey(key, kid)
	}
	passwordEncryptionRWMu.Lock()
	passwordEncryptionSyncedAt = time.Now()
	passwordEncryptionRWMu.Unlock()
}

// PasswordEncryptionPublicKey returns the current key id and PEM-encoded
// SubjectPublicKeyInfo for the public key used to encrypt login/register
// passwords. It must be called after InitPasswordEncryption.
func PasswordEncryptionPublicKey() (kid string, publicKeyPEM string) {
	ensurePasswordEncryptionSynced()
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
// otherwise ErrPasswordEncryptionInvalid is returned. When Redis is enabled and
// the key id looks stale, the shared key is reloaded once before rejecting the
// request, so ciphertexts produced with a key from another replica still work.
func DecryptPasswordEncrypted(ciphertextBase64, kid string) (string, error) {
	passwordEncryptionRWMu.RLock()
	key := passwordEncryptionKey
	currentKid := passwordEncryptionKid
	passwordEncryptionRWMu.RUnlock()

	if key == nil {
		return "", ErrPasswordEncryptionInvalid
	}
	if kid == "" || kid != currentKid {
		// The ciphertext may have been produced with a key from another replica
		// or from before a rotation; reload the shared key once and retry.
		if RedisEnabled && RDB != nil && loadPasswordEncryptionSharedKey() {
			passwordEncryptionRWMu.RLock()
			key = passwordEncryptionKey
			currentKid = passwordEncryptionKid
			passwordEncryptionRWMu.RUnlock()
			if kid == "" || kid != currentKid {
				return "", ErrPasswordEncryptionInvalid
			}
		} else {
			return "", ErrPasswordEncryptionInvalid
		}
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
