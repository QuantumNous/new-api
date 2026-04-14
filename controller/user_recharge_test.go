package controller

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/gin-gonic/gin"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

type userRechargeAPIResponse struct {
	Success bool            `json:"success"`
	Message string          `json:"message"`
	Data    json.RawMessage `json:"data"`
}

type selfUserRechargeResponse struct {
	ID            int    `json:"id"`
	Username      string `json:"username"`
	AllowRecharge bool   `json:"allow_recharge"`
}

func setupUserRechargeControllerTestDB(t *testing.T) *gorm.DB {
	t.Helper()

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

	require.NoError(t, db.AutoMigrate(&model.User{}))

	t.Cleanup(func() {
		sqlDB, err := db.DB()
		if err == nil {
			_ = sqlDB.Close()
		}
	})

	return db
}

func newUserRechargeContext(t *testing.T, method string, target string, body any, userID int, role int) (*gin.Context, *httptest.ResponseRecorder) {
	t.Helper()

	var requestBody *bytes.Reader
	if body != nil {
		payload, err := common.Marshal(body)
		require.NoError(t, err)
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
	return ctx, recorder
}

func decodeUserRechargeResponse(t *testing.T, recorder *httptest.ResponseRecorder) userRechargeAPIResponse {
	t.Helper()

	var response userRechargeAPIResponse
	require.NoError(t, common.Unmarshal(recorder.Body.Bytes(), &response))
	return response
}

func seedRechargeUser(t *testing.T, db *gorm.DB, user model.User) *model.User {
	t.Helper()

	createMap := map[string]interface{}{
		"username":       user.Username,
		"password":       user.Password,
		"display_name":   user.DisplayName,
		"role":           user.Role,
		"status":         user.Status,
		"group":          user.Group,
		"allow_recharge": user.AllowRecharge,
	}
	if user.Id > 0 {
		createMap["id"] = user.Id
	}

	require.NoError(t, db.Model(&model.User{}).Create(createMap).Error)
	var created model.User
	require.NoError(t, db.Where("username = ?", user.Username).First(&created).Error)
	require.NoError(t, db.First(&created, created.Id).Error)
	return &created
}

func TestCreateUserPersistsAllowRecharge(t *testing.T) {
	db := setupUserRechargeControllerTestDB(t)

	ctx, recorder := newUserRechargeContext(t, http.MethodPost, "/api/user/", map[string]any{
		"username":       "create-recharge-user",
		"password":       "password123",
		"display_name":   "Create Recharge User",
		"role":           common.RoleCommonUser,
		"allow_recharge": false,
	}, 900, common.RoleRootUser)

	CreateUser(ctx)

	response := decodeUserRechargeResponse(t, recorder)
	require.True(t, response.Success, response.Message)

	var created model.User
	require.NoError(t, db.Where("username = ?", "create-recharge-user").First(&created).Error)
	require.False(t, created.AllowRecharge)
}

func TestUpdateUserPersistsAllowRecharge(t *testing.T) {
	db := setupUserRechargeControllerTestDB(t)
	user := seedRechargeUser(t, db, model.User{
		Id:            1001,
		Username:      "update-recharge-user",
		Password:      "password123",
		DisplayName:   "Update Recharge User",
		Role:          common.RoleCommonUser,
		Status:        common.UserStatusEnabled,
		Group:         "default",
		AllowRecharge: true,
	})

	ctx, recorder := newUserRechargeContext(t, http.MethodPut, "/api/user/", map[string]any{
		"id":             user.Id,
		"username":       user.Username,
		"display_name":   user.DisplayName,
		"role":           user.Role,
		"status":         user.Status,
		"group":          user.Group,
		"allow_recharge": false,
	}, 901, common.RoleRootUser)

	UpdateUser(ctx)

	response := decodeUserRechargeResponse(t, recorder)
	require.True(t, response.Success, response.Message)

	updated, err := model.GetUserById(user.Id, true)
	require.NoError(t, err)
	require.False(t, updated.AllowRecharge)
}

func TestGetSelfIncludesAllowRecharge(t *testing.T) {
	db := setupUserRechargeControllerTestDB(t)
	user := seedRechargeUser(t, db, model.User{
		Id:            1101,
		Username:      "self-recharge-user",
		Password:      "password123",
		DisplayName:   "Self Recharge User",
		Role:          common.RoleCommonUser,
		Status:        common.UserStatusEnabled,
		Group:         "default",
		AllowRecharge: false,
	})
	var allowRechargeRaw int
	require.NoError(t, db.Raw("SELECT allow_recharge FROM users WHERE id = ?", user.Id).Scan(&allowRechargeRaw).Error)
	require.Equal(t, 0, allowRechargeRaw)
	user, err := model.GetUserById(user.Id, false)
	require.NoError(t, err)
	require.False(t, user.AllowRecharge)

	ctx, recorder := newUserRechargeContext(t, http.MethodGet, "/api/user/self", nil, user.Id, common.RoleCommonUser)
	GetSelf(ctx)

	response := decodeUserRechargeResponse(t, recorder)
	require.True(t, response.Success, response.Message)

	var self selfUserRechargeResponse
	require.NoError(t, common.Unmarshal(response.Data, &self))
	require.Equal(t, user.Id, self.ID)
	require.False(t, self.AllowRecharge)
}
