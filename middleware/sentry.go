package middleware

import (
	"fmt"
	"time"

	"github.com/QuantumNous/new-api/common"

	"github.com/getsentry/sentry-go"
	sentrygin "github.com/getsentry/sentry-go/gin"
	"github.com/gin-gonic/gin"
)

func Sentry() gin.HandlerFunc {
	if !common.SentryEnabled {
		return func(c *gin.Context) { c.Next() }
	}
	return sentrygin.New(sentrygin.Options{
		Repanic:         true,
		WaitForDelivery: false,
		Timeout:         2 * time.Second,
	})
}

func SentryScope() gin.HandlerFunc {
	if !common.SentryEnabled {
		return func(c *gin.Context) { c.Next() }
	}
	return func(c *gin.Context) {
		hub := sentrygin.GetHubFromContext(c)
		if hub != nil {
			if rid, ok := c.Get(common.RequestIdKey); ok {
				hub.ConfigureScope(func(scope *sentry.Scope) {
					scope.SetTag("request_id", fmt.Sprint(rid))
				})
			}
		}
		c.Next()
	}
}

func setSentryAuthContext(c *gin.Context, userID any, username any, role any, useAccessToken bool) {
	if !common.SentryEnabled {
		return
	}
	hub := sentrygin.GetHubFromContext(c)
	if hub == nil {
		return
	}

	hub.ConfigureScope(func(scope *sentry.Scope) {
		if userID != nil || username != nil {
			scope.SetUser(sentry.User{
				ID:       fmt.Sprint(userID),
				Username: fmt.Sprint(username),
			})
		}
		if role != nil {
			scope.SetTag("role", fmt.Sprint(role))
		}
		scope.SetTag("use_access_token", fmt.Sprint(useAccessToken))
	})
}
