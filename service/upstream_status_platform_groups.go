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

type platformStatusTarget struct {
	Group string
	Model string
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
	targets := resolver.targetsForRecord(record)
	groups := make([]string, 0, len(targets))
	for _, target := range targets {
		groups = append(groups, target.Group)
	}
	return uniqueNonEmptyStrings(groups)
}

func (resolver platformStatusGroupResolver) targetsForRecord(record model.SupplierStatusSync) []platformStatusTarget {
	groups := knownPlatformGroupsForRecord(record)
	if len(groups) > 0 {
		if targets := resolver.configuredTargetsForRecord(record, groups, true); len(targets) > 0 {
			return targets
		}
		return targetsFromGroupsAndModel(groups, record.ModelName)
	}
	if groups := resolver.configuredGroupsForRecord(record, true); len(groups) > 0 {
		return targetsFromGroupsAndModel(groups, record.ModelName)
	}
	if targets := resolver.configuredTargetsForRecord(record, nil, false); len(targets) > 0 {
		return targets
	}
	if groups := resolver.configuredGroupsForRecord(record, false); len(groups) > 0 {
		return targetsFromGroupsAndModel(groups, record.ModelName)
	}
	return nil
}

func (resolver platformStatusGroupResolver) configuredTargetsForRecord(record model.SupplierStatusSync, allowedGroups []string, requireSourceMatch bool) []platformStatusTarget {
	targets := make([]platformStatusTarget, 0)
	for _, configured := range resolver.configured {
		if configured.Model == "" || configured.Group == "" {
			continue
		}
		if len(allowedGroups) > 0 && !stringInSlice(configured.Group, allowedGroups) {
			continue
		}
		if requireSourceMatch && !configured.matchesSource(record) {
			continue
		}
		if !configured.matchesModel(record) {
			continue
		}
		targets = append(targets, platformStatusTarget{
			Group: configured.Group,
			Model: configured.Model,
		})
	}
	return uniquePlatformStatusTargets(targets)
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

func (configured configuredPlatformStatusGroup) matchesModel(record model.SupplierStatusSync) bool {
	source := normalizeStatusText(strings.Join([]string{
		record.ModelName,
		record.MonitorName,
		record.MonitorID,
	}, " "))
	model := normalizeStatusText(configured.Model)
	if source == "" || model == "" {
		return false
	}
	if strings.Contains(source, model) {
		return true
	}
	channel := normalizeStatusText(configured.Channel + " " + configured.ChannelTag)
	if channel == "" {
		return false
	}
	return strings.Contains(source, channel) || strings.Contains(channel, source)
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

func targetsFromGroupsAndModel(groups []string, model string) []platformStatusTarget {
	targets := make([]platformStatusTarget, 0, len(groups))
	for _, group := range groups {
		group = strings.TrimSpace(group)
		model = strings.TrimSpace(model)
		if group == "" || model == "" {
			continue
		}
		targets = append(targets, platformStatusTarget{Group: group, Model: model})
	}
	return uniquePlatformStatusTargets(targets)
}

func uniquePlatformStatusTargets(values []platformStatusTarget) []platformStatusTarget {
	result := make([]platformStatusTarget, 0, len(values))
	seen := make(map[string]struct{})
	for _, value := range values {
		value.Group = strings.TrimSpace(value.Group)
		value.Model = strings.TrimSpace(value.Model)
		if value.Group == "" || value.Model == "" {
			continue
		}
		key := value.Group + "\x00" + value.Model
		if _, ok := seen[key]; ok {
			continue
		}
		seen[key] = struct{}{}
		result = append(result, value)
	}
	return result
}

func stringInSlice(value string, values []string) bool {
	for _, item := range values {
		if item == value {
			return true
		}
	}
	return false
}

func normalizeStatusText(value string) string {
	return strings.ToLower(strings.TrimSpace(value))
}
