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
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func TestCompanyLogQueriesRequireUserIDOne(t *testing.T) {
	gin.SetMode(gin.TestMode)
	handlers := map[string]gin.HandlerFunc{
		"/api/log":           GetAllLogs,
		"/api/log/self":      GetUserLogs,
		"/api/log/stat":      GetLogsStat,
		"/api/log/self/stat": GetLogsSelfStat,
	}

	for path, handler := range handlers {
		t.Run(strings.TrimPrefix(path, "/api/log"), func(t *testing.T) {
			recorder := httptest.NewRecorder()
			ctx, _ := gin.CreateTestContext(recorder)
			ctx.Request = httptest.NewRequest(http.MethodGet, path+"?company=true", nil)
			ctx.Set("id", 2)

			handler(ctx)

			require.Equal(t, http.StatusForbidden, recorder.Code)
			require.JSONEq(t, `{"success":false,"message":"Forbidden"}`, recorder.Body.String())
		})
	}
}

func TestCompanyLogQueriesUseCompanyTableAndIgnoreNonAdmin(t *testing.T) {
	gin.SetMode(gin.TestMode)
	db, err := gorm.Open(sqlite.Open("file:"+strings.ReplaceAll(t.Name(), "/", "_")+"?mode=memory&cache=shared"), &gorm.Config{})
	require.NoError(t, err)
	require.NoError(t, db.AutoMigrate(&model.Log{}, &model.CompanyLogSchema{}))

	originalDB := model.DB
	originalLogDB := model.LOG_DB
	model.DB = db
	model.LOG_DB = db
	t.Cleanup(func() {
		model.DB = originalDB
		model.LOG_DB = originalLogDB
	})

	createdAt := time.Now().Unix()
	require.NoError(t, db.Create(&model.Log{
		UserId: 1, CreatedAt: createdAt, Type: model.LogTypeConsume,
		Content: "default", Quota: 11, PromptTokens: 2, CompletionTokens: 3,
	}).Error)
	require.NoError(t, db.Create(&model.CompanyLogSchema{
		UserId: 1, CreatedAt: createdAt, Type: model.LogTypeConsume,
		Content: "company", Quota: 23, PromptTokens: 5, CompletionTokens: 7,
	}).Error)

	listHandlers := []struct {
		path    string
		handler gin.HandlerFunc
	}{
		{path: "/api/log?company=true&non_admin=true", handler: GetAllLogs},
		{path: "/api/log/self?company=true", handler: GetUserLogs},
	}
	for _, test := range listHandlers {
		recorder := runCompanyLogHandler(test.path, test.handler)
		require.Equal(t, http.StatusOK, recorder.Code)
		var response struct {
			Success bool `json:"success"`
			Data    struct {
				Total int         `json:"total"`
				Items []model.Log `json:"items"`
			} `json:"data"`
		}
		require.NoError(t, common.Unmarshal(recorder.Body.Bytes(), &response))
		require.True(t, response.Success)
		require.Equal(t, 1, response.Data.Total)
		require.Len(t, response.Data.Items, 1)
		require.Equal(t, "company", response.Data.Items[0].Content)
	}

	statHandlers := []struct {
		path    string
		handler gin.HandlerFunc
	}{
		{path: "/api/log/stat?company=true&non_admin=true", handler: GetLogsStat},
		{path: "/api/log/self/stat?company=true", handler: GetLogsSelfStat},
	}
	for _, test := range statHandlers {
		recorder := runCompanyLogHandler(test.path, test.handler)
		require.Equal(t, http.StatusOK, recorder.Code)
		var response struct {
			Success bool `json:"success"`
			Data    struct {
				Quota int `json:"quota"`
				Rpm   int `json:"rpm"`
				Tpm   int `json:"tpm"`
			} `json:"data"`
		}
		require.NoError(t, common.Unmarshal(recorder.Body.Bytes(), &response))
		require.True(t, response.Success)
		require.Equal(t, 23, response.Data.Quota)
		require.Equal(t, 1, response.Data.Rpm)
		require.Equal(t, 12, response.Data.Tpm)
	}
}

func runCompanyLogHandler(path string, handler gin.HandlerFunc) *httptest.ResponseRecorder {
	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Request = httptest.NewRequest(http.MethodGet, path, nil)
	ctx.Set("id", 1)
	ctx.Set("role", common.RoleRootUser)
	handler(ctx)
	return recorder
}
