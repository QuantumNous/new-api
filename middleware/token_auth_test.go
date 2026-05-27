package middleware

import (
	"net/http"
	"testing"

	"github.com/QuantumNous/new-api/common"
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
