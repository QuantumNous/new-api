package controller

import (
	"net/http"
	"net/http/httptest"
	"os"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

type selfLogFilterDatabase struct {
	name  string
	dsn   string
	type_ common.DatabaseType
}

func setupSelfLogTokenFilterTest(t *testing.T, database selfLogFilterDatabase) *gorm.DB {
	t.Helper()
	gin.SetMode(gin.TestMode)
	previousDB, previousLogDB := model.DB, model.LOG_DB
	previousMainDatabaseType := common.MainDatabaseType()
	previousLogDatabaseType := common.LogDatabaseType()
	previousRedisEnabled := common.RedisEnabled
	db, _ := newAuditTestDatabase(t, database.name, database.dsn)
	require.NoError(t, db.AutoMigrate(&model.User{}, &model.Token{}, &model.Log{}))
	model.DB, model.LOG_DB = db, db
	common.SetDatabaseTypes(database.type_, database.type_)
	common.RedisEnabled = false
	t.Cleanup(func() {
		model.DB, model.LOG_DB = previousDB, previousLogDB
		common.SetDatabaseTypes(previousMainDatabaseType, previousLogDatabaseType)
		common.RedisEnabled = previousRedisEnabled
	})
	return db
}

func selfLogFilterDatabases(t *testing.T) []selfLogFilterDatabase {
	t.Helper()
	databases := []selfLogFilterDatabase{{name: "sqlite", type_: common.DatabaseTypeSQLite}}
	for _, database := range []struct {
		name  string
		env   string
		type_ common.DatabaseType
	}{
		{name: "postgres", env: "TEST_POSTGRES_DSN", type_: common.DatabaseTypePostgreSQL},
		{name: "mysql", env: "TEST_MYSQL_DSN", type_: common.DatabaseTypeMySQL},
	} {
		if dsn := os.Getenv(database.env); dsn != "" {
			databases = append(databases, selfLogFilterDatabase{name: database.name, dsn: dsn, type_: database.type_})
		}
	}
	return databases
}

func seedSelfLogTokenFilterData(t *testing.T, db *gorm.DB) {
	t.Helper()
	require.NoError(t, db.Create(&model.User{Id: 1, Username: "owner", Password: "Password12", Group: "default", AffCode: "owner"}).Error)
	require.NoError(t, db.Create(&model.User{Id: 2, Username: "other", Password: "Password12", Group: "default", AffCode: "other"}).Error)
	for _, token := range []*model.Token{
		{Id: 11, UserId: 1, Name: "duplicate", Key: "owner-token-a", Status: common.TokenStatusEnabled, ExpiredTime: -1},
		{Id: 12, UserId: 1, Name: "duplicate", Key: "owner-token-unused", Status: common.TokenStatusEnabled, ExpiredTime: -1},
		{Id: 13, UserId: 1, Name: "renamed", Key: "owner-token-renamed", Status: common.TokenStatusEnabled, ExpiredTime: -1},
		{Id: 21, UserId: 2, Name: "duplicate", Key: "other-token", Status: common.TokenStatusEnabled, ExpiredTime: -1},
	} {
		require.NoError(t, db.Create(token).Error)
	}
	for _, log := range []*model.Log{
		{UserId: 1, TokenId: 11, TokenName: "duplicate", ModelName: "alpha", CreatedAt: 100},
		{UserId: 1, TokenId: 11, TokenName: "duplicate", ModelName: "beta", CreatedAt: 200},
		{UserId: 1, TokenId: 11, TokenName: "duplicate", ModelName: "alpha", CreatedAt: 300},
		{UserId: 1, TokenId: 11, TokenName: "duplicate", ModelName: "alpha", CreatedAt: 400},
		{UserId: 1, TokenId: 13, TokenName: "before-rename", ModelName: "alpha", CreatedAt: 500},
		{UserId: 2, TokenId: 21, TokenName: "duplicate", ModelName: "alpha", CreatedAt: 600},
	} {
		require.NoError(t, db.Create(log).Error)
	}
}

func TestGetUserLogsByTokenIdFiltersBeforeCountAndPagination(t *testing.T) {
	for _, database := range selfLogFilterDatabases(t) {
		t.Run(database.name, func(t *testing.T) {
			db := setupSelfLogTokenFilterTest(t, database)
			seedSelfLogTokenFilterData(t, db)

			firstPage, total, err := model.GetUserLogsByTokenId(1, 11, model.LogTypeUnknown, 150, 450, "alpha", "", 0, 1, "", "", "")
			require.NoError(t, err)
			require.Equal(t, int64(2), total)
			require.Len(t, firstPage, 1)
			assert.Equal(t, 11, firstPage[0].TokenId)
			assert.Equal(t, int64(400), firstPage[0].CreatedAt)

			secondPage, total, err := model.GetUserLogsByTokenId(1, 11, model.LogTypeUnknown, 150, 450, "alpha", "", 1, 1, "", "", "")
			require.NoError(t, err)
			require.Equal(t, int64(2), total)
			require.Len(t, secondPage, 1)
			assert.Equal(t, 11, secondPage[0].TokenId)
			assert.Equal(t, int64(300), secondPage[0].CreatedAt)

			renamedTokenLogs, total, err := model.GetUserLogsByTokenId(1, 13, model.LogTypeUnknown, 0, 0, "", "", 0, 20, "", "", "")
			require.NoError(t, err)
			require.Equal(t, int64(1), total)
			require.Len(t, renamedTokenLogs, 1)
			assert.Equal(t, "before-rename", renamedTokenLogs[0].TokenName)
		})
	}
}

func TestGetUserLogsTokenIdValidationAndOwnership(t *testing.T) {
	for _, database := range selfLogFilterDatabases(t) {
		t.Run(database.name, func(t *testing.T) {
			db := setupSelfLogTokenFilterTest(t, database)
			seedSelfLogTokenFilterData(t, db)

			for _, tokenId := range []string{"", "abc", "0", "-1", "999999999999999999999999"} {
				t.Run("invalid_"+tokenId, func(t *testing.T) {
					ctx, recorder := newSelfLogContext("/api/log/self?token_id=" + tokenId)
					GetUserLogs(ctx)
					require.Equal(t, http.StatusBadRequest, recorder.Code)
					assert.Equal(t, "invalid_params", decodeRestError(t, recorder).Code)
				})
			}

			for _, tokenId := range []string{"21", "999"} {
				t.Run("inaccessible_"+tokenId, func(t *testing.T) {
					ctx, recorder := newSelfLogContext("/api/log/self?token_id=" + tokenId)
					GetUserLogs(ctx)
					require.Equal(t, http.StatusNotFound, recorder.Code)
					assert.Equal(t, "token_not_found", decodeRestError(t, recorder).Code)
				})
			}

			ctx, recorder := newSelfLogContext("/api/log/self?token_id=12")
			GetUserLogs(ctx)
			require.Equal(t, http.StatusOK, recorder.Code)
			var response struct {
				Success bool `json:"success"`
				Data    struct {
					Total int         `json:"total"`
					Items []model.Log `json:"items"`
				} `json:"data"`
			}
			require.NoError(t, common.Unmarshal(recorder.Body.Bytes(), &response))
			assert.True(t, response.Success)
			assert.Zero(t, response.Data.Total)
			assert.Empty(t, response.Data.Items)
		})
	}
}

func newSelfLogContext(target string) (*gin.Context, *httptest.ResponseRecorder) {
	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Request = httptest.NewRequest(http.MethodGet, target, nil)
	ctx.Set("id", 1)
	return ctx, recorder
}
