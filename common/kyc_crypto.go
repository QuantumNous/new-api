package common

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/hmac"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"errors"
	"io"
	"os"
	"sync"
)

var (
	kycEncryptKey []byte
	kycHashKey    []byte
	kycKeyOnce    sync.Once
)

// InitKYCKeys loads the AES and HMAC keys from environment variables.
// Safe to call multiple times — initialization runs at most once via sync.Once.
// Call this from main() at startup so misconfiguration warnings surface immediately,
// rather than waiting for the first KYC operation.
func InitKYCKeys() {
	kycKeyOnce.Do(func() {
		encHex := os.Getenv("KYC_ENCRYPT_KEY")
		if len(encHex) == 64 {
			key, err := hex.DecodeString(encHex)
			if err == nil {
				kycEncryptKey = key
			}
		}
		if kycEncryptKey == nil {
			SysLog("WARNING: KYC_ENCRYPT_KEY not set or invalid; using random key. Historical id_number_enc will be unreadable after restart.")
			kycEncryptKey = make([]byte, 32)
			if _, err := rand.Read(kycEncryptKey); err != nil {
				panic("kyc: failed to generate random encrypt key: " + err.Error())
			}
		}

		hashHex := os.Getenv("KYC_HASH_KEY")
		if len(hashHex) == 64 {
			key, err := hex.DecodeString(hashHex)
			if err == nil {
				kycHashKey = key
			}
		}
		if kycHashKey == nil {
			SysLog("WARNING: KYC_HASH_KEY not set or invalid; using random key. Cross-account dedup will not work after restart.")
			kycHashKey = make([]byte, 32)
			if _, err := rand.Read(kycHashKey); err != nil {
				panic("kyc: failed to generate random hash key: " + err.Error())
			}
		}
	})
}

// EncryptIDNumber encrypts the plaintext id number with AES-256-GCM.
// Output is base64(nonce || ciphertext).
func EncryptIDNumber(plain string) (string, error) {
	InitKYCKeys()
	block, err := aes.NewCipher(kycEncryptKey)
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
	ciphertext := gcm.Seal(nil, nonce, []byte(plain), nil)
	combined := append(nonce, ciphertext...)
	return base64.StdEncoding.EncodeToString(combined), nil
}

// DecryptIDNumber decrypts a base64-encoded AES-256-GCM ciphertext.
func DecryptIDNumber(enc string) (string, error) {
	InitKYCKeys()
	combined, err := base64.StdEncoding.DecodeString(enc)
	if err != nil {
		return "", err
	}
	block, err := aes.NewCipher(kycEncryptKey)
	if err != nil {
		return "", err
	}
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return "", err
	}
	nonceSize := gcm.NonceSize()
	if len(combined) < nonceSize {
		return "", errors.New("kyc: ciphertext too short")
	}
	nonce, ciphertext := combined[:nonceSize], combined[nonceSize:]
	plain, err := gcm.Open(nil, nonce, ciphertext, nil)
	if err != nil {
		return "", err
	}
	return string(plain), nil
}

// HMACIDNumber computes HMAC-SHA256 of the id number for deduplication.
func HMACIDNumber(plain string) (string, error) {
	InitKYCKeys()
	mac := hmac.New(sha256.New, kycHashKey)
	mac.Write([]byte(plain))
	return hex.EncodeToString(mac.Sum(nil)), nil
}

// MaskIDNumber masks the id number: keep first 3 and last 4 chars if len >= 8,
// otherwise return "***".
func MaskIDNumber(plain string) string {
	if plain == "" {
		return ""
	}
	runes := []rune(plain)
	if len(runes) < 8 {
		return "***"
	}
	return string(runes[:3]) + "***" + string(runes[len(runes)-4:])
}
