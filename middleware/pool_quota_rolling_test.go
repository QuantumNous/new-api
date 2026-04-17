package middleware

import (
	"errors"
	"net/http/httptest"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/model"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func buildPoolQuotaTestCtx(userId, tokenId int, presetScopeKey string) *gin.Context {
	rec := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(rec)
	if userId > 0 {
		common.SetContextKey(ctx, constant.ContextKeyUserId, userId)
	}
	if tokenId > 0 {
		common.SetContextKey(ctx, constant.ContextKeyTokenId, tokenId)
	}
	if presetScopeKey != "" {
		common.SetContextKey(ctx, constant.ContextKeyPoolScopeKey, presetScopeKey)
	}
	return ctx
}

func buildPolicies(scope string, windowsAndLimits ...int) []*model.PoolQuotaPolicy {
	items := make([]*model.PoolQuotaPolicy, 0, len(windowsAndLimits)/2)
	for i := 0; i+1 < len(windowsAndLimits); i += 2 {
		items = append(items, &model.PoolQuotaPolicy{
			Metric:        model.PoolQuotaMetricRequestCount,
			ScopeType:     scope,
			WindowSeconds: windowsAndLimits[i],
			LimitCount:    windowsAndLimits[i+1],
		})
	}
	return items
}

func TestLoadPoolQuotaScopePoliciesAndScopeKey_TokenOnly(t *testing.T) {
	t.Parallel()
	ctx := buildPoolQuotaTestCtx(1, 9, "user:1")
	loader := func(_ int, _ string, scope string) ([]*model.PoolQuotaPolicy, error) {
		if scope == model.PoolQuotaScopeToken {
			return buildPolicies(model.PoolQuotaScopeToken, 300, 2, 18000, 1000), nil
		}
		return nil, nil
	}

	policies, scopeKey, maxWindow, err := loadPoolQuotaScopePoliciesAndScopeKey(ctx, 1, loader)
	require.NoError(t, err)
	require.Len(t, policies, 2)
	assert.Equal(t, "token:9", scopeKey)
	assert.Equal(t, 18000, maxWindow)
	assert.Equal(t, "token:9", common.GetContextKeyString(ctx, constant.ContextKeyPoolScopeKey))
}

func TestLoadPoolQuotaScopePoliciesAndScopeKey_UserOnly(t *testing.T) {
	t.Parallel()
	ctx := buildPoolQuotaTestCtx(1, 0, "user:1")
	loader := func(_ int, _ string, scope string) ([]*model.PoolQuotaPolicy, error) {
		if scope == model.PoolQuotaScopeUser {
			return buildPolicies(model.PoolQuotaScopeUser, 300, 2, 18000, 1000), nil
		}
		return nil, nil
	}

	policies, scopeKey, maxWindow, err := loadPoolQuotaScopePoliciesAndScopeKey(ctx, 1, loader)
	require.NoError(t, err)
	require.Len(t, policies, 2)
	assert.Equal(t, "user:1", scopeKey)
	assert.Equal(t, 18000, maxWindow)
}

func TestLoadPoolQuotaScopePoliciesAndScopeKey_BothScopeTokenPrecedence(t *testing.T) {
	t.Parallel()
	ctx := buildPoolQuotaTestCtx(1, 12, "user:1")
	loader := func(_ int, _ string, scope string) ([]*model.PoolQuotaPolicy, error) {
		if scope == model.PoolQuotaScopeToken {
			return buildPolicies(model.PoolQuotaScopeToken, 60, 1), nil
		}
		if scope == model.PoolQuotaScopeUser {
			return buildPolicies(model.PoolQuotaScopeUser, 300, 2), nil
		}
		return nil, nil
	}

	policies, scopeKey, maxWindow, err := loadPoolQuotaScopePoliciesAndScopeKey(ctx, 1, loader)
	require.NoError(t, err)
	require.Len(t, policies, 1)
	assert.Equal(t, model.PoolQuotaScopeToken, policies[0].ScopeType)
	assert.Equal(t, "token:12", scopeKey)
	assert.Equal(t, 60, maxWindow)
}

func TestLoadPoolQuotaScopePoliciesAndScopeKey_TokenMissingFallbackUser(t *testing.T) {
	t.Parallel()
	ctx := buildPoolQuotaTestCtx(1, 0, "user:1")
	loader := func(_ int, _ string, scope string) ([]*model.PoolQuotaPolicy, error) {
		if scope == model.PoolQuotaScopeToken {
			return buildPolicies(model.PoolQuotaScopeToken, 300, 2), nil
		}
		return nil, nil
	}

	policies, scopeKey, maxWindow, err := loadPoolQuotaScopePoliciesAndScopeKey(ctx, 1, loader)
	require.NoError(t, err)
	require.Len(t, policies, 1)
	assert.Equal(t, "user:1", scopeKey)
	assert.Equal(t, 300, maxWindow)
	assert.Equal(t, "user:1", common.GetContextKeyString(ctx, constant.ContextKeyPoolScopeKey))
}

func TestLoadPoolQuotaScopePoliciesAndScopeKey_TokenIsolationByTokenId(t *testing.T) {
	t.Parallel()
	loader := func(_ int, _ string, scope string) ([]*model.PoolQuotaPolicy, error) {
		if scope == model.PoolQuotaScopeToken {
			return buildPolicies(model.PoolQuotaScopeToken, 300, 2), nil
		}
		return nil, nil
	}

	ctxA := buildPoolQuotaTestCtx(1, 101, "")
	_, scopeKeyA, _, err := loadPoolQuotaScopePoliciesAndScopeKey(ctxA, 1, loader)
	require.NoError(t, err)

	ctxB := buildPoolQuotaTestCtx(1, 102, "")
	_, scopeKeyB, _, err := loadPoolQuotaScopePoliciesAndScopeKey(ctxB, 1, loader)
	require.NoError(t, err)

	assert.Equal(t, "token:101", scopeKeyA)
	assert.Equal(t, "token:102", scopeKeyB)
	assert.NotEqual(t, scopeKeyA, scopeKeyB)
}

func TestLoadPoolQuotaScopePoliciesAndScopeKey_LoaderError(t *testing.T) {
	t.Parallel()
	ctx := buildPoolQuotaTestCtx(1, 0, "")
	loader := func(_ int, _ string, scope string) ([]*model.PoolQuotaPolicy, error) {
		if scope == model.PoolQuotaScopeToken {
			return nil, errors.New("boom")
		}
		return nil, nil
	}

	policies, scopeKey, maxWindow, err := loadPoolQuotaScopePoliciesAndScopeKey(ctx, 1, loader)
	require.Error(t, err)
	assert.Nil(t, policies)
	assert.Equal(t, "", scopeKey)
	assert.Equal(t, 0, maxWindow)
}

