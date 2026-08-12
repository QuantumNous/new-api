package middleware

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/i18n"
	"github.com/QuantumNous/new-api/model"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
)

func seedFixedGroupEntitlement(t *testing.T) *model.Token {
	t.Helper()
	user := &model.User{
		Id: 1, Username: "fixed-group-entitlement-user", Password: "password",
		Group: "default", AffCode: "fixed-group-entitlement-aff", Status: common.UserStatusEnabled,
	}
	require.NoError(t, model.DB.Create(user).Error)
	token := &model.Token{
		Id: 1, UserId: user.Id, Key: "fixed-group-entitlement-token",
		Status: common.TokenStatusEnabled, UnlimitedQuota: true, ExpiredTime: -1, Group: "default",
	}
	require.NoError(t, model.DB.Create(token).Error)
	pkg := &model.EntitlementPackage{
		Name: "fixed-group-entitlement", Status: model.EntitlementStatusEnabled,
		Group: "vip", Models: "fixed-group-model", AllowPublicFallback: false,
	}
	require.NoError(t, model.SaveEntitlementPackage(pkg))
	require.NoError(t, model.UpsertUserEntitlement(&model.UserEntitlement{
		PackageId: pkg.Id, UserId: user.Id, Status: model.EntitlementStatusEnabled,
	}))
	require.NoError(t, model.SetTokenEntitlementPackages(token.Id, user.Id, []int{pkg.Id}, false))
	require.NoError(t, i18n.Init())
	return token
}

func runPlaygroundGroupRequest(t *testing.T, token *model.Token, group string) *httptest.ResponseRecorder {
	t.Helper()
	recorder := httptest.NewRecorder()
	router := gin.New()
	router.POST("/pg/chat/completions", func(c *gin.Context) {
		c.Set("id", token.UserId)
		c.Set("token_id", token.Id)
		common.SetContextKey(c, constant.ContextKeyUserGroup, "default")
		common.SetContextKey(c, constant.ContextKeyUsingGroup, "default")
		common.SetContextKey(c, constant.ContextKeyTokenGroup, "default")
		c.Next()
	}, Distribute(), func(c *gin.Context) {
		c.Status(http.StatusOK)
	})
	req := httptest.NewRequest(
		http.MethodPost,
		"/pg/chat/completions",
		strings.NewReader(`{"model":"fixed-group-model","group":"`+group+`"}`),
	)
	req.Header.Set("Content-Type", "application/json")
	router.ServeHTTP(recorder, req)
	return recorder
}

func seedPlainPlaygroundToken(t *testing.T) *model.Token {
	t.Helper()
	user := &model.User{
		Id: 2, Username: "plain-playground-user", Password: "password",
		Group: "default", AffCode: "plain-playground-aff", Status: common.UserStatusEnabled,
	}
	require.NoError(t, model.DB.Create(user).Error)
	token := &model.Token{
		Id: 2, UserId: user.Id, Key: "plain-playground-token",
		Status: common.TokenStatusEnabled, UnlimitedQuota: true, ExpiredTime: -1, Group: "default",
	}
	require.NoError(t, model.DB.Create(token).Error)
	return token
}

func TestPlaygroundEntitlementCannotRewriteFixedPackageGroup(t *testing.T) {
	setupRuntimeVisibilityTestDB(t)
	t.Setenv("TOKEN_GROUP_VISIBILITY_ENABLED", "false")
	oldEntitlementFeatureEnabled := common.EntitlementFeatureEnabled
	common.EntitlementFeatureEnabled = true
	t.Cleanup(func() { common.EntitlementFeatureEnabled = oldEntitlementFeatureEnabled })
	token := seedFixedGroupEntitlement(t)

	recorder := runPlaygroundGroupRequest(t, token, "default")
	require.Equal(t, http.StatusForbidden, recorder.Code,
		"a playground group override must not escape the entitlement package group")
}

func TestPlaygroundEntitlementAllowsItsFixedPackageGroup(t *testing.T) {
	setupRuntimeVisibilityTestDB(t)
	t.Setenv("TOKEN_GROUP_VISIBILITY_ENABLED", "false")
	oldEntitlementFeatureEnabled := common.EntitlementFeatureEnabled
	common.EntitlementFeatureEnabled = true
	t.Cleanup(func() { common.EntitlementFeatureEnabled = oldEntitlementFeatureEnabled })
	token := seedFixedGroupEntitlement(t)

	recorder := runPlaygroundGroupRequest(t, token, "vip")
	require.Equal(t, http.StatusServiceUnavailable, recorder.Code,
		"same-group request should pass entitlement authorization and fail only on missing test channel")
}

func TestPlaygroundWithoutEntitlementKeepsGroupOverride(t *testing.T) {
	setupRuntimeVisibilityTestDB(t)
	t.Setenv("TOKEN_GROUP_VISIBILITY_ENABLED", "false")
	oldEntitlementFeatureEnabled := common.EntitlementFeatureEnabled
	common.EntitlementFeatureEnabled = true
	t.Cleanup(func() { common.EntitlementFeatureEnabled = oldEntitlementFeatureEnabled })
	token := seedPlainPlaygroundToken(t)

	recorder := runPlaygroundGroupRequest(t, token, "vip")
	require.Equal(t, http.StatusServiceUnavailable, recorder.Code,
		"without a grant, the established playground group override must retain its legacy path")
}

func TestPlaygroundTargetedDirectGrantBypassesLegacyGlobalGroupCheck(t *testing.T) {
	setupRuntimeVisibilityTestDB(t)
	t.Setenv("TOKEN_GROUP_VISIBILITY_ENABLED", "true")
	oldEntitlementFeatureEnabled := common.EntitlementFeatureEnabled
	common.EntitlementFeatureEnabled = false
	t.Cleanup(func() { common.EntitlementFeatureEnabled = oldEntitlementFeatureEnabled })
	require.NoError(t, i18n.Init())
	target := &model.User{
		Id: 3, Username: "playground-target", Password: "password", Group: "default",
		AffCode: "playground-target-aff", Status: common.UserStatusEnabled,
	}
	nonTarget := &model.User{
		Id: 4, Username: "playground-non-target", Password: "password", Group: "default",
		AffCode: "playground-non-target-aff", Status: common.UserStatusEnabled,
	}
	require.NoError(t, model.DB.Create([]*model.User{target, nonTarget}).Error)
	require.NoError(t, model.DB.Create(&model.Token{Id: 3, UserId: target.Id, Key: "playground-target-token", Status: common.TokenStatusEnabled, UnlimitedQuota: true, ExpiredTime: -1, Group: "default"}).Error)
	require.NoError(t, model.DB.Create(&model.Token{Id: 4, UserId: nonTarget.Id, Key: "playground-non-target-token", Status: common.TokenStatusEnabled, UnlimitedQuota: true, ExpiredTime: -1, Group: "default"}).Error)
	require.NoError(t, model.DB.Create(&model.Ability{Group: "svip", Model: "playground-targeted-model", ChannelId: 1, Enabled: true}).Error)
	require.NoError(t, model.SaveTokenGroupVisibilityPolicy(model.TokenGroupVisibilityPolicy{
		Group: "svip", Visibility: model.TokenGroupVisibilityTargeted, UserIds: []int{target.Id},
	}))

	targetRecorder := runPlaygroundGroupRequest(t, &model.Token{Id: 3, UserId: target.Id}, "svip")
	require.Equal(t, http.StatusServiceUnavailable, targetRecorder.Code,
		"a direct targeted grant must reach channel selection instead of the legacy global-group rejection")
	nonTargetRecorder := runPlaygroundGroupRequest(t, &model.Token{Id: 4, UserId: nonTarget.Id}, "svip")
	require.Equal(t, http.StatusForbidden, nonTargetRecorder.Code,
		"a non-target user must still be denied before channel selection")
}
