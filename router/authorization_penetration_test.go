package router

import (
	"encoding/base64"
	"fmt"
	"net/http"
	"strings"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// These tests replay the client/admin separation attacks against the real
// router wiring. The frontend guards are a usability layer only; every case
// here proves the server refuses the request even when that layer is bypassed.

type apiEnvelope struct {
	Success bool   `json:"success"`
	Message string `json:"message"`
}

func decodeAPIEnvelope(t *testing.T, body string) apiEnvelope {
	t.Helper()
	var envelope apiEnvelope
	require.NoError(t, common.UnmarshalJsonStr(body, &envelope), body)
	return envelope
}

func TestClientRoleIsDeniedEveryAdminSurface(t *testing.T) {
	engine := setupVisibleSectionRouterTest(t)
	clientToken := createSectionTestUser(t, "pen-client", common.RoleCommonUser, nil)
	adminToken := createSectionTestAdmin(t, "pen-admin", nil)

	cases := []struct {
		name   string
		method string
		path   string
		body   string
	}{
		{name: "list users", method: http.MethodGet, path: "/api/user/"},
		{name: "search users", method: http.MethodGet, path: "/api/user/search?keyword=pen-admin"},
		{name: "manage user", method: http.MethodPost, path: "/api/user/manage", body: `{"id":1,"action":"promote"}`},
		{name: "create user", method: http.MethodPost, path: "/api/user/", body: `{"username":"escalated","password":"escalated-password-123","role":100}`},
		{name: "update user", method: http.MethodPut, path: "/api/user/", body: `{"id":1,"username":"root","role":100}`},
		{name: "delete user", method: http.MethodDelete, path: "/api/user/2"},
		{name: "read options", method: http.MethodGet, path: "/api/option/"},
		{name: "write options", method: http.MethodPut, path: "/api/option/", body: `{"key":"QuotaForNewUser","value":"999999"}`},
		{name: "list channels", method: http.MethodGet, path: "/api/channel/"},
		{name: "all logs", method: http.MethodGet, path: "/api/log/"},
		{name: "audit logs", method: http.MethodGet, path: "/api/audit"},
		{name: "redemptions", method: http.MethodGet, path: "/api/redemption/"},
		{name: "subscription admin", method: http.MethodGet, path: "/api/subscription/admin/plans"},
		{name: "model metadata", method: http.MethodGet, path: "/api/models/"},
		{name: "groups", method: http.MethodGet, path: "/api/group/"},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			response := sectionTestRequest(engine, tc.method, tc.path, clientToken, tc.body)
			assert.Equal(t, http.StatusForbidden, response.Code, response.Body.String())
			assert.Equal(t, "Unauthorized, insufficient privileges", decodeAPIEnvelope(t, response.Body.String()).Message)
		})
	}

	// Control: the same routes do answer an administrator, so the cases above
	// prove authorization rather than a broken router.
	t.Run("administrator still reaches the console", func(t *testing.T) {
		response := sectionTestRequest(engine, http.MethodGet, "/api/user/", adminToken, "")
		assert.Equal(t, http.StatusOK, response.Code, response.Body.String())
		assert.True(t, decodeAPIEnvelope(t, response.Body.String()).Success)
	})
}

func TestTamperedAccessTokenIsRejected(t *testing.T) {
	engine := setupVisibleSectionRouterTest(t)
	token := createSectionTestUser(t, "pen-token-user", common.RoleCommonUser, nil)
	parts := strings.Split(token, ".")
	require.Len(t, parts, 3)

	payload, err := base64.RawURLEncoding.DecodeString(parts[1])
	require.NoError(t, err)

	var claims map[string]any
	require.NoError(t, common.Unmarshal(payload, &claims))

	cases := []struct {
		name  string
		token string
	}{
		{
			// Change the subject to another user while keeping the signature.
			name: "identity swapped in payload",
			token: func() string {
				claims["sub"] = "1"
				claims["sid"] = "attacker-session"
				edited, err := common.Marshal(claims)
				require.NoError(t, err)
				return parts[0] + "." + base64.RawURLEncoding.EncodeToString(edited) + "." + parts[2]
			}(),
		},
		{
			// Classic alg:none forgery attempt.
			name:  "unsigned none algorithm",
			token: "eyJhbGciOiJub25lIiwidHlwIjoiSldUIn0." + parts[1] + ".",
		},
		{
			name:  "truncated signature",
			token: parts[0] + "." + parts[1] + "." + parts[2][:len(parts[2])-4],
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			response := sectionTestRequest(engine, http.MethodGet, "/api/user/self", tc.token, "")
			assert.Equal(t, http.StatusUnauthorized, response.Code, response.Body.String())
		})
	}

	// Control: the untampered token still authenticates.
	response := sectionTestRequest(engine, http.MethodGet, "/api/user/self", token, "")
	assert.Equal(t, http.StatusOK, response.Code, response.Body.String())
}

func TestCrossTenantTokenReadIsDenied(t *testing.T) {
	engine := setupVisibleSectionRouterTest(t)
	attackerToken := createSectionTestUser(t, "pen-attacker", common.RoleCommonUser, nil)

	// Control identity: owns the token the attacker tries to read.
	victimAccess := createSectionTestUser(t, "pen-victim", common.RoleCommonUser, nil)
	victim := model.User{}
	require.NoError(t, model.DB.Where("username = ?", "pen-victim").First(&victim).Error)
	victimToken := model.Token{
		UserId:         victim.Id,
		Name:           "victim-key",
		Key:            "sk-victim-key-value",
		CreatedTime:    common.GetTimestamp(),
		AccessedTime:   common.GetTimestamp(),
		ExpiredTime:    -1,
		RemainQuota:    1000,
		UnlimitedQuota: true,
	}
	require.NoError(t, victimToken.Insert())

	response := sectionTestRequest(engine, http.MethodGet, fmt.Sprintf("/api/token/%d", victimToken.Id), attackerToken, "")
	envelope := decodeAPIEnvelope(t, response.Body.String())
	assert.False(t, envelope.Success, response.Body.String())
	assert.NotContains(t, response.Body.String(), victimToken.Key)

	// The victim's own token is readable through the same endpoint, so the denial
	// above comes from ownership scoping rather than a broken route.
	response = sectionTestRequest(engine, http.MethodGet, fmt.Sprintf("/api/token/%d", victimToken.Id), victimAccess, "")
	assert.True(t, decodeAPIEnvelope(t, response.Body.String()).Success, response.Body.String())
}

func TestSelfLogEndpointsIgnoreForeignUserSelectors(t *testing.T) {
	engine := setupVisibleSectionRouterTest(t)
	require.NoError(t, model.LOG_DB.AutoMigrate(&model.Log{}))

	attackerToken := createSectionTestUser(t, "pen-log-attacker", common.RoleCommonUser, nil)
	victim := model.User{
		Username: "pen-log-victim",
		Password: "section-password-123",
		Role:     common.RoleCommonUser,
		Status:   common.UserStatusEnabled,
		Group:    "default",
		AffCode:  "aff-pen-log-victim",
	}
	require.NoError(t, model.DB.Create(&victim).Error)

	attacker := model.User{}
	require.NoError(t, model.DB.Where("username = ?", "pen-log-attacker").First(&attacker).Error)

	now := time.Now().Unix()
	require.NoError(t, model.LOG_DB.Create(&model.Log{
		UserId:    attacker.Id,
		CreatedAt: now,
		Type:      model.LogTypeConsume,
		Content:   "pen-log-attacker-row",
		Username:  attacker.Username,
		Other:     "{}",
	}).Error)
	require.NoError(t, model.LOG_DB.Create(&model.Log{
		UserId:    victim.Id,
		CreatedAt: now,
		Type:      model.LogTypeConsume,
		Content:   "pen-log-victim-row",
		Username:  victim.Username,
		Other:     "{}",
	}).Error)

	// The attacker guesses the victim's ids through every selector the endpoint
	// accepts; only rows owned by the authenticated user may come back.
	response := sectionTestRequest(
		engine,
		http.MethodGet,
		fmt.Sprintf("/api/log/self?user_id=%d&username=%s&p=1&page_size=100", victim.Id, victim.Username),
		attackerToken,
		"",
	)
	require.Equal(t, http.StatusOK, response.Code, response.Body.String())
	body := response.Body.String()
	assert.Contains(t, body, "pen-log-attacker-row")
	assert.NotContains(t, body, "pen-log-victim-row")
	assert.NotContains(t, body, victim.Username)
}
