package middleware

import (
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/i18n"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/service"
	"github.com/gin-gonic/gin"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func setupRuntimeVisibilityTestDB(t *testing.T) {
	t.Helper()
	previousDB := model.DB
	previousRedis := common.RedisEnabled
	previousSQLite := common.UsingSQLite
	previousMySQL := common.UsingMySQL
	previousPostgres := common.UsingPostgreSQL
	previousSQLitePath := common.SQLitePath
	t.Cleanup(func() {
		model.DB = previousDB
		common.RedisEnabled = previousRedis
		common.UsingSQLite = previousSQLite
		common.UsingMySQL = previousMySQL
		common.UsingPostgreSQL = previousPostgres
		common.SQLitePath = previousSQLitePath
	})
	common.RedisEnabled = false
	common.UsingSQLite = true
	common.UsingMySQL = false
	common.UsingPostgreSQL = false
	common.SQLitePath = fmt.Sprintf("file:%s_init?mode=memory&cache=shared", t.Name())
	t.Setenv("SQL_DSN", "local")
	require.NoError(t, model.InitDB())
	if sqlDB, err := model.DB.DB(); err == nil {
		_ = sqlDB.Close()
	}
	db, err := gorm.Open(sqlite.Open("file:runtime_visibility?mode=memory&cache=shared"), &gorm.Config{})
	require.NoError(t, err)
	model.DB = db
	require.NoError(t, db.AutoMigrate(
		&model.User{}, &model.Token{}, &model.TokenGroupVisibility{}, &model.TokenGroupVisibilityTarget{},
		&model.EntitlementPackage{}, &model.UserEntitlement{}, &model.TokenEntitlement{}, &model.EntitlementDailyUsage{},
	))
	t.Cleanup(func() {
		sqlDB, err := db.DB()
		if err == nil {
			_ = sqlDB.Close()
		}
	})
}

func TestTokenAuthRejectsHistoricalTokenAfterTargetedPolicyChanges(t *testing.T) {
	setupRuntimeVisibilityTestDB(t)
	t.Setenv("TOKEN_GROUP_VISIBILITY_ENABLED", "true")
	require.NoError(t, model.DB.Create(&model.User{
		Id: 2, Username: "non-target", Password: "password", Group: "default", AffCode: "non-target-aff", Status: common.UserStatusEnabled,
	}).Error)
	require.NoError(t, model.DB.Create(&model.User{
		Id: 1, Username: "target", Password: "password", Group: "default", AffCode: "target-aff", Status: common.UserStatusEnabled,
	}).Error)
	require.NoError(t, model.DB.Create(&model.Token{
		Id: 1, UserId: 2, Key: "historical", Status: common.TokenStatusEnabled,
		UnlimitedQuota: true, ExpiredTime: -1, Group: "default",
	}).Error)
	require.NoError(t, model.DB.Create(&model.Token{
		Id: 2, UserId: 1, Key: "target", Status: common.TokenStatusEnabled,
		UnlimitedQuota: true, ExpiredTime: -1, Group: "default",
	}).Error)
	require.NoError(t, model.SaveTokenGroupVisibilityPolicy(model.TokenGroupVisibilityPolicy{
		Group: "default", Visibility: model.TokenGroupVisibilityTargeted, UserIds: []int{1},
	}))

	gin.SetMode(gin.TestMode)
	router := gin.New()
	continued := false
	router.Use(TokenAuth())
	router.POST("/v1/chat/completions", func(c *gin.Context) {
		continued = true
		c.Status(http.StatusOK)
	})
	req := httptest.NewRequest(http.MethodPost, "/v1/chat/completions", nil)
	req.Header.Set("Authorization", "Bearer sk-historical")
	recorder := httptest.NewRecorder()
	router.ServeHTTP(recorder, req)

	require.Equal(t, http.StatusForbidden, recorder.Code)
	require.False(t, continued, "historical token must not reach relay after policy changes")

	continued = false
	recorder = httptest.NewRecorder()
	req = httptest.NewRequest(http.MethodPost, "/v1/chat/completions", nil)
	req.Header.Set("Authorization", "Bearer sk-target")
	router.ServeHTTP(recorder, req)
	require.Equal(t, http.StatusOK, recorder.Code)
	require.True(t, continued, "target user must retain access to the targeted group")
}

func TestDistributeRejectsEntitlementGroupForNonTargetUser(t *testing.T) {
	setupRuntimeVisibilityTestDB(t)
	t.Setenv("TOKEN_GROUP_VISIBILITY_ENABLED", "true")
	oldEntitlementFeatureEnabled := common.EntitlementFeatureEnabled
	common.EntitlementFeatureEnabled = true
	t.Cleanup(func() { common.EntitlementFeatureEnabled = oldEntitlementFeatureEnabled })
	require.NoError(t, model.DB.Create(&model.User{
		Id: 1, Username: "runtime-entitlement-user", Password: "password", Group: "default", AffCode: "runtime-entitlement-aff", Status: common.UserStatusEnabled,
	}).Error)
	target := 2
	require.NoError(t, model.DB.Create(&model.User{
		Id: target, Username: "runtime-entitlement-target", Password: "password", Group: "default", AffCode: "runtime-entitlement-target-aff", Status: common.UserStatusEnabled,
	}).Error)
	token := &model.Token{Id: 1, UserId: 1, Key: "runtime-entitlement-token", Status: common.TokenStatusEnabled, UnlimitedQuota: true, ExpiredTime: -1, Group: "default"}
	require.NoError(t, model.DB.Create(token).Error)
	pkg := &model.EntitlementPackage{
		Name: "runtime-targeted-entitlement", Status: model.EntitlementStatusEnabled,
		Group: "default", Models: "runtime-entitlement-model", AllowPublicFallback: false,
	}
	require.NoError(t, model.SaveEntitlementPackage(pkg))
	require.NoError(t, model.UpsertUserEntitlement(&model.UserEntitlement{
		PackageId: pkg.Id, UserId: token.UserId, Status: model.EntitlementStatusEnabled,
	}))
	require.NoError(t, model.SetTokenEntitlementPackages(token.Id, token.UserId, []int{pkg.Id}, false))
	require.NoError(t, model.SaveTokenGroupVisibilityPolicy(model.TokenGroupVisibilityPolicy{
		Group: "default", Visibility: model.TokenGroupVisibilityTargeted, UserIds: []int{target},
	}))
	require.NoError(t, i18n.Init())

	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Request = httptest.NewRequest(http.MethodPost, "/v1/chat/completions", strings.NewReader(`{"model":"runtime-entitlement-model"}`))
	ctx.Request.Header.Set("Content-Type", "application/json")
	ctx.Set("id", token.UserId)
	ctx.Set("token_id", token.Id)
	common.SetContextKey(ctx, constant.ContextKeyUserGroup, "default")
	common.SetContextKey(ctx, constant.ContextKeyUsingGroup, "default")
	common.SetContextKey(ctx, constant.ContextKeyTokenGroup, "default")

	Distribute()(ctx)
	require.Equal(t, http.StatusForbidden, recorder.Code, "entitlement group rewrite must be rejected before channel selection")
}

func TestRuntimeVisibilityFailsClosedOnPolicyReadError(t *testing.T) {
	setupRuntimeVisibilityTestDB(t)
	t.Setenv("TOKEN_GROUP_VISIBILITY_ENABLED", "true")
	require.NoError(t, model.DB.Create(&model.User{
		Id: 1, Username: "runtime-read-error-user", Password: "password", Group: "default", AffCode: "runtime-read-error-aff", Status: common.UserStatusEnabled,
	}).Error)
	db, err := model.DB.DB()
	require.NoError(t, err)
	require.NoError(t, db.Close())
	require.Error(t, service.ValidateUserRuntimeGroup(1, "default"))
}
