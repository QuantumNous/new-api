package handler

import (
	"encoding/json"
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
		Description:          "long",
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
