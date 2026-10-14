package router

import (
	"errors"
	"fmt"
	"maps"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting/config"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"github.com/gin-gonic/gin"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

const validUpstreamSettingsBody = `{
	"target_groups":["default"],
	"model_aliases":{},
	"model_exclusions":{},
	"protocol_model_exclusions":{}
}`

type upstreamSettingsTestFixture struct {
	engine     *gin.Engine
	database   *gorm.DB
	rootToken  string
	adminToken string
	source     model.UpstreamSource
}

type upstreamSettingsEnvelope struct {
	Success bool                                            `json:"success"`
	Message string                                          `json:"message"`
	Data    *operation_setting.UpstreamOrchestrationSetting `json:"data"`
}

func TestManagedUpstreamSettingsAPIRouteAndRootAuthorization(t *testing.T) {
	fixture := newUpstreamSettingsTestFixture(t)

	found := false
	for _, route := range fixture.engine.Routes() {
		if route.Method == http.MethodPut && route.Path == "/api/upstream-orchestration/settings" {
			found = true
			break
		}
	}
	require.True(t, found, "settings update route must be registered")

	unauthenticated := fixture.request(http.MethodPut, validUpstreamSettingsBody, "")
	assert.Equal(t, http.StatusUnauthorized, unauthenticated.Code)

	admin := fixture.request(http.MethodPut, validUpstreamSettingsBody, fixture.adminToken)
	assert.Equal(t, http.StatusForbidden, admin.Code)
}

func TestManagedUpstreamSettingsAPIRejectsInvalidSnapshotsWithoutMutation(t *testing.T) {
	fixture := newUpstreamSettingsTestFixture(t)
	before := fixture.persistedPolicy(t)

	testCases := []struct {
		name string
		body string
	}{
		{name: "malformed JSON", body: `{"target_groups":`},
		{name: "missing snapshot field", body: `{"target_groups":["default"],"model_aliases":{},"model_exclusions":{}}`},
		{name: "empty target group", body: `{"target_groups":["  "],"model_aliases":{},"model_exclusions":{},"protocol_model_exclusions":{}}`},
		{name: "empty alias key", body: `{"target_groups":["default"],"model_aliases":{" ":"model"},"model_exclusions":{},"protocol_model_exclusions":{}}`},
		{name: "empty exclusion key", body: `{"target_groups":["default"],"model_aliases":{},"model_exclusions":{" ":["model"]},"protocol_model_exclusions":{}}`},
		{name: "empty exclusion value", body: `{"target_groups":["default"],"model_aliases":{},"model_exclusions":{"leyi:group":[" "]},"protocol_model_exclusions":{}}`},
		{name: "unsupported protocol", body: `{"target_groups":["default"],"model_aliases":{},"model_exclusions":{},"protocol_model_exclusions":{"gemini":["model"]}}`},
		{name: "oversized JSON", body: `{"target_groups":["` + strings.Repeat("x", 300_000) + `"],"model_aliases":{},"model_exclusions":{},"protocol_model_exclusions":{}}`},
	}
	for _, testCase := range testCases {
		t.Run(testCase.name, func(t *testing.T) {
			response := fixture.request(http.MethodPut, testCase.body, fixture.rootToken)

			assert.Equal(t, http.StatusOK, response.Code)
			envelope := decodeUpstreamSettingsEnvelope(t, response)
			assert.False(t, envelope.Success)
			assert.NotEmpty(t, envelope.Message)
			assert.Equal(t, before, fixture.persistedPolicy(t))
			assert.Equal(t, []string{"original"}, operation_setting.GetUpstreamOrchestrationSetting().TargetGroups)
		})
	}
}

func TestManagedUpstreamSettingsAPIRollsBackAllFieldsWhenPersistenceFails(t *testing.T) {
	fixture := newUpstreamSettingsTestFixture(t)
	before := fixture.persistedPolicy(t)
	updateCount := 0
	require.NoError(t, fixture.database.Callback().Update().Before("gorm:update").Register(
		"test:reject_upstream_settings",
		func(tx *gorm.DB) {
			if tx.Statement.Table == "options" {
				updateCount++
				if updateCount == 3 {
					tx.AddError(errors.New("secret database failure"))
				}
			}
		},
	))
	t.Cleanup(func() {
		require.NoError(t, fixture.database.Callback().Update().Remove("test:reject_upstream_settings"))
	})

	response := fixture.request(http.MethodPut, `{
		"target_groups":["new"],
		"model_aliases":{"public":"actual"},
		"model_exclusions":{"leyi:group":["blocked"]},
		"protocol_model_exclusions":{"openai":["blocked"]}
	}`, fixture.rootToken)

	assert.Equal(t, http.StatusOK, response.Code)
	envelope := decodeUpstreamSettingsEnvelope(t, response)
	assert.False(t, envelope.Success)
	assert.Equal(t, "failed to save upstream settings", envelope.Message)
	assert.NotContains(t, response.Body.String(), "secret database failure")
	assert.Equal(t, 3, updateCount)
	assert.Equal(t, before, fixture.persistedPolicy(t))
	setting := operation_setting.GetUpstreamOrchestrationSetting()
	assert.Equal(t, []string{"original"}, setting.TargetGroups)
	assert.Equal(t, map[string]string{"old": "model"}, setting.ModelAliases)
}

func TestManagedUpstreamSettingsAPIPersistsNormalizedSnapshotAndReturnsReadback(t *testing.T) {
	fixture := newUpstreamSettingsTestFixture(t)

	response := fixture.request(http.MethodPut, `{
		"target_groups":[" default ","vip","default"],
		"model_aliases":{" public-model ":" upstream-model "," isolated-model ":" "},
		"model_exclusions":{" leyi:paid ":[" model-a ","model-a","model-b"]},
		"protocol_model_exclusions":{" LEYI:paid:OPENAI ":[" model-c ","model-c"]}
	}`, fixture.rootToken)

	assert.Equal(t, http.StatusOK, response.Code)
	envelope := decodeUpstreamSettingsEnvelope(t, response)
	require.True(t, envelope.Success, envelope.Message)
	require.NotNil(t, envelope.Data)
	assert.Equal(t, []string{"default", "vip"}, envelope.Data.TargetGroups)
	assert.Equal(t, map[string]string{"isolated-model": "", "public-model": "upstream-model"}, envelope.Data.ModelAliases)
	assert.Equal(t, map[string][]string{"leyi:paid": {"model-a", "model-b"}}, envelope.Data.ModelExclusions)
	assert.Equal(t, map[string][]string{"leyi:paid:openai": {"model-c"}}, envelope.Data.ProtocolModelExclusions)

	persisted := fixture.persistedPolicy(t)
	assert.JSONEq(t, `["default","vip"]`, persisted["upstream_orchestration.target_groups"])
	assert.JSONEq(t, `{"isolated-model":"","public-model":"upstream-model"}`, persisted["upstream_orchestration.model_aliases"])
	assert.JSONEq(t, `{"leyi:paid":["model-a","model-b"]}`, persisted["upstream_orchestration.model_exclusions"])
	assert.JSONEq(t, `{"leyi:paid:openai":["model-c"]}`, persisted["upstream_orchestration.protocol_model_exclusions"])

	readback := operation_setting.GetUpstreamOrchestrationSetting()
	assert.Equal(t, envelope.Data.TargetGroups, readback.TargetGroups)
	assert.Equal(t, envelope.Data.ModelAliases, readback.ModelAliases)
	assert.Equal(t, envelope.Data.ModelExclusions, readback.ModelExclusions)
	assert.Equal(t, envelope.Data.ProtocolModelExclusions, readback.ProtocolModelExclusions)
}

func TestManagedUpstreamSourceAPIRollsBackSourceOptionsAndRuntimeTogether(t *testing.T) {
	fixture := newUpstreamSettingsTestFixture(t)
	beforeOptions := fixture.persistedPolicy(t)
	beforeSetting := operation_setting.GetUpstreamOrchestrationSetting()
	common.OptionMapRWMutex.RLock()
	beforeOptionMap := maps.Clone(common.OptionMap)
	common.OptionMapRWMutex.RUnlock()
	var beforeSource model.UpstreamSource
	require.NoError(t, fixture.database.First(&beforeSource, fixture.source.ID).Error)

	updateCount := 0
	const callbackName = "test:reject_upstream_source_options"
	require.NoError(t, fixture.database.Callback().Update().Before("gorm:update").Register(
		callbackName,
		func(tx *gorm.DB) {
			if tx.Statement.Table == "options" {
				updateCount++
				if updateCount == 3 {
					tx.AddError(errors.New("secret database failure"))
				}
			}
		},
	))
	t.Cleanup(func() {
		require.NoError(t, fixture.database.Callback().Update().Remove(callbackName))
	})

	response := fixture.requestPath(http.MethodPut,
		fmt.Sprintf("/api/upstream-orchestration/sources/%d", fixture.source.ID),
		`{
			"enabled":false,
			"low_balance_threshold":12.5,
			"static_egress_ips":["198.51.100.10"],
			"model_aliases":{"public":"actual"},
			"model_exclusions":{"leyi:paid":["blocked-new"]},
			"protocol_model_exclusions":{"openai":["blocked-new"]}
		}`,
		fixture.rootToken,
	)

	assert.Equal(t, http.StatusOK, response.Code)
	var envelope struct {
		Success bool `json:"success"`
	}
	require.NoError(t, common.Unmarshal(response.Body.Bytes(), &envelope))
	assert.False(t, envelope.Success)
	assert.Equal(t, 3, updateCount)
	assert.Equal(t, beforeOptions, fixture.persistedPolicy(t))
	var afterSource model.UpstreamSource
	require.NoError(t, fixture.database.First(&afterSource, fixture.source.ID).Error)
	assert.Equal(t, beforeSource, afterSource)
	assert.Equal(t, beforeSetting, operation_setting.GetUpstreamOrchestrationSetting())
	common.OptionMapRWMutex.RLock()
	assert.Equal(t, beforeOptionMap, common.OptionMap)
	common.OptionMapRWMutex.RUnlock()
}

func TestManagedUpstreamSourceAPIPrevalidatesEveryFieldBeforeMutation(t *testing.T) {
	fixture := newUpstreamSettingsTestFixture(t)
	beforeOptions := fixture.persistedPolicy(t)
	var beforeSource model.UpstreamSource
	require.NoError(t, fixture.database.First(&beforeSource, fixture.source.ID).Error)
	updateCount := 0
	const callbackName = "test:count_invalid_upstream_source_updates"
	require.NoError(t, fixture.database.Callback().Update().Before("gorm:update").Register(
		callbackName,
		func(*gorm.DB) {
			updateCount++
		},
	))
	t.Cleanup(func() {
		require.NoError(t, fixture.database.Callback().Update().Remove(callbackName))
	})

	response := fixture.requestPath(http.MethodPut,
		fmt.Sprintf("/api/upstream-orchestration/sources/%d", fixture.source.ID),
		`{
			"enabled":false,
			"static_egress_ips":["198.51.100.10"],
			"model_aliases":{" public ":"first","public":"second"}
		}`,
		fixture.rootToken,
	)

	assert.Equal(t, http.StatusOK, response.Code)
	var envelope struct {
		Success bool `json:"success"`
	}
	require.NoError(t, common.Unmarshal(response.Body.Bytes(), &envelope))
	assert.False(t, envelope.Success)
	assert.Zero(t, updateCount)
	assert.Equal(t, beforeOptions, fixture.persistedPolicy(t))
	var afterSource model.UpstreamSource
	require.NoError(t, fixture.database.First(&afterSource, fixture.source.ID).Error)
	assert.Equal(t, beforeSource, afterSource)
}

func TestManagedUpstreamSourceAPICommitsSourceOptionsAndRuntimeTogether(t *testing.T) {
	fixture := newUpstreamSettingsTestFixture(t)

	response := fixture.requestPath(http.MethodPut,
		fmt.Sprintf("/api/upstream-orchestration/sources/%d", fixture.source.ID),
		`{
			"enabled":false,
			"low_balance_threshold":12.5,
			"static_egress_ips":[" 198.51.100.10 "],
			"model_aliases":{" public ":" actual "},
			"model_exclusions":{" leyi:paid ":[" blocked-new "]},
			"protocol_model_exclusions":{" LEYI:paid:OPENAI ":[" blocked-protocol "]}
		}`,
		fixture.rootToken,
	)

	assert.Equal(t, http.StatusOK, response.Code)
	var envelope struct {
		Success bool   `json:"success"`
		Message string `json:"message"`
	}
	require.NoError(t, common.Unmarshal(response.Body.Bytes(), &envelope))
	require.True(t, envelope.Success, envelope.Message)

	var source model.UpstreamSource
	require.NoError(t, fixture.database.First(&source, fixture.source.ID).Error)
	assert.False(t, source.Enabled)
	assert.Equal(t, 12.5, source.LowBalanceThreshold)
	persisted := fixture.persistedPolicy(t)
	assert.JSONEq(t, `{"leyi":["198.51.100.10"]}`, persisted["upstream_orchestration.static_egress_ips"])
	assert.JSONEq(t, `{"public":"actual"}`, persisted["upstream_orchestration.model_aliases"])
	assert.JSONEq(t, `{"leyi:paid":["blocked-new"]}`, persisted["upstream_orchestration.model_exclusions"])
	assert.JSONEq(t, `{"leyi:paid:openai":["blocked-protocol"]}`, persisted["upstream_orchestration.protocol_model_exclusions"])

	setting := operation_setting.GetUpstreamOrchestrationSetting()
	assert.Equal(t, map[string][]string{"leyi": {"198.51.100.10"}}, setting.StaticEgressIPs)
	assert.Equal(t, map[string]string{"public": "actual"}, setting.ModelAliases)
	assert.Equal(t, map[string][]string{"leyi:paid": {"blocked-new"}}, setting.ModelExclusions)
	assert.Equal(t, map[string][]string{"leyi:paid:openai": {"blocked-protocol"}}, setting.ProtocolModelExclusions)
	common.OptionMapRWMutex.RLock()
	assert.JSONEq(t, `{"leyi":["198.51.100.10"]}`, common.OptionMap["upstream_orchestration.static_egress_ips"])
	assert.JSONEq(t, `{"public":"actual"}`, common.OptionMap["upstream_orchestration.model_aliases"])
	assert.JSONEq(t, `{"leyi:paid":["blocked-new"]}`, common.OptionMap["upstream_orchestration.model_exclusions"])
	assert.JSONEq(t, `{"leyi:paid:openai":["blocked-protocol"]}`, common.OptionMap["upstream_orchestration.protocol_model_exclusions"])
	common.OptionMapRWMutex.RUnlock()
}

func newUpstreamSettingsTestFixture(t *testing.T) upstreamSettingsTestFixture {
	t.Helper()
	previousDB, previousLogDB := model.DB, model.LOG_DB
	previousType := common.MainDatabaseType()
	previousRedis := common.RedisEnabled
	previousOptions := maps.Clone(common.OptionMap)
	previousSetting, err := config.ConfigToMap(operation_setting.GetUpstreamOrchestrationSetting())
	require.NoError(t, err)

	database, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	require.NoError(t, err)
	sqlDB, err := database.DB()
	require.NoError(t, err)
	sqlDB.SetMaxOpenConns(1)
	require.NoError(t, database.AutoMigrate(&model.Option{}, &model.User{}, &model.AuditLog{}, &model.UpstreamSource{}))
	model.DB, model.LOG_DB = database, database
	common.SetMainDatabaseType(common.DatabaseTypeSQLite)
	common.RedisEnabled = false

	initial := map[string]string{
		"upstream_orchestration.target_groups":             `["original"]`,
		"upstream_orchestration.static_egress_ips":         `{"leyi":["192.0.2.10"]}`,
		"upstream_orchestration.model_aliases":             `{"old":"model"}`,
		"upstream_orchestration.model_exclusions":          `{"leyi:old":["blocked"]}`,
		"upstream_orchestration.protocol_model_exclusions": `{"openai":["blocked"]}`,
	}
	rows := make([]model.Option, 0, len(initial))
	for key, value := range initial {
		rows = append(rows, model.Option{Key: key, Value: value})
	}
	require.NoError(t, database.Create(&rows).Error)
	loaded, err := config.GlobalConfig.UpdateFromMap("upstream_orchestration", map[string]string{
		"target_groups":             initial["upstream_orchestration.target_groups"],
		"model_aliases":             initial["upstream_orchestration.model_aliases"],
		"model_exclusions":          initial["upstream_orchestration.model_exclusions"],
		"protocol_model_exclusions": initial["upstream_orchestration.protocol_model_exclusions"],
		"static_egress_ips":         initial["upstream_orchestration.static_egress_ips"],
	})
	require.NoError(t, err)
	require.True(t, loaded)
	common.OptionMapRWMutex.Lock()
	common.OptionMap = maps.Clone(initial)
	common.OptionMapRWMutex.Unlock()

	rootToken := "upstream-settings-root-token"
	adminToken := "upstream-settings-admin-token"
	require.NoError(t, database.Create(&[]model.User{
		{Username: "upstream-settings-root", Role: common.RoleRootUser, Status: common.UserStatusEnabled, Group: "default", AccessToken: &rootToken, AuthVersion: 1, AffCode: "upstream-settings-root"},
		{Username: "upstream-settings-admin", Role: common.RoleAdminUser, Status: common.UserStatusEnabled, Group: "default", AccessToken: &adminToken, AuthVersion: 1, AffCode: "upstream-settings-admin"},
	}).Error)
	source := model.UpstreamSource{
		Key: "leyi", Name: "Leyi", ConsoleURL: "https://console.example",
		Status: "unknown", Enabled: true, LowBalanceThreshold: 5,
		CreatedAt: 1, UpdatedAt: 1,
	}
	require.NoError(t, database.Create(&source).Error)

	gin.SetMode(gin.TestMode)
	engine := gin.New()
	registerUpstreamOrchestrationRoutes(engine.Group("/api"))

	t.Cleanup(func() {
		model.DB, model.LOG_DB = previousDB, previousLogDB
		common.SetMainDatabaseType(previousType)
		common.RedisEnabled = previousRedis
		common.OptionMapRWMutex.Lock()
		common.OptionMap = previousOptions
		common.OptionMapRWMutex.Unlock()
		_, restoreErr := config.GlobalConfig.UpdateFromMap("upstream_orchestration", previousSetting)
		require.NoError(t, restoreErr)
		require.NoError(t, sqlDB.Close())
	})
	return upstreamSettingsTestFixture{
		engine:     engine,
		database:   database,
		rootToken:  rootToken,
		adminToken: adminToken,
		source:     source,
	}
}

func (fixture upstreamSettingsTestFixture) request(method, body, token string) *httptest.ResponseRecorder {
	return fixture.requestPath(method, "/api/upstream-orchestration/settings", body, token)
}

func (fixture upstreamSettingsTestFixture) requestPath(method, path, body, token string) *httptest.ResponseRecorder {
	request := httptest.NewRequest(method, path, strings.NewReader(body))
	request.Header.Set("Content-Type", "application/json")
	if token != "" {
		request.Header.Set("Authorization", "Bearer "+token)
	}
	response := httptest.NewRecorder()
	fixture.engine.ServeHTTP(response, request)
	return response
}

func (fixture upstreamSettingsTestFixture) persistedPolicy(t *testing.T) map[string]string {
	t.Helper()
	var options []model.Option
	require.NoError(t, fixture.database.Where("key LIKE ?", "upstream_orchestration.%").Find(&options).Error)
	result := make(map[string]string, len(options))
	for _, option := range options {
		result[option.Key] = option.Value
	}
	return result
}

func decodeUpstreamSettingsEnvelope(t *testing.T, response *httptest.ResponseRecorder) upstreamSettingsEnvelope {
	t.Helper()
	var envelope upstreamSettingsEnvelope
	require.NoError(t, common.Unmarshal(response.Body.Bytes(), &envelope), response.Body.String())
	return envelope
}
