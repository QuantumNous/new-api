package channel

import (
	"errors"
	"fmt"
	"github.com/QuantumNous/new-api/internal/common/dbx"
	"strings"
	"sync"

	"github.com/QuantumNous/new-api/internal/common"
	"github.com/QuantumNous/new-api/internal/constant"
	"github.com/QuantumNous/new-api/relaykit/dto"

	"github.com/samber/lo"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

type Ability struct {
	Group     string `json:"group" gorm:"type:varchar(64);primaryKey;autoIncrement:false"`
	Model     string `json:"model" gorm:"type:varchar(255);primaryKey;autoIncrement:false"`
	ChannelId int    `json:"channel_id" gorm:"primaryKey;autoIncrement:false;index"`
	Enabled   bool   `json:"enabled"`
	// AutoDisabled marks a row disabled by health/routing automation rather
	// than by an operator. Only marked rows are eligible for automatic
	// recovery; a manual disable is never silently revived.
	AutoDisabled bool    `json:"auto_disabled" gorm:"not null;default:false"`
	Tag          *string `json:"tag" gorm:"index"`
}

type AbilityWithChannel struct {
	Ability
	ChannelType int `json:"channel_type"`
}

func GetAllEnableAbilityWithChannels() ([]AbilityWithChannel, error) {
	var abilities []AbilityWithChannel
	err := dbx.DB.Table("abilities").
		Select("abilities.*, channels.type as channel_type").
		Joins("left join channels on abilities.channel_id = channels.id").
		Where("abilities.enabled = ?", true).
		Scan(&abilities).Error
	return abilities, err
}

func GetGroupEnabledModels(group string) []string {
	var models []string
	// Find distinct models
	dbx.DB.Table("abilities").Where(dbx.GroupCol()+" = ? and enabled = ?", group, true).Distinct("model").Pluck("model", &models)
	return models
}

func GetEnabledModels() []string {
	var models []string
	// Find distinct models
	dbx.DB.Table("abilities").Where("enabled = ?", true).Distinct("model").Pluck("model", &models)
	return models
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
	if err := dbx.DB.Where("id IN ?", channelIds).Find(&channels).Error; err != nil {
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
				Tag:       channel.Tag,
			}
			abilities = append(abilities, ability)
		}
	}
	if len(abilities) == 0 {
		return nil
	}
	// choose DB or provided tx
	useDB := dbx.DB
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

func deleteAbilitiesWithTx(tx *gorm.DB, channelID int) error {
	if tx == nil {
		return errors.New("ability deletion requires a transaction")
	}
	return tx.Where("channel_id = ?", channelID).Delete(&Ability{}).Error
}

// UpdateAbilities updates abilities of this channel.
// Make sure the channel is completed before calling this function.
func (channel *Channel) UpdateAbilities(tx *gorm.DB) error {
	isNewTx := false
	// 如果没有传入事务，创建新的事务
	if tx == nil {
		tx = dbx.DB.Begin()
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
	// Model-level isolation (DisableChannelModel) writes enabled=false rows.
	// A rebuild triggered by any unrelated edit — channel save, upstream model
	// sync, tag edit — must not resurrect an isolated model: remember which
	// models were disabled before the delete and keep them off. A model dropped
	// from the list loses its rows entirely, so removing a model, saving, then
	// re-adding it is the explicit way to clear isolation.
	var isolatedModels []string
	if err := tx.Model(&Ability{}).
		Where("channel_id = ? AND enabled = ?", channel.Id, false).
		Distinct().Pluck("model", &isolatedModels).Error; err != nil {
		if isNewTx {
			tx.Rollback()
		}
		return err
	}
	isolated := make(map[string]struct{}, len(isolatedModels))
	for _, model := range isolatedModels {
		isolated[model] = struct{}{}
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
			enabled := channel.Status == common.ChannelStatusEnabled
			if _, wasIsolated := isolated[model]; wasIsolated {
				enabled = false
			}
			ability := Ability{
				Group:     group,
				Model:     model,
				ChannelId: channel.Id,
				Enabled:   enabled,
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

	// The ability rows were rebuilt from the channel's current model list, so any
	// unit health row for a model that is no longer declared is unreachable by
	// the selectors and would only survive as a ghost row. Models that survived
	// the edit keep their unit state (preserved above). EditChannelByTag reaches
	// this through the same call, so it needs no separate wiring.
	if err = deleteUnitHealthNotInModelsWithTx(tx, channel.Id, models_); err != nil {
		if isNewTx {
			tx.Rollback()
		}
		return err
	}

	// The ability set is the pressure denominator, so a rebuilt model list must
	// refresh it; otherwise a model that gained or lost channels keeps stale
	// availability and the three-tier thresholds fire on the wrong ratio.
	pressureRecomputeTotals(tx)

	// 如果是新创建的事务，需要提交
	if isNewTx {
		return tx.Commit().Error
	}

	return nil
}

// RebuildChannelRouting rewrites one channel's ability rows and resyncs its
// route rows under a single MutateGatewayRouting revision. Callers that changed
// a channel's model list outside the channel CRUD path — the upstream model
// sync is the one in tree — must use this instead of UpdateAbilities alone:
// abilities without a route resync leave newly added models unroutable and
// removed models still serving.
func (channel *Channel) RebuildChannelRouting() error {
	_, err := MutateGatewayRouting(func(tx *gorm.DB) error {
		if err := channel.UpdateAbilities(tx); err != nil {
			return err
		}
		return SyncChannelModelRoutesWithTx(tx, channel.Id)
	})
	return err
}

func UpdateAbilityStatus(channelId int, status bool) error {
	return updateAbilityStatusWithTx(dbx.DB, channelId, status)
}

// updateAbilityStatusWithTx is the tx-aware form of UpdateAbilityStatus. It
// writes the enabled column for every ability row of the channel through the
// given transaction so callers can commit it together with the channel status
// and the gateway routing revision bump.
func updateAbilityStatusWithTx(tx *gorm.DB, channelId int, status bool) error {
	// Channel-level changes own the whole row set, so any model-level auto
	// marker is stale here: the channel status (not the ability marker) is
	// what recovery follows.
	return tx.Model(&Ability{}).Where("channel_id = ?", channelId).
		Updates(map[string]any{"enabled": status, "auto_disabled": false}).Error
}

// updateAbilityStatusByTagWithTx is the tx-aware form of
// UpdateAbilityStatusByTag. It flips the enabled column for every ability
// row carrying the given tag inside the outer transaction so the channel
// status update and the routing revision bump commit together.
func updateAbilityStatusByTagWithTx(tx *gorm.DB, tag string, status bool) error {
	return tx.Model(&Ability{}).Where("tag = ?", tag).
		Updates(map[string]any{"enabled": status, "auto_disabled": false}).Error
}

// updateAbilityStatusByModelWithTx is the tx-aware form of
// DisableChannelModel. It flips the enabled column for every ability
// row matching both the given channel_id and model_name inside the outer
// transaction. It deliberately does NOT filter on group, so a single
// channel+model pair across all groups has its enabled status flipped —
// a single dead model on an otherwise healthy channel should not cost the
// channel its other models.
func updateAbilityStatusByModelWithTx(tx *gorm.DB, channelID int, modelName string, status bool, autoDisabled bool) error {
	return tx.Model(&Ability{}).
		Where("channel_id = ? AND model = ?", channelID, modelName).
		Updates(map[string]any{"enabled": status, "auto_disabled": autoDisabled}).Error
}

// DisableChannelModel isolates one model on one channel: every ability row
// matching the channel_id and model_name flips to enabled=false inside one
// MutateGatewayRouting revision, and SyncChannelModelRoutesWithTx derives the
// matching route rows to enabled=false in the same transaction, so the model
// disappears from the marketplace AND stops receiving traffic together.
// A single disabled model on an otherwise healthy channel should not cost the
// channel its other models; this helper spans ALL groups deliberately.
// The row is marked auto_disabled=false: this is an operator action and
// automatic recovery must not revive it.
// Returns an error if modelName is empty, as there is nothing specific to disable.
func DisableChannelModel(channelID int, modelName string) error {
	return setChannelModelEnabled(channelID, modelName, false, false)
}

// AutoDisableChannelModel is the automatic counterpart of DisableChannelModel:
// it marks the rows auto_disabled=true so startup recovery can revive them
// after the health episode passes. No health path calls it today (health
// exclusion is the live cooldown only); it exists so any future automatic
// path has a recoverable, auditable shape.
func AutoDisableChannelModel(channelID int, modelName string) error {
	return setChannelModelEnabled(channelID, modelName, false, true)
}

func setChannelModelEnabled(channelID int, modelName string, enabled bool, autoDisabled bool) error {
	if modelName == "" {
		return fmt.Errorf("model name must not be empty")
	}
	_, err := MutateGatewayRouting(func(tx *gorm.DB) error {
		if err := updateAbilityStatusByModelWithTx(tx, channelID, modelName, enabled, autoDisabled); err != nil {
			return err
		}
		// The ability row alone no longer decides candidacy, so the channel's route
		// rows must be resynced or the disabled model keeps serving.
		return SyncChannelModelRoutesWithTx(tx, channelID)
	})
	return err
}

// UpdateAbilityStatusByTag remains the public convenience wrapper. It
// delegates to the tx-aware form with the shared DB handle so callers that
// are not inside a MutateGatewayRouting transaction keep working.
func UpdateAbilityStatusByTag(tag string, status bool) error {
	return updateAbilityStatusByTagWithTx(dbx.DB, tag, status)
}

// updateAbilityByTagWithTx is the tx-aware form of UpdateAbilityByTag. It
// writes the tag column for every ability row carrying the given tag inside the
// outer transaction. Priority and weight are gone with the tier scheduler.
func updateAbilityByTagWithTx(tx *gorm.DB, tag string, newTag *string) error {
	ability := Ability{}
	if newTag != nil {
		ability.Tag = newTag
	}
	return tx.Model(&Ability{}).Where("tag = ?", tag).Updates(ability).Error
}

// UpdateAbilityByTag remains the public convenience wrapper. It delegates to
// the tx-aware form with the shared DB handle.
func UpdateAbilityByTag(tag string, newTag *string) error {
	return updateAbilityByTagWithTx(dbx.DB, tag, newTag)
}

// deleteAbilitiesByChannelIDsWithTx deletes every ability row whose
// channel_id is in ids inside the given transaction, so batch channel
// deletion and the routing revision bump commit atomically.
func deleteAbilitiesByChannelIDsWithTx(tx *gorm.DB, ids []int) error {
	if len(ids) == 0 {
		return nil
	}
	return tx.Where("channel_id in (?)", ids).Delete(&Ability{}).Error
}

// deleteAbilitiesByTagWithTx deletes every ability row carrying the given tag
// inside the given transaction. Used when channels sharing a tag are removed.
func deleteAbilitiesByTagWithTx(tx *gorm.DB, tag string) error {
	return tx.Where("tag = ?", tag).Delete(&Ability{}).Error
}

// deleteAbilitiesByStatusWithTx deletes every ability row whose channel has
// the given status, inside the given transaction.
func deleteAbilitiesByStatusWithTx(tx *gorm.DB, status int64) error {
	return tx.Where("channel_id IN (SELECT id FROM channels WHERE status = ?)", status).Delete(&Ability{}).Error
}

var fixLock = sync.Mutex{}

func FixAbility() (int, int, error) {
	lock := fixLock.TryLock()
	if !lock {
		return 0, 0, errors.New("已经有一个修复任务在运行中，请稍后再试")
	}
	defer fixLock.Unlock()

	// The rebuild is route-visible work, so it commits through
	// MutateGatewayRouting like every other mutation: one transaction, one
	// gateway routing revision bump. A failure rolls the whole repair back
	// instead of leaving a half-rebuilt ability set behind. MySQL TRUNCATE
	// would implicitly commit the transaction, so the clear is a plain DELETE
	// on every dialect.
	var successCount, failCount int
	_, err := MutateGatewayRouting(func(tx *gorm.DB) error {
		if err := tx.Exec("DELETE FROM abilities").Error; err != nil {
			common.SysLog(fmt.Sprintf("Delete abilities failed: %s", err.Error()))
			return err
		}
		var channels []*Channel
		if err := tx.Model(&Channel{}).Find(&channels).Error; err != nil {
			return err
		}
		for _, channel := range channels {
			if err := channel.AddAbilities(tx); err != nil {
				common.SysLog(fmt.Sprintf("Add abilities for channel %d failed: %s", channel.Id, err.Error()))
				failCount++
				continue
			}
			if err := SyncChannelModelRoutesWithTx(tx, channel.Id); err != nil {
				common.SysLog(fmt.Sprintf("Resync routes for channel %d failed: %s", channel.Id, err.Error()))
				failCount++
				continue
			}
			successCount++
		}
		return nil
	})
	if err != nil {
		return 0, 0, err
	}
	InitChannelCache()
	return successCount, failCount, nil
}
