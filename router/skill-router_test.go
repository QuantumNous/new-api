package router

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strconv"
	"strings"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/internal/skill/enums"
	skillhandler "github.com/QuantumNous/new-api/internal/skill/handler"
	skillmodel "github.com/QuantumNous/new-api/internal/skill/model"
	"github.com/QuantumNous/new-api/middleware"
	platformmodel "github.com/QuantumNous/new-api/model"
	"github.com/gin-contrib/sessions"
	"github.com/gin-contrib/sessions/cookie"
	"github.com/gin-gonic/gin"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func TestSkillRouterMarketplaceListEnvelope(t *testing.T) {
	engine := newSkillTestRouter(t, false)

	w := performSkillRequest(engine, http.MethodGet, "/api/v1/marketplace/skills?page=1&limit=20", "")

	require.Equal(t, http.StatusOK, w.Code)
	var got struct {
		Data []struct {
			Slug string `json:"slug"`
		} `json:"data"`
		Pagination struct {
			Page  int   `json:"page"`
			Limit int   `json:"limit"`
			Total int64 `json:"total"`
		} `json:"pagination"`
		Meta struct {
			RequestID string `json:"request_id"`
		} `json:"meta"`
	}
	require.NoError(t, json.Unmarshal(w.Body.Bytes(), &got))
	require.Len(t, got.Data, 1)
	assert.Equal(t, "published-skill", got.Data[0].Slug)
	assert.Equal(t, 1, got.Pagination.Page)
	assert.Equal(t, 20, got.Pagination.Limit)
	assert.Equal(t, int64(1), got.Pagination.Total)
	assert.NotEmpty(t, got.Meta.RequestID)
	assert.Equal(t, got.Meta.RequestID, w.Header().Get(common.RequestIdKey))
}

func TestSkillRouterMarketplaceListAcceptsAccessTokenAuth(t *testing.T) {
	engine := newSkillTestRouter(t, false)
	db := platformmodel.DB
	token := "marketplace-access-token"
	require.NoError(t, db.Create(&platformmodel.User{
		Id:          55,
		Username:    "token-user",
		Password:    "password123",
		Status:      common.UserStatusEnabled,
		Role:        common.RoleCommonUser,
		Group:       string(enums.RequiredPlanFree),
		AccessToken: &token,
	}).Error)

	var skill skillmodel.Skill
	require.NoError(t, db.Where("slug = ?", "published-skill").First(&skill).Error)
	require.NoError(t, skillmodel.EnableSkillForUser(db, 55, 55, skill.ID, "marketplace"))

	w := performSkillRequestWithHeaders(engine, http.MethodGet, "/api/v1/marketplace/skills", map[string]string{
		"Authorization": "Bearer " + token,
		"New-Api-User":  "55",
	})

	require.Equal(t, http.StatusOK, w.Code)
	var got struct {
		Data []struct {
			Slug         string `json:"slug"`
			Availability struct {
				Enabled  *bool   `json:"enabled"`
				Locked   bool    `json:"locked"`
				LockCode *string `json:"lock_code"`
				CTA      string  `json:"cta"`
			} `json:"availability"`
		} `json:"data"`
	}
	require.NoError(t, json.Unmarshal(w.Body.Bytes(), &got))
	require.Len(t, got.Data, 1)
	assert.Equal(t, "published-skill", got.Data[0].Slug)
	require.NotNil(t, got.Data[0].Availability.Enabled)
	assert.True(t, *got.Data[0].Availability.Enabled)
	assert.False(t, got.Data[0].Availability.Locked)
	assert.Nil(t, got.Data[0].Availability.LockCode)
	assert.Equal(t, "use", got.Data[0].Availability.CTA)
}

func TestSkillRouterRejectsInvalidSortWithInvalidRequest(t *testing.T) {
	engine := newSkillTestRouter(t, false)

	w := performSkillRequest(engine, http.MethodGet, "/api/v1/marketplace/skills?sort=bad", "")

	require.Equal(t, http.StatusBadRequest, w.Code)
	assert.Contains(t, w.Body.String(), `"code":"INVALID_REQUEST"`)
	assert.Contains(t, w.Body.String(), `"request_id":`)
}

func TestSkillRouterAdminAuthFailureUsesEnvelope(t *testing.T) {
	engine := newSkillTestRouter(t, false)

	w := performSkillRequest(engine, http.MethodGet, "/api/v1/admin/skills", "")

	require.Equal(t, http.StatusUnauthorized, w.Code)
	assert.Contains(t, w.Body.String(), `"code":"AUTH_REQUIRED"`)
	assert.Contains(t, w.Body.String(), `"request_id":`)
	assert.NotContains(t, w.Body.String(), `"success":false`)
}

func TestSkillRouterOpsAuthFailureUsesEnvelope(t *testing.T) {
	engine := newSkillTestRouter(t, false)

	w := performSkillRequest(engine, http.MethodGet, "/api/v1/ops/skills/summary", "")

	require.Equal(t, http.StatusUnauthorized, w.Code)
	assert.Contains(t, w.Body.String(), `"code":"AUTH_REQUIRED"`)
	assert.Contains(t, w.Body.String(), `"request_id":`)
	assert.NotContains(t, w.Body.String(), `"success":false`)
}

func TestSkillRouterSkillAnalyticsAuthFailureUsesEnvelope(t *testing.T) {
	engine := newSkillTestRouter(t, false)

	overview := performSkillRequest(engine, http.MethodGet, "/api/v1/ops/skill-analytics/overview", "")
	skills := performSkillRequest(engine, http.MethodGet, "/api/v1/ops/skill-analytics/skills", "")

	require.Equal(t, http.StatusUnauthorized, overview.Code)
	assert.Contains(t, overview.Body.String(), `"code":"AUTH_REQUIRED"`)
	assert.Contains(t, overview.Body.String(), `"request_id":`)
	require.Equal(t, http.StatusUnauthorized, skills.Code)
	assert.Contains(t, skills.Body.String(), `"code":"AUTH_REQUIRED"`)
	assert.Contains(t, skills.Body.String(), `"request_id":`)
}

func TestSkillRouterMySkillsRequiresAuth(t *testing.T) {
	engine := newSkillTestRouter(t, false)

	w := performSkillRequest(engine, http.MethodGet, "/api/v1/marketplace/my-skills", "")

	require.Equal(t, http.StatusUnauthorized, w.Code)
	assert.Contains(t, w.Body.String(), `"code":"AUTH_REQUIRED"`)
	assert.Contains(t, w.Body.String(), `"request_id":`)
}

func TestSkillRouterMarketplaceSkillEventRouteUsesExistingHandler(t *testing.T) {
	engine := newSkillTestRouter(t, false)

	w := performSkillRequestWithBody(
		engine,
		http.MethodPost,
		"/api/v1/marketplace/skills/published-skill/events",
		`{"event_type":"skill_impression","entry_point":"marketplace_card"}`,
	)

	require.Equal(t, http.StatusNoContent, w.Code)
}

func TestSkillRouterRateLimitUsesEnvelopeAndRetryAfter(t *testing.T) {
	engine := newSkillTestRouter(t, true)

	first := performSkillRequest(engine, http.MethodGet, "/api/v1/marketplace/skills", "198.51.100.44:1234")
	second := performSkillRequest(engine, http.MethodGet, "/api/v1/marketplace/skills", "198.51.100.44:1234")

	require.Equal(t, http.StatusOK, first.Code)
	require.Equal(t, http.StatusTooManyRequests, second.Code)
	assert.NotEmpty(t, second.Header().Get("Retry-After"))
	assert.Contains(t, second.Body.String(), `"code":"SKILL_RATE_LIMITED"`)
	assert.Contains(t, second.Body.String(), `"retry_after":`)
	assert.Contains(t, second.Body.String(), `"request_id":`)
}

func newSkillTestRouter(t *testing.T, enableRateLimit bool) *gin.Engine {
	t.Helper()
	gin.SetMode(gin.TestMode)
	restoreSkillRouterGlobals(t, enableRateLimit)
	db := newSkillRouterTestDB(t)
	oldDB := platformmodel.DB
	platformmodel.DB = db
	t.Cleanup(func() { platformmodel.DB = oldDB })
	skillhandler.SetDB(db)

	engine := gin.New()
	engine.Use(middleware.RequestId())
	store := cookie.NewStore([]byte("skill-router-test-secret"))
	engine.Use(sessions.Sessions("session", store))
	SetSkillRouter(engine)
	return engine
}

func restoreSkillRouterGlobals(t *testing.T, enableRateLimit bool) {
	t.Helper()
	oldEnabled := common.GlobalApiRateLimitEnable
	oldNum := common.GlobalApiRateLimitNum
	oldDuration := common.GlobalApiRateLimitDuration
	oldRedisEnabled := common.RedisEnabled
	common.GlobalApiRateLimitEnable = enableRateLimit
	common.GlobalApiRateLimitNum = 1
	common.GlobalApiRateLimitDuration = 60
	common.RedisEnabled = false
	t.Cleanup(func() {
		common.GlobalApiRateLimitEnable = oldEnabled
		common.GlobalApiRateLimitNum = oldNum
		common.GlobalApiRateLimitDuration = oldDuration
		common.RedisEnabled = oldRedisEnabled
	})
}

func performSkillRequest(engine *gin.Engine, method, url string, remoteAddr string) *httptest.ResponseRecorder {
	w := httptest.NewRecorder()
	req := httptest.NewRequest(method, url, nil)
	if remoteAddr != "" {
		req.RemoteAddr = remoteAddr
	}
	engine.ServeHTTP(w, req)
	return w
}

func performSkillRequestWithHeaders(engine *gin.Engine, method, url string, headers map[string]string) *httptest.ResponseRecorder {
	w := httptest.NewRecorder()
	req := httptest.NewRequest(method, url, nil)
	for key, value := range headers {
		req.Header.Set(key, value)
	}
	engine.ServeHTTP(w, req)
	return w
}

func performSkillRequestWithBody(engine *gin.Engine, method, url string, body string) *httptest.ResponseRecorder {
	w := httptest.NewRecorder()
	req := httptest.NewRequest(method, url, strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	engine.ServeHTTP(w, req)
	return w
}

func newSkillRouterTestDB(t *testing.T) *gorm.DB {
	t.Helper()
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	require.NoError(t, err)
	require.NoError(t, skillmodel.MigrateSkills(db))
	require.NoError(t, skillmodel.MigrateUserEnabledSkills(db))
	require.NoError(t, skillmodel.MigrateUserSavedSkills(db))
	require.NoError(t, skillmodel.MigrateSkillUsageEvents(db))
	require.NoError(t, db.AutoMigrate(&platformmodel.User{}))
	published := routerTestSkill("published-skill", enums.SkillStatusPublished)
	draft := routerTestSkill("draft-skill", enums.SkillStatusDraft)
	require.NoError(t, db.Create(&published).Error)
	require.NoError(t, db.Create(&draft).Error)
	return db
}

func routerTestSkill(slug string, status enums.SkillStatus) skillmodel.Skill {
	now := time.Now().UTC()
	return skillmodel.Skill{
		Slug:                 slug,
		Status:               status,
		Category:             "writing",
		Tags:                 skillmodel.SkillJSONB(`["writing"]`),
		DefaultLocale:        "en",
		Name:                 slug,
		ShortDescription:     "short " + slug,
		Description:          "long " + slug,
		InputHints:           skillmodel.SkillJSONB(`[]`),
		ExampleInputs:        skillmodel.SkillJSONB(`[]`),
		ExampleOutputs:       skillmodel.SkillJSONB(`[]`),
		RequiredPlan:         enums.RequiredPlanFree,
		MonetizationType:     enums.MonetizationTypeFree,
		ModelWhitelist:       skillmodel.SkillJSONB(`["smart-tier"]`),
		TimeoutSeconds:       45,
		KidsApprovalStatus:   enums.KidsApprovalStatusNotRequired,
		AIDisclosureRequired: true,
		CreatedBy:            1,
		PublishedAt:          &now,
		FeaturedRank:         intPtr(len(slug)),
	}
}

func intPtr(v int) *int {
	return &v
}

func TestSkillRouterAdminUserRateLimitUsesAuthenticatedUser(t *testing.T) {
	engine := newSkillTestRouter(t, true)
	cookieValue := signedSessionCookie(t, 10, common.RoleRootUser)

	first := performAuthedSkillRequest(engine, "/api/v1/admin/skills", cookieValue, 10)
	second := performAuthedSkillRequest(engine, "/api/v1/admin/skills", cookieValue, 10)

	require.Equal(t, http.StatusOK, first.Code)
	require.Equal(t, http.StatusTooManyRequests, second.Code)
	assert.Contains(t, second.Body.String(), `"code":"SKILL_RATE_LIMITED"`)
	assert.NotEmpty(t, second.Header().Get("Retry-After"))
}

func performAuthedSkillRequest(engine *gin.Engine, url string, cookieValue string, userID int) *httptest.ResponseRecorder {
	w := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, url, nil)
	req.AddCookie(&http.Cookie{Name: "session", Value: cookieValue})
	req.Header.Set("New-Api-User", strconv.Itoa(userID))
	engine.ServeHTTP(w, req)
	return w
}

func signedSessionCookie(t *testing.T, userID int, role int) string {
	t.Helper()
	engine := gin.New()
	store := cookie.NewStore([]byte("skill-router-test-secret"))
	engine.Use(sessions.Sessions("session", store))
	engine.GET("/login", func(c *gin.Context) {
		session := sessions.Default(c)
		session.Set("username", "root")
		session.Set("role", role)
		session.Set("id", userID)
		session.Set("status", common.UserStatusEnabled)
		session.Set("group", "default")
		require.NoError(t, session.Save())
	})
	w := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/login", nil)
	engine.ServeHTTP(w, req)
	for _, cookie := range w.Result().Cookies() {
		if cookie.Name == "session" {
			return cookie.Value
		}
	}
	t.Fatal("session cookie not set")
	return ""
}
