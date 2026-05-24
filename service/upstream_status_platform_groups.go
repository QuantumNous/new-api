package service

import (
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
)

type platformStatusGroupResolver struct {
	configured []configuredPlatformStatusGroup
}

type configuredPlatformStatusGroup struct {
	Group      string
	Model      string
	ChannelID  int
	Channel    string
	ChannelTag string
}

func newPlatformStatusGroupResolver() platformStatusGroupResolver {
	var abilities []model.Ability
	if err := model.DB.Where("enabled = ?", true).Find(&abilities).Error; err != nil {
		return platformStatusGroupResolver{}
	}
	if len(abilities) == 0 {
		return platformStatusGroupResolver{}
	}

	channelsByID := loadStatusGroupChannels(abilities)
	configured := make([]configuredPlatformStatusGroup, 0, len(abilities))
	for _, ability := range abilities {
		group := platformGroupDisplayName(ability.Group)
		if group == "" || ability.Model == "" {
			continue
		}
		row := configuredPlatformStatusGroup{
			Group:     group,
			Model:     ability.Model,
			ChannelID: ability.ChannelId,
		}
		if channel, ok := channelsByID[ability.ChannelId]; ok {
			if channel.Status != common.ChannelStatusEnabled {
				continue
			}
			row.Channel = channel.Name
			row.ChannelTag = channel.GetTag()
		}
		configured = append(configured, row)
	}
	return platformStatusGroupResolver{configured: configured}
}

func loadStatusGroupChannels(abilities []model.Ability) map[int]model.Channel {
	channelIDs := make([]int, 0, len(abilities))
	seenChannelIDs := make(map[int]struct{})
	for _, ability := range abilities {
		if _, ok := seenChannelIDs[ability.ChannelId]; ok {
			continue
		}
		seenChannelIDs[ability.ChannelId] = struct{}{}
		channelIDs = append(channelIDs, ability.ChannelId)
	}

	channelsByID := make(map[int]model.Channel)
	if len(channelIDs) == 0 {
		return channelsByID
	}
	var channels []model.Channel
	if err := model.DB.Where("id IN ?", channelIDs).Find(&channels).Error; err != nil {
		return channelsByID
	}
	for _, channel := range channels {
		channelsByID[channel.Id] = channel
	}
	return channelsByID
}

func (resolver platformStatusGroupResolver) groupsForRecord(record model.SupplierStatusSync) []string {
	if groups := resolver.configuredGroupsForRecord(record, true); len(groups) > 0 {
		return groups
	}
	if groups := knownPlatformGroupsForRecord(record); len(groups) > 0 {
		return groups
	}
	if groups := resolver.configuredGroupsForRecord(record, false); len(groups) > 0 {
		return groups
	}
	return []string{upstreamCategoryName(record)}
}

func (resolver platformStatusGroupResolver) configuredGroupsForRecord(record model.SupplierStatusSync, requireSourceMatch bool) []string {
	groups := make([]string, 0)
	for _, configured := range resolver.configured {
		if configured.Model != record.ModelName {
			continue
		}
		if requireSourceMatch && !configured.matchesSource(record) {
			continue
		}
		groups = append(groups, configured.Group)
	}
	return uniqueNonEmptyStrings(groups)
}

func (configured configuredPlatformStatusGroup) matchesSource(record model.SupplierStatusSync) bool {
	source := normalizeStatusText(strings.Join([]string{
		record.Provider,
		record.GroupName,
		record.MonitorName,
		record.ModelName,
	}, " "))
	channel := normalizeStatusText(configured.Channel + " " + configured.ChannelTag)
	if channel == "" {
		return false
	}
	if record.Provider != "" && !strings.Contains(channel, normalizeStatusText(record.Provider)) {
		return false
	}
	family := recordStatusFamily(source)
	if family == "" {
		return true
	}
	if family == "gpt" {
		return strings.Contains(channel, "gpt") || strings.Contains(channel, "codex") || strings.Contains(channel, "openai")
	}
	return strings.Contains(channel, family)
}

func knownPlatformGroupsForRecord(record model.SupplierStatusSync) []string {
	source := normalizeStatusText(strings.Join([]string{
		record.Provider,
		record.GroupName,
		record.MonitorName,
		record.ModelName,
	}, " "))
	provider := normalizeStatusText(record.Provider)
	family := recordStatusFamily(source)

	switch family {
	case "gpt":
		if provider == "foxcode" {
			return []string{"GPT 官方渠道"}
		}
		return []string{"GPT 中转渠道"}
	case "claude":
		if provider == "foxcode" {
			return []string{"Claude 官方渠道"}
		}
		return []string{"Claude 中转渠道"}
	case "gemini":
		if provider == "foxcode" {
			return []string{"Gemini 官方渠道"}
		}
		return []string{"Gemini 中转渠道"}
	case "image":
		return []string{"图像官方渠道"}
	}
	return nil
}

func recordStatusFamily(source string) string {
	switch {
	case strings.Contains(source, "gpt-image") || strings.Contains(source, "image"):
		return "image"
	case strings.Contains(source, "codex") || strings.Contains(source, "gpt"):
		return "gpt"
	case strings.Contains(source, "claude") || strings.Contains(source, "cc-") || strings.Contains(source, "cc逆向"):
		return "claude"
	case strings.Contains(source, "gemini"):
		return "gemini"
	default:
		return ""
	}
}

func platformGroupDisplayName(group string) string {
	switch strings.TrimSpace(group) {
	case "GPT-Transit":
		return "GPT 中转渠道"
	case "GPT-Official":
		return "GPT 官方渠道"
	case "Claude-Transit":
		return "Claude 中转渠道"
	case "Claude-Official":
		return "Claude 官方渠道"
	case "Gemini-1":
		return "Gemini 中转渠道"
	case "image-2":
		return "图像官方渠道"
	case "Sora-1", "Veo-1", "SeeDance-1":
		return "视频官方渠道"
	case "Embedding-1":
		return "向量官方渠道"
	default:
		return strings.TrimSpace(group)
	}
}

func uniqueNonEmptyStrings(values []string) []string {
	result := make([]string, 0, len(values))
	seen := make(map[string]struct{})
	for _, value := range values {
		value = strings.TrimSpace(value)
		if value == "" {
			continue
		}
		if _, ok := seen[value]; ok {
			continue
		}
		seen[value] = struct{}{}
		result = append(result, value)
	}
	return result
}

func normalizeStatusText(value string) string {
	return strings.ToLower(strings.TrimSpace(value))
}
