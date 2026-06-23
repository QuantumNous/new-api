package model

import (
	"os"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestBuiltinRBACMapsLegacyRoles(t *testing.T) {
	truncateTables(t)

	rootPermissions, err := GetUserPermissionCodes(1, common.RoleRootUser)
	require.NoError(t, err)
	assert.Contains(t, rootPermissions, PermissionRBACManage)
	assert.Contains(t, rootPermissions, PermissionFinanceManage)

	adminPermissions, err := GetUserPermissionCodes(2, common.RoleAdminUser)
	require.NoError(t, err)
	assert.Contains(t, adminPermissions, PermissionMarketplaceManage)
	assert.NotContains(t, adminPermissions, PermissionFinanceManage)

	userPermissions, err := GetUserPermissionCodes(3, common.RoleCommonUser)
	require.NoError(t, err)
	assert.Equal(t, []string{PermissionMarketplaceView}, userPermissions)
}

func TestUserRoleBindingAddsFinancePermission(t *testing.T) {
	truncateTables(t)
	require.NoError(t, ReplaceUserRoles(10, []string{PlatformRoleFinance}))

	ok, err := UserHasPermission(10, common.RoleCommonUser, PermissionFinanceManage)

	require.NoError(t, err)
	assert.True(t, ok)
}

func TestRBACPermissionMatrixForPhaseOneRoles(t *testing.T) {
	truncateTables(t)
	cases := []struct {
		name        string
		userId      int
		legacyRole  int
		roleCodes   []string
		allowed     []string
		notAllowed  []string
		anyAllowed  []string
		anyRejected []string
	}{
		{
			name:       "operator",
			userId:     21,
			legacyRole: common.RoleCommonUser,
			roleCodes:  []string{PlatformRoleOperator},
			allowed: []string{
				PermissionProviderManage,
				PermissionMarketplaceManage,
				PermissionMarketplaceKeyManage,
				PermissionAuditView,
			},
			notAllowed: []string{PermissionFinanceManage},
		},
		{
			name:       "finance",
			userId:     22,
			legacyRole: common.RoleCommonUser,
			roleCodes:  []string{PlatformRoleFinance},
			allowed: []string{
				PermissionProviderManage,
				PermissionFinanceManage,
				PermissionFinanceView,
				PermissionAuditView,
			},
			notAllowed: []string{PermissionMarketplaceKeyManage},
		},
		{
			name:       "provider",
			userId:     23,
			legacyRole: common.RoleCommonUser,
			roleCodes:  []string{PlatformRoleModelProvider},
			allowed: []string{
				PermissionProviderSelfManage,
				PermissionMarketplaceSelfManage,
				PermissionMarketplaceSelfKeyManage,
				PermissionFinanceView,
			},
			notAllowed: []string{
				PermissionProviderManage,
				PermissionFinanceManage,
				PermissionMarketplaceKeyManage,
			},
		},
		{
			name:       "user",
			userId:     24,
			legacyRole: common.RoleCommonUser,
			allowed:    []string{PermissionMarketplaceView},
			notAllowed: []string{
				PermissionProviderSelfManage,
				PermissionMarketplaceSelfManage,
				PermissionFinanceView,
				PermissionAuditView,
			},
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			if len(tc.roleCodes) > 0 {
				require.NoError(t, ReplaceUserRoles(tc.userId, tc.roleCodes))
			}
			for _, permission := range tc.allowed {
				ok, err := UserHasPermission(tc.userId, tc.legacyRole, permission)
				require.NoError(t, err)
				assert.True(t, ok, permission)
			}
			for _, permission := range tc.notAllowed {
				ok, err := UserHasPermission(tc.userId, tc.legacyRole, permission)
				require.NoError(t, err)
				assert.False(t, ok, permission)
			}
		})
	}
}

func TestProviderOwnsModelEnforcesDataIsolation(t *testing.T) {
	truncateTables(t)
	provider := ProviderProfile{UserId: 11, Name: "provider-a"}
	require.NoError(t, DB.Create(&provider).Error)
	other := ProviderProfile{UserId: 12, Name: "provider-b"}
	require.NoError(t, DB.Create(&other).Error)
	item := MarketplaceModel{ProviderId: provider.Id, Name: "model-a"}
	require.NoError(t, DB.Create(&item).Error)

	owns, err := ProviderOwnsModel(provider.Id, item.Id)
	require.NoError(t, err)
	assert.True(t, owns)

	owns, err = ProviderOwnsModel(other.Id, item.Id)
	require.NoError(t, err)
	assert.False(t, owns)
}

func TestModelKeyEncryptionAndMasking(t *testing.T) {
	truncateTables(t)
	t.Setenv("MODEL_KEY_ENCRYPTION_SECRET", "test-secret")

	key := ModelKey{ModelId: 1, Name: "primary"}
	require.NoError(t, SetModelKeyPlaintext(&key, "sk-secret-value"))
	require.NoError(t, DB.Create(&key).Error)

	assert.NotEqual(t, "sk-secret-value", key.KeyCipher)
	assert.Equal(t, "sk-s****alue", key.KeyMask)

	var stored ModelKey
	require.NoError(t, DB.First(&stored, key.Id).Error)
	responseBody, err := common.Marshal(stored)
	require.NoError(t, err)
	assert.NotContains(t, string(responseBody), "key_cipher")
	assert.False(t, strings.Contains(string(responseBody), "sk-secret-value"))

	plaintext, err := common.DecryptModelKey(stored.KeyCipher)
	require.NoError(t, err)
	assert.Equal(t, "sk-secret-value", plaintext)
}

func TestModelKeyEncryptionRequiresDedicatedSecret(t *testing.T) {
	original, hadOriginal := os.LookupEnv("MODEL_KEY_ENCRYPTION_SECRET")
	require.NoError(t, os.Unsetenv("MODEL_KEY_ENCRYPTION_SECRET"))
	t.Cleanup(func() {
		if hadOriginal {
			require.NoError(t, os.Setenv("MODEL_KEY_ENCRYPTION_SECRET", original))
		}
	})

	key := ModelKey{ModelId: 1, Name: "primary"}
	err := SetModelKeyPlaintext(&key, "sk-secret-value")

	require.ErrorIs(t, err, common.ErrModelKeyEncryptionSecretMissing)
}
