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
	"github.com/pquerna/otp/totp"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

const hwResetSecret = "JBSWY3DPEHPK3PXP"

func hwResetSetup(t *testing.T, withTwoFA bool) (*model.User, string) {
	t.Helper()
	user, _ := setupSecurityEnrollmentTest(t)
	email := "reset-user@example.test"
	require.NoError(t, model.DB.Model(user).Update("email", email).Error)
	if withTwoFA {
		require.NoError(t, model.DB.Create(&model.TwoFA{UserId: user.Id, Secret: hwResetSecret, IsEnabled: true}).Error)
	}
	token := "123456"
	common.RegisterVerificationCodeWithKey(email, token, common.PasswordResetPurpose)
	t.Cleanup(func() { common.DeleteKey(email, common.PasswordResetPurpose) })
	return user, token
}

func hwResetCall(body string) (*httptest.ResponseRecorder, map[string]any) {
	response := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(response)
	c.Request = httptest.NewRequest(http.MethodPost, "/api/user/reset", strings.NewReader(body))
	c.Request.Header.Set("Content-Type", "application/json")
	ResetPassword(c)
	var out map[string]any
	_ = common.Unmarshal(response.Body.Bytes(), &out)
	return response, out
}

func hwResetBody(token, password, code string) string {
	b := `{"email":"reset-user@example.test","token":"` + token + `"`
	if password != "" {
		b += `,"password":"` + password + `"`
	}
	if code != "" {
		b += `,"two_fa_code":"` + code + `"`
	}
	return b + `}`
}

func hwPasswordValid(t *testing.T, id int, password string) bool {
	t.Helper()
	stored, err := model.GetUserById(id, true)
	require.NoError(t, err)
	return common.ValidatePasswordAndHash(password, stored.Password)
}

func TestHwResetPasswordUsesChosenPasswordAndNeverReturnsOne(t *testing.T) {
	user, token := hwResetSetup(t, false)
	response, out := hwResetCall(hwResetBody(token, "my-chosen-password", ""))
	require.Equal(t, true, out["success"], response.Body.String())
	assert.NotContains(t, out, "data")
	assert.NotContains(t, response.Body.String(), "my-chosen-password")
	assert.True(t, hwPasswordValid(t, user.Id, "my-chosen-password"))
	// link is single use
	_, again := hwResetCall(hwResetBody(token, "another-password-1", ""))
	assert.Equal(t, false, again["success"])
	assert.True(t, hwPasswordValid(t, user.Id, "my-chosen-password"))
}

func TestHwResetPasswordWithoutPasswordIsRejectedAndKeepsLink(t *testing.T) {
	user, token := hwResetSetup(t, false)
	response, out := hwResetCall(hwResetBody(token, "", ""))
	assert.Equal(t, http.StatusBadRequest, response.Code)
	assert.Equal(t, "PASSWORD_REQUIRED", out["code"])
	assert.NotContains(t, out, "data")
	assert.True(t, hwPasswordValid(t, user.Id, "enrollment-password"))
	_, ok := hwResetCall(hwResetBody(token, "valid-new-password", ""))
	assert.Equal(t, true, ok["success"])
}

func TestHwResetPasswordRejectsBadLinkAndWeakPassword(t *testing.T) {
	user, token := hwResetSetup(t, false)
	_, out := hwResetCall(hwResetBody("000000", "valid-new-password", ""))
	assert.Equal(t, false, out["success"])
	_, out = hwResetCall(hwResetBody(token, "short", ""))
	assert.Equal(t, false, out["success"])
	assert.True(t, hwPasswordValid(t, user.Id, "enrollment-password"))
	// weak password does not burn the link
	_, out = hwResetCall(hwResetBody(token, "valid-new-password", ""))
	assert.Equal(t, true, out["success"])
}

func TestHwResetPasswordRequiresTwoFAWhenEnabled(t *testing.T) {
	user, token := hwResetSetup(t, true)
	response, out := hwResetCall(hwResetBody(token, "valid-new-password", ""))
	assert.Equal(t, http.StatusForbidden, response.Code)
	assert.Equal(t, "TWO_FA_REQUIRED", out["code"])
	response, out = hwResetCall(hwResetBody(token, "valid-new-password", "000000"))
	assert.Equal(t, http.StatusForbidden, response.Code)
	assert.Equal(t, "TWO_FA_INVALID", out["code"])
	assert.True(t, hwPasswordValid(t, user.Id, "enrollment-password"))

	code, err := totp.GenerateCode(hwResetSecret, time.Now())
	require.NoError(t, err)
	response, out = hwResetCall(hwResetBody(token, "valid-new-password", code))
	require.Equal(t, true, out["success"], response.Body.String())
	assert.True(t, hwPasswordValid(t, user.Id, "valid-new-password"))
	enabled, err := model.IsTwoFAEnabled(user.Id)
	require.NoError(t, err)
	assert.True(t, enabled, "2FA stays on after the reset")
}
