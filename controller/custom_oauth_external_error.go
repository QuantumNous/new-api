package controller

import (
	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/i18n"
	"github.com/QuantumNous/new-api/oauth"
	"github.com/gin-gonic/gin"
)

func handleCustomOAuthJWTLoginError(c *gin.Context, err error) {
	if boundErr, ok := err.(*OAuthAlreadyBoundError); ok {
		common.ApiErrorI18n(c, i18n.MsgOAuthAlreadyBound, providerParams(boundErr.Provider))
		return
	}
	switch err.(type) {
	case *oauth.OAuthError, *oauth.AccessDeniedError, *oauth.TrustLevelError:
		handleOAuthError(c, err)
	default:
		handleOAuthUserError(c, err)
	}
}
