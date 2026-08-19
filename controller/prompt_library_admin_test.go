package controller

import (
	"bytes"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"

	"github.com/gin-gonic/gin"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

// AdminAuth middleware is exercised at the router level; these tests hit handlers directly.
func setupPromptLibraryAdminTest(t *testing.T) *gin.Engine {
	t.Helper()
	gin.SetMode(gin.TestMode)
	// glebarez ":memory:" gives every pooled connection its own empty DB; use a
	// named shared-cache memory DB pinned to one connection so all queries see
	// the same schema/data.
	dbName := strings.NewReplacer("/", "_", " ", "_").Replace(t.Name())
	db, err := gorm.Open(sqlite.Open("file:"+dbName+"?mode=memory&cache=shared"), &gorm.Config{})
	require.NoError(t, err)
	sqlDB, err := db.DB()
	require.NoError(t, err)
	sqlDB.SetMaxOpenConns(1)
	require.NoError(t, db.AutoMigrate(&model.PromptLibraryItem{}))
	prevDB := model.DB
	model.DB = db
	t.Cleanup(func() {
		model.DB = prevDB
		require.NoError(t, sqlDB.Close())
	})

	r := gin.New()
	admin := r.Group("/api/prompt-library/admin")
	admin.GET("", ListPromptLibraryAdmin)
	admin.POST("", CreatePromptLibraryAdmin)
	admin.PUT("/:id", UpdatePromptLibraryAdmin)
	admin.PUT("/:id/enabled", UpdatePromptLibraryEnabledAdmin)
	admin.DELETE("/:id", DeletePromptLibraryAdmin)
	return r
}

const validAdminItemJSON = `{
	"slug": "admin-item",
	"category": "image",
	"model": "gpt-image-2",
	"prompt": "an admin created prompt",
	"title": {"en": "Admin Item"},
	"artifact": {"kind": "image", "url": "https://example.com/a.png"},
	"source": {"label": "@a", "platform": "X", "url": "https://x.com/a/status/1"},
	"enabled": true
}`

func TestAdminCreateListUpdateDelete(t *testing.T) {
	r := setupPromptLibraryAdminTest(t)

	// Create
	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/api/prompt-library/admin", bytes.NewReader([]byte(validAdminItemJSON)))
	r.ServeHTTP(rec, req)
	require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())

	var created struct {
		Success bool `json:"success"`
		Data    struct {
			Id int `json:"id"`
		} `json:"data"`
	}
	require.NoError(t, common.Unmarshal(rec.Body.Bytes(), &created))
	require.True(t, created.Success)
	require.NotZero(t, created.Data.Id)

	// List (admin view: includes disabled, raw rows)
	rec2 := httptest.NewRecorder()
	r.ServeHTTP(rec2, httptest.NewRequest(http.MethodGet, "/api/prompt-library/admin?p=1&page_size=10", nil))
	require.Equal(t, http.StatusOK, rec2.Code)
	var listed struct {
		Data struct {
			Total int                       `json:"total"`
			Items []model.PromptLibraryItem `json:"items"`
		} `json:"data"`
	}
	require.NoError(t, common.Unmarshal(rec2.Body.Bytes(), &listed))
	require.Equal(t, 1, listed.Data.Total)
	require.Equal(t, "admin-item", listed.Data.Items[0].Slug)

	// Update: change prompt + disable
	update := `{
		"slug": "admin-item",
		"category": "image",
		"model": "gpt-image-2",
		"prompt": "updated prompt",
		"title": {"en": "Admin Item"},
		"artifact": {"kind": "image", "url": "https://example.com/a.png"},
		"source": {"label": "@a", "platform": "X", "url": "https://x.com/a/status/1"},
		"enabled": false
	}`
	rec3 := httptest.NewRecorder()
	r.ServeHTTP(rec3, httptest.NewRequest(http.MethodPut, "/api/prompt-library/admin/1", bytes.NewReader([]byte(update))))
	require.Equal(t, http.StatusOK, rec3.Code, rec3.Body.String())
	item, err := model.GetPromptLibraryItemById(1)
	require.NoError(t, err)
	require.NotNil(t, item)
	require.Equal(t, "updated prompt", item.Prompt)
	require.False(t, item.Enabled)

	// Delete
	rec4 := httptest.NewRecorder()
	r.ServeHTTP(rec4, httptest.NewRequest(http.MethodDelete, "/api/prompt-library/admin/1", nil))
	require.Equal(t, http.StatusOK, rec4.Code)
	gone, err := model.GetPromptLibraryItemById(1)
	require.NoError(t, err)
	require.Nil(t, gone)
}

func TestAdminCreateRejectsInvalidItem(t *testing.T) {
	r := setupPromptLibraryAdminTest(t)
	bad := `{"slug": "", "category": "image", "model": "m", "prompt": "p"}`
	rec := httptest.NewRecorder()
	r.ServeHTTP(rec, httptest.NewRequest(http.MethodPost, "/api/prompt-library/admin", bytes.NewReader([]byte(bad))))
	require.Equal(t, http.StatusBadRequest, rec.Code)
}

func TestAdminUpdateRejectsSlugCollision(t *testing.T) {
	r := setupPromptLibraryAdminTest(t)
	rec := httptest.NewRecorder()
	r.ServeHTTP(rec, httptest.NewRequest(http.MethodPost, "/api/prompt-library/admin", bytes.NewReader([]byte(validAdminItemJSON))))
	require.Equal(t, http.StatusOK, rec.Code)

	second := `{
		"slug": "second-item", "category": "image", "model": "gpt-image-2", "prompt": "p",
		"title": {"en": "t"},
		"artifact": {"kind": "image", "url": "https://example.com/b.png"},
		"source": {"label": "@b", "platform": "X", "url": "https://x.com/b/status/1"},
		"enabled": true
	}`
	rec2 := httptest.NewRecorder()
	r.ServeHTTP(rec2, httptest.NewRequest(http.MethodPost, "/api/prompt-library/admin", bytes.NewReader([]byte(second))))
	require.Equal(t, http.StatusOK, rec2.Code)

	// change second-item's slug to admin-item → unique conflict → 400
	collide := `{
		"slug": "admin-item", "category": "image", "model": "gpt-image-2", "prompt": "p",
		"title": {"en": "t"},
		"artifact": {"kind": "image", "url": "https://example.com/b.png"},
		"source": {"label": "@b", "platform": "X", "url": "https://x.com/b/status/1"},
		"enabled": true
	}`
	rec3 := httptest.NewRecorder()
	r.ServeHTTP(rec3, httptest.NewRequest(http.MethodPut, "/api/prompt-library/admin/2", bytes.NewReader([]byte(collide))))
	require.Equal(t, http.StatusBadRequest, rec3.Code, rec3.Body.String())
}

func TestAdminUpdateNonexistentIdReturns404(t *testing.T) {
	r := setupPromptLibraryAdminTest(t)
	rec := httptest.NewRecorder()
	r.ServeHTTP(rec, httptest.NewRequest(http.MethodPut, "/api/prompt-library/admin/999", bytes.NewReader([]byte(validAdminItemJSON))))
	require.Equal(t, http.StatusNotFound, rec.Code, rec.Body.String())
}

func TestAdminCreateRejectsDuplicateSlug(t *testing.T) {
	r := setupPromptLibraryAdminTest(t)
	rec := httptest.NewRecorder()
	r.ServeHTTP(rec, httptest.NewRequest(http.MethodPost, "/api/prompt-library/admin", bytes.NewReader([]byte(validAdminItemJSON))))
	require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())

	rec2 := httptest.NewRecorder()
	r.ServeHTTP(rec2, httptest.NewRequest(http.MethodPost, "/api/prompt-library/admin", bytes.NewReader([]byte(validAdminItemJSON))))
	require.Equal(t, http.StatusBadRequest, rec2.Code, rec2.Body.String())
	require.Contains(t, rec2.Body.String(), "slug already exists")
}

func TestAdminEnabledToggle(t *testing.T) {
	r := setupPromptLibraryAdminTest(t)
	rec := httptest.NewRecorder()
	r.ServeHTTP(rec, httptest.NewRequest(http.MethodPost, "/api/prompt-library/admin", bytes.NewReader([]byte(validAdminItemJSON))))
	require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())

	rec2 := httptest.NewRecorder()
	r.ServeHTTP(rec2, httptest.NewRequest(http.MethodPut, "/api/prompt-library/admin/1/enabled", bytes.NewReader([]byte(`{"enabled": false}`))))
	require.Equal(t, http.StatusOK, rec2.Code, rec2.Body.String())
	var response struct {
		Success bool `json:"success"`
		Data    struct {
			Id      int  `json:"id"`
			Enabled bool `json:"enabled"`
		} `json:"data"`
	}
	require.NoError(t, common.Unmarshal(rec2.Body.Bytes(), &response))
	require.True(t, response.Success)
	require.Equal(t, 1, response.Data.Id)
	require.False(t, response.Data.Enabled)

	item, err := model.GetPromptLibraryItemById(1)
	require.NoError(t, err)
	require.NotNil(t, item)
	require.False(t, item.Enabled)
	// content columns untouched by the single-column update
	require.Equal(t, "an admin created prompt", item.Prompt)

	// flip back on
	rec3 := httptest.NewRecorder()
	r.ServeHTTP(rec3, httptest.NewRequest(http.MethodPut, "/api/prompt-library/admin/1/enabled", bytes.NewReader([]byte(`{"enabled": true}`))))
	require.Equal(t, http.StatusOK, rec3.Code, rec3.Body.String())
	item, err = model.GetPromptLibraryItemById(1)
	require.NoError(t, err)
	require.NotNil(t, item)
	require.True(t, item.Enabled)
}

func TestAdminEnabledToggleNonexistentIdReturns404(t *testing.T) {
	r := setupPromptLibraryAdminTest(t)
	rec := httptest.NewRecorder()
	r.ServeHTTP(rec, httptest.NewRequest(http.MethodPut, "/api/prompt-library/admin/999/enabled", bytes.NewReader([]byte(`{"enabled": false}`))))
	require.Equal(t, http.StatusNotFound, rec.Code, rec.Body.String())
	require.Contains(t, rec.Body.String(), "prompt library item not found")
}

func TestAdminEnabledToggleSameValueIsIdempotent200(t *testing.T) {
	// Contract: repeating a toggle with the same value must stay 200 (no-op),
	// never 404. On MySQL a no-change UPDATE reports 0 rows affected and the
	// handler disambiguates via an existence re-check; glebarez sqlite counts
	// matched rows as affected (probed: returns 1), so the 0-rows branch
	// itself is MySQL-specific — this test pins the observable behavior.
	r := setupPromptLibraryAdminTest(t)
	rec := httptest.NewRecorder()
	r.ServeHTTP(rec, httptest.NewRequest(http.MethodPost, "/api/prompt-library/admin", bytes.NewReader([]byte(validAdminItemJSON))))
	require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())

	for i := 0; i < 2; i++ {
		rec2 := httptest.NewRecorder()
		r.ServeHTTP(rec2, httptest.NewRequest(http.MethodPut, "/api/prompt-library/admin/1/enabled", bytes.NewReader([]byte(`{"enabled": true}`))))
		require.Equal(t, http.StatusOK, rec2.Code, "call %d: %s", i+1, rec2.Body.String())
		var response struct {
			Success bool `json:"success"`
			Data    struct {
				Id      int  `json:"id"`
				Enabled bool `json:"enabled"`
			} `json:"data"`
		}
		require.NoError(t, common.Unmarshal(rec2.Body.Bytes(), &response))
		require.True(t, response.Success)
		require.Equal(t, 1, response.Data.Id)
		require.True(t, response.Data.Enabled)
	}
	item, err := model.GetPromptLibraryItemById(1)
	require.NoError(t, err)
	require.NotNil(t, item)
	require.True(t, item.Enabled)
}
