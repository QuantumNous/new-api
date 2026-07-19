package model

import (
	"errors"
	"fmt"
	"sort"
	"strings"
	"sync"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/dto"

	"github.com/samber/lo"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

type Ability struct {
	Group     string  `json:"group" gorm:"type:varchar(64);primaryKey;autoIncrement:false"`
	Model     string  `json:"model" gorm:"type:varchar(255);primaryKey;autoIncrement:false"`
	ChannelId int     `json:"channel_id" gorm:"primaryKey;autoIncrement:false;index"`
	Enabled   bool    `json:"enabled"`
	Priority  *int64  `json:"priority" gorm:"bigint;default:0;index"`
	Weight    uint    `json:"weight" gorm:"default:0;index"`
	Tag       *string `json:"tag" gorm:"index"`
}

type AbilityWithChannel struct {
	Ability
	ChannelType         int     `json:"channel_type"`
	ChannelModelMapping *string `json:"-"`
}

func GetAllEnableAbilityWithChannels() ([]AbilityWithChannel, error) {
	var abilities []AbilityWithChannel
	err := DB.Table("abilities").
		Select("abilities.*, channels.type as channel_type, channels.model_mapping as channel_model_mapping").
		Joins("left join channels on abilities.channel_id = channels.id").
		Where("abilities.enabled = ?", true).
		Scan(&abilities).Error
	return abilities, err
}

func GetGroupEnabledModels(group string) []string {
	var models []string
	// Find distinct models
	DB.Table("abilities").Where(commonGroupCol+" = ? and enabled = ?", group, true).Distinct("model").Pluck("model", &models)
	return models
}

func GetEnabledModels() []string {
	var models []string
	// Find distinct models
	DB.Table("abilities").Where("enabled = ?", true).Distinct("model").Pluck("model", &models)
	return models
}

func GetAllEnableAbilities() []Ability {
	var abilities []Ability
	DB.Find(&abilities, "enabled = ?", true)
	return abilities
}

func getPriority(group string, model string, retry int) (int, error) {

	var priorities []int
	err := DB.Model(&Ability{}).
		Select("DISTINCT(priority)").
		Where(commonGroupCol+" = ? and model = ? and enabled = ?", group, model, true).
		Order("priority DESC").              // 按优先级降序排序
		Pluck("priority", &priorities).Error // Pluck用于将查询的结果直接扫描到一个切片中

	if err != nil {
		// 处理错误
		return 0, err
	}

	if len(priorities) == 0 {
		// 如果没有查询到优先级，则返回错误
		return 0, errors.New("数据库一致性被破坏")
	}

	// 确定要使用的优先级
	var priorityToUse int
	if retry >= len(priorities) {
		// 如果重试次数大于优先级数，则使用最小的优先级
		priorityToUse = priorities[len(priorities)-1]
	} else {
		priorityToUse = priorities[retry]
	}
	return priorityToUse, nil
}

func getChannelQuery(group string, model string, retry int) (*gorm.DB, error) {
	maxPrioritySubQuery := DB.Model(&Ability{}).Select("MAX(priority)").Where(commonGroupCol+" = ? and model = ? and enabled = ?", group, model, true)
	channelQuery := DB.Where(commonGroupCol+" = ? and model = ? and enabled = ? and priority = (?)", group, model, true, maxPrioritySubQuery)
	if retry != 0 {
		priority, err := getPriority(group, model, retry)
		if err != nil {
			return nil, err
		} else {
			channelQuery = DB.Where(commonGroupCol+" = ? and model = ? and enabled = ? and priority = ?", group, model, true, priority)
		}
	}

	return channelQuery, nil
}

func GetChannel(group string, model string, retry int, requestPath string) (*Channel, error) {
	return GetChannelWithOptions(group, model, retry, ChannelSelectionOptions{AllowCoolingFallback: true, RequestPath: requestPath, Path: requestPath})
}

func GetChannelWithOptions(group string, model string, retry int, options ChannelSelectionOptions) (*Channel, error) {
	var abilities []Ability

	err := DB.Where(commonGroupCol+" = ? and model = ? and enabled = ?", group, model, true).
		Order("priority DESC").
		Order("weight DESC").
		Find(&abilities).Error
	if err != nil {
		return nil, err
	}
	// Advanced Custom (type 58) channels only serve the request paths their
	// configured routes match; drop the rest before health/priority selection.
	abilities = filterAbilitiesByRequestPathAndModel(abilities, options.RequestPath, model)

	avoidedChannelIDs := avoidedHostChannelIDs(abilities, options.AvoidChannelHosts, options.RequestPath, model)
	availableAbilities := make([]Ability, 0, len(abilities))
	coolingAbilities := make([]Ability, 0, len(abilities))
	for _, ability := range abilities {
		if _, excluded := options.ExcludedChannelIDs[ability.ChannelId]; excluded {
			continue
		}
		if IsChannelCoolingDown(ability.ChannelId) {
			coolingAbilities = append(coolingAbilities, ability)
			continue
		}
		key := ChannelHealthKey{ChannelID: ability.ChannelId, Model: model, Path: options.Path}
		if !IsChannelHealthAvailable(key) {
			continue
		}
		availableAbilities = append(availableAbilities, ability)
	}
	if len(availableAbilities) == 0 && options.AllowCoolingFallback {
		availableAbilities = coolingAbilities
	}
	if len(availableAbilities) == 0 {
		return nil, nil
	}

	uniquePriorities := make(map[int]bool)
	for _, ability := range availableAbilities {
		priority := int(0)
		if ability.Priority != nil {
			priority = int(*ability.Priority)
		}
		uniquePriorities[priority] = true
	}

	var sortedUniquePriorities []int
	for priority := range uniquePriorities {
		sortedUniquePriorities = append(sortedUniquePriorities, priority)
	}
	sort.Sort(sort.Reverse(sort.IntSlice(sortedUniquePriorities)))

	if retry >= len(sortedUniquePriorities) {
		retry = len(sortedUniquePriorities) - 1
	}
	targetPriority := sortedUniquePriorities[retry]

	var preferredAbilities []Ability
	var avoidedAbilities []Ability
	for _, ability := range availableAbilities {
		priority := int(0)
		if ability.Priority != nil {
			priority = int(*ability.Priority)
		}
		if priority != targetPriority {
			continue
		}
		if _, avoided := avoidedChannelIDs[ability.ChannelId]; avoided {
			avoidedAbilities = append(avoidedAbilities, ability)
		} else {
			preferredAbilities = append(preferredAbilities, ability)
		}
	}
	if len(preferredAbilities) == 0 && len(avoidedAbilities) == 0 {
		return nil, nil
	}

	preferredWeights := effectiveAbilitySelectionWeights(preferredAbilities, model, options.Path)
	avoidedWeights := effectiveAbilitySelectionWeights(avoidedAbilities, model, options.Path)
	channelId := selectAcquirableAbilityChannelIdWithFallback(
		preferredAbilities,
		preferredWeights,
		avoidedAbilities,
		avoidedWeights,
		model,
		options.Path,
	)
	if channelId == 0 {
		return nil, nil
	}

	channel := Channel{}
	err = DB.First(&channel, "id = ?", channelId).Error
	return &channel, err
}

func effectiveAbilitySelectionWeights(abilities []Ability, model string, path string) []int {
	weights := make([]int, len(abilities))
	for i, ability := range abilities {
		baseWeight := int(ability.Weight) + 10
		weights[i] = EffectiveSelectionWeight(baseWeight, ChannelHealthKey{ChannelID: ability.ChannelId, Model: model, Path: path})
	}
	return weights
}

func selectAcquirableAbilityChannelIdWithFallback(preferred []Ability, preferredWeights []int, fallback []Ability, fallbackWeights []int, model string, path string) int {
	if len(preferred) > 0 {
		if channelID := selectAcquirableAbilityChannelId(preferred, preferredWeights, model, path); channelID != 0 {
			return channelID
		}
	}
	return selectAcquirableAbilityChannelId(fallback, fallbackWeights, model, path)
}

func avoidedHostChannelIDs(abilities []Ability, avoidHosts map[string]struct{}, requestPath string, model string) map[int]struct{} {
	if len(abilities) == 0 || len(avoidHosts) == 0 {
		return nil
	}
	channelIDs := make([]int, 0, len(abilities))
	seen := make(map[int]struct{}, len(abilities))
	for _, ability := range abilities {
		if _, ok := seen[ability.ChannelId]; ok {
			continue
		}
		seen[ability.ChannelId] = struct{}{}
		channelIDs = append(channelIDs, ability.ChannelId)
	}

	var channels []Channel
	if err := DB.Select("id", "type", "base_url", "settings").Where("id IN ?", channelIDs).Find(&channels).Error; err != nil {
		return nil
	}
	avoided := make(map[int]struct{})
	for i := range channels {
		var config *dto.AdvancedCustomConfig
		if channels[i].Type == constant.ChannelTypeAdvancedCustom {
			settings, err := channels[i].parseOtherSettings()
			if err != nil {
				common.SysLog(fmt.Sprintf("failed to parse retry host settings: channel_id=%d, error=%v", channels[i].Id, err))
			} else {
				config = settings.AdvancedCustom
			}
		}
		host := channelRetryHost(&channels[i], config, requestPath, model)
		if host == "" {
			continue
		}
		if _, ok := avoidHosts[host]; ok {
			avoided[channels[i].Id] = struct{}{}
		}
	}
	return avoided
}

// selectAcquirableAbilityChannelId picks a weighted-random starting
// candidate, then tries every candidate exactly once, wrapping around from
// that start point, until one successfully acquires its health lease. This
// ensures a lost half-open probe race on the initial pick still falls back
// to other available candidates instead of failing outright. Returns 0 if
// none can be acquired.
func selectAcquirableAbilityChannelId(candidates []Ability, weights []int, model string, path string) int {
	totalWeight := 0
	for _, w := range weights {
		totalWeight += w
	}
	if totalWeight <= 0 {
		return 0
	}

	startIdx := 0
	cumulative := 0
	randomWeight := common.GetRandomInt(totalWeight)
	for i, w := range weights {
		cumulative += w
		if randomWeight < cumulative {
			startIdx = i
			break
		}
	}

	for offset := 0; offset < len(candidates); offset++ {
		idx := (startIdx + offset) % len(candidates)
		ability := candidates[idx]
		key := ChannelHealthKey{ChannelID: ability.ChannelId, Model: model, Path: path}
		if AcquireChannelHealth(key) {
			return ability.ChannelId
		}
	}
	return 0
}

// filterAbilitiesByRequestPathAndModel restricts candidates by request path and
// model for the DB (non-memory-cache) selection path. Only Advanced Custom
// (type 58) channels are path-checked: kept only when one of their routes matches
// requestPath and model; all other channel types always pass. When requestPath is
// empty, filtering is skipped.
func filterAbilitiesByRequestPathAndModel(abilities []Ability, requestPath string, model string) []Ability {
	if requestPath == "" || len(abilities) == 0 {
		return abilities
	}

	channelIds := make([]int, 0, len(abilities))
	seen := make(map[int]struct{}, len(abilities))
	for _, ability := range abilities {
		if _, ok := seen[ability.ChannelId]; ok {
			continue
		}
		seen[ability.ChannelId] = struct{}{}
		channelIds = append(channelIds, ability.ChannelId)
	}

	var channels []*Channel
	if err := DB.Where("id IN ?", channelIds).Find(&channels).Error; err != nil {
		// On error, fall back to unfiltered candidates to avoid blocking selection
		return abilities
	}

	advancedConfigs := make(map[int]*dto.AdvancedCustomConfig)
	for _, channel := range channels {
		if channel.Type == constant.ChannelTypeAdvancedCustom {
			advancedConfigs[channel.Id] = channel.GetOtherSettings().AdvancedCustom
		}
	}

	filtered := make([]Ability, 0, len(abilities))
	for _, ability := range abilities {
		config, isAdvancedCustom := advancedConfigs[ability.ChannelId]
		if !isAdvancedCustom {
			filtered = append(filtered, ability)
			continue
		}
		if config != nil && config.SupportsPathForModel(requestPath, model) {
			filtered = append(filtered, ability)
		}
	}
	return filtered
}

func (channel *Channel) AddAbilities(tx *gorm.DB) error {
	models_ := strings.Split(channel.Models, ",")
	groups_ := strings.Split(channel.Group, ",")
	abilitySet := make(map[string]struct{})
	abilities := make([]Ability, 0, len(models_))
	for _, model := range models_ {
		for _, group := range groups_ {
			key := group + "|" + model
			if _, exists := abilitySet[key]; exists {
				continue
			}
			abilitySet[key] = struct{}{}
			ability := Ability{
				Group:     group,
				Model:     model,
				ChannelId: channel.Id,
				Enabled:   channel.Status == common.ChannelStatusEnabled,
				Priority:  channel.Priority,
				Weight:    uint(channel.GetWeight()),
				Tag:       channel.Tag,
			}
			abilities = append(abilities, ability)
		}
	}
	if len(abilities) == 0 {
		return nil
	}
	// choose DB or provided tx
	useDB := DB
	if tx != nil {
		useDB = tx
	}
	for _, chunk := range lo.Chunk(abilities, 50) {
		err := useDB.Clauses(clause.OnConflict{DoNothing: true}).Create(&chunk).Error
		if err != nil {
			return err
		}
	}
	return nil
}

func (channel *Channel) DeleteAbilities() error {
	return DB.Where("channel_id = ?", channel.Id).Delete(&Ability{}).Error
}

// UpdateAbilities updates abilities of this channel.
// Make sure the channel is completed before calling this function.
func (channel *Channel) UpdateAbilities(tx *gorm.DB) error {
	isNewTx := false
	// 如果没有传入事务，创建新的事务
	if tx == nil {
		tx = DB.Begin()
		if tx.Error != nil {
			return tx.Error
		}
		isNewTx = true
		defer func() {
			if r := recover(); r != nil {
				tx.Rollback()
			}
		}()
	}

	// First delete all abilities of this channel
	err := tx.Where("channel_id = ?", channel.Id).Delete(&Ability{}).Error
	if err != nil {
		if isNewTx {
			tx.Rollback()
		}
		return err
	}

	// Then add new abilities
	models_ := strings.Split(channel.Models, ",")
	groups_ := strings.Split(channel.Group, ",")
	abilitySet := make(map[string]struct{})
	abilities := make([]Ability, 0, len(models_))
	for _, model := range models_ {
		for _, group := range groups_ {
			key := group + "|" + model
			if _, exists := abilitySet[key]; exists {
				continue
			}
			abilitySet[key] = struct{}{}
			ability := Ability{
				Group:     group,
				Model:     model,
				ChannelId: channel.Id,
				Enabled:   channel.Status == common.ChannelStatusEnabled,
				Priority:  channel.Priority,
				Weight:    uint(channel.GetWeight()),
				Tag:       channel.Tag,
			}
			abilities = append(abilities, ability)
		}
	}

	if len(abilities) > 0 {
		for _, chunk := range lo.Chunk(abilities, 50) {
			err = tx.Clauses(clause.OnConflict{DoNothing: true}).Create(&chunk).Error
			if err != nil {
				if isNewTx {
					tx.Rollback()
				}
				return err
			}
		}
	}

	// 如果是新创建的事务，需要提交
	if isNewTx {
		return tx.Commit().Error
	}

	return nil
}

func UpdateAbilityStatus(channelId int, status bool) error {
	return DB.Model(&Ability{}).Where("channel_id = ?", channelId).Select("enabled").Update("enabled", status).Error
}

func UpdateAbilityStatusByTag(tag string, status bool) error {
	return DB.Model(&Ability{}).Where("tag = ?", tag).Select("enabled").Update("enabled", status).Error
}

func UpdateAbilityByTag(tag string, newTag *string, priority *int64, weight *uint) error {
	ability := Ability{}
	if newTag != nil {
		ability.Tag = newTag
	}
	if priority != nil {
		ability.Priority = priority
	}
	if weight != nil {
		ability.Weight = *weight
	}
	return DB.Model(&Ability{}).Where("tag = ?", tag).Updates(ability).Error
}

var fixLock = sync.Mutex{}

func FixAbility() (int, int, error) {
	lock := fixLock.TryLock()
	if !lock {
		return 0, 0, errors.New("已经有一个修复任务在运行中，请稍后再试")
	}
	defer fixLock.Unlock()

	// truncate abilities table
	if common.UsingMainDatabase(common.DatabaseTypeSQLite) {
		err := DB.Exec("DELETE FROM abilities").Error
		if err != nil {
			common.SysLog(fmt.Sprintf("Delete abilities failed: %s", err.Error()))
			return 0, 0, err
		}
	} else {
		err := DB.Exec("TRUNCATE TABLE abilities").Error
		if err != nil {
			common.SysLog(fmt.Sprintf("Truncate abilities failed: %s", err.Error()))
			return 0, 0, err
		}
	}
	var channels []*Channel
	// Find all channels
	err := DB.Model(&Channel{}).Find(&channels).Error
	if err != nil {
		return 0, 0, err
	}
	if len(channels) == 0 {
		return 0, 0, nil
	}
	successCount := 0
	failCount := 0
	for _, chunk := range lo.Chunk(channels, 50) {
		ids := lo.Map(chunk, func(c *Channel, _ int) int { return c.Id })
		// Delete all abilities of this channel
		err = DB.Where("channel_id IN ?", ids).Delete(&Ability{}).Error
		if err != nil {
			common.SysLog(fmt.Sprintf("Delete abilities failed: %s", err.Error()))
			failCount += len(chunk)
			continue
		}
		// Then add new abilities
		for _, channel := range chunk {
			err = channel.AddAbilities(nil)
			if err != nil {
				common.SysLog(fmt.Sprintf("Add abilities for channel %d failed: %s", channel.Id, err.Error()))
				failCount++
			} else {
				successCount++
			}
		}
	}
	InitChannelCache()
	return successCount, failCount, nil
}
