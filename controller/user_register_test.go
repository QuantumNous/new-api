package controller

import (
	"bytes"
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

type registerAPIResponse struct {
	Success bool   `json:"success"`
	Message string `json:"message"`
}

func setupRegisterControllerTestDB(t *testing.T) *gorm.DB {
	t.Helper()

	originalRegisterEnabled := common.RegisterEnabled
	originalPasswordRegisterEnabled := common.PasswordRegisterEnabled
	originalEmailVerificationEnabled := common.EmailVerificationEnabled
	originalRedisEnabled := common.RedisEnabled
	originalQuotaForNewUser := common.QuotaForNewUser
	originalQuotaForInviter := common.QuotaForInviter
	originalQuotaForInvitee := common.QuotaForInvitee
	originalUsingSQLite := common.UsingSQLite
	originalUsingMySQL := common.UsingMySQL
	originalUsingPostgreSQL := common.UsingPostgreSQL

	t.Cleanup(func() {
		common.RegisterEnabled = originalRegisterEnabled
		common.PasswordRegisterEnabled = originalPasswordRegisterEnabled
		common.EmailVerificationEnabled = originalEmailVerificationEnabled
		common.RedisEnabled = originalRedisEnabled
		common.QuotaForNewUser = originalQuotaForNewUser
		common.QuotaForInviter = originalQuotaForInviter
		common.QuotaForInvitee = originalQuotaForInvitee
		common.UsingSQLite = originalUsingSQLite
		common.UsingMySQL = originalUsingMySQL
		common.UsingPostgreSQL = originalUsingPostgreSQL
	})

	gin.SetMode(gin.TestMode)
	common.RegisterEnabled = true
	common.PasswordRegisterEnabled = true
	common.EmailVerificationEnabled = false
	common.RedisEnabled = false
	common.QuotaForNewUser = 0
	common.QuotaForInviter = 0
	common.QuotaForInvitee = 0
	common.UsingSQLite = true
	common.UsingMySQL = false
	common.UsingPostgreSQL = false

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

func callRegisterForTest(t *testing.T, payload map[string]any) registerAPIResponse {
	t.Helper()

	body, err := common.Marshal(payload)
	require.NoError(t, err)

	req := httptest.NewRequest(http.MethodPost, "/api/user/register", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = req

	Register(c)

	var response registerAPIResponse
	require.NoError(t, common.Unmarshal(w.Body.Bytes(), &response))
	return response
}

func createInviterForRegisterTest(t *testing.T, db *gorm.DB, affCode string) model.User {
	t.Helper()

	inviter := model.User{
		Username:            "inviter",
		Password:            "password123",
		DisplayName:         "inviter",
		Role:                common.RoleCommonUser,
		Status:              common.UserStatusEnabled,
		AffCode:             affCode,
		DistributionEnabled: true,
	}
	require.NoError(t, db.Create(&inviter).Error)
	return inviter
}

func TestRegisterAcceptsAffAliasFromInviteLink(t *testing.T) {
	db := setupRegisterControllerTestDB(t)
	inviter := createInviterForRegisterTest(t, db, "AFFA")

	response := callRegisterForTest(t, map[string]any{
		"username": "invitee_aff",
		"password": "password123",
		"aff":      inviter.AffCode,
	})

	require.True(t, response.Success, response.Message)
	var invitee model.User
	require.NoError(t, db.Where("username = ?", "invitee_aff").First(&invitee).Error)
	require.Equal(t, inviter.Id, invitee.InviterId)
	require.False(t, invitee.DistributionEnabled)
}

func TestRegisterAcceptsAffCodeFromClassicClient(t *testing.T) {
	db := setupRegisterControllerTestDB(t)
	inviter := createInviterForRegisterTest(t, db, "AFFC")

	response := callRegisterForTest(t, map[string]any{
		"username": "invitee_code",
		"password": "password123",
		"aff_code": inviter.AffCode,
	})

	require.True(t, response.Success, response.Message)
	var invitee model.User
	require.NoError(t, db.Where("username = ?", "invitee_code").First(&invitee).Error)
	require.Equal(t, inviter.Id, invitee.InviterId)
	require.False(t, invitee.DistributionEnabled)
}
