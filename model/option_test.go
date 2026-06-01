package model

import (
	"encoding/base64"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/setting"
	"github.com/stretchr/testify/require"
)

func TestAlipayOptionCryptoRoundTrip(t *testing.T) {
	t.Setenv("OPTION_CRYPT_KEY", "test-option-crypt-key")

	plainText := "-----BEGIN PRIVATE KEY-----\nabc123\n-----END PRIVATE KEY-----"
	encrypted, err := common.EncryptAlipayOptionValue("AlipayPrivateKey", plainText)
	require.NoError(t, err)
	require.True(t, common.IsEncryptedOptionValue(encrypted))
	require.NotEqual(t, plainText, encrypted)

	decrypted, err := common.DecryptAlipayOptionValue("AlipayPrivateKey", encrypted)
	require.NoError(t, err)
	require.Equal(t, plainText, decrypted)
}

func TestAlipayOptionCryptoMissingOptionCryptKey(t *testing.T) {
	t.Setenv("OPTION_CRYPT_KEY", "")

	_, err := common.EncryptAlipayOptionValue("AlipayPrivateKey", "value")
	require.Error(t, err)
	require.ErrorContains(t, err, "OPTION_CRYPT_KEY is required")

	encrypted := common.OptionEncryptedPrefixV1 + "abcd"
	_, err = common.DecryptAlipayOptionValue("AlipayPrivateKey", encrypted)
	require.Error(t, err)
	require.ErrorContains(t, err, "OPTION_CRYPT_KEY is required")
}

func TestAlipayOptionCryptoUnsupportedOptionKey(t *testing.T) {
	t.Setenv("OPTION_CRYPT_KEY", "test-option-crypt-key")

	_, err := common.EncryptAlipayOptionValue("UnsupportedKey", "value")
	require.Error(t, err)
	require.ErrorContains(t, err, "option key is not supported")

	_, err = common.DecryptAlipayOptionValue("UnsupportedKey", "plain-value")
	require.Error(t, err)
	require.ErrorContains(t, err, "option key is not supported")
}

func TestAlipayOptionCryptoAADMismatch(t *testing.T) {
	t.Setenv("OPTION_CRYPT_KEY", "test-option-crypt-key")

	encrypted, err := common.EncryptAlipayOptionValue("AlipayPrivateKey", "secret")
	require.NoError(t, err)

	_, err = common.DecryptAlipayOptionValue("AlipayPublicKey", encrypted)
	require.Error(t, err)
	require.ErrorContains(t, err, "failed to decrypt option value")
}

func TestAlipayOptionCryptoDecryptRejectsTamperedCiphertextAndWrongKey(t *testing.T) {
	t.Setenv("OPTION_CRYPT_KEY", "test-option-crypt-key")

	encrypted, err := common.EncryptAlipayOptionValue("AlipayPrivateKey", "secret")
	require.NoError(t, err)

	encoded := strings.TrimPrefix(encrypted, common.OptionEncryptedPrefixV1)
	payload, err := base64.RawStdEncoding.DecodeString(encoded)
	require.NoError(t, err)
	payload[len(payload)-1] ^= 0x01
	tampered := common.OptionEncryptedPrefixV1 + base64.RawStdEncoding.EncodeToString(payload)

	_, err = common.DecryptAlipayOptionValue("AlipayPrivateKey", tampered)
	require.Error(t, err)
	require.ErrorContains(t, err, "failed to decrypt option value")

	t.Setenv("OPTION_CRYPT_KEY", "different-option-crypt-key")
	_, err = common.DecryptAlipayOptionValue("AlipayPrivateKey", encrypted)
	require.Error(t, err)
	require.ErrorContains(t, err, "failed to decrypt option value")
}

func resetOptionStateForAlipayTests(t *testing.T) {
	t.Helper()
	require.NoError(t, DB.AutoMigrate(&Option{}))
	require.NoError(t, DB.Exec("DELETE FROM options WHERE key IN ?", []string{"AlipayPrivateKey", "AlipayPublicKey", "AlipayEncryptKey"}).Error)
	setting.AlipayPrivateKey = ""
	setting.AlipayPublicKey = ""
	setting.AlipayEncryptKey = ""
	common.OptionMapRWMutex.Lock()
	if common.OptionMap == nil {
		common.OptionMap = make(map[string]string)
	}
	common.OptionMap["AlipayPrivateKey"] = ""
	common.OptionMap["AlipayPublicKey"] = ""
	common.OptionMap["AlipayEncryptKey"] = ""
	common.OptionMapRWMutex.Unlock()
}

func TestUpdateOptionEncryptsSensitiveAlipayValueInDBAndKeepsRuntimePlaintext(t *testing.T) {
	resetOptionStateForAlipayTests(t)
	t.Setenv("OPTION_CRYPT_KEY", "test-option-crypt-key")

	plainText := "private-key-plain-value"
	err := UpdateOption("AlipayPrivateKey", plainText)
	require.NoError(t, err)

	var persisted Option
	require.NoError(t, DB.Where("key = ?", "AlipayPrivateKey").First(&persisted).Error)
	require.True(t, common.IsEncryptedOptionValue(persisted.Value))
	require.NotEqual(t, plainText, persisted.Value)

	common.OptionMapRWMutex.RLock()
	runtimeValue := common.OptionMap["AlipayPrivateKey"]
	common.OptionMapRWMutex.RUnlock()
	require.Equal(t, plainText, runtimeValue)
	require.Equal(t, plainText, setting.AlipayPrivateKey)
}

func TestLoadOptionsFromDatabaseSupportsHistoricalPlaintextAlipayValue(t *testing.T) {
	resetOptionStateForAlipayTests(t)
	t.Setenv("OPTION_CRYPT_KEY", "")

	plainText := "historical-plain-private-key"
	require.NoError(t, DB.Save(&Option{
		Key:   "AlipayPrivateKey",
		Value: plainText,
	}).Error)

	loadOptionsFromDatabase()

	common.OptionMapRWMutex.RLock()
	runtimeValue := common.OptionMap["AlipayPrivateKey"]
	common.OptionMapRWMutex.RUnlock()
	require.Equal(t, plainText, runtimeValue)
	require.Equal(t, plainText, setting.AlipayPrivateKey)
}

func TestLoadOptionsFromDatabaseClearsRuntimeValueWhenEncryptedAlipayValueCannotBeDecrypted(t *testing.T) {
	resetOptionStateForAlipayTests(t)
	t.Setenv("OPTION_CRYPT_KEY", "correct-option-crypt-key")

	encryptedValue, err := common.EncryptAlipayOptionValue("AlipayPrivateKey", "private-key-plain-value")
	require.NoError(t, err)
	require.NoError(t, DB.Save(&Option{
		Key:   "AlipayPrivateKey",
		Value: encryptedValue,
	}).Error)

	setting.AlipayPrivateKey = "stale-runtime-private-key"
	common.OptionMapRWMutex.Lock()
	common.OptionMap["AlipayPrivateKey"] = "stale-runtime-private-key"
	common.OptionMapRWMutex.Unlock()

	t.Setenv("OPTION_CRYPT_KEY", "wrong-option-crypt-key")
	loadOptionsFromDatabase()

	common.OptionMapRWMutex.RLock()
	runtimeValue := common.OptionMap["AlipayPrivateKey"]
	common.OptionMapRWMutex.RUnlock()
	require.Empty(t, runtimeValue)
	require.Empty(t, setting.AlipayPrivateKey)
}

func TestUpdateOptionSensitiveWriteFailsWhenOptionCryptKeyMissing(t *testing.T) {
	resetOptionStateForAlipayTests(t)
	t.Setenv("OPTION_CRYPT_KEY", "")

	err := UpdateOption("AlipayPrivateKey", "private-key-plain-value")
	require.Error(t, err)
	require.ErrorContains(t, err, "OPTION_CRYPT_KEY is required")

	var persisted Option
	dbErr := DB.Where("key = ?", "AlipayPrivateKey").First(&persisted).Error
	require.Error(t, dbErr)
}
