package controller

import (
	"net/http"
	"net/http/httptest"
	"strconv"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/service/authz"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func channelBody(name string, baseURL string, setting string) string {
	body := `{"mode":"single","channel":{"type":1,"name":"` + name + `","key":"sk","models":"gpt-4o","group":"default"`
	if baseURL != "" {
		body += `,"base_url":"` + baseURL + `"`
	}
	if setting != "" {
		body += `,"setting":"` + setting + `"`
	}
	return body + `}}`
}

// An administrator must not be able to point a channel at the internal
// network: a compromised administrator session would otherwise turn the
// gateway into a proxy for the services that are only reachable from the
// deployment network.
func TestAddChannelRejectsInternalUpstreamForAdministrators(t *testing.T) {
	setupChannelControllerTest(t)

	for _, baseURL := range []string{
		"http://127.0.0.1:11434",
		"http://10.0.0.5:8000",
		"http://192.168.1.10:8000",
		"http://169.254.169.254/latest/meta-data",
		"http://100.64.0.1:8080",
	} {
		response := postAddChannel(t, 2, common.RoleAdminUser, channelBody("internal", baseURL, ""))
		assert.Equal(t, http.StatusForbidden, response.Code, response.Body.String())
		assert.Contains(t, response.Body.String(), "only the root account can use internal network upstreams", baseURL)
	}
}

func TestAddChannelAllowsInternalUpstreamForRoot(t *testing.T) {
	setupChannelControllerTest(t)

	response := postAddChannel(t, 1, common.RoleRootUser, channelBody("internal-root", "http://127.0.0.1:11434", ""))
	require.Equal(t, http.StatusOK, response.Code, response.Body.String())
	assert.Contains(t, response.Body.String(), `"success":true`)

	var channel model.Channel
	require.NoError(t, model.DB.Where("name = ?", "internal-root").First(&channel).Error)
	assert.True(t, channel.GetSetting().AllowPrivateNetwork)
}

// The internal network permission is a root only grant, so an administrator
// cannot smuggle it into the channel settings.
func TestAdministratorCannotGrantTheInternalNetworkPermission(t *testing.T) {
	setupChannelControllerTest(t)

	response := postAddChannel(t, 2, common.RoleAdminUser, channelBody("public-admin", "https://api.example.com", `{\"allow_private_network\":true}`))
	require.Equal(t, http.StatusOK, response.Code, response.Body.String())

	var channel model.Channel
	require.NoError(t, model.DB.Where("name = ?", "public-admin").First(&channel).Error)
	assert.False(t, channel.GetSetting().AllowPrivateNetwork)
}

func TestUpdateChannelRejectsInternalUpstreamForAdministrators(t *testing.T) {
	setupChannelControllerTest(t)

	createResponse := postAddChannel(t, 1, common.RoleRootUser, channelBody("updatable", "https://api.example.com", ""))
	require.Equal(t, http.StatusOK, createResponse.Code, createResponse.Body.String())

	var channel model.Channel
	require.NoError(t, model.DB.Where("name = ?", "updatable").First(&channel).Error)

	// The administrator holds the sensitive write permission, so the request
	// reaches the internal network policy instead of the permission check.
	require.NoError(t, model.DB.Create(&model.CasbinRule{
		Ptype: "p",
		V0:    authz.UserSubject(2),
		V1:    "channel",
		V2:    "sensitive_write",
		V3:    "allow",
	}).Error)
	require.NoError(t, authz.ReloadPolicy())

	gin.SetMode(gin.TestMode)
	recorder := httptest.NewRecorder()
	context, _ := gin.CreateTestContext(recorder)
	context.Set("id", 2)
	context.Set("role", common.RoleAdminUser)
	context.Params = gin.Params{{Key: "id", Value: strconv.Itoa(channel.Id)}}
	context.Request = httptest.NewRequest(http.MethodPut, "/api/channel/", strings.NewReader(`{"id":`+strconv.Itoa(channel.Id)+`,"base_url":"http://127.0.0.1:11434"}`))
	context.Request.Header.Set("Content-Type", "application/json")

	UpdateChannel(context)

	assert.Equal(t, http.StatusForbidden, recorder.Code, recorder.Body.String())
	assert.Contains(t, recorder.Body.String(), "only the root account can use internal network upstreams")
}

// Fetching the model list contacts an arbitrary base URL, so the internal
// network policy applies to it as well.
func TestFetchModelsRejectsInternalUpstreamForAdministrators(t *testing.T) {
	setupChannelControllerTest(t)

	gin.SetMode(gin.TestMode)
	recorder := httptest.NewRecorder()
	context, _ := gin.CreateTestContext(recorder)
	context.Set("id", 2)
	context.Set("role", common.RoleAdminUser)
	context.Request = httptest.NewRequest(http.MethodPost, "/api/channel/fetch_models", strings.NewReader(`{"type":1,"key":"sk","base_url":"http://127.0.0.1:11434"}`))
	context.Request.Header.Set("Content-Type", "application/json")

	FetchModels(context)

	assert.Equal(t, http.StatusForbidden, recorder.Code, recorder.Body.String())
	assert.Contains(t, recorder.Body.String(), "only the root account can use internal network upstreams")
}

// The root account may ask for the internal network permission explicitly, for
// example when the name of the internal host does not resolve yet.
func TestRootKeepsTheExplicitInternalNetworkPermission(t *testing.T) {
	setupChannelControllerTest(t)

	response := postAddChannel(t, 1, common.RoleRootUser, channelBody("public-root", "https://api.example.com", `{\"allow_private_network\":true}`))
	require.Equal(t, http.StatusOK, response.Code, response.Body.String())

	var channel model.Channel
	require.NoError(t, model.DB.Where("name = ?", "public-root").First(&channel).Error)
	assert.True(t, channel.GetSetting().AllowPrivateNetwork)
}

// A destination that is public again must not keep the internal network
// permission, otherwise a rebound public name could reach the internal
// network.
func TestInternalNetworkPermissionIsRemovedWhenTheTargetBecomesPublic(t *testing.T) {
	setupChannelControllerTest(t)

	createResponse := postAddChannel(t, 1, common.RoleRootUser, channelBody("switch-target", "http://127.0.0.1:11434", ""))
	require.Equal(t, http.StatusOK, createResponse.Code, createResponse.Body.String())

	var channel model.Channel
	require.NoError(t, model.DB.Where("name = ?", "switch-target").First(&channel).Error)
	require.True(t, channel.GetSetting().AllowPrivateNetwork)

	gin.SetMode(gin.TestMode)
	recorder := httptest.NewRecorder()
	context, _ := gin.CreateTestContext(recorder)
	context.Set("id", 1)
	context.Set("role", common.RoleRootUser)
	context.Params = gin.Params{{Key: "id", Value: strconv.Itoa(channel.Id)}}
	context.Request = httptest.NewRequest(http.MethodPut, "/api/channel/", strings.NewReader(`{"id":`+strconv.Itoa(channel.Id)+`,"base_url":"https://api.example.com"}`))
	context.Request.Header.Set("Content-Type", "application/json")

	UpdateChannel(context)

	require.Equal(t, http.StatusOK, recorder.Code, recorder.Body.String())

	var updated model.Channel
	require.NoError(t, model.DB.Where("id = ?", channel.Id).First(&updated).Error)
	assert.False(t, updated.GetSetting().AllowPrivateNetwork)
}
