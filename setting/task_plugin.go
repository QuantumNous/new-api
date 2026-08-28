package setting

import (
	"strings"

	"github.com/QuantumNous/new-api/common"
)

const (
	TaskPluginMarketplaceSourcesKey = "TaskPluginMarketplaceSources"

	officialTaskPluginMarketplaceIndexURL = "https://www.newapi.ai/api/v1/plugins/index.json"
	githubTaskPluginMarketplaceIndexURL   = "https://raw.githubusercontent.com/QuantumNous/new-api-plugins/main/index.json"
)

type TaskPluginMarketplaceSource struct {
	Name     string `json:"name"`
	IndexURL string `json:"index_url"`
}

func defaultTaskPluginMarketplaceSources() []TaskPluginMarketplaceSource {
	return []TaskPluginMarketplaceSource{
		{Name: "Official", IndexURL: officialTaskPluginMarketplaceIndexURL},
		{Name: "GitHub", IndexURL: githubTaskPluginMarketplaceIndexURL},
	}
}

func GetTaskPluginMarketplaceSources() []TaskPluginMarketplaceSource {
	common.OptionMapRWMutex.RLock()
	raw := ""
	if common.OptionMap != nil {
		raw = common.OptionMap[TaskPluginMarketplaceSourcesKey]
	}
	common.OptionMapRWMutex.RUnlock()

	raw = strings.TrimSpace(raw)
	if raw == "" {
		return defaultTaskPluginMarketplaceSources()
	}
	var sources []TaskPluginMarketplaceSource
	if err := common.UnmarshalJsonStr(raw, &sources); err != nil {
		return defaultTaskPluginMarketplaceSources()
	}
	if sources == nil {
		return []TaskPluginMarketplaceSource{}
	}
	return sources
}

func TaskPluginMarketplaceSources2JsonString() string {
	encoded, err := common.Marshal(defaultTaskPluginMarketplaceSources())
	if err != nil {
		return "[]"
	}
	return string(encoded)
}
