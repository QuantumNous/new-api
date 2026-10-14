package router

import (
	"bytes"
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"database/sql"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"maps"
	"net/http"
	"net/http/httptest"
	"net/url"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/middleware"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/pkg/jsplugin"
	"github.com/QuantumNous/new-api/relay"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/service/authz"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"github.com/QuantumNous/new-api/setting/system_setting"
	"github.com/gin-gonic/gin"
	"github.com/glebarez/sqlite"
	mysqlDriver "github.com/go-sql-driver/mysql"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/stdlib"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/driver/mysql"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

type routerAppPluginFixture struct {
	engine            *gin.Engine
	rootToken         string
	pluginAdminToken  string
	userToken         string
	disabledUserToken string
}

type routerAppPluginEnvelope struct {
	Success bool                   `json:"success"`
	Data    model.AppInstallResult `json:"data"`
	Error   struct {
		Code string `json:"code"`
	} `json:"error"`
}

var routerAppPluginRateLimitRun atomic.Uint32

func TestAppPluginDashboardRoutesAndRedaction(t *testing.T) {
	fixture := setupRouterAppPluginTest(t)
	registered := map[string]bool{}
	for _, route := range fixture.engine.Routes() {
		registered[route.Method+" "+route.Path] = true
	}
	for _, route := range []string{
		"GET /api/app_plugins",
		"GET /api/app_plugins/installations",
		"POST /api/app_plugins/installations",
		"PATCH /api/app_plugins/installations",
		"GET /api/infinite-canvas",
	} {
		assert.Truef(t, registered[route], "route %s must remain registered", route)
	}

	for _, request := range []struct {
		name   string
		method string
		path   string
	}{
		{name: "navigation", method: http.MethodGet, path: "/api/app_plugins"},
		{name: "installation list", method: http.MethodGet, path: "/api/app_plugins/installations"},
		{name: "installation create", method: http.MethodPost, path: "/api/app_plugins/installations"},
		{name: "installation update", method: http.MethodPatch, path: "/api/app_plugins/installations"},
	} {
		t.Run(request.name+" requires authentication envelope", func(t *testing.T) {
			response := routerAppPluginRequest(fixture.engine, request.method, request.path, "", nil)
			assertRouterAppPluginErrorEnvelope(t, response, http.StatusUnauthorized, "unauthenticated", "Authentication required", false)
		})
	}

	t.Run("malformed authorization is unauthenticated", func(t *testing.T) {
		response := routerAppPluginRequestWithHeaders(
			fixture.engine,
			http.MethodGet,
			"/api/app_plugins",
			"",
			nil,
			map[string]string{"Authorization": "Bearer malformed token"},
		)
		assertRouterAppPluginErrorEnvelope(t, response, http.StatusUnauthorized, "unauthenticated", "Authentication required", false)
	})

	t.Run("invalid token is unauthenticated without disclosure", func(t *testing.T) {
		const invalidToken = "invalid-app-plugin-token"
		response := routerAppPluginRequest(fixture.engine, http.MethodGet, "/api/app_plugins", invalidToken, nil)
		assertRouterAppPluginErrorEnvelope(t, response, http.StatusUnauthorized, "unauthenticated", "Authentication required", false)
		assert.NotContains(t, response.Body.String(), invalidToken)
	})

	t.Run("disabled identity is inactive", func(t *testing.T) {
		response := routerAppPluginRequest(fixture.engine, http.MethodGet, "/api/app_plugins", fixture.disabledUserToken, nil)
		assertRouterAppPluginErrorEnvelope(t, response, http.StatusForbidden, "identity_inactive", "Identity is inactive", false)
	})

	disabled := routerAppPluginRequest(fixture.engine, http.MethodGet, "/api/app_plugins", fixture.userToken, nil)
	require.Equal(t, http.StatusForbidden, disabled.Code, disabled.Body.String())
	assert.Equal(t, "app_plugin_disabled", routerAppPluginErrorCode(t, disabled))
	disabledManagement := routerAppPluginRequest(fixture.engine, http.MethodGet, "/api/app_plugins/installations", fixture.rootToken, nil)
	require.Equal(t, http.StatusForbidden, disabledManagement.Code, disabledManagement.Body.String())
	assert.Equal(t, "app_plugin_disabled", routerAppPluginErrorCode(t, disabledManagement))

	setRouterAppPluginFlag(operation_setting.AppPluginV1EnabledOptionKey, true)
	missingIdempotency := routerAppPluginRequest(
		fixture.engine,
		http.MethodPost,
		"/api/app_plugins/installations",
		fixture.rootToken,
		routerAppPluginInstallBody(t, "redacted-app", "1.0.0"),
	)
	require.Equal(t, http.StatusBadRequest, missingIdempotency.Code, missingIdempotency.Body.String())

	headers := map[string]string{"Idempotency-Key": "router-redaction"}
	created := routerAppPluginRequestWithHeaders(
		fixture.engine,
		http.MethodPost,
		"/api/app_plugins/installations",
		fixture.rootToken,
		routerAppPluginInstallBody(t, "redacted-app", "1.0.0"),
		headers,
	)
	require.Equal(t, http.StatusCreated, created.Code, created.Body.String())
	var createResult routerAppPluginEnvelope
	require.NoError(t, common.Unmarshal(created.Body.Bytes(), &createResult))
	require.True(t, createResult.Success)
	require.NoError(t, model.DB.Create(&model.AppServiceCredential{
		AppKey:            "redacted-app",
		InstallationID:    createResult.Data.InstallationID,
		CredentialID:      "cred-visible-metadata",
		CredentialHash:    "credential-hash-must-not-leak",
		CredentialVersion: "v1",
		Status:            "active",
		ExpiresAt:         4102444800,
	}).Error)

	for name, token := range map[string]string{
		"root":         fixture.rootToken,
		"plugin_admin": fixture.pluginAdminToken,
	} {
		t.Run(name+" can list installations", func(t *testing.T) {
			response := routerAppPluginRequest(
				fixture.engine,
				http.MethodGet,
				"/api/app_plugins/installations?status=disabled&key=redacted-app&limit=1",
				token,
				nil,
			)
			require.Equal(t, http.StatusOK, response.Code, response.Body.String())
			assert.Contains(t, response.Body.String(), `"credential_id":"cred-visible-metadata"`)
			assert.NotContains(t, response.Body.String(), "credential-hash-must-not-leak")
			assert.NotContains(t, response.Body.String(), "credential_hash")
			assert.NotContains(t, response.Body.String(), "secret_ref")
			assert.NotContains(t, response.Body.String(), "canonical_manifest")
		})
	}

	forbidden := routerAppPluginRequest(
		fixture.engine,
		http.MethodGet,
		"/api/app_plugins/installations",
		fixture.userToken,
		nil,
	)
	require.Equal(t, http.StatusNotFound, forbidden.Code, forbidden.Body.String())
	assert.Equal(t, "not_found", routerAppPluginErrorCode(t, forbidden))

	canvas := routerAppPluginRequest(fixture.engine, http.MethodGet, "/api/infinite-canvas", "", nil)
	assert.Equal(t, http.StatusNoContent, canvas.Code)

	t.Run("rate limits use canonical envelopes", func(t *testing.T) {
		rateLimitRun := routerAppPluginRateLimitRun.Add(1)
		previousGlobal, previousGlobalNum, previousGlobalDuration := common.GlobalApiRateLimitEnable, common.GlobalApiRateLimitNum, common.GlobalApiRateLimitDuration
		previousCritical, previousCriticalNum, previousCriticalDuration := common.CriticalRateLimitEnable, common.CriticalRateLimitNum, common.CriticalRateLimitDuration
		previousFlag := operation_setting.AppPluginV1Enabled
		t.Cleanup(func() {
			common.GlobalApiRateLimitEnable, common.GlobalApiRateLimitNum, common.GlobalApiRateLimitDuration = previousGlobal, previousGlobalNum, previousGlobalDuration
			common.CriticalRateLimitEnable, common.CriticalRateLimitNum, common.CriticalRateLimitDuration = previousCritical, previousCriticalNum, previousCriticalDuration
			setRouterAppPluginFlag(operation_setting.AppPluginV1EnabledOptionKey, previousFlag)
		})
		require.False(t, common.RedisEnabled, "rate-limit regression must use the in-memory limiter")
		setRouterAppPluginFlag(operation_setting.AppPluginV1EnabledOptionKey, false)
		common.GlobalApiRateLimitEnable = false
		common.CriticalRateLimitEnable, common.CriticalRateLimitNum, common.CriticalRateLimitDuration = true, 1, 60

		for i, test := range []struct {
			name, path    string
			authenticated bool
			userLimit     bool
		}{
			{name: "IP authorize before authentication", path: "/api/app_plugins/test/authorize"},
			{name: "IP credential create after authentication", path: "/api/app_plugins/installations/test/service-credentials", authenticated: true},
			{name: "IP credential rotate after authentication", path: "/api/app_plugins/installations/test/service-credentials/rotate", authenticated: true},
			{name: "IP exchange", path: "/internal/apps/v1/launch-codes/exchange"},
			{name: "IP introspect", path: "/internal/apps/v1/sessions/introspect"},
			{name: "IP revoke", path: "/internal/apps/v1/sessions/revoke"},
			{name: "user authorize across IPs", path: "/api/app_plugins/test/authorize", authenticated: true, userLimit: true},
			{name: "user credential create across IPs", path: "/api/app_plugins/installations/test/service-credentials", authenticated: true, userLimit: true},
			{name: "user credential rotate across IPs", path: "/api/app_plugins/installations/test/service-credentials/rotate", authenticated: true, userLimit: true},
		} {
			t.Run(test.name, func(t *testing.T) {
				token := ""
				if test.authenticated {
					token = fmt.Sprintf("b15-rate-limit-token-%d-%d", rateLimitRun, i)
					name := fmt.Sprintf("b15-rate-limit-user-%d-%d", rateLimitRun, i)
					require.NoError(t, model.DB.Create(&model.User{
						Id: 15000 + int(rateLimitRun)*100 + i, Username: name, Role: common.RoleRootUser,
						Status: common.UserStatusEnabled, Group: "default", AccessToken: &token,
						AuthVersion: 1, AffCode: name,
					}).Error)
				}
				// Isolate route-local limiters; the real SetApiRouter global chain is tested below.
				engine := gin.New()
				require.NoError(t, engine.SetTrustedProxies(nil))
				if !test.userLimit {
					engine.Use(middleware.RequestId())
				}
				registerAppPluginRoutes(engine.Group("/api"))
				firstIP := routerAppPluginRateLimitIP(rateLimitRun*32 + uint32(2*i+1))
				secondIP := firstIP
				if test.userLimit {
					secondIP = routerAppPluginRateLimitIP(rateLimitRun*32 + uint32(2*i+2))
				}
				first := routerAppPluginRateLimitRequest(engine, http.MethodPost, test.path, token, firstIP)
				if i == 0 {
					assertRouterAppPluginErrorEnvelope(t, first, http.StatusUnauthorized, "unauthenticated", "Authentication required", false)
				} else if strings.Contains(test.path, "/service-credentials") {
					assertRouterAppPluginErrorEnvelope(t, first, http.StatusForbidden, "forbidden", "App plugin request is forbidden", false)
				} else if test.path == "/internal/apps/v1/sessions/introspect" || test.path == "/internal/apps/v1/sessions/revoke" {
					assertRouterAppPluginErrorEnvelope(t, first, http.StatusUnauthorized, "service_identity_invalid", "App service request denied", false)
				} else {
					assertRouterAppPluginErrorEnvelope(t, first, http.StatusForbidden, "app_plugin_disabled", map[bool]string{
						true: "App plugin API is disabled", false: "App service request denied",
					}[test.authenticated], false)
				}
				limited := routerAppPluginRateLimitRequest(engine, http.MethodPost, test.path, token, secondIP)
				t.Logf("limiter=%s path=%s first_status=%d second_status=%d body_bytes=%d",
					test.name, test.path, first.Code, limited.Code, limited.Body.Len())
				assert.Equal(t, "60", limited.Header().Get("Retry-After"))
				assert.Equal(t, "no-store", limited.Header().Get("Cache-Control"))
				assert.Equal(t, "no-referrer", limited.Header().Get("Referrer-Policy"))
				assert.NotEqual(t, "client-request-id-must-not-be-trusted", limited.Header().Get(common.RequestIdKey))
				assert.NotEqual(t, first.Header().Get(common.RequestIdKey), limited.Header().Get(common.RequestIdKey))
				require.NotEmpty(t, limited.Body.String(), "B1.5 429 canonical envelope missing")
				assertRouterAppPluginErrorEnvelope(t, limited, http.StatusTooManyRequests, "rate_limited", "Too many app plugin requests", true)
			})
		}

		t.Run("SetApiRouter global limiter", func(t *testing.T) {
			common.CriticalRateLimitEnable = false
			common.GlobalApiRateLimitEnable, common.GlobalApiRateLimitNum, common.GlobalApiRateLimitDuration = true, 1, 60
			engine := gin.New()
			require.NoError(t, engine.SetTrustedProxies(nil))
			engine.Use(middleware.RequestId())
			SetApiRouter(engine)
			for i, test := range []struct {
				method, path string
				app          bool
			}{
				{http.MethodGet, "/api/app_plugins", true},
				{http.MethodGet, "/api/app_plugins/installations", true},
				{http.MethodPost, "/api/app_plugins/installations", true},
				{http.MethodPatch, "/api/app_plugins/installations", true},
				{http.MethodPost, "/api/app_plugins/test/authorize", true},
				{http.MethodPost, "/api/app_plugins/installations/test/service-credentials", true},
				{http.MethodPost, "/api/app_plugins/installations/test/service-credentials/rotate", true},
				{http.MethodDelete, "/api/app_plugins/installations/test/service-credentials/test", true},
				{http.MethodPost, "/internal/apps/v1/launch-codes/exchange", true},
				{http.MethodPost, "/internal/apps/v1/sessions/introspect", true},
				{http.MethodPost, "/internal/apps/v1/sessions/revoke", true},
				{http.MethodGet, "/api/models", false},
				{http.MethodGet, "/api/user/self", false},
			} {
				t.Run(test.method+" "+test.path, func(t *testing.T) {
					ip := routerAppPluginRateLimitIP(rateLimitRun*32 + uint32(19+i))
					first := routerAppPluginRateLimitRequest(engine, http.MethodGet, "/api/app_plugins", "", ip)
					assertRouterAppPluginErrorEnvelope(t, first, http.StatusUnauthorized, "unauthenticated", "Authentication required", false)
					limited := routerAppPluginRateLimitRequest(engine, test.method, test.path, "", ip)
					t.Logf("limiter=GlobalAPI method=%s path=%s first_status=%d second_status=%d body_bytes=%d",
						test.method, test.path, first.Code, limited.Code, limited.Body.Len())
					assert.Equal(t, "60", limited.Header().Get("Retry-After"))
					if !test.app {
						assert.Equal(t, http.StatusTooManyRequests, limited.Code)
						assert.Empty(t, limited.Body.String(), "non-App global limiter contract must remain unchanged")
						assert.Empty(t, limited.Header().Get("Cache-Control"))
						assert.Empty(t, limited.Header().Get("Referrer-Policy"))
						return
					}
					assert.Equal(t, "no-store", limited.Header().Get("Cache-Control"))
					assert.Equal(t, "no-referrer", limited.Header().Get("Referrer-Policy"))
					assert.NotEqual(t, "client-request-id-must-not-be-trusted", limited.Header().Get(common.RequestIdKey))
					assert.NotEqual(t, first.Header().Get(common.RequestIdKey), limited.Header().Get(common.RequestIdKey))
					require.NotEmpty(t, limited.Body.String(), "B1.5 429 canonical envelope missing")
					assertRouterAppPluginErrorEnvelope(t, limited, http.StatusTooManyRequests, "rate_limited", "Too many app plugin requests", true)
				})
			}
		})
	})

	t.Run("normalization preserves existing responses", func(t *testing.T) {
		for _, test := range []struct {
			name, body string
			status     int
		}{
			{"canonical 429", `{"error":{"code":"capacity_exhausted","message":"Capacity exhausted","field_errors":[],"retryable":true,"request_id":"server-existing"}}`, http.StatusTooManyRequests},
			{"canonical 401", `{"error":{"code":"unauthenticated","message":"Authentication required","field_errors":[],"retryable":false,"request_id":"server-existing"}}`, http.StatusUnauthorized},
			{"empty 500", "", http.StatusInternalServerError},
			{"legacy business error", `{"success":false,"code":"BUSINESS_ERROR","message":"Rejected"}`, http.StatusBadRequest},
		} {
			t.Run(test.name, func(t *testing.T) {
				engine := gin.New()
				engine.GET("/api/app_plugins", normalizeAppPluginAuthErrors(), func(c *gin.Context) {
					c.Header("Retry-After", "17")
					c.Header("Cache-Control", "no-store")
					c.Header("Referrer-Policy", "no-referrer")
					c.Data(test.status, "application/json", []byte(test.body))
					c.Abort()
				})
				response := routerAppPluginRequest(engine, http.MethodGet, "/api/app_plugins", "", nil)
				assert.Equal(t, test.status, response.Code)
				assert.Equal(t, test.body, response.Body.String())
				assert.Equal(t, "17", response.Header().Get("Retry-After"))
				assert.Equal(t, "no-store", response.Header().Get("Cache-Control"))
				assert.Equal(t, "no-referrer", response.Header().Get("Referrer-Policy"))
			})
		}
	})

	t.Run("internal authentication error is unavailable without disclosure", func(t *testing.T) {
		sqlDB, err := model.DB.DB()
		require.NoError(t, err)
		require.NoError(t, sqlDB.Close())
		response := routerAppPluginRequest(fixture.engine, http.MethodGet, "/api/app_plugins", fixture.rootToken, nil)
		assertRouterAppPluginErrorEnvelope(t, response, http.StatusServiceUnavailable, "service_unavailable", "App plugin request failed", true)
		assert.NotContains(t, response.Body.String(), "database is closed")
		assert.NotContains(t, response.Body.String(), "AUTH_INTERNAL_ERROR")
	})
}

func TestAppPluginPatchRequiresRevisionAndRootForSensitiveChanges(t *testing.T) {
	fixture := setupRouterAppPluginTest(t)
	setRouterAppPluginFlag(operation_setting.AppPluginV1EnabledOptionKey, true)
	created := routerAppPluginRequestWithHeaders(
		fixture.engine,
		http.MethodPost,
		"/api/app_plugins/installations",
		fixture.rootToken,
		routerAppPluginInstallBody(t, "managed-app", "1.0.0"),
		map[string]string{"Idempotency-Key": "router-managed-app"},
	)
	require.Equal(t, http.StatusCreated, created.Code, created.Body.String())
	var createResult routerAppPluginEnvelope
	require.NoError(t, common.Unmarshal(created.Body.Bytes(), &createResult))

	missingRevision := routerAppPluginRequest(
		fixture.engine,
		http.MethodPatch,
		"/api/app_plugins/installations",
		fixture.pluginAdminToken,
		routerAppPluginJSON(t, map[string]any{
			"installation_id": createResult.Data.InstallationID,
			"changes":         map[string]any{"base_url": "https://apps.example.com/managed-v2/"},
		}),
	)
	require.Equal(t, http.StatusBadRequest, missingRevision.Code, missingRevision.Body.String())
	assert.Equal(t, "invalid_request", routerAppPluginErrorCode(t, missingRevision))

	for name, changes := range map[string]map[string]any{
		"enabled surfaces": {"enabled_surfaces": []string{"direct"}},
		"parent origins":   {"allowed_parent_origins": []string{"https://console2.example.com"}},
		"network loosen": {
			"network_policy": map[string]any{
				"allow_hosts":            []string{"api.example.com", "new.example.com"},
				"deny_private_ip_ranges": false,
			},
		},
		"entitlement self report": {
			"entitlement_policy": map[string]any{
				"key":   "self-reported",
				"rules": map[string][]string{"app_plugin": {"manage"}},
			},
		},
		"revoke":     {"status": "revoked"},
		"secret ref": {"secret_ref": "must-never-enter-audit"},
	} {
		t.Run("plugin admin cannot change "+name, func(t *testing.T) {
			response := routerAppPluginRequest(
				fixture.engine,
				http.MethodPatch,
				"/api/app_plugins/installations",
				fixture.pluginAdminToken,
				routerAppPluginPatchBody(t, createResult.Data.InstallationID, createResult.Data.Revision, changes),
			)
			require.Equal(t, http.StatusForbidden, response.Code, response.Body.String())
			assert.Equal(t, "forbidden", routerAppPluginErrorCode(t, response))
		})
	}

	rootUpdate := routerAppPluginRequest(
		fixture.engine,
		http.MethodPatch,
		"/api/app_plugins/installations",
		fixture.rootToken,
		routerAppPluginPatchBody(t, createResult.Data.InstallationID, createResult.Data.Revision, map[string]any{
			"enabled_surfaces":       []string{"direct"},
			"allowed_parent_origins": []string{"https://console2.example.com"},
			"network_policy": map[string]any{
				"allow_hosts":            []string{"api.example.com", "cdn.example.com"},
				"deny_private_ip_ranges": false,
			},
			"entitlement_policy": map[string]any{
				"key":   "managed-app-policy",
				"rules": map[string][]string{"app_plugin": {"manage"}},
			},
		}),
	)
	require.Equal(t, http.StatusOK, rootUpdate.Code, rootUpdate.Body.String())
	var rootUpdateResult routerAppPluginEnvelope
	require.NoError(t, common.Unmarshal(rootUpdate.Body.Bytes(), &rootUpdateResult))
	assert.Equal(t, int64(2), rootUpdateResult.Data.Revision)
	assert.NotEmpty(t, rootUpdateResult.Data.EntitlementPolicyVersion)

	stale := routerAppPluginRequest(
		fixture.engine,
		http.MethodPatch,
		"/api/app_plugins/installations",
		fixture.rootToken,
		routerAppPluginPatchBody(t, createResult.Data.InstallationID, createResult.Data.Revision, map[string]any{"base_url": "https://apps.example.com/stale/"}),
	)
	require.Equal(t, http.StatusConflict, stale.Code, stale.Body.String())
	assert.Equal(t, "version_conflict", routerAppPluginErrorCode(t, stale))

	enable := routerAppPluginRequest(
		fixture.engine,
		http.MethodPatch,
		"/api/app_plugins/installations",
		fixture.pluginAdminToken,
		routerAppPluginPatchBody(t, createResult.Data.InstallationID, rootUpdateResult.Data.Revision, map[string]any{"status": "enabled"}),
	)
	require.Equal(t, http.StatusConflict, enable.Code, enable.Body.String())
	assert.Equal(t, "app_enable_prerequisite_missing", routerAppPluginErrorCode(t, enable))

	tightened := routerAppPluginRequest(
		fixture.engine,
		http.MethodPatch,
		"/api/app_plugins/installations",
		fixture.pluginAdminToken,
		routerAppPluginPatchBody(t, createResult.Data.InstallationID, rootUpdateResult.Data.Revision, map[string]any{
			"network_policy": map[string]any{
				"allow_hosts":            []string{"api.example.com"},
				"deny_private_ip_ranges": true,
			},
		}),
	)
	require.Equal(t, http.StatusOK, tightened.Code, tightened.Body.String())
	var tightenedResult routerAppPluginEnvelope
	require.NoError(t, common.Unmarshal(tightened.Body.Bytes(), &tightenedResult))
	assert.Equal(t, int64(3), tightenedResult.Data.Revision)

	enabled, err := model.CompareAndSwapAppInstallationStatus(
		t.Context(),
		model.DB,
		createResult.Data.InstallationID,
		tightenedResult.Data.Revision,
		model.AppInstallationStatusEnabled,
	)
	require.NoError(t, err)
	configWhileEnabled := routerAppPluginRequest(
		fixture.engine,
		http.MethodPatch,
		"/api/app_plugins/installations",
		fixture.pluginAdminToken,
		routerAppPluginPatchBody(t, createResult.Data.InstallationID, enabled.Revision, map[string]any{
			"allowed_origins": []string{"https://other.example.com"},
		}),
	)
	require.Equal(t, http.StatusConflict, configWhileEnabled.Code, configWhileEnabled.Body.String())
	assert.Equal(t, "invalid_state_transition", routerAppPluginErrorCode(t, configWhileEnabled))

	disabled := routerAppPluginRequest(
		fixture.engine,
		http.MethodPatch,
		"/api/app_plugins/installations",
		fixture.pluginAdminToken,
		routerAppPluginPatchBody(t, createResult.Data.InstallationID, enabled.Revision, map[string]any{"status": "disabled"}),
	)
	require.Equal(t, http.StatusOK, disabled.Code, disabled.Body.String())
	var disabledResult routerAppPluginEnvelope
	require.NoError(t, common.Unmarshal(disabled.Body.Bytes(), &disabledResult))

	revoke := routerAppPluginRequest(
		fixture.engine,
		http.MethodPatch,
		"/api/app_plugins/installations",
		fixture.rootToken,
		routerAppPluginPatchBody(t, createResult.Data.InstallationID, disabledResult.Data.Revision, map[string]any{"status": "revoked"}),
	)
	require.Equal(t, http.StatusOK, revoke.Code, revoke.Body.String())

	var audits []model.AuditLog
	require.NoError(t, model.LOG_DB.Where("category = ?", model.AuditCategoryOperation).Order("id").Find(&audits).Error)
	require.NotEmpty(t, audits)
	hasInstall, hasPatch := false, false
	for _, audit := range audits {
		switch audit.Action {
		case "app_plugin.install":
			hasInstall = true
		case "app_plugin.update":
			hasPatch = true
		}
		require.NotNil(t, audit.Other.Op)
		params := audit.Other.Op.Params
		assert.Contains(t, params, "actor")
		objectJSON, ok := params["object"].(json.RawMessage)
		require.True(t, ok)
		var object string
		require.NoError(t, common.Unmarshal(objectJSON, &object))
		assert.Equal(t, "app_installation", object)
		assert.Contains(t, params, "revision")
		assert.Contains(t, params, "result")
	}
	assert.True(t, hasInstall)
	assert.True(t, hasPatch)
	auditJSON, err := common.Marshal(audits)
	require.NoError(t, err)
	assert.NotContains(t, string(auditJSON), "must-never-enter-audit")
	assert.NotContains(t, string(auditJSON), "credential_hash")
	assert.NotContains(t, string(auditJSON), "secret_ref")

	t.Run("configuration requires currently disabled installation", func(t *testing.T) {
		for _, actor := range []struct {
			name, token string
			root        bool
		}{
			{"root", fixture.rootToken, true},
			{"plugin-admin", fixture.pluginAdminToken, false},
		} {
			for _, currentStatus := range []string{"enabled", "disabled"} {
				for _, nextStatus := range []string{"disabled", "revoked"} {
					for _, bundled := range []bool{false, true} {
						name := fmt.Sprintf("%s-%s-%s-config-%t", actor.name, currentStatus, nextStatus, bundled)
						t.Run(name, func(t *testing.T) {
							created := routerAppPluginRequestWithHeaders(fixture.engine, http.MethodPost,
								"/api/app_plugins/installations", fixture.rootToken,
								routerAppPluginInstallBody(t, name, "1.0.0"), map[string]string{"Idempotency-Key": name})
							require.Equal(t, http.StatusCreated, created.Code, created.Body.String())
							var installed routerAppPluginEnvelope
							require.NoError(t, common.Unmarshal(created.Body.Bytes(), &installed))
							id := installed.Data.InstallationID
							if currentStatus == "enabled" {
								_, err := model.CompareAndSwapAppInstallationStatus(t.Context(), model.DB,
									id, installed.Data.Revision, model.AppInstallationStatusEnabled)
								require.NoError(t, err)
							}
							require.NoError(t, model.DB.Create(&model.AppServiceCredential{
								AppKey: name, InstallationID: id, CredentialID: name,
								CredentialHash: "test-hash", CredentialVersion: "v1", Status: "active",
							}).Error)
							var before model.AppInstallation
							var claimsBefore []model.AppRouteClaim
							var credentialsBefore []model.AppServiceCredential
							var policiesBefore []model.AppEntitlementPolicy
							require.NoError(t, model.DB.Where("installation_id = ?", id).First(&before).Error)
							require.NoError(t, model.DB.Where("installation_id = ?", id).Order("id").Find(&claimsBefore).Error)
							require.NoError(t, model.DB.Where("installation_id = ?", id).Order("id").Find(&credentialsBefore).Error)
							require.NoError(t, model.DB.Order("id").Find(&policiesBefore).Error)

							changes := map[string]any{"status": nextStatus}
							if bundled {
								changes["allowed_origins"] = []string{"https://changed.example.com"}
								changes["base_url"] = "https://apps.example.com/changed-" + name + "/"
								if actor.root {
									changes["entitlement_policy"] = map[string]any{
										"key": name, "rules": map[string][]string{"app_plugin": {"manage"}},
									}
								}
							}
							wantStatus, wantCode := http.StatusOK, ""
							switch {
							case !actor.root && nextStatus == "revoked":
								wantStatus, wantCode = http.StatusForbidden, "forbidden"
							case currentStatus == "enabled" && bundled:
								wantStatus, wantCode = http.StatusConflict, "invalid_state_transition"
							case currentStatus == "disabled" && nextStatus == "disabled" && !bundled:
								wantStatus, wantCode = http.StatusConflict, "invalid_state_transition"
							}
							response := routerAppPluginRequest(fixture.engine, http.MethodPatch,
								"/api/app_plugins/installations", actor.token,
								routerAppPluginPatchBody(t, id, before.Revision, changes))
							assert.Equal(t, wantStatus, response.Code, response.Body.String())
							assert.Equal(t, wantCode, routerAppPluginErrorCode(t, response))

							var after model.AppInstallation
							var claimsAfter []model.AppRouteClaim
							var credentialsAfter []model.AppServiceCredential
							var policiesAfter []model.AppEntitlementPolicy
							require.NoError(t, model.DB.Where("installation_id = ?", id).First(&after).Error)
							require.NoError(t, model.DB.Where("installation_id = ?", id).Order("id").Find(&claimsAfter).Error)
							require.NoError(t, model.DB.Where("installation_id = ?", id).Order("id").Find(&credentialsAfter).Error)
							require.NoError(t, model.DB.Order("id").Find(&policiesAfter).Error)
							if wantStatus != http.StatusOK {
								assert.Equal(t, before, after, "rejection must preserve installation and revision")
								assert.Equal(t, claimsBefore, claimsAfter, "rejection must preserve route claims")
								assert.Equal(t, credentialsBefore, credentialsAfter, "rejection must preserve credentials")
								assert.Equal(t, policiesBefore, policiesAfter, "rejection must not create policy versions")
								return
							}
							assert.Equal(t, nextStatus, after.Status)
							assert.Equal(t, before.Revision+1, after.Revision)
							if bundled {
								assert.Equal(t, model.AppStringList{"https://changed.example.com"}, after.AllowedOrigins)
								assert.Equal(t, changes["base_url"], after.BaseURL)
							} else {
								assert.Equal(t, before.AllowedOrigins, after.AllowedOrigins)
								assert.Equal(t, policiesBefore, policiesAfter)
							}
							if nextStatus == "revoked" {
								assert.Empty(t, claimsAfter)
								require.Len(t, credentialsAfter, 1)
								assert.Equal(t, "revoked", credentialsAfter[0].Status)
							} else {
								assert.Len(t, claimsAfter, len(claimsBefore))
								assert.Equal(t, credentialsBefore, credentialsAfter)
							}
						})
					}
				}
			}
		}
	})
}

func TestAppPluginEnableRouteDistinguishesStorageFaultsFromMissingPrerequisites(t *testing.T) {
	for _, fault := range []struct {
		name       string
		table      string
		occurrence int32
	}{
		{name: "app version", table: "app_versions", occurrence: 1},
		{name: "callback claim", table: "app_route_claims", occurrence: 2},
		{name: "service credentials", table: "app_service_credentials", occurrence: 1},
		{name: "service credential binding", table: "app_service_credential_bindings", occurrence: 1},
	} {
		t.Run(fault.name+" storage failure", func(t *testing.T) {
			fixture, app := setupRouterAppPluginEnableTest(t, []string{"identity.read", "task.read"})
			var before model.AppInstallation
			require.NoError(t, model.DB.Where("installation_id = ?", app.InstallationID).First(&before).Error)
			privateDetail := "private app enable " + fault.name + " storage detail"
			failed := registerRouterExecutionDBFault(t, "query", fault.table, fault.occurrence, privateDetail)

			response := routerAppPluginRequest(
				fixture.engine,
				http.MethodPatch,
				"/api/app_plugins/installations",
				fixture.pluginAdminToken,
				routerAppPluginPatchBody(t, app.InstallationID, app.Revision, map[string]any{"status": "enabled"}),
			)

			require.True(t, failed.Load(), "the enable route must exercise the intended storage query")
			assertRouterAppPluginErrorEnvelope(
				t, response, http.StatusServiceUnavailable,
				"service_unavailable", "App plugin request failed", true,
			)
			assert.NotContains(t, response.Body.String(), privateDetail)
			var after model.AppInstallation
			require.NoError(t, model.DB.Where("installation_id = ?", app.InstallationID).First(&after).Error)
			assert.Equal(t, before, after, "storage failure must leave the enable transaction mutation-free")
		})
	}

	for _, prerequisite := range []struct {
		name   string
		scopes []string
		mutate func(*testing.T, model.AppInstallResult)
	}{
		{
			name:   "missing app version",
			scopes: []string{"identity.read", "task.read"},
			mutate: func(t *testing.T, app model.AppInstallResult) {
				t.Helper()
				require.NoError(t, model.DB.Where("id = ?", app.AppVersionID).Delete(&model.AppVersion{}).Error)
			},
		},
		{
			name:   "missing callback claim",
			scopes: []string{"identity.read", "task.read"},
			mutate: func(t *testing.T, app model.AppInstallResult) {
				t.Helper()
				require.NoError(t, model.DB.Where(
					"installation_id = ? AND kind = ?", app.InstallationID, "callback",
				).Delete(&model.AppRouteClaim{}).Error)
			},
		},
		{
			name:   "malformed registration",
			scopes: []string{"identity.read", "task.read"},
			mutate: func(t *testing.T, app model.AppInstallResult) {
				t.Helper()
				require.NoError(t, model.DB.Model(&model.AppVersion{}).Where("id = ?", app.AppVersionID).
					Update("canonical_manifest_json", "{").Error)
			},
		},
		{name: "empty approved scopes"},
		{name: "identity read scope missing", scopes: []string{"task.read"}},
		{name: "requested scope missing", scopes: []string{"identity.read"}},
	} {
		t.Run(prerequisite.name, func(t *testing.T) {
			fixture, app := setupRouterAppPluginEnableTest(t, prerequisite.scopes)
			if prerequisite.mutate != nil {
				prerequisite.mutate(t, app)
			}
			var before model.AppInstallation
			require.NoError(t, model.DB.Where("installation_id = ?", app.InstallationID).First(&before).Error)

			response := routerAppPluginRequest(
				fixture.engine,
				http.MethodPatch,
				"/api/app_plugins/installations",
				fixture.pluginAdminToken,
				routerAppPluginPatchBody(t, app.InstallationID, app.Revision, map[string]any{"status": "enabled"}),
			)

			assertRouterAppPluginEnablePrerequisiteError(t, response)
			var after model.AppInstallation
			require.NoError(t, model.DB.Where("installation_id = ?", app.InstallationID).First(&after).Error)
			assert.Equal(t, before, after, "missing prerequisite must leave the enable transaction mutation-free")
		})
	}
}

func setupRouterAppPluginEnableTest(
	t *testing.T,
	scopes []string,
) (routerAppPluginFixture, model.AppInstallResult) {
	t.Helper()
	fixture := setupRouterAppPluginTest(t)
	setRouterAppPluginFlag(operation_setting.AppPluginV1EnabledOptionKey, true)
	require.NoError(t, model.MigrateAppPluginLaunchTables(model.DB))
	var installRequest map[string]any
	require.NoError(t, common.Unmarshal(
		routerAppPluginInstallBody(t, "enable-taxonomy", "1.0.0"),
		&installRequest,
	))
	installRequest["enabled_surfaces"] = []string{"direct"}
	created := routerAppPluginRequestWithHeaders(
		fixture.engine,
		http.MethodPost,
		"/api/app_plugins/installations",
		fixture.rootToken,
		routerAppPluginJSON(t, installRequest),
		map[string]string{"Idempotency-Key": "enable-taxonomy"},
	)
	require.Equal(t, http.StatusCreated, created.Code, created.Body.String())
	var result routerAppPluginEnvelope
	require.NoError(t, common.Unmarshal(created.Body.Bytes(), &result))
	if scopes != nil {
		now := time.Now()
		_, err := model.IssueAppServiceCredential(
			t.Context(), model.DB, result.Data.InstallationID, scopes, now, now.Add(time.Hour), false,
		)
		require.NoError(t, err)
	}
	return fixture, result.Data
}

func assertRouterAppPluginEnablePrerequisiteError(t *testing.T, response *httptest.ResponseRecorder) {
	t.Helper()
	require.Equal(t, http.StatusConflict, response.Code, response.Body.String())
	requestID := response.Header().Get(common.RequestIdKey)
	require.NotEmpty(t, requestID)
	var actual map[string]any
	require.NoError(t, common.Unmarshal(response.Body.Bytes(), &actual), response.Body.String())
	assert.Equal(t, map[string]any{
		"error": map[string]any{
			"code":         "app_enable_prerequisite_missing",
			"message":      "App plugin enable prerequisites are missing",
			"field_errors": []any{map[string]any{"path": "/changes/status", "code": "invalid"}},
			"retryable":    false,
			"request_id":   requestID,
		},
	}, actual)
}

func setupRouterAppPluginTest(t *testing.T) routerAppPluginFixture {
	t.Helper()
	previousDB, previousLogDB := model.DB, model.LOG_DB
	previousMain, previousLog := common.MainDatabaseType(), common.LogDatabaseType()
	previousRedis := common.RedisEnabled
	previousMaster := common.IsMasterNode
	common.OptionMapRWMutex.Lock()
	previousOptions := common.OptionMap
	previousFlag := operation_setting.AppPluginV1Enabled
	common.OptionMap = maps.Clone(common.OptionMap)
	if common.OptionMap == nil {
		common.OptionMap = map[string]string{}
	}
	common.OptionMap[operation_setting.AppPluginV1EnabledOptionKey] = "false"
	operation_setting.AppPluginV1Enabled = false
	common.OptionMapRWMutex.Unlock()

	db := openRouterAppPluginDB(t)
	t.Cleanup(func() {
		model.DB, model.LOG_DB = previousDB, previousLogDB
		common.SetDatabaseTypes(previousMain, previousLog)
		common.RedisEnabled = previousRedis
		common.IsMasterNode = previousMaster
		common.OptionMapRWMutex.Lock()
		common.OptionMap = previousOptions
		operation_setting.AppPluginV1Enabled = previousFlag
		common.OptionMapRWMutex.Unlock()
	})
	dbType := map[string]common.DatabaseType{
		"sqlite": common.DatabaseTypeSQLite, "mysql": common.DatabaseTypeMySQL, "postgres": common.DatabaseTypePostgreSQL,
	}[db.Dialector.Name()]
	common.SetDatabaseTypes(dbType, dbType)
	require.NoError(t, db.AutoMigrate(
		&model.User{},
		&model.TaskPlugin{},
		&model.AuditLog{},
		&model.CasbinRule{},
		&model.AuthzRole{},
	))
	require.NoError(t, model.MigrateAppPluginTables(db))
	model.DB, model.LOG_DB = db, db
	common.RedisEnabled = false
	common.IsMasterNode = true
	require.NoError(t, authz.Init(db))
	require.NoError(t, db.Create(&model.TaskPlugin{
		Key:        "doubao",
		APIVersion: 1,
		Version:    "1.2.0",
		Source:     "module.exports = {};",
		SourceHash: "router-test-source-hash",
		Enabled:    true,
		Active:     true,
	}).Error)

	rootToken := "app-plugin-root-token"
	pluginAdminToken := "app-plugin-admin-token"
	userToken := "app-plugin-user-token"
	disabledUserToken := "app-plugin-disabled-user-token"
	users := []model.User{
		{Username: "app-plugin-root", Role: common.RoleRootUser, Status: common.UserStatusEnabled, Group: "default", AccessToken: &rootToken, AuthVersion: 1, AffCode: "app-plugin-root"},
		{Username: "app-plugin-admin", Role: common.RolePluginAdminUser, Status: common.UserStatusEnabled, Group: "default", AccessToken: &pluginAdminToken, AuthVersion: 1, AffCode: "app-plugin-admin"},
		{Username: "app-plugin-user", Role: common.RoleCommonUser, Status: common.UserStatusEnabled, Group: "default", AccessToken: &userToken, AuthVersion: 1, AffCode: "app-plugin-user"},
		{Username: "app-plugin-disabled-user", Role: common.RoleCommonUser, Status: common.UserStatusDisabled, Group: "default", AccessToken: &disabledUserToken, AuthVersion: 1, AffCode: "app-plugin-disabled-user"},
	}
	require.NoError(t, db.Create(&users).Error)

	gin.SetMode(gin.TestMode)
	engine := gin.New()
	engine.Use(middleware.RequestId())
	api := engine.Group("/api")
	api.GET("/infinite-canvas", func(c *gin.Context) { c.Status(http.StatusNoContent) })
	registerAppPluginRoutes(api)

	return routerAppPluginFixture{
		engine:            engine,
		rootToken:         rootToken,
		pluginAdminToken:  pluginAdminToken,
		userToken:         userToken,
		disabledUserToken: disabledUserToken,
	}
}

func openRouterAppPluginDB(t *testing.T) *gorm.DB {
	t.Helper()
	dialect, dsn := os.Getenv("APP_PLUGIN_TEST_DIALECT"), os.Getenv("APP_PLUGIN_TEST_DSN")
	if dialect == "" {
		dialect = "sqlite"
	}
	config := &gorm.Config{Logger: logger.Default.LogMode(logger.Silent)}
	name := fmt.Sprintf("app_plugin_router_%d_%d", os.Getpid(), time.Now().UnixNano())
	var db *gorm.DB
	var err error
	switch dialect {
	case "sqlite":
		if dsn == "" {
			dsn = filepath.Join(t.TempDir(), "app-plugin-router.db")
		} else {
			// The runner supplies a temporary filename; each fixture owns a sibling.
			dsn += "." + name
			sqliteFile := dsn
			t.Cleanup(func() { assert.NoError(t, os.Remove(sqliteFile)) })
		}
		db, err = gorm.Open(sqlite.Open(dsn), config)
	case "mysql":
		require.NotEmpty(t, dsn, "APP_PLUGIN_TEST_DSN is required")
		parsed, parseErr := mysqlDriver.ParseDSN(dsn)
		require.True(t, parseErr == nil, "invalid mysql test DSN")
		admin, openErr := gorm.Open(mysql.Open(dsn), config)
		require.True(t, openErr == nil, "cannot open mysql test database")
		require.NoError(t, admin.Exec("CREATE DATABASE `"+name+"` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci").Error)
		t.Cleanup(func() {
			assert.NoError(t, admin.Exec("DROP DATABASE `"+name+"`").Error)
			sqlDB, err := admin.DB()
			require.NoError(t, err)
			assert.NoError(t, sqlDB.Close())
		})
		parsed.DBName = name
		db, err = gorm.Open(mysql.Open(parsed.FormatDSN()), config)
	case "postgres", "postgresql":
		require.NotEmpty(t, dsn, "APP_PLUGIN_TEST_DSN is required")
		parsed, parseErr := pgx.ParseConfig(dsn)
		require.True(t, parseErr == nil, "invalid postgres test DSN")
		admin, openErr := gorm.Open(postgres.Open(dsn), config)
		require.True(t, openErr == nil, "cannot open postgres test database")
		require.NoError(t, admin.Exec(`CREATE SCHEMA "`+name+`"`).Error)
		t.Cleanup(func() {
			assert.NoError(t, admin.Exec(`DROP SCHEMA "`+name+`" CASCADE`).Error)
			sqlDB, err := admin.DB()
			require.NoError(t, err)
			assert.NoError(t, sqlDB.Close())
		})
		parsed.RuntimeParams["search_path"] = name
		connection := stdlib.OpenDB(*parsed)
		db, err = gorm.Open(postgres.New(postgres.Config{Conn: connection}), config)
	default:
		t.Fatalf("unsupported APP_PLUGIN_TEST_DIALECT %q", dialect)
	}
	require.True(t, err == nil, "cannot open app plugin test database")
	sqlDB, err := db.DB()
	require.NoError(t, err)
	t.Cleanup(func() { assert.NoError(t, sqlDB.Close()) })
	if os.Getenv("APP_PLUGIN_TEST_DIALECT") != "" {
		require.Equal(t, strings.ReplaceAll(dialect, "postgresql", "postgres"), db.Dialector.Name())
		var version string
		query := "SELECT version()"
		if dialect == "sqlite" {
			query = "SELECT sqlite_version()"
		}
		require.NoError(t, db.Raw(query).Scan(&version).Error)
		require.Equal(t, os.Getenv("APP_PLUGIN_TEST_DATABASE_VERSION"), version)
		require.NotEmpty(t, os.Getenv("APP_PLUGIN_TEST_DRIVER"))
		t.Logf("verified database=%s version=%s driver=%s", db.Dialector.Name(), version, os.Getenv("APP_PLUGIN_TEST_DRIVER"))
	}
	return db
}

func routerAppPluginRequest(engine http.Handler, method, path, token string, body []byte) *httptest.ResponseRecorder {
	return routerAppPluginRequestWithHeaders(engine, method, path, token, body, nil)
}

func routerAppPluginRateLimitIP(id uint32) string {
	return fmt.Sprintf("10.%d.%d.%d", byte(id>>16), byte(id>>8), byte(id))
}

func routerAppPluginRateLimitRequest(engine http.Handler, method, path, token, clientIP string) *httptest.ResponseRecorder {
	request := httptest.NewRequest(method, path, nil)
	request.RemoteAddr = clientIP + ":12345"
	request.Header.Set(common.RequestIdKey, "client-request-id-must-not-be-trusted")
	if token != "" {
		request.Header.Set("Authorization", "Bearer "+token)
	}
	response := httptest.NewRecorder()
	engine.ServeHTTP(response, request)
	return response
}

func routerAppPluginRequestWithHeaders(
	engine http.Handler,
	method string,
	path string,
	token string,
	body []byte,
	headers map[string]string,
) *httptest.ResponseRecorder {
	request := httptest.NewRequest(method, path, bytes.NewReader(body))
	request.Header.Set("Content-Type", "application/json")
	if token != "" {
		request.Header.Set("Authorization", "Bearer "+token)
	}
	for key, value := range headers {
		request.Header.Set(key, value)
	}
	response := httptest.NewRecorder()
	engine.ServeHTTP(response, request)
	return response
}

func setRouterAppPluginFlag(key string, enabled bool) {
	common.OptionMapRWMutex.Lock()
	defer common.OptionMapRWMutex.Unlock()
	if common.OptionMap == nil {
		common.OptionMap = map[string]string{}
	}
	common.OptionMap[key] = strconv.FormatBool(enabled)
	switch key {
	case operation_setting.AppPluginV1EnabledOptionKey:
		operation_setting.AppPluginV1Enabled = enabled
	case operation_setting.AppPluginSeedanceEnabledOptionKey:
		operation_setting.AppPluginSeedanceEnabled = enabled
	case operation_setting.AppPluginEmbeddedSurfaceEnabledOptionKey:
		operation_setting.AppPluginEmbeddedSurfaceEnabled = enabled
	case operation_setting.AppExecutionGrantsEnabledOptionKey:
		operation_setting.AppExecutionGrantsEnabled = enabled
	}
}

func routerAppPluginInstallBody(t *testing.T, key, version string) []byte {
	t.Helper()
	return routerAppPluginJSON(t, map[string]any{
		"manifest": map[string]any{
			"apiVersion":   1,
			"kind":         "app",
			"key":          key,
			"name":         map[string]string{"en": key, "zh": key},
			"version":      version,
			"callbackPath": "/auth/callback",
			"surfaces": map[string]any{
				"direct":   map[string]string{"startPath": "/auth/start"},
				"embedded": map[string]string{"startPath": "/auth/embed/start"},
			},
			"requestedScopes": []string{"identity.read", "task.read"},
			"requires": map[string]any{
				"taskPlugins": []map[string]string{{"key": "doubao", "minimumVersion": "1.2.0"}},
			},
		},
		"base_url":               "https://apps.example.com/" + key + "/",
		"enabled_surfaces":       []string{"direct", "embedded"},
		"allowed_parent_origins": []string{"https://console.example.com"},
		"allowed_origins":        []string{"https://client.example.com"},
		"allowed_user_policy":    map[string]any{"groups": []string{"default"}},
		"network_policy": map[string]any{
			"allow_hosts":            []string{"api.example.com"},
			"deny_private_ip_ranges": true,
		},
	})
}

func routerAppPluginPatchBody(t *testing.T, installationID string, revision int64, changes map[string]any) []byte {
	t.Helper()
	return routerAppPluginJSON(t, map[string]any{
		"installation_id": installationID,
		"revision":        revision,
		"changes":         changes,
	})
}

func routerAppPluginJSON(t *testing.T, value any) []byte {
	t.Helper()
	body, err := common.Marshal(value)
	require.NoError(t, err)
	return body
}

func routerAppPluginErrorCode(t *testing.T, response *httptest.ResponseRecorder) string {
	t.Helper()
	var envelope routerAppPluginEnvelope
	require.NoError(t, common.Unmarshal(response.Body.Bytes(), &envelope), response.Body.String())
	return envelope.Error.Code
}

func assertRouterAppPluginErrorEnvelope(
	t *testing.T,
	response *httptest.ResponseRecorder,
	status int,
	code string,
	message string,
	retryable bool,
) {
	t.Helper()
	require.Equal(t, status, response.Code, response.Body.String())
	requestID := response.Header().Get(common.RequestIdKey)
	require.NotEmpty(t, requestID)
	var actual map[string]any
	require.NoError(t, common.Unmarshal(response.Body.Bytes(), &actual), response.Body.String())
	assert.Equal(t, map[string]any{
		"error": map[string]any{
			"code":         code,
			"message":      message,
			"field_errors": []any{},
			"retryable":    retryable,
			"request_id":   requestID,
		},
	}, actual)
}

const routerExecutionPolicy = `{"operations":{"model.generate":{
	"models":[{"public_model":"doubao-seedance-2-5-260628","actual_model":"doubao-seedance-2-5-260628",
	"plugin_key":"doubao","plugin_version":"1.2.0","protocol":"openai_video"}],
	"strategies":["stable"],"conversion_policies":["strict"],"passthrough_rules":[]}}}`

type routerExecutionFixture struct {
	engine     *gin.Engine
	app        model.AppInstallation
	session    model.AppPluginSession
	root       service.AuthIdentity
	rootJWT    string
	userJWT    string
	rootPAT    string
	credential model.AppServiceCredentialIssued
}

type routerExecutionFaultConnPool struct {
	gorm.ConnPool
	beginErr      error
	commitErr     error
	commitBarrier *routerExecutionCommitBarrier
}

type routerExecutionCommitBarrier struct {
	blocked   atomic.Bool
	committed chan struct{}
	release   chan struct{}
}

func (pool *routerExecutionFaultConnPool) BeginTx(
	ctx context.Context,
	options *sql.TxOptions,
) (gorm.ConnPool, error) {
	if pool.beginErr != nil {
		return nil, pool.beginErr
	}
	beginner, ok := pool.ConnPool.(gorm.TxBeginner)
	if !ok {
		return nil, errors.New("test connection pool cannot begin transactions")
	}
	tx, err := beginner.BeginTx(ctx, options)
	if err != nil {
		return nil, err
	}
	return &routerExecutionFaultTx{
		Tx: tx, commitErr: pool.commitErr, commitBarrier: pool.commitBarrier,
	}, nil
}

type routerExecutionFaultTx struct {
	*sql.Tx
	commitErr     error
	commitBarrier *routerExecutionCommitBarrier
}

func (tx *routerExecutionFaultTx) Commit() error {
	if tx.commitErr != nil {
		_ = tx.Tx.Rollback()
		return tx.commitErr
	}
	if err := tx.Tx.Commit(); err != nil {
		return err
	}
	if tx.commitBarrier != nil && tx.commitBarrier.blocked.CompareAndSwap(false, true) {
		close(tx.commitBarrier.committed)
		<-tx.commitBarrier.release
	}
	return nil
}

func routerExecutionDBWithTransactionFault(
	db *gorm.DB,
	beginErr error,
	commitErr error,
) *gorm.DB {
	faultDB := db.Session(&gorm.Session{NewDB: true})
	faultDB.Statement.ConnPool = &routerExecutionFaultConnPool{
		ConnPool: db.Statement.ConnPool,
		beginErr: beginErr, commitErr: commitErr,
	}
	return faultDB
}

func routerExecutionDBWithCommitBarrier(
	db *gorm.DB,
	barrier *routerExecutionCommitBarrier,
) *gorm.DB {
	faultDB := db.Session(&gorm.Session{NewDB: true})
	faultDB.Statement.ConnPool = &routerExecutionFaultConnPool{
		ConnPool: db.Statement.ConnPool, commitBarrier: barrier,
	}
	return faultDB
}

func setupRouterExecutionTest(t *testing.T) *routerExecutionFixture {
	t.Helper()
	return setupRouterExecutionAppTest(t, "http-app")
}

func setupRouterExecutionAppTest(t *testing.T, appKey string) *routerExecutionFixture {
	t.Helper()
	base := setupRouterAppPluginTest(t)
	oldAddress, oldBatch := system_setting.ServerAddress, common.BatchUpdateEnabled
	oldCritical, oldGlobal := common.CriticalRateLimitEnable, common.GlobalApiRateLimitEnable
	oldGrant, oldSeedance, oldEmbedded := operation_setting.AppExecutionGrantsEnabled,
		operation_setting.AppPluginSeedanceEnabled, operation_setting.AppPluginEmbeddedSurfaceEnabled
	oldRegistry := jsplugin.DefaultRegistry
	common.OptionMapRWMutex.Lock()
	oldOptions := maps.Clone(common.OptionMap)
	if common.OptionMap == nil {
		common.OptionMap = make(map[string]string)
	}
	common.OptionMap[operation_setting.AppPluginV1EnabledOptionKey] = "true"
	common.OptionMap[operation_setting.AppPluginSeedanceEnabledOptionKey] = "true"
	common.OptionMap[operation_setting.AppPluginEmbeddedSurfaceEnabledOptionKey] = "true"
	common.OptionMap[operation_setting.AppExecutionGrantsEnabledOptionKey] = "true"
	operation_setting.AppPluginV1Enabled = true
	operation_setting.AppExecutionGrantsEnabled = true
	operation_setting.AppPluginSeedanceEnabled = true
	operation_setting.AppPluginEmbeddedSurfaceEnabled = true
	common.OptionMapRWMutex.Unlock()
	t.Cleanup(func() {
		system_setting.ServerAddress, common.BatchUpdateEnabled = oldAddress, oldBatch
		common.CriticalRateLimitEnable, common.GlobalApiRateLimitEnable = oldCritical, oldGlobal
		common.OptionMapRWMutex.Lock()
		operation_setting.AppExecutionGrantsEnabled = oldGrant
		operation_setting.AppPluginSeedanceEnabled, operation_setting.AppPluginEmbeddedSurfaceEnabled = oldSeedance, oldEmbedded
		common.OptionMap = oldOptions
		common.OptionMapRWMutex.Unlock()
		jsplugin.DefaultRegistry = oldRegistry
	})
	system_setting.ServerAddress = "https://console.example.com"
	common.BatchUpdateEnabled, common.CriticalRateLimitEnable, common.GlobalApiRateLimitEnable = false, false, false
	t.Setenv("APP_PLUGIN_LAUNCH_SECRET", strings.Repeat("offline-http-fixture-", 3))
	require.NoError(t, model.DB.AutoMigrate(&model.UserSession{}, &model.Option{}, &model.Channel{}, &model.Ability{},
		&model.UserSubscription{}, &model.SubscriptionPlan{}))
	require.NoError(t, model.MigrateAppPluginLaunchTables(model.DB))
	require.NoError(t, model.MigrateAppExecutionTables(model.DB))
	jsplugin.DefaultRegistry = jsplugin.NewRegistry()
	source, err := os.ReadFile("../plugins/tasks/doubao/plugin.js")
	require.NoError(t, err)
	_, err = jsplugin.DefaultRegistry.RegisterFactory(string(source), jsplugin.Options{Key: "doubao"})
	require.NoError(t, err)
	var installBody map[string]any
	require.NoError(t, common.Unmarshal(routerAppPluginInstallBody(t, appKey, "1.0.0"), &installBody))
	scopes := []string{"identity.read", "model.invoke", "task.read", "task.import"}
	manifest := installBody["manifest"].(map[string]any)
	manifest["requestedScopes"] = scopes
	manifest["surfaces"].(map[string]any)["embedded"] = map[string]string{"startPath": "/bootstrap/frame"}
	created := routerAppPluginRequestWithHeaders(base.engine, http.MethodPost, "/api/app_plugins/installations",
		base.rootToken, routerAppPluginJSON(t, installBody), map[string]string{"Idempotency-Key": "http-fixture"})
	require.Equal(t, http.StatusCreated, created.Code, created.Body.String())
	var envelope routerAppPluginEnvelope
	require.NoError(t, common.Unmarshal(created.Body.Bytes(), &envelope))
	app, err := model.CompareAndSwapAppInstallationStatus(t.Context(), model.DB, envelope.Data.InstallationID,
		envelope.Data.Revision, model.AppInstallationStatusEnabled)
	require.NoError(t, err)
	f := &routerExecutionFixture{app: app, rootPAT: base.rootToken}
	var user model.User
	require.NoError(t, model.DB.Where("username = ?", "app-plugin-user").First(&user).Error)
	require.NoError(t, model.DB.Model(&user).Update("quota", 1000000).Error)
	for _, root := range []bool{true, false} {
		actor := user
		if root {
			actor = model.User{}
			require.NoError(t, model.DB.Where("username = ?", "app-plugin-root").First(&actor).Error)
		}
		dashboard := model.UserSession{SID: uuid.NewString(), UserID: actor.Id, Version: 1, UserAuthVersion: 1,
			Status: model.UserSessionStatusActive, ExpiresAt: time.Now().Add(time.Hour).Unix(),
			RefreshHash: fmt.Sprintf("%x", sha256.Sum256([]byte("http-refresh-fixture")))}
		require.NoError(t, model.DB.Create(&dashboard).Error)
		identity := service.AuthIdentity{UserID: actor.Id, SessionID: dashboard.SID, UserAuthVersion: 1, SessionVersion: 1}
		token, _, err := service.IssueAccessToken(identity)
		require.NoError(t, err)
		if root {
			f.root, f.rootJWT = identity, token
		} else {
			f.userJWT = token
			f.session = model.AppPluginSession{AppSessionID: uuid.NewString(), InstallationID: app.InstallationID,
				AppKey: app.AppKey, Generation: app.AppVersionID, Issuer: system_setting.ServerAddress,
				Subject: fmt.Sprintf("user_%d", user.Id), UserID: user.Id, DashboardSessionID: dashboard.SID,
				AuthVersion: 1, SessionVersion: 1, GrantedScopes: scopes, UpstreamExpiresAt: dashboard.ExpiresAt}
			require.NoError(t, model.DB.Create(&f.session).Error)
		}
	}
	f.credential, err = model.IssueAppServiceCredential(t.Context(), model.DB, app.InstallationID,
		scopes, time.Now(), time.Now().Add(time.Hour), false)
	require.NoError(t, err)
	setting := `{"task_plugin_key":"doubao"}`
	channel := model.Channel{Type: constant.ChannelTypeDoubaoVideo, Name: "http-offline", Key: "offline-key",
		Setting: &setting, Status: common.ChannelStatusEnabled, Group: "default", Models: "doubao-seedance-2-5-260628"}
	require.NoError(t, model.DB.Create(&channel).Error)
	require.NoError(t, channel.AddAbilities(model.DB))
	require.NoError(t, model.DB.Create(&[]model.Option{
		{Key: "ModelPrice", Value: `{"doubao-seedance-2-5-260628":0.01}`},
		{Key: "UserUsableGroups", Value: `{"default":"Default"}`},
		{Key: "GroupRatio", Value: `{"default":1}`}, {Key: "AutoGroups", Value: `["default"]`},
		{Key: operation_setting.AppPluginV1EnabledOptionKey, Value: "true"},
		{Key: operation_setting.AppPluginSeedanceEnabledOptionKey, Value: "true"},
		{Key: operation_setting.AppPluginEmbeddedSurfaceEnabledOptionKey, Value: "true"},
		{Key: operation_setting.AppExecutionGrantsEnabledOptionKey, Value: "true"},
	}).Error)
	f.engine = gin.New()
	f.engine.Use(middleware.RequestId())
	SetApiRouter(f.engine)
	return f
}

func (f *routerExecutionFixture) call(t *testing.T, method, path, authorization, key string, body any) *httptest.ResponseRecorder {
	t.Helper()
	var raw []byte
	if body != nil {
		raw = routerAppPluginJSON(t, body)
	}
	return routerAppPluginRequestWithHeaders(f.engine, method, "https://console.example.com"+path, "", raw,
		map[string]string{"Authorization": authorization, "Idempotency-Key": key})
}

func (f *routerExecutionFixture) publish(t *testing.T) int64 {
	t.Helper()
	version, err := service.PublishAppModelInvokePolicy(t.Context(), model.DB, f.root, []byte(routerExecutionPolicy), time.Now())
	require.NoError(t, err)
	return version
}

func setupRouterTaskAppGrant(t *testing.T, protocol string) (*routerExecutionFixture, service.AppExecutionGrantResult) {
	t.Helper()
	return setupRouterTaskAppGrantWithBillingExpression(t, protocol, "")
}

func setupRouterTaskAppGrantWithBillingExpression(t *testing.T, protocol, expression string) (
	*routerExecutionFixture, service.AppExecutionGrantResult,
) {
	t.Helper()
	f := setupRouterExecutionTest(t)
	SetTaskPluginProtocolRouter(f.engine)
	SetTaskRouter(f.engine)
	require.NoError(t, model.DB.AutoMigrate(&model.Task{}, &model.SystemTask{}))
	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_, _ = io.WriteString(w, `{"id":"cgt-route-accepted"}`)
	}))
	t.Cleanup(upstream.Close)
	require.NoError(t, model.DB.Model(&model.Channel{}).Where("name = ?", "http-offline").
		Update("base_url", upstream.URL).Error)
	if expression != "" {
		require.NoError(t, model.DB.Model(&model.Option{}).
			Where(map[string]any{"key": "ModelPrice"}).Update("value", `{}`).Error)
		require.NoError(t, model.DB.Create(&[]model.Option{
			{
				Key:   "billing_setting.billing_mode",
				Value: `{"doubao-seedance-2-5-260628":"tiered_expr"}`,
			},
			{
				Key:   "billing_setting.billing_expr",
				Value: `{"doubao-seedance-2-5-260628":` + strconv.Quote(expression) + `}`,
			},
		}).Error)
	}
	policy := strings.Replace(routerExecutionPolicy, `"protocol":"openai_video"`,
		`"protocol":"`+protocol+`"`, 1)
	version, err := service.PublishAppModelInvokePolicy(
		t.Context(), model.DB, f.root, []byte(policy), time.Now(),
	)
	require.NoError(t, err)
	request := service.AppExecutionGrantRequest{
		RequestID: uuid.NewString(), AppKey: f.app.AppKey,
		AppSessionID: f.session.AppSessionID, Subject: f.session.Subject,
		RunID: uuid.NewString(), ExecutionRequestID: uuid.NewString(),
		Operation: "model.generate", ModelPolicyVersion: version,
		RequestedModels: []string{"doubao-seedance-2-5-260628"},
		Strategy:        "stable", ConversionPolicy: "strict",
		PassthroughSelections: []service.AppPassthroughSelection{},
	}
	response := f.call(t, http.MethodPost, "/internal/apps/v1/execution-grants",
		"AppService "+f.credential.Credential, "", request)
	require.Equal(t, http.StatusOK, response.Code, response.Body.String())
	var issued struct {
		Data service.AppExecutionGrantResult `json:"data"`
	}
	require.NoError(t, common.Unmarshal(response.Body.Bytes(), &issued))
	require.NotEmpty(t, issued.Data.GrantToken)
	return f, issued.Data
}

func routerTaskAppGrantBody(protocol string) []byte {
	if protocol == "openai_responses" {
		return []byte(`{"model":"doubao-seedance-2-5-260628","input":"hello","background":true}`)
	}
	return []byte(`{"model":"doubao-seedance-2-5-260628","prompt":"hello"}`)
}

func assertRouterPublicStorageError(t *testing.T, response *httptest.ResponseRecorder, privateDetail string) {
	t.Helper()
	require.Equal(t, http.StatusServiceUnavailable, response.Code, response.Body.String())
	assert.Contains(t, response.Body.String(), `"code":"service_unavailable"`)
	assert.Contains(t, response.Body.String(), `"retryable":true`)
	assert.NotContains(t, response.Body.String(), privateDetail)
}

func routerLaunchExchangeRequest(t *testing.T, f *routerExecutionFixture) service.AppPluginExchangeRequest {
	t.Helper()
	verifier := strings.Repeat("v", 43)
	challenge := sha256.Sum256([]byte(verifier))
	authorize := service.AppPluginAuthorizeRequest{
		Surface: "direct", TransactionID: uuid.NewString(),
		State: strings.Repeat("s", 42) + "A", Nonce: strings.Repeat("n", 42) + "A",
		CodeChallenge: base64.RawURLEncoding.EncodeToString(challenge[:]), CodeChallengeMethod: "S256",
	}
	response := routerAppPluginRequestWithHeaders(
		f.engine, http.MethodPost,
		"https://console.example.com/api/app_plugins/"+f.app.AppKey+"/authorize", "",
		routerAppPluginJSON(t, authorize),
		map[string]string{
			"Authorization":   "Bearer " + f.userJWT,
			"Origin":          "https://console.example.com",
			"Idempotency-Key": uuid.NewString(),
		},
	)
	require.Equal(t, http.StatusOK, response.Code, response.Body.String())
	var envelope struct {
		Data service.AppPluginAuthorizeResult `json:"data"`
	}
	require.NoError(t, common.Unmarshal(response.Body.Bytes(), &envelope))
	callback, err := url.Parse(envelope.Data.LaunchURL)
	require.NoError(t, err)
	require.NotEmpty(t, callback.Query().Get("code"))
	return service.AppPluginExchangeRequest{
		ExchangeRequestID: uuid.NewString(), AppKey: f.app.AppKey,
		Surface: authorize.Surface, TransactionID: authorize.TransactionID,
		Code: callback.Query().Get("code"), CodeVerifier: verifier,
		State: authorize.State, Nonce: authorize.Nonce,
	}
}

func expireRouterLaunchCode(t *testing.T, f *routerExecutionFixture, request *service.AppPluginExchangeRequest) {
	t.Helper()
	var code model.AppPluginLaunchCode
	require.NoError(t, model.DB.Where(
		"installation_id = ?", f.app.InstallationID,
	).First(&code).Error)
	var binding model.AppPluginLaunchBinding
	require.NoError(t, common.UnmarshalJsonStr(code.BindingJSON, &binding))
	binding.ExpiresAt = time.Now().Add(-time.Minute).UnixNano()
	raw, err := common.Marshal(binding)
	require.NoError(t, err)
	code.BindingJSON = string(raw)
	code.ExpiresAt = binding.ExpiresAt
	key := hmac.New(sha256.New, []byte(os.Getenv("APP_PLUGIN_LAUNCH_SECRET")))
	_, _ = key.Write([]byte("new-api/app-plugin/launch-key/v1"))
	mac := hmac.New(sha256.New, key.Sum(nil))
	_, _ = mac.Write([]byte(code.Salt))
	_, _ = mac.Write([]byte(code.BindingJSON))
	request.Code = base64.RawURLEncoding.EncodeToString(mac.Sum(nil))
	code.CodeHash = fmt.Sprintf("%x", sha256.Sum256([]byte(request.Code)))
	require.NoError(t, model.DB.Model(&code).Updates(map[string]any{
		"binding_json": code.BindingJSON,
		"code_hash":    code.CodeHash,
		"expires_at":   code.ExpiresAt,
	}).Error)
}

func registerRouterExecutionQueryFault(t *testing.T, table string, occurrence int32, privateDetail string) *atomic.Bool {
	t.Helper()
	return registerRouterExecutionDBFault(t, "query", table, occurrence, privateDetail)
}

func registerRouterGrantExpiryAtQuery(t *testing.T, occurrence int32) *atomic.Bool {
	t.Helper()
	var reads atomic.Int32
	var expired atomic.Bool
	callbackName := "test:router-app-execution-expiry:" + uuid.NewString()
	require.NoError(t, model.DB.Callback().Query().After("gorm:query").
		Register(callbackName, func(tx *gorm.DB) {
			if tx.Statement.Table != "app_execution_grants" || reads.Add(1) != occurrence {
				return
			}
			grant, ok := tx.Statement.Dest.(*model.AppExecutionGrant)
			if !ok {
				return
			}
			grant.ExpiresAt = time.Now().Add(-time.Minute).Unix()
			expired.Store(true)
		}))
	t.Cleanup(func() {
		require.NoError(t, model.DB.Callback().Query().Remove(callbackName))
	})
	return &expired
}

type routerGrantReadBarrier struct {
	reached     chan struct{}
	release     chan struct{}
	releaseOnce sync.Once
}

func (b *routerGrantReadBarrier) unblock() {
	b.releaseOnce.Do(func() {
		close(b.release)
	})
}

func registerRouterGrantReadBarrier(t *testing.T, occurrence int32) *routerGrantReadBarrier {
	t.Helper()
	var reads atomic.Int32
	barrier := &routerGrantReadBarrier{
		reached: make(chan struct{}),
		release: make(chan struct{}),
	}
	callbackName := "test:router-grant-read-barrier:" + uuid.NewString()
	require.NoError(t, model.DB.Callback().Query().Before("gorm:query").
		Register(callbackName, func(tx *gorm.DB) {
			if tx.Statement.Table != "app_execution_grants" || reads.Add(1) != occurrence {
				return
			}
			close(barrier.reached)
			<-barrier.release
		}))
	t.Cleanup(func() {
		barrier.unblock()
		require.NoError(t, model.DB.Callback().Query().Remove(callbackName))
	})
	return barrier
}

func registerRouterExecutionDBFault(t *testing.T, operation, table string, occurrence int32,
	privateDetail string,
) *atomic.Bool {
	t.Helper()
	var reads atomic.Int32
	var failed atomic.Bool
	callbackName := "test:router-app-execution-storage:" + uuid.NewString()
	inject := func(tx *gorm.DB) {
		if tx.Statement.Table == table && reads.Add(1) == occurrence {
			failed.Store(true)
			tx.AddError(errors.New(privateDetail))
		}
	}
	switch operation {
	case "query":
		require.NoError(t, model.DB.Callback().Query().Before("gorm:query").Register(callbackName, inject))
		t.Cleanup(func() { require.NoError(t, model.DB.Callback().Query().Remove(callbackName)) })
	case "create":
		require.NoError(t, model.DB.Callback().Create().Before("gorm:create").Register(callbackName, inject))
		t.Cleanup(func() { require.NoError(t, model.DB.Callback().Create().Remove(callbackName)) })
	case "update":
		require.NoError(t, model.DB.Callback().Update().Before("gorm:update").Register(callbackName, inject))
		t.Cleanup(func() { require.NoError(t, model.DB.Callback().Update().Remove(callbackName)) })
	default:
		t.Fatalf("unsupported router storage fault operation %q", operation)
	}
	return &failed
}

func TestAppPluginLifecycleRoutesPreserveStorageFailures(t *testing.T) {
	tests := []struct {
		name       string
		table      string
		occurrence int32
		path       string
		key        string
		body       func(*testing.T, *routerExecutionFixture) any
	}{
		{
			name: "launch code exchange query", table: "app_plugin_launch_codes", occurrence: 1,
			path: "/internal/apps/v1/launch-codes/exchange",
			body: func(t *testing.T, f *routerExecutionFixture) any {
				return routerLaunchExchangeRequest(t, f)
			},
		},
		{
			name: "session introspection query", table: "app_plugin_sessions", occurrence: 1,
			path: "/internal/apps/v1/sessions/introspect",
			body: func(_ *testing.T, f *routerExecutionFixture) any {
				return service.AppPluginIntrospectRequest{
					AppKey: f.app.AppKey, AppSessionID: f.session.AppSessionID, Subject: f.session.Subject,
					RequiredScopes: []string{}, RequiredEntitlements: model.AppJSONMap{},
				}
			},
		},
		{
			name: "session introspection credential query", table: "app_service_credentials", occurrence: 4,
			path: "/internal/apps/v1/sessions/introspect",
			body: func(_ *testing.T, f *routerExecutionFixture) any {
				return service.AppPluginIntrospectRequest{
					AppKey: f.app.AppKey, AppSessionID: f.session.AppSessionID, Subject: f.session.Subject,
					RequiredScopes: []string{}, RequiredEntitlements: model.AppJSONMap{},
				}
			},
		},
		{
			name: "session introspection credential binding query", table: "app_service_credential_bindings", occurrence: 2,
			path: "/internal/apps/v1/sessions/introspect",
			body: func(_ *testing.T, f *routerExecutionFixture) any {
				return service.AppPluginIntrospectRequest{
					AppKey: f.app.AppKey, AppSessionID: f.session.AppSessionID, Subject: f.session.Subject,
					RequiredScopes: []string{}, RequiredEntitlements: model.AppJSONMap{},
				}
			},
		},
		{
			name: "session revoke installation query", table: "app_installations", occurrence: 2,
			path: "/internal/apps/v1/sessions/revoke", key: "revoke-installation-fault",
			body: func(_ *testing.T, f *routerExecutionFixture) any {
				return service.AppPluginSessionRevokeRequest{
					RequestID: uuid.NewString(), AppKey: f.app.AppKey,
					AppSessionID: f.session.AppSessionID, Subject: f.session.Subject, Reason: "user_logout",
				}
			},
		},
		{
			name: "session revoke query", table: "app_plugin_sessions", occurrence: 1,
			path: "/internal/apps/v1/sessions/revoke", key: "revoke-session-fault",
			body: func(_ *testing.T, f *routerExecutionFixture) any {
				return service.AppPluginSessionRevokeRequest{
					RequestID: uuid.NewString(), AppKey: f.app.AppKey,
					AppSessionID: f.session.AppSessionID, Subject: f.session.Subject, Reason: "user_logout",
				}
			},
		},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			f := setupRouterExecutionTest(t)
			body := test.body(t, f)
			privateDetail := "private " + test.name + " storage detail"
			failed := registerRouterExecutionQueryFault(t, test.table, test.occurrence, privateDetail)

			response := f.call(t, http.MethodPost, test.path,
				"AppService "+f.credential.Credential, test.key, body)

			require.True(t, failed.Load(), "the intended lifecycle query must be exercised")
			assertRouterPublicStorageError(t, response, privateDetail)
		})
	}
}

func TestAppPluginLaunchContextRouteMapsRegistrationAbsenceToNotFound(t *testing.T) {
	for _, resource := range []string{"current app version", "callback claim"} {
		t.Run(resource, func(t *testing.T) {
			f := setupRouterExecutionTest(t)
			switch resource {
			case "current app version":
				require.NoError(t, model.DB.Where("id = ?", f.app.AppVersionID).
					Delete(&model.AppVersion{}).Error)
			case "callback claim":
				require.NoError(t, model.DB.Where(
					"installation_id = ? AND kind = ?",
					f.app.InstallationID, "callback",
				).Delete(&model.AppRouteClaim{}).Error)
			}

			response := routerAppPluginRequestWithHeaders(
				f.engine, http.MethodGet,
				"https://console.example.com/api/app_plugins/"+f.app.AppKey+"/launch-context?surface=direct",
				"", nil, map[string]string{"Authorization": "Bearer " + f.userJWT},
			)

			assertRouterAppPluginErrorEnvelope(
				t, response, http.StatusNotFound,
				"not_found", "App plugin not found", false,
			)
			assert.NotContains(t, response.Body.String(), `"detail"`)
			assert.NotContains(t, response.Body.String(), "service_unavailable")
		})
	}
}

func TestAppPluginLaunchContextRoutePreservesRegistrationStorageFailures(t *testing.T) {
	for _, resource := range []struct {
		name       string
		table      string
		occurrence int32
	}{
		{name: "current app version", table: "app_versions", occurrence: 1},
		{name: "callback claim", table: "app_route_claims", occurrence: 2},
	} {
		t.Run(resource.name, func(t *testing.T) {
			f := setupRouterExecutionTest(t)
			privateDetail := "private registration " + resource.name + " route detail"
			failed := registerRouterExecutionQueryFault(
				t, resource.table, resource.occurrence, privateDetail,
			)

			response := routerAppPluginRequestWithHeaders(
				f.engine, http.MethodGet,
				"https://console.example.com/api/app_plugins/"+f.app.AppKey+"/launch-context?surface=direct",
				"", nil, map[string]string{"Authorization": "Bearer " + f.userJWT},
			)

			require.True(t, failed.Load(), "the actual route must execute the registration query")
			assertRouterPublicStorageError(t, response, privateDetail)
		})
	}
}

func TestAppPluginLifecycleRoutesKeepBusinessFailuresNonRetryable(t *testing.T) {
	t.Run("missing session", func(t *testing.T) {
		f := setupRouterExecutionTest(t)
		response := f.call(t, http.MethodPost, "/internal/apps/v1/sessions/introspect",
			"AppService "+f.credential.Credential, "", service.AppPluginIntrospectRequest{
				AppKey: f.app.AppKey, AppSessionID: "missing-session", Subject: f.session.Subject,
				RequiredScopes: []string{}, RequiredEntitlements: model.AppJSONMap{},
			})
		assertRouterAppPluginErrorEnvelope(t, response, http.StatusNotFound,
			"not_found", "App plugin not found", false)
	})

	t.Run("expired launch code", func(t *testing.T) {
		f := setupRouterExecutionTest(t)
		request := routerLaunchExchangeRequest(t, f)
		expireRouterLaunchCode(t, f, &request)

		response := f.call(t, http.MethodPost, "/internal/apps/v1/launch-codes/exchange",
			"AppService "+f.credential.Credential, "", request)

		assertRouterAppPluginErrorEnvelope(t, response, http.StatusUnauthorized,
			"launch_code_expired", "Launch code expired", false)
	})

	t.Run("tampered launch code expiry", func(t *testing.T) {
		f := setupRouterExecutionTest(t)
		request := routerLaunchExchangeRequest(t, f)
		require.NoError(t, model.DB.Model(&model.AppPluginLaunchCode{}).
			Where("installation_id = ?", f.app.InstallationID).
			Update("expires_at", time.Now().Add(-time.Minute).UnixNano()).Error)

		response := f.call(t, http.MethodPost, "/internal/apps/v1/launch-codes/exchange",
			"AppService "+f.credential.Credential, "", request)

		assertRouterAppPluginErrorEnvelope(t, response, http.StatusNotFound,
			"not_found", "App plugin not found", false)
	})

	t.Run("disabled installation", func(t *testing.T) {
		f := setupRouterExecutionTest(t)
		request := routerLaunchExchangeRequest(t, f)
		require.NoError(t, model.DB.Model(&model.AppInstallation{}).
			Where("installation_id = ?", f.app.InstallationID).
			Update("status", model.AppInstallationStatusDisabled).Error)

		response := f.call(t, http.MethodPost, "/internal/apps/v1/launch-codes/exchange",
			"AppService "+f.credential.Credential, "", request)

		assertRouterAppPluginErrorEnvelope(t, response, http.StatusForbidden,
			"app_plugin_disabled", "App plugin API is disabled", false)
	})

	t.Run("revoked service credential", func(t *testing.T) {
		f := setupRouterExecutionTest(t)
		require.NoError(t, model.DB.Model(&model.AppServiceCredential{}).
			Where("credential_id = ?", f.credential.CredentialID).
			Update("status", "revoked").Error)

		response := f.call(t, http.MethodPost, "/internal/apps/v1/sessions/introspect",
			"AppService "+f.credential.Credential, "", service.AppPluginIntrospectRequest{
				AppKey: f.app.AppKey, AppSessionID: f.session.AppSessionID, Subject: f.session.Subject,
				RequiredScopes: []string{}, RequiredEntitlements: model.AppJSONMap{},
			})

		assertRouterAppPluginErrorEnvelope(t, response, http.StatusUnauthorized,
			"service_identity_invalid", "App service request denied", false)
	})
}

func TestAppPluginExchangeReplayRequiresCurrentRegistration(t *testing.T) {
	for _, resource := range []string{"current app version", "callback claim", "callback claim key case"} {
		t.Run(resource, func(t *testing.T) {
			f := setupRouterExecutionTest(t)
			request := routerLaunchExchangeRequest(t, f)
			first := f.call(t, http.MethodPost, "/internal/apps/v1/launch-codes/exchange",
				"AppService "+f.credential.Credential, "", request)
			require.Equal(t, http.StatusOK, first.Code, first.Body.String())

			switch resource {
			case "current app version":
				require.NoError(t, model.DB.Where("id = ?", f.app.AppVersionID).
					Delete(&model.AppVersion{}).Error)
			case "callback claim":
				require.NoError(t, model.DB.Where(
					"installation_id = ? AND kind = ?",
					f.app.InstallationID, "callback",
				).Delete(&model.AppRouteClaim{}).Error)
			case "callback claim key case":
				var claim model.AppRouteClaim
				require.NoError(t, model.DB.Where(
					"installation_id = ? AND kind = ?",
					f.app.InstallationID, "callback",
				).First(&claim).Error)
				alias := strings.ToUpper(claim.ClaimKey)
				require.NotEqual(t, claim.ClaimKey, alias)
				require.NoError(t, model.DB.Model(&model.AppRouteClaim{}).Where("id = ?", claim.ID).
					UpdateColumn("claim_key", alias).Error)
			}

			replay := f.call(t, http.MethodPost, "/internal/apps/v1/launch-codes/exchange",
				"AppService "+f.credential.Credential, "", request)

			assertRouterAppPluginErrorEnvelope(t, replay, http.StatusNotFound,
				"not_found", "App plugin not found", false)
		})
	}
}

func TestAppPluginExchangeDifferentRequestRejectsTamperedLaunchSession(t *testing.T) {
	f := setupRouterExecutionTest(t)
	request := routerLaunchExchangeRequest(t, f)
	first := f.call(t, http.MethodPost, "/internal/apps/v1/launch-codes/exchange",
		"AppService "+f.credential.Credential, "", request)
	require.Equal(t, http.StatusOK, first.Code, first.Body.String())
	var envelope struct {
		Data service.AppPluginExchangeResult `json:"data"`
	}
	require.NoError(t, common.Unmarshal(first.Body.Bytes(), &envelope))
	require.NotEqual(t, envelope.Data.AppSessionID, f.session.AppSessionID)
	require.NoError(t, model.DB.Model(&model.AppPluginLaunchCode{}).Where(
		"installation_id = ?", f.app.InstallationID,
	).Update("app_session_id", f.session.AppSessionID).Error)

	second := request
	second.ExchangeRequestID = uuid.NewString()
	response := f.call(t, http.MethodPost, "/internal/apps/v1/launch-codes/exchange",
		"AppService "+f.credential.Credential, "", second)

	assertRouterAppPluginErrorEnvelope(t, response, http.StatusNotFound,
		"not_found", "App plugin not found", false)
	for _, sessionID := range []string{envelope.Data.AppSessionID, f.session.AppSessionID} {
		var session model.AppPluginSession
		require.NoError(t, model.DB.Where("app_session_id = ?", sessionID).First(&session).Error)
		assert.Zero(t, session.RevokedAt)
	}
}

func TestAppPluginExchangeReplayRegistrationFaultIsRetryable(t *testing.T) {
	for _, resource := range []struct {
		name       string
		table      string
		occurrence int32
	}{
		{name: "current app version", table: "app_versions", occurrence: 1},
		{name: "callback claim", table: "app_route_claims", occurrence: 2},
	} {
		t.Run(resource.name, func(t *testing.T) {
			f := setupRouterExecutionTest(t)
			request := routerLaunchExchangeRequest(t, f)
			first := f.call(t, http.MethodPost, "/internal/apps/v1/launch-codes/exchange",
				"AppService "+f.credential.Credential, "", request)
			require.Equal(t, http.StatusOK, first.Code, first.Body.String())
			privateDetail := "private exchange replay registration " + resource.name + " detail"
			failed := registerRouterExecutionQueryFault(
				t, resource.table, resource.occurrence, privateDetail,
			)

			replay := f.call(t, http.MethodPost, "/internal/apps/v1/launch-codes/exchange",
				"AppService "+f.credential.Credential, "", request)

			require.True(t, failed.Load(), "replay must execute the current registration query")
			assertRouterPublicStorageError(t, replay, privateDetail)
		})
	}
}

func TestAppPluginExchangeReplayRejectsValidGenerationUpgrade(t *testing.T) {
	f := setupRouterExecutionTest(t)
	request := routerLaunchExchangeRequest(t, f)
	first := f.call(t, http.MethodPost, "/internal/apps/v1/launch-codes/exchange",
		"AppService "+f.credential.Credential, "", request)
	require.Equal(t, http.StatusOK, first.Code, first.Body.String())

	upgrade := routerAppPluginRequestWithHeaders(
		f.engine, http.MethodPost,
		"https://console.example.com/api/app_plugins/installations", "",
		routerAppPluginInstallBody(t, f.app.AppKey, "2.0.0"),
		map[string]string{
			"Authorization":   "Bearer " + f.rootPAT,
			"Idempotency-Key": "http-fixture-v2",
		},
	)
	require.Equal(t, http.StatusCreated, upgrade.Code, upgrade.Body.String())
	var upgraded routerAppPluginEnvelope
	require.NoError(t, common.Unmarshal(upgrade.Body.Bytes(), &upgraded))
	require.Equal(t, f.app.InstallationID, upgraded.Data.InstallationID)
	require.Equal(t, "2.0.0", upgraded.Data.ManifestVersion)
	require.NotEqual(t, f.app.AppVersionID, upgraded.Data.AppVersionID)
	var callback model.AppRouteClaim
	require.NoError(t, model.DB.Where(
		"installation_id = ? AND kind = ?", f.app.InstallationID, "callback",
	).First(&callback).Error)
	require.Equal(t, "https://apps.example.com/"+f.app.AppKey+"/auth/callback",
		callback.AbsoluteEndpoint)
	enabled, err := model.CompareAndSwapAppInstallationStatus(
		t.Context(), model.DB, f.app.InstallationID, upgraded.Data.Revision,
		model.AppInstallationStatusEnabled,
	)
	require.NoError(t, err)
	require.Equal(t, model.AppInstallationStatusEnabled, enabled.Status)

	replay := f.call(t, http.MethodPost, "/internal/apps/v1/launch-codes/exchange",
		"AppService "+f.credential.Credential, "", request)

	assertRouterAppPluginErrorEnvelope(t, replay, http.StatusNotFound,
		"not_found", "App plugin not found", false)
}

func TestAppPluginExchangeReplayOriginalLaunchBindingFaultIsRetryable(t *testing.T) {
	f := setupRouterExecutionTest(t)
	request := routerLaunchExchangeRequest(t, f)
	first := f.call(t, http.MethodPost, "/internal/apps/v1/launch-codes/exchange",
		"AppService "+f.credential.Credential, "", request)
	require.Equal(t, http.StatusOK, first.Code, first.Body.String())
	privateDetail := "private original launch binding route detail"
	failed := registerRouterExecutionQueryFault(
		t, "app_plugin_launch_codes", 1, privateDetail,
	)

	replay := f.call(t, http.MethodPost, "/internal/apps/v1/launch-codes/exchange",
		"AppService "+f.credential.Credential, "", request)

	require.True(t, failed.Load(), "replay must reload the original launch binding")
	assertRouterPublicStorageError(t, replay, privateDetail)
}

func TestAppPluginExchangeReplayRequiresOriginalLaunchBinding(t *testing.T) {
	for _, test := range []struct {
		name   string
		mutate func(*testing.T, string)
	}{
		{
			name: "missing launch code",
			mutate: func(t *testing.T, installationID string) {
				t.Helper()
				require.NoError(t, model.DB.Where(
					"installation_id = ?", installationID,
				).Delete(&model.AppPluginLaunchCode{}).Error)
			},
		},
		{
			name: "launch code session mismatch",
			mutate: func(t *testing.T, installationID string) {
				t.Helper()
				require.NoError(t, model.DB.Model(&model.AppPluginLaunchCode{}).Where(
					"installation_id = ?", installationID,
				).Update("app_session_id", "different-session").Error)
			},
		},
		{
			name: "malformed binding",
			mutate: func(t *testing.T, installationID string) {
				t.Helper()
				require.NoError(t, model.DB.Model(&model.AppPluginLaunchCode{}).Where(
					"installation_id = ?", installationID,
				).Update("binding_json", "{").Error)
			},
		},
	} {
		t.Run(test.name, func(t *testing.T) {
			f := setupRouterExecutionTest(t)
			request := routerLaunchExchangeRequest(t, f)
			first := f.call(t, http.MethodPost, "/internal/apps/v1/launch-codes/exchange",
				"AppService "+f.credential.Credential, "", request)
			require.Equal(t, http.StatusOK, first.Code, first.Body.String())
			test.mutate(t, f.app.InstallationID)

			replay := f.call(t, http.MethodPost, "/internal/apps/v1/launch-codes/exchange",
				"AppService "+f.credential.Credential, "", request)

			assertRouterAppPluginErrorEnvelope(t, replay, http.StatusNotFound,
				"not_found", "App plugin not found", false)
		})
	}
}

func TestAppPluginExchangeReplayRejectsPersistedIntegrityTampering(t *testing.T) {
	for _, test := range []struct {
		name   string
		mutate func(*testing.T, *routerExecutionFixture)
	}{
		{
			name: "launch binding surface",
			mutate: func(t *testing.T, f *routerExecutionFixture) {
				t.Helper()
				var code model.AppPluginLaunchCode
				require.NoError(t, model.DB.Where(
					"installation_id = ?", f.app.InstallationID,
				).First(&code).Error)
				var binding model.AppPluginLaunchBinding
				require.NoError(t, common.UnmarshalJsonStr(code.BindingJSON, &binding))
				binding.Surface = "embedded"
				raw, err := common.Marshal(binding)
				require.NoError(t, err)
				require.NoError(t, model.DB.Model(&code).
					Update("binding_json", string(raw)).Error)
			},
		},
		{
			name: "cached entitlement version",
			mutate: func(t *testing.T, f *routerExecutionFixture) {
				t.Helper()
				var replay model.AppPluginExchangeReplay
				require.NoError(t, model.DB.Where(
					"installation_id = ?", f.app.InstallationID,
				).First(&replay).Error)
				var result service.AppPluginExchangeResult
				require.NoError(t, common.UnmarshalJsonStr(replay.ResponseJSON, &result))
				result.EntitlementVersion = "tampered-version"
				raw, err := common.Marshal(result)
				require.NoError(t, err)
				require.NoError(t, model.DB.Model(&replay).
					Update("response_json", string(raw)).Error)
			},
		},
	} {
		t.Run(test.name, func(t *testing.T) {
			f := setupRouterExecutionTest(t)
			request := routerLaunchExchangeRequest(t, f)
			first := f.call(t, http.MethodPost, "/internal/apps/v1/launch-codes/exchange",
				"AppService "+f.credential.Credential, "", request)
			require.Equal(t, http.StatusOK, first.Code, first.Body.String())
			test.mutate(t, f)

			replay := f.call(t, http.MethodPost, "/internal/apps/v1/launch-codes/exchange",
				"AppService "+f.credential.Credential, "", request)

			assertRouterAppPluginErrorEnvelope(t, replay, http.StatusNotFound,
				"not_found", "App plugin not found", false)
		})
	}
}

func TestAppPluginExchangeReplayStorageFaultsAreRetryable(t *testing.T) {
	t.Run("response query", func(t *testing.T) {
		f := setupRouterExecutionTest(t)
		request := routerLaunchExchangeRequest(t, f)
		first := f.call(t, http.MethodPost, "/internal/apps/v1/launch-codes/exchange",
			"AppService "+f.credential.Credential, "", request)
		require.Equal(t, http.StatusOK, first.Code, first.Body.String())
		privateDetail := "private cached response query detail"
		failed := registerRouterExecutionDBFault(
			t, "query", "app_plugin_exchange_replays", 1, privateDetail,
		)

		replay := f.call(t, http.MethodPost, "/internal/apps/v1/launch-codes/exchange",
			"AppService "+f.credential.Credential, "", request)

		require.True(t, failed.Load())
		assertRouterPublicStorageError(t, replay, privateDetail)
	})

	for _, test := range []struct {
		name  string
		table string
	}{
		{name: "session write", table: "app_plugin_sessions"},
		{name: "response write", table: "app_plugin_exchange_replays"},
	} {
		t.Run(test.name, func(t *testing.T) {
			f := setupRouterExecutionTest(t)
			request := routerLaunchExchangeRequest(t, f)
			privateDetail := "private " + test.name + " detail"
			failed := registerRouterExecutionDBFault(
				t, "create", test.table, 1, privateDetail,
			)

			response := f.call(t, http.MethodPost, "/internal/apps/v1/launch-codes/exchange",
				"AppService "+f.credential.Credential, "", request)

			require.True(t, failed.Load())
			assertRouterPublicStorageError(t, response, privateDetail)
		})
	}
}

func TestAppPluginExchangeReplayRequiresPersistedSession(t *testing.T) {
	for _, test := range []struct {
		name   string
		mutate func(*testing.T, service.AppPluginExchangeResult)
	}{
		{
			name: "missing session",
			mutate: func(t *testing.T, original service.AppPluginExchangeResult) {
				t.Helper()
				require.NoError(t, model.DB.Where(
					"app_session_id = ?", original.AppSessionID,
				).Delete(&model.AppPluginSession{}).Error)
			},
		},
		{
			name: "mismatched session",
			mutate: func(t *testing.T, original service.AppPluginExchangeResult) {
				t.Helper()
				require.NoError(t, model.DB.Model(&model.AppPluginSession{}).Where(
					"app_session_id = ?", original.AppSessionID,
				).Update("subject", "user_999999").Error)
			},
		},
	} {
		t.Run(test.name, func(t *testing.T) {
			f := setupRouterExecutionTest(t)
			request := routerLaunchExchangeRequest(t, f)
			first := f.call(t, http.MethodPost, "/internal/apps/v1/launch-codes/exchange",
				"AppService "+f.credential.Credential, "", request)
			require.Equal(t, http.StatusOK, first.Code, first.Body.String())
			var envelope struct {
				Data service.AppPluginExchangeResult `json:"data"`
			}
			require.NoError(t, common.Unmarshal(first.Body.Bytes(), &envelope))
			test.mutate(t, envelope.Data)

			replay := f.call(t, http.MethodPost, "/internal/apps/v1/launch-codes/exchange",
				"AppService "+f.credential.Credential, "", request)

			assertRouterAppPluginErrorEnvelope(t, replay, http.StatusNotFound,
				"not_found", "App plugin not found", false)
		})
	}
}

func TestAppPluginExchangeReplayPersistedSessionFaultIsRetryable(t *testing.T) {
	f := setupRouterExecutionTest(t)
	request := routerLaunchExchangeRequest(t, f)
	first := f.call(t, http.MethodPost, "/internal/apps/v1/launch-codes/exchange",
		"AppService "+f.credential.Credential, "", request)
	require.Equal(t, http.StatusOK, first.Code, first.Body.String())
	privateDetail := "private exchange replay persisted session detail"
	failed := registerRouterExecutionQueryFault(
		t, "app_plugin_sessions", 1, privateDetail,
	)

	replay := f.call(t, http.MethodPost, "/internal/apps/v1/launch-codes/exchange",
		"AppService "+f.credential.Credential, "", request)

	require.True(t, failed.Load(), "replay must reload the persisted session")
	assertRouterPublicStorageError(t, replay, privateDetail)
}

func TestAppExecutionControlHTTPContracts(t *testing.T) {
	f := setupRouterExecutionTest(t)
	version := f.publish(t)
	request := service.AppExecutionGrantRequest{RequestID: uuid.NewString(), AppKey: f.app.AppKey,
		AppSessionID: f.session.AppSessionID, Subject: f.session.Subject, RunID: uuid.NewString(),
		ExecutionRequestID: uuid.NewString(), Operation: "model.generate", ModelPolicyVersion: version,
		RequestedModels: []string{"doubao-seedance-2-5-260628"}, Strategy: "stable", ConversionPolicy: "strict",
		PassthroughSelections: []service.AppPassthroughSelection{}}
	auth := "AppService " + f.credential.Credential
	grantResponse := f.call(t, http.MethodPost, "/internal/apps/v1/execution-grants", auth, "", request)
	require.Equal(t, http.StatusOK, grantResponse.Code, "real grant route must accept a current service")
	var grant struct {
		Data service.AppExecutionGrantResult `json:"data"`
	}
	require.NoError(t, common.Unmarshal(grantResponse.Body.Bytes(), &grant))
	require.True(t, grant.Data.GrantToken != "")
	assert.Equal(t, "no-store", grantResponse.Header().Get("Cache-Control"))
	assert.Equal(t, "no-referrer", grantResponse.Header().Get("Referrer-Policy"))
	stale := request
	stale.RequestID, stale.ModelPolicyVersion = uuid.NewString(), version+1
	response := f.call(t, http.MethodPost, "/internal/apps/v1/execution-grants", auth, "", stale)
	require.Equal(t, http.StatusConflict, response.Code)
	assert.Equal(t, "version_conflict", routerAppPluginErrorCode(t, response))
	denied := request
	denied.RequestID, denied.RequestedModels = uuid.NewString(), []string{"unapproved"}
	response = f.call(t, http.MethodPost, "/internal/apps/v1/execution-grants", auth, "", denied)
	require.Equal(t, http.StatusForbidden, response.Code)
	assert.Equal(t, "model_policy_denied", routerAppPluginErrorCode(t, response))
	task := model.AppTaskExecution{TaskID: "http-task", GrantID: grant.Data.GrantID, LogicalHash: "http-logical",
		AppKey: f.app.AppKey, InstallationID: f.app.InstallationID, AppSessionID: f.session.AppSessionID,
		Subject: f.session.Subject, UserID: f.session.UserID, RunID: request.RunID, ExecutionRequestID: request.ExecutionRequestID,
		Operation: request.Operation, ProviderAccepted: true, Status: "accepted", ProviderState: "running",
		ActualModel: request.RequestedModels[0], PluginKey: "doubao", PluginVersion: "1.2.0", UpdatedAt: time.Now().Unix()}
	require.NoError(t, model.DB.Create(&task).Error)
	lookup := map[string]any{"request_id": uuid.NewString(), "app_key": f.app.AppKey,
		"app_session_id": f.session.AppSessionID, "subject": f.session.Subject, "task_id": task.TaskID, "grant_id": nil}
	require.NoError(t, model.DB.Model(&model.AppServiceCredentialBinding{}).Where("credential_id = ?", f.credential.CredentialID).
		Update("scopes", `["task.read"]`).Error)
	response = f.call(t, http.MethodPost, "/internal/apps/v1/tasks/lookup", auth, "", lookup)
	require.Equal(t, http.StatusOK, response.Code, response.Body.String())
	var facts struct {
		Data map[string]any `json:"data"`
	}
	require.NoError(t, common.Unmarshal(response.Body.Bytes(), &facts))
	assert.Len(t, facts.Data, 13)
	assert.Equal(t, "running", facts.Data["status"])
	t.Run("task lookup storage failure is retryable", func(t *testing.T) {
		const privateDetail = "private task lookup storage detail"
		var failed atomic.Bool
		callbackName := "test:task-lookup-route-storage-failure:" + uuid.NewString()
		require.NoError(t, model.DB.Callback().Query().Before("gorm:query").
			Register(callbackName, func(tx *gorm.DB) {
				if tx.Statement.Table == "app_installations" && failed.CompareAndSwap(false, true) {
					tx.AddError(errors.New(privateDetail))
				}
			}))
		defer func() {
			require.NoError(t, model.DB.Callback().Query().Remove(callbackName))
		}()

		failedResponse := f.call(t, http.MethodPost, "/internal/apps/v1/tasks/lookup", auth, "", lookup)

		require.True(t, failed.Load(), "the route must execute the installation query")
		assertRouterAppPluginErrorEnvelope(t, failedResponse, http.StatusServiceUnavailable,
			"service_unavailable", "App service request denied", true)
		assert.NotContains(t, failedResponse.Body.String(), privateDetail)
	})
	delete(lookup, "grant_id")
	response = f.call(t, http.MethodPost, "/internal/apps/v1/tasks/lookup", auth, "", lookup)
	assert.Equal(t, http.StatusBadRequest, response.Code)
	lookup["grant_id"] = nil
	cancel := service.AppTaskCancelRequest{RequestID: uuid.NewString(), AppKey: f.app.AppKey,
		AppSessionID: f.session.AppSessionID, Subject: f.session.Subject, TaskID: task.TaskID, Reason: "user_requested"}
	response = f.call(t, http.MethodPost, "/internal/apps/v1/tasks/cancel", auth, "cancel-http", cancel)
	assert.Equal(t, http.StatusForbidden, response.Code)
	require.NoError(t, model.DB.Model(&model.AppServiceCredentialBinding{}).Where("credential_id = ?", f.credential.CredentialID).
		Update("scopes", `["task.read","model.invoke"]`).Error)
	first := f.call(t, http.MethodPost, "/internal/apps/v1/tasks/cancel", auth, "cancel-http", cancel)
	require.Equal(t, http.StatusOK, first.Code, first.Body.String())
	again := f.call(t, http.MethodPost, "/internal/apps/v1/tasks/cancel", auth, "cancel-http", cancel)
	assert.JSONEq(t, first.Body.String(), again.Body.String())
	assert.Contains(t, first.Body.String(), `"state":"not_cancellable"`)
	assert.Contains(t, first.Body.String(), `"cancelled_at":null`)
	cancel.Reason = "changed"
	assert.Equal(t, http.StatusConflict, f.call(t, http.MethodPost, "/internal/apps/v1/tasks/cancel", auth, "cancel-http", cancel).Code)
	assert.Equal(t, http.StatusBadRequest, f.call(t, http.MethodPost, "/internal/apps/v1/tasks/cancel", auth, "", cancel).Code)
	require.NoError(t, model.DB.Model(&model.AppServiceCredentialBinding{}).Where("credential_id = ?", f.credential.CredentialID).
		Update("scopes", `["task.import"]`).Error)
	_, err := service.PublishAppArkImportDelegations(t.Context(), model.DB, f.root, routerAppPluginJSON(t,
		service.AppArkImportDelegations{Delegations: []service.AppArkImportDelegation{{InstallationID: f.app.InstallationID,
			UserID: f.session.UserID, AccountRef: "host-account", ProjectID: "project",
			StartAt: time.Now().Add(-time.Hour), EndAt: time.Now().Add(time.Hour)}}}), time.Now())
	require.NoError(t, err)
	ark := service.AppArkImportLookupRequest{RequestID: uuid.NewString(), AppKey: f.app.AppKey,
		AppSessionID: f.session.AppSessionID, Subject: f.session.Subject, TaskID: "cgt-old",
		QueryScope: service.AppArkQueryScope{ProjectID: "project", StartAt: time.Now().Add(-time.Minute), EndAt: time.Now()}}
	response = f.call(t, http.MethodPost, "/internal/apps/v1/imports/ark-task-lookup", auth, "", ark)
	assert.Equal(t, http.StatusServiceUnavailable, response.Code, "unconfigured live source fails closed")
	assert.Equal(t, "service_unavailable", routerAppPluginErrorCode(t, response))
	for _, path := range []string{"/internal/apps/v1/execution-grants", "/internal/apps/v1/tasks/lookup",
		"/internal/apps/v1/tasks/cancel", "/internal/apps/v1/imports/ark-task-lookup"} {
		assert.Equal(t, http.StatusUnauthorized, f.call(t, http.MethodPost, path, "Bearer "+f.rootJWT, "", lookup).Code)
	}
	var after model.AppTaskExecution
	require.NoError(t, model.DB.First(&after, task.ID).Error)
	assert.Equal(t, task, after)
	for _, table := range []any{&model.AppTaskSettlement{}, &model.AppTaskOutbox{}} {
		var count int64
		require.NoError(t, model.DB.Model(table).Count(&count).Error)
		assert.Zero(t, count)
	}

	t.Run("internal evidence error uses the public vocabulary", func(t *testing.T) {
		require.NoError(t, model.DB.Model(&model.AppServiceCredentialBinding{}).Where("credential_id = ?", f.credential.CredentialID).
			Update("scopes", `["task.read"]`).Error)
		require.NoError(t, model.DB.Model(&task).Update("provider_state", "unrecognized").Error)
		response := f.call(t, http.MethodPost, "/internal/apps/v1/tasks/lookup", auth, "", lookup)
		assertRouterAppPluginErrorEnvelope(t, response, http.StatusServiceUnavailable,
			"service_unavailable", "App plugin request failed", true)
	})

	t.Run("internal funding error uses the public vocabulary", func(t *testing.T) {
		require.NoError(t, model.DB.Model(&model.AppServiceCredentialBinding{}).Where("credential_id = ?", f.credential.CredentialID).
			Update("scopes", `["model.invoke"]`).Error)
		common.BatchUpdateEnabled = true
		defer func() { common.BatchUpdateEnabled = false }()
		request.RequestID = uuid.NewString()
		response := f.call(t, http.MethodPost, "/internal/apps/v1/execution-grants", auth, "", request)
		assertRouterAppPluginErrorEnvelope(t, response, http.StatusServiceUnavailable,
			"service_unavailable", "App plugin request failed", true)
	})
}

func TestAppTaskControlRoutesMapTransactionBoundaryFailuresToServiceUnavailable(t *testing.T) {
	operations := []struct {
		name string
		path string
		key  string
		body func(*routerExecutionFixture, model.AppTaskExecution) any
	}{
		{
			name: "lookup",
			path: "/internal/apps/v1/tasks/lookup",
			body: func(f *routerExecutionFixture, task model.AppTaskExecution) any {
				return service.AppTaskLookupRequest{
					RequestID: uuid.NewString(), AppKey: f.app.AppKey,
					AppSessionID: f.session.AppSessionID, Subject: f.session.Subject,
					TaskID: &task.TaskID,
				}
			},
		},
		{
			name: "cancel",
			path: "/internal/apps/v1/tasks/cancel",
			key:  "task-control-boundary",
			body: func(f *routerExecutionFixture, task model.AppTaskExecution) any {
				return service.AppTaskCancelRequest{
					RequestID: uuid.NewString(), AppKey: f.app.AppKey,
					AppSessionID: f.session.AppSessionID, Subject: f.session.Subject,
					TaskID: task.TaskID, Reason: "user_requested",
				}
			},
		},
	}
	boundaries := []struct {
		name      string
		beginErr  error
		commitErr error
	}{
		{name: "begin", beginErr: errors.New("private task control route begin detail")},
		{name: "commit", commitErr: errors.New("private task control route commit detail")},
	}
	for _, operation := range operations {
		for _, boundary := range boundaries {
			t.Run(operation.name+"/"+boundary.name, func(t *testing.T) {
				f := setupRouterExecutionTest(t)
				version := f.publish(t)
				grantRequest := service.AppExecutionGrantRequest{
					RequestID: uuid.NewString(), AppKey: f.app.AppKey,
					AppSessionID: f.session.AppSessionID, Subject: f.session.Subject,
					RunID: uuid.NewString(), ExecutionRequestID: uuid.NewString(),
					Operation: "model.generate", ModelPolicyVersion: version,
					RequestedModels: []string{"doubao-seedance-2-5-260628"},
					Strategy:        "stable", ConversionPolicy: "strict",
					PassthroughSelections: []service.AppPassthroughSelection{},
				}
				auth := "AppService " + f.credential.Credential
				grantResponse := f.call(
					t, http.MethodPost, "/internal/apps/v1/execution-grants",
					auth, "", grantRequest,
				)
				require.Equal(t, http.StatusOK, grantResponse.Code, grantResponse.Body.String())
				var grant struct {
					Data service.AppExecutionGrantResult `json:"data"`
				}
				require.NoError(t, common.Unmarshal(grantResponse.Body.Bytes(), &grant))
				task := model.AppTaskExecution{
					TaskID: "task-control-boundary", GrantID: grant.Data.GrantID,
					LogicalHash: "task-control-boundary-logical", AppKey: f.app.AppKey,
					InstallationID: f.app.InstallationID,
					AppSessionID:   f.session.AppSessionID, Subject: f.session.Subject,
					UserID: f.session.UserID, RunID: grantRequest.RunID,
					ExecutionRequestID: grantRequest.ExecutionRequestID,
					Operation:          grantRequest.Operation, ProviderAccepted: true,
					Status: "accepted", ProviderState: "running",
					ActualModel: grantRequest.RequestedModels[0],
					PluginKey:   "doubao", PluginVersion: "1.2.0",
					UpdatedAt: time.Now().Unix(),
				}
				require.NoError(t, model.DB.Create(&task).Error)
				scopes := `["task.read"]`
				if operation.name == "cancel" {
					scopes = `["task.read","model.invoke"]`
				}
				require.NoError(t, model.DB.Model(&model.AppServiceCredentialBinding{}).
					Where("credential_id = ?", f.credential.CredentialID).
					Update("scopes", scopes).Error)
				currentDB := model.DB
				model.DB = routerExecutionDBWithTransactionFault(
					model.DB, boundary.beginErr, boundary.commitErr,
				)
				t.Cleanup(func() { model.DB = currentDB })

				response := f.call(
					t, http.MethodPost, operation.path, auth, operation.key,
					operation.body(f, task),
				)

				privateDetail := boundary.beginErr
				if privateDetail == nil {
					privateDetail = boundary.commitErr
				}
				assertRouterAppPluginErrorEnvelope(
					t, response, http.StatusServiceUnavailable,
					"service_unavailable", "App service request denied", true,
				)
				assert.NotContains(t, response.Body.String(), privateDetail.Error())
			})
		}
	}
}

func setupRouterArkImportRequest(
	t *testing.T,
	project string,
) (*routerExecutionFixture, string, service.AppArkImportLookupRequest) {
	t.Helper()
	f := setupRouterExecutionTest(t)
	require.NoError(t, model.DB.Model(&model.AppServiceCredentialBinding{}).
		Where("credential_id = ?", f.credential.CredentialID).
		Update("scopes", `["task.import"]`).Error)
	start, end := time.Now().Add(-time.Hour), time.Now()
	delegations := service.AppArkImportDelegations{Delegations: []service.AppArkImportDelegation{{
		InstallationID: f.app.InstallationID,
		UserID:         f.session.UserID,
		AccountRef:     "host-account",
		ProjectID:      project,
		StartAt:        start,
		EndAt:          end.Add(time.Minute),
	}}}
	_, err := service.PublishAppArkImportDelegations(
		t.Context(), model.DB, f.root, routerAppPluginJSON(t, delegations), time.Now(),
	)
	require.NoError(t, err)
	request := service.AppArkImportLookupRequest{
		RequestID: uuid.NewString(), AppKey: f.app.AppKey,
		AppSessionID: f.session.AppSessionID, Subject: f.session.Subject,
		TaskID: "cgt-route-import",
		QueryScope: service.AppArkQueryScope{
			ProjectID: "project", StartAt: start, EndAt: end,
		},
	}
	return f, "AppService " + f.credential.Credential, request
}

func TestAppArkImportRoutePreservesStorageFailuresAndBusinessControls(t *testing.T) {
	const path = "/internal/apps/v1/imports/ark-task-lookup"
	t.Run("initial policy query failure", func(t *testing.T) {
		f, auth, request := setupRouterArkImportRequest(t, "project")
		const privateDetail = "private Ark route policy query detail"
		failed := registerRouterExecutionQueryFault(t, "options", 1, privateDetail)

		response := f.call(t, http.MethodPost, path, auth, "", request)

		require.True(t, failed.Load(), "the actual route must execute the policy query")
		assertRouterAppPluginErrorEnvelope(t, response, http.StatusServiceUnavailable,
			"service_unavailable", "App plugin request failed", true)
		assert.NotContains(t, response.Body.String(), privateDetail)
	})

	for _, boundary := range []struct {
		name      string
		beginErr  error
		commitErr error
	}{
		{name: "begin failure", beginErr: errors.New("private Ark route begin detail")},
		{name: "commit failure", commitErr: errors.New("private Ark route commit detail")},
	} {
		t.Run(boundary.name, func(t *testing.T) {
			f, auth, request := setupRouterArkImportRequest(t, "project")
			currentDB := model.DB
			model.DB = routerExecutionDBWithTransactionFault(
				model.DB, boundary.beginErr, boundary.commitErr,
			)
			t.Cleanup(func() { model.DB = currentDB })

			response := f.call(t, http.MethodPost, path, auth, "", request)

			privateDetail := boundary.beginErr
			if privateDetail == nil {
				privateDetail = boundary.commitErr
			}
			assertRouterAppPluginErrorEnvelope(t, response, http.StatusServiceUnavailable,
				"service_unavailable", "App service request denied", true)
			assert.NotContains(t, response.Body.String(), privateDetail.Error())
		})
	}

	t.Run("missing policy", func(t *testing.T) {
		f, auth, request := setupRouterArkImportRequest(t, "project")
		require.NoError(t, model.DB.Where(
			"policy_key = ?", model.AppArkImportDelegationsKey,
		).Delete(&model.AppExecutionPolicyVersion{}).Error)

		response := f.call(t, http.MethodPost, path, auth, "", request)

		assertRouterAppPluginErrorEnvelope(t, response, http.StatusNotFound,
			"not_found", "App plugin not found", false)
	})

	t.Run("scope denied", func(t *testing.T) {
		f, auth, request := setupRouterArkImportRequest(t, "other-project")

		response := f.call(t, http.MethodPost, path, auth, "", request)

		assertRouterAppPluginErrorEnvelope(t, response, http.StatusForbidden,
			"scope_denied", "App permission denied", false)
	})
}

func TestAppExecutionHTTPRolloutGates(t *testing.T) {
	f := setupRouterExecutionAppTest(t, "seedance-repro")
	request := service.AppExecutionGrantRequest{RequestID: uuid.NewString(), AppKey: f.app.AppKey,
		AppSessionID: f.session.AppSessionID, Subject: f.session.Subject, RunID: uuid.NewString(),
		ExecutionRequestID: uuid.NewString(), Operation: "model.generate", ModelPolicyVersion: f.publish(t),
		RequestedModels: []string{"doubao-seedance-2-5-260628"}, Strategy: "stable", ConversionPolicy: "strict",
		PassthroughSelections: []service.AppPassthroughSelection{}}
	auth := "AppService " + f.credential.Credential
	response := f.call(t, http.MethodPost, "/internal/apps/v1/execution-grants", auth, "", request)
	require.Equal(t, http.StatusOK, response.Code)
	var grant struct {
		Data service.AppExecutionGrantResult `json:"data"`
	}
	require.NoError(t, common.Unmarshal(response.Body.Bytes(), &grant))
	task := model.AppTaskExecution{TaskID: "rollout-task", GrantID: grant.Data.GrantID, LogicalHash: "rollout-logical",
		AppKey: f.app.AppKey, InstallationID: f.app.InstallationID, AppSessionID: f.session.AppSessionID,
		Subject: f.session.Subject, UserID: f.session.UserID, RunID: request.RunID, ExecutionRequestID: request.ExecutionRequestID,
		Operation: request.Operation, ProviderAccepted: true, Status: "accepted", ProviderState: "running",
		ActualModel: request.RequestedModels[0], PluginKey: "doubao", PluginVersion: "1.2.0", UpdatedAt: time.Now().Unix()}
	require.NoError(t, model.DB.Create(&task).Error)
	lookup := map[string]any{"request_id": uuid.NewString(), "app_key": f.app.AppKey,
		"app_session_id": f.session.AppSessionID, "subject": f.session.Subject, "task_id": task.TaskID, "grant_id": nil}
	cancel := service.AppTaskCancelRequest{RequestID: uuid.NewString(), AppKey: f.app.AppKey,
		AppSessionID: f.session.AppSessionID, Subject: f.session.Subject, TaskID: task.TaskID, Reason: "user_requested"}
	introspect := service.AppPluginIntrospectRequest{AppKey: f.app.AppKey, AppSessionID: f.session.AppSessionID,
		Subject: f.session.Subject, RequiredScopes: []string{}, RequiredEntitlements: model.AppJSONMap{}}
	for _, test := range []struct {
		name, key, code string
	}{
		{"execution", operation_setting.AppExecutionGrantsEnabledOptionKey, "app_execution_disabled"},
		{"seedance", operation_setting.AppPluginSeedanceEnabledOptionKey, "app_plugin_disabled"},
		{"app_plugin", operation_setting.AppPluginV1EnabledOptionKey, "app_plugin_disabled"},
	} {
		t.Run(test.name, func(t *testing.T) {
			setRouterAppPluginFlag(test.key, false)
			defer setRouterAppPluginFlag(test.key, true)
			request.RequestID = uuid.NewString()
			response := f.call(t, http.MethodPost, "/internal/apps/v1/execution-grants", auth, "", request)
			assert.Equal(t, http.StatusForbidden, response.Code, "closed rollout gate must reject new grants")
			if response.Code != http.StatusOK {
				assert.Equal(t, test.code, routerAppPluginErrorCode(t, response))
			}
			assert.Equal(t, http.StatusForbidden,
				f.call(t, http.MethodPost, "/internal/apps/v1/tasks/cancel", auth, "rollout-cancel", cancel).Code)
			response = f.call(t, http.MethodPost, "/internal/apps/v1/tasks/lookup", auth, "", lookup)
			assert.Equal(t, http.StatusOK, response.Code, "closed rollout gate must preserve accepted Task facts")
			assert.Equal(t, http.StatusUnauthorized,
				f.call(t, http.MethodPost, "/internal/apps/v1/tasks/lookup", "Bearer "+f.userJWT, "", lookup).Code)
			response = f.call(t, http.MethodPost, "/internal/apps/v1/sessions/introspect", auth, "", introspect)
			assert.Equal(t, http.StatusOK, response.Code)
			assert.Empty(t, response.Header().Get("X-App-Model-Policy-Version"))
		})
	}
	for _, test := range []struct {
		name     string
		key      string
		surfaces []string
	}{
		{"seedance", operation_setting.AppPluginSeedanceEnabledOptionKey, []string{"direct", "embedded"}},
		{"embedded", operation_setting.AppPluginEmbeddedSurfaceEnabledOptionKey, []string{"embedded"}},
	} {
		t.Run("navigation_"+test.name, func(t *testing.T) {
			setRouterAppPluginFlag(test.key, false)
			defer setRouterAppPluginFlag(test.key, true)
			response := f.call(t, http.MethodGet, "/api/app_plugins", "Bearer "+f.userJWT, "", nil)
			require.Equal(t, http.StatusOK, response.Code)
			var navigation struct {
				Data []struct {
					Key      string   `json:"key"`
					Surfaces []string `json:"enabled_surfaces"`
				} `json:"data"`
			}
			require.NoError(t, common.Unmarshal(response.Body.Bytes(), &navigation))
			if test.name == "seedance" {
				assert.Empty(t, navigation.Data, "disabled Seedance must not be advertised")
			} else {
				require.Len(t, navigation.Data, 1)
				assert.Equal(t, []string{"direct"}, navigation.Data[0].Surfaces)
				assert.Equal(t, http.StatusOK, f.call(t, http.MethodGet,
					"/api/app_plugins/seedance-repro/launch-context?surface=direct", "Bearer "+f.userJWT, "", nil).Code)
			}
			for _, surface := range test.surfaces {
				response = f.call(t, http.MethodGet, "/api/app_plugins/seedance-repro/launch-context?surface="+surface,
					"Bearer "+f.userJWT, "", nil)
				assert.Equal(t, http.StatusForbidden, response.Code, "closed surface gate must reject launch context")
				authorize := service.AppPluginAuthorizeRequest{Surface: surface, TransactionID: uuid.NewString(),
					State: strings.Repeat("s", 42) + "A", Nonce: strings.Repeat("n", 42) + "A",
					CodeChallenge: strings.Repeat("c", 42) + "A", CodeChallengeMethod: "S256"}
				response = routerAppPluginRequestWithHeaders(f.engine, http.MethodPost,
					"https://console.example.com/api/app_plugins/seedance-repro/authorize", "",
					routerAppPluginJSON(t, authorize), map[string]string{"Authorization": "Bearer " + f.userJWT,
						"Origin": "https://console.example.com", "Idempotency-Key": uuid.NewString()})
				assert.Equal(t, http.StatusForbidden, response.Code, "authorize must not bypass closed surface gate")
				if test.name == "seedance" && surface == "direct" {
					response = routerAppPluginRequestWithHeaders(f.engine, http.MethodPost,
						"https://console.example.com/api/app_plugins/SEEDANCE-REPRO/authorize", "",
						routerAppPluginJSON(t, authorize), map[string]string{"Authorization": "Bearer " + f.userJWT,
							"Origin": "https://console.example.com", "Idempotency-Key": uuid.NewString()})
					assert.Equal(t, http.StatusNotFound, response.Code, "authorize requires case-sensitive App identity")
				}
			}
		})
	}
	var after model.AppTaskExecution
	require.NoError(t, model.DB.First(&after, task.ID).Error)
	assert.Equal(t, task, after)
	for _, test := range []struct {
		table any
		count int64
	}{
		{&model.AppExecutionGrant{}, 1}, {&model.AppTaskExecution{}, 1},
		{&model.AppPluginLaunchCode{}, 0}, {&model.AppTaskCancelReplay{}, 0},
		{&model.AppTaskSettlement{}, 0}, {&model.AppTaskOutbox{}, 0},
	} {
		var count int64
		require.NoError(t, model.DB.Model(test.table).Count(&count).Error)
		assert.Equal(t, test.count, count, "closed rollout gates must not create side effects")
	}
	t.Run("session invalidation remains available", func(t *testing.T) {
		setRouterAppPluginFlag(operation_setting.AppPluginV1EnabledOptionKey, false)
		defer setRouterAppPluginFlag(operation_setting.AppPluginV1EnabledOptionKey, true)
		revoke := service.AppPluginSessionRevokeRequest{RequestID: uuid.NewString(), AppKey: f.app.AppKey,
			AppSessionID: f.session.AppSessionID, Subject: f.session.Subject, Reason: "user_logout"}
		response := f.call(t, http.MethodPost, "/internal/apps/v1/sessions/revoke", auth, "stop-session", revoke)
		require.Equal(t, http.StatusOK, response.Code)
		assert.Contains(t, response.Body.String(), `"state":"revoked"`)
		response = f.call(t, http.MethodPost, "/internal/apps/v1/tasks/lookup", auth, "", lookup)
		assert.Equal(t, http.StatusUnauthorized, response.Code, "retained reads still require an unrevoked App session")
	})
}

func routerResponseDuringRolloutCommitWindow(
	t *testing.T,
	invoke func() *httptest.ResponseRecorder,
) *httptest.ResponseRecorder {
	t.Helper()
	previousDB := model.DB
	barrier := &routerExecutionCommitBarrier{
		committed: make(chan struct{}),
		release:   make(chan struct{}),
	}
	model.DB = routerExecutionDBWithCommitBarrier(model.DB, barrier)
	released := false
	t.Cleanup(func() {
		if !released {
			close(barrier.release)
		}
		model.DB = previousDB
	})
	writerDone := make(chan error, 1)
	go func() {
		writerDone <- model.UpdateOption(
			operation_setting.AppExecutionGrantsEnabledOptionKey, "false",
		)
	}()
	select {
	case <-barrier.committed:
	case <-time.After(5 * time.Second):
		t.Fatal("rollout writer did not commit before cache publication")
	}

	response := invoke()

	close(barrier.release)
	released = true
	require.NoError(t, <-writerDone)
	model.DB = previousDB
	return response
}

func TestAppExecutionRoutesUseDatabaseTruthDuringRolloutCachePublication(t *testing.T) {
	t.Run("internal grant", func(t *testing.T) {
		f := setupRouterExecutionTest(t)
		request := service.AppExecutionGrantRequest{
			RequestID: uuid.NewString(), AppKey: f.app.AppKey,
			AppSessionID: f.session.AppSessionID, Subject: f.session.Subject,
			RunID: uuid.NewString(), ExecutionRequestID: uuid.NewString(),
			Operation: "model.generate", ModelPolicyVersion: f.publish(t),
			RequestedModels: []string{"doubao-seedance-2-5-260628"},
			Strategy:        "stable", ConversionPolicy: "strict",
			PassthroughSelections: []service.AppPassthroughSelection{},
		}

		response := routerResponseDuringRolloutCommitWindow(t, func() *httptest.ResponseRecorder {
			return f.call(
				t, http.MethodPost, "/internal/apps/v1/execution-grants",
				"AppService "+f.credential.Credential, "", request,
			)
		})

		assertRouterAppPluginErrorEnvelope(
			t, response, http.StatusForbidden,
			"app_execution_disabled", "App execution is disabled", false,
		)
	})

	for _, protocol := range []string{"openai_responses", "openai_video"} {
		t.Run("public "+protocol, func(t *testing.T) {
			f, issued := setupRouterTaskAppGrant(t, protocol)
			path := "/v1/videos"
			if protocol == "openai_responses" {
				path = "/v1/responses"
			}

			response := routerResponseDuringRolloutCommitWindow(t, func() *httptest.ResponseRecorder {
				return routerAppPluginRequestWithHeaders(
					f.engine, http.MethodPost, "https://console.example.com"+path, "",
					routerTaskAppGrantBody(protocol),
					map[string]string{"Authorization": "AppGrant " + issued.GrantToken},
				)
			})

			assertRouterAppPluginErrorEnvelope(
				t, response, http.StatusForbidden,
				"app_execution_disabled", "App service request denied", false,
			)
		})
	}
}

func TestAppPluginRolloutCachePublicationIsRaceFree(t *testing.T) {
	f := setupRouterExecutionAppTest(t, "seedance-repro")
	common.OptionMapRWMutex.Lock()
	previousOptions := maps.Clone(common.OptionMap)
	previousFlags := [4]bool{
		operation_setting.AppPluginV1Enabled,
		operation_setting.AppPluginSeedanceEnabled,
		operation_setting.AppPluginEmbeddedSurfaceEnabled,
		operation_setting.AppExecutionGrantsEnabled,
	}
	common.OptionMap = maps.Clone(common.OptionMap)
	common.OptionMapRWMutex.Unlock()
	t.Cleanup(func() {
		common.OptionMapRWMutex.Lock()
		common.OptionMap = previousOptions
		operation_setting.AppPluginV1Enabled = previousFlags[0]
		operation_setting.AppPluginSeedanceEnabled = previousFlags[1]
		operation_setting.AppPluginEmbeddedSurfaceEnabled = previousFlags[2]
		operation_setting.AppExecutionGrantsEnabled = previousFlags[3]
		common.OptionMapRWMutex.Unlock()
	})

	start := make(chan struct{})
	writerDone := make(chan struct{})
	go func() {
		defer close(writerDone)
		<-start
		for i := range 200 {
			enabled := i%2 == 0
			value := strconv.FormatBool(enabled)
			common.OptionMapRWMutex.Lock()
			operation_setting.AppPluginV1Enabled = enabled
			operation_setting.AppPluginSeedanceEnabled = enabled
			operation_setting.AppPluginEmbeddedSurfaceEnabled = enabled
			operation_setting.AppExecutionGrantsEnabled = enabled
			common.OptionMap[operation_setting.AppPluginV1EnabledOptionKey] = value
			common.OptionMap[operation_setting.AppPluginSeedanceEnabledOptionKey] = value
			common.OptionMap[operation_setting.AppPluginEmbeddedSurfaceEnabledOptionKey] = value
			common.OptionMap[operation_setting.AppExecutionGrantsEnabledOptionKey] = value
			common.OptionMapRWMutex.Unlock()
		}
	}()

	close(start)
	for range 200 {
		_ = f.call(t, http.MethodGet, "/api/app_plugins", "Bearer "+f.userJWT, "", nil)
		_ = f.call(
			t, http.MethodPost, "/internal/apps/v1/execution-grants",
			"AppService "+f.credential.Credential, "", map[string]any{},
		)
	}
	<-writerDone
}

func TestAppGrantTaskBackedRoutesPreserveStorageErrorTaxonomy(t *testing.T) {
	for _, protocol := range []string{"openai_responses", "openai_video"} {
		path := "/v1/videos"
		if protocol == "openai_responses" {
			path = "/v1/responses"
		}
		for _, failure := range []struct {
			name       string
			operation  string
			table      string
			occurrence int32
		}{
			{name: "passthrough", operation: "query", table: "app_execution_grants", occurrence: 5},
			{name: "billing inputs", operation: "query", table: "app_execution_grants", occurrence: 6},
			{name: "claim grant", operation: "query", table: "app_execution_grants", occurrence: 9},
			{name: "claim", operation: "query", table: "app_task_executions", occurrence: 1},
			{name: "funding read", operation: "query", table: "users", occurrence: 4},
			{name: "funding write", operation: "update", table: "users", occurrence: 1},
			{name: "claim create", operation: "create", table: "app_task_executions", occurrence: 1},
			{name: "acceptance", operation: "query", table: "app_task_executions", occurrence: 2},
			{name: "projection", operation: "query", table: "tasks", occurrence: 1},
		} {
			t.Run(protocol+"/"+failure.name, func(t *testing.T) {
				f, issued := setupRouterTaskAppGrant(t, protocol)
				privateDetail := "private " + protocol + " " + failure.name + " storage detail"
				failed := registerRouterExecutionDBFault(
					t, failure.operation, failure.table, failure.occurrence, privateDetail,
				)

				response := routerAppPluginRequestWithHeaders(
					f.engine, http.MethodPost, "https://console.example.com"+path, "",
					routerTaskAppGrantBody(protocol),
					map[string]string{"Authorization": "AppGrant " + issued.GrantToken},
				)

				require.True(t, failed.Load(), "the intended public route boundary must be exercised")
				assertRouterPublicStorageError(t, response, privateDetail)
			})
		}
	}
}

func TestAppGrantTaskBackedRoutesTreatBillingGrantDisappearanceAsInvalidGrant(t *testing.T) {
	for _, protocol := range []string{"openai_responses", "openai_video"} {
		t.Run(protocol, func(t *testing.T) {
			f, issued := setupRouterTaskAppGrant(t, protocol)
			path := "/v1/videos"
			if protocol == "openai_responses" {
				path = "/v1/responses"
			}
			barrier := registerRouterGrantReadBarrier(t, 6)
			request := httptest.NewRequest(
				http.MethodPost,
				"https://console.example.com"+path,
				bytes.NewReader(routerTaskAppGrantBody(protocol)),
			)
			request.Header.Set("Content-Type", "application/json")
			request.Header.Set("Authorization", "AppGrant "+issued.GrantToken)
			response := httptest.NewRecorder()
			done := make(chan struct{})
			go func() {
				defer close(done)
				f.engine.ServeHTTP(response, request)
			}()
			select {
			case <-barrier.reached:
			case <-time.After(5 * time.Second):
				t.Fatal("request did not reach the billing grant reread")
			}
			require.NoError(t, model.DB.Where("grant_id = ?", issued.GrantID).
				Delete(&model.AppExecutionGrant{}).Error)
			barrier.unblock()
			select {
			case <-done:
			case <-time.After(5 * time.Second):
				t.Fatal("request did not finish after deleting the billing grant")
			}

			require.Equal(t, http.StatusUnauthorized, response.Code, response.Body.String())
			assert.Contains(t, response.Body.String(), `"code":"invalid_grant"`)
			assert.Contains(t, response.Body.String(), `"retryable":false`)
			assert.NotContains(t, response.Body.String(), `"detail"`)
			assert.NotContains(t, response.Body.String(), "service_unavailable")
		})
	}
}

func TestAppGrantTaskBackedRoutesPreserveClaimBusinessErrors(t *testing.T) {
	for _, protocol := range []string{"openai_responses", "openai_video"} {
		path := "/v1/videos"
		if protocol == "openai_responses" {
			path = "/v1/responses"
		}
		t.Run(protocol+"/insufficient quota", func(t *testing.T) {
			f, issued := setupRouterTaskAppGrant(t, protocol)
			require.NoError(t, model.DB.Model(&model.User{}).
				Where("id = ?", f.session.UserID).Update("quota", 0).Error)

			response := routerAppPluginRequestWithHeaders(
				f.engine, http.MethodPost, "https://console.example.com"+path, "",
				routerTaskAppGrantBody(protocol),
				map[string]string{"Authorization": "AppGrant " + issued.GrantToken},
			)

			require.Equal(t, http.StatusPaymentRequired, response.Code, response.Body.String())
			assert.Contains(t, response.Body.String(), `"code":"insufficient_quota"`)
			assert.Contains(t, response.Body.String(), `"retryable":false`)
		})

		t.Run(protocol+"/expired at claim", func(t *testing.T) {
			f, issued := setupRouterTaskAppGrant(t, protocol)
			expired := registerRouterGrantExpiryAtQuery(t, 9)

			response := routerAppPluginRequestWithHeaders(
				f.engine, http.MethodPost, "https://console.example.com"+path, "",
				routerTaskAppGrantBody(protocol),
				map[string]string{"Authorization": "AppGrant " + issued.GrantToken},
			)

			require.True(t, expired.Load(), "grant must expire at the durable claim read")
			require.Equal(t, http.StatusUnauthorized, response.Code, response.Body.String())
			assert.Contains(t, response.Body.String(), `"code":"execution_grant_expired"`)
			assert.Contains(t, response.Body.String(), `"retryable":false`)
		})
	}
}

func TestAppGrantTaskBackedRoutesKeepInvalidPriceInputsNonretryable(t *testing.T) {
	const expression = `v1:tier("base", u("tokens") * 9.8 / 1000000) * ` +
		`(header("x-service-tier") == "fast" ? 2 : 1)`
	for _, protocol := range []string{"openai_responses", "openai_video"} {
		t.Run(protocol, func(t *testing.T) {
			f, issued := setupRouterTaskAppGrantWithBillingExpression(t, protocol, expression)
			path := "/v1/videos"
			wantCode := "invalid_price_inputs"
			if protocol == "openai_responses" {
				path = "/v1/responses"
				wantCode = "invalid_request_error"
			}
			request := httptest.NewRequest(
				http.MethodPost,
				"https://console.example.com"+path,
				bytes.NewReader(routerTaskAppGrantBody(protocol)),
			)
			request.Header.Set("Content-Type", "application/json")
			request.Header.Set("Authorization", "AppGrant "+issued.GrantToken)
			request.Header["X-Service-Tier"] = []string{"fast", "slow"}
			response := httptest.NewRecorder()

			f.engine.ServeHTTP(response, request)

			require.Equal(t, http.StatusBadRequest, response.Code, response.Body.String())
			assert.Contains(t, response.Body.String(), `"code":"`+wantCode+`"`)
			assert.Contains(t, response.Body.String(), `"retryable":false`)
		})
	}
}

func setupRouterTaskRetrieval(t *testing.T, protocol string) (*routerExecutionFixture,
	service.AppExecutionGrantResult, model.AppTaskExecution,
) {
	t.Helper()
	f, issued := setupRouterTaskAppGrant(t, protocol)
	var grant model.AppExecutionGrant
	require.NoError(t, model.DB.Where("grant_id = ?", issued.GrantID).First(&grant).Error)
	var candidates []model.AppExecutionModel
	require.NoError(t, common.UnmarshalJsonStr(grant.ModelsJSON, &candidates))
	require.NotEmpty(t, candidates)
	candidate := candidates[0]
	execution := model.AppTaskExecution{
		ExecutionKind: model.AppExecutionKindTask,
		LogicalHash:   fmt.Sprintf("retrieval-logical-%s", protocol),
		TaskID:        "task_route_retrieval",
		GrantID:       grant.GrantID,
		AppKey:        grant.AppKey, InstallationID: grant.InstallationID,
		AppSessionID: grant.AppSessionID, Subject: grant.Subject, UserID: grant.UserID,
		RunID: grant.RunID, ExecutionRequestID: grant.ExecutionRequestID, Operation: grant.Operation,
		SubmissionHash: "retrieval-submission",
		PublicModel:    candidate.PublicModel, ActualModel: candidate.ActualModel,
		ActualGroup: candidate.Group, ChannelID: candidate.ChannelID,
		PluginKey: candidate.PluginKey, PluginVersion: candidate.PluginVersion,
		PluginSHA256: candidate.PluginSHA256, Protocol: candidate.Protocol,
		ProviderTaskID: "cgt-route-retrieval", ProviderAccepted: true,
		Status: "accepted", ProviderState: "queued", BillingState: "reserved",
		FundingSource: grant.FundingSource, FundingRef: grant.FundingRef,
		CreatedAt: time.Now().Unix(), UpdatedAt: time.Now().Unix(),
	}
	require.NoError(t, model.DB.Create(&execution).Error)
	projection := model.Task{
		TaskID: execution.TaskID, Platform: constant.TaskPlatform(execution.PluginKey),
		UserId: execution.UserID, Group: execution.ActualGroup, ChannelId: execution.ChannelID,
		Status: model.TaskStatusQueued, ExecutionMode: model.TaskExecutionModeAppManaged,
		Properties: model.Properties{
			OriginModelName: execution.PublicModel, UpstreamModelName: execution.ActualModel,
		},
		PrivateData: model.TaskPrivateData{
			UpstreamTaskID:      execution.ProviderTaskID,
			ResponsesBackground: protocol == "openai_responses",
		},
	}
	require.NoError(t, model.DB.Create(&projection).Error)
	return f, issued, execution
}

func TestAppGrantTaskRetrievalRoutesDistinguishStorageFailureFromMissing(t *testing.T) {
	for _, route := range []struct {
		name     string
		protocol string
		path     func(model.AppTaskExecution) string
	}{
		{name: "responses", protocol: "openai_responses", path: func(execution model.AppTaskExecution) string {
			return "/v1/responses/resp_" + strings.TrimPrefix(execution.TaskID, "task_")
		}},
		{name: "video", protocol: "openai_video", path: func(execution model.AppTaskExecution) string {
			return "/v1/videos/" + execution.TaskID
		}},
		{name: "task", protocol: "openai_video", path: func(execution model.AppTaskExecution) string {
			return "/v1/tasks/" + execution.TaskID
		}},
	} {
		for _, failure := range []struct {
			name  string
			table string
		}{
			{name: "execution", table: "app_task_executions"},
			{name: "projection", table: "tasks"},
		} {
			t.Run(route.name+"/"+failure.name+" storage failure", func(t *testing.T) {
				f, issued, execution := setupRouterTaskRetrieval(t, route.protocol)
				privateDetail := "private " + route.name + " " + failure.name + " lookup detail"
				failed := registerRouterExecutionQueryFault(t, failure.table, 1, privateDetail)

				response := routerAppPluginRequestWithHeaders(
					f.engine, http.MethodGet,
					"https://console.example.com"+route.path(execution), "", nil,
					map[string]string{"Authorization": "AppGrant " + issued.GrantToken},
				)

				require.True(t, failed.Load())
				assertRouterAppPluginErrorEnvelope(t, response, http.StatusServiceUnavailable,
					"service_unavailable", "App service request denied", true)
				assert.NotContains(t, response.Body.String(), privateDetail)
			})
		}

		t.Run(route.name+"/missing", func(t *testing.T) {
			f, issued, execution := setupRouterTaskRetrieval(t, route.protocol)
			missingPath := strings.Replace(route.path(execution), execution.TaskID, "task_missing", 1)
			if route.protocol == "openai_responses" {
				missingPath = "/v1/responses/resp_missing"
			}
			response := routerAppPluginRequestWithHeaders(
				f.engine, http.MethodGet, "https://console.example.com"+missingPath, "", nil,
				map[string]string{"Authorization": "AppGrant " + issued.GrantToken},
			)
			assertRouterAppPluginErrorEnvelope(t, response, http.StatusNotFound,
				"not_found", "App service request denied", false)
		})
	}
}

func setupRouterAppTaskArtifactCapability(t *testing.T) (*routerExecutionFixture, model.AppTaskExecution, string) {
	t.Helper()
	f, _, execution := setupRouterTaskRetrieval(t, "openai_video")
	require.NoError(t, model.DB.Model(&model.AppTaskExecution{}).
		Where("id = ?", execution.ID).
		Updates(map[string]any{
			"provider_state": "succeeded",
			"artifacts_json": `[{"key":"video","type":"video","mime_type":"video/mp4"}]`,
			"updated_at":     time.Now().Unix(),
		}).Error)
	var projection model.Task
	require.NoError(t, model.DB.Where("task_id = ?", execution.TaskID).First(&projection).Error)
	projection.Status = model.TaskStatusSuccess
	projection.PrivateData.AppArtifactURLs = map[string]string{
		"video": "https://media.example.com/private-video.mp4",
	}
	require.NoError(t, model.DB.Save(&projection).Error)
	taskID := execution.TaskID
	response := f.call(t, http.MethodPost, "/internal/apps/v1/tasks/lookup",
		"AppService "+f.credential.Credential, "", service.AppTaskLookupRequest{
			RequestID: uuid.NewString(), AppKey: f.app.AppKey,
			AppSessionID: f.session.AppSessionID, Subject: f.session.Subject, TaskID: &taskID,
		})
	require.Equal(t, http.StatusOK, response.Code, response.Body.String())
	var envelope struct {
		Data struct {
			Artifacts []struct {
				ContentURL string `json:"content_url"`
			} `json:"artifacts"`
		} `json:"data"`
	}
	require.NoError(t, common.Unmarshal(response.Body.Bytes(), &envelope))
	require.Len(t, envelope.Data.Artifacts, 1)
	require.NotEmpty(t, envelope.Data.Artifacts[0].ContentURL)
	return f, execution, envelope.Data.Artifacts[0].ContentURL
}

func TestAppTaskArtifactContentRoutePreservesStorageFailure(t *testing.T) {
	f, _, contentURL := setupRouterAppTaskArtifactCapability(t)
	const privateDetail = "private app task artifact execution query detail"
	failed := registerRouterExecutionQueryFault(t, "app_task_executions", 1, privateDetail)

	response := routerAppPluginRequestWithHeaders(
		f.engine, http.MethodGet, contentURL, "", nil, nil,
	)

	require.True(t, failed.Load(), "the capability route must execute the App task query")
	assertRouterPublicStorageError(t, response, privateDetail)
	assert.NotContains(t, response.Body.String(), "artifact_not_found")
}

func TestAppTaskArtifactContentRouteMapsTransactionBoundaryFailuresToServiceUnavailable(t *testing.T) {
	for _, boundary := range []struct {
		name      string
		beginErr  error
		commitErr error
	}{
		{name: "begin", beginErr: errors.New("private artifact route begin detail")},
		{name: "commit", commitErr: errors.New("private artifact route commit detail")},
	} {
		t.Run(boundary.name, func(t *testing.T) {
			f, _, contentURL := setupRouterAppTaskArtifactCapability(t)
			currentDB := model.DB
			model.DB = routerExecutionDBWithTransactionFault(
				model.DB, boundary.beginErr, boundary.commitErr,
			)
			t.Cleanup(func() { model.DB = currentDB })

			response := routerAppPluginRequestWithHeaders(
				f.engine, http.MethodGet, contentURL, "", nil, nil,
			)

			privateDetail := boundary.beginErr
			if privateDetail == nil {
				privateDetail = boundary.commitErr
			}
			assertRouterPublicStorageError(t, response, privateDetail.Error())
			assert.NotContains(t, response.Body.String(), "artifact_not_found")
		})
	}
}

func TestAppTaskArtifactContentRouteKeepsMissingControlsNonRetryable(t *testing.T) {
	t.Run("missing task", func(t *testing.T) {
		f, execution, contentURL := setupRouterAppTaskArtifactCapability(t)
		require.NoError(t, model.DB.Delete(&model.AppTaskExecution{}, execution.ID).Error)

		response := routerAppPluginRequestWithHeaders(
			f.engine, http.MethodGet, contentURL, "", nil, nil,
		)

		require.Equal(t, http.StatusNotFound, response.Code, response.Body.String())
		assert.Contains(t, response.Body.String(), `"code":"artifact_not_found"`)
		assert.NotContains(t, response.Body.String(), `"retryable":true`)
	})

	t.Run("missing artifact", func(t *testing.T) {
		f, execution, contentURL := setupRouterAppTaskArtifactCapability(t)
		require.NoError(t, model.DB.Model(&model.AppTaskExecution{}).
			Where("id = ?", execution.ID).Update("artifacts_json", "[]").Error)

		response := routerAppPluginRequestWithHeaders(
			f.engine, http.MethodGet, contentURL, "", nil, nil,
		)

		require.Equal(t, http.StatusNotFound, response.Code, response.Body.String())
		assert.Contains(t, response.Body.String(), `"code":"artifact_not_found"`)
		assert.NotContains(t, response.Body.String(), `"retryable":true`)
	})
}

func TestAppGrantResponsesWebSocketIsExplicitlyRejected(t *testing.T) {
	f := setupRouterExecutionTest(t)
	require.NoError(t, model.DB.AutoMigrate(&model.Token{}))
	SetRelayRouter(f.engine)
	request := httptest.NewRequest(http.MethodGet, "https://console.example.com/v1/responses", nil)
	request.Header.Set("Authorization", "AppGrant "+strings.Repeat("a", 43))
	request.Header.Set("Connection", "Upgrade")
	request.Header.Set("Upgrade", "websocket")
	request.Header.Set("Sec-WebSocket-Key", "dGhlIHNhbXBsZSBub25jZQ==")
	request.Header.Set("Sec-WebSocket-Version", "13")
	request.Header.Set("Sec-WebSocket-Protocol", "responses")
	response := httptest.NewRecorder()

	f.engine.ServeHTTP(response, request)

	assert.Equal(t, http.StatusUnauthorized, response.Code)
	assert.NotEqual(t, http.StatusSwitchingProtocols, response.Code)
	assert.NotContains(t, response.Body.String(), "service_unavailable")
}

func setupRouterNativeAppGrant(t *testing.T, upstreamHandler http.Handler) (
	*routerExecutionFixture, service.AppExecutionGrantResult, []byte,
) {
	t.Helper()
	upstream := httptest.NewServer(upstreamHandler)
	t.Cleanup(upstream.Close)
	f := setupRouterExecutionTest(t)
	SetTaskPluginProtocolRouter(f.engine)
	require.NoError(t, model.DB.AutoMigrate(&model.Task{}, &model.SystemTask{}))
	previousQuotaUnit := common.QuotaPerUnit
	common.QuotaPerUnit = 500000
	t.Cleanup(func() { common.QuotaPerUnit = previousQuotaUnit })
	const publicModel = "registered-native-router"
	mapping := `{"` + publicModel + `":"gpt-native-router"}`
	channel := model.Channel{
		Type: constant.ChannelTypeOpenAI, Name: "native-router", Key: "native-router-secret",
		BaseURL: common.GetPointer(upstream.URL + "/v1"), ModelMapping: &mapping,
		Status: common.ChannelStatusEnabled, Group: "default", Models: publicModel,
	}
	require.NoError(t, model.DB.Create(&channel).Error)
	require.NoError(t, channel.AddAbilities(model.DB))
	require.NoError(t, model.DB.Model(&model.Option{}).Where(map[string]any{"key": "ModelPrice"}).
		Update("value", `{"doubao-seedance-2-5-260628":0.01,"`+publicModel+`":0.02}`).Error)
	policy := service.AppModelInvokePolicy{Operations: map[string]service.AppModelOperationPolicy{
		"model.generate": {
			Models: []service.AppModelAdmission{{
				PublicModel: publicModel, ActualModel: "gpt-native-router",
				Protocol: "openai_responses", ExecutionKind: model.AppExecutionModelKindNativeResponse,
				ChannelTypes: []int{constant.ChannelTypeOpenAI}, RequestProfile: "responses.text.v1",
			}},
			Strategies: []string{"stable"}, ConversionPolicies: []string{"strict"},
			PassthroughRules: []service.AppPassthroughRule{},
		},
	}}
	policyRaw, err := common.Marshal(policy)
	require.NoError(t, err)
	policyVersion, err := service.PublishAppModelInvokePolicy(
		t.Context(), model.DB, f.root, policyRaw, time.Now(),
	)
	require.NoError(t, err)
	request := service.AppExecutionGrantRequest{
		RequestID: uuid.NewString(), AppKey: f.app.AppKey,
		AppSessionID: f.session.AppSessionID, Subject: f.session.Subject,
		RunID: uuid.NewString(), ExecutionRequestID: uuid.NewString(),
		Operation: "model.generate", ModelPolicyVersion: policyVersion,
		RequestedModels: []string{publicModel}, Strategy: "stable",
		ConversionPolicy: "strict", PassthroughSelections: []service.AppPassthroughSelection{},
	}
	issuedResponse := f.call(t, http.MethodPost, "/internal/apps/v1/execution-grants",
		"AppService "+f.credential.Credential, "", request)
	require.Equal(t, http.StatusOK, issuedResponse.Code, issuedResponse.Body.String())
	var issued struct {
		Data service.AppExecutionGrantResult `json:"data"`
	}
	require.NoError(t, common.Unmarshal(issuedResponse.Body.Bytes(), &issued))
	require.NotEmpty(t, issued.Data.GrantToken)
	return f, issued.Data,
		[]byte(`{"model":"registered-native-router","input":"hello","max_output_tokens":32}`)
}

func callRouterNativeAppGrant(f *routerExecutionFixture, issued service.AppExecutionGrantResult,
	body []byte,
) *httptest.ResponseRecorder {
	return routerAppPluginRequestWithHeaders(
		f.engine, http.MethodPost, "https://console.example.com/v1/responses", "", body,
		map[string]string{"Authorization": "AppGrant " + issued.GrantToken},
	)
}

func completedRouterNativeResponse() http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_, _ = io.WriteString(w,
			`{"id":"resp_router","status":"completed","model":"gpt-native-router","error":null,`+
				`"incomplete_details":null,"usage":{"input_tokens":1,"output_tokens":2,"total_tokens":3}}`)
	})
}

func TestAppGrantNativeResponseRoutePreservesEveryPreDispatchStorageFailure(t *testing.T) {
	f, issued, body := setupRouterNativeAppGrant(t, completedRouterNativeResponse())
	for _, failure := range []struct {
		name       string
		operation  string
		table      string
		occurrence int32
	}{
		{name: "middleware initial grant", operation: "query", table: "app_execution_grants", occurrence: 1},
		{name: "middleware current grant", operation: "query", table: "app_execution_grants", occurrence: 2},
		{name: "installation ownership", operation: "query", table: "app_route_claims", occurrence: 1},
		{name: "installation", operation: "query", table: "app_installations", occurrence: 1},
		{name: "current service credential", operation: "query", table: "app_service_credentials", occurrence: 1},
		{name: "app session", operation: "query", table: "app_plugin_sessions", occurrence: 1},
		{name: "dashboard user", operation: "query", table: "users", occurrence: 1},
		{name: "dashboard session", operation: "query", table: "user_sessions", occurrence: 1},
		{name: "registration version", operation: "query", table: "app_versions", occurrence: 1},
		{name: "registration callback", operation: "query", table: "app_route_claims", occurrence: 2},
		{name: "execution initial grant", operation: "query", table: "app_execution_grants", occurrence: 3},
		{name: "execution current grant", operation: "query", table: "app_execution_grants", occurrence: 4},
		{name: "candidate policy", operation: "query", table: "options", occurrence: 3},
		{name: "candidate groups", operation: "query", table: "options", occurrence: 4},
		{name: "candidate channel", operation: "query", table: "channels", occurrence: 1},
		{name: "candidate ability", operation: "query", table: "abilities", occurrence: 1},
		{name: "execution lookup", operation: "query", table: "app_task_executions", occurrence: 1},
		{name: "funding lookup", operation: "query", table: "users", occurrence: 3},
		{name: "claim write", operation: "create", table: "app_task_executions", occurrence: 1},
	} {
		t.Run(failure.name, func(t *testing.T) {
			privateDetail := "private native route " + failure.name + " storage detail"
			failed := registerRouterExecutionDBFault(
				t, failure.operation, failure.table, failure.occurrence, privateDetail,
			)

			response := callRouterNativeAppGrant(f, issued, body)

			require.True(t, failed.Load(), "the intended native route boundary must be exercised")
			assertRouterPublicStorageError(t, response, privateDetail)
		})
	}
}

func TestAppGrantNativeResponseRoutePreservesReplayResultStorageFailure(t *testing.T) {
	f, issued, body := setupRouterNativeAppGrant(t, completedRouterNativeResponse())
	first := callRouterNativeAppGrant(f, issued, body)
	require.Equal(t, http.StatusOK, first.Code, first.Body.String())
	const privateDetail = "private native route replay result storage detail"
	failed := registerRouterExecutionDBFault(
		t, "query", "app_response_results", 1, privateDetail,
	)

	response := callRouterNativeAppGrant(f, issued, body)

	require.True(t, failed.Load(), "the replay result lookup must be exercised")
	assertRouterPublicStorageError(t, response, privateDetail)
}

func TestAppGrantNativeResponseRouteTreatsCorruptPersistedHeadersAsStorageFailure(t *testing.T) {
	f, issued, body := setupRouterNativeAppGrant(t, completedRouterNativeResponse())
	first := callRouterNativeAppGrant(f, issued, body)
	require.Equal(t, http.StatusOK, first.Code, first.Body.String())
	require.NoError(t, model.DB.Model(&model.AppResponseResult{}).
		Where("execution_id > ?", 0).
		Update("safe_headers_json", "{").Error)

	response := callRouterNativeAppGrant(f, issued, body)

	assertRouterPublicStorageError(t, response, "private")
	assert.NotContains(t, response.Body.String(), "execution_outcome_unknown")
}

func TestAppGrantNativeResponseRoutePreservesFinalizeStorageFailure(t *testing.T) {
	f, issued, body := setupRouterNativeAppGrant(t, completedRouterNativeResponse())
	const privateDetail = "private native route finalize storage detail"
	failed := registerRouterExecutionDBFault(
		t, "create", "app_response_results", 1, privateDetail,
	)

	response := callRouterNativeAppGrant(f, issued, body)

	require.True(t, failed.Load(), "the final response persistence must be exercised")
	assertRouterPublicStorageError(t, response, privateDetail)
}

func TestAppGrantNativeResponseRouteRequiresUnknownOutcomePersistence(t *testing.T) {
	upstream := http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		hijacker, ok := w.(http.Hijacker)
		require.True(t, ok)
		connection, _, err := hijacker.Hijack()
		require.NoError(t, err)
		require.NoError(t, connection.Close())
	})
	f, issued, body := setupRouterNativeAppGrant(t, upstream)
	const privateDetail = "private native route mark unknown storage detail"
	failed := registerRouterExecutionDBFault(
		t, "update", "app_task_executions", 1, privateDetail,
	)

	response := callRouterNativeAppGrant(f, issued, body)

	require.True(t, failed.Load(), "the unknown-outcome persistence must be exercised")
	assertRouterPublicStorageError(t, response, privateDetail)
}

func TestAppGrantNativeResponseHTTPPersistsAndReplays(t *testing.T) {
	var sends atomic.Int32
	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, request *http.Request) {
		sends.Add(1)
		assert.Equal(t, http.MethodPost, request.Method)
		assert.Equal(t, "/v1/responses", request.URL.Path)
		assert.Equal(t, 1, request.ProtoMajor)
		assert.Equal(t, "Bearer native-router-secret", request.Header.Get("Authorization"))
		body, err := io.ReadAll(request.Body)
		require.NoError(t, err)
		assert.JSONEq(t, `{"model":"gpt-native-router","input":"hello","max_output_tokens":32,"stream":false,"store":false}`, string(body))
		w.Header().Set("Content-Type", "application/json")
		w.Header().Set("X-Request-ID", "provider-native-router")
		_, _ = io.WriteString(w, `{"id":"resp_router","status":"completed","model":"gpt-native-router","error":null,"incomplete_details":null,"usage":{"input_tokens":1,"output_tokens":2,"total_tokens":3}}`)
	}))
	t.Cleanup(upstream.Close)
	f := setupRouterExecutionTest(t)
	SetTaskPluginProtocolRouter(f.engine)
	require.NoError(t, model.DB.AutoMigrate(&model.Task{}, &model.SystemTask{}))
	previousQuotaUnit := common.QuotaPerUnit
	common.QuotaPerUnit = 500000
	t.Cleanup(func() { common.QuotaPerUnit = previousQuotaUnit })
	const publicModel = "registered-native-router"
	mapping := `{"` + publicModel + `":"gpt-native-router"}`
	channel := model.Channel{
		Type: constant.ChannelTypeOpenAI, Name: "native-router", Key: "native-router-secret",
		BaseURL: common.GetPointer(upstream.URL + "/v1"), ModelMapping: &mapping,
		Status: common.ChannelStatusEnabled, Group: "default", Models: publicModel,
	}
	require.NoError(t, model.DB.Create(&channel).Error)
	require.NoError(t, channel.AddAbilities(model.DB))
	require.NoError(t, model.DB.Model(&model.Option{}).Where(map[string]any{"key": "ModelPrice"}).
		Update("value", `{"doubao-seedance-2-5-260628":0.01,"`+publicModel+`":0.02}`).Error)
	policy := service.AppModelInvokePolicy{Operations: map[string]service.AppModelOperationPolicy{
		"model.generate": {
			Models: []service.AppModelAdmission{{
				PublicModel: publicModel, ActualModel: "gpt-native-router",
				Protocol: "openai_responses", ExecutionKind: model.AppExecutionModelKindNativeResponse,
				ChannelTypes: []int{constant.ChannelTypeOpenAI}, RequestProfile: "responses.text.v1",
			}},
			Strategies: []string{"stable"}, ConversionPolicies: []string{"strict"},
			PassthroughRules: []service.AppPassthroughRule{},
		},
	}}
	policyRaw, err := common.Marshal(policy)
	require.NoError(t, err)
	policyVersion, err := service.PublishAppModelInvokePolicy(
		t.Context(), model.DB, f.root, policyRaw, time.Now(),
	)
	require.NoError(t, err)
	request := service.AppExecutionGrantRequest{
		RequestID: uuid.NewString(), AppKey: f.app.AppKey,
		AppSessionID: f.session.AppSessionID, Subject: f.session.Subject,
		RunID: uuid.NewString(), ExecutionRequestID: uuid.NewString(),
		Operation: "model.generate", ModelPolicyVersion: policyVersion,
		RequestedModels: []string{publicModel}, Strategy: "stable",
		ConversionPolicy: "strict", PassthroughSelections: []service.AppPassthroughSelection{},
	}
	issuedResponse := f.call(t, http.MethodPost, "/internal/apps/v1/execution-grants",
		"AppService "+f.credential.Credential, "", request)
	require.Equal(t, http.StatusOK, issuedResponse.Code, issuedResponse.Body.String())
	var issued struct {
		Data service.AppExecutionGrantResult `json:"data"`
	}
	require.NoError(t, common.Unmarshal(issuedResponse.Body.Bytes(), &issued))
	body := []byte(`{"model":"registered-native-router","input":"hello","max_output_tokens":32}`)
	call := func() *httptest.ResponseRecorder {
		return routerAppPluginRequestWithHeaders(
			f.engine, http.MethodPost, "https://console.example.com/v1/responses", "", body,
			map[string]string{"Authorization": "AppGrant " + issued.Data.GrantToken},
		)
	}

	t.Run("middleware preserves grant storage failure", func(t *testing.T) {
		const privateDetail = "private route grant storage detail"
		var failed atomic.Bool
		callbackName := "test:responses-route-grant-storage-failure:" + uuid.NewString()
		require.NoError(t, model.DB.Callback().Query().Before("gorm:query").
			Register(callbackName, func(tx *gorm.DB) {
				if tx.Statement.Table == "app_execution_grants" && failed.CompareAndSwap(false, true) {
					tx.AddError(errors.New(privateDetail))
				}
			}))
		defer func() {
			require.NoError(t, model.DB.Callback().Query().Remove(callbackName))
		}()

		response := call()

		require.True(t, failed.Load(), "the route must execute AppGrant storage authentication")
		assertRouterAppPluginErrorEnvelope(t, response, http.StatusServiceUnavailable,
			"service_unavailable", "App service request denied", true)
		assert.NotContains(t, response.Body.String(), privateDetail)
	})

	t.Run("middleware preserves missing grant", func(t *testing.T) {
		response := routerAppPluginRequestWithHeaders(
			f.engine, http.MethodPost, "https://console.example.com/v1/responses", "", body,
			map[string]string{"Authorization": "AppGrant " + strings.Repeat("m", 43)},
		)
		assertRouterAppPluginErrorEnvelope(t, response, http.StatusUnauthorized,
			"invalid_grant", "App service request denied", false)
	})

	t.Run("middleware keeps malformed grant and route denial nonretryable", func(t *testing.T) {
		invalid := routerAppPluginRequestWithHeaders(
			f.engine, http.MethodPost, "https://console.example.com/v1/responses", "", body,
			map[string]string{"Authorization": "AppGrant malformed"},
		)
		assertRouterAppPluginErrorEnvelope(t, invalid, http.StatusUnauthorized,
			"invalid_grant", "App service request denied", false)

		denied := routerAppPluginRequestWithHeaders(
			f.engine, http.MethodPost, "https://console.example.com/v1/responses?trace=1", "", body,
			map[string]string{"Authorization": "AppGrant " + issued.Data.GrantToken},
		)
		assertRouterAppPluginErrorEnvelope(t, denied, http.StatusForbidden,
			"scope_denied", "App service request denied", false)
	})

	first := call()
	require.Equal(t, http.StatusOK, first.Code, first.Body.String())
	assert.Equal(t, "provider-native-router", first.Header().Get("X-Request-ID"))
	assert.JSONEq(t, `{"id":"resp_router","status":"completed","model":"gpt-native-router","error":null,"incomplete_details":null,"usage":{"input_tokens":1,"output_tokens":2,"total_tokens":3}}`, first.Body.String())
	second := call()
	require.Equal(t, http.StatusOK, second.Code, second.Body.String())
	assert.Equal(t, first.Body.String(), second.Body.String())
	assert.Equal(t, int32(1), sends.Load())

	var execution model.AppTaskExecution
	require.NoError(t, model.DB.Where("grant_id = ?", issued.Data.GrantID).First(&execution).Error)
	assert.Equal(t, model.AppExecutionKindResponse, execution.ExecutionKind)
	assert.Equal(t, "captured", execution.Status)
	assert.Equal(t, "settled", execution.BillingState)
	for _, table := range []any{&model.AppResponseResult{}, &model.AppTaskSettlement{}, &model.AppTaskOutbox{}} {
		var count int64
		require.NoError(t, model.DB.Model(table).Count(&count).Error)
		assert.EqualValues(t, 1, count)
	}
	for _, table := range []any{&model.Task{}, &model.AppTaskReconcile{}} {
		var count int64
		require.NoError(t, model.DB.Model(table).Count(&count).Error)
		assert.Zero(t, count)
	}

	t.Run("middleware preserves revoked session", func(t *testing.T) {
		require.NoError(t, model.DB.Model(&model.AppPluginSession{}).
			Where("app_session_id = ?", f.session.AppSessionID).
			Update("revoked_at", time.Now().Unix()).Error)
		response := call()
		assertRouterAppPluginErrorEnvelope(t, response, http.StatusUnauthorized,
			"unauthenticated", "App service request denied", false)
	})
}

func TestAppExecutionPolicyHTTPPublication(t *testing.T) {
	f := setupRouterExecutionTest(t)
	for _, key := range []string{model.AppModelInvokePolicyKey, model.AppArkImportDelegationsKey} {
		raw := routerExecutionPolicy
		if key == model.AppArkImportDelegationsKey {
			raw = `{"delegations":[]}`
		}
		body := map[string]any{"key": key, "value": raw}
		response := f.call(t, http.MethodPut, "/api/option/", "Bearer "+f.rootJWT, "", body)
		require.Equal(t, http.StatusOK, response.Code, response.Body.String())
		var published struct {
			Success bool `json:"success"`
			Data    struct {
				Version int64 `json:"version"`
			} `json:"data"`
		}
		require.NoError(t, common.Unmarshal(response.Body.Bytes(), &published))
		require.True(t, published.Success, response.Body.String())
		assert.EqualValues(t, 1, published.Data.Version)
		response = f.call(t, http.MethodPut, "/api/option/", "Bearer "+f.rootJWT, "", body)
		require.Equal(t, http.StatusOK, response.Code)
		head, err := model.GetAppExecutionPolicyTx(model.DB, key)
		require.NoError(t, err)
		assert.EqualValues(t, 2, head.Version)
		body["value"] = `{"unexpected":true}`
		assert.Equal(t, http.StatusBadRequest, f.call(t, http.MethodPut, "/api/option/", "Bearer "+f.rootJWT, "", body).Code)
		body["value"] = raw
		assert.Equal(t, http.StatusUnauthorized, f.call(t, http.MethodPut, "/api/option/", "Bearer "+f.rootPAT, "", body).Code)
		assert.GreaterOrEqual(t, f.call(t, http.MethodPut, "/api/option/", "Bearer "+f.userJWT, "", body).Code, 400)
		for _, alias := range []string{strings.ToLower(key), key + " "} {
			body["key"] = alias
			response = f.call(t, http.MethodPut, "/api/option/", "Bearer "+f.rootJWT, "", body)
			var result map[string]any
			require.NoError(t, common.Unmarshal(response.Body.Bytes(), &result))
			assert.NotEqual(t, true, result["success"])
		}
		var count int64
		require.NoError(t, model.DB.Model(&model.AppExecutionPolicyVersion{}).Where("policy_key = ?", key).Count(&count).Error)
		assert.EqualValues(t, 2, count)
	}
}

func TestAppIntrospectionPolicyHeaderHTTP(t *testing.T) {
	f := setupRouterExecutionTest(t)
	body := service.AppPluginIntrospectRequest{AppKey: f.app.AppKey, AppSessionID: f.session.AppSessionID,
		Subject: f.session.Subject, RequiredScopes: []string{}, RequiredEntitlements: model.AppJSONMap{}}
	read := func() *httptest.ResponseRecorder {
		return f.call(t, http.MethodPost, "/internal/apps/v1/sessions/introspect", "AppService "+f.credential.Credential, "", body)
	}
	response := read()
	require.Equal(t, http.StatusOK, response.Code, response.Body.String())
	assert.Empty(t, response.Header().Get("X-App-Model-Policy-Version"))
	version := f.publish(t)
	response = read()
	require.Equal(t, http.StatusOK, response.Code, response.Body.String())
	assert.Equal(t, fmt.Sprint(version), response.Header().Get("X-App-Model-Policy-Version"))
	var facts struct {
		Data map[string]any `json:"data"`
	}
	require.NoError(t, common.Unmarshal(response.Body.Bytes(), &facts))
	assert.Len(t, facts.Data, 10)
	assert.Equal(t, true, facts.Data["active"])
	for _, field := range []string{"subject", "session"} {
		alias := body
		if field == "subject" {
			alias.Subject = strings.ToUpper(alias.Subject)
		} else {
			alias.AppSessionID = strings.ToUpper(alias.AppSessionID)
		}
		response = f.call(t, http.MethodPost, "/internal/apps/v1/sessions/introspect", "AppService "+f.credential.Credential, "", alias)
		assert.Equal(t, http.StatusNotFound, response.Code, "policy header requires exact current identity")
		assert.Empty(t, response.Header().Get("X-App-Model-Policy-Version"))
	}
	require.NoError(t, model.DB.Model(&model.AppServiceCredentialBinding{}).Where("credential_id = ?", f.credential.CredentialID).
		Update("scopes", `["identity.read"]`).Error)
	assert.Empty(t, read().Header().Get("X-App-Model-Policy-Version"))
	require.NoError(t, model.DB.Model(&model.AppServiceCredentialBinding{}).Where("credential_id = ?", f.credential.CredentialID).
		Update("scopes", `["identity.read","model.invoke"]`).Error)
	require.NoError(t, model.DB.Model(&model.AppInstallation{}).Where("installation_id = ?", f.app.InstallationID).
		Update("status", "disabled").Error)
	response = read()
	assert.Equal(t, http.StatusOK, response.Code)
	assert.Empty(t, response.Header().Get("X-App-Model-Policy-Version"))
	require.NoError(t, model.DB.Model(&model.AppInstallation{}).Where("installation_id = ?", f.app.InstallationID).
		Update("status", "enabled").Error)
	require.NoError(t, model.DB.Model(&model.Option{}).Where(map[string]any{"key": model.AppModelInvokePolicyKey}).Update("value", "invalid").Error)
	response = read()
	assert.Equal(t, http.StatusServiceUnavailable, response.Code)
	assert.Empty(t, response.Header().Get("X-App-Model-Policy-Version"))
}

func TestAppExecutionHTTPTransportAndLimits(t *testing.T) {
	f := setupRouterExecutionTest(t)
	for _, path := range []string{"/internal/apps/v1/execution-grants", "/internal/apps/v1/tasks/lookup",
		"/internal/apps/v1/tasks/cancel", "/internal/apps/v1/imports/ark-task-lookup"} {
		for _, kind := range []string{"no_tls", "duplicate_auth", "content_type", "unknown_fields", "oversized"} {
			t.Run(path+" "+kind, func(t *testing.T) {
				raw, contentType, status := `{}`, "application/json", http.StatusBadRequest
				if kind == "oversized" {
					raw, status = strings.Repeat(" ", 65537), http.StatusRequestEntityTooLarge
				}
				if kind == "unknown_fields" {
					raw = `{"unknown":true,"unknown":false}`
				}
				if kind == "content_type" {
					contentType = "text/plain"
				}
				request := httptest.NewRequest(http.MethodPost, "https://console.example.com"+path, strings.NewReader(raw))
				request.Header.Set("Authorization", "AppService "+f.credential.Credential)
				request.Header.Set("Content-Type", contentType)
				request.Header.Set("Idempotency-Key", "boundary")
				switch kind {
				case "no_tls":
					request.TLS = nil
					request.Header.Set("X-Forwarded-Proto", "https")
					status = http.StatusUnauthorized
				case "duplicate_auth":
					request.Header.Add("Authorization", "AppService "+f.credential.Credential)
					status = http.StatusUnauthorized
				}
				response := httptest.NewRecorder()
				f.engine.ServeHTTP(response, request)
				assert.Equal(t, status, response.Code)
				assert.Equal(t, "no-store", response.Header().Get("Cache-Control"))
				assert.Equal(t, "no-referrer", response.Header().Get("Referrer-Policy"))
				assert.NotContains(t, response.Body.String(), f.credential.Credential)
				assert.NotEmpty(t, routerAppPluginErrorCode(t, response))
			})
		}
	}
	// Verify the global limiter reaches the new exact route error boundary.
	previousNum, previousDuration := common.GlobalApiRateLimitNum, common.GlobalApiRateLimitDuration
	t.Cleanup(func() {
		common.GlobalApiRateLimitNum, common.GlobalApiRateLimitDuration = previousNum, previousDuration
	})
	common.GlobalApiRateLimitEnable, common.GlobalApiRateLimitNum, common.GlobalApiRateLimitDuration = true, 1, 60
	limitedEngine := gin.New()
	limitedEngine.Use(middleware.RequestId())
	SetApiRouter(limitedEngine)
	for i, path := range []string{"/internal/apps/v1/execution-grants", "/internal/apps/v1/tasks/lookup",
		"/internal/apps/v1/tasks/cancel", "/internal/apps/v1/imports/ark-task-lookup",
		"/api/app_plugins/http-app/launch-context"} {
		method := http.MethodPost
		if i == 4 {
			method = http.MethodGet
		}
		ip := fmt.Sprintf("192.0.2.%d", i+150)
		routerAppPluginRateLimitRequest(limitedEngine, http.MethodGet, "/api/app_plugins", "", ip)
		response := routerAppPluginRateLimitRequest(limitedEngine, method, path, "", ip)
		assertRouterAppPluginErrorEnvelope(t, response, http.StatusTooManyRequests, "rate_limited", "Too many app plugin requests", true)
		assert.Equal(t, "no-store", response.Header().Get("Cache-Control"))
	}
}

func TestAppLaunchContextHTTPAuthority(t *testing.T) {
	f := setupRouterExecutionTest(t)
	for surface, endpoint := range map[string]string{"direct": "/auth/start", "embedded": "/bootstrap/frame"} {
		response := f.call(t, http.MethodGet, "/api/app_plugins/http-app/launch-context?surface="+surface,
			"Bearer "+f.userJWT, "", nil)
		require.Equal(t, http.StatusOK, response.Code, response.Body.String())
		var facts struct {
			Data map[string]any `json:"data"`
		}
		require.NoError(t, common.Unmarshal(response.Body.Bytes(), &facts))
		assert.Equal(t, map[string]any{"app_key": "http-app", "surface": surface,
			"start_url": "https://apps.example.com/http-app" + endpoint, "origin": "https://apps.example.com"}, facts.Data)
		assert.Equal(t, "no-store", response.Header().Get("Cache-Control"))
		assert.Equal(t, "no-referrer", response.Header().Get("Referrer-Policy"))
	}
	for _, query := range []string{"", "surface=direct&surface=embedded", "surface=direct&origin=https://evil.example", "surface=other"} {
		assert.Equal(t, http.StatusBadRequest, f.call(t, http.MethodGet, "/api/app_plugins/http-app/launch-context?"+query, "Bearer "+f.userJWT, "", nil).Code)
	}
	assert.Equal(t, http.StatusUnauthorized, f.call(t, http.MethodGet, "/api/app_plugins/http-app/launch-context?surface=direct", "Bearer "+f.rootPAT, "", nil).Code)
	require.NoError(t, model.DB.Model(&model.AppInstallation{}).Where("installation_id = ?", f.app.InstallationID).
		Update("allowed_parent_origins", `["https://other.example.com"]`).Error)
	assert.Equal(t, http.StatusForbidden, f.call(t, http.MethodGet, "/api/app_plugins/http-app/launch-context?surface=embedded", "Bearer "+f.userJWT, "", nil).Code)
	require.NoError(t, model.DB.Model(&model.AppInstallation{}).Where("installation_id = ?", f.app.InstallationID).
		Update("status", "disabled").Error)
	assert.Equal(t, http.StatusForbidden, f.call(t, http.MethodGet, "/api/app_plugins/http-app/launch-context?surface=direct", "Bearer "+f.userJWT, "", nil).Code)
	require.NoError(t, model.DB.Model(&model.AppInstallation{}).Where("installation_id = ?", f.app.InstallationID).
		Update("status", "enabled").Error)
	require.NoError(t, model.DB.Model(&model.AppRouteClaim{}).Where("installation_id = ? AND kind = ?", f.app.InstallationID, "direct").
		Update("absolute_endpoint", "https://apps.example.com/unregistered").Error)
	assert.Equal(t, http.StatusNotFound, f.call(t, http.MethodGet, "/api/app_plugins/http-app/launch-context?surface=direct", "Bearer "+f.userJWT, "", nil).Code)
	require.NoError(t, model.DB.Model(&model.UserSession{}).Where("sid = ?", f.session.DashboardSessionID).
		Update("version", 2).Error)
	assert.Equal(t, http.StatusUnauthorized, f.call(t, http.MethodGet, "/api/app_plugins/http-app/launch-context?surface=direct", "Bearer "+f.userJWT, "", nil).Code)
	var count int64
	require.NoError(t, model.DB.Model(&model.AppPluginLaunchCode{}).Count(&count).Error)
	assert.Zero(t, count)
}

func routerAppWorkerExecution(t *testing.T, upstream, expression string, querySource ...string) (model.AppTaskExecution, time.Time) {
	t.Helper()
	f := setupRouterExecutionTest(t)
	if len(querySource) != 0 {
		_, err := jsplugin.DefaultRegistry.RegisterFactory(querySource[0], jsplugin.Options{Key: "doubao"})
		require.NoError(t, err)
	}
	require.NoError(t, model.DB.AutoMigrate(&model.Task{}, &model.SystemTask{}))
	previousQuotaUnit, previousFactory := common.QuotaPerUnit, service.AppTaskAdaptorFactory
	common.QuotaPerUnit = 500000
	service.AppTaskAdaptorFactory = func(key string) service.AppTaskPollingAdaptor {
		adaptor := relay.GetTaskAdaptor(constant.TaskPlatform(key))
		host, _ := adaptor.(service.AppTaskPollingAdaptor)
		return host
	}
	t.Cleanup(func() {
		common.QuotaPerUnit, service.AppTaskAdaptorFactory = previousQuotaUnit, previousFactory
	})
	service.InitHttpClient()
	require.NoError(t, model.DB.Model(&model.Channel{}).Where("name = ?", "http-offline").Update("base_url", upstream).Error)
	if expression != "" {
		body := routerAppPluginJSON(t, map[string]string{"doubao-seedance-2-5-260628": expression})
		require.NoError(t, model.DB.Create(&[]model.Option{
			{Key: "billing_setting.billing_mode", Value: `{"doubao-seedance-2-5-260628":"tiered_expr"}`},
			{Key: "billing_setting.billing_expr", Value: string(body)},
		}).Error)
	}
	request := service.AppExecutionGrantRequest{RequestID: uuid.NewString(), AppKey: f.app.AppKey,
		AppSessionID: f.session.AppSessionID, Subject: f.session.Subject, RunID: uuid.NewString(),
		ExecutionRequestID: uuid.NewString(), Operation: "model.generate", ModelPolicyVersion: f.publish(t),
		RequestedModels: []string{"doubao-seedance-2-5-260628"}, Strategy: "stable", ConversionPolicy: "strict",
		PassthroughSelections: []service.AppPassthroughSelection{}}
	response := f.call(t, http.MethodPost, "/internal/apps/v1/execution-grants", "AppService "+f.credential.Credential, "", request)
	require.Equal(t, http.StatusOK, response.Code, "issue grant; body intentionally omitted")
	var issued struct {
		Data service.AppExecutionGrantResult `json:"data"`
	}
	require.NoError(t, common.Unmarshal(response.Body.Bytes(), &issued))
	var grant model.AppExecutionGrant
	require.NoError(t, model.DB.Where("grant_id = ?", issued.Data.GrantID).First(&grant).Error)
	var models []model.AppExecutionModel
	require.NoError(t, common.UnmarshalJsonStr(grant.ModelsJSON, &models))
	require.Len(t, models, 1)
	selected := models[0]
	at := time.Date(2026, 1, 1, 10, 0, 0, 0, time.UTC)
	claim := model.AppTaskExecution{GrantID: grant.GrantID, AppKey: grant.AppKey, InstallationID: grant.InstallationID,
		AppSessionID: grant.AppSessionID, Subject: grant.Subject, UserID: grant.UserID,
		RunID: grant.RunID, ExecutionRequestID: grant.ExecutionRequestID, Operation: grant.Operation,
		PublicModel: selected.PublicModel, ActualModel: selected.ActualModel, ActualGroup: selected.Group, ChannelID: selected.ChannelID,
		PluginKey: selected.PluginKey, PluginVersion: selected.PluginVersion, PluginSHA256: selected.PluginSHA256,
		Protocol: selected.Protocol, FundingSource: grant.FundingSource, ReservedQuota: 5000,
		SubmissionHash:   "worker-fixture-submission",
		RequestFactsJSON: `{"usage":{"tokens":5000},"headers":{},"body":{}}`}
	var execution model.AppTaskExecution
	require.NoError(t, model.RunAppPluginTransaction(model.DB, func(tx *gorm.DB) error {
		var won bool
		var err error
		execution, won, err = model.ClaimAppTaskExecutionTx(tx, grant.GrantID, claim, at)
		if err != nil {
			return err
		}
		require.True(t, won)
		return model.RecordAppTaskAcceptanceTx(tx, execution.ID, "cgt-host-worker", "queued", at)
	}))
	require.NoError(t, model.RevokeAppServiceCredential(t.Context(), model.DB, f.app.InstallationID, f.credential.CredentialID, time.Now()))
	require.NoError(t, model.DB.Model(&model.AppPluginSession{}).Where("app_session_id = ?", f.session.AppSessionID).
		Update("revoked_at", time.Now().Unix()).Error)
	require.NoError(t, model.DB.Model(&model.AppInstallation{}).Where("installation_id = ?", f.app.InstallationID).
		Update("status", "revoked").Error)
	require.NoError(t, model.DB.Model(&model.User{}).Where("id = ?", grant.UserID).Update("status", common.UserStatusDisabled).Error)
	require.NoError(t, model.DB.Model(&model.Channel{}).Where("id = ?", selected.ChannelID).Update("status", common.ChannelStatusManuallyDisabled).Error)
	require.NoError(t, model.DB.Model(&model.Option{}).Where(map[string]any{"key": "ModelPrice"}).
		Update("value", `{"doubao-seedance-2-5-260628":999}`).Error)
	for _, key := range []string{
		operation_setting.AppPluginV1EnabledOptionKey,
		operation_setting.AppExecutionGrantsEnabledOptionKey,
		operation_setting.AppPluginSeedanceEnabledOptionKey,
		operation_setting.AppPluginEmbeddedSurfaceEnabledOptionKey,
	} {
		setRouterAppPluginFlag(key, false)
	}
	require.NoError(t, model.DB.First(&execution, execution.ID).Error)
	return execution, at.Add(2 * time.Hour)
}

const appWorkerSuccessResponse = `{"id":"cgt-host-worker","status":"succeeded","model":"doubao-seedance-2-5-260628","content":{"video_url":"https://cdn.example.com/video.mp4"},"usage":{"completion_tokens":108000,"total_tokens":108000}}`

type appWorkerDefaultBaseObserver struct {
	service.AppTaskPollingAdaptor
	t        *testing.T
	localURL string
}

func (a *appWorkerDefaultBaseObserver) FetchTaskWithContext(ctx context.Context, base, key string, task *model.Task, proxy string) (*http.Response, error) {
	assert.Equal(a.t, constant.GetChannelBaseURL(constant.ChannelTypeDoubaoVideo), base, "worker uses the channel default URL")
	return a.AppTaskPollingAdaptor.FetchTaskWithContext(ctx, a.localURL, key, task, proxy)
}

func TestHostAppTaskWorkerUsesFrozenFacts(t *testing.T) {
	for _, test := range []struct {
		name       string
		expression string
		finalQuota int
		overdrawn  bool
		failed     bool
		defaultURL bool
	}{
		{name: "per call", finalQuota: 5000},
		{name: "task usage and frozen time", expression: `tier("base",u("tokens")*0.000002)*(hour("UTC")==10?1:2)`, finalQuota: 108000},
		{name: "negative wallet zero delta", finalQuota: 5000, overdrawn: true},
		{name: "negative wallet refund", finalQuota: 0, overdrawn: true, failed: true},
		{name: "channel default URL", finalQuota: 5000, defaultURL: true},
	} {
		t.Run(test.name, func(t *testing.T) {
			var queries, writes atomic.Int32
			upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				if r.Method != http.MethodGet {
					writes.Add(1)
					http.Error(w, "unexpected provider write", http.StatusBadRequest)
					return
				}
				queries.Add(1)
				assert.Equal(t, "/api/v3/contents/generations/tasks/cgt-host-worker", r.URL.Path)
				assert.True(t, r.Header.Get("Authorization") == "Bearer offline-key", "Host credential must be used")
				w.Header().Set("Content-Type", "application/json")
				if test.failed {
					_, _ = io.WriteString(w, `{"id":"cgt-host-worker","status":"failed","model":"doubao-seedance-2-5-260628","error":{"message":"upstream failed"}}`)
					return
				}
				_, _ = io.WriteString(w, appWorkerSuccessResponse)
			}))
			t.Cleanup(upstream.Close)
			execution, now := routerAppWorkerExecution(t, upstream.URL, test.expression)
			expectedBalance := 1000000 - test.finalQuota
			if test.overdrawn {
				require.NoError(t, model.DB.Model(&model.User{}).Where("id = ?", execution.UserID).Update("quota", -10).Error)
				expectedBalance = -10 + 5000 - test.finalQuota
			}
			if test.defaultURL {
				require.NoError(t, model.DB.Model(&model.Channel{}).Where("id = ?", execution.ChannelID).Update("base_url", "").Error)
				factory := service.AppTaskAdaptorFactory
				service.AppTaskAdaptorFactory = func(key string) service.AppTaskPollingAdaptor {
					return &appWorkerDefaultBaseObserver{AppTaskPollingAdaptor: factory(key), t: t, localURL: upstream.URL}
				}
			}
			processed, err := service.RunAppTaskReconcileOnce(t.Context(), model.DB, now)
			require.NoError(t, err)
			require.True(t, processed)
			assert.Equal(t, int32(1), queries.Load())
			assert.Zero(t, writes.Load())
			var payer model.User
			require.NoError(t, model.DB.First(&payer, execution.UserID).Error)
			assert.Equal(t, expectedBalance, payer.Quota)
			assert.Equal(t, test.finalQuota, payer.UsedQuota)
			assert.Equal(t, 1, payer.RequestCount)
			var saved model.AppTaskExecution
			require.NoError(t, model.DB.First(&saved, execution.ID).Error)
			expectedState := "succeeded"
			if test.failed {
				expectedState = "failed"
			}
			assert.Equal(t, expectedState, saved.ProviderState)
			assert.Equal(t, "settled", saved.BillingState)
			assert.NotContains(t, saved.ArtifactsJSON, "cdn.example.com")
			var projection model.Task
			require.NoError(t, model.DB.Where("task_id = ?", execution.TaskID).First(&projection).Error)
			if test.failed {
				assert.Equal(t, "[]", saved.ArtifactsJSON)
				assert.Empty(t, projection.PrivateData.AppArtifactURLs)
			} else {
				assert.Contains(t, saved.UsageJSON, `"tokens":108000`)
				assert.Contains(t, saved.ArtifactsJSON, `"key":"video"`)
				assert.Equal(t, "https://cdn.example.com/video.mp4", projection.PrivateData.AppArtifactURLs["video"])
			}
			processed, err = service.RunAppTaskReconcileOnce(t.Context(), model.DB, now.Add(time.Minute))
			require.NoError(t, err)
			assert.False(t, processed)
			assert.Equal(t, int32(1), queries.Load())
			for _, table := range []any{&model.AppTaskSettlement{}, &model.AppTaskOutbox{}} {
				var count int64
				require.NoError(t, model.DB.Model(table).Count(&count).Error)
				assert.EqualValues(t, 1, count)
			}
		})
	}
}

func TestHostAppTaskWorkerPreservesUncertainQueries(t *testing.T) {
	for _, test := range []struct {
		name string
		code int
		body string
	}{
		{"not found", http.StatusNotFound, `{"error":"gone"}`},
		{"unavailable", http.StatusServiceUnavailable, `{"error":"temporary"}`},
		{"invalid JSON", http.StatusOK, `{"status":`},
		{"other task", http.StatusOK, strings.Replace(appWorkerSuccessResponse, "cgt-host-worker", "cgt-other", 1)},
		{"other model", http.StatusOK, strings.Replace(appWorkerSuccessResponse, "doubao-seedance-2-5-260628", "other", 1)},
		{"source changed", http.StatusOK, appWorkerSuccessResponse},
		{"redirect", http.StatusFound, ""},
		{"write descriptor", http.StatusOK, appWorkerSuccessResponse},
	} {
		t.Run(test.name, func(t *testing.T) {
			var queries atomic.Int32
			upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				queries.Add(1)
				assert.Equal(t, http.MethodGet, r.Method)
				w.Header().Set("Content-Type", "application/json")
				if test.name == "redirect" {
					w.Header().Set("Location", "/another-task")
				}
				w.WriteHeader(test.code)
				_, _ = io.WriteString(w, test.body)
			}))
			t.Cleanup(upstream.Close)
			var sourceOverride []string
			if test.name == "write descriptor" {
				source, err := os.ReadFile("../plugins/tasks/doubao/plugin.js")
				require.NoError(t, err)
				const query = "export function buildQueryRequest(ctx) {\n  return {\n    url: apiRoot(ctx) + \"/api/v3/contents/generations/tasks/\" + ctx.taskId,\n    method: \"GET\","
				require.Equal(t, 1, strings.Count(string(source), query))
				sourceOverride = []string{strings.Replace(string(source), query, strings.Replace(query, `"GET"`, `"POST"`, 1), 1)}
			}
			execution, now := routerAppWorkerExecution(t, upstream.URL, "", sourceOverride...)
			if test.name == "source changed" {
				source, err := os.ReadFile("../plugins/tasks/doubao/plugin.js")
				require.NoError(t, err)
				_, err = jsplugin.DefaultRegistry.RegisterFactory(string(source)+"\n// different source\n", jsplugin.Options{Key: "doubao"})
				require.NoError(t, err)
			}
			_, err := service.RunAppTaskReconcileOnce(t.Context(), model.DB, now)
			require.Error(t, err)
			var saved model.AppTaskExecution
			require.NoError(t, model.DB.First(&saved, execution.ID).Error)
			assert.Equal(t, "queued", saved.ProviderState)
			assert.Equal(t, "reserved", saved.BillingState)
			var payer model.User
			require.NoError(t, model.DB.First(&payer, execution.UserID).Error)
			assert.Equal(t, 995000, payer.Quota)
			for _, table := range []any{&model.AppTaskSettlement{}, &model.AppTaskOutbox{}} {
				var count int64
				require.NoError(t, model.DB.Model(table).Count(&count).Error)
				assert.Zero(t, count)
			}
			var lease model.AppTaskReconcile
			require.NoError(t, model.DB.First(&lease, "execution_id = ?", execution.ID).Error)
			assert.NotEmpty(t, lease.LastObservationError)
			assert.Greater(t, lease.NextAttemptAt, now.Unix())
			if test.name == "source changed" || test.name == "write descriptor" {
				assert.Zero(t, queries.Load())
			} else {
				assert.Equal(t, int32(1), queries.Load())
			}
		})
	}
	t.Run("cancellation reaches the provider query", func(t *testing.T) {
		arrived, release := make(chan struct{}), make(chan struct{})
		upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			close(arrived)
			select {
			case <-r.Context().Done():
			case <-release:
			}
		}))
		t.Cleanup(upstream.Close)
		t.Cleanup(func() { close(release) })
		_, now := routerAppWorkerExecution(t, upstream.URL, "")
		ctx, cancel := context.WithCancel(t.Context())
		defer cancel()
		done := make(chan error, 1)
		go func() {
			_, err := service.RunAppTaskReconcileOnce(ctx, model.DB, now)
			done <- err
		}()
		select {
		case <-arrived:
		case <-time.After(5 * time.Second):
			t.Fatal("provider query did not start")
		}
		cancel()
		select {
		case err := <-done:
			require.Error(t, err)
		case <-time.After(5 * time.Second):
			t.Fatal("provider query ignored cancellation")
		}
	})
	t.Run("nonterminal observations reschedule without settling", func(t *testing.T) {
		var queries atomic.Int32
		upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.Header().Set("Content-Type", "application/json")
			if queries.Add(1) == 1 {
				_, _ = io.WriteString(w, `{"id":"cgt-host-worker","status":"running"}`)
				return
			}
			_, _ = io.WriteString(w, appWorkerSuccessResponse)
		}))
		t.Cleanup(upstream.Close)
		execution, now := routerAppWorkerExecution(t, upstream.URL, "")
		worked, err := service.RunAppTaskReconcileOnce(t.Context(), model.DB, now)
		require.NoError(t, err)
		require.True(t, worked)
		var saved model.AppTaskExecution
		require.NoError(t, model.DB.First(&saved, execution.ID).Error)
		assert.Equal(t, "running", saved.ProviderState)
		assert.Equal(t, "reserved", saved.BillingState)
		assert.True(t, model.HasPendingAppTaskReconciliation())
		worked, err = service.RunAppTaskReconcileOnce(t.Context(), model.DB, now.Add(time.Second))
		require.NoError(t, err)
		assert.False(t, worked)
		assert.Equal(t, int32(1), queries.Load())
		worked, err = service.RunAppTaskReconcileOnce(t.Context(), model.DB, now.Add(time.Minute))
		require.NoError(t, err)
		assert.True(t, worked)
		assert.Equal(t, int32(2), queries.Load())
		assert.False(t, model.HasPendingAppTaskReconciliation())
		require.NoError(t, model.DB.First(&saved, execution.ID).Error)
		assert.Equal(t, "settled", saved.BillingState)
	})
}

func TestHostAppTaskLegacyBoundaries(t *testing.T) {
	for _, entry := range []string{"poll lists", "refund", "adjustment", "poll request"} {
		t.Run(entry, func(t *testing.T) {
			var queries atomic.Int32
			upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				queries.Add(1)
				w.Header().Set("Content-Type", "application/json")
				_, _ = io.WriteString(w, appWorkerSuccessResponse)
			}))
			t.Cleanup(upstream.Close)
			execution, now := routerAppWorkerExecution(t, upstream.URL, "")
			var projection model.Task
			require.NoError(t, model.DB.Where("task_id = ?", execution.TaskID).First(&projection).Error)
			before := projection
			switch entry {
			case "poll lists":
				assert.Empty(t, model.GetAllUnFinishSyncTasks(10), "legacy poller must exclude App tasks")
				assert.Empty(t, model.GetTimedOutUnfinishedTasks(now.Unix(), 10), "legacy timeout sweep must exclude App tasks")
				assert.False(t, model.HasUnfinishedSyncTasks())
			case "refund":
				assert.False(t, service.RefundTaskQuota(t.Context(), &projection, "legacy"),
					"legacy refund must refuse App tasks")
			case "adjustment":
				service.RecalculateTaskQuota(t.Context(), &projection, 6000, "legacy")
			case "poll request":
				oldFactory := service.GetTaskAdaptorFunc
				service.GetTaskAdaptorFunc = func(platform constant.TaskPlatform) service.TaskPollingAdaptor {
					return relay.GetTaskAdaptor(platform)
				}
				t.Cleanup(func() { service.GetTaskAdaptorFunc = oldFactory })
				require.NoError(t, service.UpdateVideoTasks(t.Context(), constant.TaskPlatform("doubao"),
					map[int][]string{execution.ChannelID: {execution.ProviderTaskID}},
					map[string]*model.Task{execution.ProviderTaskID: &projection}))
			}
			assert.Zero(t, queries.Load(), "legacy polling must not query App tasks")
			var payer model.User
			require.NoError(t, model.DB.First(&payer, execution.UserID).Error)
			assert.Equal(t, 995000, payer.Quota, "legacy entry must leave the App reservation unchanged")
			assert.Zero(t, payer.UsedQuota)
			var after model.Task
			require.NoError(t, model.DB.First(&after, projection.ID).Error)
			assert.Equal(t, before, after, "only the Host worker may project App task observations")
		})
	}
}
