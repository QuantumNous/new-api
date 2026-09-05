package controller

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestDomainLoginFallbackRejectsUnboundOrDifferentBrowserTickets(t *testing.T) {
	const callbackBinding = "callback-browser-binding-with-at-least-thirty-two-characters"
	for _, test := range []struct {
		name        string
		storedHash  string
		cookieValue string
	}{
		{name: "missing browser cookie", storedHash: domainOAuthBindingHash(callbackBinding)},
		{name: "different browser", storedHash: domainOAuthBindingHash(callbackBinding), cookieValue: "different-browser"},
		{name: "legacy ticket without browser binding", cookieValue: callbackBinding},
	} {
		t.Run(test.name, func(t *testing.T) {
			db := setupManageUserTestDB(t)
			require.NoError(t, db.AutoMigrate(&model.AuthFlow{}))
			previousEnabled := common.CustomDomainEnabled
			previousSecure := common.SessionCookieSecure
			// Old in-flight tickets must also fail closed after disabling Host routing.
			common.CustomDomainEnabled = false
			common.SessionCookieSecure = true
			t.Cleanup(func() {
				common.CustomDomainEnabled = previousEnabled
				common.SessionCookieSecure = previousSecure
			})
			user := model.User{Username: "fallback-user", Status: common.UserStatusEnabled, AuthVersion: 1}
			require.NoError(t, db.Create(&user).Error)
			payload, err := common.Marshal(map[string]any{
				"expected_auth_version": user.AuthVersion,
				"login_method":          "oauth:github",
				"browser_binding_hash":  test.storedHash,
			})
			require.NoError(t, err)
			ticket, _, err := model.CreateAuthFlow(model.AuthFlowCreate{
				Purpose: model.AuthFlowPurposeDomainLoginFallback, Provider: "github", UserId: user.Id,
				Payload: string(payload), ExpiresAt: time.Now().Add(time.Minute),
			})
			require.NoError(t, err)
			requestBody, err := common.Marshal(map[string]string{"ticket": ticket, "padding": "="})
			require.NoError(t, err)
			request := httptest.NewRequest(http.MethodPost, "https://yeschoy.com/api/oauth/domain-handoff-fallback", strings.NewReader(string(requestBody)))
			request.Header.Set("Content-Type", "text/plain")
			request.Header.Set("Origin", "https://foreign.example")
			if test.cookieValue != "" {
				request.AddCookie(&http.Cookie{Name: domainOAuthBindingCookieName, Value: test.cookieValue})
			}
			response := httptest.NewRecorder()
			context, _ := gin.CreateTestContext(response)
			context.Request = request
			ConsumeDomainLoginFallback(context)
			assert.Equal(t, http.StatusForbidden, response.Code)
			assert.Empty(t, response.Result().Cookies())
			_, err = model.GetAuthFlow(ticket, model.AuthFlowMatch{Purpose: model.AuthFlowPurposeDomainLoginFallback})
			assert.NoError(t, err, "rejection must not consume another browser's ticket")
			var count int64
			require.NoError(t, db.Model(&model.UserSession{}).Count(&count).Error)
			assert.Zero(t, count)
			require.NoError(t, db.Model(&model.Log{}).Where("type = ?", model.LogTypeLogin).Count(&count).Error)
			assert.Zero(t, count)
		})
	}
}
