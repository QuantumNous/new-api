package controller

import (
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/gin-gonic/gin"
	"github.com/glebarez/sqlite"
	"gorm.io/gorm"
)

type suggestionAPIResponse struct {
	Success bool            `json:"success"`
	Message string          `json:"message"`
	Data    json.RawMessage `json:"data"`
}

func setupLogSuggestionControllerTestDB(t *testing.T) *gorm.DB {
	t.Helper()

	gin.SetMode(gin.TestMode)
	common.UsingSQLite = true
	common.UsingMySQL = false
	common.UsingPostgreSQL = false
	common.RedisEnabled = false
	common.MemoryCacheEnabled = false

	dsn := fmt.Sprintf("file:%s?mode=memory&cache=shared", strings.ReplaceAll(t.Name(), "/", "_"))
	db, err := gorm.Open(sqlite.Open(dsn), &gorm.Config{})
	if err != nil {
		t.Fatalf("failed to open sqlite db: %v", err)
	}
	model.DB = db
	model.LOG_DB = db

	if err := db.AutoMigrate(&model.Log{}, &model.Task{}, &model.Midjourney{}); err != nil {
		t.Fatalf("failed to migrate tables: %v", err)
	}

	t.Cleanup(func() {
		sqlDB, err := db.DB()
		if err == nil {
			_ = sqlDB.Close()
		}
	})

	return db
}

func newSuggestionContext(t *testing.T, target string, userID int) (*gin.Context, *httptest.ResponseRecorder) {
	t.Helper()

	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Request = httptest.NewRequest(http.MethodGet, target, nil)
	if userID > 0 {
		ctx.Set("id", userID)
	}
	return ctx, recorder
}

func decodeSuggestionResponse(t *testing.T, recorder *httptest.ResponseRecorder) suggestionAPIResponse {
	t.Helper()

	var response suggestionAPIResponse
	if err := common.Unmarshal(recorder.Body.Bytes(), &response); err != nil {
		t.Fatalf("failed to decode suggestion response: %v", err)
	}
	return response
}

func decodeSuggestionItems(t *testing.T, response suggestionAPIResponse) []string {
	t.Helper()

	var items []string
	if err := common.Unmarshal(response.Data, &items); err != nil {
		t.Fatalf("failed to decode suggestion items: %v", err)
	}
	return items
}

func TestGetUserLogSuggestionsScopesToCurrentUser(t *testing.T) {
	db := setupLogSuggestionControllerTestDB(t)
	if err := db.Create(&model.Log{
		UserId:    1,
		Username:  "alice",
		TokenName: "alpha-token",
		CreatedAt: 200,
		Type:      model.LogTypeConsume,
	}).Error; err != nil {
		t.Fatalf("failed to seed user log: %v", err)
	}
	if err := db.Create(&model.Log{
		UserId:    2,
		Username:  "bob",
		TokenName: "beta-token",
		CreatedAt: 300,
		Type:      model.LogTypeConsume,
	}).Error; err != nil {
		t.Fatalf("failed to seed other user log: %v", err)
	}

	ctx, recorder := newSuggestionContext(t, "/api/log/self/suggestions?field=token_name&keyword=token", 1)
	GetUserLogSuggestions(ctx)

	response := decodeSuggestionResponse(t, recorder)
	if !response.Success {
		t.Fatalf("expected success, got %s", response.Message)
	}
	items := decodeSuggestionItems(t, response)
	if len(items) != 1 || items[0] != "alpha-token" {
		t.Fatalf("unexpected self log suggestions: %#v", items)
	}
}

func TestGetAllLogSuggestionsSupportsAdminOnlyField(t *testing.T) {
	db := setupLogSuggestionControllerTestDB(t)
	if err := db.Create(&model.Log{
		UserId:    1,
		Username:  "alice",
		CreatedAt: 100,
		Type:      model.LogTypeConsume,
	}).Error; err != nil {
		t.Fatalf("failed to seed admin log: %v", err)
	}

	ctx, recorder := newSuggestionContext(t, "/api/log/suggestions?field=username&keyword=ali", 0)
	GetAllLogSuggestions(ctx)

	response := decodeSuggestionResponse(t, recorder)
	if !response.Success {
		t.Fatalf("expected success, got %s", response.Message)
	}
	items := decodeSuggestionItems(t, response)
	if len(items) != 1 || items[0] != "alice" {
		t.Fatalf("unexpected admin log suggestions: %#v", items)
	}
}

func TestGetUserTaskSuggestionsRejectsAdminOnlyField(t *testing.T) {
	setupLogSuggestionControllerTestDB(t)

	ctx, recorder := newSuggestionContext(t, "/api/task/self/suggestions?field=channel_id&keyword=1", 1)
	GetUserTaskSuggestions(ctx)

	response := decodeSuggestionResponse(t, recorder)
	if response.Success {
		t.Fatalf("expected failure for admin-only task field")
	}
}

func TestGetUserTaskSuggestionsScopeToCurrentUser(t *testing.T) {
	db := setupLogSuggestionControllerTestDB(t)
	if err := db.Create(&model.Task{
		TaskID:     "task_alpha",
		UserId:     1,
		ChannelId:  11,
		SubmitTime: 100,
	}).Error; err != nil {
		t.Fatalf("failed to seed user task: %v", err)
	}
	if err := db.Create(&model.Task{
		TaskID:     "task_beta",
		UserId:     2,
		ChannelId:  12,
		SubmitTime: 200,
	}).Error; err != nil {
		t.Fatalf("failed to seed other task: %v", err)
	}

	ctx, recorder := newSuggestionContext(t, "/api/task/self/suggestions?field=task_id&keyword=task_", 1)
	GetUserTaskSuggestions(ctx)

	response := decodeSuggestionResponse(t, recorder)
	if !response.Success {
		t.Fatalf("expected success, got %s", response.Message)
	}
	items := decodeSuggestionItems(t, response)
	if len(items) != 1 || items[0] != "task_alpha" {
		t.Fatalf("unexpected self task suggestions: %#v", items)
	}
}

func TestGetUserMidjourneySuggestionsScopeToCurrentUser(t *testing.T) {
	db := setupLogSuggestionControllerTestDB(t)
	if err := db.Create(&model.Midjourney{
		UserId:     1,
		MjId:       "mj_alpha",
		ChannelId:  21,
		SubmitTime: 1000,
	}).Error; err != nil {
		t.Fatalf("failed to seed user mj task: %v", err)
	}
	if err := db.Create(&model.Midjourney{
		UserId:     2,
		MjId:       "mj_beta",
		ChannelId:  22,
		SubmitTime: 2000,
	}).Error; err != nil {
		t.Fatalf("failed to seed other mj task: %v", err)
	}

	ctx, recorder := newSuggestionContext(t, "/api/mj/self/suggestions?field=mj_id&keyword=mj_", 1)
	GetUserMidjourneySuggestions(ctx)

	response := decodeSuggestionResponse(t, recorder)
	if !response.Success {
		t.Fatalf("expected success, got %s", response.Message)
	}
	items := decodeSuggestionItems(t, response)
	if len(items) != 1 || items[0] != "mj_alpha" {
		t.Fatalf("unexpected self mj suggestions: %#v", items)
	}
}
