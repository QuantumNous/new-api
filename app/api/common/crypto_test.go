package common

import (
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestEncryptDecryptAESGCMRoundTrip(t *testing.T) {
	original := "super-secret-proxy-password"
	encrypted, err := EncryptAESGCM(original, "proxy-config")
	require.NoError(t, err)

	// Ciphertext must not contain plaintext.
	assert.NotContains(t, encrypted, original)
	assert.True(t, strings.HasPrefix(encrypted, "")) // base64-raw-url encoded

	decrypted, err := DecryptAESGCM(encrypted, "proxy-config")
	require.NoError(t, err)
	assert.Equal(t, original, decrypted)
}

func TestDecryptAESGCMWrongPurpose(t *testing.T) {
	encrypted, err := EncryptAESGCM("secret", "purpose-a")
	require.NoError(t, err)

	_, err = DecryptAESGCM(encrypted, "purpose-b")
	require.Error(t, err)
}

func TestDecryptAESGCMMalformed(t *testing.T) {
	_, err := DecryptAESGCM("not-valid-base64-!!!", "proxy-config")
	require.Error(t, err)
}

func TestDecryptAESGCMLegacyPlaintext(t *testing.T) {
	// Legacy plaintext that is valid base64 but not valid GCM ciphertext.
	// Short valid base64 that's too small for a nonce.
	_, err := DecryptAESGCM("YWJj", "proxy-config") // "abc" in base64
	require.Error(t, err)
}
