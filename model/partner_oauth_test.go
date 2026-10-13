package model

import (
	"sync"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func seedPartnerOAuthUser(t *testing.T) *User {
	t.Helper()
	user := &User{
		Username:    "partner-user",
		Password:    "unused",
		Role:        common.RoleCommonUser,
		Status:      common.UserStatusEnabled,
		Group:       "default",
		AuthVersion: 1,
	}
	require.NoError(t, DB.Create(user).Error)
	return user
}

func seedPartnerOAuthClient(t *testing.T) *PartnerOAuthClient {
	t.Helper()
	client := &PartnerOAuthClient{
		Name:            "Example Assistant",
		TokenAuthMethod: PartnerOAuthTokenAuthMethodBasic,
		SecretHash:      HashPartnerOAuthSecret("pcs_example"),
		RedirectURIs:    `["https://assistant.example.com/oauth/callback"]`,
		Scopes:          "account:read credential:read offline_access",
		Status:          PartnerOAuthClientStatusEnabled,
	}
	require.NoError(t, CreatePartnerOAuthClient(client))
	return client
}

func TestPartnerOAuthTablesMigrate(t *testing.T) {
	truncateTables(t)
	require.NoError(t, DB.AutoMigrate(&PartnerOAuthClient{}, &PartnerOAuthBinding{}, &PartnerOAuthToken{}))
	require.NoError(t, DB.AutoMigrate(&PartnerOAuthClient{}, &PartnerOAuthBinding{}, &PartnerOAuthToken{}))
}

func TestCreatePartnerOAuthBindingWithTokens(t *testing.T) {
	truncateTables(t)
	user := seedPartnerOAuthUser(t)
	client := seedPartnerOAuthClient(t)

	var binding *PartnerOAuthBinding
	err := DB.Transaction(func(tx *gorm.DB) error {
		created, createErr := CreatePartnerOAuthBindingWithTx(tx, PartnerOAuthBindingCreate{
			ClientId:            client.ClientId,
			UserId:              user.Id,
			UserAuthVersion:     user.AuthVersion,
			Scope:               "account:read credential:read offline_access",
			AuthorizationFlowId: 11,
			ExpiresAt:           time.Now().Add(30 * 24 * time.Hour).Unix(),
			AccessTokenHash:     HashPartnerOAuthToken("oa_access"),
			AccessExpiresAt:     time.Now().Add(time.Hour).Unix(),
			RefreshTokenHash:    HashPartnerOAuthToken("or_refresh"),
		})
		binding = created
		return createErr
	})
	require.NoError(t, err)
	require.NotNil(t, binding)
	assert.Equal(t, PartnerOAuthBindingStatusActive, binding.Status)

	found, err := FindPartnerOAuthToken(HashPartnerOAuthToken("oa_access"))
	require.NoError(t, err)
	assert.Equal(t, PartnerOAuthTokenKindAccess, found.Kind)
	refresh, err := FindPartnerOAuthToken(HashPartnerOAuthToken("or_refresh"))
	require.NoError(t, err)
	assert.Equal(t, PartnerOAuthTokenKindRefresh, refresh.Kind)
}

func TestRotatePartnerOAuthRefreshTokenSingleWinner(t *testing.T) {
	truncateTables(t)
	user := seedPartnerOAuthUser(t)
	client := seedPartnerOAuthClient(t)
	var current *PartnerOAuthToken
	err := DB.Transaction(func(tx *gorm.DB) error {
		binding, createErr := CreatePartnerOAuthBindingWithTx(tx, PartnerOAuthBindingCreate{
			ClientId:         client.ClientId,
			UserId:           user.Id,
			UserAuthVersion:  user.AuthVersion,
			Scope:            "account:read credential:read offline_access",
			ExpiresAt:        time.Now().Add(30 * 24 * time.Hour).Unix(),
			AccessTokenHash:  HashPartnerOAuthToken("oa_old"),
			AccessExpiresAt:  time.Now().Add(time.Hour).Unix(),
			RefreshTokenHash: HashPartnerOAuthToken("or_old"),
		})
		if createErr != nil {
			return createErr
		}
		token, findErr := FindPartnerOAuthTokenWithTx(tx, HashPartnerOAuthToken("or_old"))
		current = token
		_ = binding
		return findErr
	})
	require.NoError(t, err)

	var winners int
	var mu sync.Mutex
	var wg sync.WaitGroup
	for i := 0; i < 8; i++ {
		wg.Add(1)
		go func(i int) {
			defer wg.Done()
			rotateErr := DB.Transaction(func(tx *gorm.DB) error {
				token, findErr := FindPartnerOAuthTokenWithTx(tx, HashPartnerOAuthToken("or_old"))
				if findErr != nil {
					return findErr
				}
				return RotatePartnerOAuthRefreshToken(
					tx,
					token,
					HashPartnerOAuthToken("oa_new_"+string(rune('a'+i))),
					HashPartnerOAuthToken("or_new_"+string(rune('a'+i))),
					time.Now().Add(time.Hour).Unix(),
				)
			})
			if rotateErr == nil {
				mu.Lock()
				winners++
				mu.Unlock()
			}
		}(i)
	}
	wg.Wait()
	assert.Equal(t, 1, winners)
	require.NoError(t, DB.First(current, current.Id).Error)
	assert.Equal(t, PartnerOAuthTokenStatusRotated, current.Status)
}

func TestRevokePartnerOAuthBindingDisablesKeyAndIsIdempotent(t *testing.T) {
	truncateTables(t)
	user := seedPartnerOAuthUser(t)
	client := seedPartnerOAuthClient(t)
	token := Token{
		UserId:         user.Id,
		Name:           "Example Assistant",
		Key:            "partner-key-secret",
		Status:         common.TokenStatusEnabled,
		ExpiredTime:    time.Now().Add(24 * time.Hour).Unix(),
		UnlimitedQuota: true,
	}
	require.NoError(t, token.Insert())

	var bindingID string
	require.NoError(t, DB.Transaction(func(tx *gorm.DB) error {
		binding, err := CreatePartnerOAuthBindingWithTx(tx, PartnerOAuthBindingCreate{
			ClientId:        client.ClientId,
			UserId:          user.Id,
			UserAuthVersion: user.AuthVersion,
			Scope:           "account:read",
			ExpiresAt:       time.Now().Add(24 * time.Hour).Unix(),
			AccessTokenHash: HashPartnerOAuthToken("oa_revoke"),
			AccessExpiresAt: time.Now().Add(time.Hour).Unix(),
		})
		if err != nil {
			return err
		}
		bindingID = binding.BindingId
		return tx.Model(binding).Update("token_id", token.Id).Error
	}))

	require.NoError(t, DB.Transaction(func(tx *gorm.DB) error {
		return RevokePartnerOAuthBindingWithTx(tx, bindingID, "user_revoked")
	}))
	require.NoError(t, DB.Transaction(func(tx *gorm.DB) error {
		return RevokePartnerOAuthBindingWithTx(tx, bindingID, "user_revoked")
	}))

	stored, err := GetPartnerOAuthBindingByBindingID(bindingID)
	require.NoError(t, err)
	assert.Equal(t, PartnerOAuthBindingStatusRevoked, stored.Status)
	var storedToken Token
	require.NoError(t, DB.First(&storedToken, token.Id).Error)
	assert.Equal(t, common.TokenStatusDisabled, storedToken.Status)
}

func TestIssuePartnerOAuthCredentialSingleKeyUnderConcurrency(t *testing.T) {
	truncateTables(t)
	user := seedPartnerOAuthUser(t)
	client := seedPartnerOAuthClient(t)
	var bindingID string
	require.NoError(t, DB.Transaction(func(tx *gorm.DB) error {
		binding, err := CreatePartnerOAuthBindingWithTx(tx, PartnerOAuthBindingCreate{
			ClientId:        client.ClientId,
			UserId:          user.Id,
			UserAuthVersion: user.AuthVersion,
			Scope:           "credential:read",
			ExpiresAt:       time.Now().Add(24 * time.Hour).Unix(),
			AccessTokenHash: HashPartnerOAuthToken("oa_cred"),
			AccessExpiresAt: time.Now().Add(time.Hour).Unix(),
		})
		bindingID = binding.BindingId
		return err
	}))

	var wg sync.WaitGroup
	ids := make(chan int, 8)
	for i := 0; i < 8; i++ {
		wg.Add(1)
		go func(i int) {
			defer wg.Done()
			issued, err := IssuePartnerOAuthCredential(bindingID, PartnerOAuthCredentialIssue{
				UserId:      user.Id,
				Name:        client.Name,
				ExpiredTime: time.Now().Add(24 * time.Hour).Unix(),
				Key:         "concurrent-key-" + string(rune('a'+i)),
			})
			require.NoError(t, err)
			ids <- issued.Id
		}(i)
	}
	wg.Wait()
	close(ids)
	seen := map[int]struct{}{}
	for id := range ids {
		seen[id] = struct{}{}
	}
	assert.Len(t, seen, 1)
	var count int64
	require.NoError(t, DB.Model(&Token{}).Where("user_id = ?", user.Id).Count(&count).Error)
	assert.Equal(t, int64(1), count)
}

func TestDeleteExpiredPartnerOAuthTokens(t *testing.T) {
	truncateTables(t)
	require.NoError(t, DB.Create(&PartnerOAuthToken{
		TokenHash: HashPartnerOAuthToken("oa_old_expired"),
		Kind:      PartnerOAuthTokenKindAccess,
		BindingId: "bnd_old",
		Status:    PartnerOAuthTokenStatusActive,
		ExpiresAt: time.Now().Add(-48 * time.Hour).Unix(),
		CreatedAt: time.Now().Add(-72 * time.Hour).Unix(),
	}).Error)
	require.NoError(t, DB.Create(&PartnerOAuthToken{
		TokenHash: HashPartnerOAuthToken("oa_live"),
		Kind:      PartnerOAuthTokenKindAccess,
		BindingId: "bnd_live",
		Status:    PartnerOAuthTokenStatusActive,
		ExpiresAt: time.Now().Add(time.Hour).Unix(),
		CreatedAt: time.Now().Unix(),
	}).Error)
	require.NoError(t, DeleteExpiredPartnerOAuthTokens(time.Now().Unix()))
	_, err := FindPartnerOAuthToken(HashPartnerOAuthToken("oa_old_expired"))
	assert.ErrorIs(t, err, ErrPartnerOAuthTokenNotFound)
	_, err = FindPartnerOAuthToken(HashPartnerOAuthToken("oa_live"))
	require.NoError(t, err)
}
