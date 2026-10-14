package controller

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"sort"
	"strconv"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/i18n"
	"github.com/QuantumNous/new-api/middleware"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/service/authz"
	"github.com/alicebob/miniredis/v2"
	"github.com/glebarez/sqlite"
	"github.com/go-redis/redis/v8"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func setupManageUserTestDB(t *testing.T) *gorm.DB {
	t.Helper()
	return setupManageUserTestDBWithOptions(t, manageUserTestDBOptions{})
}

type manageUserTestDBOptions struct {
	deferredSQLite bool
}

func setupManageUserTestDBWithOptions(t *testing.T, options manageUserTestDBOptions) *gorm.DB {
	t.Helper()
	require.NoError(t, i18n.Init())
	previousDB, previousLogDB := model.DB, model.LOG_DB
	previousRedisEnabled := common.RedisEnabled
	previousMainDatabaseType, previousLogDatabaseType := common.MainDatabaseType(), common.LogDatabaseType()
	dialect := os.Getenv("TEST_MANAGE_USER_DIALECT")
	if dialect == "" {
		dialect = "sqlite"
	}
	databaseTypes := map[string]common.DatabaseType{
		"sqlite": common.DatabaseTypeSQLite, "mysql": common.DatabaseTypeMySQL, "postgres": common.DatabaseTypePostgreSQL,
	}
	require.Contains(t, databaseTypes, dialect)
	dsn := os.Getenv("TEST_" + strings.ToUpper(dialect) + "_DSN")
	if options.deferredSQLite && dialect == "sqlite" {
		databaseURL := controllerTestSQLiteFileURL(filepath.Join(t.TempDir(), "manage-user.db"), "")
		query := databaseURL.Query()
		query.Add("_pragma", "busy_timeout(30000)")
		query.Add("_pragma", "journal_mode(WAL)")
		databaseURL.RawQuery = query.Encode()
		dsn = databaseURL.String()
	}
	db, _ := newAuditTestDatabase(t, dialect, dsn)
	logDB := db
	if os.Getenv("TEST_MANAGE_USER_SEPARATE_LOG_DB") == "1" {
		logDB, _ = newAuditTestDatabase(t, dialect, dsn)
	}
	model.DB, model.LOG_DB = db, logDB
	common.RedisEnabled = false
	common.SetDatabaseTypes(databaseTypes[dialect], databaseTypes[dialect])

	t.Cleanup(func() {
		model.DB, model.LOG_DB = previousDB, previousLogDB
		common.RedisEnabled = previousRedisEnabled
		common.SetDatabaseTypes(previousMainDatabaseType, previousLogDatabaseType)
		sqlDB, err := db.DB()
		if err == nil {
			_ = sqlDB.Close()
		}
		if logDB != db {
			sqlLogDB, err := logDB.DB()
			if err == nil {
				_ = sqlLogDB.Close()
			}
		}
	})
	require.NoError(t, db.AutoMigrate(&model.User{}, &model.UserSession{}, &model.CasbinRule{}, &model.AuthzRole{}))
	require.NoError(t, logDB.AutoMigrate(&model.Log{}, &model.AuditLog{}))
	versionQuery := "SELECT version()"
	if dialect == "sqlite" {
		versionQuery = "SELECT sqlite_version()"
	}
	var version string
	require.NoError(t, db.Raw(versionQuery).Scan(&version).Error)
	t.Logf("database: %s %s, separate log database: %v", dialect, version, logDB != db)
	return db
}

func probeConcurrentSQLiteWrite(t *testing.T, db *gorm.DB) error {
	t.Helper()
	require.NoError(t, db.Exec("CREATE TABLE manage_user_lock_probe (id INTEGER PRIMARY KEY)").Error)
	var database struct {
		File string `gorm:"column:file"`
	}
	require.NoError(t, db.Raw("PRAGMA database_list").Scan(&database).Error)
	require.NotEmpty(t, database.File)

	contenderURL := controllerTestSQLiteFileURL(database.File, "")
	query := contenderURL.Query()
	query.Add("_pragma", "busy_timeout(0)")
	contenderURL.RawQuery = query.Encode()
	contender, err := gorm.Open(sqlite.Open(contenderURL.String()), &gorm.Config{})
	require.NoError(t, err)
	contenderSQL, err := contender.DB()
	require.NoError(t, err)
	t.Cleanup(func() { _ = contenderSQL.Close() })

	tx := db.Begin()
	require.NoError(t, tx.Error)
	defer func() { require.NoError(t, tx.Rollback().Error) }()
	return contender.Exec("INSERT INTO manage_user_lock_probe (id) VALUES (1)").Error
}

func TestSetupManageUserTestDBSQLiteDefaultsToImmediateLocking(t *testing.T) {
	t.Setenv("TEST_MANAGE_USER_DIALECT", "sqlite")
	t.Setenv("TEST_SQLITE_DSN", "")
	t.Setenv("TEST_MANAGE_USER_SEPARATE_LOG_DB", "")

	err := probeConcurrentSQLiteWrite(t, setupManageUserTestDB(t))
	require.Error(t, err)
	assert.Contains(t, strings.ToLower(err.Error()), "locked")
}

func performManageUserRequest(t *testing.T, body string) *httptest.ResponseRecorder {
	t.Helper()
	return performUserManagementRequest(t, common.RoleRootUser, http.MethodPost, "/api/user/manage", body, nil, ManageUser)
}

func performUserManagementRequest(t *testing.T, role int, method, path, body string, params gin.Params, handler gin.HandlerFunc) *httptest.ResponseRecorder {
	t.Helper()
	gin.SetMode(gin.TestMode)
	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)
	c.Request = httptest.NewRequest(method, path, strings.NewReader(body))
	c.Request.Header.Set("Content-Type", "application/json")
	c.Set("id", 9999)
	c.Set("role", role)
	username := "admin-operator"
	if role == common.RoleRootUser {
		username = "root-operator"
	}
	c.Set("username", username)
	c.Set(common.RequestIdKey, "quota-test-request")
	c.Params = params
	handler(c)
	return recorder
}

type userListingResponse struct {
	Success bool `json:"success"`
	Data    struct {
		Total int          `json:"total"`
		Items []model.User `json:"items"`
	} `json:"data"`
}

func decodeUserListingResponse(t *testing.T, recorder *httptest.ResponseRecorder) userListingResponse {
	t.Helper()
	require.Equal(t, http.StatusOK, recorder.Code)
	var response userListingResponse
	require.NoError(t, common.Unmarshal(recorder.Body.Bytes(), &response), recorder.Body.String())
	require.True(t, response.Success, recorder.Body.String())
	return response
}

func listedUserIDs(users []model.User) []int {
	ids := make([]int, 0, len(users))
	for _, user := range users {
		ids = append(ids, user.Id)
	}
	return ids
}

func TestManageUserDisableAdvancesAuthVersionOnceAndRevokesSession(t *testing.T) {
	db := setupManageUserTestDB(t)
	now := time.Now().Unix()
	user := model.User{
		Username: "managed-disable-user", Password: "password", Role: common.RoleCommonUser,
		Status: common.UserStatusEnabled, Group: "default", AuthVersion: 1,
	}
	require.NoError(t, db.Create(&user).Error)
	require.NoError(t, db.Create(&model.UserSession{
		SID: "managed-disable-session", UserID: user.Id, Version: 1, UserAuthVersion: 1,
		Status: model.UserSessionStatusActive, RefreshHash: "refresh-hash", LoginMethod: "password",
		LastActiveAt: now, ExpiresAt: now + 3600,
	}).Error)

	recorder := performManageUserRequest(t, fmt.Sprintf(`{"id":%d,"action":"disable"}`, user.Id))
	assert.Equal(t, http.StatusOK, recorder.Code)
	assert.Contains(t, recorder.Body.String(), `"success":true`)

	var updated model.User
	require.NoError(t, db.First(&updated, user.Id).Error)
	assert.Equal(t, common.UserStatusDisabled, updated.Status)
	assert.EqualValues(t, 2, updated.AuthVersion)
	var session model.UserSession
	require.NoError(t, db.First(&session, "sid = ?", "managed-disable-session").Error)
	assert.Equal(t, model.UserSessionStatusRevoked, session.Status)
}

func TestManageUserDemoteAdvancesAuthVersionAndRevokesSessionsOnce(t *testing.T) {
	db := setupManageUserTestDB(t)
	previousMaster := common.IsMasterNode
	common.IsMasterNode = false
	t.Cleanup(func() { common.IsMasterNode = previousMaster })
	require.NoError(t, authz.Init(db))

	now := time.Now().Unix()
	user := model.User{
		Username: "managed-demote-user", Password: "password", Role: common.RoleAdminUser,
		Status: common.UserStatusEnabled, Group: "default", AuthVersion: 1,
	}
	require.NoError(t, db.Create(&user).Error)
	for _, sid := range []string{"managed-demote-session-one", "managed-demote-session-two"} {
		require.NoError(t, db.Create(&model.UserSession{
			SID: sid, UserID: user.Id, Version: 1, UserAuthVersion: 1,
			Status: model.UserSessionStatusActive, RefreshHash: "refresh-" + sid, LoginMethod: "password",
			LastActiveAt: now, ExpiresAt: now + 3600,
		}).Error)
	}

	sessionUpdateCount := 0
	require.NoError(t, db.Callback().Update().Before("gorm:update").Register("test:count_demote_session_updates", func(tx *gorm.DB) {
		if tx.Statement != nil && tx.Statement.Table == "user_sessions" {
			sessionUpdateCount++
		}
	}))

	recorder := performManageUserRequest(t, fmt.Sprintf(`{"id":%d,"action":"demote"}`, user.Id))
	assert.Equal(t, http.StatusOK, recorder.Code)
	assert.Contains(t, recorder.Body.String(), `"success":true`)

	var updated model.User
	require.NoError(t, db.First(&updated, user.Id).Error)
	assert.Equal(t, common.RoleCommonUser, updated.Role)
	assert.EqualValues(t, 2, updated.AuthVersion)
	var sessions []model.UserSession
	require.NoError(t, db.Where("user_id = ?", user.Id).Order("sid asc").Find(&sessions).Error)
	require.Len(t, sessions, 2)
	for _, session := range sessions {
		assert.Equal(t, model.UserSessionStatusRevoked, session.Status)
		assert.Equal(t, "admin_demote", session.RevokedReason)
	}
	assert.Equal(t, 1, sessionUpdateCount)
}

func TestManageUserDeleteReturnsImmediatelyAndUnknownActionFails(t *testing.T) {
	db := setupManageUserTestDB(t)
	deleted := model.User{
		Username: "managed-delete-user", Password: "password", Role: common.RoleCommonUser,
		Status: common.UserStatusEnabled, Group: "default", AuthVersion: 1, AffCode: "delete-aff",
	}
	require.NoError(t, db.Create(&deleted).Error)

	recorder := performManageUserRequest(t, fmt.Sprintf(`{"id":%d,"action":"delete"}`, deleted.Id))
	assert.Contains(t, recorder.Body.String(), `"success":true`)
	var deletedCount int64
	require.NoError(t, db.Unscoped().Model(&model.User{}).Where("id = ? AND deleted_at IS NOT NULL", deleted.Id).Count(&deletedCount).Error)
	assert.EqualValues(t, 1, deletedCount)

	unchanged := model.User{
		Username: "managed-unknown-user", Password: "password", Role: common.RoleCommonUser,
		Status: common.UserStatusEnabled, Group: "default", AuthVersion: 1, AffCode: "unknown-aff",
	}
	require.NoError(t, db.Create(&unchanged).Error)
	recorder = performManageUserRequest(t, fmt.Sprintf(`{"id":%d,"action":"unknown"}`, unchanged.Id))
	assert.Contains(t, recorder.Body.String(), `"success":false`)
	require.NoError(t, db.First(&unchanged, unchanged.Id).Error)
	assert.EqualValues(t, 1, unchanged.AuthVersion)
	assert.Equal(t, common.UserStatusEnabled, unchanged.Status)
}

func setupAdministrativeDeletionTestDB(t *testing.T) *gorm.DB {
	t.Helper()
	db := setupManageUserTestDB(t)
	require.NoError(t, db.AutoMigrate(
		&model.ExternalIdentityClaim{},
		&model.TwoFABackupCode{},
		&model.TwoFA{},
		&model.AuthFlow{},
		&model.PasskeyCredential{},
		&model.Token{},
		&model.UserOAuthBinding{},
		&model.TopUp{},
		&model.QuotaData{},
	))
	return db
}

func seedAdministrativeDeletionAuthData(t *testing.T, db *gorm.DB, user model.User, prefix string) {
	t.Helper()
	now := time.Now().Unix()
	for _, record := range []any{
		&model.ExternalIdentityClaim{Provider: model.ExternalIdentityProviderTelegram, Subject: prefix + "-subject", UserId: user.Id},
		&model.TwoFABackupCode{UserId: user.Id, CodeHash: prefix + "-backup"},
		&model.TwoFA{UserId: user.Id, Secret: prefix + "-secret", IsEnabled: true},
		&model.AuthFlow{
			TokenHash: prefix + "-flow", Purpose: model.AuthFlowPurposeTwoFALogin,
			UserId: user.Id, ExpiresAt: time.Now().Add(time.Minute),
		},
		&model.PasskeyCredential{UserID: user.Id, CredentialID: prefix + "-credential", PublicKey: "public-key"},
		&model.Token{UserId: user.Id, Key: prefix + "-token"},
		&model.UserOAuthBinding{UserId: user.Id, ProviderId: 1, ProviderUserId: prefix + "-oauth"},
		&model.UserSession{
			SID: prefix + "-session", UserID: user.Id, Version: 1, UserAuthVersion: user.AuthVersion,
			Status: model.UserSessionStatusActive, RefreshHash: prefix + "-refresh", LoginMethod: "password",
			LastActiveAt: now, ExpiresAt: now + 3600,
		},
	} {
		require.NoError(t, db.Create(record).Error)
	}
}

func assertAdministrativeDeletionAuthDataPurged(t *testing.T, db *gorm.DB, userID int) {
	t.Helper()
	for name, record := range map[string]any{
		"external identity":    &model.ExternalIdentityClaim{},
		"2FA backup code":      &model.TwoFABackupCode{},
		"2FA":                  &model.TwoFA{},
		"auth flow":            &model.AuthFlow{},
		"passkey":              &model.PasskeyCredential{},
		"token":                &model.Token{},
		"custom OAuth binding": &model.UserOAuthBinding{},
		"session":              &model.UserSession{},
	} {
		var count int64
		require.NoError(t, db.Unscoped().Model(record).Where("user_id = ?", userID).Count(&count).Error)
		assert.Zero(t, count, name)
	}
}

func assertPluginAdminTombstoneColumnsNullable(t *testing.T, db *gorm.DB) {
	t.Helper()
	columnTypes, err := db.Migrator().ColumnTypes(&model.User{})
	require.NoError(t, err)
	nullableColumns := map[string]bool{
		"username":     false,
		"aff_code":     false,
		"access_token": false,
	}
	for _, columnType := range columnTypes {
		columnName := strings.ToLower(columnType.Name())
		if _, ok := nullableColumns[columnName]; !ok {
			continue
		}
		nullable, known := columnType.Nullable()
		require.True(t, known, "%s nullability is unknown", columnName)
		nullableColumns[columnName] = nullable
	}
	for columnName, nullable := range nullableColumns {
		assert.True(t, nullable, "%s must permit SQL NULL", columnName)
	}
}

func assertPluginAdminTombstoneScrubbed(t *testing.T, db *gorm.DB, userID int, createdAt int64, authVersion int64) {
	t.Helper()
	var tombstone model.User
	require.NoError(t, db.Unscoped().First(&tombstone, userID).Error)
	assert.Equal(t, userID, tombstone.Id)
	assert.True(t, tombstone.DeletedAt.Valid)
	assert.Equal(t, common.RolePluginAdminUser, tombstone.Role)
	assert.Equal(t, common.UserStatusDisabled, tombstone.Status)
	assert.Equal(t, authVersion, tombstone.AuthVersion)
	assert.Empty(t, tombstone.Username)
	assert.Empty(t, tombstone.Password)
	assert.Empty(t, tombstone.DisplayName)
	assert.Empty(t, tombstone.Email)
	assert.Empty(t, tombstone.GitHubId)
	assert.Empty(t, tombstone.DiscordId)
	assert.Empty(t, tombstone.OidcId)
	assert.Empty(t, tombstone.WeChatId)
	assert.Empty(t, tombstone.TelegramId)
	assert.Empty(t, tombstone.LinuxDOId)
	assert.Nil(t, tombstone.AccessToken)
	assert.Nil(t, tombstone.AccessTokenCreatedAt)
	assert.Zero(t, tombstone.Quota)
	assert.Zero(t, tombstone.UsedQuota)
	assert.Zero(t, tombstone.RequestCount)
	assert.Empty(t, tombstone.Group)
	assert.Empty(t, tombstone.AffCode)
	assert.Zero(t, tombstone.AffCount)
	assert.Zero(t, tombstone.AffQuota)
	assert.Zero(t, tombstone.AffHistoryQuota)
	assert.Zero(t, tombstone.InviterId)
	assert.Empty(t, tombstone.Setting)
	assert.Empty(t, tombstone.Remark)
	assert.Empty(t, tombstone.StripeCustomer)
	assert.Zero(t, tombstone.LastLoginAt)
	assert.Equal(t, createdAt, tombstone.CreatedAt)

	var identifiers struct {
		Username    *string `gorm:"column:username"`
		AffCode     *string `gorm:"column:aff_code"`
		AccessToken *string `gorm:"column:access_token"`
	}
	require.NoError(t, db.Unscoped().Model(&model.User{}).
		Select("username", "aff_code", "access_token").
		Where("id = ?", userID).
		Take(&identifiers).Error)
	assert.Nil(t, identifiers.Username)
	assert.Nil(t, identifiers.AffCode)
	assert.Nil(t, identifiers.AccessToken)
}

type pluginAdminDeletionFixture struct {
	user        model.User
	password    string
	accessToken string
	identity    model.AuthSessionIdentity
}

func createPluginAdminDeletionFixture(t *testing.T, db *gorm.DB, prefix string, createdAt int64) pluginAdminDeletionFixture {
	t.Helper()
	password := "plugin-admin-password"
	passwordHash, err := common.HashAccountPassword(password)
	require.NoError(t, err)
	accessToken := prefix + "-pat"
	accessTokenCreatedAt := createdAt + 1
	user := model.User{
		Username: prefix, Password: passwordHash, DisplayName: "Sensitive Name",
		Role: common.RolePluginAdminUser, Status: common.UserStatusEnabled,
		Email: prefix + "@example.com", GitHubId: prefix + "-github",
		DiscordId: prefix + "-discord", OidcId: prefix + "-oidc",
		WeChatId: prefix + "-wechat", TelegramId: prefix + "-telegram",
		LinuxDOId: prefix + "-linuxdo", AccessToken: &accessToken,
		AccessTokenCreatedAt: &accessTokenCreatedAt, Quota: 101, UsedQuota: 202,
		RequestCount: 303, Group: "sensitive-group", AffCode: prefix + "-aff",
		AffCount: 4, AffQuota: 505, AffHistoryQuota: 606, InviterId: 707,
		Setting: `{"notify":"secret"}`, Remark: "sensitive remark",
		StripeCustomer: "cus_sensitive", CreatedAt: createdAt,
		LastLoginAt: createdAt + 2, AuthVersion: 1,
	}
	require.NoError(t, db.Create(&user).Error)
	seedAdministrativeDeletionAuthData(t, db, user, prefix)
	return pluginAdminDeletionFixture{
		user:        user,
		password:    password,
		accessToken: accessToken,
		identity: model.AuthSessionIdentity{
			UserID:          user.Id,
			SessionID:       prefix + "-session",
			UserAuthVersion: user.AuthVersion,
			SessionVersion:  1,
		},
	}
}

func assertPluginAdminAuthenticationUnusable(t *testing.T, db *gorm.DB, fixture pluginAdminDeletionFixture) {
	t.Helper()
	login := model.User{Username: fixture.user.Username, Password: fixture.password}
	assert.ErrorIs(t, login.ValidateAndFill(), model.ErrInvalidCredentials)
	accessTokenUser, err := model.ValidateAccessToken(fixture.accessToken)
	require.NoError(t, err)
	assert.Nil(t, accessTokenUser)
	assert.Error(t, db.Transaction(func(tx *gorm.DB) error {
		return model.ValidateAuthSessionWithTx(tx, fixture.identity)
	}))
	activeSessions, err := model.CountActiveUserSessions(fixture.user.Id, time.Now().Unix())
	require.NoError(t, err)
	assert.Zero(t, activeSessions)
	_, err = model.GetUserCache(fixture.user.Id)
	assert.Error(t, err)
}

func TestPluginAdminSoftDeletionScrubsTombstoneAndDisablesAuthentication(t *testing.T) {
	testCases := []struct {
		name   string
		delete func(*testing.T, pluginAdminDeletionFixture)
	}{
		{
			name: "root management delete",
			delete: func(t *testing.T, fixture pluginAdminDeletionFixture) {
				response := performUserManagementRequest(
					t,
					common.RoleRootUser,
					http.MethodPost,
					"/api/user/manage",
					fmt.Sprintf(`{"id":%d,"action":"delete"}`, fixture.user.Id),
					nil,
					ManageUser,
				)
				require.Equal(t, http.StatusOK, response.Code)
				require.Contains(t, response.Body.String(), `"success":true`)
			},
		},
		{
			name: "session self delete",
			delete: func(t *testing.T, fixture pluginAdminDeletionFixture) {
				require.NoError(t, model.DeleteUserForSession(fixture.identity))
			},
		},
	}

	for i, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			db := setupAdministrativeDeletionTestDB(t)
			createdAt := int64(1_700_003_000 + i)
			fixture := createPluginAdminDeletionFixture(t, db, fmt.Sprintf("plugin-soft-%d", i), createdAt)

			tc.delete(t, fixture)

			assertPluginAdminTombstoneScrubbed(t, db, fixture.user.Id, createdAt, 2)
			assertPluginAdminAuthenticationUnusable(t, db, fixture)
			var ownership struct {
				Id   int
				Role int
			}
			require.NoError(t, db.Unscoped().Model(&model.User{}).
				Select("id", "role").
				Where("id = ? AND role = ?", fixture.user.Id, common.RolePluginAdminUser).
				Take(&ownership).Error)
			assert.Equal(t, fixture.user.Id, ownership.Id)
			assert.Equal(t, common.RolePluginAdminUser, ownership.Role)
		})
	}
}

func TestRootDeleteUserRetainsPluginAdminHistoryAndHardDeletesCommonUser(t *testing.T) {
	t.Run("plugin admin becomes a durable tombstone", func(t *testing.T) {
		db := setupAdministrativeDeletionTestDB(t)
		assertPluginAdminTombstoneColumnsNullable(t, db)
		const (
			originalUsername = "deleted-plugin-admin"
			originalPassword = "plugin-admin-password"
			originalEmail    = "deleted-plugin-admin@example.com"
			originalToken    = "plugin-admin-access-token"
		)
		passwordHash, err := common.HashAccountPassword(originalPassword)
		require.NoError(t, err)
		accessToken := originalToken
		accessTokenCreatedAt := int64(1_700_000_100)
		user := model.User{
			Username: originalUsername, Password: passwordHash, DisplayName: "Plugin Admin Name",
			Role: common.RolePluginAdminUser, Status: common.UserStatusEnabled,
			Email: "deleted-plugin-admin@example.com", GitHubId: "github-sensitive",
			DiscordId: "discord-sensitive", OidcId: "oidc-sensitive", WeChatId: "wechat-sensitive",
			TelegramId: "telegram-sensitive", LinuxDOId: "linuxdo-sensitive",
			AccessToken: &accessToken, AccessTokenCreatedAt: &accessTokenCreatedAt,
			Quota: 101, UsedQuota: 202, RequestCount: 303, Group: "sensitive-group",
			AffCode: "deleted-plugin-admin", AffCount: 4, AffQuota: 505,
			AffHistoryQuota: 606, InviterId: 707, Setting: `{"notify":"secret"}`,
			Remark: "sensitive remark", StripeCustomer: "cus_sensitive",
			CreatedAt: 1_700_000_000, LastLoginAt: 1_700_000_200, AuthVersion: 1,
		}
		require.NoError(t, db.Create(&user).Error)
		seedAdministrativeDeletionAuthData(t, db, user, "deleted-plugin-admin")
		legacyTombstoneID := strconv.FormatInt(int64(user.Id), 36)
		legacyCollision := model.User{
			Username: "tomb-" + legacyTombstoneID, Password: "password",
			Role: common.RoleCommonUser, Status: common.UserStatusEnabled,
			Group: "default", AffCode: "tombstone-" + legacyTombstoneID,
		}
		require.NoError(t, db.Create(&legacyCollision).Error)

		login := model.User{Username: originalUsername, Password: originalPassword}
		require.NoError(t, login.ValidateAndFill())
		accessTokenUser, err := model.ValidateAccessToken(originalToken)
		require.NoError(t, err)
		require.NotNil(t, accessTokenUser)
		assert.Equal(t, user.Id, accessTokenUser.Id)

		now := time.Now().Unix()
		topUp := model.TopUp{
			UserId: user.Id, TradeNo: "DELETED-PLUGIN-ADMIN-TOPUP",
			CreateTime: now, Status: common.TopUpStatusSuccess,
		}
		logRecord := model.Log{
			UserId: user.Id, Username: user.Username, CreatedAt: now,
			Type: model.LogTypeConsume, Quota: 30,
		}
		quotaRecord := model.QuotaData{
			UserID: user.Id, Username: user.Username, ModelName: "historical-model",
			CreatedAt: 1500, UseGroup: "default", Count: 1, Quota: 30,
		}
		require.NoError(t, db.Create(&topUp).Error)
		require.NoError(t, model.LOG_DB.Create(&logRecord).Error)
		require.NoError(t, db.Create(&quotaRecord).Error)

		response := performUserManagementRequest(
			t,
			common.RoleRootUser,
			http.MethodDelete,
			"/api/user/"+strconv.Itoa(user.Id),
			"",
			gin.Params{{Key: "id", Value: strconv.Itoa(user.Id)}},
			DeleteUser,
		)
		require.Equal(t, http.StatusOK, response.Code)
		require.Contains(t, response.Body.String(), `"success":true`)

		_, err = model.GetUserById(user.Id, false)
		require.ErrorIs(t, err, gorm.ErrRecordNotFound)
		require.ErrorIs(t, db.First(&model.User{}, user.Id).Error, gorm.ErrRecordNotFound)

		assertPluginAdminTombstoneScrubbed(t, db, user.Id, 1_700_000_000, 2)
		assertAdministrativeDeletionAuthDataPurged(t, db, user.Id)

		login = model.User{Username: originalUsername, Password: originalPassword}
		assert.ErrorIs(t, login.ValidateAndFill(), model.ErrInvalidCredentials)
		accessTokenUser, err = model.ValidateAccessToken(originalToken)
		require.NoError(t, err)
		assert.Nil(t, accessTokenUser)
		exists, err := model.CheckUserExistOrDeleted(originalUsername, originalEmail)
		require.NoError(t, err)
		assert.False(t, exists)

		_, adminTopUps := getTopUpListingAs(t, common.RoleAdminUser, "/api/user/topup?p=1&page_size=10")
		assert.Zero(t, adminTopUps.Data.Total)
		assert.Empty(t, adminTopUps.Data.Items)
		_, rootTopUps := getTopUpListingAs(t, common.RoleRootUser, "/api/user/topup?p=1&page_size=10")
		assert.Equal(t, 1, rootTopUps.Data.Total)
		assert.Equal(t, []int{topUp.Id}, listedTopUpIDs(rootTopUps.Data.Items))

		logPath := fmt.Sprintf(
			"/api/log/?start_timestamp=%d&end_timestamp=%d&p=1&page_size=10",
			now-1,
			now+1,
		)
		adminLogs := decodeUsageResponse[usageLogListingResponse](
			t,
			performUserManagementRequest(t, common.RoleAdminUser, http.MethodGet, logPath, "", nil, GetAllLogs),
		)
		assert.Zero(t, adminLogs.Data.Total)
		assert.Empty(t, adminLogs.Data.Items)
		rootLogs := decodeUsageResponse[usageLogListingResponse](
			t,
			performUserManagementRequest(t, common.RoleRootUser, http.MethodGet, logPath, "", nil, GetAllLogs),
		)
		assert.Equal(t, 1, rootLogs.Data.Total)
		require.Len(t, rootLogs.Data.Items, 1)
		assert.Equal(t, logRecord.Id, rootLogs.Data.Items[0].Id)

		const quotaPath = "/api/data/?start_timestamp=1000&end_timestamp=2000"
		adminQuota := decodeUsageResponse[usageQuotaResponse](
			t,
			performUserManagementRequest(t, common.RoleAdminUser, http.MethodGet, quotaPath, "", nil, GetAllQuotaDates),
		)
		assert.Empty(t, adminQuota.Data)
		rootQuota := decodeUsageResponse[usageQuotaResponse](
			t,
			performUserManagementRequest(t, common.RoleRootUser, http.MethodGet, quotaPath, "", nil, GetAllQuotaDates),
		)
		require.Len(t, rootQuota.Data, 1)
		assert.Equal(t, quotaRecord.Quota, rootQuota.Data[0].Quota)
	})

	t.Run("multiple plugin admins retain independent scrubbed tombstones", func(t *testing.T) {
		db := setupAdministrativeDeletionTestDB(t)
		for i := range 2 {
			createdAt := int64(1_700_001_000 + i)
			accessToken := fmt.Sprintf("plugin-admin-token-%d", i)
			accessTokenCreatedAt := createdAt + 1
			user := model.User{
				Username: fmt.Sprintf("plugin-admin-multi-%d", i), Password: "sensitive-password",
				DisplayName: "Sensitive Name", Role: common.RolePluginAdminUser,
				Status: common.UserStatusEnabled, Email: fmt.Sprintf("plugin-%d@example.com", i),
				GitHubId: fmt.Sprintf("github-%d", i), DiscordId: fmt.Sprintf("discord-%d", i),
				OidcId: fmt.Sprintf("oidc-%d", i), WeChatId: fmt.Sprintf("wechat-%d", i),
				TelegramId: fmt.Sprintf("telegram-%d", i), LinuxDOId: fmt.Sprintf("linuxdo-%d", i),
				AccessToken: &accessToken, AccessTokenCreatedAt: &accessTokenCreatedAt,
				Quota: 101, UsedQuota: 202, RequestCount: 303, Group: "sensitive-group",
				AffCode: fmt.Sprintf("plugin-admin-aff-%d", i), AffCount: 4, AffQuota: 505,
				AffHistoryQuota: 606, InviterId: 707, Setting: `{"secret":true}`,
				Remark: "sensitive remark", StripeCustomer: fmt.Sprintf("cus_sensitive_%d", i),
				CreatedAt: createdAt, LastLoginAt: createdAt + 2, AuthVersion: 1,
			}
			require.NoError(t, db.Create(&user).Error)

			response := performUserManagementRequest(
				t,
				common.RoleRootUser,
				http.MethodDelete,
				"/api/user/"+strconv.Itoa(user.Id),
				"",
				gin.Params{{Key: "id", Value: strconv.Itoa(user.Id)}},
				DeleteUser,
			)
			require.Equal(t, http.StatusOK, response.Code)
			require.Contains(t, response.Body.String(), `"success":true`)
			assertPluginAdminTombstoneScrubbed(t, db, user.Id, createdAt, 2)
		}
	})

	t.Run("common user remains physically deleted", func(t *testing.T) {
		db := setupAdministrativeDeletionTestDB(t)
		user := model.User{
			Username: "hard-deleted-common-user", Password: "password", Role: common.RoleCommonUser,
			Status: common.UserStatusEnabled, Group: "default", AuthVersion: 1, AffCode: "hard-deleted-common-user",
		}
		require.NoError(t, db.Create(&user).Error)
		seedAdministrativeDeletionAuthData(t, db, user, "hard-deleted-common-user")

		response := performUserManagementRequest(
			t,
			common.RoleAdminUser,
			http.MethodDelete,
			"/api/user/"+strconv.Itoa(user.Id),
			"",
			gin.Params{{Key: "id", Value: strconv.Itoa(user.Id)}},
			DeleteUser,
		)
		require.Equal(t, http.StatusOK, response.Code)
		require.Contains(t, response.Body.String(), `"success":true`)

		var count int64
		require.NoError(t, db.Unscoped().Model(&model.User{}).Where("id = ?", user.Id).Count(&count).Error)
		assert.Zero(t, count)
		assertAdministrativeDeletionAuthDataPurged(t, db, user.Id)
	})
}

func TestDeleteUserRechecksPromotedTargetRoleInsideTransaction(t *testing.T) {
	db := setupAdministrativeDeletionTestDB(t)
	accessToken := "stored-access-token"
	accessTokenCreatedAt := int64(1_700_001_999)
	user := model.User{
		Username: "promoted-delete-target", Password: "stored-password", DisplayName: "Stored Name",
		Role: common.RoleCommonUser, Status: common.UserStatusEnabled, Email: "stored@example.com",
		GitHubId: "stored-github", DiscordId: "stored-discord", OidcId: "stored-oidc",
		WeChatId: "stored-wechat", TelegramId: "stored-telegram", LinuxDOId: "stored-linuxdo",
		AccessToken: &accessToken, AccessTokenCreatedAt: &accessTokenCreatedAt,
		Quota: 123, UsedQuota: 45, RequestCount: 6, Group: "stored-group",
		AffCode: "promoted-delete-aff", AffCount: 7, AffQuota: 8, AffHistoryQuota: 9,
		InviterId: 10, Setting: `{"stored":true}`, Remark: "stored remark",
		StripeCustomer: "cus_stored", CreatedAt: 1_700_002_000, LastLoginAt: 1_700_002_001,
		AuthVersion: 7,
	}
	require.NoError(t, db.Create(&user).Error)
	seedAdministrativeDeletionAuthData(t, db, user, "promoted-delete-target")
	var beforePromotion model.User
	require.NoError(t, db.Unscoped().First(&beforePromotion, user.Id).Error)

	missing := performUserManagementRequest(
		t,
		common.RoleAdminUser,
		http.MethodDelete,
		"/api/user/999999",
		"",
		gin.Params{{Key: "id", Value: "999999"}},
		DeleteUser,
	)

	promoted := false
	var promotionErr error
	const callbackName = "test:promote_before_hard_delete"
	require.NoError(t, db.Callback().Query().After("gorm:query").Register(callbackName, func(tx *gorm.DB) {
		if promoted || tx.Error != nil || tx.Statement == nil || tx.Statement.Table != "users" {
			return
		}
		target, ok := tx.Statement.Dest.(*model.User)
		if !ok || target.Id != user.Id || target.Role != common.RoleCommonUser {
			return
		}
		promoted = true
		promotionErr = db.Model(&model.User{}).
			Where("id = ?", user.Id).
			Update("role", common.RolePluginAdminUser).Error
	}))
	t.Cleanup(func() {
		_ = db.Callback().Query().Remove(callbackName)
	})

	denied := performUserManagementRequest(
		t,
		common.RoleAdminUser,
		http.MethodDelete,
		"/api/user/"+strconv.Itoa(user.Id),
		"",
		gin.Params{{Key: "id", Value: strconv.Itoa(user.Id)}},
		DeleteUser,
	)

	require.True(t, promoted)
	require.NoError(t, promotionErr)
	assert.Equal(t, missing.Code, denied.Code)
	assert.Equal(t, missing.Body.String(), denied.Body.String())

	var stored model.User
	require.NoError(t, db.Unscoped().First(&stored, user.Id).Error)
	expected := beforePromotion
	expected.Role = common.RolePluginAdminUser
	assert.Equal(t, expected, stored)
	for name, record := range map[string]any{
		"external identity":    &model.ExternalIdentityClaim{},
		"2FA backup code":      &model.TwoFABackupCode{},
		"2FA":                  &model.TwoFA{},
		"auth flow":            &model.AuthFlow{},
		"passkey":              &model.PasskeyCredential{},
		"token":                &model.Token{},
		"custom OAuth binding": &model.UserOAuthBinding{},
		"session":              &model.UserSession{},
	} {
		var count int64
		require.NoError(t, db.Unscoped().Model(record).Where("user_id = ?", user.Id).Count(&count).Error)
		assert.EqualValues(t, 1, count, name)
	}
}

type adminTargetMutationChildren struct {
	externalIdentities []model.ExternalIdentityClaim
	backupCodes        []model.TwoFABackupCode
	twoFA              []model.TwoFA
	authFlows          []model.AuthFlow
	passkeys           []model.PasskeyCredential
	tokens             []model.Token
	oauthBindings      []model.UserOAuthBinding
	sessions           []model.UserSession
	authzRules         []model.CasbinRule
	logs               []model.Log
	auditLogs          []model.AuditLog
}

func loadAdminTargetMutationChildren(t *testing.T, db *gorm.DB, userID int) adminTargetMutationChildren {
	t.Helper()
	var snapshot adminTargetMutationChildren
	for records, order := range map[any]string{
		&snapshot.externalIdentities: "id",
		&snapshot.backupCodes:        "id",
		&snapshot.twoFA:              "id",
		&snapshot.authFlows:          "id",
		&snapshot.passkeys:           "id",
		&snapshot.tokens:             "id",
		&snapshot.oauthBindings:      "id",
		&snapshot.sessions:           "sid",
	} {
		require.NoError(t, db.Unscoped().Where("user_id = ?", userID).Order(order).Find(records).Error)
	}
	require.NoError(t, db.Where("v0 = ?", authz.UserSubject(userID)).Order("id").Find(&snapshot.authzRules).Error)
	require.NoError(t, db.Order("id").Find(&snapshot.logs).Error)
	require.NoError(t, db.Order("id").Find(&snapshot.auditLogs).Error)
	return snapshot
}

func TestAdminTargetMutationsReauthorizeAfterConcurrentPromotion(t *testing.T) {
	testCases := []struct {
		name        string
		initialRole int
		status      int
		invoke      func(*model.User) *httptest.ResponseRecorder
	}{
		{
			name: "update profile", initialRole: common.RoleCommonUser, status: common.UserStatusEnabled,
			invoke: func(user *model.User) *httptest.ResponseRecorder {
				body := fmt.Sprintf(
					`{"id":%d,"username":"mutated-username","display_name":"Mutated","role":%d,"status":%d,"group":"mutated-group","remark":"mutated"}`,
					user.Id, user.Role, user.Status,
				)
				return performUserManagementRequest(t, common.RoleAdminUser, http.MethodPut, "/api/user/", body, nil, UpdateUser)
			},
		},
		{
			name: "update password", initialRole: common.RoleCommonUser, status: common.UserStatusEnabled,
			invoke: func(user *model.User) *httptest.ResponseRecorder {
				body := fmt.Sprintf(
					`{"id":%d,"username":%q,"password":"replacement-password","display_name":%q,"role":%d,"status":%d,"group":%q,"remark":%q}`,
					user.Id, user.Username, user.DisplayName, user.Role, user.Status, user.Group, user.Remark,
				)
				return performUserManagementRequest(t, common.RoleAdminUser, http.MethodPut, "/api/user/", body, nil, UpdateUser)
			},
		},
		{
			name: "disable", initialRole: common.RoleCommonUser, status: common.UserStatusEnabled,
			invoke: func(user *model.User) *httptest.ResponseRecorder {
				body := fmt.Sprintf(`{"id":%d,"action":"disable"}`, user.Id)
				return performUserManagementRequest(t, common.RoleAdminUser, http.MethodPost, "/api/user/manage", body, nil, ManageUser)
			},
		},
		{
			name: "enable", initialRole: common.RoleCommonUser, status: common.UserStatusDisabled,
			invoke: func(user *model.User) *httptest.ResponseRecorder {
				body := fmt.Sprintf(`{"id":%d,"action":"enable"}`, user.Id)
				return performUserManagementRequest(t, common.RoleAdminUser, http.MethodPost, "/api/user/manage", body, nil, ManageUser)
			},
		},
		{
			name: "soft delete", initialRole: common.RoleCommonUser, status: common.UserStatusEnabled,
			invoke: func(user *model.User) *httptest.ResponseRecorder {
				body := fmt.Sprintf(`{"id":%d,"action":"delete"}`, user.Id)
				return performUserManagementRequest(t, common.RoleAdminUser, http.MethodPost, "/api/user/manage", body, nil, ManageUser)
			},
		},
		{
			name: "promote", initialRole: common.RoleCommonUser, status: common.UserStatusEnabled,
			invoke: func(user *model.User) *httptest.ResponseRecorder {
				body := fmt.Sprintf(`{"id":%d,"action":"promote"}`, user.Id)
				return performUserManagementRequest(t, common.RoleAdminUser, http.MethodPost, "/api/user/manage", body, nil, ManageUser)
			},
		},
		{
			name: "demote", initialRole: common.RoleGuestUser, status: common.UserStatusEnabled,
			invoke: func(user *model.User) *httptest.ResponseRecorder {
				body := fmt.Sprintf(`{"id":%d,"action":"demote"}`, user.Id)
				return performUserManagementRequest(t, common.RoleAdminUser, http.MethodPost, "/api/user/manage", body, nil, ManageUser)
			},
		},
		{
			name: "clear built-in OAuth binding", initialRole: common.RoleCommonUser, status: common.UserStatusEnabled,
			invoke: func(user *model.User) *httptest.ResponseRecorder {
				params := gin.Params{{Key: "id", Value: strconv.Itoa(user.Id)}, {Key: "binding_type", Value: "github"}}
				return performUserManagementRequest(t, common.RoleAdminUser, http.MethodDelete, "/api/user/1/bindings/github", "", params, AdminClearUserBinding)
			},
		},
		{
			name: "clear custom OAuth binding", initialRole: common.RoleCommonUser, status: common.UserStatusEnabled,
			invoke: func(user *model.User) *httptest.ResponseRecorder {
				params := gin.Params{{Key: "id", Value: strconv.Itoa(user.Id)}, {Key: "provider_id", Value: "1"}}
				return performUserManagementRequest(t, common.RoleAdminUser, http.MethodDelete, "/api/user/1/oauth/bindings/1", "", params, UnbindCustomOAuthByAdmin)
			},
		},
		{
			name: "disable 2FA", initialRole: common.RoleCommonUser, status: common.UserStatusEnabled,
			invoke: func(user *model.User) *httptest.ResponseRecorder {
				params := gin.Params{{Key: "id", Value: strconv.Itoa(user.Id)}}
				return performUserManagementRequest(t, common.RoleAdminUser, http.MethodDelete, "/api/user/1/2fa", "", params, AdminDisable2FA)
			},
		},
		{
			name: "reset passkey", initialRole: common.RoleCommonUser, status: common.UserStatusEnabled,
			invoke: func(user *model.User) *httptest.ResponseRecorder {
				params := gin.Params{{Key: "id", Value: strconv.Itoa(user.Id)}}
				return performUserManagementRequest(t, common.RoleAdminUser, http.MethodDelete, "/api/user/1/reset_passkey", "", params, AdminResetPasskey)
			},
		},
	}

	for index, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			db := setupAdministrativeDeletionTestDB(t)
			user := model.User{
				Username: "promotion-target", Password: "stored-password", DisplayName: "Stored Name",
				Role: tc.initialRole, Status: tc.status, Email: "stored@example.com",
				GitHubId: "stored-github", DiscordId: "stored-discord", OidcId: "stored-oidc",
				WeChatId: "stored-wechat", TelegramId: "stored-telegram", LinuxDOId: "stored-linuxdo",
				Quota: 123, UsedQuota: 45, RequestCount: 6, Group: "stored-group",
				AffCode: "concurrent-promotion-aff", AffCount: 7, AffQuota: 8, AffHistoryQuota: 9,
				InviterId: 10, Setting: `{"stored":true}`, Remark: "stored remark",
				StripeCustomer: "cus_stored", CreatedAt: 1_700_003_000, LastLoginAt: 1_700_003_001,
				AuthVersion: 7,
			}
			require.NoError(t, db.Create(&user).Error)
			if tc.initialRole == common.RoleGuestUser {
				require.NoError(t, db.Model(&model.User{}).Where("id = ?", user.Id).Update("role", common.RoleGuestUser).Error)
				user.Role = common.RoleGuestUser
			}
			seedAdministrativeDeletionAuthData(t, db, user, fmt.Sprintf("concurrent-promotion-%d", index))
			require.NoError(t, db.Create(&model.CasbinRule{
				Ptype: "p", V0: authz.UserSubject(user.Id), V1: "user", V2: "read", V3: "allow",
			}).Error)

			missingUser := user
			missingUser.Id += 1_000_000
			missing := tc.invoke(&missingUser)

			var beforeUser model.User
			require.NoError(t, db.Unscoped().First(&beforeUser, user.Id).Error)
			beforeChildren := loadAdminTargetMutationChildren(t, db, user.Id)

			promoted := false
			var promotionErr error
			var promotionRows int64
			callbackName := fmt.Sprintf("test:promote_before_admin_mutation_%d", index)
			require.NoError(t, db.Callback().Query().After("gorm:query").Register(callbackName, func(tx *gorm.DB) {
				if promoted || tx.Error != nil || tx.Statement == nil || tx.Statement.Table != "users" {
					return
				}
				target, ok := tx.Statement.Dest.(*model.User)
				if !ok || target.Id != user.Id || target.Role != tc.initialRole {
					return
				}
				promoted = true
				result := db.Model(&model.User{}).
					Where("id = ?", user.Id).
					Update("role", common.RolePluginAdminUser)
				promotionErr = result.Error
				promotionRows = result.RowsAffected
			}))
			t.Cleanup(func() {
				_ = db.Callback().Query().Remove(callbackName)
			})

			denied := tc.invoke(&user)

			require.True(t, promoted)
			require.NoError(t, promotionErr)
			require.EqualValues(t, 1, promotionRows)
			assert.Equal(t, missing.Code, denied.Code)
			assert.Equal(t, missing.Body.String(), denied.Body.String())

			var stored model.User
			require.NoError(t, db.Unscoped().First(&stored, user.Id).Error)
			expectedUser := beforeUser
			expectedUser.Role = common.RolePluginAdminUser
			assert.Equal(t, expectedUser, stored)
			assert.Equal(t, beforeChildren, loadAdminTargetMutationChildren(t, db, user.Id))
		})
	}
}

func createQuotaTestOperator(t *testing.T, db *gorm.DB, role int) model.User {
	t.Helper()
	if role == 0 {
		role = common.RoleRootUser
	}
	operator := model.User{Id: 9999, Username: "root-operator", Role: role, Status: common.UserStatusEnabled, AuthVersion: 1, AffCode: "root-operator-aff"}
	require.NoError(t, db.Create(&operator).Error)
	return operator
}

func TestManageUserQuotaRecordsTopupAndAudit(t *testing.T) {
	for _, tc := range []struct {
		name, mode, action, content string
		value, wantQuota            int
	}{
		{"add", "add", "user.quota_add", "Increased user quota by 500", 500, 1500},
		{"subtract", "subtract", "user.quota_subtract", "Decreased user quota by 500", 500, 500},
		{"override_up", "override", "user.quota_override", "Overrode user quota from 1000 to 1500", 1500, 1500},
		{"override_down", "override", "user.quota_override", "Overrode user quota from 1000 to 500", 500, 500},
		{"override_unchanged", "override", "user.quota_override", "Overrode user quota from 1000 to 1000", 1000, 1000},
		{"override_zero", "override", "user.quota_override", "Overrode user quota from 1000 to 0", 0, 0},
		{"override_negative", "override", "user.quota_override", "Overrode user quota from 1000 to -1", -1, -1},
	} {
		t.Run(tc.name, func(t *testing.T) {
			db := setupManageUserTestDB(t)
			user := model.User{Username: "quota-owner", Role: common.RoleCommonUser, Quota: 1000, AffCode: "quota-owner-aff"}
			require.NoError(t, db.Create(&user).Error)
			createQuotaTestOperator(t, db, common.RoleRootUser)

			recorder := performManageUserRequest(t, fmt.Sprintf(`{"id":%d,"action":"add_quota","mode":%q,"value":%d}`, user.Id, tc.mode, tc.value))
			assert.Equal(t, http.StatusOK, recorder.Code)
			require.Contains(t, recorder.Body.String(), `"success":true`)
			require.NoError(t, db.First(&user, user.Id).Error)
			assert.Equal(t, tc.wantQuota, user.Quota)

			logs, total, err := model.GetAllLogs(model.LogTypeTopup, 0, 0, "", "", "", 0, 20, 0, "", "", "")
			require.NoError(t, err)
			assert.EqualValues(t, 1, total)
			require.Len(t, logs, 1)
			assert.Equal(t, user.Id, logs[0].UserId)
			assert.Equal(t, user.Username, logs[0].Username)
			assert.Equal(t, tc.content, logs[0].Content)
			model.FormatAdminLogs(logs)
			var other model.AuditOther
			require.NoError(t, common.UnmarshalJsonStr(logs[0].Other, &other))
			assert.Equal(t, &model.AuditAdminInfo{AdminID: 9999, AdminUsername: "root-operator", AdminRole: common.RoleRootUser, AuthMethod: "session"}, other.AdminInfo)

			logs, total, err = model.GetUserLogs(user.Id, model.LogTypeTopup, 0, 0, "", "", 0, 20, "", "", "")
			require.NoError(t, err)
			assert.EqualValues(t, 1, total)
			require.Len(t, logs, 1)
			other = model.AuditOther{}
			require.NoError(t, common.UnmarshalJsonStr(logs[0].Other, &other))
			assert.Nil(t, other.AdminInfo)
			require.NotNil(t, other.Op)
			assert.Equal(t, tc.action, other.Op.Action)
			params, err := common.Marshal(other.Op.Params)
			require.NoError(t, err)
			expectedParams := model.AuditFields{"target_user_id": user.Id, "target_username": user.Username, "mode": tc.mode, "requested_quota": tc.value, "from": 1000, "to": tc.wantQuota}
			if tc.mode != "override" {
				expectedParams["quota"] = tc.value
			}
			expected, err := common.Marshal(expectedParams)
			require.NoError(t, err)
			assert.JSONEq(t, string(expected), string(params))
			assert.Equal(t, "quota-test-request", logs[0].RequestId)
			assert.Empty(t, logs[0].Ip, "recipient logs must not disclose the administrator IP")

			logs, total, err = model.GetUserLogs(9999, model.LogTypeTopup, 0, 0, "", "", 0, 20, "", "", "")
			require.NoError(t, err)
			assert.Zero(t, total)
			assert.Empty(t, logs)
			var audits []model.AuditLog
			require.NoError(t, model.LOG_DB.Find(&audits).Error)
			require.Len(t, audits, 1)
			assert.Equal(t, 9999, audits[0].UserId)
			assert.Equal(t, "root-operator", audits[0].Username)
			assert.Equal(t, tc.action, audits[0].Action)
			assert.True(t, audits[0].Success)
			params, err = common.Marshal(audits[0].Other.Op.Params)
			require.NoError(t, err)
			assert.JSONEq(t, string(expected), string(params))
			assert.Equal(t, "quota-test-request", audits[0].RequestId)
		})
	}
}

func TestManageUserQuotaFailuresDoNotRecordTopup(t *testing.T) {
	for _, tc := range []struct {
		name, mode string
		value      int
		failUpdate bool
	}{
		{"zero_add", "add", 0, false},
		{"negative_subtract", "subtract", -1, false},
		{"invalid_mode", "invalid", 500, false},
		{"add_update_error", "add", 500, true},
		{"subtract_update_error", "subtract", 500, true},
		{"override_update_error", "override", 500, true},
	} {
		t.Run(tc.name, func(t *testing.T) {
			db := setupManageUserTestDB(t)
			createQuotaTestOperator(t, db, common.RoleRootUser)
			user := model.User{Username: "quota-owner", Role: common.RoleCommonUser, Quota: 1000}
			require.NoError(t, db.Create(&user).Error)
			if tc.failUpdate {
				require.NoError(t, db.Callback().Update().Before("gorm:update").Register("test:fail_quota_update", func(tx *gorm.DB) {
					if tx.Statement.Table == "users" {
						tx.AddError(errors.New("quota update unavailable"))
					}
				}))
			}
			recorder := performManageUserRequest(t, fmt.Sprintf(`{"id":%d,"action":"add_quota","mode":%q,"value":%d}`, user.Id, tc.mode, tc.value))
			assert.Contains(t, recorder.Body.String(), `"success":false`)
			require.NoError(t, db.First(&user, user.Id).Error)
			assert.Equal(t, 1000, user.Quota)
			var logCount, auditCount int64
			require.NoError(t, model.LOG_DB.Model(&model.Log{}).Count(&logCount).Error)
			require.NoError(t, model.LOG_DB.Model(&model.AuditLog{}).Count(&auditCount).Error)
			assert.Zero(t, logCount)
			assert.EqualValues(t, 1, auditCount)
			var audit model.AuditLog
			require.NoError(t, model.LOG_DB.First(&audit).Error)
			assert.False(t, audit.Success)
			params, err := common.Marshal(audit.Other.Op.Params)
			require.NoError(t, err)
			assert.NotContains(t, string(params), `"from"`)
			assert.NotContains(t, string(params), `"to"`)
			assert.NotContains(t, string(params), `"target_username"`)
			assert.NotContains(t, string(params), "quota update unavailable")
			reason := "invalid_parameters"
			if tc.failUpdate {
				reason = "database_error"
			}
			assert.Contains(t, string(params), `"failure_reason":"`+reason+`"`)
			assert.Contains(t, string(params), fmt.Sprintf(`"requested_quota":%d`, tc.value))
		})
	}
}

func TestManageUserQuotaLogFailureKeepsSuccessfulAdjustment(t *testing.T) {
	for _, failedTable := range []string{"logs", "audit_logs"} {
		t.Run(failedTable, func(t *testing.T) {
			db := setupManageUserTestDB(t)
			createQuotaTestOperator(t, db, common.RoleRootUser)
			user := model.User{Username: "quota-owner", Role: common.RoleCommonUser, Quota: 1000}
			require.NoError(t, db.Create(&user).Error)
			require.NoError(t, model.LOG_DB.Callback().Create().Before("gorm:create").Register("test:fail_quota_log", func(tx *gorm.DB) {
				if tx.Statement.Table == failedTable {
					tx.AddError(errors.New("quota log unavailable"))
				}
			}))
			recorder := performManageUserRequest(t, fmt.Sprintf(`{"id":%d,"action":"add_quota","mode":"add","value":500}`, user.Id))
			assert.Contains(t, recorder.Body.String(), `"success":true`)
			require.NoError(t, db.First(&user, user.Id).Error)
			assert.Equal(t, 1500, user.Quota)
			var logCount, auditCount int64
			require.NoError(t, model.LOG_DB.Model(&model.Log{}).Count(&logCount).Error)
			require.NoError(t, model.LOG_DB.Model(&model.AuditLog{}).Count(&auditCount).Error)
			if failedTable == "logs" {
				assert.Zero(t, logCount)
				assert.EqualValues(t, 1, auditCount)
			} else {
				assert.EqualValues(t, 1, logCount)
				assert.Zero(t, auditCount)
			}
		})
	}
}

func TestManageUserQuotaTargetsAndWalletBounds(t *testing.T) {
	for _, tc := range []struct {
		name, mode, reason                                string
		before, value, targetID, targetRole, operatorRole int
		deleted, failRead                                 bool
	}{
		{name: "zero_id", mode: "add", value: 1, reason: "invalid_parameters"},
		{name: "negative_id", mode: "subtract", value: 1, targetID: -1, reason: "invalid_parameters"},
		{name: "missing", mode: "override", value: 1, targetID: 12345, reason: "target_not_found"},
		{name: "deleted", mode: "add", value: 1, targetID: 1, deleted: true, reason: "target_not_found"},
		{name: "peer_admin", mode: "add", value: 1, targetID: 1, targetRole: common.RoleAdminUser, operatorRole: common.RoleAdminUser, reason: "permission_denied"},
		{name: "higher_role", mode: "override", value: 1, targetID: 1, targetRole: common.RoleRootUser, operatorRole: common.RoleAdminUser, reason: "permission_denied"},
		{name: "read_error", mode: "add", value: 1, targetID: 1, failRead: true, reason: "database_error"},
		{name: "add_overflow", mode: "add", before: common.MaxWalletQuota, value: 1, targetID: 1, reason: "quota_limit_exceeded"},
		{name: "subtract_underflow", mode: "subtract", before: -common.MaxWalletQuota, value: 1, targetID: 1, reason: "quota_limit_exceeded"},
		{name: "oversized_add", mode: "add", value: common.MaxWalletQuota + 1, targetID: 1, reason: "quota_limit_exceeded"},
		{name: "oversized_subtract", mode: "subtract", value: common.MaxWalletQuota + 1, targetID: 1, reason: "quota_limit_exceeded"},
		{name: "oversized_override", mode: "override", value: -common.MaxWalletQuota - 1, targetID: 1, reason: "quota_limit_exceeded"},
	} {
		t.Run(tc.name, func(t *testing.T) {
			db := setupManageUserTestDB(t)
			createQuotaTestOperator(t, db, tc.operatorRole)
			user := model.User{Id: 1, Username: "private-target-name", Role: tc.targetRole, Quota: tc.before}
			require.NoError(t, db.Create(&user).Error)
			if tc.deleted {
				require.NoError(t, db.Delete(&user).Error)
			}
			if tc.failRead {
				require.NoError(t, db.Callback().Query().Before("gorm:query").Register("test:quota_read_error", func(tx *gorm.DB) {
					if tx.Statement.Table == "users" && len(tx.Statement.Selects) == 0 {
						tx.AddError(errors.New("private database error"))
					}
				}))
			}
			recorder := httptest.NewRecorder()
			c, _ := gin.CreateTestContext(recorder)
			c.Request = httptest.NewRequest(http.MethodPost, "/api/user/manage", strings.NewReader(fmt.Sprintf(`{"id":%d,"action":"add_quota","mode":%q,"value":%d}`, tc.targetID, tc.mode, tc.value)))
			role := tc.operatorRole
			if role == 0 {
				role = common.RoleRootUser
			}
			c.Set("id", 9999)
			c.Set("role", role)
			ManageUser(c)
			require.Contains(t, recorder.Body.String(), `"success":false`)
			if tc.failRead {
				require.NoError(t, db.Callback().Query().Remove("test:quota_read_error"))
			}
			require.NoError(t, db.Unscoped().First(&user, user.Id).Error)
			assert.Equal(t, tc.before, user.Quota)
			var audits []model.AuditLog
			require.NoError(t, model.LOG_DB.Find(&audits).Error)
			require.Len(t, audits, 1)
			assert.False(t, audits[0].Success)
			params, err := common.Marshal(audits[0].Other.Op.Params)
			require.NoError(t, err)
			expected, err := common.Marshal(model.AuditFields{"target_user_id": tc.targetID, "mode": tc.mode, "requested_quota": tc.value, "failure_reason": tc.reason})
			require.NoError(t, err)
			assert.JSONEq(t, string(expected), string(params))
			assert.NotContains(t, audits[0].Content, user.Username)
			var count int64
			require.NoError(t, model.LOG_DB.Model(&model.Log{}).Count(&count).Error)
			assert.Zero(t, count)
		})
	}
}

func TestManageUserQuotaMiddlewareKeepsOneOperationPerRequest(t *testing.T) {
	db := setupManageUserTestDB(t)
	pat := "quota-middleware-test-token"
	operator := model.User{Id: 9999, Username: "root-operator", Role: common.RoleRootUser, Status: common.UserStatusEnabled, AuthVersion: 1, AccessToken: &pat, Quota: 1000}
	require.NoError(t, db.Create(&operator).Error)
	router := gin.New()
	router.Use(middleware.RequestId(), middleware.AccessTokenAudit())
	router.POST("/api/user/manage", middleware.AdminAuth(), ManageUser)
	for _, tc := range []struct {
		body, action string
		success      bool
	}{
		{`{"id":9999,"action":"add_quota","mode":"add","value":100}`, "user.quota_add", true},
		{`{"id":9999,"action":"add_quota","mode":"subtract","value":0}`, "user.quota_subtract", false},
		{`{"id":9999,"action":"add_quota","mode":"invalid","value":1}`, "generic", false},
		{`{"id":`, "generic", false},
	} {
		recorder := httptest.NewRecorder()
		request := httptest.NewRequest(http.MethodPost, "/api/user/manage", strings.NewReader(tc.body))
		request.Header.Set("Authorization", "Bearer "+pat)
		request.Header.Set("Content-Type", "application/json")
		router.ServeHTTP(recorder, request)
		assert.Equal(t, http.StatusOK, recorder.Code)
		assert.Contains(t, recorder.Body.String(), fmt.Sprintf(`"success":%t`, tc.success))
		requestID := recorder.Header().Get(common.RequestIdKey)
		require.NotEmpty(t, requestID)
		var audits []model.AuditLog
		require.NoError(t, model.LOG_DB.Where("request_id = ?", requestID).Find(&audits).Error)
		require.Len(t, audits, 2, "one operation audit and one PAT request audit")
		for _, audit := range audits {
			assert.Equal(t, tc.success, audit.Success)
			if audit.Category != model.AuditCategoryOperation {
				continue
			}
			assert.Equal(t, tc.action, audit.Action)
			assert.Equal(t, operator.Id, audit.UserId)
			assert.Equal(t, "/api/user/manage", audit.Route)
			if tc.success {
				params, err := common.Marshal(audit.Other.Op.Params)
				require.NoError(t, err)
				assert.Contains(t, string(params), `"target_user_id":9999`)
				assert.Contains(t, string(params), `"target_username":"root-operator"`)
			}
		}
		var count int64
		require.NoError(t, model.LOG_DB.Model(&model.Log{}).Where("request_id = ?", requestID).Count(&count).Error)
		if tc.success {
			assert.EqualValues(t, 1, count)
		} else {
			assert.Zero(t, count)
		}
	}
	require.NoError(t, db.First(&operator, operator.Id).Error)
	assert.Equal(t, 1100, operator.Quota)
}

func TestManageUserQuotaConcurrentSnapshots(t *testing.T) {
	db := setupManageUserTestDBWithOptions(t, manageUserTestDBOptions{deferredSQLite: true})
	user := model.User{Username: "concurrent-quota", Quota: 1000}
	require.NoError(t, db.Create(&user).Error)
	barrierCtx, cancelBarrier := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancelBarrier()
	model.DB = db.WithContext(barrierCtx)
	sqliteSnapshots := common.UsingMainDatabase(common.DatabaseTypeSQLite)
	snapshotsReady := make(chan struct{}, 2)
	releaseSnapshots := make(chan struct{})
	var releaseOnce sync.Once
	release := func() {
		releaseOnce.Do(func() {
			close(releaseSnapshots)
		})
	}
	defer release()
	const callbackName = "test:concurrent_quota_snapshots"
	if sqliteSnapshots {
		require.NoError(t, db.Callback().Query().After("gorm:query").Register(callbackName, func(tx *gorm.DB) {
			snapshot, ok := tx.Statement.Dest.(*model.User)
			if tx.Statement.Table != "users" || !ok || snapshot.Id != user.Id || snapshot.Quota != 1000 {
				return
			}
			select {
			case snapshotsReady <- struct{}{}:
			case <-barrierCtx.Done():
				tx.AddError(fmt.Errorf("quota snapshot barrier: %w", barrierCtx.Err()))
				return
			}
			select {
			case <-releaseSnapshots:
			case <-barrierCtx.Done():
				tx.AddError(fmt.Errorf("quota snapshot release: %w", barrierCtx.Err()))
			}
		}))
		t.Cleanup(func() {
			require.NoError(t, db.Callback().Query().Remove(callbackName))
		})
	}
	type quotaResult struct {
		adjustment *model.UserQuotaAdjustment
		err        error
		value      int
	}
	results := make(chan quotaResult, 2)
	for _, value := range []int{10, 20} {
		go func(value int) {
			adjustment, err := model.AdjustUserQuota(user.Id, common.RoleRootUser, "add", value)
			results <- quotaResult{adjustment, err, value}
		}(value)
	}
	if sqliteSnapshots {
		for range 2 {
			select {
			case <-snapshotsReady:
			case <-barrierCtx.Done():
				t.Fatalf("both quota SELECT snapshots did not complete before either UPDATE: %v", barrierCtx.Err())
			}
		}
		release()
	}
	var committed []model.UserQuotaAdjustment
	failures := 0
	for range 2 {
		var outcome quotaResult
		select {
		case outcome = <-results:
		case <-barrierCtx.Done():
			t.Fatalf("concurrent quota adjustments did not finish: %v", barrierCtx.Err())
		}
		if outcome.err != nil {
			failures++
			require.True(t, sqliteSnapshots, "row-locking databases must serialize both adjustments: %v", outcome.err)
			assert.Contains(t, strings.ToLower(outcome.err.Error()), "locked")
			assert.Nil(t, outcome.adjustment)
			continue
		}
		require.NotNil(t, outcome.adjustment)
		assert.Equal(t, outcome.value, outcome.adjustment.After-outcome.adjustment.Before)
		committed = append(committed, *outcome.adjustment)
	}
	if sqliteSnapshots {
		require.Len(t, committed, 1, "both deferred transactions must read the same pre-update quota snapshot")
		assert.Equal(t, 1, failures)
		assert.Equal(t, 1000, committed[0].Before)
	} else {
		require.Len(t, committed, 2, "row-locking databases must serialize both adjustments")
		assert.Zero(t, failures)
	}
	sort.Slice(committed, func(i, j int) bool { return committed[i].Before < committed[j].Before })
	balance := 1000
	for _, adjustment := range committed {
		assert.Equal(t, balance, adjustment.Before)
		balance = adjustment.After
	}
	require.NoError(t, db.First(&user, user.Id).Error)
	assert.Equal(t, balance, user.Quota)
	if !sqliteSnapshots {
		assert.Equal(t, 1030, user.Quota)
	}
}

func TestManageUserQuotaCacheUsesCommittedIntegerDifference(t *testing.T) {
	for _, tc := range []struct {
		name, mode                               string
		before, cached, value, after, wantCached int
		failUpdate, failCache, missingCache      bool
	}{
		{name: "add_preserves_reservations", mode: "add", before: 1000, cached: 900, value: 500, after: 1500, wantCached: 1400},
		{name: "subtract_preserves_reservations", mode: "subtract", before: 1000, cached: 900, value: 500, after: 500, wantCached: 400},
		{name: "override_preserves_reservations", mode: "override", before: 1000, cached: 900, value: 2000, after: 2000, wantCached: 1900},
		{name: "large_odd_difference", mode: "override", before: common.MaxWalletQuota - 1, cached: common.MaxWalletQuota - 1, value: -common.MaxWalletQuota, after: -common.MaxWalletQuota, wantCached: -common.MaxWalletQuota},
		{name: "rollback_does_not_change_cache", mode: "subtract", before: 1000, cached: 900, value: 500, after: 1000, wantCached: 900, failUpdate: true},
		{name: "cache_error_keeps_committed_change", mode: "add", before: 1000, value: 500, after: 1500, failCache: true},
		{name: "missing_cache_is_not_partially_created", mode: "add", before: 1000, value: 500, after: 1500, missingCache: true},
	} {
		t.Run(tc.name, func(t *testing.T) {
			db := setupManageUserTestDB(t)
			operator := createQuotaTestOperator(t, db, common.RoleRootUser)
			server := miniredis.RunT(t)
			oldRDB := common.RDB
			common.RDB = redis.NewClient(&redis.Options{Addr: server.Addr(), MaxRetries: -1})
			common.RedisEnabled = true
			t.Cleanup(func() { _ = common.RDB.Close(); common.RDB = oldRDB })
			user := model.User{Username: "cached-quota", Quota: tc.before, AuthVersion: 1}
			require.NoError(t, db.Create(&user).Error)
			cache, err := model.GetUserCache(user.Id)
			require.NoError(t, err)
			assert.Equal(t, tc.before, cache.Quota)
			_, err = model.GetUserCache(operator.Id)
			require.NoError(t, err)
			keys := server.Keys()
			var quotaKey string
			for _, key := range keys {
				if server.HGet(key, "Id") == strconv.Itoa(user.Id) && server.HGet(key, "Quota") != "" {
					quotaKey = key
					break
				}
			}
			require.NotEmpty(t, quotaKey)
			server.HSet(quotaKey, "Quota", strconv.Itoa(tc.cached))
			if tc.missingCache {
				server.Del(quotaKey)
			}
			if tc.failCache {
				server.SetError("ERR quota cache unavailable")
			}
			if tc.failUpdate {
				require.NoError(t, db.Callback().Update().After("gorm:update").Register("test:cache_quota_rollback", func(tx *gorm.DB) {
					if tx.Statement.Table == "users" {
						tx.AddError(errors.New("quota rollback"))
					}
				}))
			}
			recorder := performManageUserRequest(t, fmt.Sprintf(`{"id":%d,"action":"add_quota","mode":%q,"value":%d}`, user.Id, tc.mode, tc.value))
			assert.Contains(t, recorder.Body.String(), fmt.Sprintf(`"success":%t`, !tc.failUpdate))
			require.NoError(t, db.First(&user, user.Id).Error)
			assert.Equal(t, tc.after, user.Quota)
			if tc.missingCache {
				// Log username lookup may hydrate the whole user after commit.
				if server.Exists(quotaKey) {
					assert.Equal(t, strconv.Itoa(user.Id), server.HGet(quotaKey, "Id"))
					assert.NotEmpty(t, server.HGet(quotaKey, "CacheSchema"))
					assert.Equal(t, strconv.Itoa(tc.after), server.HGet(quotaKey, "Quota"))
				}
			} else if !tc.failCache {
				assert.Equal(t, strconv.Itoa(tc.wantCached), server.HGet(quotaKey, "Quota"))
			}
		})
	}
}

func TestUserListingsRespectViewerRole(t *testing.T) {
	for _, tc := range []struct {
		name       string
		path       string
		handler    gin.HandlerFunc
		adminTotal int
		adminIDs   []int
		rootTotal  int
		rootIDs    []int
	}{
		{
			name:       "list",
			path:       "/api/user/?p=1&page_size=2&sort_by=id&sort_order=asc",
			handler:    GetAllUsers,
			adminTotal: 3,
			adminIDs:   []int{1, 3},
			rootTotal:  4,
			rootIDs:    []int{1, 2},
		},
		{
			name:       "search",
			path:       "/api/user/search?keyword=listing&p=1&page_size=2&sort_by=id&sort_order=asc",
			handler:    SearchUsers,
			adminTotal: 3,
			adminIDs:   []int{1, 3},
			rootTotal:  4,
			rootIDs:    []int{1, 2},
		},
		{
			name:       "search with plugin admin role filter",
			path:       "/api/user/search?keyword=listing&role=5&p=1&page_size=2&sort_by=id&sort_order=asc",
			handler:    SearchUsers,
			adminTotal: 0,
			adminIDs:   []int{},
			rootTotal:  1,
			rootIDs:    []int{2},
		},
	} {
		t.Run(tc.name, func(t *testing.T) {
			db := setupManageUserTestDB(t)
			users := []model.User{
				{Id: 1, Username: "listing-common-one", Password: "password", Role: common.RoleCommonUser, Status: common.UserStatusEnabled, Group: "default", AffCode: "listing-common-one"},
				{Id: 2, Username: "listing-plugin-admin", Password: "password", Role: common.RolePluginAdminUser, Status: common.UserStatusEnabled, Group: "default", AffCode: "listing-plugin-admin"},
				{Id: 3, Username: "listing-admin", Password: "password", Role: common.RoleAdminUser, Status: common.UserStatusEnabled, Group: "default", AffCode: "listing-admin"},
				{Id: 4, Username: "listing-common-two", Password: "password", Role: common.RoleCommonUser, Status: common.UserStatusEnabled, Group: "default", AffCode: "listing-common-two"},
			}
			require.NoError(t, db.Create(&users).Error)

			admin := decodeUserListingResponse(t, performUserManagementRequest(t, common.RoleAdminUser, http.MethodGet, tc.path, "", nil, tc.handler))
			assert.Equal(t, tc.adminTotal, admin.Data.Total)
			assert.Equal(t, tc.adminIDs, listedUserIDs(admin.Data.Items))

			root := decodeUserListingResponse(t, performUserManagementRequest(t, common.RoleRootUser, http.MethodGet, tc.path, "", nil, tc.handler))
			assert.Equal(t, tc.rootTotal, root.Data.Total)
			assert.Equal(t, tc.rootIDs, listedUserIDs(root.Data.Items))
		})
	}
}

func TestUserManagementProtectsPluginAdminAccounts(t *testing.T) {
	for _, tc := range []struct {
		name   string
		invoke func(*model.User) *httptest.ResponseRecorder
	}{
		{
			name: "read",
			invoke: func(user *model.User) *httptest.ResponseRecorder {
				return performUserManagementRequest(t, common.RoleAdminUser, http.MethodGet, "/api/user/1", "", gin.Params{{Key: "id", Value: strconv.Itoa(user.Id)}}, GetUser)
			},
		},
		{
			name: "update password",
			invoke: func(user *model.User) *httptest.ResponseRecorder {
				body := fmt.Sprintf(`{"id":%d,"username":"compromised","password":"replacement-password","display_name":"changed","role":%d,"status":%d,"group":"default"}`, user.Id, user.Role, user.Status)
				return performUserManagementRequest(t, common.RoleAdminUser, http.MethodPut, "/api/user/", body, nil, UpdateUser)
			},
		},
		{
			name: "hard delete",
			invoke: func(user *model.User) *httptest.ResponseRecorder {
				return performUserManagementRequest(t, common.RoleAdminUser, http.MethodDelete, "/api/user/1", "", gin.Params{{Key: "id", Value: strconv.Itoa(user.Id)}}, DeleteUser)
			},
		},
		{
			name: "disable",
			invoke: func(user *model.User) *httptest.ResponseRecorder {
				body := fmt.Sprintf(`{"id":%d,"action":"disable"}`, user.Id)
				return performUserManagementRequest(t, common.RoleAdminUser, http.MethodPost, "/api/user/manage", body, nil, ManageUser)
			},
		},
		{
			name: "demote",
			invoke: func(user *model.User) *httptest.ResponseRecorder {
				body := fmt.Sprintf(`{"id":%d,"action":"demote"}`, user.Id)
				return performUserManagementRequest(t, common.RoleAdminUser, http.MethodPost, "/api/user/manage", body, nil, ManageUser)
			},
		},
		{
			name: "soft delete",
			invoke: func(user *model.User) *httptest.ResponseRecorder {
				body := fmt.Sprintf(`{"id":%d,"action":"delete"}`, user.Id)
				return performUserManagementRequest(t, common.RoleAdminUser, http.MethodPost, "/api/user/manage", body, nil, ManageUser)
			},
		},
		{
			name: "adjust quota",
			invoke: func(user *model.User) *httptest.ResponseRecorder {
				body := fmt.Sprintf(`{"id":%d,"action":"add_quota","mode":"add","value":1}`, user.Id)
				return performUserManagementRequest(t, common.RoleAdminUser, http.MethodPost, "/api/user/manage", body, nil, ManageUser)
			},
		},
		{
			name: "clear built-in OAuth binding",
			invoke: func(user *model.User) *httptest.ResponseRecorder {
				params := gin.Params{{Key: "id", Value: strconv.Itoa(user.Id)}, {Key: "binding_type", Value: "github"}}
				return performUserManagementRequest(t, common.RoleAdminUser, http.MethodDelete, "/api/user/1/bindings/github", "", params, AdminClearUserBinding)
			},
		},
		{
			name: "read custom OAuth bindings",
			invoke: func(user *model.User) *httptest.ResponseRecorder {
				return performUserManagementRequest(t, common.RoleAdminUser, http.MethodGet, "/api/user/1/oauth/bindings", "", gin.Params{{Key: "id", Value: strconv.Itoa(user.Id)}}, GetUserOAuthBindingsByAdmin)
			},
		},
		{
			name: "clear custom OAuth binding",
			invoke: func(user *model.User) *httptest.ResponseRecorder {
				params := gin.Params{{Key: "id", Value: strconv.Itoa(user.Id)}, {Key: "provider_id", Value: "77"}}
				return performUserManagementRequest(t, common.RoleAdminUser, http.MethodDelete, "/api/user/1/oauth/bindings/77", "", params, UnbindCustomOAuthByAdmin)
			},
		},
		{
			name: "disable 2FA",
			invoke: func(user *model.User) *httptest.ResponseRecorder {
				return performUserManagementRequest(t, common.RoleAdminUser, http.MethodDelete, "/api/user/1/2fa", "", gin.Params{{Key: "id", Value: strconv.Itoa(user.Id)}}, AdminDisable2FA)
			},
		},
		{
			name: "reset passkey",
			invoke: func(user *model.User) *httptest.ResponseRecorder {
				return performUserManagementRequest(t, common.RoleAdminUser, http.MethodDelete, "/api/user/1/reset_passkey", "", gin.Params{{Key: "id", Value: strconv.Itoa(user.Id)}}, AdminResetPasskey)
			},
		},
	} {
		t.Run(tc.name, func(t *testing.T) {
			db := setupManageUserTestDB(t)
			require.NoError(t, db.AutoMigrate(
				&model.CustomOAuthProvider{},
				&model.UserOAuthBinding{},
				&model.ExternalIdentityClaim{},
				&model.TwoFA{},
				&model.TwoFABackupCode{},
				&model.PasskeyCredential{},
				&model.AuthFlow{},
				&model.Token{},
			))
			user := model.User{
				Username: "plugin-admin-target", Password: "stored-password", DisplayName: "plugin admin",
				Role: common.RolePluginAdminUser, Status: common.UserStatusEnabled, Group: "default",
				Quota: 123, AuthVersion: 7, GitHubId: "github-subject", AffCode: "plugin-admin-aff",
			}
			require.NoError(t, db.Create(&user).Error)
			require.NoError(t, db.Create(&model.CustomOAuthProvider{Id: 77, Name: "Plugin OAuth", Slug: "plugin-oauth"}).Error)
			require.NoError(t, db.Create(&model.UserOAuthBinding{UserId: user.Id, ProviderId: 77, ProviderUserId: "custom-subject"}).Error)
			require.NoError(t, db.Create(&model.TwoFA{UserId: user.Id, Secret: "secret", IsEnabled: true}).Error)
			require.NoError(t, db.Create(&model.PasskeyCredential{UserID: user.Id, CredentialID: "credential", PublicKey: "public-key"}).Error)

			response := tc.invoke(&user)

			assert.Equal(t, http.StatusOK, response.Code)
			require.Contains(t, response.Body.String(), `"success":false`)
			var stored model.User
			require.NoError(t, db.Unscoped().First(&stored, user.Id).Error)
			assert.False(t, stored.DeletedAt.Valid)
			assert.Equal(t, "plugin-admin-target", stored.Username)
			assert.Equal(t, "stored-password", stored.Password)
			assert.Equal(t, common.RolePluginAdminUser, stored.Role)
			assert.Equal(t, common.UserStatusEnabled, stored.Status)
			assert.Equal(t, 123, stored.Quota)
			assert.Equal(t, "github-subject", stored.GitHubId)
			assert.EqualValues(t, 7, stored.AuthVersion)
			for table, record := range map[string]any{
				"custom OAuth binding": &model.UserOAuthBinding{},
				"2FA":                  &model.TwoFA{},
				"passkey":              &model.PasskeyCredential{},
			} {
				var count int64
				require.NoError(t, db.Unscoped().Model(record).Where("user_id = ?", user.Id).Count(&count).Error)
				assert.EqualValues(t, 1, count, table)
			}
		})
	}
}

func TestUserManagementHidesPluginAdminExistence(t *testing.T) {
	for _, tc := range []struct {
		name   string
		invoke func(int) *httptest.ResponseRecorder
	}{
		{
			name: "read",
			invoke: func(id int) *httptest.ResponseRecorder {
				return performUserManagementRequest(t, common.RoleAdminUser, http.MethodGet, "/api/user/1", "", gin.Params{{Key: "id", Value: strconv.Itoa(id)}}, GetUser)
			},
		},
		{
			name: "update password",
			invoke: func(id int) *httptest.ResponseRecorder {
				body := fmt.Sprintf(`{"id":%d,"username":"compromised","password":"replacement-password","display_name":"changed","role":%d,"status":%d,"group":"default"}`, id, common.RolePluginAdminUser, common.UserStatusEnabled)
				return performUserManagementRequest(t, common.RoleAdminUser, http.MethodPut, "/api/user/", body, nil, UpdateUser)
			},
		},
		{
			name: "hard delete",
			invoke: func(id int) *httptest.ResponseRecorder {
				return performUserManagementRequest(t, common.RoleAdminUser, http.MethodDelete, "/api/user/1", "", gin.Params{{Key: "id", Value: strconv.Itoa(id)}}, DeleteUser)
			},
		},
		{
			name: "disable",
			invoke: func(id int) *httptest.ResponseRecorder {
				body := fmt.Sprintf(`{"id":%d,"action":"disable"}`, id)
				return performUserManagementRequest(t, common.RoleAdminUser, http.MethodPost, "/api/user/manage", body, nil, ManageUser)
			},
		},
		{
			name: "enable",
			invoke: func(id int) *httptest.ResponseRecorder {
				body := fmt.Sprintf(`{"id":%d,"action":"enable"}`, id)
				return performUserManagementRequest(t, common.RoleAdminUser, http.MethodPost, "/api/user/manage", body, nil, ManageUser)
			},
		},
		{
			name: "promote",
			invoke: func(id int) *httptest.ResponseRecorder {
				body := fmt.Sprintf(`{"id":%d,"action":"promote"}`, id)
				return performUserManagementRequest(t, common.RoleAdminUser, http.MethodPost, "/api/user/manage", body, nil, ManageUser)
			},
		},
		{
			name: "demote",
			invoke: func(id int) *httptest.ResponseRecorder {
				body := fmt.Sprintf(`{"id":%d,"action":"demote"}`, id)
				return performUserManagementRequest(t, common.RoleAdminUser, http.MethodPost, "/api/user/manage", body, nil, ManageUser)
			},
		},
		{
			name: "soft delete",
			invoke: func(id int) *httptest.ResponseRecorder {
				body := fmt.Sprintf(`{"id":%d,"action":"delete"}`, id)
				return performUserManagementRequest(t, common.RoleAdminUser, http.MethodPost, "/api/user/manage", body, nil, ManageUser)
			},
		},
		{
			name: "adjust quota",
			invoke: func(id int) *httptest.ResponseRecorder {
				body := fmt.Sprintf(`{"id":%d,"action":"add_quota","mode":"add","value":1}`, id)
				return performUserManagementRequest(t, common.RoleAdminUser, http.MethodPost, "/api/user/manage", body, nil, ManageUser)
			},
		},
		{
			name: "clear built-in OAuth binding",
			invoke: func(id int) *httptest.ResponseRecorder {
				params := gin.Params{{Key: "id", Value: strconv.Itoa(id)}, {Key: "binding_type", Value: "github"}}
				return performUserManagementRequest(t, common.RoleAdminUser, http.MethodDelete, "/api/user/1/bindings/github", "", params, AdminClearUserBinding)
			},
		},
		{
			name: "read custom OAuth bindings",
			invoke: func(id int) *httptest.ResponseRecorder {
				return performUserManagementRequest(t, common.RoleAdminUser, http.MethodGet, "/api/user/1/oauth/bindings", "", gin.Params{{Key: "id", Value: strconv.Itoa(id)}}, GetUserOAuthBindingsByAdmin)
			},
		},
		{
			name: "clear custom OAuth binding",
			invoke: func(id int) *httptest.ResponseRecorder {
				params := gin.Params{{Key: "id", Value: strconv.Itoa(id)}, {Key: "provider_id", Value: "77"}}
				return performUserManagementRequest(t, common.RoleAdminUser, http.MethodDelete, "/api/user/1/oauth/bindings/77", "", params, UnbindCustomOAuthByAdmin)
			},
		},
		{
			name: "disable 2FA",
			invoke: func(id int) *httptest.ResponseRecorder {
				return performUserManagementRequest(t, common.RoleAdminUser, http.MethodDelete, "/api/user/1/2fa", "", gin.Params{{Key: "id", Value: strconv.Itoa(id)}}, AdminDisable2FA)
			},
		},
		{
			name: "reset passkey",
			invoke: func(id int) *httptest.ResponseRecorder {
				return performUserManagementRequest(t, common.RoleAdminUser, http.MethodDelete, "/api/user/1/reset_passkey", "", gin.Params{{Key: "id", Value: strconv.Itoa(id)}}, AdminResetPasskey)
			},
		},
	} {
		t.Run(tc.name, func(t *testing.T) {
			db := setupManageUserTestDB(t)
			require.NoError(t, db.AutoMigrate(
				&model.CustomOAuthProvider{},
				&model.UserOAuthBinding{},
				&model.ExternalIdentityClaim{},
				&model.TwoFA{},
				&model.TwoFABackupCode{},
				&model.PasskeyCredential{},
				&model.AuthFlow{},
				&model.Token{},
			))
			user := model.User{
				Username: "hidden-plugin-admin-target", Password: "stored-password",
				Role: common.RolePluginAdminUser, Status: common.UserStatusEnabled,
				Group: "default", AffCode: "hidden-plugin-admin-aff",
			}
			require.NoError(t, db.Create(&user).Error)

			protected := tc.invoke(user.Id)
			missing := tc.invoke(user.Id + 1_000_000)

			require.Equal(t, http.StatusOK, protected.Code)
			assert.Equal(t, protected.Code, missing.Code)
			assert.Equal(t, protected.Body.String(), missing.Body.String())
			assert.JSONEq(t, fmt.Sprintf(
				`{"success":false,"message":%q}`,
				i18n.Translate(i18n.DefaultLang, i18n.MsgUserNotExists),
			), protected.Body.String())
		})
	}
}

func TestUserManagementRolePolicy(t *testing.T) {
	t.Run("admin cannot create plugin admin", func(t *testing.T) {
		db := setupManageUserTestDB(t)
		response := performUserManagementRequest(t, common.RoleAdminUser, http.MethodPost, "/api/user/", `{"username":"admin-created-plugin","password":"plugin-password","role":5}`, nil, CreateUser)
		require.Contains(t, response.Body.String(), `"success":false`)
		var count int64
		require.NoError(t, db.Model(&model.User{}).Where("username = ?", "admin-created-plugin").Count(&count).Error)
		assert.Zero(t, count)
	})

	t.Run("root creates and manages plugin admin", func(t *testing.T) {
		db := setupManageUserTestDB(t)
		previousMaster := common.IsMasterNode
		common.IsMasterNode = false
		t.Cleanup(func() { common.IsMasterNode = previousMaster })
		require.NoError(t, authz.Init(db))

		response := performUserManagementRequest(t, common.RoleRootUser, http.MethodPost, "/api/user/", `{"username":"root-created-plugin","password":"plugin-password","role":5}`, nil, CreateUser)
		require.Contains(t, response.Body.String(), `"success":true`)
		var user model.User
		require.NoError(t, db.First(&user, "username = ?", "root-created-plugin").Error)
		assert.Equal(t, common.RolePluginAdminUser, user.Role)

		response = performUserManagementRequest(t, common.RoleRootUser, http.MethodGet, "/api/user/1", "", gin.Params{{Key: "id", Value: strconv.Itoa(user.Id)}}, GetUser)
		require.Contains(t, response.Body.String(), `"success":true`)
		response = performUserManagementRequest(t, common.RoleRootUser, http.MethodPost, "/api/user/manage", fmt.Sprintf(`{"id":%d,"action":"disable"}`, user.Id), nil, ManageUser)
		require.Contains(t, response.Body.String(), `"success":true`)
		require.NoError(t, db.First(&user, user.Id).Error)
		assert.Equal(t, common.UserStatusDisabled, user.Status)

		response = performUserManagementRequest(t, common.RoleRootUser, http.MethodPost, "/api/user/", `{"username":"second-root","password":"root-password","role":100}`, nil, CreateUser)
		require.Contains(t, response.Body.String(), `"success":false`)
		var rootCount int64
		require.NoError(t, db.Model(&model.User{}).Where("username = ?", "second-root").Count(&rootCount).Error)
		assert.Zero(t, rootCount)
	})

	t.Run("admin creates and manages common user", func(t *testing.T) {
		db := setupManageUserTestDB(t)
		response := performUserManagementRequest(t, common.RoleAdminUser, http.MethodPost, "/api/user/", `{"username":"admin-created-common","password":"common-password","role":1}`, nil, CreateUser)
		require.Contains(t, response.Body.String(), `"success":true`)
		var user model.User
		require.NoError(t, db.First(&user, "username = ?", "admin-created-common").Error)
		assert.Equal(t, common.RoleCommonUser, user.Role)

		response = performUserManagementRequest(t, common.RoleAdminUser, http.MethodGet, "/api/user/1", "", gin.Params{{Key: "id", Value: strconv.Itoa(user.Id)}}, GetUser)
		require.Contains(t, response.Body.String(), `"success":true`)
		body := fmt.Sprintf(`{"id":%d,"username":"admin-updated-common","password":"updated-password","role":%d,"status":%d,"group":"default"}`, user.Id, user.Role, user.Status)
		response = performUserManagementRequest(t, common.RoleAdminUser, http.MethodPut, "/api/user/", body, nil, UpdateUser)
		require.Contains(t, response.Body.String(), `"success":true`)
		require.NoError(t, db.First(&user, user.Id).Error)
		assert.Equal(t, "admin-updated-common", user.Username)
		assert.True(t, common.ValidatePasswordAndHash("updated-password", user.Password))

		response = performUserManagementRequest(t, common.RoleAdminUser, http.MethodPost, "/api/user/manage", fmt.Sprintf(`{"id":%d,"action":"disable"}`, user.Id), nil, ManageUser)
		require.Contains(t, response.Body.String(), `"success":true`)
		require.NoError(t, db.First(&user, user.Id).Error)
		assert.Equal(t, common.UserStatusDisabled, user.Status)
	})
}
