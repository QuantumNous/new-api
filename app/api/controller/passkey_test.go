package controller

import (
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/setting/system_setting"
	"github.com/gin-gonic/gin"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

type passkeyTestBody struct {
	*strings.Reader
}

func (*passkeyTestBody) Close() error { return nil }

func TestParsePasskeyFinishRequestDoesNotRewriteRequestBody(t *testing.T) {
	gin.SetMode(gin.TestMode)
	bodyText := `{"flow_token":"flow-1","credential":{"id":"credential-1"}}`
	body := &passkeyTestBody{Reader: strings.NewReader(bodyText)}
	request := httptest.NewRequest(http.MethodPost, "/api/user/passkey/register/finish", nil)
	request.Body = body
	request.ContentLength = int64(len(bodyText))
	context, _ := gin.CreateTestContext(httptest.NewRecorder())
	context.Request = request

	parsed, err := parsePasskeyFinishRequest(context)
	require.NoError(t, err)
	assert.Equal(t, "flow-1", parsed.FlowToken)
	assert.JSONEq(t, `{"id":"credential-1"}`, string(parsed.Credential))
	assert.Same(t, body, context.Request.Body)
	assert.Equal(t, int64(len(bodyText)), context.Request.ContentLength)
}

func TestPasskeyRegisterFinishRejectsMissingOrWrongProofWithoutConsumingFlow(t *testing.T) {
	previousDB := model.DB
	previousType := common.MainDatabaseType()
	previousRedis := common.RedisEnabled
	previousSecret := common.SessionSecret
	settings := system_setting.GetPasskeySettings()
	previousSettings := *settings
	dsn := fmt.Sprintf("file:%s?mode=memory&cache=shared", strings.ReplaceAll(t.Name(), "/", "_"))
	db, err := gorm.Open(sqlite.Open(dsn), &gorm.Config{})
	require.NoError(t, err)
	require.NoError(t, db.AutoMigrate(&model.User{}, &model.TwoFA{}, &model.AuthFlow{}))
	model.DB = db
	common.SetMainDatabaseType(common.DatabaseTypeSQLite)
	common.RedisEnabled = false
	common.SessionSecret = "passkey-register-proof-test-secret"
	*settings = system_setting.PasskeySettings{Enabled: true}
	t.Cleanup(func() {
		model.DB = previousDB
		common.SetMainDatabaseType(previousType)
		common.RedisEnabled = previousRedis
		common.SessionSecret = previousSecret
		*settings = previousSettings
		sqlDB, dbErr := db.DB()
		if dbErr == nil {
			_ = sqlDB.Close()
		}
	})

	user := &model.User{
		Username: "passkey-proof-user", Password: "password-placeholder", Role: common.RoleCommonUser,
		Status: common.UserStatusEnabled, Group: "default", AuthVersion: 1,
	}
	require.NoError(t, db.Create(user).Error)
	require.NoError(t, db.Create(&model.TwoFA{UserId: user.Id, Secret: "totp-secret", IsEnabled: true}).Error)
	identity := service.AuthIdentity{
		UserID: user.Id, SessionID: "passkey-proof-session", UserAuthVersion: 1, SessionVersion: 1,
	}
	wrongScopeProof, _, err := service.IssueSecurityProof(identity, secureVerificationMethod2FA, []string{securityProofScopePasskeyDelete})
	require.NoError(t, err)

	tests := []struct {
		name         string
		proof        string
		expectedCode string
	}{
		{name: "missing proof", expectedCode: "SECURITY_PROOF_REQUIRED"},
		{name: "wrong scope proof", proof: wrongScopeProof, expectedCode: "SECURITY_PROOF_SCOPE_MISMATCH"},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			flowToken, _, err := model.CreateAuthFlow(model.AuthFlowCreate{
				Purpose: model.AuthFlowPurposePasskeyRegister, UserId: user.Id, SessionId: identity.SessionID,
				Payload: `{}`, ExpiresAt: time.Now().Add(time.Minute),
			})
			require.NoError(t, err)
			body := fmt.Sprintf(`{"flow_token":%q,"credential":{}}`, flowToken)
			request := httptest.NewRequest(http.MethodPost, "/api/user/passkey/register/finish", strings.NewReader(body))
			request.Header.Set("Content-Type", "application/json")
			if test.proof != "" {
				request.Header.Set("X-Security-Proof", test.proof)
			}
			response := httptest.NewRecorder()
			context, _ := gin.CreateTestContext(response)
			context.Request = request
			context.Set("id", identity.UserID)
			context.Set("session_id", identity.SessionID)
			context.Set("auth_version", identity.UserAuthVersion)
			context.Set("session_version", identity.SessionVersion)

			PasskeyRegisterFinish(context)

			assert.Equal(t, http.StatusForbidden, response.Code)
			var responseBody struct {
				Code string `json:"code"`
			}
			require.NoError(t, common.Unmarshal(response.Body.Bytes(), &responseBody))
			assert.Equal(t, test.expectedCode, responseBody.Code)
			flow, err := model.GetAuthFlow(flowToken, model.AuthFlowMatch{
				Purpose: model.AuthFlowPurposePasskeyRegister, UserId: user.Id, SessionId: identity.SessionID,
			})
			require.NoError(t, err)
			assert.Nil(t, flow.ConsumedAt)
		})
	}
}
