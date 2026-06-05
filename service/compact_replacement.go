package service

import (
	"fmt"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting/ratio_setting"
	"github.com/gin-gonic/gin"
)

const compactReplacementLogInfoKey = "compact_replacement_log_info"

func ResolveCompactReplacementChannel(c *gin.Context, channel *model.Channel, modelName string, selectedGroup string, isStream bool) (*model.Channel, error) {
	if channel == nil {
		return nil, nil
	}
	if !strings.HasSuffix(modelName, ratio_setting.CompactModelSuffix) {
		return channel, nil
	}

	current := channel
	source := channel
	visited := map[int]bool{current.Id: true}
	for {
		settings := current.GetSetting()
		replacementID := settings.CompactReplacementChannelID
		if replacementID <= 0 || replacementID == current.Id {
			return current, nil
		}
		if isStream && strings.TrimSpace(settings.CompactReplacementScope) != dto.CompactReplacementScopeAll {
			return current, nil
		}
		if visited[replacementID] {
			return nil, fmt.Errorf("compact 替代渠道配置存在循环: channel_id=%d replacement_channel_id=%d", current.Id, replacementID)
		}

		replacement, err := model.CacheGetChannel(replacementID)
		if err != nil {
			return nil, fmt.Errorf("compact 替代渠道 #%d 不存在: %w", replacementID, err)
		}
		if replacement.Status != common.ChannelStatusEnabled {
			return nil, fmt.Errorf("compact 替代渠道 #%d 未启用", replacementID)
		}
		if selectedGroup != "" && !model.IsChannelEnabledForGroupModel(selectedGroup, modelName, replacement.Id) {
			return nil, fmt.Errorf("compact 替代渠道 #%d 未在分组 %s 中启用模型 %s", replacementID, selectedGroup, modelName)
		}

		setCompactReplacementLogInfo(c, source, replacement, modelName, selectedGroup)
		current = replacement
		visited[current.Id] = true
	}
}

func setCompactReplacementLogInfo(c *gin.Context, source *model.Channel, replacement *model.Channel, modelName string, selectedGroup string) {
	if c == nil || source == nil || replacement == nil {
		return
	}
	c.Set(compactReplacementLogInfoKey, map[string]interface{}{
		"source_channel_id":        source.Id,
		"source_channel_name":      source.Name,
		"replacement_channel_id":   replacement.Id,
		"replacement_channel_name": replacement.Name,
		"model":                    modelName,
		"selected_group":           selectedGroup,
	})
}

func AppendCompactReplacementAdminInfo(c *gin.Context, adminInfo map[string]interface{}) {
	if c == nil || adminInfo == nil {
		return
	}
	anyInfo, ok := c.Get(compactReplacementLogInfoKey)
	if !ok || anyInfo == nil {
		return
	}
	adminInfo["compact_replacement"] = anyInfo
}
