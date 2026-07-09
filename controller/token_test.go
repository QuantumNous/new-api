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
	backendI18n "github.com/QuantumNous/new-api/i18n"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting"
	"github.com/QuantumNous/new-api/setting/operation_setting"
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

type ensureInitialTokenResponse struct {
	Created bool   `json:"created"`
	ID      int    `json:"id"`
	Key     string `json:"key"`
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
	return db
}

func setupInitialTokenControllerTestDB(t *testing.T) *gorm.DB {
	t.Helper()

	db := setupTokenControllerTestDB(t)
	if err := db.AutoMigrate(&model.User{}); err != nil {
		t.Fatalf("failed to migrate user table: %v", err)
	}
	return db
}

func setupInviteRewardTokenControllerTestDB(t *testing.T) *gorm.DB {
	t.Helper()

	db := setupInitialTokenControllerTestDB(t)
	if err := db.AutoMigrate(&model.InviteRewardEvent{}, &model.Log{}); err != nil {
		t.Fatalf("failed to migrate invite reward tables: %v", err)
	}

	paymentSetting := operation_setting.GetPaymentSetting()
	originalPaymentSetting := *paymentSetting
	originalQuotaForNewUser := common.QuotaForNewUser
	originalQuotaForInviter := common.QuotaForInviter
	originalQuotaForInvitee := common.QuotaForInvitee
	t.Cleanup(func() {
		*paymentSetting = originalPaymentSetting
		common.QuotaForNewUser = originalQuotaForNewUser
		common.QuotaForInviter = originalQuotaForInviter
		common.QuotaForInvitee = originalQuotaForInvitee
	})

	paymentSetting.ComplianceConfirmed = true
	paymentSetting.ComplianceTermsVersion = operation_setting.CurrentComplianceTermsVersion
	common.QuotaForNewUser = 0
	common.QuotaForInviter = 100
	common.QuotaForInvitee = 50
	return db
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

func seedTokenUser(t *testing.T, db *gorm.DB, userID int) *model.User {
	t.Helper()

	user := &model.User{
		Id:           userID,
		Username:     fmt.Sprintf("token-user-%d", userID),
		Password:     "password123",
		DisplayName:  fmt.Sprintf("Token User %d", userID),
		Role:         common.RoleCommonUser,
		Status:       common.UserStatusEnabled,
		Email:        fmt.Sprintf("token-user-%d@example.com", userID),
		AffCode:      fmt.Sprintf("tk%d", userID),
		Group:        "plg",
		IsEnterprise: false,
	}
	if err := db.Create(user).Error; err != nil {
		t.Fatalf("failed to create user: %v", err)
	}
	return user
}

func seedInvitedTokenUser(t *testing.T, db *gorm.DB, inviterID int, inviteeID int) (*model.User, *model.User) {
	t.Helper()

	inviter := seedTokenUser(t, db, inviterID)
	invitee := seedTokenUser(t, db, inviteeID)
	invitee.InviterId = inviter.Id
	invitee.InviteRewardStatus = model.InviteRewardStatusPending
	if err := db.Save(invitee).Error; err != nil {
		t.Fatalf("failed to mark invitee pending: %v", err)
	}
	return inviter, invitee
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
	db := setupInitialTokenControllerTestDB(t)
	user := seedTokenUser(t, db, 1)
	user.Group = "Enterprise"
	if err := db.Save(user).Error; err != nil {
		t.Fatalf("failed to update user: %v", err)
	}
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

func TestEnsureInitialTokenCreatesAndRevealsOnlyWhenUserHasNoTokens(t *testing.T) {
	db := setupInitialTokenControllerTestDB(t)
	seedTokenUser(t, db, 11)

	body := map[string]any{
		"name":                 "default",
		"expired_time":         -1,
		"remain_quota":         0,
		"unlimited_quota":      true,
		"model_limits_enabled": false,
		"model_limits":         "",
		"group":                "default",
		"cross_group_retry":    false,
	}
	ctx, recorder := newAuthenticatedContext(t, http.MethodPost, "/api/token/ensure_initial", body, 11)
	EnsureInitialToken(ctx)

	response := decodeAPIResponse(t, recorder)
	if !response.Success {
		t.Fatalf("expected ensure initial token to succeed, got message: %s", response.Message)
	}

	var data ensureInitialTokenResponse
	if err := common.Unmarshal(response.Data, &data); err != nil {
		t.Fatalf("failed to decode ensure initial token response: %v", err)
	}
	if !data.Created {
		t.Fatalf("expected ensure initial token to create a token")
	}
	if data.ID == 0 {
		t.Fatalf("expected created token id")
	}
	if data.Key == "" {
		t.Fatalf("expected one-time raw key reveal")
	}

	var stored model.Token
	if err := db.First(&stored, "id = ? AND user_id = ?", data.ID, 11).Error; err != nil {
		t.Fatalf("failed to load created token: %v", err)
	}
	if stored.Key != data.Key {
		t.Fatalf("expected stored raw key %q, got %q", data.Key, stored.Key)
	}
	if stored.Group != plgGroup {
		t.Fatalf("expected non-enterprise token group to be forced to %q, got %q", plgGroup, stored.Group)
	}
}

func TestEnsureInitialTokenCreatedDoesNotTriggerInviteReward(t *testing.T) {
	db := setupInviteRewardTokenControllerTestDB(t)
	inviter, invitee := seedInvitedTokenUser(t, db, 101, 102)

	body := map[string]any{
		"name":                 "default",
		"expired_time":         -1,
		"remain_quota":         0,
		"unlimited_quota":      true,
		"model_limits_enabled": false,
		"model_limits":         "",
		"group":                "default",
		"cross_group_retry":    false,
	}
	ctx, recorder := newAuthenticatedContext(t, http.MethodPost, "/api/token/ensure_initial", body, invitee.Id)
	EnsureInitialToken(ctx)

	response := decodeAPIResponse(t, recorder)
	if !response.Success {
		t.Fatalf("expected ensure initial token to succeed, got message: %s", response.Message)
	}
	var data ensureInitialTokenResponse
	if err := common.Unmarshal(response.Data, &data); err != nil {
		t.Fatalf("failed to decode ensure initial token response: %v", err)
	}
	if !data.Created {
		t.Fatalf("expected ensure initial token to create")
	}

	var refreshedInvitee model.User
	if err := db.First(&refreshedInvitee, invitee.Id).Error; err != nil {
		t.Fatalf("failed to load invitee: %v", err)
	}
	var refreshedInviter model.User
	if err := db.First(&refreshedInviter, inviter.Id).Error; err != nil {
		t.Fatalf("failed to load inviter: %v", err)
	}
	if refreshedInvitee.InviteRewardStatus != model.InviteRewardStatusPending {
		t.Fatalf("expected invite reward pending, got %q", refreshedInvitee.InviteRewardStatus)
	}
	if refreshedInvitee.Quota != 0 {
		t.Fatalf("expected invitee quota 0, got %d", refreshedInvitee.Quota)
	}
	if refreshedInviter.AffQuota != 0 || refreshedInviter.AffHistoryQuota != 0 || refreshedInviter.AffCount != 0 {
		t.Fatalf("expected inviter reward counters to be 0/0/0, got %d/%d/%d", refreshedInviter.AffQuota, refreshedInviter.AffHistoryQuota, refreshedInviter.AffCount)
	}
	var events int64
	if err := db.Model(&model.InviteRewardEvent{}).Where("invitee_id = ?", invitee.Id).Count(&events).Error; err != nil {
		t.Fatalf("failed to count invite reward events: %v", err)
	}
	if events != 0 {
		t.Fatalf("expected no invite reward events, got %d", events)
	}
}

func TestApplyInitialTokenDefaultsForcesPlgWhenGroupsDisabled(t *testing.T) {
	db := setupInitialTokenControllerTestDB(t)
	seedTokenUser(t, db, 22)

	token := &model.Token{Group: "default", CrossGroupRetry: true}
	ctx, _ := newAuthenticatedContext(t, http.MethodPost, "/api/token/ensure_initial", nil, 22)

	if err := applyInitialTokenDefaults(ctx, token); err != nil {
		t.Fatalf("expected initial token defaults to succeed: %v", err)
	}
	if token.Group != plgGroup {
		t.Fatalf("expected token group to be forced to %q, got %q", plgGroup, token.Group)
	}
	if token.CrossGroupRetry {
		t.Fatalf("expected cross group retry to be disabled for plg users")
	}
}

func TestAddTokenAllowsNonPlgUserToChooseGroupWithoutEnterpriseFlag(t *testing.T) {
	db := setupInitialTokenControllerTestDB(t)
	user := seedTokenUser(t, db, 16)
	user.Group = "Enterprise"
	user.IsEnterprise = false
	if err := db.Save(user).Error; err != nil {
		t.Fatalf("failed to update user: %v", err)
	}

	body := map[string]any{
		"name":                 "enterprise-key",
		"expired_time":         -1,
		"remain_quota":         0,
		"unlimited_quota":      true,
		"model_limits_enabled": false,
		"model_limits":         "",
		"group":                "default",
		"cross_group_retry":    false,
	}
	ctx, recorder := newAuthenticatedContext(t, http.MethodPost, "/api/token/", body, 16)
	AddToken(ctx)

	response := decodeAPIResponse(t, recorder)
	if !response.Success {
		t.Fatalf("expected add token to succeed, got message: %s", response.Message)
	}

	var stored model.Token
	if err := db.First(&stored, "user_id = ? AND name = ?", 16, "enterprise-key").Error; err != nil {
		t.Fatalf("failed to load created token: %v", err)
	}
	if stored.Group != "default" {
		t.Fatalf("expected non-plg user token group to remain %q, got %q", "default", stored.Group)
	}
}

func TestAddTokenDoesNotTriggerInviteReward(t *testing.T) {
	db := setupInviteRewardTokenControllerTestDB(t)
	inviter, invitee := seedInvitedTokenUser(t, db, 201, 202)

	body := map[string]any{
		"name":                 "manual-key",
		"expired_time":         -1,
		"remain_quota":         0,
		"unlimited_quota":      true,
		"model_limits_enabled": false,
		"model_limits":         "",
		"group":                "default",
		"cross_group_retry":    false,
	}
	ctx, recorder := newAuthenticatedContext(t, http.MethodPost, "/api/token/", body, invitee.Id)
	AddToken(ctx)

	response := decodeAPIResponse(t, recorder)
	if !response.Success {
		t.Fatalf("expected add token to succeed, got message: %s", response.Message)
	}

	var refreshedInvitee model.User
	if err := db.First(&refreshedInvitee, invitee.Id).Error; err != nil {
		t.Fatalf("failed to load invitee: %v", err)
	}
	var refreshedInviter model.User
	if err := db.First(&refreshedInviter, inviter.Id).Error; err != nil {
		t.Fatalf("failed to load inviter: %v", err)
	}
	if refreshedInvitee.InviteRewardStatus != model.InviteRewardStatusPending {
		t.Fatalf("expected invite reward pending, got %q", refreshedInvitee.InviteRewardStatus)
	}
	if refreshedInvitee.Quota != 0 {
		t.Fatalf("expected invitee quota 0, got %d", refreshedInvitee.Quota)
	}
	if refreshedInviter.AffQuota != 0 || refreshedInviter.AffHistoryQuota != 0 || refreshedInviter.AffCount != 0 {
		t.Fatalf("expected inviter reward counters to be 0/0/0, got %d/%d/%d", refreshedInviter.AffQuota, refreshedInviter.AffHistoryQuota, refreshedInviter.AffCount)
	}
	var events int64
	if err := db.Model(&model.InviteRewardEvent{}).Where("invitee_id = ?", invitee.Id).Count(&events).Error; err != nil {
		t.Fatalf("failed to count invite reward events: %v", err)
	}
	if events != 0 {
		t.Fatalf("expected no invite reward events, got %d", events)
	}
}

func TestAddTokenRespectsMaxUserTokensInsideCreateTransaction(t *testing.T) {
	if err := backendI18n.Init(); err != nil {
		t.Fatalf("failed to init i18n: %v", err)
	}
	db := setupInitialTokenControllerTestDB(t)
	seedTokenUser(t, db, 15)
	seedToken(t, db, 15, "existing-token", "existing1234token9012")

	tokenSetting := operation_setting.GetTokenSetting()
	previousMaxUserTokens := tokenSetting.MaxUserTokens
	tokenSetting.MaxUserTokens = 1
	t.Cleanup(func() {
		tokenSetting.MaxUserTokens = previousMaxUserTokens
	})

	body := map[string]any{
		"name":                 "second",
		"expired_time":         -1,
		"remain_quota":         0,
		"unlimited_quota":      true,
		"model_limits_enabled": false,
		"model_limits":         "",
		"group":                "default",
		"cross_group_retry":    false,
	}
	ctx, recorder := newAuthenticatedContext(t, http.MethodPost, "/api/token/", body, 15)
	AddToken(ctx)

	response := decodeAPIResponse(t, recorder)
	if response.Success {
		t.Fatalf("expected add token to fail when user is already at max tokens")
	}
	if !strings.Contains(response.Message, "Maximum token limit reached (1)") {
		t.Fatalf("expected max token limit message, got %q", response.Message)
	}

	total, err := model.CountUserTokens(15)
	if err != nil {
		t.Fatalf("failed to count tokens: %v", err)
	}
	if total != 1 {
		t.Fatalf("expected no extra token to be created, got %d tokens", total)
	}
}

func TestEnsureInitialTokenUsesAutoGroupForEnterpriseDefault(t *testing.T) {
	db := setupInitialTokenControllerTestDB(t)
	user := seedTokenUser(t, db, 14)
	user.IsEnterprise = true
	user.Group = "default"
	if err := db.Save(user).Error; err != nil {
		t.Fatalf("failed to update user: %v", err)
	}

	previousDefaultUseAutoGroup := setting.DefaultUseAutoGroup
	setting.DefaultUseAutoGroup = true
	t.Cleanup(func() {
		setting.DefaultUseAutoGroup = previousDefaultUseAutoGroup
	})

	body := map[string]any{
		"name":                 "default",
		"expired_time":         -1,
		"remain_quota":         0,
		"unlimited_quota":      true,
		"model_limits_enabled": false,
		"model_limits":         "",
		"group":                "default",
		"cross_group_retry":    false,
	}
	ctx, recorder := newAuthenticatedContext(t, http.MethodPost, "/api/token/ensure_initial", body, 14)
	EnsureInitialToken(ctx)

	response := decodeAPIResponse(t, recorder)
	if !response.Success {
		t.Fatalf("expected ensure initial token to succeed, got message: %s", response.Message)
	}

	var data ensureInitialTokenResponse
	if err := common.Unmarshal(response.Data, &data); err != nil {
		t.Fatalf("failed to decode ensure initial token response: %v", err)
	}
	if !data.Created {
		t.Fatalf("expected ensure initial token to create a token")
	}

	var stored model.Token
	if err := db.First(&stored, "id = ? AND user_id = ?", data.ID, 14).Error; err != nil {
		t.Fatalf("failed to load created token: %v", err)
	}
	if stored.Group != "auto" {
		t.Fatalf("expected enterprise initial token group to be auto, got %q", stored.Group)
	}
	if !stored.CrossGroupRetry {
		t.Fatalf("expected enterprise initial token to enable cross group retry")
	}
}

func TestEnsureInitialTokenSkipsExistingTokensWithoutRevealingKey(t *testing.T) {
	db := setupInitialTokenControllerTestDB(t)
	seedTokenUser(t, db, 12)
	existing := seedToken(t, db, 12, "existing-token", "existing1234token5678")

	body := map[string]any{
		"name":                 "default",
		"expired_time":         -1,
		"remain_quota":         0,
		"unlimited_quota":      true,
		"model_limits_enabled": false,
		"model_limits":         "",
		"group":                "default",
		"cross_group_retry":    false,
	}
	ctx, recorder := newAuthenticatedContext(t, http.MethodPost, "/api/token/ensure_initial", body, 12)
	EnsureInitialToken(ctx)

	response := decodeAPIResponse(t, recorder)
	if !response.Success {
		t.Fatalf("expected ensure initial token to succeed, got message: %s", response.Message)
	}

	var data ensureInitialTokenResponse
	if err := common.Unmarshal(response.Data, &data); err != nil {
		t.Fatalf("failed to decode ensure initial token response: %v", err)
	}
	if data.Created {
		t.Fatalf("expected ensure initial token to skip creation")
	}
	if data.Key != "" {
		t.Fatalf("expected no raw key reveal for existing token, got %q", data.Key)
	}

	total, err := model.CountUserTokens(12)
	if err != nil {
		t.Fatalf("failed to count tokens: %v", err)
	}
	if total != 1 {
		t.Fatalf("expected exactly one token after skipped ensure, got %d", total)
	}

	var stored model.Token
	if err := db.First(&stored, "id = ?", existing.Id).Error; err != nil {
		t.Fatalf("failed to load existing token: %v", err)
	}
	if stored.Key != existing.Key {
		t.Fatalf("expected existing token key to remain %q, got %q", existing.Key, stored.Key)
	}
}

func TestEnsureInitialTokenExistingDoesNotTriggerInviteReward(t *testing.T) {
	db := setupInviteRewardTokenControllerTestDB(t)
	inviter, invitee := seedInvitedTokenUser(t, db, 301, 302)
	seedToken(t, db, invitee.Id, "existing-token", "existing-invite-token")

	body := map[string]any{
		"name":                 "default",
		"expired_time":         -1,
		"remain_quota":         0,
		"unlimited_quota":      true,
		"model_limits_enabled": false,
		"model_limits":         "",
		"group":                "default",
		"cross_group_retry":    false,
	}
	ctx, recorder := newAuthenticatedContext(t, http.MethodPost, "/api/token/ensure_initial", body, invitee.Id)
	EnsureInitialToken(ctx)

	response := decodeAPIResponse(t, recorder)
	if !response.Success {
		t.Fatalf("expected ensure initial token to succeed, got message: %s", response.Message)
	}
	var data ensureInitialTokenResponse
	if err := common.Unmarshal(response.Data, &data); err != nil {
		t.Fatalf("failed to decode ensure initial token response: %v", err)
	}
	if data.Created {
		t.Fatalf("expected existing token path to skip creation")
	}

	var refreshedInvitee model.User
	if err := db.First(&refreshedInvitee, invitee.Id).Error; err != nil {
		t.Fatalf("failed to load invitee: %v", err)
	}
	var refreshedInviter model.User
	if err := db.First(&refreshedInviter, inviter.Id).Error; err != nil {
		t.Fatalf("failed to load inviter: %v", err)
	}
	if refreshedInvitee.InviteRewardStatus != model.InviteRewardStatusPending {
		t.Fatalf("expected pending reward to remain pending, got %q", refreshedInvitee.InviteRewardStatus)
	}
	if refreshedInvitee.Quota != 0 || refreshedInviter.AffQuota != 0 || refreshedInviter.AffCount != 0 {
		t.Fatalf("expected no reward grant, got invitee quota %d, inviter quota %d count %d", refreshedInvitee.Quota, refreshedInviter.AffQuota, refreshedInviter.AffCount)
	}
}

func TestAddTokenWithPaymentComplianceUnconfirmedStillDoesNotGrantReward(t *testing.T) {
	db := setupInviteRewardTokenControllerTestDB(t)
	operation_setting.GetPaymentSetting().ComplianceConfirmed = false
	inviter, invitee := seedInvitedTokenUser(t, db, 401, 402)

	body := map[string]any{
		"name":                 "manual-key",
		"expired_time":         -1,
		"remain_quota":         0,
		"unlimited_quota":      true,
		"model_limits_enabled": false,
		"model_limits":         "",
		"group":                "default",
		"cross_group_retry":    false,
	}
	ctx, recorder := newAuthenticatedContext(t, http.MethodPost, "/api/token/", body, invitee.Id)
	AddToken(ctx)

	response := decodeAPIResponse(t, recorder)
	if !response.Success {
		t.Fatalf("expected add token to succeed, got message: %s", response.Message)
	}

	var tokenCount int64
	if err := db.Model(&model.Token{}).Where("user_id = ?", invitee.Id).Count(&tokenCount).Error; err != nil {
		t.Fatalf("failed to count tokens: %v", err)
	}
	if tokenCount != 1 {
		t.Fatalf("expected created token, got count %d", tokenCount)
	}
	var refreshedInvitee model.User
	if err := db.First(&refreshedInvitee, invitee.Id).Error; err != nil {
		t.Fatalf("failed to load invitee: %v", err)
	}
	var refreshedInviter model.User
	if err := db.First(&refreshedInviter, inviter.Id).Error; err != nil {
		t.Fatalf("failed to load inviter: %v", err)
	}
	if refreshedInvitee.InviteRewardStatus != model.InviteRewardStatusPending {
		t.Fatalf("expected invite reward pending, got %q", refreshedInvitee.InviteRewardStatus)
	}
	if refreshedInvitee.Quota != 0 || refreshedInviter.AffQuota != 0 || refreshedInviter.AffCount != 0 {
		t.Fatalf("expected no reward grant, got invitee quota %d, inviter quota %d count %d", refreshedInvitee.Quota, refreshedInviter.AffQuota, refreshedInviter.AffCount)
	}
}

func TestEnsureInitialTokenRespectsMaxUserTokensZero(t *testing.T) {
	if err := backendI18n.Init(); err != nil {
		t.Fatalf("failed to init i18n: %v", err)
	}
	db := setupInitialTokenControllerTestDB(t)
	seedTokenUser(t, db, 13)

	tokenSetting := operation_setting.GetTokenSetting()
	previousMaxUserTokens := tokenSetting.MaxUserTokens
	tokenSetting.MaxUserTokens = 0
	t.Cleanup(func() {
		tokenSetting.MaxUserTokens = previousMaxUserTokens
	})

	body := map[string]any{
		"name":                 "default",
		"expired_time":         -1,
		"remain_quota":         0,
		"unlimited_quota":      true,
		"model_limits_enabled": false,
		"model_limits":         "",
		"group":                "default",
		"cross_group_retry":    false,
	}
	ctx, recorder := newAuthenticatedContext(t, http.MethodPost, "/api/token/ensure_initial", body, 13)
	EnsureInitialToken(ctx)

	response := decodeAPIResponse(t, recorder)
	if response.Success {
		t.Fatalf("expected ensure initial token to fail when max user tokens is zero")
	}
	if !strings.Contains(response.Message, "Maximum token limit reached (0)") {
		t.Fatalf("expected max token limit message, got %q", response.Message)
	}

	total, err := model.CountUserTokens(13)
	if err != nil {
		t.Fatalf("failed to count tokens: %v", err)
	}
	if total != 0 {
		t.Fatalf("expected no token to be created when max user tokens is zero, got %d", total)
	}
}
