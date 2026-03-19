package controller

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strconv"
	"strings"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/gin-gonic/gin"
	"github.com/glebarez/sqlite"
	"gorm.io/gorm"
)

type tokenAPIResponse struct {
	Success bool            `json:"success"`
	Message string          `json:"message"`
	Data    json.RawMessage `json:"data"`
}

type tokenPageResponse struct {
	Items []tokenResponseItem `json:"items"`
}

type tokenResponseItem struct {
	ID     int    `json:"id"`
	Name   string `json:"name"`
	Key    string `json:"key"`
	Status int    `json:"status"`
}

type tokenKeyResponse struct {
	Key string `json:"key"`
}

type tokenPeriodQuotaRecord struct {
	QuotaPeriod        string `gorm:"column:quota_period"`
	QuotaLimit         int    `gorm:"column:quota_limit"`
	QuotaUsedInPeriod  int    `gorm:"column:quota_used_in_period"`
	QuotaLastResetTime int64  `gorm:"column:quota_last_reset_time"`
	QuotaNextResetTime int64  `gorm:"column:quota_next_reset_time"`
}

func setupTokenControllerTestDB(t *testing.T) *gorm.DB {
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

	if err := db.AutoMigrate(&model.Token{}); err != nil {
		t.Fatalf("failed to migrate token table: %v", err)
	}

	t.Cleanup(func() {
		sqlDB, err := db.DB()
		if err == nil {
			_ = sqlDB.Close()
		}
	})

	return db
}

func ensureTokenPeriodQuotaColumns(t *testing.T, db *gorm.DB) {
	t.Helper()

	type tableInfoRow struct {
		Name string `gorm:"column:name"`
	}

	var columns []tableInfoRow
	if err := db.Raw("PRAGMA table_info(tokens)").Scan(&columns).Error; err != nil {
		t.Fatalf("failed to inspect token columns: %v", err)
	}

	existing := make(map[string]struct{}, len(columns))
	for _, column := range columns {
		existing[column.Name] = struct{}{}
	}

	statements := []struct {
		column string
		sql    string
	}{
		{column: "quota_period", sql: "ALTER TABLE tokens ADD COLUMN quota_period TEXT DEFAULT ''"},
		{column: "quota_limit", sql: "ALTER TABLE tokens ADD COLUMN quota_limit INTEGER DEFAULT 0"},
		{column: "quota_used_in_period", sql: "ALTER TABLE tokens ADD COLUMN quota_used_in_period INTEGER DEFAULT 0"},
		{column: "quota_last_reset_time", sql: "ALTER TABLE tokens ADD COLUMN quota_last_reset_time BIGINT DEFAULT 0"},
		{column: "quota_next_reset_time", sql: "ALTER TABLE tokens ADD COLUMN quota_next_reset_time BIGINT DEFAULT 0"},
	}

	for _, statement := range statements {
		if _, ok := existing[statement.column]; ok {
			continue
		}
		if err := db.Exec(statement.sql).Error; err != nil {
			t.Fatalf("failed to add token period quota column %s: %v", statement.column, err)
		}
	}
}

func seedToken(t *testing.T, db *gorm.DB, userID int, name string, rawKey string) *model.Token {
	t.Helper()

	token := &model.Token{
		UserId:         userID,
		Name:           name,
		Key:            rawKey,
		Status:         common.TokenStatusEnabled,
		CreatedTime:    1,
		AccessedTime:   1,
		ExpiredTime:    -1,
		RemainQuota:    100,
		UnlimitedQuota: true,
		Group:          "default",
	}
	if err := db.Create(token).Error; err != nil {
		t.Fatalf("failed to create token: %v", err)
	}
	return token
}

func newAuthenticatedContext(t *testing.T, method string, target string, body any, userID int) (*gin.Context, *httptest.ResponseRecorder) {
	t.Helper()

	var requestBody *bytes.Reader
	if body != nil {
		payload, err := common.Marshal(body)
		if err != nil {
			t.Fatalf("failed to marshal request body: %v", err)
		}
		requestBody = bytes.NewReader(payload)
	} else {
		requestBody = bytes.NewReader(nil)
	}

	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Request = httptest.NewRequest(method, target, requestBody)
	if body != nil {
		ctx.Request.Header.Set("Content-Type", "application/json")
	}
	ctx.Set("id", userID)
	return ctx, recorder
}

func decodeAPIResponse(t *testing.T, recorder *httptest.ResponseRecorder) tokenAPIResponse {
	t.Helper()

	var response tokenAPIResponse
	if err := common.Unmarshal(recorder.Body.Bytes(), &response); err != nil {
		t.Fatalf("failed to decode api response: %v", err)
	}
	return response
}

func TestGetAllTokensMasksKeyInResponse(t *testing.T) {
	db := setupTokenControllerTestDB(t)
	token := seedToken(t, db, 1, "list-token", "abcd1234efgh5678")
	seedToken(t, db, 2, "other-user-token", "zzzz1234yyyy5678")

	ctx, recorder := newAuthenticatedContext(t, http.MethodGet, "/api/token/?p=1&size=10", nil, 1)
	GetAllTokens(ctx)

	response := decodeAPIResponse(t, recorder)
	if !response.Success {
		t.Fatalf("expected success response, got message: %s", response.Message)
	}

	var page tokenPageResponse
	if err := common.Unmarshal(response.Data, &page); err != nil {
		t.Fatalf("failed to decode token page response: %v", err)
	}
	if len(page.Items) != 1 {
		t.Fatalf("expected exactly one token, got %d", len(page.Items))
	}
	if page.Items[0].Key != token.GetMaskedKey() {
		t.Fatalf("expected masked key %q, got %q", token.GetMaskedKey(), page.Items[0].Key)
	}
	if strings.Contains(recorder.Body.String(), token.Key) {
		t.Fatalf("list response leaked raw token key: %s", recorder.Body.String())
	}
}

func TestSearchTokensMasksKeyInResponse(t *testing.T) {
	db := setupTokenControllerTestDB(t)
	token := seedToken(t, db, 1, "searchable-token", "ijkl1234mnop5678")

	ctx, recorder := newAuthenticatedContext(t, http.MethodGet, "/api/token/search?keyword=searchable-token&p=1&size=10", nil, 1)
	SearchTokens(ctx)

	response := decodeAPIResponse(t, recorder)
	if !response.Success {
		t.Fatalf("expected success response, got message: %s", response.Message)
	}

	var page tokenPageResponse
	if err := common.Unmarshal(response.Data, &page); err != nil {
		t.Fatalf("failed to decode search response: %v", err)
	}
	if len(page.Items) != 1 {
		t.Fatalf("expected exactly one search result, got %d", len(page.Items))
	}
	if page.Items[0].Key != token.GetMaskedKey() {
		t.Fatalf("expected masked search key %q, got %q", token.GetMaskedKey(), page.Items[0].Key)
	}
	if strings.Contains(recorder.Body.String(), token.Key) {
		t.Fatalf("search response leaked raw token key: %s", recorder.Body.String())
	}
}

func TestGetTokenMasksKeyInResponse(t *testing.T) {
	db := setupTokenControllerTestDB(t)
	token := seedToken(t, db, 1, "detail-token", "qrst1234uvwx5678")

	ctx, recorder := newAuthenticatedContext(t, http.MethodGet, "/api/token/"+strconv.Itoa(token.Id), nil, 1)
	ctx.Params = gin.Params{{Key: "id", Value: strconv.Itoa(token.Id)}}
	GetToken(ctx)

	response := decodeAPIResponse(t, recorder)
	if !response.Success {
		t.Fatalf("expected success response, got message: %s", response.Message)
	}

	var detail tokenResponseItem
	if err := common.Unmarshal(response.Data, &detail); err != nil {
		t.Fatalf("failed to decode token detail response: %v", err)
	}
	if detail.Key != token.GetMaskedKey() {
		t.Fatalf("expected masked detail key %q, got %q", token.GetMaskedKey(), detail.Key)
	}
	if strings.Contains(recorder.Body.String(), token.Key) {
		t.Fatalf("detail response leaked raw token key: %s", recorder.Body.String())
	}
}

func TestUpdateTokenMasksKeyInResponse(t *testing.T) {
	db := setupTokenControllerTestDB(t)
	token := seedToken(t, db, 1, "editable-token", "yzab1234cdef5678")

	body := map[string]any{
		"id":                   token.Id,
		"name":                 "updated-token",
		"expired_time":         -1,
		"remain_quota":         100,
		"unlimited_quota":      true,
		"model_limits_enabled": false,
		"model_limits":         "",
		"group":                "default",
		"cross_group_retry":    false,
	}

	ctx, recorder := newAuthenticatedContext(t, http.MethodPut, "/api/token/", body, 1)
	UpdateToken(ctx)

	response := decodeAPIResponse(t, recorder)
	if !response.Success {
		t.Fatalf("expected success response, got message: %s", response.Message)
	}

	var detail tokenResponseItem
	if err := common.Unmarshal(response.Data, &detail); err != nil {
		t.Fatalf("failed to decode token update response: %v", err)
	}
	if detail.Key != token.GetMaskedKey() {
		t.Fatalf("expected masked update key %q, got %q", token.GetMaskedKey(), detail.Key)
	}
	if strings.Contains(recorder.Body.String(), token.Key) {
		t.Fatalf("update response leaked raw token key: %s", recorder.Body.String())
	}
}

func TestGetTokenKeyRequiresOwnershipAndReturnsFullKey(t *testing.T) {
	db := setupTokenControllerTestDB(t)
	token := seedToken(t, db, 1, "owned-token", "owner1234token5678")

	authorizedCtx, authorizedRecorder := newAuthenticatedContext(t, http.MethodPost, "/api/token/"+strconv.Itoa(token.Id)+"/key", nil, 1)
	authorizedCtx.Params = gin.Params{{Key: "id", Value: strconv.Itoa(token.Id)}}
	GetTokenKey(authorizedCtx)

	authorizedResponse := decodeAPIResponse(t, authorizedRecorder)
	if !authorizedResponse.Success {
		t.Fatalf("expected authorized key fetch to succeed, got message: %s", authorizedResponse.Message)
	}

	var keyData tokenKeyResponse
	if err := common.Unmarshal(authorizedResponse.Data, &keyData); err != nil {
		t.Fatalf("failed to decode token key response: %v", err)
	}
	if keyData.Key != token.GetFullKey() {
		t.Fatalf("expected full key %q, got %q", token.GetFullKey(), keyData.Key)
	}

	unauthorizedCtx, unauthorizedRecorder := newAuthenticatedContext(t, http.MethodPost, "/api/token/"+strconv.Itoa(token.Id)+"/key", nil, 2)
	unauthorizedCtx.Params = gin.Params{{Key: "id", Value: strconv.Itoa(token.Id)}}
	GetTokenKey(unauthorizedCtx)

	unauthorizedResponse := decodeAPIResponse(t, unauthorizedRecorder)
	if unauthorizedResponse.Success {
		t.Fatalf("expected unauthorized key fetch to fail")
	}
	if strings.Contains(unauthorizedRecorder.Body.String(), token.Key) {
		t.Fatalf("unauthorized key response leaked raw token key: %s", unauthorizedRecorder.Body.String())
	}
}

func TestAddTokenPersistsPeriodQuotaSettings(t *testing.T) {
	db := setupTokenControllerTestDB(t)
	ensureTokenPeriodQuotaColumns(t, db)

	body := map[string]any{
		"name":                 "period-token",
		"expired_time":         -1,
		"remain_quota":         1200,
		"unlimited_quota":      false,
		"model_limits_enabled": false,
		"model_limits":         "",
		"group":                "default",
		"cross_group_retry":    false,
		"quota_period":         "daily",
		"quota_limit":          600,
	}

	ctx, recorder := newAuthenticatedContext(t, http.MethodPost, "/api/token/", body, 1)
	AddToken(ctx)

	response := decodeAPIResponse(t, recorder)
	if !response.Success {
		t.Fatalf("expected success response, got message: %s", response.Message)
	}

	var record tokenPeriodQuotaRecord
	if err := db.Raw("SELECT quota_period, quota_limit, quota_used_in_period, quota_last_reset_time, quota_next_reset_time FROM tokens ORDER BY id DESC LIMIT 1").Scan(&record).Error; err != nil {
		t.Fatalf("failed to query stored token period quota: %v", err)
	}

	if record.QuotaPeriod != "daily" {
		t.Fatalf("expected quota_period to be persisted as daily, got %q", record.QuotaPeriod)
	}
	if record.QuotaLimit != 600 {
		t.Fatalf("expected quota_limit to be persisted as 600, got %d", record.QuotaLimit)
	}
}

func TestUpdateTokenResetsPeriodQuotaWindowWhenModeChanges(t *testing.T) {
	db := setupTokenControllerTestDB(t)
	ensureTokenPeriodQuotaColumns(t, db)
	token := seedToken(t, db, 1, "editable-period-token", "period1234token5678")

	now := time.Now()
	lastReset := now.Add(-48 * time.Hour).Unix()
	nextReset := now.Add(-24 * time.Hour).Unix()
	if err := db.Exec(
		"UPDATE tokens SET quota_period = ?, quota_limit = ?, quota_used_in_period = ?, quota_last_reset_time = ?, quota_next_reset_time = ? WHERE id = ?",
		"monthly", 900, 450, lastReset, nextReset, token.Id,
	).Error; err != nil {
		t.Fatalf("failed to seed token period quota state: %v", err)
	}

	body := map[string]any{
		"id":                   token.Id,
		"name":                 "editable-period-token",
		"expired_time":         -1,
		"remain_quota":         100,
		"unlimited_quota":      false,
		"model_limits_enabled": false,
		"model_limits":         "",
		"group":                "default",
		"cross_group_retry":    false,
		"quota_period":         "daily",
		"quota_limit":          300,
	}

	ctx, recorder := newAuthenticatedContext(t, http.MethodPut, "/api/token/", body, 1)
	UpdateToken(ctx)

	response := decodeAPIResponse(t, recorder)
	if !response.Success {
		t.Fatalf("expected success response, got message: %s", response.Message)
	}

	var record tokenPeriodQuotaRecord
	if err := db.Raw("SELECT quota_period, quota_limit, quota_used_in_period, quota_last_reset_time, quota_next_reset_time FROM tokens WHERE id = ?", token.Id).Scan(&record).Error; err != nil {
		t.Fatalf("failed to query updated token period quota: %v", err)
	}

	if record.QuotaPeriod != "daily" {
		t.Fatalf("expected quota_period to be updated to daily, got %q", record.QuotaPeriod)
	}
	if record.QuotaLimit != 300 {
		t.Fatalf("expected quota_limit to be updated to 300, got %d", record.QuotaLimit)
	}
	if record.QuotaUsedInPeriod != 0 {
		t.Fatalf("expected quota_used_in_period to reset to 0, got %d", record.QuotaUsedInPeriod)
	}
	if record.QuotaNextResetTime <= common.GetTimestamp() {
		t.Fatalf("expected quota_next_reset_time to move to a future window, got %d", record.QuotaNextResetTime)
	}
}

func TestAddTokenRejectsInvalidPeriodQuotaValues(t *testing.T) {
	db := setupTokenControllerTestDB(t)
	ensureTokenPeriodQuotaColumns(t, db)

	body := map[string]any{
		"name":                 "invalid-period-token",
		"expired_time":         -1,
		"remain_quota":         1200,
		"unlimited_quota":      false,
		"model_limits_enabled": false,
		"model_limits":         "",
		"group":                "default",
		"cross_group_retry":    false,
		"quota_period":         "weekly",
		"quota_limit":          600,
	}

	ctx, recorder := newAuthenticatedContext(t, http.MethodPost, "/api/token/", body, 1)
	AddToken(ctx)

	response := decodeAPIResponse(t, recorder)
	if response.Success {
		t.Fatalf("expected invalid quota_period to be rejected")
	}

	var count int64
	if err := db.Model(&model.Token{}).Count(&count).Error; err != nil {
		t.Fatalf("failed to count tokens: %v", err)
	}
	if count != 0 {
		t.Fatalf("expected invalid token request to avoid creating a token, found %d rows", count)
	}
}
