package service

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestRetryParamPrepareAvailabilityFallbackRestartsAutoGroupSearch(t *testing.T) {
	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/responses", nil)
	common.SetContextKey(c, constant.ContextKeyAutoGroupIndex, 4)
	common.SetContextKey(c, constant.ContextKeyAutoGroupRetryIndex, 3)

	retryParam := &RetryParam{
		Ctx:        c,
		TokenGroup: "auto",
		Retry:      common.GetPointer(0),
	}
	retryParam.PrepareAvailabilityFallback(2)

	assert.Equal(t, 2, retryParam.GetRetry())
	groupIndex, _ := common.GetContextKey(c, constant.ContextKeyAutoGroupIndex)
	groupRetryIndex, _ := common.GetContextKey(c, constant.ContextKeyAutoGroupRetryIndex)
	assert.Equal(t, 0, groupIndex)
	assert.Equal(t, 0, groupRetryIndex)

	// The relay loop's post statement must not increment before the fallback
	// selection gets one attempt at the configured terminal priority.
	retryParam.IncreaseRetry()
	assert.Equal(t, 2, retryParam.GetRetry())
}

func TestCapacityRetryScansAutoGroupsForDifferentHostBeforeSameHostFallback(t *testing.T) {
	oldMemoryCacheEnabled := common.MemoryCacheEnabled
	oldAutoGroups := setting.AutoGroups2JsonString()
	oldUsableGroups := setting.UserUsableGroups2JSONString()
	common.MemoryCacheEnabled = true
	require.NoError(t, setting.UpdateAutoGroupsByJsonString(`["group-a","group-b"]`))
	require.NoError(t, setting.UpdateUserUsableGroupsByJSONString(`{"group-a":"A","group-b":"B"}`))
	model.ClearChannelCacheForTest()
	t.Cleanup(func() {
		model.ClearChannelCacheForTest()
		require.NoError(t, setting.UpdateAutoGroupsByJsonString(oldAutoGroups))
		require.NoError(t, setting.UpdateUserUsableGroupsByJSONString(oldUsableGroups))
		common.MemoryCacheEnabled = oldMemoryCacheEnabled
	})

	highPriority := int64(20)
	lowPriority := int64(10)
	weight := uint(100)
	failedHostURL := "https://failed.example/v1"
	otherHostURL := "https://other.example/v1"
	model.SetChannelCacheForTest(map[int]*model.Channel{
		17: {Id: 17, Status: common.ChannelStatusEnabled, Weight: &weight, Priority: &highPriority, BaseURL: &failedHostURL},
		29: {Id: 29, Status: common.ChannelStatusEnabled, Weight: &weight, Priority: &lowPriority, BaseURL: &otherHostURL},
	}, map[string]map[string][]int{
		"group-a": {"gpt-5.6-sol": {17}},
		"group-b": {"gpt-5.6-sol": {29}},
	})

	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/responses", nil)
	selected, group, err := CacheGetRandomSatisfiedChannel(&RetryParam{
		Ctx:                 c,
		TokenGroup:          "auto",
		ModelName:           "gpt-5.6-sol",
		RequestPath:         "/v1/responses",
		Retry:               common.GetPointer(0),
		AvoidChannelHosts:   map[string]struct{}{"failed.example": {}},
		PreferDifferentHost: true,
	})
	require.NoError(t, err)
	require.NotNil(t, selected)
	assert.Equal(t, 29, selected.Id)
	assert.Equal(t, "group-b", group)
}

func TestCapacityRetryFallsBackToEarlierAutoGroupWhenNoDifferentHostExists(t *testing.T) {
	oldMemoryCacheEnabled := common.MemoryCacheEnabled
	oldAutoGroups := setting.AutoGroups2JsonString()
	oldUsableGroups := setting.UserUsableGroups2JSONString()
	common.MemoryCacheEnabled = true
	require.NoError(t, setting.UpdateAutoGroupsByJsonString(`["group-a","group-b"]`))
	require.NoError(t, setting.UpdateUserUsableGroupsByJSONString(`{"group-a":"A","group-b":"B"}`))
	model.ClearChannelCacheForTest()
	t.Cleanup(func() {
		model.ClearChannelCacheForTest()
		require.NoError(t, setting.UpdateAutoGroupsByJsonString(oldAutoGroups))
		require.NoError(t, setting.UpdateUserUsableGroupsByJSONString(oldUsableGroups))
		common.MemoryCacheEnabled = oldMemoryCacheEnabled
	})

	priority := int64(20)
	weight := uint(100)
	failedHostURL := "https://failed.example/v1"
	model.SetChannelCacheForTest(map[int]*model.Channel{
		17: {Id: 17, Status: common.ChannelStatusEnabled, Weight: &weight, Priority: &priority, BaseURL: &failedHostURL},
	}, map[string]map[string][]int{
		"group-a": {"gpt-5.6-sol": {17}},
		"group-b": {},
	})

	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/responses", nil)
	selected, group, err := CacheGetRandomSatisfiedChannel(&RetryParam{
		Ctx:                 c,
		TokenGroup:          "auto",
		ModelName:           "gpt-5.6-sol",
		RequestPath:         "/v1/responses",
		Retry:               common.GetPointer(0),
		AvoidChannelHosts:   map[string]struct{}{"failed.example": {}},
		PreferDifferentHost: true,
	})
	require.NoError(t, err)
	require.NotNil(t, selected)
	assert.Equal(t, 17, selected.Id)
	assert.Equal(t, "group-a", group)
}

func TestCapacityRetryKeepsEarlierAutoGroupOrderForSameHostFallback(t *testing.T) {
	oldMemoryCacheEnabled := common.MemoryCacheEnabled
	oldAutoGroups := setting.AutoGroups2JsonString()
	oldUsableGroups := setting.UserUsableGroups2JSONString()
	common.MemoryCacheEnabled = true
	require.NoError(t, setting.UpdateAutoGroupsByJsonString(`["group-a","group-b"]`))
	require.NoError(t, setting.UpdateUserUsableGroupsByJSONString(`{"group-a":"A","group-b":"B"}`))
	model.ClearChannelCacheForTest()
	t.Cleanup(func() {
		model.ClearChannelCacheForTest()
		require.NoError(t, setting.UpdateAutoGroupsByJsonString(oldAutoGroups))
		require.NoError(t, setting.UpdateUserUsableGroupsByJSONString(oldUsableGroups))
		common.MemoryCacheEnabled = oldMemoryCacheEnabled
	})

	priority := int64(20)
	weight := uint(100)
	failedHostURL := "https://failed.example/v1"
	model.SetChannelCacheForTest(map[int]*model.Channel{
		17: {Id: 17, Status: common.ChannelStatusEnabled, Weight: &weight, Priority: &priority, BaseURL: &failedHostURL},
		29: {Id: 29, Status: common.ChannelStatusEnabled, Weight: &weight, Priority: &priority, BaseURL: &failedHostURL},
	}, map[string]map[string][]int{
		"group-a": {"gpt-5.6-sol": {17}},
		"group-b": {"gpt-5.6-sol": {29}},
	})

	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/responses", nil)
	selected, group, err := CacheGetRandomSatisfiedChannel(&RetryParam{
		Ctx:                 c,
		TokenGroup:          "auto",
		ModelName:           "gpt-5.6-sol",
		RequestPath:         "/v1/responses",
		Retry:               common.GetPointer(0),
		AvoidChannelHosts:   map[string]struct{}{"failed.example": {}},
		PreferDifferentHost: true,
	})
	require.NoError(t, err)
	require.NotNil(t, selected)
	assert.Equal(t, 17, selected.Id)
	assert.Equal(t, "group-a", group)
}

func TestAutoGroupSelectionReturnsChannelConsistencyErrors(t *testing.T) {
	oldMemoryCacheEnabled := common.MemoryCacheEnabled
	oldAutoGroups := setting.AutoGroups2JsonString()
	oldUsableGroups := setting.UserUsableGroups2JSONString()
	common.MemoryCacheEnabled = true
	require.NoError(t, setting.UpdateAutoGroupsByJsonString(`["group-a"]`))
	require.NoError(t, setting.UpdateUserUsableGroupsByJSONString(`{"group-a":"A"}`))
	model.ClearChannelCacheForTest()
	t.Cleanup(func() {
		model.ClearChannelCacheForTest()
		require.NoError(t, setting.UpdateAutoGroupsByJsonString(oldAutoGroups))
		require.NoError(t, setting.UpdateUserUsableGroupsByJSONString(oldUsableGroups))
		common.MemoryCacheEnabled = oldMemoryCacheEnabled
	})

	model.SetChannelCacheForTest(map[int]*model.Channel{}, map[string]map[string][]int{
		"group-a": {"gpt-5.6-sol": {999}},
	})

	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/responses", nil)
	selected, group, err := CacheGetRandomSatisfiedChannel(&RetryParam{
		Ctx:         c,
		TokenGroup:  "auto",
		ModelName:   "gpt-5.6-sol",
		RequestPath: "/v1/responses",
		Retry:       common.GetPointer(0),
	})
	assert.Nil(t, selected)
	assert.Equal(t, "auto", group)
	require.ErrorContains(t, err, "数据库一致性错误")
}
