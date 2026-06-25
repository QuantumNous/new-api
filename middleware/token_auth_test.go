package middleware

import (
	"net/http"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/i18n"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/types"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
)

func TestTokenAuthErrorResponseDistinguishesExhaustedQuota(t *testing.T) {
	originalTranslate := common.TranslateMessage
	common.TranslateMessage = func(c *gin.Context, key string, args ...map[string]any) string {
		return key
	}
	t.Cleanup(func() {
		common.TranslateMessage = originalTranslate
	})

	status, message, codes := tokenAuthErrorResponse(&gin.Context{}, model.ErrTokenExhausted)

	require.Equal(t, http.StatusForbidden, status)
	require.Equal(t, i18n.MsgTokenExhausted, message)
	require.Equal(t, []types.ErrorCode{types.ErrorCodeInsufficientUserQuota}, codes)
}

func TestTokenAuthErrorResponseKeepsUnknownTokenUnauthorized(t *testing.T) {
	originalTranslate := common.TranslateMessage
	common.TranslateMessage = func(c *gin.Context, key string, args ...map[string]any) string {
		return key
	}
	t.Cleanup(func() {
		common.TranslateMessage = originalTranslate
	})

	status, message, codes := tokenAuthErrorResponse(&gin.Context{}, model.ErrTokenInvalid)

	require.Equal(t, http.StatusUnauthorized, status)
	require.Equal(t, i18n.MsgTokenInvalid, message)
	require.Nil(t, codes)
}

func TestUserCanUseGroupsIgnoresDeprecatedEnterpriseFlag(t *testing.T) {
	require.True(t, userCanUseGroups(&model.UserBase{
		Group:        "Enterprise",
		IsEnterprise: false,
	}))
	require.False(t, userCanUseGroups(&model.UserBase{
		Group:        plgGroup,
		IsEnterprise: true,
	}))
	require.False(t, userCanUseGroups(&model.UserBase{}))
	require.False(t, userCanUseGroups(nil))
}

func TestResolveTokenGroupsForUserForcesLegacyPlgTokenContext(t *testing.T) {
	userGroup, tokenGroup, contextToken := resolveTokenGroupsForUser(
		&model.UserBase{Group: plgGroup, IsEnterprise: true},
		&model.Token{Group: "default", CrossGroupRetry: true},
	)

	require.Equal(t, plgGroup, userGroup)
	require.Empty(t, tokenGroup)
	require.Equal(t, plgGroup, contextToken.Group)
	require.False(t, contextToken.CrossGroupRetry)
}

func TestResolvedTokenGroupOverwritesUserGroupContext(t *testing.T) {
	gin.SetMode(gin.TestMode)
	c, _ := gin.CreateTestContext(nil)
	userCache := &model.UserBase{Group: "", IsEnterprise: false}
	token := &model.Token{Group: "default", CrossGroupRetry: true}
	userCache.WriteContext(c)

	userGroup, _, _ := resolveTokenGroupsForUser(userCache, token)
	common.SetContextKey(c, constant.ContextKeyUserGroup, userGroup)

	require.Equal(t, plgGroup, common.GetContextKeyString(c, constant.ContextKeyUserGroup))
}
