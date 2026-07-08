package model

import (
	"errors"
	"fmt"
	"math/rand"
	"sort"
	"strings"
	"sync"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
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

type codexAbilityGovernanceState struct {
	Disabled bool
	Removed  bool
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

func GetChannelCandidates(group string, model string, retry int) ([]*Channel, error) {
	return GetChannelCandidatesWithFilter(group, model, retry, nil)
}

func GetChannelCandidatesWithFilter(group string, model string, retry int, filter ChannelFilter) ([]*Channel, error) {
	var abilities []Ability
	err := DB.Where(commonGroupCol+" = ? and model = ? and enabled = ?", group, model, true).
		Order("priority DESC, weight DESC").
		Find(&abilities).Error
	if err != nil {
		return nil, err
	}
	if len(abilities) == 0 {
		normalizedModel := ratio_setting.FormatMatchingModelName(model)
		if normalizedModel != model {
			return GetChannelCandidatesWithFilter(group, normalizedModel, retry, filter)
		}
		return nil, nil
	}

	channelIds := make([]int, 0, len(abilities))
	for _, ability := range abilities {
		channelIds = append(channelIds, ability.ChannelId)
	}

	channelsByID := make(map[int]*Channel, len(channelIds))
	var channels []*Channel
	if err = DB.Where("id in ?", channelIds).Find(&channels).Error; err != nil {
		return nil, err
	}
	for _, channel := range channels {
		channelsByID[channel.Id] = channel
	}

	candidates := make([]abilityChannelCandidate, 0, len(abilities))
	for _, ability := range abilities {
		channel, ok := channelsByID[ability.ChannelId]
		if !ok {
			return nil, fmt.Errorf("鏁版嵁搴撲竴鑷存€ч敊璇紝娓犻亾# %d 涓嶅瓨鍦紝璇疯仈绯荤鐞嗗憳淇", ability.ChannelId)
		}
		if channel.Status != common.ChannelStatusEnabled {
			continue
		}
		if filter == nil || filter(channel) {
			candidate := *channel
			weight := ability.Weight
			candidate.Priority = ability.Priority
			candidate.Weight = &weight
			candidates = append(candidates, abilityChannelCandidate{ability: ability, channel: candidate})
		}
	}
	if len(candidates) == 0 {
		return nil, nil
	}

	targetCandidates := filterAbilityCandidatesByRetryExact(candidates, retry)
	if len(targetCandidates) == 0 {
		return nil, nil
	}

	candidateChannels := make([]*Channel, 0, len(targetCandidates))
	for i := range targetCandidates {
		candidateChannels = append(candidateChannels, &targetCandidates[i].channel)
	}
	return candidateChannels, nil
}

func GetChannel(group string, model string, retry int) (*Channel, error) {
	return GetChannelWithFilter(group, model, retry, nil)
}

type abilityChannelCandidate struct {
	ability Ability
	channel Channel
}

func GetChannelWithFilter(group string, model string, retry int, filter ChannelFilter) (*Channel, error) {
	var abilities []Ability

	channelQuery := DB.Where(&Ability{Group: group, Model: model, Enabled: true})
	err := channelQuery.Order("priority DESC, weight DESC").Find(&abilities).Error
	if err != nil {
		return nil, err
	}
	if len(abilities) == 0 {
		return nil, nil
	}

	channelIDs := make([]int, 0, len(abilities))
	for _, ability := range abilities {
		channelIDs = append(channelIDs, ability.ChannelId)
	}

	var channels []Channel
	if err = DB.Find(&channels, "id IN ?", channelIDs).Error; err != nil {
		return nil, err
	}
	channelByID := make(map[int]Channel, len(channels))
	for _, channel := range channels {
		channelByID[channel.Id] = channel
	}

	candidates := make([]abilityChannelCandidate, 0, len(abilities))
	for _, ability := range abilities {
		candidate, ok := channelByID[ability.ChannelId]
		if !ok {
			return nil, fmt.Errorf("数据库一致性错误，渠道# %d 不存在，请联系管理员修复", ability.ChannelId)
		}
		if candidate.Status != common.ChannelStatusEnabled {
			continue
		}
		if filter == nil || filter(&candidate) {
			candidates = append(candidates, abilityChannelCandidate{ability: ability, channel: candidate})
		}
	}
	if len(candidates) == 0 {
		return nil, nil
	}

	targetCandidates := filterAbilityCandidatesByRetry(candidates, retry)
	if len(targetCandidates) == 0 {
		return nil, nil
	}
	channel := pickAbilityCandidateByWeight(targetCandidates).channel
	return &channel, nil
}

func filterAbilityCandidatesByRetry(candidates []abilityChannelCandidate, retry int) []abilityChannelCandidate {
	return filterAbilityCandidatesByRetryWithClamp(candidates, retry, true)
}

func filterAbilityCandidatesByRetryExact(candidates []abilityChannelCandidate, retry int) []abilityChannelCandidate {
	return filterAbilityCandidatesByRetryWithClamp(candidates, retry, false)
}

func filterAbilityCandidatesByRetryWithClamp(candidates []abilityChannelCandidate, retry int, clamp bool) []abilityChannelCandidate {
	uniquePriorities := make(map[int64]bool)
	for _, candidate := range candidates {
		uniquePriorities[getAbilityPriority(candidate.ability)] = true
	}
	sortedUniquePriorities := make([]int64, 0, len(uniquePriorities))
	for priority := range uniquePriorities {
		sortedUniquePriorities = append(sortedUniquePriorities, priority)
	}
	sort.Slice(sortedUniquePriorities, func(i, j int) bool {
		return sortedUniquePriorities[i] > sortedUniquePriorities[j]
	})
	if retry >= len(sortedUniquePriorities) {
		if !clamp {
			return nil
		}
		retry = len(sortedUniquePriorities) - 1
	}
	targetPriority := sortedUniquePriorities[retry]

	targetCandidates := make([]abilityChannelCandidate, 0, len(candidates))
	for _, candidate := range candidates {
		if getAbilityPriority(candidate.ability) == targetPriority {
			targetCandidates = append(targetCandidates, candidate)
		}
	}
	return targetCandidates
}

func getAbilityPriority(ability Ability) int64 {
	if ability.Priority == nil {
		return 0
	}
	return *ability.Priority
}

func pickAbilityCandidateByWeight(candidates []abilityChannelCandidate) abilityChannelCandidate {
	if len(candidates) == 1 {
		return candidates[0]
	}

	sumWeight := 0
	for _, candidate := range candidates {
		sumWeight += int(candidate.ability.Weight)
	}

	smoothingFactor := 1
	smoothingAdjustment := 0
	if sumWeight == 0 {
		sumWeight = len(candidates) * 100
		smoothingAdjustment = 100
	} else if sumWeight/len(candidates) < 10 {
		smoothingFactor = 100
	}

	randomWeight := rand.Intn(sumWeight * smoothingFactor)
	for _, candidate := range candidates {
		randomWeight -= int(candidate.ability.Weight)*smoothingFactor + smoothingAdjustment
		if randomWeight < 0 {
			return candidate
		}
	}
	return candidates[len(candidates)-1]
}

func (channel *Channel) AddAbilities(tx *gorm.DB) error {
	abilities, err := channel.buildAbilities(tx)
	if err != nil {
		return err
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

func (channel *Channel) buildAbilities(tx *gorm.DB) ([]Ability, error) {
	models_ := strings.Split(channel.Models, ",")
	groups_ := strings.Split(channel.Group, ",")
	governanceByModel, err := channel.codexAbilityGovernanceByModel(tx, models_)
	if err != nil {
		return nil, err
	}
	abilitySet := make(map[string]struct{})
	abilities := make([]Ability, 0, len(models_)*len(groups_))
	for _, model := range models_ {
		governance := governanceByModel[strings.TrimSpace(model)]
		if governance.Removed {
			continue
		}
		for _, group := range groups_ {
			key := group + "|" + model
			if _, exists := abilitySet[key]; exists {
				continue
			}
			abilitySet[key] = struct{}{}
			enabled := channel.Status == common.ChannelStatusEnabled
			if governance.Disabled {
				enabled = false
			}
			ability := Ability{
				Group:     group,
				Model:     model,
				ChannelId: channel.Id,
				Enabled:   enabled,
				Priority:  channel.Priority,
				Weight:    uint(channel.GetWeight()),
				Tag:       channel.Tag,
			}
			abilities = append(abilities, ability)
		}
	}
	return abilities, nil
}

func (channel *Channel) codexAbilityGovernanceByModel(tx *gorm.DB, modelNames []string) (map[string]codexAbilityGovernanceState, error) {
	result := make(map[string]codexAbilityGovernanceState)
	if channel.Type != constant.ChannelTypeCodex {
		return result, nil
	}
	modelNames = normalizeLookupValues(modelNames)
	if len(modelNames) == 0 {
		return result, nil
	}
	useDB := DB
	if tx != nil {
		useDB = tx
	}
	if useDB == nil {
		return result, nil
	}

	var records []CodexModelGovernanceRecord
	if err := useDB.Model(&CodexModelGovernanceRecord{}).
		Where("model_name IN ?", modelNames).
		Find(&records).Error; err != nil {
		if isModelAvailabilityTableMissingError(err) {
			return result, nil
		}
		return nil, err
	}
	for _, record := range records {
		state := result[record.ModelName]
		switch record.Status {
		case CodexModelGovernanceStatusRemoved:
			if codexModelGovernanceRecordAffectsChannel(record, channel.Id) {
				state.Removed = true
				state.Disabled = true
			}
		case CodexModelGovernanceStatusUnsupportedDisabled:
			if codexModelGovernanceRecordDisablesChannel(record, channel.Id) {
				state.Disabled = true
			}
		case CodexModelGovernanceStatusUnsupportedPendingReview:
			if codexModelGovernanceRecordDisablesChannel(record, channel.Id) {
				state.Disabled = true
			}
		}
		result[record.ModelName] = state
	}
	return result, nil
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
	abilities, err := channel.buildAbilities(tx)
	if err != nil {
		if isNewTx {
			tx.Rollback()
		}
		return err
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
	return DB.Transaction(func(tx *gorm.DB) error {
		if err := tx.Model(&Ability{}).Where("channel_id = ?", channelId).Select("enabled").Update("enabled", status).Error; err != nil {
			return err
		}
		if status {
			_, err := reapplyCodexModelGovernanceDisabledAbilitiesWithDB(tx, []int{channelId})
			return err
		}
		return nil
	})
}

func UpdateAbilityStatusByTag(tag string, status bool) error {
	return DB.Transaction(func(tx *gorm.DB) error {
		if err := tx.Model(&Ability{}).Where("tag = ?", tag).Select("enabled").Update("enabled", status).Error; err != nil {
			return err
		}
		if !status {
			return nil
		}
		var channelIDs []int
		if err := tx.Model(&Channel{}).Where("tag = ?", tag).Pluck("id", &channelIDs).Error; err != nil {
			return err
		}
		_, err := reapplyCodexModelGovernanceDisabledAbilitiesWithDB(tx, channelIDs)
		return err
	})
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

// UpdateAbilityByIds 对一批渠道的 abilities 做定向 priority/weight 更新（map 写入，
// 避免 GORM 对结构体 Updates 跳过 weight=0 等零值）。用于仅改 priority/weight、
// 无需重建 abilities 的批量编辑场景（镜像 UpdateAbilityByTag，但 WHERE 为 id IN）。
func UpdateAbilityByIds(ids []int, priority *int64, weight *uint) error {
	if len(ids) == 0 {
		return nil
	}
	updates := map[string]interface{}{}
	if priority != nil {
		updates["priority"] = *priority
	}
	if weight != nil {
		updates["weight"] = *weight
	}
	if len(updates) == 0 {
		return nil
	}
	return DB.Model(&Ability{}).Where("channel_id IN ?", ids).Updates(updates).Error
}

// rebuildAbilitiesForChannels 对一组渠道逐个重建 abilities，失败仅记日志、不中断。
// 供 EditChannelByTag 与 EditChannelsByIds 的 models/group 变更路径复用。
func rebuildAbilitiesForChannels(channels []*Channel) {
	for _, channel := range channels {
		if err := channel.UpdateAbilities(nil); err != nil {
			common.SysLog(fmt.Sprintf("failed to update abilities: channel_id=%d, tag=%s, error=%v", channel.Id, channel.GetTag(), err))
		}
	}
}

var fixLock = sync.Mutex{}

func FixAbility() (int, int, error) {
	lock := fixLock.TryLock()
	if !lock {
		return 0, 0, errors.New("已经有一个修复任务在运行中，请稍后再试")
	}
	defer fixLock.Unlock()

	// truncate abilities table
	if common.UsingSQLite {
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
