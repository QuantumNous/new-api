package controller

import (
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/pkg/jsplugin"
	"github.com/QuantumNous/new-api/service/authz"
	"github.com/gin-gonic/gin"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func setupTaskPluginBindChannelTest(t *testing.T) {
	t.Helper()
	wasMaster := common.IsMasterNode
	common.IsMasterNode = true
	previousRedisEnabled := common.RedisEnabled
	common.RedisEnabled = false
	originalDB, originalLogDB := model.DB, model.LOG_DB
	database, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	require.NoError(t, err)
	sqlDB, err := database.DB()
	require.NoError(t, err)
	sqlDB.SetMaxOpenConns(1)
	require.NoError(t, database.AutoMigrate(&model.Channel{}, &model.Ability{}, &model.CasbinRule{}, &model.AuthzRole{}, &model.Log{}, &model.User{}))
	model.DB = database
	model.LOG_DB = database
	require.NoError(t, authz.Init(database))
	t.Cleanup(func() {
		common.IsMasterNode = wasMaster
		common.RedisEnabled = previousRedisEnabled
		model.DB = originalDB
		model.LOG_DB = originalLogDB
	})
}

func postAddChannel(t *testing.T, userID, role int, body string) *httptest.ResponseRecorder {
	t.Helper()
	gin.SetMode(gin.TestMode)
	recorder := httptest.NewRecorder()
	context, _ := gin.CreateTestContext(recorder)
	context.Set("id", userID)
	context.Set("role", role)
	context.Request = httptest.NewRequest(http.MethodPost, "/api/channel", strings.NewReader(body))
	context.Request.Header.Set("Content-Type", "application/json")
	AddChannel(context)
	return recorder
}

func TestAddChannelTaskPluginRequiresBindPermission(t *testing.T) {
	setupTaskPluginBindChannelTest(t)
	const key = "channel-bind"
	source := `
export const meta = {apiVersion: 1, key: "channel-bind", name: "Bind", version: "1.0.0", author: {name: "Test"}, models: ["doc"], fetchMode: "per_task"};
export function buildSubmitRequest() { return {}; }
export function parseSubmitResponse() { return {}; }
export function buildQueryRequest() { return {}; }
export function parseTaskResult() { return {}; }
`
	_, err := jsplugin.DefaultRegistry.Register(source, jsplugin.Options{})
	require.NoError(t, err)
	t.Cleanup(func() { jsplugin.DefaultRegistry.Unregister(key) })

	taskPluginBody := `{"mode":"single","channel":{"type":61,"name":"plugin-channel","key":"sk","models":"doc","group":"default","base_url":"https://example.com","setting":"{\"task_plugin_key\":\"channel-bind\"}"}}`
	openaiBody := `{"mode":"single","channel":{"type":1,"name":"openai-channel","key":"sk","models":"gpt","group":"default"}}`

	adminDenied := postAddChannel(t, 2, common.RoleAdminUser, taskPluginBody)
	assert.Contains(t, adminDenied.Body.String(), "task plugin channels require the task_plugin.bind permission")
	assert.Contains(t, adminDenied.Body.String(), `"success":false`)

	rootAllowed := postAddChannel(t, 1, common.RoleRootUser, taskPluginBody)
	assert.Contains(t, rootAllowed.Body.String(), `"success":true`)
	assert.NotContains(t, rootAllowed.Body.String(), "task_plugin.bind")

	adminOtherType := postAddChannel(t, 2, common.RoleAdminUser, openaiBody)
	assert.Contains(t, adminOtherType.Body.String(), `"success":true`)
	assert.NotContains(t, adminOtherType.Body.String(), "task_plugin.bind")
}

func TestUpdateChannelTaskPluginRequiresBindPermission(t *testing.T) {
	setupTaskPluginBindChannelTest(t)
	const key = "channel-bind-update"
	source := `
export const meta = {apiVersion: 1, key: "channel-bind-update", name: "Bind", version: "1.0.0", author: {name: "Test"}, models: ["doc"], fetchMode: "per_task"};
export function buildSubmitRequest() { return {}; }
export function parseSubmitResponse() { return {}; }
export function buildQueryRequest() { return {}; }
export function parseTaskResult() { return {}; }
`
	_, err := jsplugin.DefaultRegistry.Register(source, jsplugin.Options{})
	require.NoError(t, err)
	t.Cleanup(func() { jsplugin.DefaultRegistry.Unregister(key) })

	baseURL := "https://example.com"
	setting := `{"task_plugin_key":"channel-bind-update"}`
	channel := model.Channel{
		Type:    constant.ChannelTypeTaskPlugin,
		Status:  common.ChannelStatusEnabled,
		Name:    "existing-plugin",
		Models:  "doc",
		Group:   "default",
		Key:     "sk",
		BaseURL: &baseURL,
		Setting: &setting,
	}
	require.NoError(t, channel.Insert())

	payload := fmt.Sprintf(
		`{"id":%d,"type":61,"name":"existing-plugin","key":"sk","models":"doc","group":"default","base_url":"https://example.com","setting":"{\"task_plugin_key\":\"channel-bind-update\"}"}`,
		channel.Id,
	)
	gin.SetMode(gin.TestMode)
	recorder := httptest.NewRecorder()
	context, _ := gin.CreateTestContext(recorder)
	context.Set("id", 2)
	context.Set("role", common.RoleAdminUser)
	context.Request = httptest.NewRequest(http.MethodPut, "/api/channel", strings.NewReader(payload))
	context.Request.Header.Set("Content-Type", "application/json")
	UpdateChannel(context)
	assert.Contains(t, recorder.Body.String(), "task plugin channels require the task_plugin.bind permission")
	assert.Contains(t, recorder.Body.String(), `"success":false`)
}
