package controller

import (
	"fmt"
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"

	"github.com/gin-gonic/gin"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

const (
	// Unix timestamps for testing (arranged to be distinct hours)
	testTimeHour1 = 1749394800 // 2025-06-08 07:00 UTC
	testTimeHour2 = 1749398400 // 2025-06-08 08:00 UTC
	testTimeHour3 = 1749402000 // 2025-06-08 09:00 UTC
	testTimeOutOfRange = 1749481200 // 2025-06-09 07:00 UTC
)

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

func setupQuotaDataTestDB(t *testing.T) []string {
	t.Helper()

	initUsedataColumnNames(t)

	gin.SetMode(gin.TestMode)
	common.UsingSQLite = true
	common.UsingMySQL = false
	common.UsingPostgreSQL = false
	common.RedisEnabled = false

	dsn := fmt.Sprintf("file:%s?mode=memory&cache=shared", strings.ReplaceAll(t.Name(), "/", "_"))
	db, err := gorm.Open(sqlite.Open(dsn), &gorm.Config{})
	require.NoError(t, err)
	model.DB = db
	model.LOG_DB = db

	// quota_data table
	require.NoError(t, db.Exec(`CREATE TABLE quota_data (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		user_id INTEGER,
		username TEXT DEFAULT '',
		model_name TEXT DEFAULT '',
		created_at INTEGER,
		token_used INTEGER DEFAULT 0,
		count INTEGER DEFAULT 0,
		quota INTEGER DEFAULT 0
	)`).Error)

	t.Cleanup(func() {
		sqlDB, err := db.DB()
		if err == nil {
			_ = sqlDB.Close()
		}
	})

	return []string{"quota_data"}
}

func initUsedataColumnNames(t *testing.T) {
	t.Helper()

	originalIsMasterNode := common.IsMasterNode
	originalSQLitePath := common.SQLitePath
	originalUsingSQLite := common.UsingSQLite
	originalUsingMySQL := common.UsingMySQL
	originalUsingPostgreSQL := common.UsingPostgreSQL
	originalSQLDSN, hadSQLDSN := os.LookupEnv("SQL_DSN")

	t.Cleanup(func() {
		common.IsMasterNode = originalIsMasterNode
		common.SQLitePath = originalSQLitePath
		common.UsingSQLite = originalUsingSQLite
		common.UsingMySQL = originalUsingMySQL
		common.UsingPostgreSQL = originalUsingPostgreSQL
		if hadSQLDSN {
			_ = os.Setenv("SQL_DSN", originalSQLDSN)
		} else {
			_ = os.Unsetenv("SQL_DSN")
		}
	})

	common.IsMasterNode = false
	common.SQLitePath = fmt.Sprintf("file:%s_init?mode=memory&cache=shared", strings.ReplaceAll(t.Name(), "/", "_"))
	common.UsingSQLite = false
	common.UsingMySQL = false
	common.UsingPostgreSQL = false
	_ = os.Setenv("SQL_DSN", "local")

	require.NoError(t, model.InitDB())
	if model.DB != nil {
		sqlDB, err := model.DB.DB()
		if err == nil {
			_ = sqlDB.Close()
		}
	}
}

func makeQuotaDataGET(queries ...string) *http.Request {
	base := "/api/data"
	if len(queries) == 0 {
		return httptest.NewRequest(http.MethodGet, base, nil)
	}
	return httptest.NewRequest(http.MethodGet, base+"?"+strings.Join(queries, "&"), nil)
}

type quotaDataResponse struct {
	Success bool              `json:"success"`
	Message string            `json:"message"`
	Data    []model.QuotaData `json:"data"`
}

func decodeQuotaDataResponse(t *testing.T, recorder *httptest.ResponseRecorder) quotaDataResponse {
	t.Helper()
	require.Equal(t, http.StatusOK, recorder.Code)
	var payload quotaDataResponse
	require.NoError(t, common.Unmarshal(recorder.Body.Bytes(), &payload))
	return payload
}

// ---------------------------------------------------------------------------
// Test cases
// ---------------------------------------------------------------------------

// TestGetAllQuotaDatesSuccess verifies the endpoint returns aggregated quota data
// grouped by model_name + created_at for the requested time range.
func TestGetAllQuotaDatesSuccess(t *testing.T) {
	setupQuotaDataTestDB(t)

	// Insert test data: 2 models, 2 hours each
	insert := []model.QuotaData{
		{UserID: 1, Username: "alice", ModelName: "gpt-4o", CreatedAt: testTimeHour1, Count: 3, Quota: 300, TokenUsed: 15000},
		{UserID: 1, Username: "alice", ModelName: "gpt-4o", CreatedAt: testTimeHour1, Count: 2, Quota: 200, TokenUsed: 10000},
		{UserID: 1, Username: "alice", ModelName: "gpt-4o", CreatedAt: testTimeHour2, Count: 5, Quota: 500, TokenUsed: 25000},
		{UserID: 2, Username: "bob",   ModelName: "claude-4", CreatedAt: testTimeHour1, Count: 1, Quota: 100, TokenUsed: 5000},
		{UserID: 2, Username: "bob",   ModelName: "claude-4", CreatedAt: testTimeHour2, Count: 4, Quota: 400, TokenUsed: 20000},
	}
	for _, d := range insert {
		require.NoError(t, model.DB.Table("quota_data").Create(&d).Error)
	}

	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Request = makeQuotaDataGET(
		fmt.Sprintf("start_timestamp=%d", testTimeHour1),
		fmt.Sprintf("end_timestamp=%d", testTimeHour2),
	)

	GetAllQuotaDates(ctx)

	payload := decodeQuotaDataResponse(t, recorder)
	require.True(t, payload.Success)

	// Should get 4 aggregated rows: (gpt-4o, hour1), (gpt-4o, hour2), (claude-4, hour1), (claude-4, hour2)
	require.Len(t, payload.Data, 4)

	// Build a lookup keyed by model_name + created_at
	byKey := make(map[string]model.QuotaData)
	for _, item := range payload.Data {
		key := fmt.Sprintf("%s-%d", item.ModelName, item.CreatedAt)
		byKey[key] = item
	}

	// gpt-4o at hour1: count=5 (3+2), quota=500, token_used=25000
	gpt4H1 := byKey["gpt-4o-"+fmt.Sprint(testTimeHour1)]
	require.Equal(t, 5, gpt4H1.Count)
	require.Equal(t, 500, gpt4H1.Quota)
	require.Equal(t, 25000, gpt4H1.TokenUsed)

	// gpt-4o at hour2: count=5, quota=500, token_used=25000
	gpt4H2 := byKey["gpt-4o-"+fmt.Sprint(testTimeHour2)]
	require.Equal(t, 5, gpt4H2.Count)
	require.Equal(t, 500, gpt4H2.Quota)
	require.Equal(t, 25000, gpt4H2.TokenUsed)

	// claude-4 at hour1: count=1, quota=100, token_used=5000
	c4H1 := byKey["claude-4-"+fmt.Sprint(testTimeHour1)]
	require.Equal(t, 1, c4H1.Count)
	require.Equal(t, 100, c4H1.Quota)
	require.Equal(t, 5000, c4H1.TokenUsed)
}

// TestGetAllQuotaDatesEmptyResult verifies the endpoint returns an empty array
// when no data exists in the requested time range.
func TestGetAllQuotaDatesEmptyResult(t *testing.T) {
	setupQuotaDataTestDB(t)

	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Request = makeQuotaDataGET(
		fmt.Sprintf("start_timestamp=%d", testTimeHour1),
		fmt.Sprintf("end_timestamp=%d", testTimeHour2),
	)

	GetAllQuotaDates(ctx)

	payload := decodeQuotaDataResponse(t, recorder)
	require.True(t, payload.Success)
	require.Len(t, payload.Data, 0)
}

// TestGetAllQuotaDatesTimeRangeFilter verifies that data outside the requested
// time range is excluded from the results.
func TestGetAllQuotaDatesTimeRangeFilter(t *testing.T) {
	setupQuotaDataTestDB(t)

	// Insert data both inside and outside the range
	insert := []model.QuotaData{
		{UserID: 1, Username: "alice", ModelName: "gpt-4o", CreatedAt: testTimeHour1, Count: 1, Quota: 100, TokenUsed: 500},
		{UserID: 1, Username: "alice", ModelName: "gpt-4o", CreatedAt: testTimeOutOfRange, Count: 99, Quota: 9999, TokenUsed: 99999},
	}
	for _, d := range insert {
		require.NoError(t, model.DB.Table("quota_data").Create(&d).Error)
	}

	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Request = makeQuotaDataGET(
		fmt.Sprintf("start_timestamp=%d", testTimeHour1),
		fmt.Sprintf("end_timestamp=%d", testTimeHour2),
	)

	GetAllQuotaDates(ctx)

	payload := decodeQuotaDataResponse(t, recorder)
	require.True(t, payload.Success)
	// Only the row within range should appear
	require.Len(t, payload.Data, 1)
	require.Equal(t, "gpt-4o", payload.Data[0].ModelName)
	require.Equal(t, testTimeHour1, int(payload.Data[0].CreatedAt))
	require.Equal(t, 1, payload.Data[0].Count)
}

// TestGetAllQuotaDatesFilterByUsername verifies that when a username query param
// is provided, only that user's rows are returned.
func TestGetAllQuotaDatesFilterByUsername(t *testing.T) {
	setupQuotaDataTestDB(t)

	insert := []model.QuotaData{
		{UserID: 1, Username: "alice", ModelName: "gpt-4o", CreatedAt: testTimeHour1, Count: 2, Quota: 200, TokenUsed: 1000},
		{UserID: 2, Username: "bob",   ModelName: "gpt-4o", CreatedAt: testTimeHour1, Count: 3, Quota: 300, TokenUsed: 2000},
	}
	for _, d := range insert {
		require.NoError(t, model.DB.Table("quota_data").Create(&d).Error)
	}

	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Request = makeQuotaDataGET(
		fmt.Sprintf("start_timestamp=%d", testTimeHour1),
		fmt.Sprintf("end_timestamp=%d", testTimeHour2),
		"username=alice",
	)

	GetAllQuotaDates(ctx)

	payload := decodeQuotaDataResponse(t, recorder)
	require.True(t, payload.Success)
	require.Len(t, payload.Data, 1)
	require.Equal(t, "alice", payload.Data[0].Username)
	require.Equal(t, 2, payload.Data[0].Count)
}

// TestGetAllQuotaDatesMissingParams verifies the endpoint handles missing
// start_timestamp and end_timestamp gracefully (defaults to 0, which may return
// empty results or all data depending on the DB).
func TestGetAllQuotaDatesMissingParams(t *testing.T) {
	setupQuotaDataTestDB(t)

	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Request = httptest.NewRequest(http.MethodGet, "/api/data", nil)

	GetAllQuotaDates(ctx)

	// Should not panic; response should be valid JSON
	payload := decodeQuotaDataResponse(t, recorder)
	require.True(t, payload.Success)
	require.NotNil(t, payload.Data)
}

// ---------------------------------------------------------------------------
// /api/data/self — GetUserQuotaDates
// ---------------------------------------------------------------------------

// TestGetUserQuotaDatesSuccess verifies a logged-in user can fetch their own
// quota data within a 1-month window.
func TestGetUserQuotaDatesSuccess(t *testing.T) {
	setupQuotaDataTestDB(t)

	insert := []model.QuotaData{
		{UserID: 1, Username: "alice", ModelName: "gpt-4o", CreatedAt: testTimeHour1, Count: 2, Quota: 200, TokenUsed: 1000},
		{UserID: 2, Username: "bob",   ModelName: "gpt-4o", CreatedAt: testTimeHour1, Count: 3, Quota: 300, TokenUsed: 2000},
		{UserID: 1, Username: "alice", ModelName: "claude-4", CreatedAt: testTimeHour2, Count: 5, Quota: 500, TokenUsed: 3000},
	}
	for _, d := range insert {
		require.NoError(t, model.DB.Table("quota_data").Create(&d).Error)
	}

	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Request = makeQuotaDataGET(
		fmt.Sprintf("start_timestamp=%d", testTimeHour1),
		fmt.Sprintf("end_timestamp=%d", testTimeHour3),
	)
	ctx.Set("id", 1) // simulate logged-in user id=1 (alice)

	GetUserQuotaDates(ctx)

	payload := decodeQuotaDataResponse(t, recorder)
	require.True(t, payload.Success)
	// Only alice's 2 rows should be returned
	require.Len(t, payload.Data, 2)
	for _, item := range payload.Data {
		require.Equal(t, 1, item.UserID)
	}
}

// TestGetUserQuotaDatesExceedsMonth verifies that the self endpoint rejects
// a time range longer than 30 days (2592000 seconds).
func TestGetUserQuotaDatesExceedsMonth(t *testing.T) {
	setupQuotaDataTestDB(t)

	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	// 31 days span = 2678400 seconds
	ctx.Request = makeQuotaDataGET(
		fmt.Sprintf("start_timestamp=%d", testTimeHour1),
		fmt.Sprintf("end_timestamp=%d", testTimeHour1+2678400),
	)
	ctx.Set("id", 1)

	GetUserQuotaDates(ctx)

	require.Equal(t, http.StatusOK, recorder.Code)
	var payload quotaDataResponse
	require.NoError(t, common.Unmarshal(recorder.Body.Bytes(), &payload))
	require.False(t, payload.Success)
	require.Contains(t, payload.Message, "时间跨度不能超过 1 个月")
}

// TestGetUserQuotaDatesExactlyWithinMonth verifies that a range exactly
// 30 days (2592000 seconds) is accepted.
func TestGetUserQuotaDatesExactlyWithinMonth(t *testing.T) {
	setupQuotaDataTestDB(t)

	insert := []model.QuotaData{
		{UserID: 1, Username: "alice", ModelName: "gpt-4o", CreatedAt: testTimeHour1, Count: 1, Quota: 100, TokenUsed: 500},
	}
	for _, d := range insert {
		require.NoError(t, model.DB.Table("quota_data").Create(&d).Error)
	}

	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	// Exactly 30 days = 2592000 seconds
	ctx.Request = makeQuotaDataGET(
		fmt.Sprintf("start_timestamp=%d", testTimeHour1),
		fmt.Sprintf("end_timestamp=%d", testTimeHour1+2592000),
	)
	ctx.Set("id", 1)

	GetUserQuotaDates(ctx)

	payload := decodeQuotaDataResponse(t, recorder)
	require.True(t, payload.Success)
	require.Len(t, payload.Data, 1)
}

// ---------------------------------------------------------------------------
// /api/data/users — GetQuotaDatesByUser
// ---------------------------------------------------------------------------

// TestGetQuotaDatesByUserSuccess verifies the admin endpoint that groups
// quota data by username + created_at.
func TestGetQuotaDatesByUserSuccess(t *testing.T) {
	setupQuotaDataTestDB(t)

	insert := []model.QuotaData{
		{UserID: 1, Username: "alice", ModelName: "gpt-4o", CreatedAt: testTimeHour1, Count: 1, Quota: 100, TokenUsed: 500},
		{UserID: 1, Username: "alice", ModelName: "claude-4", CreatedAt: testTimeHour1, Count: 1, Quota: 200, TokenUsed: 1000},
		{UserID: 2, Username: "bob",   ModelName: "gpt-4o", CreatedAt: testTimeHour1, Count: 3, Quota: 300, TokenUsed: 1500},
		{UserID: 2, Username: "bob",   ModelName: "gpt-4o", CreatedAt: testTimeHour2, Count: 4, Quota: 400, TokenUsed: 2000},
	}
	for _, d := range insert {
		require.NoError(t, model.DB.Table("quota_data").Create(&d).Error)
	}

	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Request = makeQuotaDataGET(
		fmt.Sprintf("start_timestamp=%d", testTimeHour1),
		fmt.Sprintf("end_timestamp=%d", testTimeHour3),
	)

	GetQuotaDatesByUser(ctx)

	payload := decodeQuotaDataResponse(t, recorder)
	require.True(t, payload.Success)
	// 3 groups: alice-hour1 (summed across models), bob-hour1, bob-hour2
	require.Len(t, payload.Data, 3)

	byKey := make(map[string]model.QuotaData)
	for _, item := range payload.Data {
		key := fmt.Sprintf("%s-%d", item.Username, item.CreatedAt)
		byKey[key] = item
	}

	// alice at hour1: 1+1=2 count, 100+200=300 quota, 500+1000=1500 tokens
	aliceH1 := byKey["alice-"+fmt.Sprint(testTimeHour1)]
	require.Equal(t, 2, aliceH1.Count)
	require.Equal(t, 300, aliceH1.Quota)
	require.Equal(t, 1500, aliceH1.TokenUsed)

	// bob at hour1: 3 count, 300 quota, 1500 tokens
	bobH1 := byKey["bob-"+fmt.Sprint(testTimeHour1)]
	require.Equal(t, 3, bobH1.Count)

	// bob at hour2: 4 count, 400 quota, 2000 tokens
	bobH2 := byKey["bob-"+fmt.Sprint(testTimeHour2)]
	require.Equal(t, 4, bobH2.Count)
}

// TestGetQuotaDatesByUserEmpty verifies the user-grouping endpoint returns
// an empty array when no data exists.
func TestGetQuotaDatesByUserEmpty(t *testing.T) {
	setupQuotaDataTestDB(t)

	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Request = makeQuotaDataGET(
		fmt.Sprintf("start_timestamp=%d", testTimeHour1),
		fmt.Sprintf("end_timestamp=%d", testTimeHour2),
	)

	GetQuotaDatesByUser(ctx)

	payload := decodeQuotaDataResponse(t, recorder)
	require.True(t, payload.Success)
	require.Len(t, payload.Data, 0)
}
