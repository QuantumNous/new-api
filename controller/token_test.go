package controller

import (
	"bytes"
	"database/sql"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"os"
	"strconv"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/gin-gonic/gin"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/require"
	"gorm.io/driver/mysql"
	"gorm.io/driver/postgres"
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

type sqliteColumnInfo struct {
	Name string `gorm:"column:name"`
	Type string `gorm:"column:type"`
}

type legacyToken struct {
	Id                 int    `gorm:"primaryKey"`
	UserId             int    `gorm:"index"`
	Key                string `gorm:"column:key;type:char(48);uniqueIndex"`
	Status             int    `gorm:"default:1"`
	Name               string `gorm:"index"`
	CreatedTime        int64  `gorm:"bigint"`
	AccessedTime       int64  `gorm:"bigint"`
	ExpiredTime        int64  `gorm:"bigint;default:-1"`
	RemainQuota        int    `gorm:"default:0"`
	UnlimitedQuota     bool
	ModelLimitsEnabled bool
	ModelLimits        string  `gorm:"type:text"`
	AllowIps           *string `gorm:"default:''"`
	UsedQuota          int     `gorm:"default:0"`
	Group              string  `gorm:"column:group;default:''"`
	CrossGroupRetry    bool
	DeletedAt          gorm.DeletedAt `gorm:"index"`
}

// TableName 返回 legacyToken 映射的表名，与 model.Token 共用 "tokens" 表。
func (legacyToken) TableName() string {
	return "tokens"
}

// openTokenControllerTestDB 打开一个进程内共享内存的 SQLite 数据库，
// 配置为测试模式并替换全局 model.DB / model.LOG_DB。
func openTokenControllerTestDB(t *testing.T) *gorm.DB {
	t.Helper()

	gin.SetMode(gin.TestMode)
	common.SetDatabaseTypes(common.DatabaseTypeSQLite, common.DatabaseTypeSQLite)
	common.RedisEnabled = false

	dsn := fmt.Sprintf("file:%s?mode=memory&cache=shared", strings.ReplaceAll(t.Name(), "/", "_"))
	db, err := gorm.Open(sqlite.Open(dsn), &gorm.Config{})
	require.NoError(t, err, "failed to open sqlite db")
	model.DB = db
	model.LOG_DB = db

	t.Cleanup(func() {
		sqlDB, err := db.DB()
		if err == nil {
			_ = sqlDB.Close()
		}
	})

	return db
}

// migrateTokenControllerTestDB 对传入的数据库运行 AutoMigrate，仅迁移 Token 表。
func migrateTokenControllerTestDB(t *testing.T, db *gorm.DB) {
	t.Helper()

	require.NoError(t, db.AutoMigrate(&model.Token{}), "failed to migrate token table")
}

// setupTokenControllerTestDB 打开 SQLite 数据库并执行 Token 表迁移，等同于
// openTokenControllerTestDB + migrateTokenControllerTestDB 的组合调用。
func setupTokenControllerTestDB(t *testing.T) *gorm.DB {
	t.Helper()

	db := openTokenControllerTestDB(t)
	migrateTokenControllerTestDB(t, db)
	return db
}

// openTokenControllerExternalDB 连接到外部 MySQL/PostgreSQL 数据库用于迁移兼容性测试。
// 若 tokens 表已存在则跳过测试；cleanup 在任何状态修改前注册，保证全局状态始终恢复。
func openTokenControllerExternalDB(t *testing.T, dialect string, dsn string) (*gorm.DB, *bool) {
	t.Helper()

	gin.SetMode(gin.TestMode)
	previousDB, previousLogDB := model.DB, model.LOG_DB
	previousRedisEnabled := common.RedisEnabled
	previousMainDatabaseType, previousLogDatabaseType := common.MainDatabaseType(), common.LogDatabaseType()

	var (
		db     *gorm.DB
		dbType common.DatabaseType
		err    error
	)

	managedTokensTable := new(bool)

	// 在修改任何全局状态或执行可能导致 t.Skipf 的表存在性检查之前注册清理，
	// 确保即使测试被跳过或数据库打开失败，外部连接与全局状态也能被恢复。
	t.Cleanup(func() {
		model.DB, model.LOG_DB = previousDB, previousLogDB
		common.RedisEnabled = previousRedisEnabled
		common.SetDatabaseTypes(previousMainDatabaseType, previousLogDatabaseType)
		if db != nil {
			if *managedTokensTable && db.Migrator().HasTable("tokens") {
				_ = db.Migrator().DropTable("tokens")
			}
			sqlDB, closeErr := db.DB()
			if closeErr == nil {
				_ = sqlDB.Close()
			}
		}
	})

	common.RedisEnabled = false

	switch dialect {
	case "mysql":
		dbType = common.DatabaseTypeMySQL
		db, err = gorm.Open(mysql.Open(dsn), &gorm.Config{})
	case "postgres":
		dbType = common.DatabaseTypePostgreSQL
		db, err = gorm.Open(postgres.Open(dsn), &gorm.Config{})
	default:
		require.FailNow(t, "unsupported dialect %s", dialect)
	}
	common.SetDatabaseTypes(dbType, dbType)
	require.NoError(t, err, "failed to open %s db", dialect)

	model.DB = db
	model.LOG_DB = db

	if db.Migrator().HasTable("tokens") {
		t.Skipf("refusing to run %s migration compatibility test against external database because tokens table already exists", dialect)
	}

	return db, managedTokensTable
}

// seedToken 在数据库中创建一个状态为启用、永不过期、配额无限的 Token 并返回。
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
	require.NoError(t, db.Create(token).Error, "failed to create token")
	return token
}

// newAuthenticatedContext 构造一个携带 userID 的测试 Gin 上下文与 ResponseRecorder。
func newAuthenticatedContext(t *testing.T, method string, target string, body any, userID int) (*gin.Context, *httptest.ResponseRecorder) {
	t.Helper()

	var requestBody *bytes.Reader
	if body != nil {
		payload, err := common.Marshal(body)
		require.NoError(t, err, "failed to marshal request body")
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

// decodeAPIResponse 从 ResponseRecorder.Body 解析出 tokenAPIResponse 结构。
func decodeAPIResponse(t *testing.T, recorder *httptest.ResponseRecorder) tokenAPIResponse {
	t.Helper()

	var response tokenAPIResponse
	require.NoError(t, common.Unmarshal(recorder.Body.Bytes(), &response), "failed to decode api response")
	return response
}

// getSQLiteColumnType 通过 PRAGMA table_info 查询 SQLite 表中指定列的类型定义（小写）。
func getSQLiteColumnType(t *testing.T, db *gorm.DB, tableName string, columnName string) string {
	t.Helper()

	var columns []sqliteColumnInfo
	require.NoError(t, db.Raw("PRAGMA table_info("+tableName+")").Scan(&columns).Error, "failed to inspect %s schema", tableName)

	for _, column := range columns {
		if column.Name == columnName {
			return strings.ToLower(column.Type)
		}
	}

	require.FailNow(t, "column %s not found in %s schema", columnName, tableName)
	return ""
}

// getTokenKeyColumnType 返回 tokens 表 key 列在指定数据库方言下的类型定义（小写）。
func getTokenKeyColumnType(t *testing.T, db *gorm.DB, dialect string) string {
	t.Helper()

	switch dialect {
	case "sqlite":
		return getSQLiteColumnType(t, db, "tokens", "key")
	case "mysql":
		var columnType string
		require.NoError(t, db.Raw(`SELECT COLUMN_TYPE FROM information_schema.columns
			WHERE table_schema = DATABASE() AND table_name = ? AND column_name = ?`,
			"tokens", "key").Scan(&columnType).Error, "failed to inspect mysql token key column")
		return strings.ToLower(columnType)
	case "postgres":
		var dataType string
		var maxLength sql.NullInt64
		require.NoError(t, db.Raw(`SELECT data_type, character_maximum_length
			FROM information_schema.columns
			WHERE table_schema = current_schema() AND table_name = ? AND column_name = ?`,
			"tokens", "key").Row().Scan(&dataType, &maxLength), "failed to inspect postgres token key column")
		switch strings.ToLower(dataType) {
		case "character varying":
			return fmt.Sprintf("varchar(%d)", maxLength.Int64)
		case "character":
			return fmt.Sprintf("char(%d)", maxLength.Int64)
		default:
			if maxLength.Valid {
				return fmt.Sprintf("%s(%d)", strings.ToLower(dataType), maxLength.Int64)
			}
			return strings.ToLower(dataType)
		}
	default:
		require.FailNow(t, "unsupported dialect %s", dialect)
		return ""
	}
}

// getTokenAutoGroupsColumnType 返回 tokens 表 auto_groups 列在指定数据库方言下的类型定义（小写）。
func getTokenAutoGroupsColumnType(t *testing.T, db *gorm.DB, dialect string) string {
	t.Helper()

	switch dialect {
	case "sqlite":
		return getSQLiteColumnType(t, db, "tokens", "auto_groups")
	case "mysql":
		var columnType string
		require.NoError(t, db.Raw(`SELECT DATA_TYPE FROM information_schema.columns
			WHERE table_schema = DATABASE() AND table_name = ? AND column_name = ?`,
			"tokens", "auto_groups").Scan(&columnType).Error, "failed to inspect mysql token auto_groups column")
		return strings.ToLower(columnType)
	case "postgres":
		var dataType string
		require.NoError(t, db.Raw(`SELECT data_type FROM information_schema.columns
			WHERE table_schema = current_schema() AND table_name = ? AND column_name = ?`,
			"tokens", "auto_groups").Scan(&dataType).Error, "failed to inspect postgres token auto_groups column")
		return strings.ToLower(dataType)
	default:
		require.FailNow(t, "unsupported dialect %s", dialect)
		return ""
	}
}

// runTokenMigrationCompatibilityTest 验证从旧版 char(48) key 列迁移到 varchar(128) 的兼容性：
// 创建旧版表结构、插入数据、执行迁移，然后断言列类型变更、数据保留及新列新增。
func runTokenMigrationCompatibilityTest(t *testing.T, db *gorm.DB, dialect string, managedTokensTable *bool) {
	t.Helper()

	legacyKey := strings.Repeat("a", 48)
	longKey := strings.Repeat("b", 64)

	require.NoError(t, db.AutoMigrate(&legacyToken{}), "failed to create legacy token schema")
	if managedTokensTable != nil {
		*managedTokensTable = true
	}
	require.NoError(t, db.Create(&legacyToken{
		UserId:             7,
		Key:                legacyKey,
		Status:             common.TokenStatusEnabled,
		Name:               "legacy-token",
		CreatedTime:        1,
		AccessedTime:       1,
		ExpiredTime:        -1,
		RemainQuota:        100,
		UnlimitedQuota:     true,
		ModelLimitsEnabled: false,
		ModelLimits:        "",
		AllowIps:           common.GetPointer(""),
		UsedQuota:          0,
		Group:              "default",
		CrossGroupRetry:    false,
	}).Error, "failed to seed legacy token row")

	require.Equal(t, "char(48)", getTokenKeyColumnType(t, db, dialect), "expected legacy key column type")

	migrateTokenControllerTestDB(t, db)

	require.Equal(t, "varchar(128)", getTokenKeyColumnType(t, db, dialect), "expected migrated key column type")
	require.True(t, db.Migrator().HasColumn(&model.Token{}, "auto_groups"), "expected migration to add auto_groups column")
	require.Equal(t, "text", getTokenAutoGroupsColumnType(t, db, dialect), "expected migrated auto_groups column type")

	var migratedToken model.Token
	require.NoError(t, db.First(&migratedToken, "name = ?", "legacy-token").Error, "failed to load migrated token row")
	require.Equal(t, legacyKey, migratedToken.Key, "expected migrated token key")
	require.Equal(t, "legacy-token", migratedToken.Name, "expected migrated token name to be preserved")
	require.Empty(t, migratedToken.AutoGroups, "expected legacy token to inherit global Auto groups")

	inserted := model.Token{
		UserId:             8,
		Name:               "long-token",
		Key:                longKey,
		Status:             common.TokenStatusEnabled,
		CreatedTime:        1,
		AccessedTime:       1,
		ExpiredTime:        -1,
		RemainQuota:        200,
		UnlimitedQuota:     true,
		ModelLimitsEnabled: false,
		ModelLimits:        "",
		AllowIps:           common.GetPointer(""),
		UsedQuota:          0,
		Group:              "default",
		CrossGroupRetry:    false,
	}
	require.NoError(t, db.Create(&inserted).Error, "failed to insert long token after migration")

	var fetched model.Token
	require.NoError(t, db.First(&fetched, "id = ?", inserted.Id).Error, "failed to fetch long token after migration")
	require.Equal(t, longKey, fetched.Key, "expected long token key")
}

// TestTokenAutoMigrateUsesVarchar128KeyColumn 验证全新 AutoMigrate 后 key 列为 varchar(128)、auto_groups 列为 text。
func TestTokenAutoMigrateUsesVarchar128KeyColumn(t *testing.T) {
	db := setupTokenControllerTestDB(t)

	require.Equal(t, "varchar(128)", getTokenKeyColumnType(t, db, "sqlite"), "expected key column type")
	require.Equal(t, "text", getSQLiteColumnType(t, db, "tokens", "auto_groups"), "expected auto_groups column type")
}

// TestTokenMigrationFromChar48ToVarchar128 验证 SQLite 下从旧版 char(48) key 列迁移到 varchar(128) 的兼容性。
func TestTokenMigrationFromChar48ToVarchar128(t *testing.T) {
	db := openTokenControllerTestDB(t)
	runTokenMigrationCompatibilityTest(t, db, "sqlite", nil)
}

// TestTokenMigrationFromChar48ToVarchar128MySQL 验证 MySQL 下从旧版 char(48) key 列迁移到 varchar(128) 的兼容性，需 TEST_MYSQL_DSN。
func TestTokenMigrationFromChar48ToVarchar128MySQL(t *testing.T) {
	dsn := os.Getenv("TEST_MYSQL_DSN")
	if dsn == "" {
		t.Skip("set TEST_MYSQL_DSN to run mysql migration compatibility test")
	}

	db, managedTokensTable := openTokenControllerExternalDB(t, "mysql", dsn)
	runTokenMigrationCompatibilityTest(t, db, "mysql", managedTokensTable)
}

// TestTokenMigrationFromChar48ToVarchar128Postgres 验证 PostgreSQL 下从旧版 char(48) key 列迁移到 varchar(128) 的兼容性，需 TEST_POSTGRES_DSN。
func TestTokenMigrationFromChar48ToVarchar128Postgres(t *testing.T) {
	dsn := os.Getenv("TEST_POSTGRES_DSN")
	if dsn == "" {
		t.Skip("set TEST_POSTGRES_DSN to run postgres migration compatibility test")
	}

	db, managedTokensTable := openTokenControllerExternalDB(t, "postgres", dsn)
	runTokenMigrationCompatibilityTest(t, db, "postgres", managedTokensTable)
}

// TestGetAllTokensMasksKeyInResponse 验证令牌列表响应中的 Key 已被掩码，不泄露明文。
func TestGetAllTokensMasksKeyInResponse(t *testing.T) {
	db := setupTokenControllerTestDB(t)
	token := seedToken(t, db, 1, "list-token", "abcd1234efgh5678")
	seedToken(t, db, 2, "other-user-token", "zzzz1234yyyy5678")

	ctx, recorder := newAuthenticatedContext(t, http.MethodGet, "/api/token/?p=1&size=10", nil, 1)
	GetAllTokens(ctx)

	response := decodeAPIResponse(t, recorder)
	require.True(t, response.Success, "expected success response, got message: %s", response.Message)

	var page tokenPageResponse
	require.NoError(t, common.Unmarshal(response.Data, &page), "failed to decode token page response")
	require.Len(t, page.Items, 1, "expected exactly one token")
	require.Equal(t, token.GetMaskedKey(), page.Items[0].Key, "expected masked key")
	require.NotContains(t, recorder.Body.String(), token.Key, "list response leaked raw token key")
}

// TestSearchTokensMasksKeyInResponse 验证令牌搜索响应中的 Key 已被掩码，不泄露明文。
func TestSearchTokensMasksKeyInResponse(t *testing.T) {
	db := setupTokenControllerTestDB(t)
	token := seedToken(t, db, 1, "searchable-token", "ijkl1234mnop5678")

	ctx, recorder := newAuthenticatedContext(t, http.MethodGet, "/api/token/search?keyword=searchable-token&p=1&size=10", nil, 1)
	SearchTokens(ctx)

	response := decodeAPIResponse(t, recorder)
	require.True(t, response.Success, "expected success response, got message: %s", response.Message)

	var page tokenPageResponse
	require.NoError(t, common.Unmarshal(response.Data, &page), "failed to decode search response")
	require.Len(t, page.Items, 1, "expected exactly one search result")
	require.Equal(t, token.GetMaskedKey(), page.Items[0].Key, "expected masked search key")
	require.NotContains(t, recorder.Body.String(), token.Key, "search response leaked raw token key")
}

// TestGetTokenMasksKeyInResponse 验证令牌详情响应中的 Key 已被掩码，不泄露明文。
func TestGetTokenMasksKeyInResponse(t *testing.T) {
	db := setupTokenControllerTestDB(t)
	token := seedToken(t, db, 1, "detail-token", "qrst1234uvwx5678")

	ctx, recorder := newAuthenticatedContext(t, http.MethodGet, "/api/token/"+strconv.Itoa(token.Id), nil, 1)
	ctx.Params = gin.Params{{Key: "id", Value: strconv.Itoa(token.Id)}}
	GetToken(ctx)

	response := decodeAPIResponse(t, recorder)
	require.True(t, response.Success, "expected success response, got message: %s", response.Message)

	var detail tokenResponseItem
	require.NoError(t, common.Unmarshal(response.Data, &detail), "failed to decode token detail response")
	require.Equal(t, token.GetMaskedKey(), detail.Key, "expected masked detail key")
	require.NotContains(t, recorder.Body.String(), token.Key, "detail response leaked raw token key")
}

// TestUpdateTokenMasksKeyInResponse 验证令牌更新响应中的 Key 已被掩码，不泄露明文。
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
	require.True(t, response.Success, "expected success response, got message: %s", response.Message)

	var detail tokenResponseItem
	require.NoError(t, common.Unmarshal(response.Data, &detail), "failed to decode token update response")
	require.Equal(t, token.GetMaskedKey(), detail.Key, "expected masked update key")
	require.NotContains(t, recorder.Body.String(), token.Key, "update response leaked raw token key")
}

// TestGetTokenKeyRequiresOwnershipAndReturnsFullKey 验证获取令牌明文 Key 的接口要求所有权，
// 且所有者可获取完整 Key，非所有者无法获取。
func TestGetTokenKeyRequiresOwnershipAndReturnsFullKey(t *testing.T) {
	db := setupTokenControllerTestDB(t)
	token := seedToken(t, db, 1, "owned-token", "owner1234token5678")

	authorizedCtx, authorizedRecorder := newAuthenticatedContext(t, http.MethodPost, "/api/token/"+strconv.Itoa(token.Id)+"/key", nil, 1)
	authorizedCtx.Params = gin.Params{{Key: "id", Value: strconv.Itoa(token.Id)}}
	GetTokenKey(authorizedCtx)

	authorizedResponse := decodeAPIResponse(t, authorizedRecorder)
	require.True(t, authorizedResponse.Success, "expected authorized key fetch to succeed, got message: %s", authorizedResponse.Message)

	var keyData tokenKeyResponse
	require.NoError(t, common.Unmarshal(authorizedResponse.Data, &keyData), "failed to decode token key response")
	require.Equal(t, token.GetFullKey(), keyData.Key, "expected full key")

	unauthorizedCtx, unauthorizedRecorder := newAuthenticatedContext(t, http.MethodPost, "/api/token/"+strconv.Itoa(token.Id)+"/key", nil, 2)
	unauthorizedCtx.Params = gin.Params{{Key: "id", Value: strconv.Itoa(token.Id)}}
	GetTokenKey(unauthorizedCtx)

	unauthorizedResponse := decodeAPIResponse(t, unauthorizedRecorder)
	require.False(t, unauthorizedResponse.Success, "expected unauthorized key fetch to fail")
	require.NotContains(t, unauthorizedRecorder.Body.String(), token.Key, "unauthorized key response leaked raw token key")
}

// ==================== 管理员令牌管理测试 ====================

// setupAdminTokenTestDB 初始化测试数据库，迁移 Token、User 和 Log 表。
func setupAdminTokenTestDB(t *testing.T) *gorm.DB {
	t.Helper()

	previousDB, previousLogDB := model.DB, model.LOG_DB
	previousRedisEnabled := common.RedisEnabled
	previousMainDatabaseType, previousLogDatabaseType := common.MainDatabaseType(), common.LogDatabaseType()

	gin.SetMode(gin.TestMode)
	common.SetDatabaseTypes(common.DatabaseTypeSQLite, common.DatabaseTypeSQLite)
	common.RedisEnabled = false

	dsn := fmt.Sprintf("file:%s?mode=memory&cache=shared", strings.ReplaceAll(t.Name(), "/", "_"))
	db, err := gorm.Open(sqlite.Open(dsn), &gorm.Config{})
	require.NoError(t, err, "failed to open sqlite db")
	model.DB = db
	model.LOG_DB = db

	require.NoError(t, db.AutoMigrate(&model.Token{}, &model.User{}, &model.Log{}), "failed to migrate tables")

	t.Cleanup(func() {
		model.DB, model.LOG_DB = previousDB, previousLogDB
		common.RedisEnabled = previousRedisEnabled
		common.SetDatabaseTypes(previousMainDatabaseType, previousLogDatabaseType)
		sqlDB, err := db.DB()
		if err == nil {
			_ = sqlDB.Close()
		}
	})

	return db
}

// newAdminContext 构造一个带有 Root 角色和用户身份的测试上下文。
func newAdminContext(t *testing.T, method string, target string, body any, userID int, role int) (*gin.Context, *httptest.ResponseRecorder) {
	t.Helper()

	var requestBody *bytes.Reader
	if body != nil {
		payload, err := common.Marshal(body)
		require.NoError(t, err, "failed to marshal request body")
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
	ctx.Set("role", role)
	ctx.Set("username", "test-user-"+strconv.Itoa(userID))
	return ctx, recorder
}

// seedTestUser 通过 GORM 创建一个测试用户。
func seedTestUser(t *testing.T, db *gorm.DB, userID int, role int, username string) *model.User {
	t.Helper()

	user := &model.User{
		Id:       userID,
		Username: username,
		Password: "test-password-123",
		Role:     role,
		Status:   common.UserStatusEnabled,
		Group:    "default",
		Email:    username + "@test.local",
		AffCode:  fmt.Sprintf("aff-%d-%s", userID, username),
	}
	require.NoError(t, db.Create(user).Error, "failed to create test user")
	return user
}

// auditOp 表示审计日志 Other.op 字段中的结构化操作描述。
type auditOp struct {
	Action string                 `json:"action"`
	Params map[string]interface{} `json:"params"`
}

// requireLatestManageAuditLog 查询指定操作者最近一条管理审计日志，并断言其 action
// 与期望参数一致。JSON 数字会被归一化为 float64 进行比较。
func requireLatestManageAuditLog(t *testing.T, actorID int, action string, expectedParams map[string]interface{}) *model.Log {
	t.Helper()

	var log model.Log
	err := model.DB.Where("user_id = ? AND type = ?", actorID, model.LogTypeManage).
		Order("created_at desc, id desc").First(&log).Error
	require.NoError(t, err, "failed to fetch manage audit log for actor %d", actorID)

	otherMap, err := common.StrToMap(log.Other)
	require.NoError(t, err, "failed to parse audit log other field")

	opJSON, err := common.Marshal(otherMap["op"])
	require.NoError(t, err, "failed to marshal audit op field")

	var op auditOp
	require.NoError(t, common.Unmarshal(opJSON, &op), "failed to decode audit op field")
	require.Equal(t, action, op.Action, "unexpected audit action")

	for key, expected := range expectedParams {
		actual, ok := op.Params[key]
		require.True(t, ok, "missing audit param %s", key)
		require.Equal(t, normalizeAuditValue(expected), normalizeAuditValue(actual), "unexpected audit param %s", key)
	}

	return &log
}

// normalizeAuditValue 将整型期望归一化为 float64，因为 JSON 数字反序列化后为此类型。
func normalizeAuditValue(v interface{}) interface{} {
	switch val := v.(type) {
	case int:
		return float64(val)
	case int32:
		return float64(val)
	case int64:
		return float64(val)
	case json.Number:
		f, _ := val.Float64()
		return f
	}
	return v
}

// TestAdminGetAllTokensReturnsAllUserTokens 验证 Root 用户可获取所有用户的令牌列表。
func TestAdminGetAllTokensReturnsAllUserTokens(t *testing.T) {
	db := setupAdminTokenTestDB(t)
	seedTestUser(t, db, 1, common.RoleRootUser, "root")
	seedTestUser(t, db, 2, common.RoleCommonUser, "common-user")
	seedToken(t, db, 1, "root-token", "r001xxxxxxxxxxxx")
	seedToken(t, db, 2, "user-token", "u001xxxxxxxxxxxx")

	ctx, recorder := newAdminContext(t, http.MethodGet, "/api/token/?p=1&size=10", nil, 1, common.RoleRootUser)
	GetAllTokens(ctx)

	response := decodeAPIResponse(t, recorder)
	require.True(t, response.Success, "expected success response, got message: %s", response.Message)

	var page tokenPageResponse
	require.NoError(t, common.Unmarshal(response.Data, &page), "failed to decode page response")
	require.Len(t, page.Items, 2, "expected 2 tokens")
}

// TestAdminGetAllTokensFiltersByUserId 验证 Root 用户可通过 user_id 查询参数筛选指定用户的令牌。
func TestAdminGetAllTokensFiltersByUserId(t *testing.T) {
	db := setupAdminTokenTestDB(t)
	seedTestUser(t, db, 1, common.RoleRootUser, "root")
	seedTestUser(t, db, 2, common.RoleCommonUser, "common-user")
	seedToken(t, db, 1, "root-token", "r002xxxxxxxxxxxx")
	seedToken(t, db, 2, "user-token", "u002xxxxxxxxxxxx")

	ctx, recorder := newAdminContext(t, http.MethodGet, "/api/token/?p=1&size=10&user_id=2", nil, 1, common.RoleRootUser)
	GetAllTokens(ctx)

	response := decodeAPIResponse(t, recorder)
	require.True(t, response.Success, "expected success response, got message: %s", response.Message)

	var page tokenPageResponse
	require.NoError(t, common.Unmarshal(response.Data, &page), "failed to decode page response")
	require.Len(t, page.Items, 1, "expected 1 token")
	require.Equal(t, 2, page.Items[0].ID, "expected token ID 2")
}

// TestAdminGetAllTokensMasksKeyInResponse 验证管理员列表响应中的令牌 Key 已被掩码，不泄露明文。
func TestAdminGetAllTokensMasksKeyInResponse(t *testing.T) {
	db := setupAdminTokenTestDB(t)
	seedTestUser(t, db, 1, common.RoleRootUser, "root")
	seedTestUser(t, db, 2, common.RoleCommonUser, "common-user")
	token := seedToken(t, db, 2, "user-token", "abcd1234efgh5678")

	ctx, recorder := newAdminContext(t, http.MethodGet, "/api/token/?p=1&size=10", nil, 1, common.RoleRootUser)
	GetAllTokens(ctx)

	response := decodeAPIResponse(t, recorder)
	require.True(t, response.Success, "expected success response, got message: %s", response.Message)

	var page tokenPageResponse
	require.NoError(t, common.Unmarshal(response.Data, &page), "failed to decode page response")
	require.Len(t, page.Items, 1, "expected 1 token in admin list response")
	require.Equal(t, token.GetMaskedKey(), page.Items[0].Key, "expected masked key in admin list response")
}

// TestAdminGetTokenChecksPermission 验证 Root 用户可查看其他用户的令牌详情。
func TestAdminGetTokenChecksPermission(t *testing.T) {
	db := setupAdminTokenTestDB(t)

	seedTestUser(t, db, 1, common.RoleRootUser, "root")
	seedTestUser(t, db, 2, common.RoleCommonUser, "common-user")
	token := seedToken(t, db, 2, "user-token", "ut01xxxxxxxxxxxx")

	// Root 可以查看普通用户的令牌
	ctx, recorder := newAdminContext(t, http.MethodGet, "/api/token/"+strconv.Itoa(token.Id), nil, 1, common.RoleRootUser)
	ctx.Params = gin.Params{{Key: "id", Value: strconv.Itoa(token.Id)}}
	GetToken(ctx)

	response := decodeAPIResponse(t, recorder)
	require.True(t, response.Success, "expected root to view user token, got message: %s", response.Message)
}

// TestAdminGetTokenRejectsOtherUserToken 验证非 Root 管理员不能查看其他用户的令牌。
func TestAdminGetTokenRejectsOtherUserToken(t *testing.T) {
	db := setupAdminTokenTestDB(t)

	seedTestUser(t, db, 1, common.RoleAdminUser, "admin")
	seedTestUser(t, db, 2, common.RoleRootUser, "root2")
	token := seedToken(t, db, 2, "root2-token", "rt01xxxxxxxxxxxx")

	// Admin 不能查看 Root 的令牌
	ctx, recorder := newAdminContext(t, http.MethodGet, "/api/token/"+strconv.Itoa(token.Id), nil, 1, common.RoleAdminUser)
	ctx.Params = gin.Params{{Key: "id", Value: strconv.Itoa(token.Id)}}
	GetToken(ctx)

	response := decodeAPIResponse(t, recorder)
	require.False(t, response.Success, "expected admin to be rejected from viewing root token")
}

// TestAdminAddTokenCreatesTokenForTargetUser 验证 Root 用户可为其他用户创建令牌，且令牌归属于目标用户。
func TestAdminAddTokenCreatesTokenForTargetUser(t *testing.T) {
	db := setupAdminTokenTestDB(t)

	seedTestUser(t, db, 1, common.RoleRootUser, "root")
	seedTestUser(t, db, 2, common.RoleCommonUser, "common-user")

	body := map[string]any{
		"user_id":         2,
		"name":            "admin-created-token",
		"expired_time":    -1,
		"remain_quota":    500,
		"unlimited_quota": false,
		"group":           "default",
	}

	ctx, recorder := newAdminContext(t, http.MethodPost, "/api/token/", body, 1, common.RoleRootUser)
	AddToken(ctx)

	response := decodeAPIResponse(t, recorder)
	require.True(t, response.Success, "expected success response, got message: %s", response.Message)

	// 验证令牌属于目标用户
	tokens, err := model.GetAllUserTokens(2, 0, 10)
	require.NoError(t, err, "failed to fetch tokens for user 2")
	require.Len(t, tokens, 1, "expected 1 token for user 2")
	require.Equal(t, "admin-created-token", tokens[0].Name, "expected token name")
}

// TestAdminAddTokenDefaultsToSelfWhenUserIdOmitted 验证 Root 用户省略 user_id 时默认给自己创建令牌。
func TestAdminAddTokenDefaultsToSelfWhenUserIdOmitted(t *testing.T) {
	db := setupAdminTokenTestDB(t)

	seedTestUser(t, db, 1, common.RoleRootUser, "root")

	// 不传 user_id，令牌应归属 Root 自己
	body := map[string]any{
		"name":            "self-token",
		"expired_time":    -1,
		"remain_quota":    100,
		"unlimited_quota": false,
		"group":           "default",
	}

	ctx, recorder := newAdminContext(t, http.MethodPost, "/api/token/", body, 1, common.RoleRootUser)
	AddToken(ctx)

	response := decodeAPIResponse(t, recorder)
	require.True(t, response.Success, "expected success when creating token for self, got message: %s", response.Message)

	// 验证令牌归属于 Root 自己
	tokens, err := model.GetAllUserTokens(1, 0, 10)
	require.NoError(t, err, "failed to fetch tokens for root user 1")
	require.Len(t, tokens, 1, "expected 1 token for root user 1")
	require.Equal(t, "self-token", tokens[0].Name, "expected token name")
}

// TestAdminAddTokenRejectsNonExistentUser 验证为不存在的用户创建令牌会返回失败。
func TestAdminAddTokenRejectsNonExistentUser(t *testing.T) {
	db := setupAdminTokenTestDB(t)

	seedTestUser(t, db, 1, common.RoleRootUser, "root")

	body := map[string]any{
		"user_id":         999,
		"name":            "ghost-token",
		"expired_time":    -1,
		"remain_quota":    100,
		"unlimited_quota": false,
		"group":           "default",
	}

	ctx, recorder := newAdminContext(t, http.MethodPost, "/api/token/", body, 1, common.RoleRootUser)
	AddToken(ctx)

	response := decodeAPIResponse(t, recorder)
	require.False(t, response.Success, "expected failure for non-existent user")
}

// TestAdminAddTokenAllowsSameRoleTarget 验证 Root 用户可为同级 Root 用户创建令牌。
func TestAdminAddTokenAllowsSameRoleTarget(t *testing.T) {
	db := setupAdminTokenTestDB(t)

	seedTestUser(t, db, 1, common.RoleRootUser, "root")
	seedTestUser(t, db, 2, common.RoleRootUser, "root2")

	// Root 可以为另一个 Root 创建令牌
	body := map[string]any{
		"user_id":         2,
		"name":            "bad-token",
		"expired_time":    -1,
		"remain_quota":    100,
		"unlimited_quota": false,
		"group":           "default",
	}

	ctx, recorder := newAdminContext(t, http.MethodPost, "/api/token/", body, 1, common.RoleRootUser)
	AddToken(ctx)

	// Root 现在可以给任何用户创建令牌，包括同级 Root
	response := decodeAPIResponse(t, recorder)
	require.True(t, response.Success, "expected success when creating token for same-role user, got message: %s", response.Message)

	// 验证令牌已持久化且归属于用户 2
	tokens, err := model.GetAllUserTokens(2, 0, 10)
	require.NoError(t, err, "failed to fetch tokens for user 2")
	require.Len(t, tokens, 1, "expected 1 token for user 2")
	require.Equal(t, "bad-token", tokens[0].Name, "expected token name")
	require.Equal(t, 2, tokens[0].UserId, "expected token owned by user 2")

	// 验证跨用户创建令牌写入了管理审计日志
	requireLatestManageAuditLog(t, 1, "token.admin_create", map[string]interface{}{
		"target_user_id":  2,
		"target_username": "root2",
		"token_id":        tokens[0].Id,
		"token_name":      "bad-token",
	})
}

// TestAdminUpdateTokenUpdatesOtherUserToken 验证 Root 用户可更新其他用户的令牌信息。
func TestAdminUpdateTokenUpdatesOtherUserToken(t *testing.T) {
	db := setupAdminTokenTestDB(t)

	seedTestUser(t, db, 1, common.RoleRootUser, "root")
	seedTestUser(t, db, 2, common.RoleCommonUser, "common-user")
	token := seedToken(t, db, 2, "user-token", "ut02xxxxxxxxxxxx")

	body := map[string]any{
		"id":                   token.Id,
		"name":                 "admin-updated-token",
		"expired_time":         -1,
		"remain_quota":         999,
		"unlimited_quota":      false,
		"model_limits_enabled": false,
		"model_limits":         "",
		"group":                "default",
		"cross_group_retry":    false,
	}

	ctx, recorder := newAdminContext(t, http.MethodPut, "/api/token/", body, 1, common.RoleRootUser)
	UpdateToken(ctx)

	response := decodeAPIResponse(t, recorder)
	require.True(t, response.Success, "expected success response, got message: %s", response.Message)

	// 验证更新已生效
	updated, err := model.GetTokenById(token.Id)
	require.NoError(t, err, "failed to fetch updated token")
	require.Equal(t, "admin-updated-token", updated.Name, "expected updated token name")
	require.Equal(t, 999, updated.RemainQuota, "expected remain_quota 999")

	// 验证跨用户更新令牌写入了管理审计日志
	requireLatestManageAuditLog(t, 1, "token.admin_update", map[string]interface{}{
		"target_user_id":  2,
		"target_username": "common-user",
		"token_id":        token.Id,
		"token_name":      "admin-updated-token",
	})
}

// TestAdminUpdateTokenRejectsOtherUserToken 验证非 Root 管理员不能更新其他用户的令牌。
func TestAdminUpdateTokenRejectsOtherUserToken(t *testing.T) {
	db := setupAdminTokenTestDB(t)

	seedTestUser(t, db, 1, common.RoleAdminUser, "admin")
	seedTestUser(t, db, 2, common.RoleRootUser, "root")
	token := seedToken(t, db, 2, "root-token", "rt02xxxxxxxxxxxx")

	// Admin 不能修改 Root 的令牌
	body := map[string]any{
		"id":                   token.Id,
		"name":                 "should-fail",
		"expired_time":         -1,
		"remain_quota":         100,
		"unlimited_quota":      false,
		"model_limits_enabled": false,
		"model_limits":         "",
		"group":                "default",
		"cross_group_retry":    false,
	}

	ctx, recorder := newAdminContext(t, http.MethodPut, "/api/token/", body, 1, common.RoleAdminUser)
	UpdateToken(ctx)

	response := decodeAPIResponse(t, recorder)
	require.False(t, response.Success, "expected admin to be rejected from updating root token")

	// 验证 Root 用户的令牌未被修改
	unchanged, err := model.GetTokenById(token.Id)
	require.NoError(t, err, "failed to fetch root token")
	require.Equal(t, "root-token", unchanged.Name, "expected token name unchanged")
	require.Equal(t, "rt02xxxxxxxxxxxx", unchanged.Key, "expected token key unchanged")
}

// TestAdminDeleteTokenDeletesOtherUserToken 验证 Root 用户可删除其他用户的令牌。
func TestAdminDeleteTokenDeletesOtherUserToken(t *testing.T) {
	db := setupAdminTokenTestDB(t)

	seedTestUser(t, db, 1, common.RoleRootUser, "root")
	seedTestUser(t, db, 2, common.RoleCommonUser, "common-user")
	token := seedToken(t, db, 2, "user-token", "ut03xxxxxxxxxxxx")

	ctx, recorder := newAdminContext(t, http.MethodDelete, "/api/token/"+strconv.Itoa(token.Id), nil, 1, common.RoleRootUser)
	ctx.Params = gin.Params{{Key: "id", Value: strconv.Itoa(token.Id)}}
	DeleteToken(ctx)

	response := decodeAPIResponse(t, recorder)
	require.True(t, response.Success, "expected success response, got message: %s", response.Message)

	// 验证令牌已被软删除
	_, err := model.GetTokenById(token.Id)
	require.Error(t, err, "expected token to be deleted")

	// 验证跨用户删除令牌写入了管理审计日志
	requireLatestManageAuditLog(t, 1, "token.admin_delete", map[string]interface{}{
		"target_user_id":  2,
		"target_username": "common-user",
		"token_id":        token.Id,
		"token_name":      "user-token",
	})
}

// TestNonRootGetAllTokensReturnsOwnTokens 验证普通用户只能访问自己的令牌数据。
func TestNonRootGetAllTokensReturnsOwnTokens(t *testing.T) {
	db := setupAdminTokenTestDB(t)
	seedTestUser(t, db, 1, common.RoleCommonUser, "regular-user")
	seedTestUser(t, db, 2, common.RoleCommonUser, "other-user")
	seedToken(t, db, 1, "own-token", "own01xxxxxxxxxxxx")
	seedToken(t, db, 2, "other-token", "oth01xxxxxxxxxxxx")

	ctx, recorder := newAdminContext(t, http.MethodGet, "/api/token/?p=1&size=10", nil, 1, common.RoleCommonUser)
	GetAllTokens(ctx)

	// 普通用户只能看到自己的令牌
	response := decodeAPIResponse(t, recorder)
	require.True(t, response.Success, "expected success for self tokens, got message: %s", response.Message)

	var page tokenPageResponse
	require.NoError(t, common.Unmarshal(response.Data, &page), "failed to decode page response")
	require.Len(t, page.Items, 1, "expected only own token in response")
	require.Equal(t, "own-token", page.Items[0].Name, "expected own token name")
}
