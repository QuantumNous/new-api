package controller

import (
	"bytes"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting"
	"github.com/QuantumNous/new-api/setting/ratio_setting"
	"github.com/gin-gonic/gin"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func validGroupOptionsUpdateRequest() GroupOptionsUpdateRequest {
	return GroupOptionsUpdateRequest{
		GroupRatio:              `{"codex1":1}`,
		GroupDisplayNames:       `{"codex1":"Codex Plus"}`,
		TopupGroupRatio:         `{"codex1":1}`,
		UserUsableGroups:        `{"codex1":"For Codex users"}`,
		GroupGroupRatio:         `{}`,
		AutoGroups:              `[]`,
		DefaultUseAutoGroup:     false,
		GroupSpecialUsableGroup: `{}`,
		ChangedKeys:             []string{"GroupRatio"},
	}
}

type groupOptionsUpdateResponse struct {
	Success bool   `json:"success"`
	Message string `json:"message"`
}

func setupGroupOptionsUpdateTest(t *testing.T) *gorm.DB {
	t.Helper()
	previousDB := model.DB
	previousLogDB := model.LOG_DB
	previousRedisEnabled := common.RedisEnabled
	previousGroupRatio := ratio_setting.GroupRatio2JSONString()
	previousAutoGroups := setting.AutoGroups2JsonString()
	common.OptionMapRWMutex.RLock()
	previousOptionMap := make(map[string]string, len(common.OptionMap))
	for key, value := range common.OptionMap {
		previousOptionMap[key] = value
	}
	common.OptionMapRWMutex.RUnlock()
	t.Cleanup(func() {
		model.DB = previousDB
		model.LOG_DB = previousLogDB
		common.RedisEnabled = previousRedisEnabled
		require.NoError(t, ratio_setting.UpdateGroupRatioByJSONString(previousGroupRatio))
		require.NoError(t, setting.UpdateAutoGroupsByJsonString(previousAutoGroups))
		common.OptionMapRWMutex.Lock()
		common.OptionMap = previousOptionMap
		common.OptionMapRWMutex.Unlock()
	})

	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	require.NoError(t, err)
	require.NoError(t, db.AutoMigrate(&model.Option{}, &model.User{}, &model.Log{}))
	model.DB = db
	model.LOG_DB = db
	common.RedisEnabled = false
	common.OptionMapRWMutex.Lock()
	common.OptionMap = make(map[string]string)
	common.OptionMapRWMutex.Unlock()
	return db
}

func performGroupOptionsUpdate(t *testing.T, request GroupOptionsUpdateRequest) (*httptest.ResponseRecorder, groupOptionsUpdateResponse) {
	t.Helper()
	body, err := common.Marshal(request)
	require.NoError(t, err)
	recorder := httptest.NewRecorder()
	context, _ := gin.CreateTestContext(recorder)
	context.Set("id", 1)
	context.Request = httptest.NewRequest(http.MethodPut, "/api/option/group", bytes.NewReader(body))
	context.Request.Header.Set("Content-Type", "application/json")

	UpdateGroupOptions(context)

	var response groupOptionsUpdateResponse
	require.NoError(t, common.Unmarshal(recorder.Body.Bytes(), &response))
	return recorder, response
}

func TestValidateGroupOptionsUpdateAcceptsLegacyDisplayNames(t *testing.T) {
	request := validGroupOptionsUpdateRequest()
	request.GroupDisplayNames = `{}`

	require.NoError(t, validateGroupOptionsUpdate(request))
}

func TestValidateGroupOptionsUpdateRejectsBlankIdentifier(t *testing.T) {
	request := validGroupOptionsUpdateRequest()
	request.GroupRatio = `{"   ":1}`

	err := validateGroupOptionsUpdate(request)

	require.Error(t, err)
	assert.Contains(t, err.Error(), "identifier")
}

func TestValidateGroupOptionsUpdateAllowsBlankDisplayName(t *testing.T) {
	request := validGroupOptionsUpdateRequest()
	request.GroupDisplayNames = `{"codex1":""}`

	require.NoError(t, validateGroupOptionsUpdate(request))
}

func TestUpdateGroupOptionsPersistsOnlyChangedFields(t *testing.T) {
	db := setupGroupOptionsUpdateTest(t)
	require.NoError(t, model.UpdateOptionsBulk(map[string]string{
		"GroupRatio": `{"server":1}`,
		"AutoGroups": `["server"]`,
	}))

	request := validGroupOptionsUpdateRequest()
	request.GroupRatio = `{"client":2}`
	request.AutoGroups = `["stale-client"]`
	request.ChangedKeys = []string{"GroupRatio"}
	recorder, response := performGroupOptionsUpdate(t, request)

	require.Equal(t, http.StatusOK, recorder.Code)
	require.True(t, response.Success, response.Message)
	var persistedGroupRatio model.Option
	var persistedAutoGroups model.Option
	require.NoError(t, db.First(&persistedGroupRatio, "key = ?", "GroupRatio").Error)
	require.NoError(t, db.First(&persistedAutoGroups, "key = ?", "AutoGroups").Error)
	assert.JSONEq(t, `{"client":2}`, persistedGroupRatio.Value)
	assert.JSONEq(t, `["server"]`, persistedAutoGroups.Value)
	assert.JSONEq(t, `{"client":2}`, ratio_setting.GroupRatio2JSONString())
	assert.JSONEq(t, `["server"]`, setting.AutoGroups2JsonString())
}

func TestUpdateGroupOptionsValidatesFullRequestBeforeWriting(t *testing.T) {
	db := setupGroupOptionsUpdateTest(t)
	require.NoError(t, model.UpdateOptionsBulk(map[string]string{
		"GroupRatio": `{"server":1}`,
		"AutoGroups": `["server"]`,
	}))

	request := validGroupOptionsUpdateRequest()
	request.GroupRatio = `{`
	request.AutoGroups = `["client"]`
	request.ChangedKeys = []string{"AutoGroups"}
	_, response := performGroupOptionsUpdate(t, request)

	require.False(t, response.Success)
	var persistedAutoGroups model.Option
	require.NoError(t, db.First(&persistedAutoGroups, "key = ?", "AutoGroups").Error)
	assert.JSONEq(t, `["server"]`, persistedAutoGroups.Value)
	assert.JSONEq(t, `["server"]`, setting.AutoGroups2JsonString())
}

func TestUpdateGroupOptionsRejectsUnsupportedChangedKey(t *testing.T) {
	setupGroupOptionsUpdateTest(t)
	request := validGroupOptionsUpdateRequest()
	request.ChangedKeys = []string{"SystemName"}

	_, response := performGroupOptionsUpdate(t, request)

	require.False(t, response.Success)
	assert.Contains(t, response.Message, "unsupported")
}

func TestGetUserGroupsKeepsIdentifierWhenDisplayNameChanges(t *testing.T) {
	previousDB := model.DB
	previousRedisEnabled := common.RedisEnabled
	previousGroupRatio := ratio_setting.GroupRatio2JSONString()
	previousUserUsableGroups := setting.UserUsableGroups2JSONString()
	previousDisplayNames := setting.GroupDisplayNames2JSONString()
	t.Cleanup(func() {
		model.DB = previousDB
		common.RedisEnabled = previousRedisEnabled
		require.NoError(t, ratio_setting.UpdateGroupRatioByJSONString(previousGroupRatio))
		require.NoError(t, setting.UpdateUserUsableGroupsByJSONString(previousUserUsableGroups))
		require.NoError(t, setting.UpdateGroupDisplayNamesByJSONString(previousDisplayNames))
	})

	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	require.NoError(t, err)
	require.NoError(t, db.Exec("CREATE TABLE users (id INTEGER PRIMARY KEY, `group` TEXT)").Error)
	model.DB = db
	common.RedisEnabled = false
	require.NoError(t, ratio_setting.UpdateGroupRatioByJSONString(`{"codex1":1}`))
	require.NoError(t, setting.UpdateUserUsableGroupsByJSONString(`{"codex1":"Codex users"}`))
	require.NoError(t, setting.UpdateGroupDisplayNamesByJSONString(`{"codex1":"Codex Plus"}`))

	recorder := httptest.NewRecorder()
	context, _ := gin.CreateTestContext(recorder)
	context.Set("id", 1)
	context.Request = httptest.NewRequest(http.MethodGet, "/api/user/self/groups", nil)

	GetUserGroups(context)

	var response struct {
		Success bool `json:"success"`
		Data    map[string]struct {
			Name string `json:"name"`
		} `json:"data"`
	}
	require.NoError(t, common.Unmarshal(recorder.Body.Bytes(), &response))
	require.True(t, response.Success)
	require.Contains(t, response.Data, "codex1")
	assert.NotContains(t, response.Data, "Codex Plus")
	assert.Equal(t, "Codex Plus", response.Data["codex1"].Name)
}
