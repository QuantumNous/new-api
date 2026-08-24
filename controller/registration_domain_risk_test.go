package controller

import (
	"bytes"
	"net/http"
	"net/http/httptest"
	"strconv"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting/system_setting"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
)

func createRegistrationDomainIncident(t *testing.T, domain string) (model.RegistrationDomainRiskResult, []model.User) {
	t.Helper()
	now := time.Now().Unix()
	users := []model.User{
		{Username: domain + "-one", AffCode: domain + "-a", Email: "one@" + domain, EmailDomain: domain, Status: common.UserStatusEnabled, Role: common.RoleCommonUser, CreatedAt: now - 60},
		{Username: domain + "-two", AffCode: domain + "-b", Email: "two@" + domain, EmailDomain: domain, Status: common.UserStatusEnabled, Role: common.RoleCommonUser, CreatedAt: now - 60},
	}
	for i := range users {
		require.NoError(t, model.DB.Create(&users[i]).Error)
	}
	candidate := model.User{Username: domain + "-trigger", Email: "trigger@" + domain, EmailDomain: domain, Status: common.UserStatusEnabled, Role: common.RoleCommonUser}
	result, err := model.RegisterUserWithDomainRisk(&candidate, 0, "203.0.113.20", model.RegistrationDomainRiskPolicy{
		Enabled: true, Window: 24 * time.Hour, Threshold: 3, Now: now,
	}, nil)
	require.ErrorIs(t, err, model.ErrRegistrationDomainBlocked)
	return result, users
}

func performRegistrationDomainAdminRequest(t *testing.T, method string, path string, body []byte, handler gin.HandlerFunc, params gin.Params) *httptest.ResponseRecorder {
	t.Helper()
	gin.SetMode(gin.TestMode)
	recorder := httptest.NewRecorder()
	context, _ := gin.CreateTestContext(recorder)
	context.Request = httptest.NewRequest(method, path, bytes.NewReader(body))
	context.Params = params
	context.Set("id", 99)
	handler(context)
	return recorder
}

func TestRegistrationDomainRiskAdminListAndDetail(t *testing.T) {
	db := setupModelListControllerTestDB(t)
	require.NoError(t, db.AutoMigrate(&model.Option{}))
	incident, _ := createRegistrationDomainIncident(t, "list.example")

	listRecorder := performRegistrationDomainAdminRequest(t, http.MethodGet, "/api/registration-domain-risk/blocks?p=1&page_size=10", nil, GetRegistrationDomainBlocks, nil)
	var listPayload struct {
		Success bool `json:"success"`
		Data    struct {
			Total int                             `json:"total"`
			Items []model.RegistrationDomainBlock `json:"items"`
		} `json:"data"`
	}
	require.NoError(t, common.Unmarshal(listRecorder.Body.Bytes(), &listPayload))
	require.True(t, listPayload.Success)
	require.Equal(t, 1, listPayload.Data.Total)
	require.Len(t, listPayload.Data.Items, 1)
	require.EqualValues(t, 2, listPayload.Data.Items[0].AffectedUserCount)

	detailRecorder := performRegistrationDomainAdminRequest(t, http.MethodGet, "/api/registration-domain-risk/blocks/"+strconv.Itoa(incident.BlockID)+"?p=2&page_size=1", nil, GetRegistrationDomainBlock, gin.Params{{Key: "id", Value: strconv.Itoa(incident.BlockID)}})
	var detailPayload struct {
		Success bool                                `json:"success"`
		Data    model.RegistrationDomainBlockDetail `json:"data"`
	}
	require.NoError(t, common.Unmarshal(detailRecorder.Body.Bytes(), &detailPayload))
	require.True(t, detailPayload.Success)
	require.Equal(t, incident.BlockID, detailPayload.Data.Block.Id)
	require.Len(t, detailPayload.Data.Users, 1)
	require.EqualValues(t, 2, detailPayload.Data.UserTotal)
	require.Equal(t, 2, detailPayload.Data.UserPage)
	require.Equal(t, 1, detailPayload.Data.UserPageSize)

	negativePageSizeRecorder := performRegistrationDomainAdminRequest(t, http.MethodGet, "/api/registration-domain-risk/blocks/"+strconv.Itoa(incident.BlockID)+"?p=2&page_size=-1", nil, GetRegistrationDomainBlock, gin.Params{{Key: "id", Value: strconv.Itoa(incident.BlockID)}})
	require.NoError(t, common.Unmarshal(negativePageSizeRecorder.Body.Bytes(), &detailPayload))
	require.True(t, detailPayload.Success)
	require.Equal(t, 2, detailPayload.Data.UserPage)
	require.Equal(t, common.ItemsPerPage, detailPayload.Data.UserPageSize)

	negativePageRecorder := performRegistrationDomainAdminRequest(t, http.MethodGet, "/api/registration-domain-risk/blocks/"+strconv.Itoa(incident.BlockID)+"?p=-1&page_size=1", nil, GetRegistrationDomainBlock, gin.Params{{Key: "id", Value: strconv.Itoa(incident.BlockID)}})
	require.NoError(t, common.Unmarshal(negativePageRecorder.Body.Bytes(), &detailPayload))
	require.True(t, detailPayload.Success)
	require.Equal(t, 1, detailPayload.Data.UserPage)
	require.Equal(t, 1, detailPayload.Data.UserPageSize)
	require.Len(t, detailPayload.Data.Users, 1)
}

func TestRegistrationDomainRiskAdminReleaseRestoresAndTrusts(t *testing.T) {
	db := setupModelListControllerTestDB(t)
	require.NoError(t, db.AutoMigrate(&model.Option{}))
	originalOptionMap := common.OptionMap
	common.OptionMap = map[string]string{}
	t.Cleanup(func() { common.OptionMap = originalOptionMap })
	withRegistrationSecurityConfig(t, map[string]string{
		"registration_security.domain_risk_enabled":            "true",
		"registration_security.domain_risk_window_hours":       "24",
		"registration_security.domain_risk_threshold":          "10",
		"registration_security.trusted_email_domains":          "[]",
		"registration_security.reject_subdomain_email_domains": "false",
	})
	incident, users := createRegistrationDomainIncident(t, "recover.example")
	body, err := common.Marshal(map[string]bool{"restore_users": true, "add_trusted_domain": true})
	require.NoError(t, err)

	recorder := performRegistrationDomainAdminRequest(t, http.MethodPost, "/api/registration-domain-risk/blocks/1/release", body, ReleaseRegistrationDomainBlock, gin.Params{{Key: "id", Value: strconv.Itoa(incident.BlockID)}})
	var payload struct {
		Success bool                                  `json:"success"`
		Data    model.RegistrationDomainReleaseResult `json:"data"`
	}
	require.NoError(t, common.Unmarshal(recorder.Body.Bytes(), &payload))
	require.True(t, payload.Success)
	require.EqualValues(t, 2, payload.Data.RestoredUsers)
	require.True(t, system_setting.GetRegistrationSecuritySettings().IsTrustedDomain("recover.example"))
	for _, user := range users {
		var stored model.User
		require.NoError(t, db.First(&stored, user.Id).Error)
		require.Equal(t, common.UserStatusEnabled, stored.Status)
	}

	repeated := performRegistrationDomainAdminRequest(t, http.MethodPost, "/api/registration-domain-risk/blocks/1/release", body, ReleaseRegistrationDomainBlock, gin.Params{{Key: "id", Value: strconv.Itoa(incident.BlockID)}})
	require.NoError(t, common.Unmarshal(repeated.Body.Bytes(), &payload))
	require.True(t, payload.Success)
	require.Zero(t, payload.Data.RestoredUsers)
}

func TestRegistrationSecurityOptionsSupportAtomicBulkSave(t *testing.T) {
	for _, key := range []string{
		"registration_security.domain_risk_enabled",
		"registration_security.domain_risk_window_hours",
		"registration_security.domain_risk_threshold",
		"registration_security.trusted_email_domains",
		"registration_security.reject_subdomain_email_domains",
	} {
		require.True(t, isBulkOptionUpdateKey(key), key)
	}
}

func TestRegistrationDomainRiskAdminReleaseOnlyKeepsUsersDisabled(t *testing.T) {
	db := setupModelListControllerTestDB(t)
	require.NoError(t, db.AutoMigrate(&model.Option{}))
	incident, users := createRegistrationDomainIncident(t, "observe.example")
	body, err := common.Marshal(map[string]bool{"restore_users": false, "add_trusted_domain": false})
	require.NoError(t, err)

	recorder := performRegistrationDomainAdminRequest(t, http.MethodPost, "/api/registration-domain-risk/blocks/1/release", body, ReleaseRegistrationDomainBlock, gin.Params{{Key: "id", Value: strconv.Itoa(incident.BlockID)}})
	var payload struct {
		Success bool                                  `json:"success"`
		Data    model.RegistrationDomainReleaseResult `json:"data"`
	}
	require.NoError(t, common.Unmarshal(recorder.Body.Bytes(), &payload))
	require.True(t, payload.Success)
	require.Zero(t, payload.Data.RestoredUsers)
	require.False(t, system_setting.GetRegistrationSecuritySettings().IsTrustedDomain("observe.example"))
	for _, user := range users {
		var stored model.User
		require.NoError(t, db.First(&stored, user.Id).Error)
		require.Equal(t, common.UserStatusDisabled, stored.Status)
	}
	var state model.RegistrationDomainState
	require.NoError(t, db.First(&state, "domain = ?", "observe.example").Error)
	require.Zero(t, state.ActiveBlockID)
	require.NotZero(t, state.CountingSince)
}
