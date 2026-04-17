package model

import (
	"testing"

	"github.com/stretchr/testify/require"
)

func ensurePoolBindingResolutionTables(t *testing.T) {
	t.Helper()
	err := DB.AutoMigrate(&Pool{}, &PoolBinding{})
	require.NoError(t, err)
}

func truncatePoolBindingResolutionTables(t *testing.T) {
	t.Helper()
	t.Cleanup(func() {
		DB.Exec("DELETE FROM pool_bindings")
		DB.Exec("DELETE FROM pools")
	})
}

func seedPoolForResolution(t *testing.T, name string) *Pool {
	t.Helper()
	pool := &Pool{
		Name:   name,
		Status: PoolStatusEnabled,
	}
	require.NoError(t, DB.Create(pool).Error)
	return pool
}

func seedBindingForResolution(t *testing.T, bindingType, bindingValue string, poolId, priority int) {
	t.Helper()
	require.NoError(t, DB.Create(&PoolBinding{
		BindingType:  bindingType,
		BindingValue: bindingValue,
		PoolId:       poolId,
		Priority:     priority,
		Enabled:      true,
	}).Error)
}

func TestResolvePoolForContext_TokenPrecedence(t *testing.T) {
	ensurePoolBindingResolutionTables(t)
	truncatePoolBindingResolutionTables(t)

	tokenPool := seedPoolForResolution(t, "token_pool")
	userPool := seedPoolForResolution(t, "user_pool")
	defaultPool := seedPoolForResolution(t, "default_pool")

	seedBindingForResolution(t, PoolBindingTypeToken, "2001", tokenPool.Id, 1)
	seedBindingForResolution(t, PoolBindingTypeUser, "1001", userPool.Id, 999)
	seedBindingForResolution(t, PoolBindingTypeDefault, "", defaultPool.Id, 1)

	pool, err := ResolvePoolForContext(1001, 2001, "g-dev")
	require.NoError(t, err)
	require.NotNil(t, pool)
	require.Equal(t, tokenPool.Id, pool.Id)
}

func TestResolvePoolForContext_FallbackUserThenGroupThenDefault(t *testing.T) {
	ensurePoolBindingResolutionTables(t)
	truncatePoolBindingResolutionTables(t)

	userPool := seedPoolForResolution(t, "user_pool")
	groupPool := seedPoolForResolution(t, "group_pool")
	defaultPool := seedPoolForResolution(t, "default_pool")

	seedBindingForResolution(t, PoolBindingTypeUser, "1002", userPool.Id, 1)
	seedBindingForResolution(t, PoolBindingTypeGroup, "g-app", groupPool.Id, 1)
	seedBindingForResolution(t, PoolBindingTypeDefault, "", defaultPool.Id, 1)

	poolByUser, err := ResolvePoolForContext(1002, 0, "g-app")
	require.NoError(t, err)
	require.NotNil(t, poolByUser)
	require.Equal(t, userPool.Id, poolByUser.Id)

	poolByGroup, err := ResolvePoolForContext(0, 0, "g-app")
	require.NoError(t, err)
	require.NotNil(t, poolByGroup)
	require.Equal(t, groupPool.Id, poolByGroup.Id)

	poolByDefault, err := ResolvePoolForContext(0, 0, "g-missing")
	require.NoError(t, err)
	require.NotNil(t, poolByDefault)
	require.Equal(t, defaultPool.Id, poolByDefault.Id)
}

func TestResolvePoolForContext_DisabledTokenBindingFallsBack(t *testing.T) {
	ensurePoolBindingResolutionTables(t)
	truncatePoolBindingResolutionTables(t)

	tokenPool := seedPoolForResolution(t, "token_pool")
	userPool := seedPoolForResolution(t, "user_pool")

	disabledBinding := &PoolBinding{
		BindingType:  PoolBindingTypeToken,
		BindingValue: "2003",
		PoolId:       tokenPool.Id,
		Priority:     1,
		Enabled:      true,
	}
	require.NoError(t, DB.Create(disabledBinding).Error)
	require.NoError(t, DB.Model(&PoolBinding{}).Where("id = ?", disabledBinding.Id).Update("enabled", false).Error)
	seedBindingForResolution(t, PoolBindingTypeUser, "1003", userPool.Id, 1)

	pool, err := ResolvePoolForContext(1003, 2003, "g-dev")
	require.NoError(t, err)
	require.NotNil(t, pool)
	require.Equal(t, userPool.Id, pool.Id)
}

