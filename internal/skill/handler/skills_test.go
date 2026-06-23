package handler

import (
	"bytes"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/internal/skill/enums"
	skillmodel "github.com/QuantumNous/new-api/internal/skill/model"
	appmodel "github.com/QuantumNous/new-api/model"
	platformmodel "github.com/QuantumNous/new-api/model"
	"github.com/gin-gonic/gin"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func TestListMarketplaceSkillsEnvelopeAndPagination(t *testing.T) {
	db := testSkillDB(t)
	SetDB(db)
	published := testSkill("published-skill", "published")
	require.NoError(t, db.Create(&published).Error)
	draft := testSkill("draft-skill", "draft")
	require.NoError(t, db.Create(&draft).Error)

	c, w := testContext("/api/v1/marketplace/skills?page=1&limit=20&sort=name")
	ListMarketplaceSkills(c)

	require.Equal(t, http.StatusOK, w.Code)
	var got struct {
		Data []struct {
			Slug string `json:"slug"`
		} `json:"data"`
		Pagination struct {
			Page    int   `json:"page"`
			Limit   int   `json:"limit"`
			Total   int64 `json:"total"`
			HasNext bool  `json:"has_next"`
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
	assert.False(t, got.Pagination.HasNext)
	assert.NotEmpty(t, got.Meta.RequestID)
}

func TestListMarketplaceSkills_DR52PublicShapeAndAnonymousAvailability(t *testing.T) {
	db := testSkillDB(t)
	SetDB(db)
	s := testSkill("pro-featured", "published")
	s.RequiredPlan = enums.RequiredPlanPro
	s.FeaturedFlag = true
	require.NoError(t, db.Create(&s).Error)

	c, w := testContext("/api/v1/marketplace/skills")
	ListMarketplaceSkills(c)

	require.Equal(t, http.StatusOK, w.Code)
	body := w.Body.String()
	assert.NotContains(t, body, `"description":`, "list response must not expose detail description")
	assert.NotContains(t, body, `"featured_flag":`, "list response must expose featured, not featured_flag")
	assert.NotContains(t, body, `"published_at":`, "list response must not expose admin/detail timestamps")
	assert.NotContains(t, body, `"ai_disclosure_required":`, "list response must be limited to DR-52 fields")

	var got struct {
		Data []struct {
			Slug         string   `json:"slug"`
			RequiredPlan string   `json:"required_plan"`
			Badges       []string `json:"badges"`
			Featured     bool     `json:"featured"`
			Availability struct {
				Enabled  *bool  `json:"enabled"`
				Locked   bool   `json:"locked"`
				LockCode string `json:"lock_code"`
				CTA      string `json:"cta"`
			} `json:"availability"`
		} `json:"data"`
	}
	require.NoError(t, json.Unmarshal(w.Body.Bytes(), &got))
	require.Len(t, got.Data, 1)
	assert.Equal(t, "pro-featured", got.Data[0].Slug)
	assert.Equal(t, "pro", got.Data[0].RequiredPlan)
	assert.Equal(t, []string{"pro", "featured"}, got.Data[0].Badges)
	assert.True(t, got.Data[0].Featured)
	assert.Nil(t, got.Data[0].Availability.Enabled)
	assert.True(t, got.Data[0].Availability.Locked)
	assert.Equal(t, "AUTH_REQUIRED", got.Data[0].Availability.LockCode)
	assert.Equal(t, "login", got.Data[0].Availability.CTA)
}

func TestListMarketplaceSkills_DR52FiltersAndPublicSearch(t *testing.T) {
	db := testSkillDB(t)
	SetDB(db)
	target := testSkill("target-skill", "published")
	target.Name = "Public Match"
	target.ShortDescription = "planner helper"
	target.Category = "planning"
	target.RequiredPlan = enums.RequiredPlanPro
	target.FeaturedFlag = true
	target.IsKidsSafe = true
	require.NoError(t, db.Create(&target).Error)
	descriptionHit := testSkill("description-hit", "published")
	descriptionHit.Name = "Ordinary Name"
	descriptionHit.ShortDescription = "ordinary short"
	descriptionHit.Description = "Public Match from public detail description"
	descriptionHit.Category = "planning"
	descriptionHit.RequiredPlan = enums.RequiredPlanPro
	descriptionHit.FeaturedFlag = true
	descriptionHit.IsKidsSafe = true
	require.NoError(t, db.Create(&descriptionHit).Error)

	c, w := testContext("/api/v1/marketplace/skills?category=planning&query=Public%20Match&plan=pro&featured=true&kids_safe=true&locale=zh")
	ListMarketplaceSkills(c)

	require.Equal(t, http.StatusOK, w.Code)
	var got struct {
		Data []struct {
			Slug string `json:"slug"`
		} `json:"data"`
		Pagination struct {
			Total int64 `json:"total"`
		} `json:"pagination"`
	}
	require.NoError(t, json.Unmarshal(w.Body.Bytes(), &got))
	require.Len(t, got.Data, 2)
	assert.ElementsMatch(t, []string{"target-skill", "description-hit"}, []string{got.Data[0].Slug, got.Data[1].Slug})
	assert.Equal(t, int64(2), got.Pagination.Total)
}

func TestListMarketplaceSkills_PublicSearchClauseUsesPGFullTextIndex(t *testing.T) {
	clause, args := publicSearchClause("postgres", "Public Match")

	assert.Contains(t, clause, "to_tsvector('simple'")
	assert.Contains(t, clause, "plainto_tsquery('simple', ?)")
	assert.NotContains(t, clause, "LIKE")
	assert.Equal(t, []any{"Public Match"}, args)
}

func TestListMarketplaceSkills_PublicSearchClauseEscapesLikeFallback(t *testing.T) {
	clause, args := publicSearchClause("sqlite", "100%_match!")

	assert.Contains(t, clause, "LIKE")
	assert.Equal(t, []any{"%100!%!_match!!%", "%100!%!_match!!%", "%100!%!_match!!%"}, args)
}

func TestListMarketplaceSkills_PublicQuerySelectsMinimumFields(t *testing.T) {
	db := testSkillDB(t)

	stmt := listMarketplaceSkillsPublicQuery(db.Session(&gorm.Session{DryRun: true})).
		Find(&[]skillmodel.Skill{}).Statement
	sql := stmt.SQL.String()

	for _, col := range []string{
		"`id`",
		"`slug`",
		"`name`",
		"`category`",
		"`short_description`",
		"`status`",
		"`required_plan`",
		"`free_quota_per_month`",
		"`featured_flag`",
		"`featured_rank`",
		"`is_kids_safe`",
		"`is_kids_exclusive`",
	} {
		assert.Contains(t, sql, col)
	}
	for _, privateCol := range []string{
		"`description`",
		"`input_hints`",
		"`example_inputs`",
		"`example_outputs`",
		"`model_whitelist`",
		"`active_version_id`",
		"`price_markup`",
	} {
		assert.NotContains(t, sql, privateCol)
	}
}

func TestListMarketplaceSkills_DR52HidesDraftArchivedDeprecated(t *testing.T) {
	db := testSkillDB(t)
	SetDB(db)
	for _, status := range []string{"published", "draft", "archived", "deprecated"} {
		require.NoError(t, db.Create(ptr(testSkill(status+"-skill", status))).Error)
	}

	c, w := testContext("/api/v1/marketplace/skills")
	ListMarketplaceSkills(c)

	require.Equal(t, http.StatusOK, w.Code)
	var got struct {
		Data []struct {
			Slug string `json:"slug"`
		} `json:"data"`
		Pagination struct {
			Total int64 `json:"total"`
		} `json:"pagination"`
	}
	require.NoError(t, json.Unmarshal(w.Body.Bytes(), &got))
	require.Len(t, got.Data, 1)
	assert.Equal(t, "published-skill", got.Data[0].Slug)
	assert.Equal(t, int64(1), got.Pagination.Total)
}

func TestListMarketplaceSkills_DR52AuthenticatedAvailability(t *testing.T) {
	db := testSkillDB(t)
	SetDB(db)
	require.NoError(t, db.AutoMigrate(&appmodel.User{}))
	proSkill := testSkill("enabled-pro-skill", "published")
	proSkill.RequiredPlan = enums.RequiredPlanPro
	require.NoError(t, db.Create(&proSkill).Error)
	require.NoError(t, db.Create(&appmodel.User{
		Id:       42,
		Username: "pro-user",
		Password: "password123",
		Status:   common.UserStatusEnabled,
		Group:    string(enums.RequiredPlanPro),
	}).Error)
	require.NoError(t, skillmodel.EnableSkillForUser(db, 42, 42, proSkill.ID, "marketplace"))

	c, w := testContext("/api/v1/marketplace/skills")
	c.Set("id", 42)
	ListMarketplaceSkills(c)

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
	assert.Equal(t, "enabled-pro-skill", got.Data[0].Slug)
	require.NotNil(t, got.Data[0].Availability.Enabled)
	assert.True(t, *got.Data[0].Availability.Enabled)
	assert.False(t, got.Data[0].Availability.Locked)
	assert.Nil(t, got.Data[0].Availability.LockCode)
	assert.Equal(t, "use", got.Data[0].Availability.CTA)
}

func TestListMarketplaceSkillsRejectsInvalidPagination(t *testing.T) {
	SetDB(testSkillDB(t))
	c, w := testContext("/api/v1/marketplace/skills?limit=101")

	ListMarketplaceSkills(c)

	require.Equal(t, http.StatusBadRequest, w.Code)
	assert.Contains(t, w.Body.String(), `"error":`)
	assert.Contains(t, w.Body.String(), `"request_id":`)
}

func TestGetMarketplaceSkillNotFoundEnvelope(t *testing.T) {
	SetDB(testSkillDB(t))
	c, w := testContext("/api/v1/marketplace/skills/missing")
	c.Params = gin.Params{{Key: "id", Value: "missing"}}

	GetMarketplaceSkill(c)

	require.Equal(t, http.StatusNotFound, w.Code)
	assert.Contains(t, w.Body.String(), `"code":"SKILL_NOT_FOUND"`)
	assert.Contains(t, w.Body.String(), `"request_id":`)
}

// TestGetMarketplaceSkill_ReturnsDetailFields verifies that the detail endpoint
// includes requires_deeprouter_key: true and a download_cta pointing to the
// DR-81 download endpoint (DR-53 acceptance criteria).
func TestGetMarketplaceSkill_ReturnsDetailFields(t *testing.T) {
	db := testSkillDB(t)
	SetDB(db)
	require.NoError(t, db.Create(ptr(testSkill("my-skill", "published"))).Error)

	c, w := testContext("/api/v1/marketplace/skills/my-skill")
	c.Params = gin.Params{{Key: "id", Value: "my-skill"}}
	GetMarketplaceSkill(c)

	require.Equal(t, http.StatusOK, w.Code)
	var got struct {
		Data struct {
			Slug                  string `json:"slug"`
			RequiresDeepRouterKey bool   `json:"requires_deeprouter_key"`
			DownloadCTA           struct {
				URL    string `json:"url"`
				Method string `json:"method"`
			} `json:"download_cta"`
		} `json:"data"`
	}
	require.NoError(t, json.Unmarshal(w.Body.Bytes(), &got))
	assert.Equal(t, "my-skill", got.Data.Slug)
	assert.True(t, got.Data.RequiresDeepRouterKey, "requires_deeprouter_key must be true for all published skills")
	assert.Equal(t, "/api/v1/marketplace/skills/my-skill/download", got.Data.DownloadCTA.URL)
	assert.Equal(t, "GET", got.Data.DownloadCTA.Method)
}

// TestGetMarketplaceSkill_NoProviderCredentialsExposed guards the DR-53 security
// requirement: detail response must not leak routing credentials or internal fields.
func TestGetMarketplaceSkill_NoProviderCredentialsExposed(t *testing.T) {
	db := testSkillDB(t)
	SetDB(db)
	require.NoError(t, db.Create(ptr(testSkill("secure-skill", "published"))).Error)

	c, w := testContext("/api/v1/marketplace/skills/secure-skill")
	c.Params = gin.Params{{Key: "id", Value: "secure-skill"}}
	GetMarketplaceSkill(c)

	require.Equal(t, http.StatusOK, w.Code)
	body := w.Body.String()
	assert.NotContains(t, body, "instruction_template", "instruction_template must not be exposed")
	assert.NotContains(t, body, "model_whitelist", "model_whitelist must not be exposed")
	assert.NotContains(t, body, "price_markup", "provider pricing must not be exposed")
	assert.NotContains(t, body, "monetization_type", "internal monetization type must not be exposed")
}

// TestGetMarketplaceSkill_CTAEscapesSlug verifies that a slug containing
// URL-unsafe characters is properly escaped in the download_cta.url so the
// CTA never produces a broken link (DR-53 hardening).
func TestGetMarketplaceSkill_CTAEscapesSlug(t *testing.T) {
	db := testSkillDB(t)
	SetDB(db)
	s := testSkill("slug with spaces", "published")
	require.NoError(t, db.Create(&s).Error)

	c, w := testContext("/api/v1/marketplace/skills/slug+with+spaces")
	c.Params = gin.Params{{Key: "id", Value: "slug with spaces"}}
	GetMarketplaceSkill(c)

	require.Equal(t, http.StatusOK, w.Code)
	var got struct {
		Data struct {
			DownloadCTA struct {
				URL string `json:"url"`
			} `json:"download_cta"`
		} `json:"data"`
	}
	require.NoError(t, json.Unmarshal(w.Body.Bytes(), &got))
	assert.Equal(t, "/api/v1/marketplace/skills/slug%20with%20spaces/download", got.Data.DownloadCTA.URL,
		"URL-unsafe characters in slug must be percent-encoded in download_cta.url")
}

// TestGetMarketplaceSkill_ListDoesNotExposeDetailFields guards against regression
// where list endpoint accidentally starts returning PublicSkillDetail fields.
// requires_deeprouter_key and download_cta must only appear on the detail endpoint.
func TestGetMarketplaceSkill_ListDoesNotExposeDetailFields(t *testing.T) {
	db := testSkillDB(t)
	SetDB(db)
	require.NoError(t, db.Create(ptr(testSkill("list-skill", "published"))).Error)

	c, w := testContext("/api/v1/marketplace/skills")
	ListMarketplaceSkills(c)

	require.Equal(t, http.StatusOK, w.Code)
	body := w.Body.String()
	assert.NotContains(t, body, "requires_deeprouter_key", "detail fields must not leak into list response")
	assert.NotContains(t, body, "download_cta", "detail fields must not leak into list response")
}

// TestGetMarketplaceSkill_LookupByID_CTAUsesSlug verifies that when the skill
// is fetched by its UUID (not slug), the download_cta.url still uses the slug.
// Slugs are stable human-readable identifiers; the CTA must not expose internal UUIDs.
func TestGetMarketplaceSkill_LookupByID_CTAUsesSlug(t *testing.T) {
	db := testSkillDB(t)
	SetDB(db)
	s := testSkill("slug-check-skill", "published")
	require.NoError(t, db.Create(&s).Error)
	// Fetch the auto-generated UUID from DB.
	var created skillmodel.Skill
	require.NoError(t, db.Where("slug = ?", "slug-check-skill").First(&created).Error)

	c, w := testContext("/api/v1/marketplace/skills/" + created.ID)
	c.Params = gin.Params{{Key: "id", Value: created.ID}}
	GetMarketplaceSkill(c)

	require.Equal(t, http.StatusOK, w.Code)
	var got struct {
		Data struct {
			DownloadCTA struct {
				URL string `json:"url"`
			} `json:"download_cta"`
		} `json:"data"`
	}
	require.NoError(t, json.Unmarshal(w.Body.Bytes(), &got))
	assert.Equal(t, "/api/v1/marketplace/skills/slug-check-skill/download", got.Data.DownloadCTA.URL,
		"download_cta.url must use slug even when fetched by UUID")
}

func TestRecordMarketplaceSkillEvent_AcceptsRecommendedImpression(t *testing.T) {
	db := testSkillDB(t)
	SetDB(db)
	require.NoError(t, db.AutoMigrate(&platformmodel.User{}))
	s := testSkill("recommended-skill", "published")
	require.NoError(t, db.Create(&s).Error)

	c, w := testContextWithMethod(http.MethodPost, "/api/v1/marketplace/skills/recommended-skill/events",
		`{"event_type":"skill_impression","entry_point":"recommended"}`)
	c.Params = gin.Params{{Key: "id", Value: "recommended-skill"}}
	c.Set("id", 42)
	c.Set("group", "pro")
	require.NoError(t, db.Create(&platformmodel.User{
		Id:       42,
		Username: "event-user",
		Password: "password123",
		Role:     1,
		Status:   1,
		Group:    "pro",
	}).Error)

	RecordMarketplaceSkillEvent(c)

	require.Equal(t, http.StatusNoContent, w.Code)
	var evt skillmodel.SkillUsageEvent
	require.NoError(t, db.Where("skill_id = ?", s.ID).First(&evt).Error)
	assert.Equal(t, enums.SkillUsageEventTypeImpression, evt.EventType)
	assert.Equal(t, enums.EntryPointRecommended, evt.EntryPoint)
	require.NotNil(t, evt.UserID)
	assert.Equal(t, int64(42), *evt.UserID)
	require.NotNil(t, evt.Plan)
	assert.Equal(t, enums.RequiredPlanPro, *evt.Plan)
}

func TestRecordMarketplaceSkillEvent_RejectsPackageEntryPoint(t *testing.T) {
	db := testSkillDB(t)
	SetDB(db)
	s := testSkill("package-entry-skill", "published")
	require.NoError(t, db.Create(&s).Error)

	c, w := testContextWithMethod(http.MethodPost, "/api/v1/marketplace/skills/package-entry-skill/events",
		`{"event_type":"skill_impression","entry_point":"skill_package"}`)
	c.Params = gin.Params{{Key: "id", Value: "package-entry-skill"}}

	RecordMarketplaceSkillEvent(c)

	require.Equal(t, http.StatusBadRequest, w.Code)
	var count int64
	require.NoError(t, db.Model(&skillmodel.SkillUsageEvent{}).Count(&count).Error)
	assert.Equal(t, int64(0), count)
}

// TestGetMarketplaceSkill_NonPublishedReturns404 verifies that draft, deprecated,
// and archived skills are not accessible via the public marketplace detail endpoint.
func TestGetMarketplaceSkill_NonPublishedReturns404(t *testing.T) {
	for _, status := range []string{"draft", "deprecated", "archived"} {
		t.Run("status="+status, func(t *testing.T) {
			db := testSkillDB(t)
			SetDB(db)
			require.NoError(t, db.Create(ptr(testSkill("hidden-skill", status))).Error)

			c, w := testContext("/api/v1/marketplace/skills/hidden-skill")
			c.Params = gin.Params{{Key: "id", Value: "hidden-skill"}}
			GetMarketplaceSkill(c)

			require.Equal(t, http.StatusNotFound, w.Code,
				"status=%s must not be accessible via public marketplace endpoint", status)
			assert.Contains(t, w.Body.String(), `"code":"SKILL_NOT_FOUND"`)
		})
	}
}

func TestListMySkillsReturnsCallerEnabledSkillsWithAvailability(t *testing.T) {
	db := testMySkillDB(t)
	SetDB(db)

	published := testSkill("published-enabled", "published")
	deprecated := testSkill("deprecated-enabled", "deprecated")
	archived := testSkill("archived-enabled", "archived")
	disabled := testSkill("disabled-skill", "published")
	otherUser := testSkill("other-user-skill", "published")
	for _, s := range []*skillmodel.Skill{&published, &deprecated, &archived, &disabled, &otherUser} {
		require.NoError(t, db.Create(s).Error)
	}

	enabledAt := time.Date(2026, 6, 15, 0, 0, 0, 0, time.UTC)
	lastUsedAt := enabledAt.Add(2 * time.Hour)
	require.NoError(t, db.Create(&skillmodel.UserEnabledSkill{
		UserID:     42,
		TenantID:   42,
		SkillID:    published.ID,
		Enabled:    true,
		EnabledAt:  enabledAt,
		LastUsedAt: &lastUsedAt,
		Source:     "marketplace",
	}).Error)
	require.NoError(t, db.Create(&skillmodel.UserEnabledSkill{
		UserID:    42,
		TenantID:  42,
		SkillID:   deprecated.ID,
		Enabled:   true,
		EnabledAt: enabledAt.Add(-time.Hour),
		Source:    "marketplace",
	}).Error)
	require.NoError(t, db.Create(&skillmodel.UserEnabledSkill{
		UserID:    42,
		TenantID:  42,
		SkillID:   archived.ID,
		Enabled:   true,
		EnabledAt: enabledAt.Add(-2 * time.Hour),
		Source:    "marketplace",
	}).Error)
	require.NoError(t, db.Create(&skillmodel.UserEnabledSkill{
		UserID:    42,
		TenantID:  42,
		SkillID:   disabled.ID,
		Enabled:   true,
		EnabledAt: enabledAt,
		Source:    "marketplace",
	}).Error)
	require.NoError(t, skillmodel.DisableSkillForUser(db, 42, 42, disabled.ID))
	require.NoError(t, db.Create(&skillmodel.UserEnabledSkill{
		UserID:    99,
		TenantID:  99,
		SkillID:   otherUser.ID,
		Enabled:   true,
		EnabledAt: enabledAt,
		Source:    "marketplace",
	}).Error)

	c, w := testContext("/api/v1/marketplace/my-skills")
	c.Set("id", 42)
	c.Set("group", "default")

	ListMySkills(c)

	require.Equal(t, http.StatusOK, w.Code)
	var got struct {
		Data []struct {
			SkillID      string             `json:"skill_id"`
			Slug         string             `json:"slug"`
			Name         string             `json:"name"`
			SkillStatus  enums.SkillStatus  `json:"skill_status"`
			RequiredPlan enums.RequiredPlan `json:"required_plan"`
			Enabled      bool               `json:"enabled"`
			EnabledAt    time.Time          `json:"enabled_at"`
			LastUsedAt   *time.Time         `json:"last_used_at"`
			Availability struct {
				Executable bool    `json:"executable"`
				Locked     bool    `json:"locked"`
				LockCode   *string `json:"lock_code"`
				CTA        string  `json:"cta"`
			} `json:"availability"`
		} `json:"data"`
	}
	require.NoError(t, common.Unmarshal(w.Body.Bytes(), &got))
	require.Len(t, got.Data, 3)

	bySlug := map[string]struct {
		Status     enums.SkillStatus
		Executable bool
		Locked     bool
		LockCode   *string
		CTA        string
		LastUsedAt *time.Time
	}{}
	for _, item := range got.Data {
		assert.True(t, item.Enabled)
		assert.NotZero(t, item.EnabledAt)
		bySlug[item.Slug] = struct {
			Status     enums.SkillStatus
			Executable bool
			Locked     bool
			LockCode   *string
			CTA        string
			LastUsedAt *time.Time
		}{
			Status:     item.SkillStatus,
			Executable: item.Availability.Executable,
			Locked:     item.Availability.Locked,
			LockCode:   item.Availability.LockCode,
			CTA:        item.Availability.CTA,
			LastUsedAt: item.LastUsedAt,
		}
	}

	assert.Contains(t, bySlug, "published-enabled")
	assert.Contains(t, bySlug, "deprecated-enabled")
	assert.Contains(t, bySlug, "archived-enabled")
	assert.NotContains(t, bySlug, "disabled-skill")
	assert.NotContains(t, bySlug, "other-user-skill")

	assert.True(t, bySlug["published-enabled"].Executable)
	assert.False(t, bySlug["published-enabled"].Locked)
	assert.Nil(t, bySlug["published-enabled"].LockCode)
	assert.Equal(t, "use", bySlug["published-enabled"].CTA)
	require.NotNil(t, bySlug["published-enabled"].LastUsedAt)
	assert.Equal(t, lastUsedAt, *bySlug["published-enabled"].LastUsedAt)

	assert.True(t, bySlug["deprecated-enabled"].Executable, "deprecated but still enabled skills remain executable")
	assert.Equal(t, enums.SkillStatusDeprecated, bySlug["deprecated-enabled"].Status)

	require.NotNil(t, bySlug["archived-enabled"].LockCode)
	assert.False(t, bySlug["archived-enabled"].Executable)
	assert.True(t, bySlug["archived-enabled"].Locked)
	assert.Equal(t, "SKILL_NOT_PUBLISHED", *bySlug["archived-enabled"].LockCode)
	assert.Equal(t, "unavailable", bySlug["archived-enabled"].CTA)
}

func TestListMySkillsPlanLockUsesAvailabilityResolver(t *testing.T) {
	db := testMySkillDB(t)
	SetDB(db)

	pro := testSkill("pro-enabled", "published")
	pro.RequiredPlan = enums.RequiredPlanPro
	require.NoError(t, db.Create(&pro).Error)
	require.NoError(t, db.Create(&skillmodel.UserEnabledSkill{
		UserID:    42,
		TenantID:  42,
		SkillID:   pro.ID,
		Enabled:   true,
		EnabledAt: time.Now().UTC(),
		Source:    "marketplace",
	}).Error)

	c, w := testContext("/api/v1/marketplace/my-skills")
	c.Set("id", 42)
	c.Set("group", "default")

	ListMySkills(c)

	require.Equal(t, http.StatusOK, w.Code)
	var got struct {
		Data []struct {
			Availability struct {
				Executable bool    `json:"executable"`
				Locked     bool    `json:"locked"`
				LockCode   *string `json:"lock_code"`
				CTA        string  `json:"cta"`
			} `json:"availability"`
		} `json:"data"`
	}
	require.NoError(t, common.Unmarshal(w.Body.Bytes(), &got))
	require.Len(t, got.Data, 1)
	assert.False(t, got.Data[0].Availability.Executable)
	assert.True(t, got.Data[0].Availability.Locked)
	require.NotNil(t, got.Data[0].Availability.LockCode)
	assert.Equal(t, "SKILL_PLAN_REQUIRED", *got.Data[0].Availability.LockCode)
	assert.Equal(t, "upgrade", got.Data[0].Availability.CTA)
}

// ---------------------------------------------------------------------------
// TestListAdminSkills_* — DR-45 admin list skills handler tests.
// ---------------------------------------------------------------------------

// TestListAdminSkills_ReturnsAllStatuses confirms that without a status filter
// all lifecycle statuses (draft, published, deprecated, archived) are returned.
// This verifies the admin list is not silently filtered to published-only like
// the marketplace list — ticket acceptance requires Super Admin to see all states.
func TestListAdminSkills_ReturnsAllStatuses(t *testing.T) {
	db := testSkillDB(t)
	SetDB(db)
	require.NoError(t, db.Create(ptr(testSkill("pub", "published"))).Error)
	require.NoError(t, db.Create(ptr(testSkill("drft", "draft"))).Error)
	require.NoError(t, db.Create(ptr(testSkill("depr", "deprecated"))).Error)
	require.NoError(t, db.Create(ptr(testSkill("arch", "archived"))).Error)

	c, w := testContext("/api/v1/admin/skills?page=1&limit=20")
	ListAdminSkills(c)

	require.Equal(t, http.StatusOK, w.Code)
	var got listResponse
	require.NoError(t, json.Unmarshal(w.Body.Bytes(), &got))
	require.Equal(t, int64(4), got.Pagination.Total)
	seen := make(map[string]bool, 4)
	for _, s := range got.Data {
		seen[s.Status] = true
	}
	assert.True(t, seen["draft"], "Super Admin must see draft skills")
	assert.True(t, seen["published"], "Super Admin must see published skills")
	assert.True(t, seen["deprecated"], "Super Admin must see deprecated skills")
	assert.True(t, seen["archived"], "Super Admin must see archived skills")
}

// TestListAdminSkills_FilterByStatus confirms status=published filters correctly.
func TestListAdminSkills_FilterByStatus(t *testing.T) {
	db := testSkillDB(t)
	SetDB(db)
	require.NoError(t, db.Create(ptr(testSkill("pub", "published"))).Error)
	require.NoError(t, db.Create(ptr(testSkill("drft", "draft"))).Error)

	c, w := testContext("/api/v1/admin/skills?status=published")
	ListAdminSkills(c)

	require.Equal(t, http.StatusOK, w.Code)
	var got listResponse
	require.NoError(t, json.Unmarshal(w.Body.Bytes(), &got))
	require.Len(t, got.Data, 1)
	assert.Equal(t, "pub", got.Data[0].Slug)
}

// TestListAdminSkills_FilterByStatus_Draft confirms status=draft filters correctly.
func TestListAdminSkills_FilterByStatus_Draft(t *testing.T) {
	db := testSkillDB(t)
	SetDB(db)
	require.NoError(t, db.Create(ptr(testSkill("pub", "published"))).Error)
	require.NoError(t, db.Create(ptr(testSkill("drft", "draft"))).Error)

	c, w := testContext("/api/v1/admin/skills?status=draft")
	ListAdminSkills(c)

	require.Equal(t, http.StatusOK, w.Code)
	var got listResponse
	require.NoError(t, json.Unmarshal(w.Body.Bytes(), &got))
	require.Len(t, got.Data, 1)
	assert.Equal(t, "drft", got.Data[0].Slug)
}

// TestListAdminSkills_FilterByRequiredPlan confirms required_plan=pro filters correctly.
func TestListAdminSkills_FilterByRequiredPlan(t *testing.T) {
	db := testSkillDB(t)
	SetDB(db)
	free := testSkill("free-skill", "published")
	free.RequiredPlan = "free"
	require.NoError(t, db.Create(&free).Error)
	pro := testSkill("pro-skill", "published")
	pro.RequiredPlan = "pro"
	require.NoError(t, db.Create(&pro).Error)

	c, w := testContext("/api/v1/admin/skills?required_plan=pro")
	ListAdminSkills(c)

	require.Equal(t, http.StatusOK, w.Code)
	var got listResponse
	require.NoError(t, json.Unmarshal(w.Body.Bytes(), &got))
	require.Len(t, got.Data, 1)
	assert.Equal(t, "pro-skill", got.Data[0].Slug)
}

// TestListAdminSkills_FilterByKidsApprovalStatus confirms kids_approval_status filter.
func TestListAdminSkills_FilterByKidsApprovalStatus(t *testing.T) {
	db := testSkillDB(t)
	SetDB(db)
	approved := testSkill("approved-skill", "published")
	approved.KidsApprovalStatus = "approved"
	require.NoError(t, db.Create(&approved).Error)
	pending := testSkill("pending-skill", "published")
	pending.KidsApprovalStatus = "pending"
	require.NoError(t, db.Create(&pending).Error)

	c, w := testContext("/api/v1/admin/skills?kids_approval_status=approved")
	ListAdminSkills(c)

	require.Equal(t, http.StatusOK, w.Code)
	var got listResponse
	require.NoError(t, json.Unmarshal(w.Body.Bytes(), &got))
	require.Len(t, got.Data, 1)
	assert.Equal(t, "approved-skill", got.Data[0].Slug)
}

// TestListAdminSkills_FilterByCategory confirms category filter.
func TestListAdminSkills_FilterByCategory(t *testing.T) {
	db := testSkillDB(t)
	SetDB(db)
	s := testSkill("coding-skill", "published")
	s.Category = "coding"
	require.NoError(t, db.Create(&s).Error)
	require.NoError(t, db.Create(ptr(testSkill("writing-skill", "published"))).Error)

	c, w := testContext("/api/v1/admin/skills?category=coding")
	ListAdminSkills(c)

	require.Equal(t, http.StatusOK, w.Code)
	var got listResponse
	require.NoError(t, json.Unmarshal(w.Body.Bytes(), &got))
	require.Len(t, got.Data, 1)
	assert.Equal(t, "coding-skill", got.Data[0].Slug)
}

// TestListAdminSkills_CategoryFreeForm confirms that an unknown category value
// returns 200 with an empty result set rather than 400.
func TestListAdminSkills_CategoryFreeForm(t *testing.T) {
	db := testSkillDB(t)
	SetDB(db)
	require.NoError(t, db.Create(ptr(testSkill("some-skill", "published"))).Error)

	c, w := testContext("/api/v1/admin/skills?category=nonexistent-category-xyz")
	ListAdminSkills(c)

	require.Equal(t, http.StatusOK, w.Code)
	var got listResponse
	require.NoError(t, json.Unmarshal(w.Body.Bytes(), &got))
	assert.Equal(t, int64(0), got.Pagination.Total)
}

// TestListAdminSkills_PaginationHasNext confirms has_next=true when total > limit.
func TestListAdminSkills_PaginationHasNext(t *testing.T) {
	db := testSkillDB(t)
	SetDB(db)
	for i := 0; i < 3; i++ {
		s := testSkill(fmt.Sprintf("skill-%d", i), "published")
		require.NoError(t, db.Create(&s).Error)
	}

	c, w := testContext("/api/v1/admin/skills?page=1&limit=2")
	ListAdminSkills(c)

	require.Equal(t, http.StatusOK, w.Code)
	var got listResponse
	require.NoError(t, json.Unmarshal(w.Body.Bytes(), &got))
	assert.Equal(t, int64(3), got.Pagination.Total)
	assert.True(t, got.Pagination.HasNext)
	assert.Len(t, got.Data, 2)
}

// TestListAdminSkills_InvalidStatus_Returns400 confirms unrecognised status → 400.
func TestListAdminSkills_InvalidStatus_Returns400(t *testing.T) {
	SetDB(testSkillDB(t))
	c, w := testContext("/api/v1/admin/skills?status=not-a-status")
	ListAdminSkills(c)
	require.Equal(t, http.StatusBadRequest, w.Code)
	assert.Contains(t, w.Body.String(), `"error":`)
}

// TestListAdminSkills_InvalidPlan_Returns400 confirms unrecognised required_plan → 400.
func TestListAdminSkills_InvalidPlan_Returns400(t *testing.T) {
	SetDB(testSkillDB(t))
	c, w := testContext("/api/v1/admin/skills?required_plan=diamond")
	ListAdminSkills(c)
	require.Equal(t, http.StatusBadRequest, w.Code)
	assert.Contains(t, w.Body.String(), `"error":`)
}

// TestListAdminSkills_InvalidKidsApproval_Returns400 confirms unrecognised value → 400.
func TestListAdminSkills_InvalidKidsApproval_Returns400(t *testing.T) {
	SetDB(testSkillDB(t))
	c, w := testContext("/api/v1/admin/skills?kids_approval_status=maybe")
	ListAdminSkills(c)
	require.Equal(t, http.StatusBadRequest, w.Code)
	assert.Contains(t, w.Body.String(), `"error":`)
}

// TestListAdminSkills_LimitTooLarge_Returns400 confirms limit > 100 → 400.
func TestListAdminSkills_LimitTooLarge_Returns400(t *testing.T) {
	SetDB(testSkillDB(t))
	c, w := testContext("/api/v1/admin/skills?limit=101")
	ListAdminSkills(c)
	require.Equal(t, http.StatusBadRequest, w.Code)
	assert.Contains(t, w.Body.String(), `"error":`)
}

// TestListAdminSkills_EnvelopeShape confirms the response has data, pagination,
// and meta.request_id fields in the correct positions.
func TestListAdminSkills_EnvelopeShape(t *testing.T) {
	db := testSkillDB(t)
	SetDB(db)
	require.NoError(t, db.Create(ptr(testSkill("shape-skill", "published"))).Error)

	c, w := testContext("/api/v1/admin/skills")
	ListAdminSkills(c)

	require.Equal(t, http.StatusOK, w.Code)
	var raw map[string]json.RawMessage
	require.NoError(t, json.Unmarshal(w.Body.Bytes(), &raw))
	assert.Contains(t, raw, "data")
	assert.Contains(t, raw, "pagination")
	assert.Contains(t, raw, "meta")
	var meta struct {
		RequestID string `json:"request_id"`
	}
	require.NoError(t, json.Unmarshal(raw["meta"], &meta))
	assert.NotEmpty(t, meta.RequestID)
}

// TestListAdminSkills_NoInstructionTemplateInResponse is the D-3 redaction
// assertion, valid for both Path A and Exception Path.
// Under Exception Path (current), the guarantee is structural: listAdminSkillsSafeQuery
// uses an explicit SELECT allowlist that excludes instruction_template and all
// prompt fields — not an incidental property of the current table schema.
func TestListAdminSkills_NoInstructionTemplateInResponse(t *testing.T) {
	db := testSkillDB(t)
	SetDB(db)
	require.NoError(t, db.Create(ptr(testSkill("safe-skill", "published"))).Error)

	c, w := testContext("/api/v1/admin/skills")
	ListAdminSkills(c)

	require.Equal(t, http.StatusOK, w.Code)
	assert.NotContains(t, w.Body.String(), "instruction_template",
		"instruction_template must be excluded by the explicit SELECT allowlist (D-3)")
}

// TestListAdminSkills_DefaultPagination confirms that omitting page and limit
// uses the API defaults (page=1, limit=20) and returns 200.
func TestListAdminSkills_DefaultPagination(t *testing.T) {
	SetDB(testSkillDB(t))
	c, w := testContext("/api/v1/admin/skills")
	ListAdminSkills(c)

	require.Equal(t, http.StatusOK, w.Code)
	var got listResponse
	require.NoError(t, json.Unmarshal(w.Body.Bytes(), &got))
	assert.Equal(t, 1, got.Pagination.Page)
	assert.Equal(t, 20, got.Pagination.Limit)
}

// TestListAdminSkills_InvalidPage confirms that page=0 and page=-1 both return
// 400 INVALID_REQUEST with detail.reason=INVALID_PAGINATION. parsePositiveInt
// requires the value to be an integer >= 1.
func TestListAdminSkills_InvalidPage(t *testing.T) {
	for _, badPage := range []string{"0", "-1"} {
		t.Run("page="+badPage, func(t *testing.T) {
			SetDB(testSkillDB(t))
			c, w := testContext("/api/v1/admin/skills?page=" + badPage)
			ListAdminSkills(c)
			require.Equal(t, http.StatusBadRequest, w.Code)
			assert.Contains(t, w.Body.String(), `"code":"INVALID_REQUEST"`)
			assert.Contains(t, w.Body.String(), `"reason":"INVALID_PAGINATION"`)
		})
	}
}

// TestListAdminSkills_FilterByKidsApprovalStatus_EmergencyApproved confirms that
// kids_approval_status=emergency_approved is accepted by the enum filter and
// returns only skills with that status. Covered separately because it is a
// compliance-sensitive value that must not be accidentally dropped from the
// enum allowlist.
func TestListAdminSkills_FilterByKidsApprovalStatus_EmergencyApproved(t *testing.T) {
	db := testSkillDB(t)
	SetDB(db)
	ea := testSkill("ea-skill", "published")
	ea.KidsApprovalStatus = "emergency_approved"
	require.NoError(t, db.Create(&ea).Error)
	require.NoError(t, db.Create(ptr(testSkill("other-skill", "published"))).Error)

	c, w := testContext("/api/v1/admin/skills?kids_approval_status=emergency_approved")
	ListAdminSkills(c)

	require.Equal(t, http.StatusOK, w.Code)
	var got listResponse
	require.NoError(t, json.Unmarshal(w.Body.Bytes(), &got))
	require.Len(t, got.Data, 1)
	assert.Equal(t, "ea-skill", got.Data[0].Slug)
}

// TestListAdminSkills_InvalidSort confirms that an unrecognised sort key returns
// 400 INVALID_REQUEST with detail.reason=INVALID_SORT. sort is an existing handler
// capability (tasks/03 §7.3); this test guards against future changes to adminSortKeys.
func TestListAdminSkills_InvalidSort(t *testing.T) {
	SetDB(testSkillDB(t))
	c, w := testContext("/api/v1/admin/skills?sort=price")
	ListAdminSkills(c)
	require.Equal(t, http.StatusBadRequest, w.Code)
	assert.Contains(t, w.Body.String(), `"code":"INVALID_REQUEST"`)
	assert.Contains(t, w.Body.String(), `"reason":"INVALID_SORT"`)
}

// TestListAdminSkills_SortByUpdatedAt confirms the default sort (-updated_at) places
// the most recently updated skill first. sort is an existing handler capability;
// this test guards the default ordering behaviour.
func TestListAdminSkills_SortByUpdatedAt(t *testing.T) {
	db := testSkillDB(t)
	SetDB(db)
	older := testSkill("older-skill", "published")
	require.NoError(t, db.Create(&older).Error)
	newer := testSkill("newer-skill", "published")
	require.NoError(t, db.Create(&newer).Error)
	// Force older-skill to an earlier updated_at so the default -updated_at sort
	// reliably produces a deterministic order independent of insert timing.
	require.NoError(t, db.Exec("UPDATE skills SET updated_at = ? WHERE slug = ?",
		time.Now().UTC().Add(-time.Hour), "older-skill").Error)

	c, w := testContext("/api/v1/admin/skills")
	ListAdminSkills(c)

	require.Equal(t, http.StatusOK, w.Code)
	var got listResponse
	require.NoError(t, json.Unmarshal(w.Body.Bytes(), &got))
	require.Len(t, got.Data, 2)
	assert.Equal(t, "newer-skill", got.Data[0].Slug)
}

func TestCreateAdminSkill_CreatesDraftFromAuthAndHidesFromMarketplace(t *testing.T) {
	db := testSkillDB(t)
	SetDB(db)
	body := `{"slug":"draft-create","name":"Draft Create","short_description":"short","description":"long","category":"writing","required_plan":"pro","monetization_type":"plan_included"}`
	c, w := testContextWithMethod(http.MethodPost, "/api/v1/admin/skills", body)
	c.Set("id", 77)
	c.Set("role", 100)

	CreateAdminSkill(c)

	require.Equal(t, http.StatusCreated, w.Code)
	var got struct {
		Data struct {
			ID               string `json:"id"`
			Slug             string `json:"slug"`
			Status           string `json:"status"`
			CreatedBy        int64  `json:"created_by"`
			RequiredPlan     string `json:"required_plan"`
			MonetizationType string `json:"monetization_type"`
		} `json:"data"`
		Meta struct {
			RequestID string `json:"request_id"`
		} `json:"meta"`
	}
	require.NoError(t, json.Unmarshal(w.Body.Bytes(), &got))
	assert.Equal(t, "draft-create", got.Data.Slug)
	assert.Equal(t, string(enums.SkillStatusDraft), got.Data.Status)
	assert.Equal(t, int64(77), got.Data.CreatedBy)
	assert.Equal(t, "pro", got.Data.RequiredPlan)
	assert.Equal(t, "plan_included", got.Data.MonetizationType)
	assert.NotEmpty(t, got.Meta.RequestID)

	var persisted skillmodel.Skill
	require.NoError(t, db.First(&persisted, "id = ?", got.Data.ID).Error)
	assert.Equal(t, enums.SkillStatusDraft, persisted.Status)
	assert.Equal(t, int64(77), persisted.CreatedBy)
	assert.Nil(t, persisted.MaxInputTokens)

	var audit skillmodel.SkillAuditLog
	require.NoError(t, db.First(&audit, "skill_id = ? AND action = ?", got.Data.ID, "skill_created").Error)
	assert.Equal(t, int64(77), audit.ActorID)
	require.NotNil(t, audit.AfterValue)
	assert.Contains(t, string(*audit.AfterValue), `"slug":"draft-create"`)
	assert.NotContains(t, string(*audit.AfterValue), "long", "audit values should not store raw description text")
	assert.JSONEq(t, `["slug","status","category","name","short_description","description","required_plan","monetization_type"]`, string(audit.ChangedFields))

	listC, listW := testContext("/api/v1/marketplace/skills")
	ListMarketplaceSkills(listC)
	require.Equal(t, http.StatusOK, listW.Code)
	assert.NotContains(t, listW.Body.String(), "draft-create", "draft skills must not be discoverable in public list")

	detailC, detailW := testContext("/api/v1/marketplace/skills/draft-create")
	detailC.Params = gin.Params{{Key: "id", Value: "draft-create"}}
	GetMarketplaceSkill(detailC)
	require.Equal(t, http.StatusNotFound, detailW.Code)
	assert.Contains(t, detailW.Body.String(), `"code":"SKILL_NOT_FOUND"`)
}

func TestCreateAdminSkill_FreeConfigurationsRequireMaxInputTokens(t *testing.T) {
	cases := []struct {
		name string
		body string
	}{
		{
			name: "required_plan_free",
			body: `{"slug":"free-plan","name":"Free Plan","short_description":"short","description":"long","category":"writing","required_plan":"free","monetization_type":"plan_included"}`,
		},
		{
			name: "monetization_type_free",
			body: `{"slug":"free-money","name":"Free Money","short_description":"short","description":"long","category":"writing","required_plan":"pro","monetization_type":"free"}`,
		},
		{
			name: "free_quota_set",
			body: `{"slug":"free-quota","name":"Free Quota","short_description":"short","description":"long","category":"writing","required_plan":"pro","monetization_type":"plan_included","free_quota_per_month":10}`,
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			SetDB(testSkillDB(t))
			c, w := testContextWithMethod(http.MethodPost, "/api/v1/admin/skills", tc.body)
			c.Set("id", 77)
			c.Set("role", 100)

			CreateAdminSkill(c)

			require.Equal(t, http.StatusBadRequest, w.Code)
			assert.Contains(t, w.Body.String(), `"code":"INVALID_REQUEST"`)
			assert.Contains(t, w.Body.String(), `"reason":"MAX_INPUT_TOKENS_REQUIRED"`)
		})
	}
}

func TestCreateAdminSkill_ValidationErrors(t *testing.T) {
	cases := []struct {
		name   string
		body   string
		reason string
	}{
		{
			name:   "invalid_json",
			body:   `{`,
			reason: "INVALID_JSON",
		},
		{
			name:   "missing_slug",
			body:   `{"name":"Draft","short_description":"short","description":"long","category":"writing","required_plan":"pro","monetization_type":"plan_included"}`,
			reason: "MISSING_SLUG",
		},
		{
			name:   "missing_name",
			body:   `{"slug":"missing-name","short_description":"short","description":"long","category":"writing","required_plan":"pro","monetization_type":"plan_included"}`,
			reason: "MISSING_NAME",
		},
		{
			name:   "missing_short_description",
			body:   `{"slug":"missing-short","name":"Draft","description":"long","category":"writing","required_plan":"pro","monetization_type":"plan_included"}`,
			reason: "MISSING_SHORT_DESCRIPTION",
		},
		{
			name:   "missing_description",
			body:   `{"slug":"missing-description","name":"Draft","short_description":"short","category":"writing","required_plan":"pro","monetization_type":"plan_included"}`,
			reason: "MISSING_DESCRIPTION",
		},
		{
			name:   "missing_category",
			body:   `{"slug":"missing-category","name":"Draft","short_description":"short","description":"long","required_plan":"pro","monetization_type":"plan_included"}`,
			reason: "MISSING_CATEGORY",
		},
		{
			name:   "invalid_slug_format_spaces",
			body:   `{"slug":"bad slug","name":"Draft","short_description":"short","description":"long","category":"writing","required_plan":"pro","monetization_type":"plan_included"}`,
			reason: "INVALID_SLUG_FORMAT",
		},
		{
			name:   "invalid_slug_format_uppercase",
			body:   `{"slug":"Bad-Slug","name":"Draft","short_description":"short","description":"long","category":"writing","required_plan":"pro","monetization_type":"plan_included"}`,
			reason: "INVALID_SLUG_FORMAT",
		},
		{
			name:   "invalid_required_plan",
			body:   `{"slug":"invalid-plan","name":"Draft","short_description":"short","description":"long","category":"writing","required_plan":"diamond","monetization_type":"plan_included"}`,
			reason: "INVALID_REQUIRED_PLAN",
		},
		{
			name:   "invalid_monetization_type",
			body:   `{"slug":"invalid-money","name":"Draft","short_description":"short","description":"long","category":"writing","required_plan":"pro","monetization_type":"subscription"}`,
			reason: "INVALID_MONETIZATION_TYPE",
		},
		{
			name:   "invalid_free_quota",
			body:   `{"slug":"bad-quota","name":"Draft","short_description":"short","description":"long","category":"writing","required_plan":"pro","monetization_type":"plan_included","free_quota_per_month":-1}`,
			reason: "INVALID_FREE_QUOTA_PER_MONTH",
		},
		{
			name:   "invalid_max_input_tokens",
			body:   `{"slug":"bad-max","name":"Draft","short_description":"short","description":"long","category":"writing","required_plan":"free","monetization_type":"free","max_input_tokens":0}`,
			reason: "INVALID_MAX_INPUT_TOKENS",
		},
		{
			name:   "token_markup_missing_price_markup",
			body:   `{"slug":"token-missing","name":"Draft","short_description":"short","description":"long","category":"writing","required_plan":"pro","monetization_type":"token_markup"}`,
			reason: "PRICE_MARKUP_REQUIRED",
		},
		{
			name:   "token_markup_zero_price_markup",
			body:   `{"slug":"token-zero","name":"Draft","short_description":"short","description":"long","category":"writing","required_plan":"pro","monetization_type":"token_markup","price_markup":0}`,
			reason: "PRICE_MARKUP_REQUIRED",
		},
		{
			name:   "plan_included_with_nonzero_price_markup",
			body:   `{"slug":"plan-markup","name":"Draft","short_description":"short","description":"long","category":"writing","required_plan":"pro","monetization_type":"plan_included","price_markup":0.25}`,
			reason: "PRICE_MARKUP_NOT_ALLOWED",
		},
		{
			name:   "free_with_price_markup_and_max_input_tokens",
			body:   `{"slug":"free-markup","name":"Draft","short_description":"short","description":"long","category":"writing","required_plan":"free","monetization_type":"free","price_markup":0.25,"max_input_tokens":1000}`,
			reason: "PRICE_MARKUP_NOT_ALLOWED",
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			SetDB(testSkillDB(t))
			c, w := testContextWithMethod(http.MethodPost, "/api/v1/admin/skills", tc.body)
			c.Set("id", 77)
			c.Set("role", 100)

			CreateAdminSkill(c)

			require.Equal(t, http.StatusBadRequest, w.Code)
			assert.Contains(t, w.Body.String(), `"code":"INVALID_REQUEST"`)
			assert.Contains(t, w.Body.String(), `"reason":"`+tc.reason+`"`)
		})
	}
}

func TestCreateAdminSkill_LengthValidation(t *testing.T) {
	longSlug := strings.Repeat("a", createSkillSlugMaxLength+1)
	longName := strings.Repeat("n", createSkillNameMaxLength+1)
	longShortDescription := strings.Repeat("s", createSkillShortDescriptionMaxLength+1)
	longCategory := strings.Repeat("c", createSkillCategoryMaxLength+1)
	cases := []struct {
		name   string
		body   string
		reason string
	}{
		{
			name:   "slug_too_long",
			body:   fmt.Sprintf(`{"slug":%q,"name":"Draft","short_description":"short","description":"long","category":"writing","required_plan":"pro","monetization_type":"plan_included"}`, longSlug),
			reason: "SLUG_TOO_LONG",
		},
		{
			name:   "name_too_long",
			body:   fmt.Sprintf(`{"slug":"name-too-long","name":%q,"short_description":"short","description":"long","category":"writing","required_plan":"pro","monetization_type":"plan_included"}`, longName),
			reason: "NAME_TOO_LONG",
		},
		{
			name:   "short_description_too_long",
			body:   fmt.Sprintf(`{"slug":"short-too-long","name":"Draft","short_description":%q,"description":"long","category":"writing","required_plan":"pro","monetization_type":"plan_included"}`, longShortDescription),
			reason: "SHORT_DESCRIPTION_TOO_LONG",
		},
		{
			name:   "category_too_long",
			body:   fmt.Sprintf(`{"slug":"category-too-long","name":"Draft","short_description":"short","description":"long","category":%q,"required_plan":"pro","monetization_type":"plan_included"}`, longCategory),
			reason: "CATEGORY_TOO_LONG",
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			SetDB(testSkillDB(t))
			c, w := testContextWithMethod(http.MethodPost, "/api/v1/admin/skills", tc.body)
			c.Set("id", 77)
			c.Set("role", 100)

			CreateAdminSkill(c)

			require.Equal(t, http.StatusBadRequest, w.Code)
			assert.Contains(t, w.Body.String(), `"reason":"`+tc.reason+`"`)
		})
	}
}

func TestCreateAdminSkill_AcceptsFreeConfigurationWithMaxInputTokens(t *testing.T) {
	db := testSkillDB(t)
	SetDB(db)
	body := `{"slug":"free-with-max","name":"Free With Max","short_description":"short","description":"long","category":"writing","required_plan":"free","monetization_type":"free","max_input_tokens":2000}`
	c, w := testContextWithMethod(http.MethodPost, "/api/v1/admin/skills", body)
	c.Set("id", 77)
	c.Set("role", 100)

	CreateAdminSkill(c)

	require.Equal(t, http.StatusCreated, w.Code)
	var persisted skillmodel.Skill
	require.NoError(t, db.First(&persisted, "slug = ?", "free-with-max").Error)
	require.NotNil(t, persisted.MaxInputTokens)
	assert.Equal(t, 2000, *persisted.MaxInputTokens)
	assert.Equal(t, enums.SkillStatusDraft, persisted.Status)

	var audit skillmodel.SkillAuditLog
	require.NoError(t, db.First(&audit, "skill_id = ? AND action = ?", persisted.ID, "skill_created").Error)
	assert.JSONEq(t, `["slug","status","category","name","short_description","description","required_plan","monetization_type","max_input_tokens"]`, string(audit.ChangedFields))
}

func TestCreateAdminSkill_TokenMarkupWithPriceMarkup(t *testing.T) {
	db := testSkillDB(t)
	SetDB(db)
	body := `{"slug":"token-markup-skill","name":"Token Markup","short_description":"short","description":"long","category":"writing","required_plan":"pro","monetization_type":"token_markup","price_markup":0.25}`
	c, w := testContextWithMethod(http.MethodPost, "/api/v1/admin/skills", body)
	c.Set("id", 77)
	c.Set("role", 100)

	CreateAdminSkill(c)

	require.Equal(t, http.StatusCreated, w.Code)
	var persisted skillmodel.Skill
	require.NoError(t, db.First(&persisted, "slug = ?", "token-markup-skill").Error)
	assert.Equal(t, enums.MonetizationTypeTokenMarkup, persisted.MonetizationType)
	assert.Equal(t, 0.25, persisted.PriceMarkup)

	var audit skillmodel.SkillAuditLog
	require.NoError(t, db.First(&audit, "skill_id = ? AND action = ?", persisted.ID, "skill_created").Error)
	assert.Contains(t, string(audit.ChangedFields), `"price_markup"`)
	require.NotNil(t, audit.AfterValue)
	assert.Contains(t, string(*audit.AfterValue), `"price_markup"`)
}

func TestCreateAdminSkill_NonTokenMarkupOmittedPriceMarkupPersistsZero(t *testing.T) {
	db := testSkillDB(t)
	SetDB(db)
	body := `{"slug":"plan-no-markup","name":"Plan No Markup","short_description":"short","description":"long","category":"writing","required_plan":"pro","monetization_type":"plan_included"}`
	c, w := testContextWithMethod(http.MethodPost, "/api/v1/admin/skills", body)
	c.Set("id", 77)
	c.Set("role", 100)

	CreateAdminSkill(c)

	require.Equal(t, http.StatusCreated, w.Code)
	var persisted skillmodel.Skill
	require.NoError(t, db.First(&persisted, "slug = ?", "plan-no-markup").Error)
	assert.Equal(t, 0.0, persisted.PriceMarkup)
}

func TestCreateAdminSkill_UnicodeNameWithinLimit(t *testing.T) {
	db := testSkillDB(t)
	SetDB(db)
	// 50 Chinese characters: 150 UTF-8 bytes but only 50 runes, within VARCHAR(160).
	chineseName := strings.Repeat("\u5199", 50)
	body := fmt.Sprintf(`{"slug":"unicode-name","name":%q,"short_description":"short","description":"long","category":"writing","required_plan":"pro","monetization_type":"plan_included"}`, chineseName)
	c, w := testContextWithMethod(http.MethodPost, "/api/v1/admin/skills", body)
	c.Set("id", 77)
	c.Set("role", 100)

	CreateAdminSkill(c)

	require.Equal(t, http.StatusCreated, w.Code, "50-rune Chinese name must be accepted (150 bytes but within VARCHAR(160) char limit)")
}

func TestCreateAdminSkill_DuplicateSlugReturns409(t *testing.T) {
	db := testSkillDB(t)
	SetDB(db)
	require.NoError(t, db.Create(ptr(testSkill("duplicate-slug", "draft"))).Error)
	body := `{"slug":"duplicate-slug","name":"Duplicate","short_description":"short","description":"long","category":"writing","required_plan":"pro","monetization_type":"plan_included"}`
	c, w := testContextWithMethod(http.MethodPost, "/api/v1/admin/skills", body)
	c.Set("id", 77)
	c.Set("role", 100)

	CreateAdminSkill(c)

	require.Equal(t, http.StatusConflict, w.Code)
	assert.Contains(t, w.Body.String(), `"code":"SKILL_CONFLICT"`)
	assert.Contains(t, w.Body.String(), `"reason":"DUPLICATE_SLUG"`)
}

func TestCreateAdminSkillVersion_CreatesDraftSnapshotAndAudit(t *testing.T) {
	db := testSkillDB(t)
	SetDB(db)
	maxInput := 4096
	s := testSkill("version-create", "draft")
	s.RequiredPlan = enums.RequiredPlanPro
	s.MonetizationType = enums.MonetizationTypeTokenMarkup
	s.PriceMarkup = 0.25
	s.FreeQuotaPerMonth = ptr(12)
	s.MaxInputTokens = &maxInput
	s.ModelWhitelist = skillmodel.SkillJSONB(`["smart-tier","fast-tier"]`)
	require.NoError(t, db.Create(&s).Error)

	body := `{"instruction_template":"Use private rubric v1","prompt_guard_template":"guard v1","output_schema":{"type":"object"}}`
	c, w := testContextWithMethod(http.MethodPost, "/api/v1/admin/skills/"+s.ID+"/versions", body)
	c.Params = gin.Params{{Key: "skill_id", Value: s.ID}}
	c.Set("id", 99)
	c.Set("role", 100)

	CreateAdminSkillVersion(c)

	require.Equal(t, http.StatusCreated, w.Code)
	var got struct {
		Data SkillVersionMetadata `json:"data"`
	}
	require.NoError(t, json.Unmarshal(w.Body.Bytes(), &got))
	assert.Equal(t, enums.SkillVersionStatusDraft, got.Data.Status)
	assert.Equal(t, 1, got.Data.VersionNumber)
	sum := sha256.Sum256([]byte("Use private rubric v1"))
	assert.Equal(t, hex.EncodeToString(sum[:]), got.Data.InstructionTemplateSHA256)
	assert.Equal(t, json.RawMessage(`["smart-tier","fast-tier"]`), got.Data.ModelWhitelistSnapshot)
	assert.Equal(t, enums.RequiredPlanPro, got.Data.RequiredPlanSnapshot)
	assert.Equal(t, &maxInput, got.Data.MaxInputTokensSnapshot)
	assert.NotContains(t, w.Body.String(), `"instruction_template":"`)
	assert.NotContains(t, w.Body.String(), "Use private rubric v1")

	var version skillmodel.SkillVersion
	require.NoError(t, db.First(&version, "id = ?", got.Data.ID).Error)
	assert.Equal(t, "Use private rubric v1", version.InstructionTemplate)
	assert.Equal(t, "guard v1", *version.PromptGuardTemplate)
	require.NotNil(t, version.OutputSchema)
	assert.JSONEq(t, `{"type":"object"}`, string(*version.OutputSchema))
	assert.JSONEq(t, `{"type":"token_markup","price_markup":0.25,"free_quota_per_month":12}`, string(version.MonetizationSnapshot))

	var audit skillmodel.SkillAuditLog
	require.NoError(t, db.First(&audit, "skill_version_id = ? AND action = ?", version.ID, "version_created").Error)
	require.NotNil(t, audit.AfterValue)
	assert.NotContains(t, string(*audit.AfterValue), "Use private rubric v1")
	assert.NotContains(t, string(*audit.AfterValue), "guard v1")
	assert.Contains(t, string(*audit.AfterValue), version.InstructionTemplateSHA256)
}

func TestListAdminSkillVersions_MetadataOnly(t *testing.T) {
	db := testSkillDB(t)
	SetDB(db)
	s := testSkill("version-list", "draft")
	require.NoError(t, db.Create(&s).Error)
	version := validHandlerSkillVersion(s.ID, 1)
	version.InstructionTemplate = "private list template"
	require.NoError(t, db.Create(&version).Error)

	c, w := testContext("/api/v1/admin/skills/" + s.ID + "/versions")
	c.Params = gin.Params{{Key: "skill_id", Value: s.ID}}

	ListAdminSkillVersions(c)

	require.Equal(t, http.StatusOK, w.Code)
	assert.Contains(t, w.Body.String(), `"instruction_template_sha256"`)
	assert.NotContains(t, w.Body.String(), `"instruction_template":"`)
	assert.NotContains(t, w.Body.String(), "private list template")
}

func TestGetAdminSkillVersion_ReturnsTemplateForSuperAdminDetail(t *testing.T) {
	db := testSkillDB(t)
	SetDB(db)
	s := testSkill("version-detail", "draft")
	require.NoError(t, db.Create(&s).Error)
	version := validHandlerSkillVersion(s.ID, 1)
	version.InstructionTemplate = "detail-only template"
	require.NoError(t, db.Create(&version).Error)

	c, w := testContext("/api/v1/admin/skills/" + s.ID + "/versions/" + version.ID)
	c.Params = gin.Params{{Key: "skill_id", Value: s.ID}, {Key: "version_id", Value: version.ID}}

	GetAdminSkillVersion(c)

	require.Equal(t, http.StatusOK, w.Code)
	assert.Contains(t, w.Body.String(), `"instruction_template":"detail-only template"`)
}

func TestActivateAdminSkillVersion_DemotesPriorActiveAndAudits(t *testing.T) {
	db := testSkillDB(t)
	SetDB(db)
	s := testSkill("version-activate", "published")
	require.NoError(t, db.Create(&s).Error)
	v1 := validHandlerSkillVersion(s.ID, 1)
	v1.Status = enums.SkillVersionStatusActive
	require.NoError(t, db.Create(&v1).Error)
	v2 := validHandlerSkillVersion(s.ID, 2)
	require.NoError(t, db.Create(&v2).Error)
	require.NoError(t, db.Model(&skillmodel.Skill{}).Where("id = ?", s.ID).Update("active_version_id", v1.ID).Error)

	c, w := testContextWithMethod(http.MethodPost, "/api/v1/admin/skills/"+s.ID+"/versions/"+v2.ID+"/activate", `{"reason":"publish vetted template"}`)
	c.Params = gin.Params{{Key: "skill_id", Value: s.ID}, {Key: "version_id", Value: v2.ID}}
	c.Set("id", 101)
	c.Set("role", 100)

	ActivateAdminSkillVersion(c)

	require.Equal(t, http.StatusOK, w.Code)
	var gotV1, gotV2 skillmodel.SkillVersion
	require.NoError(t, db.First(&gotV1, "id = ?", v1.ID).Error)
	require.NoError(t, db.First(&gotV2, "id = ?", v2.ID).Error)
	assert.Equal(t, enums.SkillVersionStatusInactive, gotV1.Status)
	assert.Equal(t, enums.SkillVersionStatusActive, gotV2.Status)
	assert.NotNil(t, gotV2.ActivatedAt)

	var skill skillmodel.Skill
	require.NoError(t, db.First(&skill, "id = ?", s.ID).Error)
	require.NotNil(t, skill.ActiveVersionID)
	assert.Equal(t, v2.ID, *skill.ActiveVersionID)

	var activeCount int64
	require.NoError(t, db.Model(&skillmodel.SkillVersion{}).
		Where("skill_id = ? AND status = ?", s.ID, enums.SkillVersionStatusActive).
		Count(&activeCount).Error)
	assert.Equal(t, int64(1), activeCount)

	var audit skillmodel.SkillAuditLog
	require.NoError(t, db.First(&audit, "skill_version_id = ? AND action = ?", v2.ID, "version_activated").Error)
	require.NotNil(t, audit.AfterValue)
	require.NotNil(t, audit.BeforeValue)
	assert.NotContains(t, string(*audit.AfterValue), gotV2.InstructionTemplate)
	assert.Contains(t, string(*audit.AfterValue), gotV2.InstructionTemplateSHA256)

	var before map[string]any
	require.NoError(t, json.Unmarshal(*audit.BeforeValue, &before))
	assert.Equal(t, v2.ID, before["skill_version_id"], "before_value must describe the version being activated, not the prior active version")
	assert.Equal(t, string(enums.SkillVersionStatusDraft), before["status"])

	var after map[string]any
	require.NoError(t, json.Unmarshal(*audit.AfterValue, &after))
	assert.Equal(t, v2.ID, after["skill_version_id"])
	assert.Equal(t, v1.ID, after["previous_active_version_id"])
	assert.Equal(t, string(enums.SkillVersionStatusActive), after["status"])
}

func TestSkillVersionNumberConflictDetection(t *testing.T) {
	err := fmt.Errorf("UNIQUE constraint failed: skill_versions.skill_id, skill_versions.version_number")
	assert.True(t, isSkillVersionNumberConflict(err))
	assert.False(t, isSkillVersionNumberConflict(fmt.Errorf("UNIQUE constraint failed: other_table.id")))
}

// listResponse is a typed helper for unmarshalling the List envelope in tests.
type listResponse struct {
	Data []struct {
		Slug   string `json:"slug"`
		Status string `json:"status"`
	} `json:"data"`
	Pagination struct {
		Page    int   `json:"page"`
		Limit   int   `json:"limit"`
		Total   int64 `json:"total"`
		HasNext bool  `json:"has_next"`
	} `json:"pagination"`
}

// ptr returns a pointer to a copy of v (avoids loop-variable aliasing).
func ptr[T any](v T) *T { return &v }

func testSkillDB(t *testing.T) *gorm.DB {
	t.Helper()
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	require.NoError(t, err)
	require.NoError(t, skillmodel.MigrateSkills(db))
	require.NoError(t, skillmodel.MigrateUserEnabledSkills(db))
	require.NoError(t, skillmodel.MigrateSkillVersions(db))
	require.NoError(t, skillmodel.MigrateSkillAuditLog(db))
	require.NoError(t, skillmodel.MigrateSkillUsageEvents(db))
	return db
}

func testMySkillDB(t *testing.T) *gorm.DB {
	t.Helper()
	db := testSkillDB(t)
	require.NoError(t, skillmodel.MigrateUserEnabledSkills(db))
	require.NoError(t, db.AutoMigrate(&platformmodel.User{}))
	require.NoError(t, db.Create(&platformmodel.User{
		Id:       42,
		Username: "skill-user",
		Password: "password123",
		Role:     1,
		Status:   1,
		Group:    "default",
	}).Error)
	return db
}

func testContext(url string) (*gin.Context, *httptest.ResponseRecorder) {
	return testContextWithMethod(http.MethodGet, url, "")
}

func testContextWithMethod(method, url, body string) (*gin.Context, *httptest.ResponseRecorder) {
	gin.SetMode(gin.TestMode)
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = httptest.NewRequest(method, url, bytes.NewBufferString(body))
	if body != "" {
		c.Request.Header.Set("Content-Type", "application/json")
	}
	return c, w
}

func testSkill(slug string, status string) skillmodel.Skill {
	now := time.Now().UTC()
	return skillmodel.Skill{
		Slug:                 slug,
		Status:               enums.SkillStatus(status),
		Category:             "writing",
		Tags:                 skillmodel.SkillJSONB(`["writing"]`),
		DefaultLocale:        "en",
		Name:                 slug,
		ShortDescription:     "short",
		Description:          "long\n\n" + routedWorkStepFixture(),
		InputHints:           skillmodel.SkillJSONB(`[]`),
		ExampleInputs:        skillmodel.SkillJSONB(`[]`),
		ExampleOutputs:       skillmodel.SkillJSONB(`[]`),
		RequiredPlan:         "free",
		MonetizationType:     "free",
		ModelWhitelist:       skillmodel.SkillJSONB(`["smart-tier"]`),
		TimeoutSeconds:       45,
		KidsApprovalStatus:   "not_required",
		AIDisclosureRequired: true,
		CreatedBy:            1,
		PublishedAt:          &now,
	}
}

func routedWorkStepFixture() string {
	return "### Work Step\n\nCall DeepRouter at POST https://api.deeprouter.co/v1/routing/chat/completions with the runner's own key, then base the final answer on the returned routing result."
}

func validHandlerSkillVersion(skillID string, versionNumber int) skillmodel.SkillVersion {
	maxInput := 2048
	schema := skillmodel.SkillJSONB(`{"type":"object"}`)
	sum := sha256.Sum256([]byte("handler version template"))
	return skillmodel.SkillVersion{
		SkillID:                   skillID,
		VersionNumber:             versionNumber,
		Status:                    enums.SkillVersionStatusDraft,
		InstructionTemplate:       "handler version template",
		InstructionTemplateSHA256: hex.EncodeToString(sum[:]),
		OutputSchema:              &schema,
		ModelWhitelistSnapshot:    skillmodel.SkillJSONB(`["smart-tier"]`),
		RequiredPlanSnapshot:      enums.RequiredPlanFree,
		MonetizationSnapshot:      skillmodel.SkillJSONB(`{"type":"free","price_markup":0}`),
		MaxInputTokensSnapshot:    &maxInput,
		RolloutPercentage:         100,
		CreatedBy:                 1,
	}
}
