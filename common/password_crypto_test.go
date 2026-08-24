package common

import (
	"crypto/rand"
	"crypto/rsa"
	"crypto/sha256"
	"encoding/base64"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestInitPasswordEncryptionExposesPublicKey(t *testing.T) {
	require.NoError(t, InitPasswordEncryption())
	kid, publicKeyPEM := PasswordEncryptionPublicKey()
	require.NotEmpty(t, kid)
	require.NotEmpty(t, publicKeyPEM)
	assert.Contains(t, publicKeyPEM, "BEGIN PUBLIC KEY")
	assert.NotContains(t, publicKeyPEM, "PRIVATE KEY")
}

func TestPasswordEncryptionRoundTrip(t *testing.T) {
	require.NoError(t, InitPasswordEncryption())
	kid, _ := PasswordEncryptionPublicKey()
	require.NotEmpty(t, kid)

	ciphertext, err := rsa.EncryptOAEP(sha256.New(), rand.Reader, &passwordEncryptionKey.PublicKey, []byte("MyPass123!"), nil)
	require.NoError(t, err)

	plain, err := DecryptPasswordEncrypted(base64.StdEncoding.EncodeToString(ciphertext), kid)
	require.NoError(t, err)
	assert.Equal(t, "MyPass123!", plain)
}

func TestPasswordEncryptionRejectsBadInput(t *testing.T) {
	require.NoError(t, InitPasswordEncryption())
	kid, _ := PasswordEncryptionPublicKey()
	require.NotEmpty(t, kid)

	t.Run("wrong key id", func(t *testing.T) {
		ciphertext, err := rsa.EncryptOAEP(sha256.New(), rand.Reader, &passwordEncryptionKey.PublicKey, []byte("MyPass123!"), nil)
		require.NoError(t, err)
		_, err = DecryptPasswordEncrypted(base64.StdEncoding.EncodeToString(ciphertext), "stale-kid")
		assert.ErrorIs(t, err, ErrPasswordEncryptionInvalid)
	})

	t.Run("malformed base64", func(t *testing.T) {
		_, err := DecryptPasswordEncrypted("not-base64!!", kid)
		assert.ErrorIs(t, err, ErrPasswordEncryptionInvalid)
	})

	t.Run("empty ciphertext", func(t *testing.T) {
		_, err := DecryptPasswordEncrypted("", kid)
		assert.ErrorIs(t, err, ErrPasswordEncryptionInvalid)
	})
}

func TestGetPlainPasswordPreference(t *testing.T) {
	require.NoError(t, InitPasswordEncryption())
	kid, _ := PasswordEncryptionPublicKey()
	require.NotEmpty(t, kid)

	ciphertext, err := rsa.EncryptOAEP(sha256.New(), rand.Reader, &passwordEncryptionKey.PublicKey, []byte("EncryptedPass1"), nil)
	require.NoError(t, err)
	encrypted := base64.StdEncoding.EncodeToString(ciphertext)

	t.Run("encrypted takes precedence over plain", func(t *testing.T) {
		plain, err := GetPlainPassword("raw-plain", encrypted, kid)
		require.NoError(t, err)
		assert.Equal(t, "EncryptedPass1", plain)
	})

	t.Run("plain fallback", func(t *testing.T) {
		plain, err := GetPlainPassword("raw-plain", "", "")
		require.NoError(t, err)
		assert.Equal(t, "raw-plain", plain)
	})

	t.Run("both empty fails", func(t *testing.T) {
		_, err := GetPlainPassword("", "", "")
		assert.ErrorIs(t, err, ErrPasswordEncryptionInvalid)
	})
}

func TestValidatePasswordStrength(t *testing.T) {
	cases := []struct {
		name     string
		password string
		wantErr  bool
	}{
		{name: "eight chars three classes", password: "abc123XY", wantErr: false},
		{name: "twenty chars three classes", password: "abcdefghijk12345678X", wantErr: false},
		{name: "all four classes", password: "Abc123@!xY", wantErr: false},
		{name: "seven chars", password: "abc123X", wantErr: true},
		{name: "twenty one chars", password: "abcdefghijk123456789XYZ", wantErr: true},
		{name: "two classes only", password: "abcdefgh1234", wantErr: true},
		{name: "lowercase only", password: "abcdefgh", wantErr: true},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			err := ValidatePasswordStrength(tc.password)
			if tc.wantErr {
				assert.ErrorIs(t, err, ErrPasswordTooWeak)
			} else {
				assert.NoError(t, err)
			}
		})
	}
}
