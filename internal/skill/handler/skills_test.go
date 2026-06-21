package handler

import (
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/internal/skill/enums"
	skillmodel "github.com/QuantumNous/new-api/internal/skill/model"
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
	return db
}

func testContext(url string) (*gin.Context, *httptest.ResponseRecorder) {
	gin.SetMode(gin.TestMode)
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = httptest.NewRequest(http.MethodGet, url, nil)
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
	return "### Work Step\n\nCall DeepRouter at POST https://api.deeprouter.ai/v1/routing/chat/completions with the runner's own key, then base the final answer on the returned routing result."
}
