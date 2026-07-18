package common

import (
	"bytes"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestEncryptStringRoundTrip(t *testing.T) {
	original := CryptoSecret
	CryptoSecret = "test-crypto-secret"
	t.Cleanup(func() { CryptoSecret = original })

	ciphertext, err := EncryptString("webhook-secret")
	require.NoError(t, err)
	assert.True(t, strings.HasPrefix(ciphertext, encryptedStringPrefix))
	assert.NotContains(t, ciphertext, "webhook-secret")

	plaintext, err := DecryptString(ciphertext)
	require.NoError(t, err)
	assert.Equal(t, "webhook-secret", plaintext)
}

func TestDecryptStringKeepsLegacyPlaintextCompatible(t *testing.T) {
	plaintext, err := DecryptString("legacy-secret")
	require.NoError(t, err)
	assert.Equal(t, "legacy-secret", plaintext)
}

func TestEncryptStringDoesNotTrustUserSuppliedCiphertextPrefix(t *testing.T) {
	original := CryptoSecret
	CryptoSecret = "test-crypto-secret"
	t.Cleanup(func() { CryptoSecret = original })

	value := "enc:v1:user-controlled-value"
	ciphertext, err := EncryptString(value)
	require.NoError(t, err)
	assert.NotEqual(t, value, ciphertext)

	plaintext, err := DecryptString(ciphertext)
	require.NoError(t, err)
	assert.Equal(t, value, plaintext)
}

func TestDecryptStringRejectsTamperedCiphertext(t *testing.T) {
	original := CryptoSecret
	CryptoSecret = "test-crypto-secret"
	t.Cleanup(func() { CryptoSecret = original })

	ciphertext, err := EncryptString("webhook-secret")
	require.NoError(t, err)
	ciphertext = ciphertext[:len(ciphertext)-1] + "x"
	_, err = DecryptString(ciphertext)
	assert.Error(t, err)
}

func TestEncryptBytesRoundTripAndRejectsTampering(t *testing.T) {
	original := CryptoSecret
	CryptoSecret = "test-crypto-secret"
	t.Cleanup(func() { CryptoSecret = original })
	plaintext := []byte("bounded image artifact chunk")

	ciphertext, err := EncryptBytes(plaintext)
	require.NoError(t, err)
	assert.True(t, bytes.HasPrefix(ciphertext, []byte(encryptedBytesPrefix)))
	assert.NotContains(t, string(ciphertext), string(plaintext))

	restored, err := DecryptBytes(ciphertext)
	require.NoError(t, err)
	assert.Equal(t, plaintext, restored)
	ciphertext[len(ciphertext)-1] ^= 1
	_, err = DecryptBytes(ciphertext)
	require.Error(t, err)
}

func TestDecryptBytesKeepsLegacyPlaintextCompatible(t *testing.T) {
	legacy := []byte("legacy artifact chunk")
	restored, err := DecryptBytes(legacy)
	require.NoError(t, err)
	assert.Equal(t, legacy, restored)
}

func TestStableCryptoSecretConfiguredRequiresDedicatedCryptoSecret(t *testing.T) {
	t.Setenv("CRYPTO_SECRET", "")
	t.Setenv("SESSION_SECRET", "session-only-secret")
	assert.False(t, StableCryptoSecretConfigured())

	t.Setenv("CRYPTO_SECRET", "durable-async-image-secret")
	assert.True(t, StableCryptoSecretConfigured())
}
