package model

import (
	"crypto/rand"
	"crypto/rsa"
	"crypto/sha256"
	"crypto/x509"
	"encoding/base64"
	"encoding/pem"
	"sync"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestInitPasswordEncryptionSingleAndRepeated(t *testing.T) {
	truncateTables(t)

	err := InitPasswordEncryption()
	require.NoError(t, err)

	var count int64
	require.NoError(t, DB.Model(&LoginEncryptionKey{}).Where("slot = ?", activeLoginEncryptionKeySlot).Count(&count).Error)
	assert.Equal(t, int64(1), count)

	keyID1, pubKey1 := common.PasswordEncryptionPublicKey()
	assert.NotEmpty(t, keyID1)
	assert.NotEmpty(t, pubKey1)

	// Repeated call should reload and not create duplicate records
	err = InitPasswordEncryption()
	require.NoError(t, err)

	require.NoError(t, DB.Model(&LoginEncryptionKey{}).Where("slot = ?", activeLoginEncryptionKeySlot).Count(&count).Error)
	assert.Equal(t, int64(1), count)

	keyID2, pubKey2 := common.PasswordEncryptionPublicKey()
	assert.Equal(t, keyID1, keyID2)
	assert.Equal(t, pubKey1, pubKey2)
}

func TestInitPasswordEncryptionConcurrent(t *testing.T) {
	truncateTables(t)

	const goroutines = 5
	var wg sync.WaitGroup
	errs := make(chan error, goroutines)

	for range goroutines {
		wg.Add(1)
		go func() {
			defer wg.Done()
			errs <- InitPasswordEncryption()
		}()
	}
	wg.Wait()
	close(errs)

	for err := range errs {
		require.NoError(t, err)
	}

	var count int64
	require.NoError(t, DB.Model(&LoginEncryptionKey{}).Where("slot = ?", activeLoginEncryptionKeySlot).Count(&count).Error)
	assert.Equal(t, int64(1), count)

	keyID, pubKeyPEM := common.PasswordEncryptionPublicKey()
	assert.NotEmpty(t, keyID)
	assert.NotEmpty(t, pubKeyPEM)

	// Verify encryption & decryption works with the active key
	block, _ := pem.Decode([]byte(pubKeyPEM))
	require.NotNil(t, block)
	parsedPubKey, err := x509.ParsePKIXPublicKey(block.Bytes)
	require.NoError(t, err)
	rsaPubKey, ok := parsedPubKey.(*rsa.PublicKey)
	require.True(t, ok)

	testPassword := "super-secret-123"
	ciphertext, err := rsa.EncryptOAEP(sha256.New(), rand.Reader, rsaPubKey, []byte(testPassword), nil)
	require.NoError(t, err)

	decrypted, err := common.DecryptPassword(base64.StdEncoding.EncodeToString(ciphertext), keyID)
	require.NoError(t, err)
	assert.Equal(t, testPassword, decrypted)
}
