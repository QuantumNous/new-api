package controller

import (
	"bytes"
	"net/http"
	"net/http/httptest"
	"os"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/middleware"
	"github.com/QuantumNous/new-api/model"

	"github.com/gin-gonic/gin"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func setupPromptLibraryImportTest(t *testing.T) *gin.Engine {
	t.Helper()
	gin.SetMode(gin.TestMode)
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	require.NoError(t, err)
	require.NoError(t, db.AutoMigrate(&model.Ability{}, &model.Model{}, &model.PromptLibraryItem{}))
	model.DB = db
	require.NoError(t, db.Create(&model.Ability{
		Group:     "default",
		Model:     "gpt-image-2",
		ChannelId: 1,
		Enabled:   true,
	}).Error)

	t.Setenv(middleware.PromptLibraryImportTokenEnv, "secret")
	r := gin.New()
	g := r.Group("/api/prompt-library")
	g.Use(middleware.PromptLibraryImportAuth())
	g.POST("/import", ImportPromptLibrary)
	return r
}

func TestImportPromptLibraryPersistsOnlyCompleteAllowedItems(t *testing.T) {
	r := setupPromptLibraryImportTest(t)
	body := []byte(`{
		"items": [
			{
				"slug": "valid-image",
				"category": "image",
				"model": "gpt-image-2",
				"prompt": "Create a product image",
				"title": {"en": "Valid image"},
				"summary": {"en": "A complete imported prompt"},
				"tags": ["product"],
				"output": {"ratio": "1:1"},
				"artifact": {"kind": "image", "url": "https://example.com/output.png", "alt": "output"},
				"source": {"label": "GitHub", "platform": "GitHub", "url": "https://github.com/flatkey-ai/example", "captured_at": "2026-08-05"}
			},
			{
				"slug": "unknown-model",
				"category": "image",
				"model": "seedance-2.0",
				"prompt": "Create a product image",
				"title": {"en": "Unknown model"},
				"artifact": {"kind": "image", "url": "https://example.com/output.png"},
				"source": {"label": "X", "platform": "Social", "url": "https://x.com/example/status/1"}
			},
			{
				"slug": "missing-artifact",
				"category": "image",
				"model": "gpt-image-2",
				"prompt": "Create a product image",
				"title": {"en": "Missing artifact"},
				"source": {"label": "GitHub", "platform": "GitHub", "url": "https://github.com/flatkey-ai/example"}
			}
		]
	}`)

	req := httptest.NewRequest(http.MethodPost, "/api/prompt-library/import", bytes.NewReader(body))
	req.Header.Set("Authorization", "Bearer secret")
	rec := httptest.NewRecorder()
	r.ServeHTTP(rec, req)

	require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())
	var response struct {
		Success bool `json:"success"`
		Data    struct {
			Imported int `json:"imported"`
			Rejected int `json:"rejected"`
		} `json:"data"`
	}
	require.NoError(t, common.Unmarshal(rec.Body.Bytes(), &response))
	require.True(t, response.Success)
	require.Equal(t, 1, response.Data.Imported)
	require.Equal(t, 2, response.Data.Rejected)

	var count int64
	require.NoError(t, model.DB.Model(&model.PromptLibraryItem{}).Count(&count).Error)
	require.EqualValues(t, 1, count)
	var item model.PromptLibraryItem
	require.NoError(t, model.DB.First(&item, "slug = ?", "valid-image").Error)
	require.Equal(t, "gpt-image-2", item.Model)
	require.Equal(t, "GitHub", item.SourcePlatform)
}

func TestImportPromptLibraryRequiresBearerToken(t *testing.T) {
	r := setupPromptLibraryImportTest(t)
	req := httptest.NewRequest(http.MethodPost, "/api/prompt-library/import", bytes.NewReader([]byte(`{"items":[]}`)))
	rec := httptest.NewRecorder()
	r.ServeHTTP(rec, req)
	require.Equal(t, http.StatusUnauthorized, rec.Code)
}

func TestImportPromptLibraryClosedWhenTokenUnset(t *testing.T) {
	r := setupPromptLibraryImportTest(t)
	os.Unsetenv(middleware.PromptLibraryImportTokenEnv)
	req := httptest.NewRequest(http.MethodPost, "/api/prompt-library/import", bytes.NewReader([]byte(`{"items":[]}`)))
	req.Header.Set("Authorization", "Bearer secret")
	rec := httptest.NewRecorder()
	r.ServeHTTP(rec, req)
	require.Equal(t, http.StatusServiceUnavailable, rec.Code)
}

func setupPromptLibraryPublicTest(t *testing.T) *gin.Engine {
	t.Helper()
	gin.SetMode(gin.TestMode)
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	require.NoError(t, err)
	require.NoError(t, db.AutoMigrate(&model.PromptLibraryItem{}))
	prevDB := model.DB
	model.DB = db
	t.Cleanup(func() { model.DB = prevDB })

	seed := func(slug, category string, enabled bool) {
		item := model.PromptLibraryItem{
			Slug: slug, Category: category, Model: "gpt-image-2", Prompt: "prompt of " + slug,
			TitleJSON:      `{"en":"` + slug + `"}`,
			ArtifactJSON:   `{"kind":"image","url":"https://example.com/` + slug + `.png"}`,
			SourceJSON:     `{"label":"@a","platform":"X","url":"https://x.com/a/status/1"}`,
			SourcePlatform: "X", SourceURL: "https://x.com/a/status/1",
			Enabled: true,
		}
		require.NoError(t, db.Create(&item).Error)
		if !enabled {
			// gorm default:true swallows zero-value false on INSERT; disable via explicit update
			require.NoError(t, db.Model(&item).Update("enabled", false).Error)
		}
	}
	seed("pub-one", "image", true)
	seed("pub-two", "image", true)
	seed("pub-off", "image", false)

	r := gin.New()
	g := r.Group("/api/prompt-library")
	g.GET("", ListPromptLibrary)
	g.GET("/:slug", GetPromptLibraryItem)
	return r
}

func TestListPromptLibraryPublicExcludesDisabledAndPaginates(t *testing.T) {
	r := setupPromptLibraryPublicTest(t)
	rec := httptest.NewRecorder()
	r.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/api/prompt-library?category=image&p=1&page_size=1", nil))
	require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())
	var response struct {
		Success bool `json:"success"`
		Data    struct {
			Total int              `json:"total"`
			Items []map[string]any `json:"items"`
		} `json:"data"`
	}
	require.NoError(t, common.Unmarshal(rec.Body.Bytes(), &response))
	require.True(t, response.Success)
	require.Equal(t, 2, response.Data.Total) // disabled not counted
	require.Len(t, response.Data.Items, 1)   // page_size=1
	artifact, ok := response.Data.Items[0]["artifact"].(map[string]any)
	require.True(t, ok)
	require.Contains(t, artifact["url"], "https://example.com/")
}

func TestGetPromptLibraryItemPublic404s(t *testing.T) {
	r := setupPromptLibraryPublicTest(t)

	rec := httptest.NewRecorder()
	r.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/api/prompt-library/pub-one", nil))
	require.Equal(t, http.StatusOK, rec.Code)

	rec2 := httptest.NewRecorder()
	r.ServeHTTP(rec2, httptest.NewRequest(http.MethodGet, "/api/prompt-library/pub-off", nil))
	require.Equal(t, http.StatusNotFound, rec2.Code) // disabled behaves as absent

	rec3 := httptest.NewRecorder()
	r.ServeHTTP(rec3, httptest.NewRequest(http.MethodGet, "/api/prompt-library/no-such", nil))
	require.Equal(t, http.StatusNotFound, rec3.Code)
}

func TestListPromptLibraryPublicRejectsBadCategory(t *testing.T) {
	r := setupPromptLibraryPublicTest(t)
	rec := httptest.NewRecorder()
	r.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/api/prompt-library?category=nope", nil))
	require.Equal(t, http.StatusBadRequest, rec.Code)
}

func TestListPromptLibraryPublicSurvivesCorruptJSONColumn(t *testing.T) {
	r := setupPromptLibraryPublicTest(t)
	// One row with a corrupt JSON column must degrade to the fallback value
	// instead of failing the whole listing with a 500.
	item := model.PromptLibraryItem{
		Slug: "pub-corrupt", Category: "image", Model: "gpt-image-2", Prompt: "prompt of pub-corrupt",
		TitleJSON:      `{"en":"pub-corrupt"}`,
		ArtifactJSON:   "{corrupt",
		SourceJSON:     `{"label":"@a","platform":"X","url":"https://x.com/a/status/1"}`,
		SourcePlatform: "X", SourceURL: "https://x.com/a/status/1",
		Enabled: true,
	}
	require.NoError(t, model.DB.Create(&item).Error)

	rec := httptest.NewRecorder()
	r.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/api/prompt-library?page_size=10", nil))
	require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())
	var response struct {
		Success bool `json:"success"`
		Data    struct {
			Total int              `json:"total"`
			Items []map[string]any `json:"items"`
		} `json:"data"`
	}
	require.NoError(t, common.Unmarshal(rec.Body.Bytes(), &response))
	require.True(t, response.Success)
	require.Equal(t, 3, response.Data.Total) // pub-one, pub-two, pub-corrupt
	var corrupt map[string]any
	for _, listed := range response.Data.Items {
		if listed["slug"] == "pub-corrupt" {
			corrupt = listed
		}
	}
	require.NotNil(t, corrupt, "corrupt row must still be listed")
	require.Equal(t, map[string]any{}, corrupt["artifact"])                 // fallback, not the raw garbage
	require.Equal(t, map[string]any{"en": "pub-corrupt"}, corrupt["title"]) // valid columns untouched
}

func TestGetPromptLibraryItemPublicNormalizesLiteralNullColumns(t *testing.T) {
	r := setupPromptLibraryPublicTest(t)
	// The import path marshals absent optional fields (title/summary/tags/output)
	// via common.Marshal(nil), which stores the literal string "null".
	item := model.PromptLibraryItem{
		Slug: "pub-null", Category: "image", Model: "gpt-image-2", Prompt: "prompt of pub-null",
		TitleJSON:      `{"en":"pub-null"}`,
		SummaryJSON:    "null",
		TagsJSON:       "null",
		OutputJSON:     "null",
		ArtifactJSON:   `{"kind":"image","url":"https://example.com/pub-null.png"}`,
		SourceJSON:     `{"label":"@a","platform":"X","url":"https://x.com/a/status/1"}`,
		SourcePlatform: "X", SourceURL: "https://x.com/a/status/1",
		Enabled: true,
	}
	require.NoError(t, model.DB.Create(&item).Error)

	rec := httptest.NewRecorder()
	r.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/api/prompt-library/pub-null", nil))
	require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())
	var response struct {
		Success bool `json:"success"`
		Data    struct {
			Item map[string]any `json:"item"`
		} `json:"data"`
	}
	require.NoError(t, common.Unmarshal(rec.Body.Bytes(), &response))
	require.True(t, response.Success)
	require.Equal(t, map[string]any{"en": "pub-null"}, response.Data.Item["title"])
	require.Equal(t, map[string]any{}, response.Data.Item["summary"]) // literal "null" column -> {}
	require.Equal(t, []any{}, response.Data.Item["tags"])             // literal "null" column -> []
	require.Equal(t, map[string]any{}, response.Data.Item["output"])  // literal "null" column -> {}
}
