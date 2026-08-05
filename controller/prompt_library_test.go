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
