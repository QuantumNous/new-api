package setting

import (
	"slices"
	"sort"
	"strings"

	"github.com/QuantumNous/new-api/common"
)

const (
	TaskPluginMarketplaceSourcesKey  = "TaskPluginMarketplaceSources"
	TaskPluginDisabledFactoryKeysKey = "TaskPluginDisabledFactoryKeys"

	officialTaskPluginMarketplaceIndexURL = "https://www.newapi.ai/api/v1/plugins/index.json"
	githubTaskPluginMarketplaceIndexURL   = "https://raw.githubusercontent.com/QuantumNous/new-api-plugins/main/index.json"
	// CommunityTaskPluginMarketplaceIndexURL lists plugins their authors publish
	// on newapi.ai. Install counts go to this site only.
	CommunityTaskPluginMarketplaceIndexURL = "https://www.newapi.ai/api/v1/community/index.json"
)

// The kind of a marketplace source is decided by its address, never by what
// the source says about itself.
const (
	TaskPluginMarketplaceKindOfficial   = "official"
	TaskPluginMarketplaceKindCommunity  = "community"
	TaskPluginMarketplaceKindThirdParty = "third_party"
)

// TaskPluginMarketplaceSourceKind returns the kind of the source at indexURL:
// the built-in official addresses are official, the built-in community address
// is community, and anything else is a third-party source.
func TaskPluginMarketplaceSourceKind(indexURL string) string {
	switch strings.TrimSpace(indexURL) {
	case officialTaskPluginMarketplaceIndexURL, githubTaskPluginMarketplaceIndexURL:
		return TaskPluginMarketplaceKindOfficial
	case CommunityTaskPluginMarketplaceIndexURL:
		return TaskPluginMarketplaceKindCommunity
	}
	return TaskPluginMarketplaceKindThirdParty
}

type TaskPluginMarketplaceSource struct {
	Name     string `json:"name"`
	IndexURL string `json:"index_url"`
}

func defaultTaskPluginMarketplaceSources() []TaskPluginMarketplaceSource {
	return []TaskPluginMarketplaceSource{
		{Name: "Official", IndexURL: officialTaskPluginMarketplaceIndexURL},
		{Name: "GitHub", IndexURL: githubTaskPluginMarketplaceIndexURL},
		{Name: "Community", IndexURL: CommunityTaskPluginMarketplaceIndexURL},
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

func ParseTaskPluginDisabledFactoryKeys(raw string) []string {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return []string{}
	}
	var keys []string
	if err := common.Unmarshal([]byte(raw), &keys); err != nil {
		return []string{}
	}
	if keys == nil {
		return []string{}
	}
	return keys
}

func GetTaskPluginDisabledFactoryKeys() []string {
	common.OptionMapRWMutex.RLock()
	raw := ""
	if common.OptionMap != nil {
		raw = common.OptionMap[TaskPluginDisabledFactoryKeysKey]
	}
	common.OptionMapRWMutex.RUnlock()
	return ParseTaskPluginDisabledFactoryKeys(raw)
}

func SetTaskPluginDisabledFactoryKeysOption(keys []string) error {
	normalized := make([]string, 0, len(keys))
	seen := make(map[string]struct{}, len(keys))
	for _, key := range keys {
		key = strings.TrimSpace(key)
		if key == "" {
			continue
		}
		if _, exists := seen[key]; exists {
			continue
		}
		seen[key] = struct{}{}
		normalized = append(normalized, key)
	}
	sort.Strings(normalized)
	encoded, err := common.Marshal(normalized)
	if err != nil {
		return err
	}
	common.OptionMapRWMutex.Lock()
	if common.OptionMap == nil {
		common.OptionMap = make(map[string]string)
	}
	common.OptionMap[TaskPluginDisabledFactoryKeysKey] = string(encoded)
	common.OptionMapRWMutex.Unlock()
	return nil
}

func IsTaskPluginFactoryDisabled(key string) bool {
	return slices.Contains(GetTaskPluginDisabledFactoryKeys(), key)
}
