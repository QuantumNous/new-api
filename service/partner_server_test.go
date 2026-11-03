package service

import (
	"sync"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/alicebob/miniredis/v2"
	"github.com/glebarez/sqlite"
	"github.com/go-redis/redis/v8"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

// usePartnerServerCacheBackend gives the test a fresh database and rebuilds
// the partner server caches on Redis (miniredis) or on the in-memory fallback.
func usePartnerServerCacheBackend(t *testing.T, withRedis bool) *miniredis.Miniredis {
	t.Helper()
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	require.NoError(t, err)
	sqlDB, err := db.DB()
	require.NoError(t, err)
	sqlDB.SetMaxOpenConns(1)
	require.NoError(t, db.AutoMigrate(&model.PartnerOAuthClient{}, &model.PartnerServerConfig{}, &model.PartnerServerSecret{}, &model.PartnerServerToken{}))

	previousDB, previousRedis, previousRDB := model.DB, common.RedisEnabled, common.RDB
	model.DB = db
	var server *miniredis.Miniredis
	common.RedisEnabled = withRedis
	if withRedis {
		server = miniredis.RunT(t)
		common.RDB = redis.NewClient(&redis.Options{Addr: server.Addr(), MaxRetries: -1})
	}
	resetPartnerServerCaches := func() {
		partnerServerSnapshotCacheOnce = sync.Once{}
		partnerServerTokenCacheOnce = sync.Once{}
	}
	resetPartnerServerCaches()
	t.Cleanup(func() {
		model.DB, common.RedisEnabled, common.RDB = previousDB, previousRedis, previousRDB
		resetPartnerServerCaches()
		_ = sqlDB.Close()
	})
	return server
}

func TestPartnerServerCachesHonourEvictionAndRevocation(t *testing.T) {
	for _, withRedis := range []bool{true, false} {
		name := "memory"
		if withRedis {
			name = "redis"
		}
		t.Run(name, func(t *testing.T) {
			server := usePartnerServerCacheBackend(t, withRedis)
			client := &model.PartnerOAuthClient{Name: "Kede", TokenAuthMethod: model.PartnerOAuthTokenAuthMethodBasic, RedirectURIs: "[]", Scopes: "account:read", Status: model.PartnerOAuthClientStatusEnabled}
			require.NoError(t, model.CreatePartnerOAuthClient(client))
			config := &model.PartnerServerConfig{ClientId: client.ClientId, Enabled: true, AccountGroup: "default", IPAllowlist: `["203.0.113.0/24"]`, MaxAccounts: 10, AccountsPerMinute: 10}
			require.NoError(t, model.SavePartnerServerConfig(config))
			secret, err := GeneratePartnerServerSecret()
			require.NoError(t, err)
			stored, err := model.CreatePartnerServerSecret(client.ClientId, model.HashPartnerOAuthSecret(secret))
			require.NoError(t, err)

			issued, _, _, err := IssuePartnerServerToken(client.ClientId, secret, "", "203.0.113.4")
			require.NoError(t, err)
			principal, _, _, err := AuthenticatePartnerServerAccessToken(issued.AccessToken, "203.0.113.4")
			require.NoError(t, err)
			assert.Equal(t, []int64{stored.Id}, principal.Partner.ActiveSecretIds)
			if server != nil {
				snapshotKey := getPartnerServerSnapshotCache().FullKey(client.ClientId)
				tokenKey := getPartnerServerTokenCache().FullKey(model.HashPartnerOAuthToken(issued.AccessToken))
				require.True(t, server.Exists(snapshotKey), "the snapshot lives in Redis")
				require.True(t, server.Exists(tokenKey), "the token lives in Redis")
				assert.LessOrEqual(t, server.TTL(snapshotKey), partnerServerSnapshotTTL)
				assert.LessOrEqual(t, server.TTL(tokenKey), partnerServerTokenCacheMaxTTL)
			}

			// A change without eviction is served from the cache until the TTL...
			config.IPAllowlist = `["192.0.2.0/24"]`
			require.NoError(t, model.SavePartnerServerConfig(config))
			_, _, _, err = AuthenticatePartnerServerAccessToken(issued.AccessToken, "203.0.113.4")
			require.NoError(t, err, "the cached snapshot still applies")
			// ...and eviction applies it on the next request.
			InvalidatePartnerServerSnapshot(client.ClientId)
			_, reason, _, err := AuthenticatePartnerServerAccessToken(issued.AccessToken, "203.0.113.4")
			require.Error(t, err)
			assert.Equal(t, PartnerServerReasonIPNotAllowed, reason)

			config.IPAllowlist = ""
			require.NoError(t, model.SavePartnerServerConfig(config))
			InvalidatePartnerServerSnapshot(client.ClientId)
			_, _, _, err = AuthenticatePartnerServerAccessToken(issued.AccessToken, "198.51.100.1")
			require.NoError(t, err, "an empty allowlist admits any address")

			// Revoking the secret deletes the stored token, but the token cache
			// may still hold it; the snapshot's active secret list rejects it.
			require.NoError(t, model.RevokePartnerServerSecret(client.ClientId, stored.Id))
			InvalidatePartnerServerSnapshot(client.ClientId)
			_, reason, _, err = AuthenticatePartnerServerAccessToken(issued.AccessToken, "198.51.100.1")
			require.Error(t, err)
			assert.Equal(t, PartnerServerReasonInvalidToken, reason)

			_, reason, _, err = AuthenticatePartnerServerAccessToken("pst_"+common.GetRandomString(43), "198.51.100.1")
			require.Error(t, err)
			assert.Equal(t, PartnerServerReasonInvalidToken, reason)
			if server != nil {
				keys, err := getPartnerServerTokenCache().Keys()
				require.NoError(t, err)
				assert.Len(t, keys, 1, "unknown tokens are never cached")
			}
		})
	}
}

func TestPartnerServerTokenCacheNeverOutlivesTheToken(t *testing.T) {
	usePartnerServerCacheBackend(t, false)
	require.NoError(t, model.DB.Create(&model.PartnerServerToken{
		TokenHash: model.HashPartnerOAuthToken("pst_expired"), ClientId: "pc_" + "a" + common.GetRandomString(31),
		SecretId: 1, ExpiresAt: time.Now().Add(-time.Second).Unix(),
	}).Error)
	_, reason, _, err := AuthenticatePartnerServerAccessToken("pst_expired", "203.0.113.4")
	require.Error(t, err)
	assert.Equal(t, PartnerServerReasonInvalidToken, reason)
	keys, err := getPartnerServerTokenCache().Keys()
	require.NoError(t, err)
	assert.Empty(t, keys, "an expired token is not cached")
}
