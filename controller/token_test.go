package controller

import (
	"bytes"
	"database/sql"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"net/url"
	"os"
	"strconv"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/middleware"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/setting/system_setting"
	"github.com/gin-gonic/gin"
	"github.com/glebarez/sqlite"
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

type ccSwitchImportOptionsResponse struct {
	Token struct {
		ID        int    `json:"id"`
		Name      string `json:"name"`
		MaskedKey string `json:"masked_key"`
		BaseURL   string `json:"base_url"`
	} `json:"token"`
	DefaultTarget string                     `json:"default_target"`
	DefaultModel  string                     `json:"default_model"`
	Targets       []dto.CCSwitchImportTarget `json:"targets"`
	Models        []dto.CCSwitchModelOption  `json:"models"`
}

type ccSwitchImportLinkResponse struct {
	URL string `json:"url"`
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

func (legacyToken) TableName() string {
	return "tokens"
}

func openTokenControllerTestDB(t *testing.T) *gorm.DB {
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

	t.Cleanup(func() {
		sqlDB, err := db.DB()
		if err == nil {
			_ = sqlDB.Close()
		}
	})

	return db
}

func migrateTokenControllerTestDB(t *testing.T, db *gorm.DB) {
	t.Helper()

	if err := db.AutoMigrate(&model.Token{}); err != nil {
		t.Fatalf("failed to migrate token table: %v", err)
	}
}

func setupTokenControllerTestDB(t *testing.T) *gorm.DB {
	t.Helper()

	db := openTokenControllerTestDB(t)
	migrateTokenControllerTestDB(t, db)
	if err := db.AutoMigrate(&model.User{}, &model.Channel{}, &model.Ability{}, &model.Model{}, &model.Vendor{}); err != nil {
		t.Fatalf("failed to migrate CC Switch import option dependencies: %v", err)
	}
	seedTokenControllerUser(t, db, 1, "default")
	seedTokenControllerUser(t, db, 2, "default")
	service.InvalidateCCSwitchModelCache()
	t.Cleanup(service.InvalidateCCSwitchModelCache)
	return db
}

func seedTokenControllerUser(t *testing.T, db *gorm.DB, id int, group string) {
	t.Helper()

	user := &model.User{
		Id:       id,
		Username: fmt.Sprintf("token-user-%d", id),
		Password: "password",
		Group:    group,
		Status:   common.UserStatusEnabled,
	}
	if err := db.Create(user).Error; err != nil {
		t.Fatalf("failed to create token test user %d: %v", id, err)
	}
}

func seedCCSwitchModelOption(t *testing.T, db *gorm.DB, modelName string, vendorName string, createdTime int64, group string) {
	t.Helper()

	vendor := &model.Vendor{Name: vendorName, Status: common.UserStatusEnabled}
	if err := db.Create(vendor).Error; err != nil {
		t.Fatalf("failed to create CC Switch test vendor: %v", err)
	}
	channel := &model.Channel{Name: vendorName + " channel", Key: "test-key", Status: common.ChannelStatusEnabled}
	if err := db.Create(channel).Error; err != nil {
		t.Fatalf("failed to create CC Switch test channel: %v", err)
	}
	modelMeta := &model.Model{
		ModelName:   modelName,
		VendorID:    vendor.Id,
		Status:      common.UserStatusEnabled,
		CreatedTime: createdTime,
		NameRule:    model.NameRuleExact,
	}
	if err := db.Create(modelMeta).Error; err != nil {
		t.Fatalf("failed to create CC Switch test model metadata: %v", err)
	}
	ability := &model.Ability{Group: group, Model: modelName, ChannelId: channel.Id, Enabled: true}
	if err := db.Create(ability).Error; err != nil {
		t.Fatalf("failed to create CC Switch test ability: %v", err)
	}
	service.InvalidateCCSwitchModelCache()
}

func openTokenControllerExternalDB(t *testing.T, dialect string, dsn string) (*gorm.DB, *bool) {
	t.Helper()

	gin.SetMode(gin.TestMode)
	common.RedisEnabled = false
	common.UsingSQLite = false
	common.UsingMySQL = dialect == "mysql"
	common.UsingPostgreSQL = dialect == "postgres"

	var (
		db  *gorm.DB
		err error
	)
	switch dialect {
	case "mysql":
		db, err = gorm.Open(mysql.Open(dsn), &gorm.Config{})
	case "postgres":
		db, err = gorm.Open(postgres.Open(dsn), &gorm.Config{})
	default:
		t.Fatalf("unsupported dialect %q", dialect)
	}
	if err != nil {
		t.Fatalf("failed to open %s db: %v", dialect, err)
	}

	model.DB = db
	model.LOG_DB = db

	if db.Migrator().HasTable("tokens") {
		t.Skipf("refusing to run %s migration compatibility test against external database because tokens table already exists", dialect)
	}

	managedTokensTable := new(bool)

	t.Cleanup(func() {
		if *managedTokensTable && db.Migrator().HasTable("tokens") {
			_ = db.Migrator().DropTable("tokens")
		}
		sqlDB, err := db.DB()
		if err == nil {
			_ = sqlDB.Close()
		}
	})

	return db, managedTokensTable
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

func newCCSwitchTokenRouter(userID int) *gin.Engine {
	router := gin.New()
	tokenRoute := router.Group("/api/token")
	tokenRoute.Use(func(c *gin.Context) {
		c.Set("id", userID)
		c.Next()
	})
	tokenRoute.GET("/:id/ccswitch/import-options", middleware.DisableCache(), GetTokenCCSwitchImportOptions)
	tokenRoute.POST("/:id/ccswitch/import-link", middleware.CriticalRateLimit(), middleware.DisableCache(), CreateTokenCCSwitchImportLink)
	return router
}

func performJSONRequest(t *testing.T, router *gin.Engine, method string, target string, body any) *httptest.ResponseRecorder {
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
	request := httptest.NewRequest(method, target, requestBody)
	if body != nil {
		request.Header.Set("Content-Type", "application/json")
	}
	request.Header.Set("User-Agent", "ccswitch-test-agent")
	request.RemoteAddr = "203.0.113.10:1234"

	recorder := httptest.NewRecorder()
	router.ServeHTTP(recorder, request)
	return recorder
}

func decodeAPIResponse(t *testing.T, recorder *httptest.ResponseRecorder) tokenAPIResponse {
	t.Helper()

	var response tokenAPIResponse
	if err := common.Unmarshal(recorder.Body.Bytes(), &response); err != nil {
		t.Fatalf("failed to decode api response: %v", err)
	}
	return response
}

func setServerAddressForTest(t *testing.T, serverAddress string) {
	t.Helper()

	original := system_setting.ServerAddress
	system_setting.ServerAddress = serverAddress
	t.Cleanup(func() {
		system_setting.ServerAddress = original
	})
}

func getSQLiteColumnType(t *testing.T, db *gorm.DB, tableName string, columnName string) string {
	t.Helper()

	var columns []sqliteColumnInfo
	if err := db.Raw("PRAGMA table_info(" + tableName + ")").Scan(&columns).Error; err != nil {
		t.Fatalf("failed to inspect %s schema: %v", tableName, err)
	}

	for _, column := range columns {
		if column.Name == columnName {
			return strings.ToLower(column.Type)
		}
	}

	t.Fatalf("column %s not found in %s schema", columnName, tableName)
	return ""
}

func getTokenKeyColumnType(t *testing.T, db *gorm.DB, dialect string) string {
	t.Helper()

	switch dialect {
	case "sqlite":
		return getSQLiteColumnType(t, db, "tokens", "key")
	case "mysql":
		var columnType string
		if err := db.Raw(`SELECT COLUMN_TYPE FROM information_schema.columns
			WHERE table_schema = DATABASE() AND table_name = ? AND column_name = ?`,
			"tokens", "key").Scan(&columnType).Error; err != nil {
			t.Fatalf("failed to inspect mysql token key column: %v", err)
		}
		return strings.ToLower(columnType)
	case "postgres":
		var dataType string
		var maxLength sql.NullInt64
		if err := db.Raw(`SELECT data_type, character_maximum_length
			FROM information_schema.columns
			WHERE table_schema = current_schema() AND table_name = ? AND column_name = ?`,
			"tokens", "key").Row().Scan(&dataType, &maxLength); err != nil {
			t.Fatalf("failed to inspect postgres token key column: %v", err)
		}
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
		t.Fatalf("unsupported dialect %q", dialect)
		return ""
	}
}

func runTokenMigrationCompatibilityTest(t *testing.T, db *gorm.DB, dialect string, managedTokensTable *bool) {
	t.Helper()

	legacyKey := strings.Repeat("a", 48)
	longKey := strings.Repeat("b", 64)

	if err := db.AutoMigrate(&legacyToken{}); err != nil {
		t.Fatalf("failed to create legacy token schema: %v", err)
	}
	if managedTokensTable != nil {
		*managedTokensTable = true
	}
	if err := db.Create(&legacyToken{
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
	}).Error; err != nil {
		t.Fatalf("failed to seed legacy token row: %v", err)
	}

	if got := getTokenKeyColumnType(t, db, dialect); got != "char(48)" {
		t.Fatalf("expected legacy key column type char(48), got %q", got)
	}

	migrateTokenControllerTestDB(t, db)

	if got := getTokenKeyColumnType(t, db, dialect); got != "varchar(128)" {
		t.Fatalf("expected migrated key column type varchar(128), got %q", got)
	}

	var migratedToken model.Token
	if err := db.First(&migratedToken, "name = ?", "legacy-token").Error; err != nil {
		t.Fatalf("failed to load migrated token row: %v", err)
	}
	if migratedToken.Key != legacyKey {
		t.Fatalf("expected migrated token key %q, got %q", legacyKey, migratedToken.Key)
	}
	if migratedToken.Name != "legacy-token" {
		t.Fatalf("expected migrated token name to be preserved, got %q", migratedToken.Name)
	}

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
	if err := db.Create(&inserted).Error; err != nil {
		t.Fatalf("failed to insert long token after migration: %v", err)
	}

	var fetched model.Token
	if err := db.First(&fetched, "id = ?", inserted.Id).Error; err != nil {
		t.Fatalf("failed to fetch long token after migration: %v", err)
	}
	if fetched.Key != longKey {
		t.Fatalf("expected long token key %q, got %q", longKey, fetched.Key)
	}
}

func TestTokenAutoMigrateUsesVarchar128KeyColumn(t *testing.T) {
	db := setupTokenControllerTestDB(t)

	if got := getTokenKeyColumnType(t, db, "sqlite"); got != "varchar(128)" {
		t.Fatalf("expected key column type varchar(128), got %q", got)
	}
}

func TestTokenMigrationFromChar48ToVarchar128(t *testing.T) {
	db := openTokenControllerTestDB(t)
	runTokenMigrationCompatibilityTest(t, db, "sqlite", nil)
}

func TestTokenMigrationFromChar48ToVarchar128MySQL(t *testing.T) {
	dsn := os.Getenv("TEST_MYSQL_DSN")
	if dsn == "" {
		t.Skip("set TEST_MYSQL_DSN to run mysql migration compatibility test")
	}

	db, managedTokensTable := openTokenControllerExternalDB(t, "mysql", dsn)
	runTokenMigrationCompatibilityTest(t, db, "mysql", managedTokensTable)
}

func TestTokenMigrationFromChar48ToVarchar128Postgres(t *testing.T) {
	dsn := os.Getenv("TEST_POSTGRES_DSN")
	if dsn == "" {
		t.Skip("set TEST_POSTGRES_DSN to run postgres migration compatibility test")
	}

	db, managedTokensTable := openTokenControllerExternalDB(t, "postgres", dsn)
	runTokenMigrationCompatibilityTest(t, db, "postgres", managedTokensTable)
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

func TestGetTokenCCSwitchImportOptionsMasksKey(t *testing.T) {
	db := setupTokenControllerTestDB(t)
	setServerAddressForTest(t, "https://ignored.example.com/")
	token := seedToken(t, db, 1, "codex token", "raw-secret-token-value")
	seedCCSwitchModelOption(t, db, "gpt-test-latest", "OpenAI", 20, "default")

	ctx, recorder := newAuthenticatedContext(t, http.MethodGet, "/api/token/"+strconv.Itoa(token.Id)+"/ccswitch/import-options", nil, 1)
	ctx.Params = gin.Params{{Key: "id", Value: strconv.Itoa(token.Id)}}
	GetTokenCCSwitchImportOptions(ctx)

	response := decodeAPIResponse(t, recorder)
	if !response.Success {
		t.Fatalf("expected import options to succeed, got message: %s", response.Message)
	}

	var options ccSwitchImportOptionsResponse
	if err := common.Unmarshal(response.Data, &options); err != nil {
		t.Fatalf("failed to decode import options: %v", err)
	}
	if options.Token.ID != token.Id {
		t.Fatalf("expected token id %d, got %d", token.Id, options.Token.ID)
	}
	if options.Token.MaskedKey != token.GetMaskedKey() {
		t.Fatalf("expected masked key %q, got %q", token.GetMaskedKey(), options.Token.MaskedKey)
	}
	if options.Token.BaseURL != "https://api.xistree.hk/" {
		t.Fatalf("expected fixed CC Switch endpoint, got %q", options.Token.BaseURL)
	}
	if options.DefaultTarget != "codex" {
		t.Fatalf("expected default target codex, got %q", options.DefaultTarget)
	}
	if options.DefaultModel != "gpt-test-latest" {
		t.Fatalf("expected default model from import cache, got %q", options.DefaultModel)
	}
	if len(options.Targets) != 2 || options.Targets[0].Key != "codex" || !options.Targets[0].Enabled || options.Targets[1].Key != "claude" || !options.Targets[1].Enabled {
		t.Fatalf("expected Codex and Claude Code targets to be enabled, got %+v", options.Targets)
	}
	if len(options.Models) != 1 || options.Models[0].Name != "gpt-test-latest" || options.Models[0].VendorName != "OpenAI" {
		t.Fatalf("expected import model options from cache, got %+v", options.Models)
	}
	if strings.Contains(recorder.Body.String(), token.Key) {
		t.Fatalf("import options leaked raw token key: %s", recorder.Body.String())
	}
}

func TestCreateTokenCCSwitchImportLinkRequiresOwnership(t *testing.T) {
	db := setupTokenControllerTestDB(t)
	setServerAddressForTest(t, "https://api.xistree.hk/")
	token := seedToken(t, db, 1, "owned-token", "owner-only-key")

	ctx, recorder := newAuthenticatedContext(t, http.MethodPost, "/api/token/"+strconv.Itoa(token.Id)+"/ccswitch/import-link", dto.CCSwitchImportLinkRequest{
		Target: "codex",
		Model:  "gpt-5.5",
	}, 2)
	ctx.Params = gin.Params{{Key: "id", Value: strconv.Itoa(token.Id)}}
	CreateTokenCCSwitchImportLink(ctx)

	response := decodeAPIResponse(t, recorder)
	if response.Success {
		t.Fatalf("expected unauthorized import link request to fail")
	}
	if strings.Contains(recorder.Body.String(), token.Key) {
		t.Fatalf("unauthorized import link response leaked raw token key: %s", recorder.Body.String())
	}
}

func TestCreateTokenCCSwitchImportLinkBuildsEncodedURL(t *testing.T) {
	db := setupTokenControllerTestDB(t)
	setServerAddressForTest(t, "https://api.xistree.hk/")
	token := seedToken(t, db, 1, "token name / ? &= value", "secret-token-key")
	router := newCCSwitchTokenRouter(1)

	recorder := performJSONRequest(t, router, http.MethodPost, "/api/token/"+strconv.Itoa(token.Id)+"/ccswitch/import-link", dto.CCSwitchImportLinkRequest{
		Target: "codex",
		Model:  "gpt 5.5 / ? &= model",
	})
	response := decodeAPIResponse(t, recorder)
	if !response.Success {
		t.Fatalf("expected import link to succeed, got message: %s", response.Message)
	}
	if !strings.Contains(recorder.Header().Get("Cache-Control"), "no-store") {
		t.Fatalf("expected no-store cache header, got %q", recorder.Header().Get("Cache-Control"))
	}

	var link ccSwitchImportLinkResponse
	if err := common.Unmarshal(response.Data, &link); err != nil {
		t.Fatalf("failed to decode import link: %v", err)
	}
	parsed, err := url.Parse(link.URL)
	if err != nil {
		t.Fatalf("failed to parse import link: %v", err)
	}
	if parsed.Scheme != "ccswitch" || parsed.Host != "v1" || parsed.Path != "/import" {
		t.Fatalf("unexpected import link shape: %s", link.URL)
	}
	query := parsed.Query()
	if query.Get("resource") != "provider" {
		t.Fatalf("expected provider resource, got %q", query.Get("resource"))
	}
	if query.Get("app") != "codex" {
		t.Fatalf("expected codex app, got %q", query.Get("app"))
	}
	if query.Get("endpoint") != "https://api.xistree.hk/" {
		t.Fatalf("expected fixed CC Switch endpoint, got %q", query.Get("endpoint"))
	}
	if query.Get("apiKey") != "sk-secret-token-key" {
		t.Fatalf("expected normalized api key, got %q", query.Get("apiKey"))
	}
	if query.Get("name") != "Xistree" {
		t.Fatalf("expected fixed CC Switch provider name, got %q", query.Get("name"))
	}
	if query.Get("model") != "gpt 5.5 / ? &= model" {
		t.Fatalf("expected encoded model round trip, got %q", query.Get("model"))
	}
	if query.Get("wire_api") != "responses" || query.Get("requires_openai_auth") != "true" {
		t.Fatalf("expected Codex provider defaults, got %s", link.URL)
	}
}

func TestCreateTokenCCSwitchClaudeLinkFallsBackAndKeepsCodexParamsSeparate(t *testing.T) {
	db := setupTokenControllerTestDB(t)
	setServerAddressForTest(t, "https://ignored.example.com/")
	token := seedToken(t, db, 1, "claude token", "claude-secret")

	ctx, recorder := newAuthenticatedContext(t, http.MethodPost, "/api/token/"+strconv.Itoa(token.Id)+"/ccswitch/import-link", dto.CCSwitchImportLinkRequest{
		Target:      "claude",
		Model:       "claude-main",
		HaikuModel:  "claude-haiku",
		SonnetModel: "",
		OpusModel:   "claude-opus",
	}, 1)
	ctx.Params = gin.Params{{Key: "id", Value: strconv.Itoa(token.Id)}}
	CreateTokenCCSwitchImportLink(ctx)

	response := decodeAPIResponse(t, recorder)
	if !response.Success {
		t.Fatalf("expected Claude import link to succeed, got %q", response.Message)
	}
	var link ccSwitchImportLinkResponse
	if err := common.Unmarshal(response.Data, &link); err != nil {
		t.Fatalf("failed to decode Claude import link: %v", err)
	}
	parsed, err := url.Parse(link.URL)
	if err != nil {
		t.Fatalf("failed to parse Claude import link: %v", err)
	}
	query := parsed.Query()
	if query.Get("app") != "claude" || query.Get("endpoint") != "https://api.xistree.hk/" {
		t.Fatalf("unexpected Claude provider parameters: %s", link.URL)
	}
	if query.Get("name") != "Xistree" {
		t.Fatalf("expected fixed CC Switch provider name, got %q", query.Get("name"))
	}
	if query.Get("model") != "claude-main" || query.Get("haikuModel") != "claude-haiku" || query.Get("sonnetModel") != "claude-main" || query.Get("opusModel") != "claude-opus" {
		t.Fatalf("unexpected Claude model parameters: %s", link.URL)
	}
	if query.Get("wire_api") != "" || query.Get("requires_openai_auth") != "" {
		t.Fatalf("Codex-only parameters leaked into Claude link: %s", link.URL)
	}
}

func TestCreateTokenCCSwitchImportLinkKeepsExistingSKPrefix(t *testing.T) {
	db := setupTokenControllerTestDB(t)
	setServerAddressForTest(t, "https://api.xistree.hk/")
	token := seedToken(t, db, 1, "sk-token", "sk-existing-prefix")

	ctx, recorder := newAuthenticatedContext(t, http.MethodPost, "/api/token/"+strconv.Itoa(token.Id)+"/ccswitch/import-link", dto.CCSwitchImportLinkRequest{
		Target: "codex",
		Model:  "gpt-5.5",
	}, 1)
	ctx.Params = gin.Params{{Key: "id", Value: strconv.Itoa(token.Id)}}
	CreateTokenCCSwitchImportLink(ctx)

	response := decodeAPIResponse(t, recorder)
	if !response.Success {
		t.Fatalf("expected import link to succeed, got message: %s", response.Message)
	}
	var link ccSwitchImportLinkResponse
	if err := common.Unmarshal(response.Data, &link); err != nil {
		t.Fatalf("failed to decode import link: %v", err)
	}
	parsed, err := url.Parse(link.URL)
	if err != nil {
		t.Fatalf("failed to parse import link: %v", err)
	}
	if got := parsed.Query().Get("apiKey"); got != "sk-existing-prefix" {
		t.Fatalf("expected existing sk prefix to be preserved, got %q", got)
	}
}

func TestCreateTokenCCSwitchImportLinkIgnoresServerAddress(t *testing.T) {
	db := setupTokenControllerTestDB(t)
	setServerAddressForTest(t, "")
	token := seedToken(t, db, 1, "missing-server-address", "server-address-key")

	ctx, recorder := newAuthenticatedContext(t, http.MethodPost, "/api/token/"+strconv.Itoa(token.Id)+"/ccswitch/import-link", dto.CCSwitchImportLinkRequest{
		Target: "codex",
		Model:  "gpt-5.5",
	}, 1)
	ctx.Params = gin.Params{{Key: "id", Value: strconv.Itoa(token.Id)}}
	CreateTokenCCSwitchImportLink(ctx)

	response := decodeAPIResponse(t, recorder)
	if !response.Success {
		t.Fatalf("expected fixed endpoint to work without ServerAddress, got %q", response.Message)
	}
}

func TestCreateTokenCCSwitchImportLinkRejectsUnavailableTargetAndMissingModel(t *testing.T) {
	db := setupTokenControllerTestDB(t)
	setServerAddressForTest(t, "https://api.xistree.hk/")
	token := seedToken(t, db, 1, "validation-token", "validation-key")

	targetCtx, targetRecorder := newAuthenticatedContext(t, http.MethodPost, "/api/token/"+strconv.Itoa(token.Id)+"/ccswitch/import-link", dto.CCSwitchImportLinkRequest{
		Target: "hermes",
		Model:  "gpt-5.5",
	}, 1)
	targetCtx.Params = gin.Params{{Key: "id", Value: strconv.Itoa(token.Id)}}
	CreateTokenCCSwitchImportLink(targetCtx)
	targetResponse := decodeAPIResponse(t, targetRecorder)
	if targetResponse.Success {
		t.Fatalf("expected unsupported target to fail")
	}

	modelCtx, modelRecorder := newAuthenticatedContext(t, http.MethodPost, "/api/token/"+strconv.Itoa(token.Id)+"/ccswitch/import-link", dto.CCSwitchImportLinkRequest{
		Target: "codex",
		Model:  "",
	}, 1)
	modelCtx.Params = gin.Params{{Key: "id", Value: strconv.Itoa(token.Id)}}
	CreateTokenCCSwitchImportLink(modelCtx)
	modelResponse := decodeAPIResponse(t, modelRecorder)
	if modelResponse.Success {
		t.Fatalf("expected missing model to fail")
	}
}
