package controller

import (
	"encoding/csv"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strconv"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/middleware"
	"github.com/QuantumNous/new-api/model"
	"github.com/gin-contrib/sessions"
	"github.com/gin-contrib/sessions/cookie"
	"github.com/gin-gonic/gin"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

type logExportAPIResponse struct {
	Success bool   `json:"success"`
	Message string `json:"message"`
}

func setupLogControllerTestDB(t *testing.T) *gorm.DB {
	t.Helper()

	gin.SetMode(gin.TestMode)
	common.UsingSQLite = true
	common.UsingMySQL = false
	common.UsingPostgreSQL = false
	common.RedisEnabled = false

	dsn := fmt.Sprintf("file:%s?mode=memory&cache=shared", strings.ReplaceAll(t.Name(), "/", "_"))
	db, err := gorm.Open(sqlite.Open(dsn), &gorm.Config{})
	if err != nil {
		t.Fatalf("failed to open sqlite db: %v", err)
	}
	model.DB = db
	model.LOG_DB = db

	if err := db.AutoMigrate(&model.User{}, &model.Log{}, &model.Option{}); err != nil {
		t.Fatalf("failed to migrate test tables: %v", err)
	}

	t.Cleanup(func() {
		sqlDB, err := db.DB()
		if err == nil {
			_ = sqlDB.Close()
		}
	})

	return db
}

func seedExportUser(t *testing.T, db *gorm.DB, id int, username string, accessToken string) *model.User {
	t.Helper()

	user := &model.User{
		Id:       id,
		Username: username,
		Password: "password123",
		Role:     common.RoleCommonUser,
		Status:   common.UserStatusEnabled,
		Group:    "team-a",
		AffCode:  fmt.Sprintf("aff-%d", id),
	}
	user.SetAccessToken(accessToken)
	require.NoError(t, db.Create(user).Error)
	return user
}

func seedExportAdmin(t *testing.T, db *gorm.DB, id int, username string, accessToken string) *model.User {
	t.Helper()

	user := &model.User{
		Id:       id,
		Username: username,
		Password: "password123",
		Role:     common.RoleAdminUser,
		Status:   common.UserStatusEnabled,
		Group:    "default",
		AffCode:  fmt.Sprintf("aff-admin-%d", id),
	}
	user.SetAccessToken(accessToken)
	require.NoError(t, db.Create(user).Error)
	return user
}

func seedExportLog(t *testing.T, db *gorm.DB, log *model.Log) {
	t.Helper()
	require.NoError(t, db.Create(log).Error)
}

func newLogExportRouter() *gin.Engine {
	router := gin.New()
	store := cookie.NewStore([]byte("log-export-test"))
	router.Use(sessions.Sessions("new-api-test", store))
	router.GET("/api/log/export", middleware.AdminAuth(), ExportAllLogsCSV)
	router.GET("/api/log/self/export", middleware.UserAuth(), ExportUserLogsCSV)
	return router
}

func decodeLogExportAPIResponse(t *testing.T, recorder *httptest.ResponseRecorder) logExportAPIResponse {
	t.Helper()

	var response logExportAPIResponse
	require.NoError(t, common.Unmarshal(recorder.Body.Bytes(), &response))
	return response
}

func TestExportUserLogsCSV_RequiresAuthentication(t *testing.T) {
	setupLogControllerTestDB(t)
	router := newLogExportRouter()

	req := httptest.NewRequest(http.MethodGet, "/api/log/self/export", nil)
	recorder := httptest.NewRecorder()
	router.ServeHTTP(recorder, req)

	assert.Equal(t, http.StatusUnauthorized, recorder.Code)
	response := decodeLogExportAPIResponse(t, recorder)
	assert.False(t, response.Success)
	assert.Contains(t, response.Message, "未登录")
}

func TestExportUserLogsCSV_ExportsOnlyCurrentUserAndBackfilledLogs(t *testing.T) {
	db := setupLogControllerTestDB(t)
	router := newLogExportRouter()

	user := seedExportUser(t, db, 1, "alice", "token-alice")
	seedExportUser(t, db, 2, "bob", "token-bob")

	seedExportLog(t, db, &model.Log{
		UserId:           user.Id,
		Username:         user.Username,
		CreatedAt:        1_700_000_100,
		Type:             model.LogTypeConsume,
		TokenName:        "alpha",
		ModelName:        "gpt-4o-mini",
		Group:            "team-a",
		RequestId:        "req-alice",
		RequestPath:      "",
		Quota:            42,
		PromptTokens:     120,
		CompletionTokens: 60,
		Ip:               "127.0.0.1",
		Other:            common.MapToJsonStr(map[string]interface{}{"request_path": "/v1/chat/completions"}),
	})
	seedExportLog(t, db, &model.Log{
		UserId:      user.Id,
		Username:    user.Username,
		CreatedAt:   1_700_000_200,
		Type:        model.LogTypeConsume,
		TokenName:   "alpha",
		ModelName:   "gpt-4o-mini",
		Group:       "team-a",
		RequestId:   "req-other-path",
		RequestPath: "/v1/responses",
		Other:       common.MapToJsonStr(map[string]interface{}{"request_path": "/v1/responses"}),
	})
	seedExportLog(t, db, &model.Log{
		UserId:      2,
		Username:    "bob",
		CreatedAt:   1_700_000_300,
		Type:        model.LogTypeConsume,
		TokenName:   "alpha",
		ModelName:   "gpt-4o-mini",
		Group:       "team-a",
		RequestId:   "req-bob",
		RequestPath: "/v1/chat/completions",
		Other:       common.MapToJsonStr(map[string]interface{}{"request_path": "/v1/chat/completions"}),
	})

	_, err := model.BackfillLogRequestPath(10)
	require.NoError(t, err)

	req := httptest.NewRequest(
		http.MethodGet,
		"/api/log/self/export?start_timestamp=1700000000&end_timestamp=1700000999&token_name=alpha&model_name=gpt-4o-mini&group=team-a&request_id=req-alice&request_path=/v1/chat/completions",
		nil,
	)
	req.Header.Set("Authorization", "Bearer token-alice")
	req.Header.Set("New-Api-User", strconv.Itoa(user.Id))

	recorder := httptest.NewRecorder()
	router.ServeHTTP(recorder, req)

	require.Equal(t, http.StatusOK, recorder.Code)
	assert.Contains(t, recorder.Header().Get("Content-Type"), "text/csv")

	reader := csv.NewReader(strings.NewReader(recorder.Body.String()))
	records, err := reader.ReadAll()
	require.NoError(t, err)
	require.Len(t, records, 2)
	assert.Equal(t, []string{
		"used_at",
		"username",
		"token_name",
		"model_name",
		"request_path",
		"quota",
		"prompt_tokens",
		"completion_tokens",
		"ip",
		"request_id",
		"group",
		"log_type",
	}, normalizeCSVHeader(records[0]))
	assert.Equal(t, "alice", records[1][1])
	assert.Equal(t, "/v1/chat/completions", records[1][4])
	assert.Equal(t, "req-alice", records[1][9])
}

func TestExportAllLogsCSV_AdminUsesPageFilters(t *testing.T) {
	db := setupLogControllerTestDB(t)
	router := newLogExportRouter()

	admin := seedExportAdmin(t, db, 99, "admin", "token-admin")
	seedExportUser(t, db, 1, "alice", "token-alice")
	seedExportUser(t, db, 2, "bob", "token-bob")

	seedExportLog(t, db, &model.Log{
		UserId:           1,
		Username:         "alice",
		CreatedAt:        1_700_000_100,
		Type:             model.LogTypeConsume,
		TokenName:        "alpha",
		ModelName:        "gpt-4o-mini",
		Group:            "team-a",
		ChannelId:        11,
		RequestId:        "req-admin-match",
		RequestPath:      "/v1/chat/completions",
		Quota:            100,
		PromptTokens:     10,
		CompletionTokens: 20,
		Ip:               "127.0.0.1",
	})
	seedExportLog(t, db, &model.Log{
		UserId:           1,
		Username:         "alice",
		CreatedAt:        1_700_000_200,
		Type:             model.LogTypeConsume,
		TokenName:        "alpha",
		ModelName:        "gpt-4o-mini",
		Group:            "team-a",
		ChannelId:        12,
		RequestId:        "req-wrong-channel",
		RequestPath:      "/v1/chat/completions",
		Quota:            100,
		PromptTokens:     10,
		CompletionTokens: 20,
		Ip:               "127.0.0.2",
	})
	seedExportLog(t, db, &model.Log{
		UserId:           2,
		Username:         "bob",
		CreatedAt:        1_700_000_300,
		Type:             model.LogTypeConsume,
		TokenName:        "alpha",
		ModelName:        "gpt-4o-mini",
		Group:            "team-a",
		ChannelId:        11,
		RequestId:        "req-wrong-user",
		RequestPath:      "/v1/chat/completions",
		Quota:            100,
		PromptTokens:     10,
		CompletionTokens: 20,
		Ip:               "127.0.0.3",
	})

	req := httptest.NewRequest(
		http.MethodGet,
		"/api/log/export?start_timestamp=1700000000&end_timestamp=1700000999&username=alice&channel=11&request_path=/v1/chat/completions",
		nil,
	)
	req.Header.Set("Authorization", "Bearer token-admin")
	req.Header.Set("New-Api-User", strconv.Itoa(admin.Id))

	recorder := httptest.NewRecorder()
	router.ServeHTTP(recorder, req)

	require.Equal(t, http.StatusOK, recorder.Code)
	assert.Contains(t, recorder.Header().Get("Content-Type"), "text/csv")

	reader := csv.NewReader(strings.NewReader(recorder.Body.String()))
	records, err := reader.ReadAll()
	require.NoError(t, err)
	require.Len(t, records, 2)
	assert.Equal(t, []string{
		"used_at",
		"username",
		"token_name",
		"model_name",
		"request_path",
		"quota",
		"prompt_tokens",
		"completion_tokens",
		"ip",
		"request_id",
		"group",
		"log_type",
		"channel_id",
	}, normalizeCSVHeader(records[0]))
	assert.Equal(t, "alice", records[1][1])
	assert.Equal(t, "req-admin-match", records[1][9])
	assert.Equal(t, "11", records[1][12])
}

func normalizeCSVHeader(header []string) []string {
	if len(header) == 0 {
		return header
	}
	header[0] = strings.TrimPrefix(header[0], "\uFEFF")
	return header
}
