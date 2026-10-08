package middleware

import (
	"crypto/hmac"
	"crypto/sha256"
	"errors"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/service/authz"
	"github.com/gin-gonic/gin"
	"github.com/glebarez/sqlite"
	"github.com/golang-jwt/jwt/v5"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func setupDashboardAuthMiddlewareTest(t *testing.T) {
	t.Helper()
	previousDB := model.DB
	previousLogDB := model.LOG_DB
	previousType := common.MainDatabaseType()
	previousRedis := common.RedisEnabled
	previousSecret := common.SessionSecret
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	require.NoError(t, err)
	require.NoError(t, db.AutoMigrate(&model.User{}, &model.UserSession{}, &model.AuditLog{}, &model.UserAccessToken{}, &model.Option{}))
	model.DB = db
	model.LOG_DB = db
	common.SetMainDatabaseType(common.DatabaseTypeSQLite)
	common.RedisEnabled = false
	common.SessionSecret = "middleware-auth-test-secret"
	require.NoError(t, model.EnsureLegacyAccessTokenRetireAt(time.Now().Unix()))
	t.Cleanup(func() {
		model.DB = previousDB
		model.LOG_DB = previousLogDB
		common.SetMainDatabaseType(previousType)
		common.RedisEnabled = previousRedis
		common.SessionSecret = previousSecret
	})
}

func issueExpiredDashboardAccessToken(t *testing.T, identity service.AuthIdentity) string {
	t.Helper()
	claims := jwt.MapClaims{
		"iss":       "new-api",
		"aud":       []string{"new-api-dashboard"},
		"sub":       fmt.Sprintf("%d", identity.UserID),
		"token_use": "access",
		"sid":       identity.SessionID,
		"uv":        identity.UserAuthVersion,
		"sv":        identity.SessionVersion,
		"exp":       time.Now().Add(-time.Minute).Unix(),
		"nbf":       time.Now().Add(-2 * time.Minute).Unix(),
		"iat":       time.Now().Add(-2 * time.Minute).Unix(),
	}
	mac := hmac.New(sha256.New, []byte(common.SessionSecret))
	_, err := mac.Write([]byte("new-api/auth/access/v1"))
	require.NoError(t, err)
	token, err := jwt.NewWithClaims(jwt.SigningMethodHS256, claims).SignedString(mac.Sum(nil))
	require.NoError(t, err)
	return token
}

func tamperDashboardToken(token string) string {
	tamperAt := len(token) - 2
	replacement := "x"
	if token[tamperAt] == 'x' {
		replacement = "y"
	}
	return token[:tamperAt] + replacement + token[tamperAt+1:]
}

func createMiddlewarePATUser(t *testing.T, username, token string) *model.User {
	t.Helper()
	user := &model.User{
		Username: username, Password: "password-placeholder", Role: common.RoleCommonUser,
		Status: common.UserStatusEnabled, Group: "default", AccessToken: &token, AuthVersion: 1,
		AffCode: "middleware-aff-" + username,
	}
	require.NoError(t, model.DB.Create(user).Error)
	return user
}

func TestUserAuthAllowsOpaqueDottedPAT(t *testing.T) {
	setupDashboardAuthMiddlewareTest(t)
	user := createMiddlewarePATUser(t, "dotted-pat-user", "opaque.key.with-dots")
	router := gin.New()
	router.GET("/protected", UserAuth(), func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"id": c.GetInt("id")})
	})
	request := httptest.NewRequest(http.MethodGet, "/protected", nil)
	request.Header.Set("Authorization", "Bearer opaque.key.with-dots")
	response := httptest.NewRecorder()

	router.ServeHTTP(response, request)

	assert.Equal(t, http.StatusOK, response.Code)
	var body struct {
		ID int `json:"id"`
	}
	require.NoError(t, common.Unmarshal(response.Body.Bytes(), &body))
	assert.Equal(t, user.Id, body.ID)
}

func TestUserAuthNeverFallsBackForRecognizedInvalidInternalJWT(t *testing.T) {
	setupDashboardAuthMiddlewareTest(t)
	identity := service.AuthIdentity{UserID: 42, SessionID: "session-42", UserAuthVersion: 1, SessionVersion: 1}
	token, _, err := service.IssueAccessToken(identity)
	require.NoError(t, err)
	tampered := tamperDashboardToken(token)
	createMiddlewarePATUser(t, "jwt-fallback-user", tampered)
	router := gin.New()
	router.GET("/protected", UserAuth(), func(c *gin.Context) {
		c.Status(http.StatusNoContent)
	})
	request := httptest.NewRequest(http.MethodGet, "/protected", nil)
	request.Header.Set("Authorization", "Bearer "+tampered)
	response := httptest.NewRecorder()

	router.ServeHTTP(response, request)

	assert.Equal(t, http.StatusUnauthorized, response.Code)
	assert.Contains(t, response.Body.String(), "AUTH_UNAUTHORIZED")
}

func TestTryUserAuthCredentialClassification(t *testing.T) {
	setupDashboardAuthMiddlewareTest(t)
	gin.SetMode(gin.TestMode)

	patUser := createMiddlewarePATUser(t, "optional-pat-user", "optional.pat.with-dots")
	internalUser := createMiddlewarePATUser(t, "optional-session-user", "unrelated-pat")
	scopedPAT, _ := createMiddlewareScopedToken(t, patUser.Id, 0, "profile:read")
	now := time.Now().Unix()
	session := &model.UserSession{
		SID:             "optional-auth-session",
		UserID:          internalUser.Id,
		Version:         1,
		UserAuthVersion: internalUser.AuthVersion,
		Status:          model.UserSessionStatusActive,
		RefreshHash:     "refresh-hash",
		LoginMethod:     "password",
		LastActiveAt:    now,
		ExpiresAt:       now + 3600,
	}
	require.NoError(t, model.CreateUserSession(session))
	identity := service.AuthIdentity{
		UserID:          internalUser.Id,
		SessionID:       session.SID,
		UserAuthVersion: session.UserAuthVersion,
		SessionVersion:  session.Version,
	}
	accessToken, _, err := service.IssueAccessToken(identity)
	require.NoError(t, err)
	require.NoError(t, model.DB.AutoMigrate(&model.AuthFlow{}))
	binding, err := service.BindVerificationOperation(service.VerificationOperation{Scope: "channel.key.read", Context: []byte(`{"channel_id":123}`)})
	require.NoError(t, err)
	securityProof, _, err := service.IssueSecurityProof(identity, "2fa", binding)
	require.NoError(t, err)
	externalToken, err := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.MapClaims{
		"iss": "external-issuer",
		"aud": "external-audience",
		"exp": time.Now().Add(time.Minute).Unix(),
	}).SignedString([]byte("external-secret"))
	require.NoError(t, err)

	router := gin.New()
	router.GET("/optional", TryUserAuth(), func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{
			"id":               c.GetInt("id"),
			"use_access_token": c.GetBool("use_access_token"),
		})
	})

	tests := []struct {
		name          string
		token         string
		wantStatus    int
		wantUserID    int
		wantPAT       bool
		wantErrorCode string
	}{
		{name: "no authorization header", wantStatus: http.StatusOK},
		{name: "opaque unmatched credential", token: "opaque-relay-key", wantStatus: http.StatusOK},
		{name: "dotted unmatched credential", token: "ordinary.key.with-dots", wantStatus: http.StatusOK},
		{name: "third party jwt", token: externalToken, wantStatus: http.StatusOK},
		{name: "valid pat", token: "optional.pat.with-dots", wantStatus: http.StatusOK, wantUserID: patUser.Id, wantPAT: true},
		{name: "scoped pat outside its grant stays anonymous", token: scopedPAT, wantStatus: http.StatusOK},
		{name: "valid internal access jwt", token: accessToken, wantStatus: http.StatusOK, wantUserID: internalUser.Id},
		{name: "expired internal access jwt", token: issueExpiredDashboardAccessToken(t, identity), wantStatus: http.StatusUnauthorized, wantErrorCode: "AUTH_TOKEN_EXPIRED"},
		{name: "tampered internal access jwt", token: tamperDashboardToken(accessToken), wantStatus: http.StatusUnauthorized, wantErrorCode: "AUTH_UNAUTHORIZED"},
		{name: "security proof used as access", token: securityProof, wantStatus: http.StatusUnauthorized, wantErrorCode: "AUTH_UNAUTHORIZED"},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			request := httptest.NewRequest(http.MethodGet, "/optional", nil)
			if test.token != "" {
				request.Header.Set("Authorization", "Bearer "+test.token)
			}
			response := httptest.NewRecorder()
			router.ServeHTTP(response, request)
			assert.Equal(t, test.wantStatus, response.Code)
			if test.wantErrorCode != "" {
				assert.Contains(t, response.Body.String(), test.wantErrorCode)
				return
			}
			var body struct {
				ID             int  `json:"id"`
				UseAccessToken bool `json:"use_access_token"`
			}
			require.NoError(t, common.Unmarshal(response.Body.Bytes(), &body))
			assert.Equal(t, test.wantUserID, body.ID)
			assert.Equal(t, test.wantPAT, body.UseAccessToken)
		})
	}

	requiredRouter := gin.New()
	requiredRouter.GET("/required", UserAuth(), func(c *gin.Context) { c.Status(http.StatusNoContent) })
	requiredRequest := httptest.NewRequest(http.MethodGet, "/required", nil)
	requiredRequest.Header.Set("Authorization", "Bearer ordinary-unmatched-key")
	requiredResponse := httptest.NewRecorder()
	requiredRouter.ServeHTTP(requiredResponse, requiredRequest)
	assert.Equal(t, http.StatusUnauthorized, requiredResponse.Code, "required dashboard authentication must not adopt optional-auth fallback semantics")

	var patUserQueries int
	forcedCacheError := errors.New("forced PAT user cache lookup failure")
	const callbackName = "test:optional-auth-pat-user-cache-failure"
	require.NoError(t, model.DB.Callback().Query().Before("gorm:query").Register(callbackName, func(tx *gorm.DB) {
		if tx.Statement.Table != "users" {
			return
		}
		patUserQueries++
		if patUserQueries == 2 {
			tx.AddError(forcedCacheError)
		}
	}))
	cacheFailureRequest := httptest.NewRequest(http.MethodGet, "/optional", nil)
	cacheFailureRequest.Header.Set("Authorization", "Bearer optional.pat.with-dots")
	cacheFailureResponse := httptest.NewRecorder()
	router.ServeHTTP(cacheFailureResponse, cacheFailureRequest)
	model.DB.Callback().Query().Remove(callbackName)
	assert.Equal(t, http.StatusInternalServerError, cacheFailureResponse.Code)
	assert.Contains(t, cacheFailureResponse.Body.String(), "AUTH_INTERNAL_ERROR")

	sqlDB, err := model.DB.DB()
	require.NoError(t, err)
	require.NoError(t, sqlDB.Close())
	databaseFailureRequest := httptest.NewRequest(http.MethodGet, "/optional", nil)
	databaseFailureRequest.Header.Set("Authorization", "Bearer database-failure-key")
	databaseFailureResponse := httptest.NewRecorder()
	router.ServeHTTP(databaseFailureResponse, databaseFailureRequest)
	assert.Equal(t, http.StatusInternalServerError, databaseFailureResponse.Code)
	assert.Contains(t, databaseFailureResponse.Body.String(), "AUTH_INTERNAL_ERROR")
}

func createMiddlewareScopedToken(t *testing.T, userID int, expiresAt int64, scopes ...string) (string, *model.UserAccessToken) {
	t.Helper()
	suffix, err := common.GenerateRandomCharsKey(43)
	require.NoError(t, err)
	raw := model.AccessTokenPrefix + suffix
	token := &model.UserAccessToken{Name: "middleware token", TokenHash: model.AccessTokenFingerprint(raw), TokenHint: model.AccessTokenHint(raw), ExpiresAt: expiresAt}
	require.NoError(t, token.SetScopes(scopes))
	require.NoError(t, model.CreateUserAccessToken(userID, token, service.AccessTokenMaxPerUser))
	return raw, token
}

func middlewareBearerRequest(router *gin.Engine, path, token string) *httptest.ResponseRecorder {
	request := httptest.NewRequest(http.MethodGet, path, nil)
	request.Header.Set("Authorization", "Bearer "+token)
	response := httptest.NewRecorder()
	router.ServeHTTP(response, request)
	return response
}

func TestUserAuthAppliesAccessTokenRouteRules(t *testing.T) {
	setupDashboardAuthMiddlewareTest(t)
	gin.SetMode(gin.TestMode)
	wasMaster := common.IsMasterNode
	common.IsMasterNode = true
	t.Cleanup(func() { common.IsMasterNode = wasMaster })
	require.NoError(t, model.DB.AutoMigrate(&model.CasbinRule{}, &model.AuthzRole{}))
	require.NoError(t, authz.Init(model.DB))
	// The channel router declares this rule when it registers the route.
	DeclareAccessTokenPermissionRoute(http.MethodGet, "/api/channel/", authz.ChannelRead)

	legacy := "middleware-legacy-token"
	admin := createMiddlewarePATUser(t, "route-rule-admin", legacy)
	require.NoError(t, model.DB.Model(admin).Update("role", common.RoleAdminUser).Error)
	profile, _ := createMiddlewareScopedToken(t, admin.Id, 0, "profile:read")
	channel, _ := createMiddlewareScopedToken(t, admin.Id, time.Now().Unix()+3600, "channel:read")
	expired, _ := createMiddlewareScopedToken(t, admin.Id, time.Now().Unix()-1, "profile:read")

	ok := func(c *gin.Context) { c.JSON(http.StatusOK, gin.H{"id": c.GetInt("id")}) }
	router := gin.New()
	router.GET("/api/user/self", UserAuth(), ok)
	router.GET("/api/user/access_tokens", UserAuth(), ok)
	router.GET("/api/undeclared", UserAuth(), ok)
	router.GET("/api/channel/", AdminAuth(), RequirePermission(authz.ChannelRead), ok)
	router.GET("/api/pricing", TryUserAuth(), ok)

	for _, test := range []struct {
		name, path, token, code, reason string
		status                          int
	}{
		{name: "granted scope on a never expiring token", path: "/api/user/self", token: profile, status: http.StatusOK},
		{name: "missing scope", path: "/api/user/self", token: channel, status: http.StatusForbidden, code: "ACCESS_TOKEN_SCOPE_DENIED", reason: "scope_denied"},
		{name: "undeclared route", path: "/api/undeclared", token: profile, status: http.StatusForbidden, code: "ACCESS_TOKEN_ROUTE_UNDECLARED", reason: "route_undeclared"},
		{name: "session route", path: "/api/user/access_tokens", token: profile, status: http.StatusForbidden, code: "AUTH_SESSION_REQUIRED", reason: "session_required"},
		{name: "permission route with its scope", path: "/api/channel/", token: channel, status: http.StatusOK},
		{name: "permission route without its scope", path: "/api/channel/", token: profile, status: http.StatusForbidden, code: "ACCESS_TOKEN_SCOPE_DENIED", reason: "scope_denied"},
		{name: "expired token", path: "/api/user/self", token: expired, status: http.StatusUnauthorized, code: "ACCESS_TOKEN_EXPIRED", reason: "expired"},
		{name: "legacy token before the deadline", path: "/api/user/self", token: legacy, status: http.StatusOK},
		{name: "legacy token on a session route", path: "/api/user/access_tokens", token: legacy, status: http.StatusForbidden, code: "AUTH_SESSION_REQUIRED", reason: "session_required"},
	} {
		t.Run(test.name, func(t *testing.T) {
			response := middlewareBearerRequest(router, test.path, test.token)
			assert.Equal(t, test.status, response.Code, response.Body.String())
			if test.code != "" {
				assert.Contains(t, response.Body.String(), `"code":"`+test.code+`"`)
			}
			var audit model.AuditLog
			require.NoError(t, model.LOG_DB.Where("category = ?", model.AuditCategoryAccessToken).Order("id desc").First(&audit).Error)
			assert.Equal(t, model.AccessTokenFingerprint(test.token), audit.TokenRef)
			assert.Equal(t, test.status, audit.Status)
			if test.reason == "" {
				return
			}
			require.NotNil(t, audit.Other.Op)
			params, err := common.Marshal(audit.Other.Op.Params)
			require.NoError(t, err)
			assert.Contains(t, string(params), `"failure_reason":"`+test.reason+`"`)
			if test.code == "ACCESS_TOKEN_SCOPE_DENIED" {
				assert.Contains(t, string(params), `"required_scope":"`)
			}
		})
	}

	// The token grant never widens the account: revoking the Casbin permission
	// rejects a token that still carries the scope.
	require.NoError(t, authz.SetUserPermissions(admin.Id, authz.PermissionsMap{authz.ResourceChannel: {authz.ActionRead: false}}))
	response := middlewareBearerRequest(router, "/api/channel/", channel)
	assert.Equal(t, http.StatusForbidden, response.Code)
	assert.NotContains(t, response.Body.String(), "ACCESS_TOKEN_SCOPE_DENIED")

	require.NoError(t, model.DB.Model(admin).Update("status", common.UserStatusDisabled).Error)
	response = middlewareBearerRequest(router, "/api/user/self", profile)
	assert.Equal(t, http.StatusUnauthorized, response.Code)
	assert.Contains(t, response.Body.String(), `"code":"AUTH_USER_DISABLED"`)
	require.NoError(t, model.DB.Model(admin).Update("status", common.UserStatusEnabled).Error)
	assert.Equal(t, http.StatusOK, middlewareBearerRequest(router, "/api/user/self", profile).Code, "disabling a user keeps the token")

	require.NoError(t, model.DB.Model(&model.Option{}).Where(&model.Option{Key: "LegacyAccessTokenRetireAt"}).Update("value", fmt.Sprint(time.Now().Unix()-1)).Error)
	require.NoError(t, model.EnsureLegacyAccessTokenRetireAt(time.Now().Unix()))
	response = middlewareBearerRequest(router, "/api/user/self", legacy)
	assert.Equal(t, http.StatusUnauthorized, response.Code)
	assert.Contains(t, response.Body.String(), `"code":"ACCESS_TOKEN_LEGACY_RETIRED"`)
	response = middlewareBearerRequest(router, "/api/pricing", legacy)
	assert.Equal(t, http.StatusOK, response.Code)
	assert.JSONEq(t, `{"id":0}`, response.Body.String(), "optional authentication treats a retired token as anonymous")
	assert.Equal(t, http.StatusOK, middlewareBearerRequest(router, "/api/user/self", profile).Code, "the deadline only retires legacy tokens")
}

func TestAccessTokenIdentityAndSingleLookup(t *testing.T) {
	setupDashboardAuthMiddlewareTest(t)
	gin.SetMode(gin.TestMode)
	legacy := "middleware-identity-legacy"
	user := createMiddlewarePATUser(t, "identity-user", legacy)
	scoped, token := createMiddlewareScopedToken(t, user.Id, 0, "profile:read")

	router := gin.New()
	router.Use(AccessTokenAudit())
	router.GET("/api/user/self", UserAuth(), func(c *gin.Context) {
		_, session := GetSessionAuthIdentity(c)
		identity, stepUp := GetStepUpIdentity(c)
		c.JSON(http.StatusOK, gin.H{"session": session, "step_up": stepUp, "identity": identity})
	})

	var queries []string
	const callbackName = "test:access-token-lookup-count"
	require.NoError(t, model.DB.Callback().Query().After("gorm:query").Register(callbackName, func(tx *gorm.DB) {
		queries = append(queries, tx.Statement.Table+" "+tx.Statement.SQL.String())
	}))
	t.Cleanup(func() { model.DB.Callback().Query().Remove(callbackName) })
	countQueries := func(table, fragment string) int {
		count := 0
		for _, query := range queries {
			if strings.HasPrefix(query, table+" ") && strings.Contains(query, fragment) {
				count++
			}
		}
		return count
	}

	for _, test := range []struct {
		name, token string
		stepUp      bool
		tokenTable  int
		legacyQuery int
	}{
		{name: "scoped token", token: scoped, stepUp: true, tokenTable: 1},
		{name: "legacy token", token: legacy, legacyQuery: 1},
	} {
		t.Run(test.name, func(t *testing.T) {
			queries = nil
			response := middlewareBearerRequest(router, "/api/user/self", test.token)
			require.Equal(t, http.StatusOK, response.Code, response.Body.String())
			var body struct {
				Session  bool                 `json:"session"`
				StepUp   bool                 `json:"step_up"`
				Identity service.AuthIdentity `json:"identity"`
			}
			require.NoError(t, common.Unmarshal(response.Body.Bytes(), &body))
			assert.False(t, body.Session, "an access token is never a browser session")
			assert.Equal(t, test.stepUp, body.StepUp)
			if test.stepUp {
				assert.Equal(t, service.AuthIdentity{UserID: user.Id, SessionID: model.AccessTokenSessionID(token.Id), UserAuthVersion: user.AuthVersion, SessionVersion: model.AccessTokenSessionVersion}, body.Identity)
			}
			// The access audit and authentication share one lookup: the
			// credential query plus the owner's user row.
			assert.Len(t, queries, 2)
			assert.Equal(t, test.tokenTable, countQueries("user_access_tokens", "token_hash"))
			assert.Equal(t, test.legacyQuery, countQueries("users", "access_token = "))
		})
	}
}

func TestAPIKeyFromWebSocketSubprotocol(t *testing.T) {
	tests := []struct {
		name      string
		protocols string
		wantKey   string
		wantOK    bool
	}{
		{
			name:      "responses protocol only",
			protocols: "responses",
			wantOK:    false,
		},
		{
			name:      "realtime protocol only",
			protocols: "realtime",
			wantOK:    false,
		},
		{
			name:      "responses with insecure key",
			protocols: "responses, openai-insecure-api-key.sk-test",
			wantKey:   "sk-test",
			wantOK:    true,
		},
		{
			name:      "realtime with beta and insecure key",
			protocols: "realtime, openai-insecure-api-key.sk-realtime, openai-beta.realtime-v1",
			wantKey:   "sk-realtime",
			wantOK:    true,
		},
		{
			name:      "empty insecure key",
			protocols: "responses, openai-insecure-api-key.",
			wantOK:    false,
		},
		{
			name:      "bare insecure marker is not a key",
			protocols: "openai-insecure-api-key",
			wantOK:    false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			gotKey, gotOK := apiKeyFromWebSocketSubprotocol(tt.protocols)
			assert.Equal(t, tt.wantOK, gotOK)
			assert.Equal(t, tt.wantKey, gotKey)
		})
	}
}

func TestApplyWebSocketSubprotocolAuthorizationDoesNotOverrideProtocolOnly(t *testing.T) {
	header := http.Header{}
	header.Set("Authorization", "Bearer sk-original")
	header.Set("Sec-WebSocket-Protocol", "responses")
	header.Add("Sec-WebSocket-Protocol", "openai-beta.realtime-v1")

	assert.False(t, applyWebSocketSubprotocolAuthorization(header))
	assert.Equal(t, "Bearer sk-original", header.Get("Authorization"))
}

func TestApplyWebSocketSubprotocolAuthorizationOverridesWithInsecureKey(t *testing.T) {
	header := http.Header{}
	header.Set("Authorization", "Bearer sk-original")
	header.Set("Sec-WebSocket-Protocol", "responses, openai-insecure-api-key.sk-from-protocol")

	assert.True(t, applyWebSocketSubprotocolAuthorization(header))
	assert.Equal(t, "Bearer sk-from-protocol", header.Get("Authorization"))
}

func TestApplyWebSocketSubprotocolAuthorizationReadsRepeatedHeaders(t *testing.T) {
	header := http.Header{}
	header.Set("Authorization", "Bearer sk-original")
	header.Add("Sec-WebSocket-Protocol", "responses")
	header.Add("Sec-WebSocket-Protocol", "openai-insecure-api-key.sk-later-field")

	assert.True(t, applyWebSocketSubprotocolAuthorization(header))
	assert.Equal(t, "Bearer sk-later-field", header.Get("Authorization"))
}
