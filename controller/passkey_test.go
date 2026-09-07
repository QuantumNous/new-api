package controller

import (
	"crypto/ecdsa"
	"crypto/elliptic"
	"crypto/rand"
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
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
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

func TestPasskeyRegisterFinishRejectsUnapprovedFlowWithoutConsumingIt(t *testing.T) {
	_, identity := setupSecurityEnrollmentTest(t)
	system_setting.GetPasskeySettings().UserVerification = "required"
	key, err := ecdsa.GenerateKey(elliptic.P256(), rand.Reader)
	require.NoError(t, err)
	payload, err := common.Marshal(map[string]any{"scope": service.VerificationScopePasskeyRegister})
	require.NoError(t, err)
	token, _, err := model.CreateAuthFlow(model.AuthFlowCreate{
		Purpose: model.AuthFlowPurposePasskeyRegister, UserId: identity.UserID, SessionId: identity.SessionID,
		Payload: string(payload), ExpiresAt: time.Now().Add(time.Minute),
	})
	require.NoError(t, err)
	body, err := common.Marshal(passkeyFinishRequest{
		FlowToken: token, Credential: securityPasskeyResponse(t, key, "test-challenge", true, 0),
	})
	require.NoError(t, err)
	response := securityEnrollmentRequest("POST", "/api/user/passkey/register/finish", string(body), "", identity, PasskeyRegisterFinish)
	var result securityEnrollmentResponse
	require.NoError(t, common.Unmarshal(response.Body.Bytes(), &result))
	assert.False(t, result.Success)
	assert.Equal(t, "AUTH_FLOW_INVALID", result.Code)
	_, err = model.GetPasskeyByUserID(identity.UserID)
	assert.ErrorIs(t, err, model.ErrPasskeyNotFound)
	flow, err := model.GetAuthFlow(token, model.AuthFlowMatch{Purpose: model.AuthFlowPurposePasskeyRegister})
	require.NoError(t, err)
	assert.Nil(t, flow.ConsumedAt)
}
