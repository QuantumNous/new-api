package service

import (
	"crypto/sha256"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/setting"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestMezonWalletAddressRoundTrip(t *testing.T) {
	addr := MezonWalletAddressFromUserId("1794574916465594368")
	require.True(t, IsValidMezonWalletAddress(addr))
	decoded, ok := base58Decode(addr)
	require.True(t, ok)
	assert.Len(t, decoded, sha256.Size)
}

func TestIsValidMezonWalletAddressRejectsInvalid(t *testing.T) {
	assert.False(t, IsValidMezonWalletAddress(""))
	assert.False(t, IsValidMezonWalletAddress("not-base58!!!"))
	assert.False(t, IsValidMezonWalletAddress("1"))
}

func TestTreasuryAddressCompareIsCaseSensitive(t *testing.T) {
	treasury := MezonWalletAddressFromUserId("treasury-user")
	var flipped strings.Builder
	for _, r := range treasury {
		switch {
		case r >= 'A' && r <= 'Z':
			flipped.WriteRune(r - 'A' + 'a')
		case r >= 'a' && r <= 'z':
			flipped.WriteRune(r - 'a' + 'A')
		default:
			flipped.WriteRune(r)
		}
	}
	impostor := flipped.String()
	require.NotEqual(t, treasury, impostor)
	assert.False(t, strings.EqualFold(treasury, impostor) && treasury == impostor)
	assert.NotEqual(t, treasury, impostor)
}

func TestGetMezonTransactionRejectsHashMismatch(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"data":{"transaction":{"hash":"ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff","from_address":"from","to_address":"to","value":"1000000","status":2,"transaction_timestamp":1}}}`))
	}))
	t.Cleanup(server.Close)

	prevBase := setting.MezonPayment.IndexerBase
	prevChain := setting.MezonPayment.ChainId
	setting.MezonPayment.IndexerBase = server.URL
	setting.MezonPayment.ChainId = "1337"
	t.Cleanup(func() {
		setting.MezonPayment.IndexerBase = prevBase
		setting.MezonPayment.ChainId = prevChain
	})

	tx, err := GetMezonTransaction("cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc")
	require.Error(t, err)
	assert.Nil(t, tx)
	assert.Contains(t, err.Error(), "hash mismatch")
}
