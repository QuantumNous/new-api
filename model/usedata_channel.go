package model

import "fmt"

type ChannelQuotaReportData struct {
	ChannelID           int    `json:"channel_id" gorm:"column:channel_id"`
	ChannelName         string `json:"channel_name" gorm:"-"`
	Status              int    `json:"status" gorm:"-"`
	ResponseTime        int    `json:"response_time" gorm:"-"`
	ModelName           string `json:"model_name" gorm:"column:model_name"`
	CreatedAt           int64  `json:"created_at" gorm:"column:created_at"`
	TokenUsed           int    `json:"token_used" gorm:"column:token_used"`
	PromptTokens        int    `json:"prompt_tokens" gorm:"column:prompt_tokens"`
	CompletionTokens    int    `json:"completion_tokens" gorm:"column:completion_tokens"`
	CacheTokens         int    `json:"cache_tokens" gorm:"column:cache_tokens"`
	CacheCreationTokens int    `json:"cache_creation_tokens" gorm:"column:cache_creation_tokens"`
	Count               int    `json:"count" gorm:"column:count"`
	Quota               int    `json:"quota" gorm:"column:quota"`
}

func GetChannelQuotaReportData(startTime int64, endTime int64) ([]*ChannelQuotaReportData, error) {
	rows := make([]*ChannelQuotaReportData, 0)
	err := DB.Table("quota_data").
		Select("channel_id, model_name, created_at, sum(count) as count, sum(quota) as quota, sum(token_used) as token_used, sum(prompt_tokens) as prompt_tokens, sum(completion_tokens) as completion_tokens, sum(cache_tokens) as cache_tokens, sum(cache_creation_tokens) as cache_creation_tokens").
		Where("channel_id <> 0").
		Where("created_at >= ? and created_at <= ?", startTime, endTime).
		Group("channel_id, model_name, created_at").
		Order("channel_id ASC, quota DESC").
		Find(&rows).Error
	if err != nil {
		return nil, err
	}
	return rows, fillChannelReportMetadata(rows)
}

func fillChannelReportMetadata(rows []*ChannelQuotaReportData) error {
	channelIDSet := make(map[int]struct{})
	channelIDs := make([]int, 0)
	for _, row := range rows {
		if row.ChannelID == 0 {
			continue
		}
		if _, ok := channelIDSet[row.ChannelID]; ok {
			continue
		}
		channelIDSet[row.ChannelID] = struct{}{}
		channelIDs = append(channelIDs, row.ChannelID)
	}
	if len(channelIDs) == 0 {
		return nil
	}

	var channels []struct {
		Id           int    `gorm:"column:id"`
		Name         string `gorm:"column:name"`
		Status       int    `gorm:"column:status"`
		ResponseTime int    `gorm:"column:response_time"`
	}
	if err := DB.Table("channels").Select("id, name, status, response_time").Where("id IN ?", channelIDs).Find(&channels).Error; err != nil {
		return err
	}

	type channelReportMetadata struct {
		name         string
		status       int
		responseTime int
	}
	channelMetadataByID := make(map[int]channelReportMetadata, len(channels))
	for _, channel := range channels {
		channelMetadataByID[channel.Id] = channelReportMetadata{
			name:         channel.Name,
			status:       channel.Status,
			responseTime: channel.ResponseTime,
		}
	}

	for _, row := range rows {
		if metadata, ok := channelMetadataByID[row.ChannelID]; ok {
			row.ChannelName = metadata.name
			row.Status = metadata.status
			row.ResponseTime = metadata.responseTime
			continue
		}
		row.ChannelName = fmt.Sprintf("channel-%d", row.ChannelID)
	}
	return nil
}
