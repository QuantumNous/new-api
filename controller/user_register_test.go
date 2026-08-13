package controller

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestRegisterSinglePrimaryConsumesInvitationAndCreatesKey(t *testing.T) {
	db := setupAPIKeyLoginTestDB(t)
	previousRegisterEnabled := common.RegisterEnabled
	previousPasswordRegisterEnabled := common.PasswordRegisterEnabled
	previousEmailVerificationEnabled := common.EmailVerificationEnabled
	common.RegisterEnabled = true
	common.PasswordRegisterEnabled = true
	common.EmailVerificationEnabled = false
	t.Cleanup(func() {
		common.RegisterEnabled = previousRegisterEnabled
		common.PasswordRegisterEnabled = previousPasswordRegisterEnabled
		common.EmailVerificationEnabled = previousEmailVerificationEnabled
	})

	payload, err := common.Marshal(map[string]string{"email": "invited@example.com", "username": "invited-user"})
	require.NoError(t, err)
	inviteToken, inviteFlow, err := model.CreateAuthFlow(model.AuthFlowCreate{
		Purpose:   model.AuthFlowPurposeUserInvite,
		Payload:   string(payload),
		ExpiresAt: time.Now().Add(time.Minute),
	})
	require.NoError(t, err)

	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)
	c.Request = httptest.NewRequest(http.MethodPost, "/api/user/register", strings.NewReader(`{"invite_token":"`+inviteToken+`"}`))
	c.Request.Header.Set("Content-Type", "application/json")

	Register(c)

	require.Equal(t, http.StatusOK, recorder.Code)
	assert.Contains(t, recorder.Body.String(), `"success":true`)
	assert.Contains(t, recorder.Body.String(), `"full_key":"sk-`)
	var flow model.AuthFlow
	require.NoError(t, db.First(&flow, inviteFlow.Id).Error)
	assert.NotNil(t, flow.ConsumedAt)
	var user model.User
	require.NoError(t, db.Where("email = ?", "invited@example.com").First(&user).Error)
	assert.Equal(t, "invited-user", user.Username)
	var keyCount int64
	require.NoError(t, db.Model(&model.Token{}).Where("user_id = ?", user.Id).Count(&keyCount).Error)
	assert.EqualValues(t, 1, keyCount)
}

func TestRegisterSinglePrimaryRequiresInvitation(t *testing.T) {
	db := setupAPIKeyLoginTestDB(t)
	previousRegisterEnabled := common.RegisterEnabled
	previousPasswordRegisterEnabled := common.PasswordRegisterEnabled
	previousEmailVerificationEnabled := common.EmailVerificationEnabled
	common.RegisterEnabled = true
	common.PasswordRegisterEnabled = true
	common.EmailVerificationEnabled = false
	t.Cleanup(func() {
		common.RegisterEnabled = previousRegisterEnabled
		common.PasswordRegisterEnabled = previousPasswordRegisterEnabled
		common.EmailVerificationEnabled = previousEmailVerificationEnabled
	})

	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)
	c.Request = httptest.NewRequest(http.MethodPost, "/api/user/register", strings.NewReader(`{"email":"invite-required@example.com","verification_code":"123456"}`))
	c.Request.Header.Set("Content-Type", "application/json")

	Register(c)

	require.Equal(t, http.StatusOK, recorder.Code)
	assert.Contains(t, recorder.Body.String(), `"success":false`)
	assert.Contains(t, recorder.Body.String(), "invite_required")
	var count int64
	require.NoError(t, db.Model(&model.User{}).Count(&count).Error)
	assert.Zero(t, count)
}

func TestRegisterSinglePrimaryRejectsInvalidInvitation(t *testing.T) {
	db := setupAPIKeyLoginTestDB(t)
	previousRegisterEnabled := common.RegisterEnabled
	previousPasswordRegisterEnabled := common.PasswordRegisterEnabled
	previousEmailVerificationEnabled := common.EmailVerificationEnabled
	common.RegisterEnabled = true
	common.PasswordRegisterEnabled = true
	common.EmailVerificationEnabled = false
	t.Cleanup(func() {
		common.RegisterEnabled = previousRegisterEnabled
		common.PasswordRegisterEnabled = previousPasswordRegisterEnabled
		common.EmailVerificationEnabled = previousEmailVerificationEnabled
	})

	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)
	c.Request = httptest.NewRequest(http.MethodPost, "/api/user/register", strings.NewReader(`{"email":"invite-invalid@example.com","verification_code":"123456","invite_token":"invalid-token"}`))
	c.Request.Header.Set("Content-Type", "application/json")

	Register(c)

	require.Equal(t, http.StatusOK, recorder.Code)
	assert.Contains(t, recorder.Body.String(), `"success":false`)
	assert.Contains(t, recorder.Body.String(), "invite_invalid")
	var count int64
	require.NoError(t, db.Model(&model.User{}).Count(&count).Error)
	assert.Zero(t, count)
}

func TestCreateUserRejectsOrdinaryUserBypassInSinglePrimaryMode(t *testing.T) {
	db := setupAPIKeyLoginTestDB(t)
	previous := common.SinglePrimaryAPIKeyEnabled
	common.SinglePrimaryAPIKeyEnabled = true
	t.Cleanup(func() { common.SinglePrimaryAPIKeyEnabled = previous })

	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)
	c.Set("role", common.RoleRootUser)
	c.Request = httptest.NewRequest(http.MethodPost, "/api/user", strings.NewReader(`{"username":"admin-bypass","password":"password123","role":1}`))
	c.Request.Header.Set("Content-Type", "application/json")

	CreateUser(c)

	require.Equal(t, http.StatusOK, recorder.Code)
	assert.Contains(t, recorder.Body.String(), "invite_required")
	var count int64
	require.NoError(t, db.Model(&model.User{}).Where("username = ?", "admin-bypass").Count(&count).Error)
	assert.Zero(t, count)
}

func TestSendUserInviteInvalidatesFlowWhenSMTPDeliveryFails(t *testing.T) {
	db := setupAPIKeyLoginTestDB(t)
	previousServer, previousPort := common.SMTPServer, common.SMTPPort
	previousSSL, previousStartTLS := common.SMTPSSLEnabled, common.SMTPStartTLSEnabled
	previousAccount, previousFrom, previousToken := common.SMTPAccount, common.SMTPFrom, common.SMTPToken
	common.SMTPServer = "127.0.0.1"
	common.SMTPPort = 1 // deterministic local connection refusal; never reaches a real provider.
	common.SMTPSSLEnabled = false
	common.SMTPStartTLSEnabled = false
	common.SMTPAccount = "sender@example.com"
	common.SMTPFrom = "sender@example.com"
	common.SMTPToken = "test-token"
	t.Cleanup(func() {
		common.SMTPServer, common.SMTPPort = previousServer, previousPort
		common.SMTPSSLEnabled, common.SMTPStartTLSEnabled = previousSSL, previousStartTLS
		common.SMTPAccount, common.SMTPFrom, common.SMTPToken = previousAccount, previousFrom, previousToken
	})

	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)
	c.Set("role", common.RoleRootUser)
	c.Request = httptest.NewRequest(http.MethodPost, "/api/user/invite", strings.NewReader(`{"email":"delivery-failure@example.com","username":"delivery-failure"}`))
	c.Request.Header.Set("Content-Type", "application/json")

	SendUserInvite(c)

	assert.Contains(t, recorder.Body.String(), `"success":false`)
	var flow model.AuthFlow
	require.NoError(t, db.Where("purpose = ?", model.AuthFlowPurposeUserInvite).Order("id desc").First(&flow).Error)
	assert.NotNil(t, flow.ConsumedAt, "failed invitation delivery must invalidate the one-time flow")
	var userCount int64
	require.NoError(t, db.Model(&model.User{}).Where("email = ?", "delivery-failure@example.com").Count(&userCount).Error)
	assert.Zero(t, userCount, "an invitation must not create an account before confirmation")
}
