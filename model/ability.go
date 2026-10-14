package model

import (
	"errors"
	"fmt"
	"sort"
	"strings"
	"sync"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/setting/ratio_setting"

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
	ChannelType int `json:"channel_type"`
}

func GetAllEnableAbilityWithChannels() ([]AbilityWithChannel, error) {
	var abilities []AbilityWithChannel
	err := DB.Table("abilities").
		Select("abilities.*, channels.type as channel_type").
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

func GetChannel(group string, model string, retry int, filters []dto.ChannelFilter) (*Channel, error) {
	priorities, err := ListChannelPriorities(group, model, filters)
	if err != nil || retry >= len(priorities) {
		return nil, err
	}
	return GetChannelAtPriority(group, model, priorities[retry], filters)
}

func getEligibleAbilities(group string, modelName string, filters []dto.ChannelFilter) ([]Ability, error) {
	var abilities []Ability
	err := DB.Where(commonGroupCol+" = ? and model = ? and enabled = ?", group, modelName, true).
		Find(&abilities).Error
	if err != nil {
		return nil, err
	}
	if len(abilities) == 0 {
		normalizedModel := ratio_setting.FormatMatchingModelName(modelName)
		err = DB.Where(commonGroupCol+" = ? and model = ? and enabled = ?", group, normalizedModel, true).
			Find(&abilities).Error
	}
	if err != nil {
		return nil, err
	}
	return filterAbilitiesByConstraints(abilities, modelName, filters), nil
}

func GetChannelAtPriority(group string, modelName string, priority int64, filters []dto.ChannelFilter) (*Channel, error) {
	abilities, err := getEligibleAbilities(group, modelName, filters)
	if err != nil {
		return nil, err
	}
	targetAbilities := make([]Ability, 0, len(abilities))
	for _, ability := range abilities {
		abilityPriority := int64(0)
		if ability.Priority != nil {
			abilityPriority = *ability.Priority
		}
		if abilityPriority == priority {
			targetAbilities = append(targetAbilities, ability)
		}
	}
	channel := Channel{}
	if len(targetAbilities) > 0 {
		// Randomly choose one
		weightSum := uint(0)
		for _, ability_ := range targetAbilities {
			weightSum += ability_.Weight + 10
		}
		// Randomly choose one
		weight := common.GetRandomInt(int(weightSum))
		for _, ability_ := range targetAbilities {
			weight -= int(ability_.Weight) + 10
			//log.Printf("weight: %d, ability weight: %d", weight, *ability_.Weight)
			if weight <= 0 {
				channel.Id = ability_.ChannelId
				break
			}
		}
	} else {
		return nil, nil
	}
	err = DB.First(&channel, "id = ?", channel.Id).Error
	return &channel, err
}

func ListChannelIDsAtPriority(group string, modelName string, priority int64, filters []dto.ChannelFilter) ([]int, error) {
	abilities, err := getEligibleAbilities(group, modelName, filters)
	if err != nil {
		return nil, err
	}
	channelIDs := make([]int, 0, len(abilities))
	seen := make(map[int]struct{}, len(abilities))
	for _, ability := range abilities {
		abilityPriority := int64(0)
		if ability.Priority != nil {
			abilityPriority = *ability.Priority
		}
		if abilityPriority != priority {
			continue
		}
		if _, exists := seen[ability.ChannelId]; exists {
			continue
		}
		seen[ability.ChannelId] = struct{}{}
		channelIDs = append(channelIDs, ability.ChannelId)
	}
	return channelIDs, nil
}

func ListChannelPriorities(group string, modelName string, filters []dto.ChannelFilter) ([]int64, error) {
	abilities, err := getEligibleAbilities(group, modelName, filters)
	if err != nil {
		return nil, err
	}
	priorities := make(map[int64]struct{})
	for _, ability := range abilities {
		if ability.Priority == nil {
			priorities[0] = struct{}{}
			continue
		}
		priorities[*ability.Priority] = struct{}{}
	}
	result := make([]int64, 0, len(priorities))
	for priority := range priorities {
		result = append(result, priority)
	}
	sort.Slice(result, func(i, j int) bool { return result[i] > result[j] })
	return result, nil
}

// CountChannelPriorities is the database-backed counterpart of
// CountSatisfiedChannelPriorities.
func CountChannelPriorities(group string, modelName string, filters []dto.ChannelFilter) (int, error) {
	priorities, err := ListChannelPriorities(group, modelName, filters)
	return len(priorities), err
}

// filterAbilitiesByConstraints applies the same ChannelSatisfiesFilters
// predicate used by the memory-cache path. A failed channel lookup fails
// closed when a task-plugin identity is required and fails open otherwise.
func filterAbilitiesByConstraints(abilities []Ability, modelName string, filters []dto.ChannelFilter) []Ability {
	if len(abilities) == 0 {
		return nil
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
		if identityFilterRequiresKey(filters) {
			return nil
		}
		return abilities
	}

	channelsByID := make(map[int]*Channel, len(channels))
	for _, channel := range channels {
		channelsByID[channel.Id] = channel
	}

	filtered := make([]Ability, 0, len(abilities))
	for _, ability := range abilities {
		channel := channelsByID[ability.ChannelId]
		if ok, _ := ChannelSatisfiesFilters(channel, modelName, filters); ok {
			filtered = append(filtered, ability)
		}
	}
	return filtered
}

func identityFilterRequiresKey(filters []dto.ChannelFilter) bool {
	for _, filter := range filters {
		if filter.Kind == dto.FilterTaskPluginIdentity && filter.TaskPluginKey != "" {
			return true
		}
	}
	return false
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
	models_ := channel.GetModels()
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

func listEligibleChannelIDs(group string, modelName string, filters []dto.ChannelFilter) ([]int, error) {
	var abilities []Ability
	err := DB.Where(commonGroupCol+" = ? and model = ? and enabled = ?", group, modelName, true).
		Find(&abilities).Error
	if err != nil {
		return nil, err
	}
	if len(abilities) == 0 {
		normalizedModel := ratio_setting.FormatMatchingModelName(modelName)
		if err := DB.Where(commonGroupCol+" = ? and model = ? and enabled = ?", group, normalizedModel, true).
			Find(&abilities).Error; err != nil {
			return nil, err
		}
	}
	if len(abilities) == 0 {
		return nil, nil
	}
	ids := make([]int, 0, len(abilities))
	seen := make(map[int]struct{}, len(abilities))
	for _, ability := range abilities {
		if _, exists := seen[ability.ChannelId]; exists {
			continue
		}
		seen[ability.ChannelId] = struct{}{}
		ids = append(ids, ability.ChannelId)
	}
	var channels []*Channel
	if err := DB.Where("id IN ?", ids).Find(&channels).Error; err != nil {
		return nil, err
	}
	byID := make(map[int]*Channel, len(channels))
	for _, channel := range channels {
		byID[channel.Id] = channel
	}
	result := make([]int, 0, len(ids))
	for _, id := range ids {
		if ok, _ := ChannelSatisfiesFilters(byID[id], modelName, filters); ok {
			result = append(result, id)
		}
	}
	return result, nil
}
