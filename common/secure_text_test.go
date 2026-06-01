package common

import (
	"testing"

	"github.com/stretchr/testify/require"
)

func TestSecureTextRoundTrip(t *testing.T) {
	originalSecret := CryptoSecret
	CryptoSecret = "test-secret-for-secure-text"
	t.Cleanup(func() {
		CryptoSecret = originalSecret
	})

	encrypted, err := EncryptSecureText("sk-test-secret")
	require.NoError(t, err)
	require.True(t, IsSecureText(encrypted))
	require.NotContains(t, encrypted, "sk-test-secret")

	decrypted, err := DecryptSecureText(encrypted)
	require.NoError(t, err)
	require.Equal(t, "sk-test-secret", decrypted)
}

func TestSecureTextLeavesPlainAndExistingCiphertextUnchanged(t *testing.T) {
	plain, err := DecryptSecureText("plain")
	require.NoError(t, err)
	require.Equal(t, "plain", plain)

	encrypted, err := EncryptSecureText("enc:v1:already")
	require.NoError(t, err)
	require.Equal(t, "enc:v1:already", encrypted)
}
