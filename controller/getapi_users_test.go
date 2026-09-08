package controller

import (
	"fmt"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/middleware"
	"github.com/QuantumNous/new-api/model"
	"github.com/gin-gonic/gin"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/driver/mysql"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

func TestGetAPIProvisionAndManagedLifecycle(t *testing.T) {
	principal, token := setupAccessTokenAudit(t)
	require.NoError(t, model.DB.AutoMigrate(&model.GetAPIUserBinding{}))
	t.Setenv("GETAPI_FINGERPRINT_KEY", strings.Repeat("k", 32))
	config, err := common.Marshal([]map[string]interface{}{{"integration_id": "test", "principal_user_id": principal.Id, "capabilities": []string{"getapi.users.provision", "getapi.users.read-current"}}})
	require.NoError(t, err)
	t.Setenv("GETAPI_INTEGRATIONS", string(config))
	router := gin.New()
	router.POST("/api/getapi/users", middleware.GetAPIAuth("getapi.users.provision"), ProvisionGetAPIUser)
	router.GET("/api/getapi/users/:external_account_id/credential", middleware.GetAPIAuth("getapi.users.read-current"), GetGetAPIUserCredential)
	request := func(method, path, body, key string) *httptest.ResponseRecorder {
		req := httptest.NewRequest(method, path, strings.NewReader(body))
		req.Header.Set("Authorization", "Bearer "+token)
		req.Header.Set("Idempotency-Key", key)
		rec := httptest.NewRecorder()
		router.ServeHTTP(rec, req)
		assert.Equal(t, "no-store", rec.Header().Get("Cache-Control"))
		return rec
	}
	body := `{"external_account_id":"account-1","username":"managed","password":"safe-password","display_name":"Managed"}`
	created := request(http.MethodPost, "/api/getapi/users", body, "account-1")
	require.Equal(t, http.StatusCreated, created.Code, created.Body.String())
	var result struct {
		Data model.GetAPICredential `json:"data"`
	}
	require.NoError(t, common.Unmarshal(created.Body.Bytes(), &result))
	require.Positive(t, result.Data.UserID)
	require.NotNil(t, result.Data.AccessToken)
	old := *result.Data.AccessToken
	again := request(http.MethodPost, "/api/getapi/users", body, "account-1")
	assert.Equal(t, http.StatusOK, again.Code)
	assert.JSONEq(t, created.Body.String(), again.Body.String())
	conflict := request(http.MethodPost, "/api/getapi/users", strings.Replace(body, "Managed", "Changed", 1), "account-1")
	assert.Equal(t, http.StatusConflict, conflict.Code)
	assert.Contains(t, conflict.Body.String(), "GETAPI_CREATE_CONFLICT")
	invalid := request(http.MethodPost, "/api/getapi/users", strings.TrimSuffix(body, "}")+`,"role":100}`, "account-1")
	assert.Equal(t, http.StatusBadRequest, invalid.Code)
	user := model.User{Id: result.Data.UserID, Status: common.UserStatusDisabled}
	require.NoError(t, user.Update(false))
	blocked := request(http.MethodGet, "/api/getapi/users/account-1/credential", "", "")
	assert.Equal(t, http.StatusOK, blocked.Code)
	assert.Contains(t, blocked.Body.String(), `"access_token":null`)
	require.NoError(t, model.UpdateUserAccessToken(user.Id, "orphan-token"))
	require.NoError(t, user.Update(false))
	require.NoError(t, model.DB.First(&user, user.Id).Error)
	assert.Nil(t, user.AccessToken)
	user.Status = common.UserStatusEnabled
	require.NoError(t, user.Update(false))
	require.NotNil(t, user.AccessToken)
	assert.NotEqual(t, old, *user.AccessToken)
	fresh := *user.AccessToken
	require.NoError(t, user.Update(false))
	assert.Equal(t, fresh, *user.AccessToken)
	obsolete, err := model.ValidateAccessToken(old)
	require.NoError(t, err)
	assert.Nil(t, obsolete)
	require.NoError(t, model.DB.Model(&user).Update("access_token", nil).Error)
	require.NoError(t, user.Update(false))
	missing := request(http.MethodGet, "/api/getapi/users/account-1/credential", "", "")
	assert.Equal(t, http.StatusConflict, missing.Code)
	assert.Contains(t, missing.Body.String(), "GETAPI_PAT_MISSING")
	t.Setenv("GETAPI_INTEGRATIONS", "")
	denied := request(http.MethodGet, "/api/getapi/users/account-1/credential", "", "")
	assert.Equal(t, http.StatusForbidden, denied.Code)
	assert.Contains(t, denied.Body.String(), "GETAPI_CAPABILITY_DENIED")
}

func TestGetAPIRealDatabaseMatrix(t *testing.T) {
	for _, dialect := range []string{"sqlite", "mysql", "postgres"} {
		t.Run(dialect, func(t *testing.T) {
			var dialector gorm.Dialector
			switch dialect {
			case "sqlite":
				dialector = sqlite.Open(filepath.Join(t.TempDir(), "pat.db") + "?_pragma=busy_timeout(5000)")
			case "mysql":
				dsn := os.Getenv("GETAPI_TEST_MYSQL_DSN")
				if dsn == "" {
					t.Skip("isolated GETAPI_TEST_MYSQL_DSN not configured")
				}
				dialector = mysql.Open(dsn)
			case "postgres":
				dsn := os.Getenv("GETAPI_TEST_POSTGRES_DSN")
				if dsn == "" {
					t.Skip("isolated GETAPI_TEST_POSTGRES_DSN not configured")
				}
				dialector = postgres.Open(dsn)
			}
			db, err := gorm.Open(dialector, &gorm.Config{Logger: logger.Default.LogMode(logger.Silent)})
			require.NoError(t, err)
			sqlDB, err := db.DB()
			require.NoError(t, err)
			t.Cleanup(func() { require.NoError(t, sqlDB.Close()) })
			previousDB, previousLog := model.DB, model.LOG_DB
			previousMain, previousLogType := common.MainDatabaseType(), common.LogDatabaseType()
			model.DB, model.LOG_DB = db, db
			previousRedis := common.RedisEnabled
			common.RedisEnabled = false
			t.Cleanup(func() { common.RedisEnabled = previousRedis })
			databaseType := common.DatabaseType(dialect)
			common.SetDatabaseTypes(databaseType, databaseType)
			t.Cleanup(func() {
				model.DB, model.LOG_DB = previousDB, previousLog
				common.SetDatabaseTypes(previousMain, previousLogType)
			})
			require.NoError(t, db.AutoMigrate(&model.User{}, &model.UserSession{}, &model.Log{}, &model.AuditLog{}))
			legacyToken := "legacy-" + dialect
			legacy := model.User{Username: "legacy-" + dialect, Password: "placeholder", AccessToken: &legacyToken, Role: common.RoleCommonUser, Status: common.UserStatusEnabled, AffCode: "legacy-" + dialect}
			require.NoError(t, db.Create(&legacy).Error)
			t.Cleanup(func() {
				db.Where("integration_id = ?", "matrix").Delete(&model.GetAPIUserBinding{})
				db.Unscoped().Where("username IN ?", []string{legacy.Username, "matrix-" + dialect, "race-" + dialect}).Delete(&model.User{})
			})
			for range 2 {
				require.NoError(t, db.AutoMigrate(&model.User{}, &model.GetAPIUserBinding{}))
			}
			require.NoError(t, db.First(&legacy, legacy.Id).Error)
			require.NotNil(t, legacy.AccessToken)
			assert.Equal(t, legacyToken, strings.TrimRight(*legacy.AccessToken, " "))
			t.Setenv("GETAPI_FINGERPRINT_KEY", strings.Repeat("k", 32))
			request := model.GetAPICreateUserRequest{ExternalAccountID: "matrix-" + dialect, Username: "matrix-" + dialect, Password: "safe-password", DisplayName: "Matrix"}
			const workers = 2
			results := make([]*model.GetAPICredential, workers)
			errs := make([]error, workers)
			created := make([]bool, workers)
			start := make(chan struct{})
			var group sync.WaitGroup
			for i := range workers {
				group.Add(1)
				go func() {
					defer group.Done()
					<-start
					results[i], created[i], errs[i] = model.ProvisionGetAPIUser("matrix", common.RoleAdminUser, request)
				}()
			}
			close(start)
			group.Wait()
			for _, err := range errs {
				require.NoError(t, err)
			}
			assert.NotEqual(t, created[0], created[1])
			assert.Equal(t, results[0], results[1])
			require.NotNil(t, results[0].AccessToken)
			original := *results[0].AccessToken
			var bindingCount, userCount int64
			require.NoError(t, db.Model(&model.GetAPIUserBinding{}).Count(&bindingCount).Error)
			require.NoError(t, db.Model(&model.User{}).Where("username = ?", request.Username).Count(&userCount).Error)
			assert.EqualValues(t, 1, bindingCount)
			assert.EqualValues(t, 1, userCount)

			raceResults := make([]error, 2)
			raceStart := make(chan struct{})
			var raceGroup sync.WaitGroup
			for i := range 2 {
				raceGroup.Add(1)
				go func() {
					defer raceGroup.Done()
					<-raceStart
					attempt := request
					attempt.Username = "race-" + dialect
					attempt.ExternalAccountID = fmt.Sprintf("race-%s-%d", dialect, i)
					_, _, raceResults[i] = model.ProvisionGetAPIUser("matrix", common.RoleAdminUser, attempt)
				}()
			}
			close(raceStart)
			raceGroup.Wait()
			if raceResults[0] == nil {
				assert.ErrorIs(t, raceResults[1], model.ErrGetAPIBindingConflict)
			} else {
				assert.ErrorIs(t, raceResults[0], model.ErrGetAPIBindingConflict)
				assert.NoError(t, raceResults[1])
			}
			changed := request
			changed.Password = "different-password"
			_, _, err = model.ProvisionGetAPIUser("matrix", common.RoleAdminUser, changed)
			assert.ErrorIs(t, err, model.ErrGetAPICreateConflict)
			collision := request
			collision.ExternalAccountID = "collision"
			collision.Username = legacy.Username
			_, _, err = model.ProvisionGetAPIUser("matrix", common.RoleAdminUser, collision)
			assert.ErrorIs(t, err, model.ErrGetAPIBindingConflict)
			_, err = model.ReadGetAPICredential("matrix", "collision", common.RoleAdminUser)
			assert.ErrorIs(t, err, model.ErrGetAPIAccountNotFound)
			_, err = model.ReadGetAPICredential("other", request.ExternalAccountID, common.RoleAdminUser)
			assert.ErrorIs(t, err, model.ErrGetAPIAccountNotFound)
			user := model.User{Id: results[0].UserID, Status: common.UserStatusDisabled}
			require.NoError(t, user.Update(false))
			assert.Nil(t, user.AccessToken)
			state, err := model.ReadGetAPICredential("matrix", request.ExternalAccountID, common.RoleAdminUser)
			require.NoError(t, err)
			assert.Equal(t, "blocked", state.State)
			assert.Nil(t, state.AccessToken)
			_, _, err = model.ProvisionGetAPIUser("matrix", common.RoleAdminUser, request)
			require.NoError(t, err)
			user.Status = common.UserStatusEnabled
			require.NoError(t, user.Update(false))
			require.NotNil(t, user.AccessToken)
			assert.NotEqual(t, original, *user.AccessToken)
			second, err := gorm.Open(dialector, &gorm.Config{Logger: logger.Default.LogMode(logger.Silent)})
			require.NoError(t, err)
			secondSQL, err := second.DB()
			require.NoError(t, err)
			defer secondSQL.Close()
			var oldCount int64
			require.NoError(t, second.Model(&model.User{}).Where("access_token = ?", original).Count(&oldCount).Error)
			assert.Zero(t, oldCount)
			legacy.Status = common.UserStatusDisabled
			require.NoError(t, legacy.Update(false))
			require.NotNil(t, legacy.AccessToken)
			assert.Equal(t, legacyToken, strings.TrimRight(*legacy.AccessToken, " "))
			require.NoError(t, db.Model(&user).Update("role", common.RoleAdminUser).Error)
			_, err = model.ReadGetAPICredential("matrix", request.ExternalAccountID, common.RoleRootUser)
			assert.ErrorIs(t, err, model.ErrGetAPICapabilityDenied)
			t.Logf("verified %s migrations, concurrent create, binding conflicts, managed lifecycle, separate connection rejection", dialect)
		})
	}
}

func TestGetAPIRejectsUnauthorizedAndMalformedRequests(t *testing.T) {
	principal, token := setupAccessTokenAudit(t)
	require.NoError(t, model.DB.AutoMigrate(&model.GetAPIUserBinding{}))
	t.Setenv("GETAPI_FINGERPRINT_KEY", strings.Repeat("k", 32))
	config := fmt.Sprintf(`[{"integration_id":"owned","principal_user_id":%d,"capabilities":["getapi.users.provision","getapi.users.read-current"]}]`, principal.Id)
	router := gin.New()
	router.POST("/api/getapi/users", middleware.GetAPIAuth("getapi.users.provision"), ProvisionGetAPIUser)
	router.GET("/api/getapi/users/:external_account_id/credential", middleware.GetAPIAuth("getapi.users.read-current"), GetGetAPIUserCredential)
	body := `{"external_account_id":"authz","username":"authz","password":"safe-password","display_name":""}`
	for _, test := range []struct {
		name, auth, config, body, key string
		status                        int
		code                          string
	}{
		{"anonymous", "", config, body, "authz", 401, "AUTH_UNAUTHORIZED"},
		{"bad-token", "invalid", config, body, "authz", 401, "AUTH_UNAUTHORIZED"},
		{"unassigned", token, "[]", body, "authz", 403, "GETAPI_CAPABILITY_DENIED"},
		{"invalid-config", token, `[{"integration_id":"x"}]`, body, "authz", 403, "GETAPI_CAPABILITY_DENIED"},
		{"unknown-config-field", token, strings.Replace(config, `"integration_id"`, `"extra":true,"integration_id"`, 1), body, "authz", 403, "GETAPI_CAPABILITY_DENIED"},
		{"ambiguous-principal", token, strings.TrimSuffix(config, "]") + "," + strings.TrimPrefix(config, "["), body, "authz", 403, "GETAPI_CAPABILITY_DENIED"},
		{"wrong-key", token, config, body, "different", 400, "GETAPI_INVALID_REQUEST"},
		{"missing-field", token, config, `{"external_account_id":"authz","username":"authz","password":"safe-password"}`, "authz", 400, "GETAPI_INVALID_REQUEST"},
		{"null-field", token, config, strings.Replace(body, `"display_name":""`, `"display_name":null`, 1), "authz", 400, "GETAPI_INVALID_REQUEST"},
		{"extra-field", token, config, strings.TrimSuffix(body, "}") + `,"access_token":"forbidden"}`, "authz", 400, "GETAPI_INVALID_REQUEST"},
		{"trailing-json", token, config, body + "{}", "authz", 400, "GETAPI_INVALID_REQUEST"},
	} {
		t.Run(test.name, func(t *testing.T) {
			t.Setenv("GETAPI_INTEGRATIONS", test.config)
			req := httptest.NewRequest(http.MethodPost, "/api/getapi/users", strings.NewReader(test.body))
			req.Header.Set("Authorization", "Bearer "+test.auth)
			req.Header.Set("Idempotency-Key", test.key)
			rec := httptest.NewRecorder()
			router.ServeHTTP(rec, req)
			assert.Equal(t, test.status, rec.Code)
			assert.Contains(t, rec.Body.String(), test.code)
			assert.NotContains(t, rec.Body.String(), "safe-password")
			assert.NotContains(t, rec.Body.String(), token)
			assert.Equal(t, "no-store", rec.Header().Get("Cache-Control"))
		})
	}
	var logs []model.AuditLog
	require.NoError(t, model.LOG_DB.Find(&logs).Error)
	assert.NotEmpty(t, logs)
	encoded, err := common.Marshal(logs)
	require.NoError(t, err)
	assert.NotContains(t, string(encoded), "safe-password")
	assert.NotContains(t, string(encoded), token)
}

func TestGetAPINativeManagementRevokesAcrossAuthenticationRouters(t *testing.T) {
	principal, adminToken := setupAccessTokenAudit(t)
	require.NoError(t, model.DB.AutoMigrate(&model.GetAPIUserBinding{}))
	t.Setenv("GETAPI_FINGERPRINT_KEY", strings.Repeat("k", 32))
	result, _, err := model.ProvisionGetAPIUser("native", principal.Role, model.GetAPICreateUserRequest{ExternalAccountID: "native", Username: "native", Password: "safe-password"})
	require.NoError(t, err)
	require.NotNil(t, result.AccessToken)
	old := *result.AccessToken
	rootToken := "root-native-test-token"
	root := model.User{Username: "root-native", Password: "placeholder", Role: common.RoleRootUser, Status: common.UserStatusEnabled, AccessToken: &rootToken, AffCode: "root-native"}
	require.NoError(t, model.DB.Create(&root).Error)
	first := gin.New()
	first.POST("/api/user/manage", middleware.AdminAuth(), ManageUser)
	second := gin.New()
	second.GET("/probe", middleware.UserAuth(), func(c *gin.Context) { c.JSON(http.StatusOK, gin.H{"success": true}) })
	manage := func(action, token string) {
		body, err := common.Marshal(ManageRequest{Id: result.UserID, Action: action})
		require.NoError(t, err)
		request := httptest.NewRequest(http.MethodPost, "/api/user/manage", strings.NewReader(string(body)))
		request.Header.Set("Authorization", "Bearer "+token)
		response := httptest.NewRecorder()
		first.ServeHTTP(response, request)
		require.Equal(t, http.StatusOK, response.Code, response.Body.String())
		assert.NotContains(t, response.Body.String(), old)
	}
	probe := func(token string, status int) {
		request := httptest.NewRequest(http.MethodGet, "/probe", nil)
		request.Header.Set("Authorization", "Bearer "+token)
		response := httptest.NewRecorder()
		second.ServeHTTP(response, request)
		assert.Equal(t, status, response.Code)
	}
	probe(old, http.StatusOK)
	manage("disable", adminToken)
	probe(old, http.StatusUnauthorized)
	manage("enable", rootToken)
	probe(old, http.StatusUnauthorized)
	current, err := model.ReadGetAPICredential("native", "native", principal.Role)
	require.NoError(t, err)
	require.NotNil(t, current.AccessToken)
	assert.NotEqual(t, old, *current.AccessToken)
	probe(*current.AccessToken, http.StatusOK)
	manage("enable", adminToken)
	unchanged, err := model.ReadGetAPICredential("native", "native", principal.Role)
	require.NoError(t, err)
	assert.Equal(t, *current.AccessToken, *unchanged.AccessToken)
}
