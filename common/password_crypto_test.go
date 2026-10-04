package common

import (
	"crypto/rand"
	"crypto/rsa"
	"crypto/sha256"
	"crypto/x509"
	"encoding/base64"
	"encoding/pem"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestPasswordCryptoGenerateAndLoad(t *testing.T) {
	pemKey, err := GeneratePasswordEncryptionPrivateKey()
	require.NoError(t, err)
	require.NotEmpty(t, pemKey)

	err = LoadPasswordEncryptionPrivateKey(pemKey)
	require.NoError(t, err)

	keyID, pubKeyPEM := PasswordEncryptionPublicKey()
	assert.NotEmpty(t, keyID)
	assert.NotEmpty(t, pubKeyPEM)

	// Encrypt a password using the public key
	block, _ := pem.Decode([]byte(pubKeyPEM))
	require.NotNil(t, block)
	parsedPubKey, err := x509.ParsePKIXPublicKey(block.Bytes)
	require.NoError(t, err)
	rsaPubKey, ok := parsedPubKey.(*rsa.PublicKey)
	require.True(t, ok)

	password := "my-secret-password-123"
	ciphertext, err := rsa.EncryptOAEP(sha256.New(), rand.Reader, rsaPubKey, []byte(password), nil)
	require.NoError(t, err)
	ciphertextB64 := base64.StdEncoding.EncodeToString(ciphertext)

	// Decrypt
	decrypted, err := DecryptPassword(ciphertextB64, keyID)
	require.NoError(t, err)
	assert.Equal(t, password, decrypted)

	// Wrong key ID
	_, err = DecryptPassword(ciphertextB64, "wrong-key-id")
	assert.ErrorIs(t, err, ErrPasswordEncryptionInvalid)

	// Tampered ciphertext
	tamperedB64 := base64.StdEncoding.EncodeToString([]byte("invalid-short-ciphertext"))
	_, err = DecryptPassword(tamperedB64, keyID)
	assert.ErrorIs(t, err, ErrPasswordEncryptionInvalid)

	// Invalid base64
	_, err = DecryptPassword("not-base-64!!!", keyID)
	assert.ErrorIs(t, err, ErrPasswordEncryptionInvalid)
}

func TestPasswordCryptoInvalidPEM(t *testing.T) {
	err := LoadPasswordEncryptionPrivateKey("not a pem")
	assert.Error(t, err)

	err = LoadPasswordEncryptionPrivateKey("-----BEGIN PRIVATE KEY-----\ninvalid\n-----END PRIVATE KEY-----")
	assert.Error(t, err)
}
