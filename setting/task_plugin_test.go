package setting

import (
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func setupTaskPluginDisabledFactoryKeysTest(t *testing.T) {
	t.Helper()
	originalMap := common.OptionMap
	common.OptionMapRWMutex.Lock()
	common.OptionMap = map[string]string{}
	common.OptionMapRWMutex.Unlock()
	t.Cleanup(func() {
		common.OptionMapRWMutex.Lock()
		common.OptionMap = originalMap
		common.OptionMapRWMutex.Unlock()
	})
}

func TestTaskPluginDisabledFactoryKeysRoundTripAndDedupe(t *testing.T) {
	setupTaskPluginDisabledFactoryKeysTest(t)

	assert.Empty(t, GetTaskPluginDisabledFactoryKeys())
	assert.False(t, IsTaskPluginFactoryDisabled("kling"))

	require.NoError(t, SetTaskPluginDisabledFactoryKeysOption([]string{"kling", "sora", "kling", " hailuo "}))
	assert.Equal(t, []string{"hailuo", "kling", "sora"}, GetTaskPluginDisabledFactoryKeys())
	assert.Equal(t, `["hailuo","kling","sora"]`, common.OptionMap[TaskPluginDisabledFactoryKeysKey])
	assert.True(t, IsTaskPluginFactoryDisabled("kling"))
	assert.True(t, IsTaskPluginFactoryDisabled("hailuo"))
	assert.False(t, IsTaskPluginFactoryDisabled("google"))
}

func TestTaskPluginDisabledFactoryKeysBadJSONReturnsEmpty(t *testing.T) {
	setupTaskPluginDisabledFactoryKeysTest(t)

	for _, testCase := range []struct {
		name string
		raw  string
	}{
		{name: "absent", raw: ""},
		{name: "null", raw: "null"},
		{name: "object", raw: "{}"},
		{name: "number", raw: "1"},
		{name: "truncated", raw: `["kling"`},
		{name: "not json", raw: "kling"},
	} {
		t.Run(testCase.name, func(t *testing.T) {
			common.OptionMapRWMutex.Lock()
			if testCase.raw == "" {
				delete(common.OptionMap, TaskPluginDisabledFactoryKeysKey)
			} else {
				common.OptionMap[TaskPluginDisabledFactoryKeysKey] = testCase.raw
			}
			common.OptionMapRWMutex.Unlock()

			assert.Empty(t, GetTaskPluginDisabledFactoryKeys())
			assert.False(t, IsTaskPluginFactoryDisabled("kling"))
		})
	}
}

func TestTaskPluginMarketplaceSourceKindComesFromTheAddress(t *testing.T) {
	cases := map[string]string{
		"https://www.newapi.ai/api/v1/plugins/index.json":                               TaskPluginMarketplaceKindOfficial,
		"https://raw.githubusercontent.com/QuantumNous/new-api-plugins/main/index.json": TaskPluginMarketplaceKindOfficial,
		" https://www.newapi.ai/api/v1/community/index.json ":                           TaskPluginMarketplaceKindCommunity,
		"https://www.newapi.ai/api/v1/community/index.json?official=1":                  TaskPluginMarketplaceKindThirdParty,
		"http://www.newapi.ai/api/v1/plugins/index.json":                                TaskPluginMarketplaceKindThirdParty,
		"https://mirror.example.com/plugins/index.json":                                 TaskPluginMarketplaceKindThirdParty,
	}
	for indexURL, kind := range cases {
		assert.Equal(t, kind, TaskPluginMarketplaceSourceKind(indexURL), indexURL)
	}
}

func TestTaskPluginMarketplaceDefaultsIncludeCommunityButSavedListsStay(t *testing.T) {
	setupTaskPluginDisabledFactoryKeysTest(t)
	assert.Contains(t, GetTaskPluginMarketplaceSources(), TaskPluginMarketplaceSource{Name: "Community", IndexURL: CommunityTaskPluginMarketplaceIndexURL})

	common.OptionMap[TaskPluginMarketplaceSourcesKey] = `[{"name":"Official","index_url":"https://www.newapi.ai/api/v1/plugins/index.json"}]`
	assert.Equal(t, []TaskPluginMarketplaceSource{{Name: "Official", IndexURL: "https://www.newapi.ai/api/v1/plugins/index.json"}}, GetTaskPluginMarketplaceSources())
}
