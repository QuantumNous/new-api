package model

import (
	"errors"
	"fmt"
	"net/url"
	"sort"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"

	"gorm.io/gorm"
)

type ChannelProvider struct {
	Id          int    `json:"id"`
	Name        string `json:"name" gorm:"size:128;not null"`
	BaseURL     string `json:"base_url" gorm:"size:255;not null;uniqueIndex"`
	Status      int    `json:"status" gorm:"default:1"`
	CreatedTime int64  `json:"created_time" gorm:"bigint"`
	UpdatedTime int64  `json:"updated_time" gorm:"bigint"`
	Remark      string `json:"remark" gorm:"type:varchar(255)"`
}

type ChannelProviderSummary struct {
	Id      int    `json:"id"`
	Name    string `json:"name"`
	BaseURL string `json:"base_url"`
	Status  int    `json:"status"`
}

type ChannelProviderTree struct {
	Key          string     `json:"key"`
	Id           string     `json:"id"`
	IsProvider   bool       `json:"is_provider"`
	ProviderID   int        `json:"provider_id"`
	Name         string     `json:"name"`
	BaseURL      string     `json:"base_url"`
	Status       int        `json:"status"`
	Group        string     `json:"group"`
	UsedQuota    int64      `json:"used_quota"`
	ResponseTime int        `json:"response_time"`
	Priority     any        `json:"priority"`
	Weight       any        `json:"weight"`
	ChannelCount int        `json:"channel_count"`
	EnabledCount int        `json:"enabled_count"`
	Children     []*Channel `json:"children"`
}

func NormalizeChannelProviderBaseURL(baseURL string) string {
	trimmed := strings.TrimSpace(baseURL)
	if trimmed == "" {
		return ""
	}
	return strings.TrimRight(trimmed, "/")
}

func EffectiveBaseURLForChannel(channel *Channel) string {
	if channel == nil {
		return ""
	}
	if channel.BaseURL != nil {
		if normalized := NormalizeChannelProviderBaseURL(*channel.BaseURL); normalized != "" {
			return normalized
		}
	}
	return NormalizeChannelProviderBaseURL(constant.ChannelBaseURLs[channel.Type])
}

func defaultChannelProviderName(baseURL string) string {
	parsed, err := url.Parse(baseURL)
	if err == nil && parsed.Host != "" {
		return parsed.Host
	}
	if baseURL == "" {
		return "未设置地址"
	}
	return baseURL
}

func providerDB(tx *gorm.DB) *gorm.DB {
	if tx != nil {
		return tx
	}
	return DB
}

func GetOrCreateChannelProviderByBaseURL(tx *gorm.DB, baseURL string) (*ChannelProvider, error) {
	normalized := NormalizeChannelProviderBaseURL(baseURL)
	if normalized == "" {
		return nil, errors.New("供应商 API 地址不能为空")
	}

	db := providerDB(tx)
	var provider ChannelProvider
	err := db.Where("base_url = ?", normalized).First(&provider).Error
	if err == nil {
		return &provider, nil
	}
	if !errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, err
	}

	now := common.GetTimestamp()
	provider = ChannelProvider{
		Name:        defaultChannelProviderName(normalized),
		BaseURL:     normalized,
		Status:      common.ChannelStatusEnabled,
		CreatedTime: now,
		UpdatedTime: now,
	}
	if err := db.Create(&provider).Error; err != nil {
		// A concurrent creator may have inserted the same base URL first.
		if retryErr := db.Where("base_url = ?", normalized).First(&provider).Error; retryErr == nil {
			return &provider, nil
		}
		return nil, err
	}
	return &provider, nil
}

func GetChannelProviderByID(id int) (*ChannelProvider, error) {
	var provider ChannelProvider
	if err := DB.First(&provider, "id = ?", id).Error; err != nil {
		return nil, err
	}
	return &provider, nil
}

func EnsureProviderForChannel(tx *gorm.DB, channel *Channel) (*ChannelProvider, error) {
	if channel == nil {
		return nil, errors.New("channel is nil")
	}
	db := providerDB(tx)
	if channel.ProviderID > 0 {
		provider, err := GetChannelProviderByIDWithDB(db, channel.ProviderID)
		if err != nil {
			return nil, err
		}
		baseURL := provider.BaseURL
		channel.BaseURL = &baseURL
		return provider, nil
	}
	baseURL := EffectiveBaseURLForChannel(channel)
	if baseURL == "" {
		return nil, nil
	}
	provider, err := GetOrCreateChannelProviderByBaseURL(db, baseURL)
	if err != nil {
		return nil, err
	}
	channel.ProviderID = provider.Id
	baseURL = provider.BaseURL
	channel.BaseURL = &baseURL
	return provider, nil
}

func GetChannelProviderByIDWithDB(db *gorm.DB, id int) (*ChannelProvider, error) {
	var provider ChannelProvider
	if err := db.First(&provider, "id = ?", id).Error; err != nil {
		return nil, err
	}
	return &provider, nil
}

func AttachChannelProviderSummaries(channels []*Channel) {
	if len(channels) == 0 {
		return
	}
	idSet := make(map[int]struct{})
	for _, channel := range channels {
		if channel != nil && channel.ProviderID > 0 {
			idSet[channel.ProviderID] = struct{}{}
		}
	}
	if len(idSet) == 0 {
		return
	}
	ids := make([]int, 0, len(idSet))
	for id := range idSet {
		ids = append(ids, id)
	}
	var providers []ChannelProvider
	if err := DB.Where("id in (?)", ids).Find(&providers).Error; err != nil {
		common.SysLog(fmt.Sprintf("failed to attach channel providers: %v", err))
		return
	}
	providerMap := make(map[int]*ChannelProviderSummary, len(providers))
	for i := range providers {
		provider := providers[i]
		providerMap[provider.Id] = &ChannelProviderSummary{
			Id:      provider.Id,
			Name:    provider.Name,
			BaseURL: provider.BaseURL,
			Status:  provider.Status,
		}
	}
	for _, channel := range channels {
		if channel != nil {
			channel.Provider = providerMap[channel.ProviderID]
		}
	}
}

func MigrateChannelProviders() error {
	var channels []*Channel
	if err := DB.Find(&channels).Error; err != nil {
		return err
	}
	if len(channels) == 0 {
		return nil
	}

	return DB.Transaction(func(tx *gorm.DB) error {
		for _, channel := range channels {
			baseURL := EffectiveBaseURLForChannel(channel)
			if baseURL == "" {
				continue
			}
			provider, err := GetOrCreateChannelProviderByBaseURL(tx, baseURL)
			if err != nil {
				return err
			}
			updates := map[string]interface{}{}
			if channel.ProviderID != provider.Id {
				updates["provider_id"] = provider.Id
			}
			if channel.BaseURL == nil || *channel.BaseURL != provider.BaseURL {
				updates["base_url"] = provider.BaseURL
			}
			if len(updates) == 0 {
				continue
			}
			if err := tx.Model(&Channel{}).Where("id = ?", channel.Id).Updates(updates).Error; err != nil {
				return err
			}
		}
		return nil
	})
}

func ListChannelProviders(offset int, limit int) ([]*ChannelProvider, int64, error) {
	var total int64
	if err := DB.Model(&ChannelProvider{}).Count(&total).Error; err != nil {
		return nil, 0, err
	}
	var providers []*ChannelProvider
	query := DB.Order("id desc").Offset(offset)
	if limit > 0 {
		query = query.Limit(limit)
	}
	if err := query.Find(&providers).Error; err != nil {
		return nil, 0, err
	}
	return providers, total, nil
}

func SearchChannelProviders(keyword string, offset int, limit int) ([]*ChannelProvider, int64, error) {
	db := DB.Model(&ChannelProvider{})
	if keyword != "" {
		like := "%" + keyword + "%"
		db = db.Where("name LIKE ? OR base_url LIKE ? OR remark LIKE ?", like, like, like)
	}
	var total int64
	if err := db.Count(&total).Error; err != nil {
		return nil, 0, err
	}
	var providers []*ChannelProvider
	query := db.Order("id desc").Offset(offset)
	if limit > 0 {
		query = query.Limit(limit)
	}
	if err := query.Find(&providers).Error; err != nil {
		return nil, 0, err
	}
	return providers, total, nil
}

func UpdateChannelProvider(provider *ChannelProvider) error {
	if provider == nil || provider.Id == 0 {
		return errors.New("缺少供应商 ID")
	}
	provider.BaseURL = NormalizeChannelProviderBaseURL(provider.BaseURL)
	if provider.BaseURL == "" {
		return errors.New("供应商 API 地址不能为空")
	}
	if strings.TrimSpace(provider.Name) == "" {
		provider.Name = defaultChannelProviderName(provider.BaseURL)
	}
	return DB.Transaction(func(tx *gorm.DB) error {
		var origin ChannelProvider
		if err := tx.First(&origin, "id = ?", provider.Id).Error; err != nil {
			return err
		}
		provider.CreatedTime = origin.CreatedTime
		provider.UpdatedTime = common.GetTimestamp()
		if err := tx.Model(&ChannelProvider{}).Where("id = ?", provider.Id).Updates(map[string]interface{}{
			"name":         provider.Name,
			"base_url":     provider.BaseURL,
			"status":       provider.Status,
			"updated_time": provider.UpdatedTime,
			"remark":       provider.Remark,
		}).Error; err != nil {
			return err
		}
		if origin.BaseURL != provider.BaseURL {
			if err := tx.Model(&Channel{}).Where("provider_id = ?", provider.Id).Update("base_url", provider.BaseURL).Error; err != nil {
				return err
			}
		}
		return nil
	})
}

func DeleteChannelProvider(id int) error {
	var count int64
	if err := DB.Model(&Channel{}).Where("provider_id = ?", id).Count(&count).Error; err != nil {
		return err
	}
	if count > 0 {
		return fmt.Errorf("该供应商下仍有 %d 个渠道，不能删除", count)
	}
	return DB.Delete(&ChannelProvider{}, id).Error
}

func BuildChannelProviderTrees(channels []*Channel, offset int, limit int) ([]*ChannelProviderTree, int64) {
	AttachChannelProviderSummaries(channels)
	treeMap := make(map[int]*ChannelProviderTree)
	order := make([]int, 0)
	for _, channel := range channels {
		if channel == nil {
			continue
		}
		providerID := channel.ProviderID
		if providerID == 0 {
			providerID = -channel.Id
		}
		tree, exists := treeMap[providerID]
		if !exists {
			name := "未归属供应商"
			baseURL := EffectiveBaseURLForChannel(channel)
			status := common.ChannelStatusManuallyDisabled
			if channel.Provider != nil {
				name = channel.Provider.Name
				baseURL = channel.Provider.BaseURL
				status = channel.Provider.Status
			}
			tree = &ChannelProviderTree{
				Key:        fmt.Sprintf("provider-%d", providerID),
				Id:         fmt.Sprintf("P%d", providerID),
				IsProvider: true,
				ProviderID: channel.ProviderID,
				Name:       name,
				BaseURL:    baseURL,
				Status:     status,
				Priority:   nil,
				Weight:     nil,
				Children:   make([]*Channel, 0),
			}
			treeMap[providerID] = tree
			order = append(order, providerID)
		}
		tree.Children = append(tree.Children, channel)
		tree.ChannelCount++
		tree.UsedQuota += channel.UsedQuota
		tree.ResponseTime += channel.ResponseTime
		if channel.Status == common.ChannelStatusEnabled {
			tree.EnabledCount++
			tree.Status = common.ChannelStatusEnabled
		}
		if tree.Group == "" {
			tree.Group = channel.Group
		} else {
			seenGroups := map[string]struct{}{}
			for _, group := range strings.Split(tree.Group, ",") {
				group = strings.TrimSpace(group)
				if group != "" {
					seenGroups[group] = struct{}{}
				}
			}
			for _, group := range strings.Split(channel.Group, ",") {
				group = strings.TrimSpace(group)
				if group == "" {
					continue
				}
				if _, ok := seenGroups[group]; !ok {
					tree.Group += "," + group
					seenGroups[group] = struct{}{}
				}
			}
		}
		if tree.Priority == nil {
			tree.Priority = channel.Priority
		} else if priority, ok := tree.Priority.(*int64); ok {
			if (priority == nil && channel.Priority != nil) ||
				(priority != nil && (channel.Priority == nil || *priority != *channel.Priority)) {
				tree.Priority = ""
			}
		}
		if tree.Weight == nil {
			tree.Weight = channel.Weight
		} else if weight, ok := tree.Weight.(*uint); ok {
			if (weight == nil && channel.Weight != nil) ||
				(weight != nil && (channel.Weight == nil || *weight != *channel.Weight)) {
				tree.Weight = ""
			}
		}
	}

	sort.SliceStable(order, func(i, j int) bool {
		left := treeMap[order[i]]
		right := treeMap[order[j]]
		if left.EnabledCount != right.EnabledCount {
			return left.EnabledCount > right.EnabledCount
		}
		return left.ProviderID > right.ProviderID
	})

	total := int64(len(order))
	if offset < 0 {
		offset = 0
	}
	if offset > len(order) {
		offset = len(order)
	}
	end := len(order)
	if limit > 0 && offset+limit < end {
		end = offset + limit
	}
	trees := make([]*ChannelProviderTree, 0, end-offset)
	for _, providerID := range order[offset:end] {
		tree := treeMap[providerID]
		if tree.ChannelCount > 0 {
			tree.ResponseTime = tree.ResponseTime / tree.ChannelCount
		}
		trees = append(trees, tree)
	}
	return trees, total
}
