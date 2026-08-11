package vertex

import (
	"crypto/rand"
	"crypto/rsa"
	"crypto/x509"
	"encoding/pem"
	"errors"
	"testing"
	"time"

	"github.com/bytedance/gopkg/cache/asynccache"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestAcquireCachedAccessTokenReusesOnlyMatchingMultiKeyIndex(t *testing.T) {
	originalCache := Cache
	testCache := asynccache.NewAsyncCache(asynccache.Options{
		RefreshDuration: time.Hour,
		Fetcher: func(string) (interface{}, error) {
			return nil, errors.New("not found")
		},
	})
	Cache = testCache
	t.Cleanup(func() {
		Cache = originalCache
		testCache.Close()
	})

	privateKey, err := rsa.GenerateKey(rand.Reader, 1024)
	require.NoError(t, err)
	privateKeyDER, err := x509.MarshalPKCS8PrivateKey(privateKey)
	require.NoError(t, err)

	input := CachedAccessTokenRequest{
		ChannelID:            42,
		ChannelIsMultiKey:    true,
		ChannelMultiKeyIndex: 3,
		Credentials: Credentials{
			ClientEmail: "vertex@example.com",
			PrivateKey: string(pem.EncodeToMemory(&pem.Block{
				Type:  "PRIVATE KEY",
				Bytes: privateKeyDER,
			})),
		},
		Proxy: "://",
	}
	first, err := acquireCachedAccessToken(input, func(string) (string, error) {
		return "cached-token", nil
	})
	require.NoError(t, err)
	second, err := AcquireCachedAccessToken(input)
	require.NoError(t, err)
	assert.Equal(t, "cached-token", first)
	assert.Equal(t, first, second)

	input.ChannelMultiKeyIndex = 4
	input.Credentials = Credentials{}
	_, err = AcquireCachedAccessToken(input)
	require.Error(t, err)
	assert.Contains(t, err.Error(), "failed to create signed JWT")
}
