package controller

import (
	"bytes"
	"errors"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strconv"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/gin-gonic/gin"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func TestValidateFeishuIdentityUsesOfficialTripleAndRejectsMismatch(t *testing.T) {
	originalLookup := lookupOfficialFeishuIdentity
	t.Cleanup(func() { lookupOfficialFeishuIdentity = originalLookup })
	lookupOfficialFeishuIdentity = func(_ *gin.Context, idType, idValue string) (feishuIdentity, error) {
		require.Equal(t, "open_id", idType)
		require.Equal(t, "ou_input", idValue)
		return feishuIdentity{OpenID: "ou_official", UnionID: "on_official", UserID: "user_official"}, nil
	}

	ctx, _ := gin.CreateTestContext(httptest.NewRecorder())
	_, err := validateFeishuIdentity(ctx, "ou_input", "", "")
	require.ErrorContains(t, err, "open_id mismatch")
}

func TestValidateFeishuIdentityReturnsOfficialTriple(t *testing.T) {
	originalLookup := lookupOfficialFeishuIdentity
	t.Cleanup(func() { lookupOfficialFeishuIdentity = originalLookup })
	lookupOfficialFeishuIdentity = func(_ *gin.Context, _, _ string) (feishuIdentity, error) {
		return feishuIdentity{OpenID: "ou_official", UnionID: "on_official", UserID: "user_official"}, nil
	}

	ctx, _ := gin.CreateTestContext(httptest.NewRecorder())
	got, err := validateFeishuIdentity(ctx, "", "on_official", "user_official")
	require.NoError(t, err)
	require.Equal(t, feishuIdentity{OpenID: "ou_official", UnionID: "on_official", UserID: "user_official"}, got)
}

func TestValidateFeishuIdentityRejectsLookupFailure(t *testing.T) {
	originalLookup := lookupOfficialFeishuIdentity
	t.Cleanup(func() { lookupOfficialFeishuIdentity = originalLookup })
	lookupOfficialFeishuIdentity = func(_ *gin.Context, _, _ string) (feishuIdentity, error) {
		return feishuIdentity{}, errors.New("permission denied")
	}

	ctx, _ := gin.CreateTestContext(httptest.NewRecorder())
	_, err := validateFeishuIdentity(ctx, "ou_fake", "", "")
	require.ErrorContains(t, err, "permission denied")
}

func setupFeishuBindingTestDB(t *testing.T) *gorm.DB {
	t.Helper()
	gin.SetMode(gin.TestMode)
	common.SetDatabaseTypes(common.DatabaseTypeSQLite, common.DatabaseTypeSQLite)
	common.RedisEnabled = false
	oldDB, oldLogDB := model.DB, model.LOG_DB
	dsn := fmt.Sprintf("file:%s?mode=memory&cache=shared", strings.ReplaceAll(t.Name(), "/", "_"))
	db, err := gorm.Open(sqlite.Open(dsn), &gorm.Config{})
	require.NoError(t, err)
	model.DB, model.LOG_DB = db, db
	require.NoError(t, db.AutoMigrate(&model.User{}, &model.Log{}))
	t.Cleanup(func() {
		model.DB, model.LOG_DB = oldDB, oldLogDB
		sqlDB, dbErr := db.DB()
		if dbErr == nil {
			_ = sqlDB.Close()
		}
	})
	return db
}

func TestImportFeishuBindingsSavesOfficialUserID(t *testing.T) {
	db := setupFeishuBindingTestDB(t)
	user := model.User{Username: "target", AffCode: "target-aff", FeishuId: "", FeishuUnionId: "", FeishuUserId: ""}
	require.NoError(t, db.Create(&user).Error)

	originalLookup := lookupOfficialFeishuIdentity
	t.Cleanup(func() { lookupOfficialFeishuIdentity = originalLookup })
	lookupOfficialFeishuIdentity = func(_ *gin.Context, _, _ string) (feishuIdentity, error) {
		return feishuIdentity{OpenID: "ou_official", UnionID: "on_official", UserID: "user_official"}, nil
	}

	body := fmt.Sprintf(`{"bindings":[{"user_id":%d,"open_id":"ou_official"}]}`, user.Id)
	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Request = httptest.NewRequest(http.MethodPost, "/", bytes.NewBufferString(body))
	ctx.Request.Header.Set("Content-Type", "application/json")

	ImportFeishuBindings(ctx)
	require.Equal(t, http.StatusOK, recorder.Code)

	var got model.User
	require.NoError(t, db.First(&got, user.Id).Error)
	require.Equal(t, "ou_official", got.FeishuId)
	require.Equal(t, "on_official", got.FeishuUnionId)
	require.Equal(t, "user_official", got.FeishuUserId)
}

func TestImportFeishuBindingsRejectsOfficialUserIDAlreadyBound(t *testing.T) {
	db := setupFeishuBindingTestDB(t)
	target := model.User{Username: "target", AffCode: "target-aff"}
	occupied := model.User{Username: "occupied", AffCode: "occupied-aff", FeishuUserId: "user_official"}
	require.NoError(t, db.Create(&target).Error)
	require.NoError(t, db.Create(&occupied).Error)

	originalLookup := lookupOfficialFeishuIdentity
	t.Cleanup(func() { lookupOfficialFeishuIdentity = originalLookup })
	lookupOfficialFeishuIdentity = func(_ *gin.Context, _, _ string) (feishuIdentity, error) {
		return feishuIdentity{OpenID: "ou_official", UnionID: "on_official", UserID: "user_official"}, nil
	}

	body := fmt.Sprintf(`{"bindings":[{"user_id":%d,"open_id":"ou_official"}]}`, target.Id)
	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Request = httptest.NewRequest(http.MethodPost, "/", bytes.NewBufferString(body))
	ctx.Request.Header.Set("Content-Type", "application/json")

	ImportFeishuBindings(ctx)
	require.Contains(t, recorder.Body.String(), "user_id=user_official already bound")

	var got model.User
	require.NoError(t, db.First(&got, target.Id).Error)
	require.Empty(t, got.FeishuId)
	require.Empty(t, got.FeishuUnionId)
	require.Empty(t, got.FeishuUserId)
}

func TestResolveFeishuIdentifiersForAgentOwnerAcceptsUnionIDAndReturnsOfficialTriple(t *testing.T) {
	originalLookup := lookupOfficialFeishuIdentity
	t.Cleanup(func() { lookupOfficialFeishuIdentity = originalLookup })
	lookupOfficialFeishuIdentity = func(_ *gin.Context, idType, idValue string) (feishuIdentity, error) {
		require.Equal(t, "union_id", idType)
		require.Equal(t, "on_official", idValue)
		return feishuIdentity{OpenID: "ou_official", UnionID: "on_official", UserID: "user_official"}, nil
	}

	ctx, _ := gin.CreateTestContext(httptest.NewRecorder())
	ctx.Request = httptest.NewRequest(http.MethodPost, "/", nil)
	openID, unionID, userID, _, _, _, _, err := resolveFeishuIdentifiersForAgentOwner(ctx, agentOwnerBindRequest{FeishuUnionId: "on_official"})
	require.NoError(t, err)
	require.Equal(t, "ou_official", openID)
	require.Equal(t, "on_official", unionID)
	require.Equal(t, "user_official", userID)
}

func TestBindAgentOwnerSavesOfficialTripleIncludingUnionID(t *testing.T) {
	db := setupFeishuBindingTestDB(t)
	user := model.User{Username: "agent", AffCode: "agent-aff", AccountType: common.AccountTypeOrganization}
	require.NoError(t, db.Create(&user).Error)

	originalLookup := lookupOfficialFeishuIdentity
	t.Cleanup(func() { lookupOfficialFeishuIdentity = originalLookup })
	lookupOfficialFeishuIdentity = func(_ *gin.Context, idType, idValue string) (feishuIdentity, error) {
		require.Equal(t, "union_id", idType)
		require.Equal(t, "on_official", idValue)
		return feishuIdentity{OpenID: "ou_official", UnionID: "on_official", UserID: "user_official"}, nil
	}

	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Params = gin.Params{{Key: "id", Value: strconv.Itoa(user.Id)}}
	ctx.Request = httptest.NewRequest(http.MethodPost, "/", bytes.NewBufferString(`{"feishu_union_id":"on_official"}`))
	ctx.Request.Header.Set("Content-Type", "application/json")

	BindAgentOwner(ctx)
	require.Equal(t, http.StatusOK, recorder.Code)

	var got model.User
	require.NoError(t, db.First(&got, user.Id).Error)
	require.Equal(t, "ou_official", got.AgentOwnerFeishuOpenId)
	require.Equal(t, "on_official", got.AgentOwnerFeishuUnionId)
	require.Equal(t, "user_official", got.AgentOwnerFeishuUserId)
}

func TestResolveFeishuIdentifiersForAgentOwnerRejectsUnionIDMismatchWithOtherIDs(t *testing.T) {
	originalLookup := lookupOfficialFeishuIdentity
	t.Cleanup(func() { lookupOfficialFeishuIdentity = originalLookup })
	lookupOfficialFeishuIdentity = func(_ *gin.Context, _, _ string) (feishuIdentity, error) {
		return feishuIdentity{OpenID: "ou_official", UnionID: "on_official", UserID: "user_official"}, nil
	}

	ctx, _ := gin.CreateTestContext(httptest.NewRecorder())
	ctx.Request = httptest.NewRequest(http.MethodPost, "/", nil)
	_, _, _, _, _, _, _, err := resolveFeishuIdentifiersForAgentOwner(ctx, agentOwnerBindRequest{
		FeishuOpenId:  "ou_official",
		FeishuUnionId: "on_wrong",
		FeishuUserId:  "user_official",
	})
	require.ErrorContains(t, err, "union_id mismatch")
}

func TestBatchUpdateFeishuUsersUsesNewOpenIDForAuthoritativeGroup(t *testing.T) {
	db := setupFeishuBindingTestDB(t)
	user := model.User{Username: "target", AffCode: "target-aff", Group: "default"}
	require.NoError(t, db.Create(&user).Error)

	originalLookup := lookupOfficialFeishuIdentity
	t.Cleanup(func() { lookupOfficialFeishuIdentity = originalLookup })
	lookupOfficialFeishuIdentity = func(_ *gin.Context, idType, idValue string) (feishuIdentity, error) {
		require.Equal(t, "open_id", idType)
		require.Equal(t, "ou_new", idValue)
		return feishuIdentity{OpenID: "ou_new", UnionID: "on_new", UserID: "user_new"}, nil
	}

	body := fmt.Sprintf(`{"users":[{"user_id":%d,"feishu_open_id":"ou_new","group":"vip"}]}`, user.Id)
	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Request = httptest.NewRequest(http.MethodPost, "/", bytes.NewBufferString(body))
	ctx.Request.Header.Set("Content-Type", "application/json")

	BatchUpdateFeishuUsers(ctx)
	require.Equal(t, http.StatusOK, recorder.Code)

	var got model.User
	require.NoError(t, db.First(&got, user.Id).Error)
	require.Equal(t, "ou_new", got.FeishuId)
	require.Equal(t, "pending", got.Group)
}
