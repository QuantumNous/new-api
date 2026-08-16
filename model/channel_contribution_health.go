package model

import (
	"errors"
	"fmt"
	"strings"
	"unicode/utf8"

	"github.com/QuantumNous/new-api/common"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

type ChannelContributionModelHealth struct {
	Id             int64  `json:"id" gorm:"primaryKey"`
	ContributionId int    `json:"contribution_id" gorm:"uniqueIndex:uk_contribution_model_health,priority:1;index;not null"`
	RevisionId     int    `json:"revision_id" gorm:"index;not null"`
	ConfigHash     string `json:"-" gorm:"type:varchar(64);index;not null"`
	ChannelId      int    `json:"channel_id" gorm:"index;not null"`
	Model          string `json:"model" gorm:"type:varchar(255);uniqueIndex:uk_contribution_model_health,priority:2;not null"`
	Healthy        bool   `json:"healthy" gorm:"index;not null"`
	FailureSince   int64  `json:"failure_since" gorm:"bigint;index;not null"`
	LastCheckedAt  int64  `json:"last_checked_at" gorm:"bigint;index;not null"`
	LastSuccessAt  int64  `json:"last_success_at" gorm:"bigint;not null"`
	LastFailureAt  int64  `json:"last_failure_at" gorm:"bigint;not null"`
	LastError      string `json:"last_error" gorm:"type:varchar(500);not null"`
	CreatedAt      int64  `json:"created_at" gorm:"bigint;not null"`
	UpdatedAt      int64  `json:"updated_at" gorm:"bigint;index;not null"`
}

type ChannelContributionHealthState struct {
	ContributionId int   `json:"contribution_id" gorm:"primaryKey;autoIncrement:false"`
	ChannelId      int   `json:"channel_id" gorm:"uniqueIndex;not null"`
	FailureSince   int64 `json:"failure_since" gorm:"bigint;index;not null"`
	PausedAt       int64 `json:"paused_at" gorm:"bigint;index;not null"`
	LastCheckedAt  int64 `json:"last_checked_at" gorm:"bigint;index;not null"`
	CreatedAt      int64 `json:"created_at" gorm:"bigint;not null"`
	UpdatedAt      int64 `json:"updated_at" gorm:"bigint;index;not null"`
}

type ChannelContributionHealthCandidate struct {
	ContributionId int                       `json:"contribution_id"`
	ChannelId      int                       `json:"channel_id"`
	UserId         int                       `json:"user_id"`
	RevisionId     int                       `json:"revision_id"`
	ConfigHash     string                    `json:"-"`
	Status         ChannelContributionStatus `json:"status"`
}

type ChannelContributionModelObservation struct {
	Model   string `json:"model"`
	Healthy bool   `json:"healthy"`
	Error   string `json:"error,omitempty"`
}

type ChannelContributionHealthCycleResult struct {
	AllFailed       bool     `json:"all_failed"`
	Paused          bool     `json:"paused"`
	Deleted         bool     `json:"deleted"`
	StateChanged    bool     `json:"state_changed"`
	UnhealthyModels []string `json:"unhealthy_models"`
}

var ErrStaleChannelContributionHealthProbe = errors.New("stale channel contribution health probe")

func (health *ChannelContributionModelHealth) BeforeCreate(_ *gorm.DB) error {
	now := common.GetTimestamp()
	if health.CreatedAt == 0 {
		health.CreatedAt = now
	}
	if health.UpdatedAt == 0 {
		health.UpdatedAt = now
	}
	return nil
}

func (state *ChannelContributionHealthState) BeforeCreate(_ *gorm.DB) error {
	now := common.GetTimestamp()
	if state.CreatedAt == 0 {
		state.CreatedAt = now
	}
	if state.UpdatedAt == 0 {
		state.UpdatedAt = now
	}
	return nil
}

func ListContributionChannelsForHealthAfter(afterContributionId int, limit int) ([]ChannelContributionHealthCandidate, error) {
	if limit <= 0 {
		limit = 100
	}
	if limit > 500 {
		limit = 500
	}
	var candidates []ChannelContributionHealthCandidate
	err := DB.Table("channel_contributions AS contributions").
		Select("contributions.id AS contribution_id, contributions.user_id, contributions.status, contributions.channel_id, revisions.id AS revision_id, revisions.config_hash").
		Joins("JOIN channel_contribution_revisions AS revisions ON revisions.id = contributions.approved_revision_id").
		Where("contributions.id > ? AND contributions.channel_id IS NOT NULL AND contributions.status IN ? AND revisions.status = ?", afterContributionId, []ChannelContributionStatus{
			ChannelContributionStatusApproved,
			ChannelContributionStatusUnavailable,
		}, ChannelContributionRevisionStatusApproved).
		Order("contributions.id asc").
		Limit(limit).
		Scan(&candidates).Error
	if err != nil {
		return nil, err
	}
	return candidates, nil
}

func GetChannelContributionModelHealth(contributionId int) ([]ChannelContributionModelHealth, error) {
	var rows []ChannelContributionModelHealth
	err := DB.Where("contribution_id = ?", contributionId).Order("model asc").Find(&rows).Error
	return rows, err
}

func IsContributionChannel(channelId int) bool {
	if channelId <= 0 {
		return false
	}
	var count int64
	if err := DB.Model(&ChannelContribution{}).
		Where("channel_id = ? AND status IN ?", channelId, []ChannelContributionStatus{
			ChannelContributionStatusApproved,
			ChannelContributionStatusUnavailable,
		}).Count(&count).Error; err != nil {
		return false
	}
	return count > 0
}

func PopulateContributionChannelFlags(channels []*Channel) error {
	channelIds := make([]int, 0, len(channels))
	seen := make(map[int]struct{}, len(channels))
	for _, channel := range channels {
		if channel == nil {
			continue
		}
		channel.IsContribution = false
		if channel.Id <= 0 {
			continue
		}
		if _, exists := seen[channel.Id]; exists {
			continue
		}
		seen[channel.Id] = struct{}{}
		channelIds = append(channelIds, channel.Id)
	}
	if len(channelIds) == 0 {
		return nil
	}

	var contributionChannelIds []int
	if err := DB.Model(&ChannelContribution{}).
		Where("channel_id IN ? AND status IN ?", channelIds, []ChannelContributionStatus{
			ChannelContributionStatusApproved,
			ChannelContributionStatusUnavailable,
		}).
		Distinct().
		Pluck("channel_id", &contributionChannelIds).Error; err != nil {
		return err
	}
	contributionSet := make(map[int]struct{}, len(contributionChannelIds))
	for _, channelId := range contributionChannelIds {
		contributionSet[channelId] = struct{}{}
	}
	for _, channel := range channels {
		if channel == nil {
			continue
		}
		_, channel.IsContribution = contributionSet[channel.Id]
	}
	return nil
}

func lockActiveChannelContributionTx(tx *gorm.DB, channelId int) (*ChannelContribution, error) {
	contributions, err := lockActiveChannelContributionsTx(tx, []int{channelId})
	if err != nil {
		return nil, err
	}
	return contributions[channelId], nil
}

func lockActiveChannelContributionsTx(tx *gorm.DB, channelIds []int) (map[int]*ChannelContribution, error) {
	result := make(map[int]*ChannelContribution)
	if tx == nil || len(channelIds) == 0 || !tx.Migrator().HasTable(&ChannelContribution{}) {
		return result, nil
	}
	var contributions []ChannelContribution
	if err := lockForUpdate(tx).
		Where("channel_id IN ? AND status IN ?", channelIds, []ChannelContributionStatus{
			ChannelContributionStatusApproved,
			ChannelContributionStatusUnavailable,
		}).
		Order("id ASC").
		Find(&contributions).Error; err != nil {
		return nil, err
	}
	for index := range contributions {
		contribution := &contributions[index]
		if contribution.ChannelId != nil {
			result[*contribution.ChannelId] = contribution
		}
	}
	return result, nil
}

func FilterNonContributionChannels(channels []*Channel) []*Channel {
	if len(channels) == 0 {
		return channels
	}
	ids := make([]int, 0, len(channels))
	for _, channel := range channels {
		if channel != nil && channel.Id > 0 {
			ids = append(ids, channel.Id)
		}
	}
	var contributionChannelIds []int
	if err := DB.Model(&ChannelContribution{}).
		Where("channel_id IN ? AND status IN ?", ids, []ChannelContributionStatus{
			ChannelContributionStatusApproved,
			ChannelContributionStatusUnavailable,
		}).Pluck("channel_id", &contributionChannelIds).Error; err != nil {
		return channels
	}
	excluded := make(map[int]struct{}, len(contributionChannelIds))
	for _, id := range contributionChannelIds {
		excluded[id] = struct{}{}
	}
	filtered := make([]*Channel, 0, len(channels)-len(excluded))
	for _, channel := range channels {
		if channel == nil {
			continue
		}
		if _, exists := excluded[channel.Id]; !exists {
			filtered = append(filtered, channel)
		}
	}
	return filtered
}

func setContributionHealthPausedTx(tx *gorm.DB, channelId int, paused bool, now int64) error {
	contribution, err := lockActiveChannelContributionTx(tx, channelId)
	if err != nil {
		return err
	}
	return setLockedContributionHealthPausedTx(tx, contribution, channelId, paused, now)
}

func setLockedContributionHealthPausedTx(tx *gorm.DB, contribution *ChannelContribution, channelId int, paused bool, now int64) error {
	if contribution == nil || !tx.Migrator().HasTable(&ChannelContributionHealthState{}) {
		return nil
	}
	if contribution.ChannelId == nil || *contribution.ChannelId != channelId {
		return errors.New("locked channel contribution does not match channel")
	}
	state := ChannelContributionHealthState{ContributionId: contribution.Id, ChannelId: channelId}
	if err := tx.Clauses(clause.OnConflict{DoNothing: true}).Create(&state).Error; err != nil {
		return err
	}
	if err := lockForUpdate(tx).Where("contribution_id = ?", contribution.Id).First(&state).Error; err != nil {
		return err
	}
	if paused {
		if state.PausedAt != 0 {
			return nil
		}
		return tx.Model(&ChannelContributionHealthState{}).
			Where("contribution_id = ?", contribution.Id).
			Updates(map[string]any{"paused_at": now, "updated_at": now}).Error
	}
	if state.PausedAt == 0 {
		return nil
	}
	pauseDuration := now - state.PausedAt
	if pauseDuration < 0 {
		pauseDuration = 0
	}
	updates := map[string]any{"paused_at": int64(0), "updated_at": now}
	if state.FailureSince > 0 && pauseDuration > 0 {
		updates["failure_since"] = state.FailureSince + pauseDuration
		if err := tx.Model(&ChannelContribution{}).
			Where("id = ? AND unavailable_since > 0", contribution.Id).
			Update("unavailable_since", gorm.Expr("unavailable_since + ?", pauseDuration)).Error; err != nil {
			return err
		}
	}
	if pauseDuration > 0 && tx.Migrator().HasTable(&ChannelContributionModelHealth{}) {
		if err := tx.Model(&ChannelContributionModelHealth{}).
			Where("contribution_id = ? AND failure_since > 0", contribution.Id).
			Update("failure_since", gorm.Expr("failure_since + ?", pauseDuration)).Error; err != nil {
			return err
		}
	}
	return tx.Model(&ChannelContributionHealthState{}).
		Where("contribution_id = ?", contribution.Id).
		Updates(updates).Error
}

func PauseContributionHealthForChannel(channelId int, now int64) error {
	return DB.Transaction(func(tx *gorm.DB) error {
		return setContributionHealthPausedTx(tx, channelId, true, now)
	})
}

func ResumeContributionHealthForChannel(channelId int, now int64) error {
	return DB.Transaction(func(tx *gorm.DB) error {
		return setContributionHealthPausedTx(tx, channelId, false, now)
	})
}

func ApplyChannelContributionHealthCycle(
	contributionId int,
	channelId int,
	revisionId int,
	configHash string,
	observations []ChannelContributionModelObservation,
	now int64,
	deleteAfterSeconds int64,
) (ChannelContributionHealthCycleResult, error) {
	result := ChannelContributionHealthCycleResult{}
	err := DB.Transaction(func(tx *gorm.DB) error {
		var contribution ChannelContribution
		if err := lockForUpdate(tx).
			Where("id = ? AND channel_id = ? AND approved_revision_id = ? AND status IN ?", contributionId, channelId, revisionId, []ChannelContributionStatus{
				ChannelContributionStatusApproved,
				ChannelContributionStatusUnavailable,
			}).First(&contribution).Error; err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				return ErrStaleChannelContributionHealthProbe
			}
			return err
		}
		var revision ChannelContributionRevision
		if err := tx.Select("id", "config_hash", "status").
			Where("id = ? AND contribution_id = ? AND config_hash = ? AND status = ?", revisionId, contributionId, configHash, ChannelContributionRevisionStatusApproved).
			First(&revision).Error; err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				return ErrStaleChannelContributionHealthProbe
			}
			return err
		}
		var channel Channel
		if err := lockForUpdate(tx).Where("id = ?", channelId).First(&channel).Error; err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				if err := markLockedChannelContributionsDeletedTx(tx, []ChannelContribution{contribution}, now); err != nil {
					return err
				}
				result.Deleted = true
				result.StateChanged = true
				return nil
			}
			return err
		}

		if channel.Status == common.ChannelStatusManuallyDisabled {
			if err := setLockedContributionHealthPausedTx(tx, &contribution, channelId, true, now); err != nil {
				return err
			}
			result.Paused = true
			return nil
		}
		if err := setLockedContributionHealthPausedTx(tx, &contribution, channelId, false, now); err != nil {
			return err
		}

		models := normalizeContributionHealthModels(channel.Models)
		observationByModel := make(map[string]ChannelContributionModelObservation, len(observations))
		for _, observation := range observations {
			modelName := strings.TrimSpace(observation.Model)
			if modelName == "" {
				continue
			}
			observation.Model = modelName
			observationByModel[modelName] = observation
		}
		if len(models) == 0 || len(observationByModel) != len(models) {
			return errors.New("health observations must cover every configured model")
		}

		allFailed := true
		modelHealthChanged := false
		unhealthyModels := make([]string, 0)
		for _, modelName := range models {
			observation, exists := observationByModel[modelName]
			if !exists {
				return fmt.Errorf("missing health observation for model %s", modelName)
			}
			if observation.Healthy {
				allFailed = false
			} else {
				unhealthyModels = append(unhealthyModels, modelName)
			}
			changed, err := upsertContributionModelHealthTx(tx, contributionId, channelId, revisionId, configHash, observation, now)
			if err != nil {
				return err
			}
			modelHealthChanged = modelHealthChanged || changed
		}
		if err := tx.Where("contribution_id = ? AND model NOT IN ?", contributionId, models).
			Delete(&ChannelContributionModelHealth{}).Error; err != nil {
			return err
		}

		state := ChannelContributionHealthState{ContributionId: contributionId, ChannelId: channelId}
		if err := tx.Clauses(clause.OnConflict{DoNothing: true}).Create(&state).Error; err != nil {
			return err
		}
		if err := lockForUpdate(tx).Where("contribution_id = ?", contributionId).First(&state).Error; err != nil {
			return err
		}

		if allFailed {
			if state.FailureSince == 0 {
				state.FailureSince = now
				result.StateChanged = true
			}
			if contribution.Status != ChannelContributionStatusUnavailable || contribution.UnavailableSince != state.FailureSince {
				result.StateChanged = true
			}
			if err := tx.Model(&ChannelContribution{}).Where("id = ?", contributionId).Updates(map[string]any{
				"status":            ChannelContributionStatusUnavailable,
				"unavailable_since": state.FailureSince,
				"updated_at":        now,
			}).Error; err != nil {
				return err
			}
			if channel.Status == common.ChannelStatusEnabled {
				channel.Status = common.ChannelStatusAutoDisabled
				result.StateChanged = true
				if err := tx.Model(&Channel{}).Where("id = ?", channelId).Update("status", channel.Status).Error; err != nil {
					return err
				}
			}
			abilityResult := tx.Model(&Ability{}).
				Where("channel_id = ? AND enabled = ?", channelId, true).
				Update("enabled", false)
			if abilityResult.Error != nil {
				return abilityResult.Error
			}
			if abilityResult.RowsAffected > 0 {
				result.StateChanged = true
			}
			if deleteAfterSeconds > 0 && now-state.FailureSince >= deleteAfterSeconds {
				if err := tx.Where("channel_id = ?", channelId).Delete(&Ability{}).Error; err != nil {
					return err
				}
				if err := tx.Where("id = ?", channelId).Delete(&Channel{}).Error; err != nil {
					return err
				}
				if err := markLockedChannelContributionsDeletedTx(tx, []ChannelContribution{contribution}, now); err != nil {
					return err
				}
				result.Deleted = true
				result.StateChanged = true
			}
		} else {
			if state.FailureSince != 0 || contribution.Status != ChannelContributionStatusApproved || contribution.UnavailableSince != 0 {
				result.StateChanged = true
			}
			state.FailureSince = 0
			if err := tx.Model(&ChannelContribution{}).Where("id = ?", contributionId).Updates(map[string]any{
				"status":            ChannelContributionStatusApproved,
				"unavailable_since": int64(0),
				"updated_at":        now,
			}).Error; err != nil {
				return err
			}
			if channel.Status == common.ChannelStatusAutoDisabled {
				channel.Status = common.ChannelStatusEnabled
				result.StateChanged = true
				if err := tx.Model(&Channel{}).Where("id = ?", channelId).Update("status", channel.Status).Error; err != nil {
					return err
				}
			}
			for _, modelName := range models {
				observation := observationByModel[modelName]
				abilityResult := tx.Model(&Ability{}).
					Where("channel_id = ? AND model = ? AND enabled <> ?", channelId, modelName, observation.Healthy).
					Update("enabled", observation.Healthy)
				if abilityResult.Error != nil {
					return abilityResult.Error
				}
				if abilityResult.RowsAffected > 0 {
					result.StateChanged = true
				}
			}
		}
		if !result.Deleted {
			if err := tx.Model(&ChannelContributionHealthState{}).
				Where("contribution_id = ?", contributionId).
				Updates(map[string]any{
					"failure_since":   state.FailureSince,
					"paused_at":       int64(0),
					"last_checked_at": now,
					"updated_at":      now,
				}).Error; err != nil {
				return err
			}
		}
		result.AllFailed = allFailed
		result.StateChanged = result.StateChanged || modelHealthChanged
		result.UnhealthyModels = unhealthyModels
		return nil
	})
	return result, err
}

func upsertContributionModelHealthTx(
	tx *gorm.DB,
	contributionId int,
	channelId int,
	revisionId int,
	configHash string,
	observation ChannelContributionModelObservation,
	now int64,
) (bool, error) {
	var current ChannelContributionModelHealth
	err := tx.Where("contribution_id = ? AND model = ?", contributionId, observation.Model).First(&current).Error
	if err != nil && !errors.Is(err, gorm.ErrRecordNotFound) {
		return false, err
	}
	healthChanged := current.Id != 0 && current.Healthy != observation.Healthy
	if errors.Is(err, gorm.ErrRecordNotFound) {
		healthChanged = !observation.Healthy
		current = ChannelContributionModelHealth{
			ContributionId: contributionId,
			ChannelId:      channelId,
			Model:          observation.Model,
			CreatedAt:      now,
		}
	}
	current.RevisionId = revisionId
	current.ConfigHash = configHash
	current.Healthy = observation.Healthy
	current.LastCheckedAt = now
	current.UpdatedAt = now
	if observation.Healthy {
		current.FailureSince = 0
		current.LastSuccessAt = now
		current.LastError = ""
	} else {
		if current.FailureSince == 0 {
			current.FailureSince = now
		}
		current.LastFailureAt = now
		current.LastError = truncateContributionHealthError(observation.Error)
	}
	if current.Id == 0 {
		return healthChanged, tx.Create(&current).Error
	}
	return healthChanged, tx.Save(&current).Error
}

func normalizeContributionHealthModels(raw string) []string {
	seen := make(map[string]struct{})
	models := make([]string, 0)
	for _, item := range strings.Split(raw, ",") {
		modelName := strings.TrimSpace(item)
		if modelName == "" {
			continue
		}
		if _, exists := seen[modelName]; exists {
			continue
		}
		seen[modelName] = struct{}{}
		models = append(models, modelName)
	}
	return models
}

func truncateContributionHealthError(message string) string {
	message = strings.TrimSpace(message)
	if len(message) <= 500 {
		return message
	}
	end := 500
	for end > 0 && !utf8.ValidString(message[:end]) {
		end--
	}
	return message[:end]
}

func contributionUnhealthyModelSet(db *gorm.DB, channelIds []int) (map[int]map[string]struct{}, error) {
	result := make(map[int]map[string]struct{})
	if len(channelIds) == 0 {
		return result, nil
	}
	if db == nil {
		db = DB
	}
	if !db.Migrator().HasTable(&ChannelContribution{}) ||
		!db.Migrator().HasTable(&ChannelContributionRevision{}) ||
		!db.Migrator().HasTable(&ChannelContributionModelHealth{}) {
		return result, nil
	}
	var rows []ChannelContributionModelHealth
	if err := db.Table("channel_contribution_model_healths AS health").
		Select("health.channel_id, health.model").
		Joins("JOIN channel_contributions AS contributions ON contributions.id = health.contribution_id AND contributions.channel_id = health.channel_id").
		Joins("JOIN channel_contribution_revisions AS revisions ON revisions.id = contributions.approved_revision_id AND revisions.id = health.revision_id AND revisions.config_hash = health.config_hash").
		Where("health.channel_id IN ? AND health.healthy = ? AND contributions.status IN ? AND revisions.status = ?", channelIds, false, []ChannelContributionStatus{
			ChannelContributionStatusApproved,
			ChannelContributionStatusUnavailable,
		}, ChannelContributionRevisionStatusApproved).
		Scan(&rows).Error; err != nil {
		return nil, err
	}
	for _, row := range rows {
		if result[row.ChannelId] == nil {
			result[row.ChannelId] = make(map[string]struct{})
		}
		result[row.ChannelId][row.Model] = struct{}{}
	}
	return result, nil
}

func applyContributionHealthToAbilities(abilities []Ability) []Ability {
	if len(abilities) == 0 {
		return abilities
	}
	channelIds := make([]int, 0, len(abilities))
	seen := make(map[int]struct{})
	for _, ability := range abilities {
		if _, exists := seen[ability.ChannelId]; exists {
			continue
		}
		seen[ability.ChannelId] = struct{}{}
		channelIds = append(channelIds, ability.ChannelId)
	}
	unhealthy, err := contributionUnhealthyModelSet(DB, channelIds)
	if err != nil {
		common.SysError(fmt.Sprintf("failed to apply contribution health overlay: %v", err))
		return abilities
	}
	filtered := abilities[:0]
	for _, ability := range abilities {
		if models := unhealthy[ability.ChannelId]; models != nil {
			if _, disabled := models[ability.Model]; disabled {
				continue
			}
		}
		filtered = append(filtered, ability)
	}
	return filtered
}

func reapplyContributionHealthToAbilitiesTx(tx *gorm.DB, channelIds []int) error {
	unhealthy, err := contributionUnhealthyModelSet(tx, channelIds)
	if err != nil {
		return err
	}
	return applyContributionUnhealthyAbilitiesTx(tx, unhealthy)
}

func applyContributionUnhealthyAbilitiesTx(tx *gorm.DB, unhealthy map[int]map[string]struct{}) error {
	for channelId, models := range unhealthy {
		modelNames := make([]string, 0, len(models))
		for modelName := range models {
			modelNames = append(modelNames, modelName)
		}
		if len(modelNames) == 0 {
			continue
		}
		if err := tx.Model(&Ability{}).
			Where("channel_id = ? AND model IN ?", channelId, modelNames).
			Update("enabled", false).Error; err != nil {
			return err
		}
	}
	return nil
}

func markChannelContributionsDeletedTx(tx *gorm.DB, channelIds []int, now int64) error {
	if len(channelIds) == 0 {
		return nil
	}
	if !tx.Migrator().HasTable(&ChannelContribution{}) {
		return nil
	}
	var contributions []ChannelContribution
	if err := lockForUpdate(tx).
		Select("id", "channel_id", "status").
		Where("channel_id IN ?", channelIds).
		Order("id ASC").
		Find(&contributions).Error; err != nil {
		return err
	}
	if len(contributions) == 0 {
		return nil
	}
	return markLockedChannelContributionsDeletedTx(tx, contributions, now)
}

func markLockedChannelContributionsDeletedTx(tx *gorm.DB, contributions []ChannelContribution, now int64) error {
	if len(contributions) == 0 {
		return nil
	}
	contributionIds := make([]int, 0, len(contributions))
	for _, contribution := range contributions {
		contributionIds = append(contributionIds, contribution.Id)
	}
	if tx.Migrator().HasTable(&ChannelContributionRevision{}) {
		if err := tx.Model(&ChannelContributionRevision{}).
			Where("contribution_id IN ? AND status = ?", contributionIds, ChannelContributionRevisionStatusPending).
			Updates(map[string]any{
				"status":     ChannelContributionRevisionStatusWithdrawn,
				"updated_at": now,
			}).Error; err != nil {
			return err
		}
		if err := tx.Model(&ChannelContributionRevision{}).
			Where("contribution_id IN ?", contributionIds).
			Updates(map[string]any{
				"key":        "",
				"updated_at": now,
			}).Error; err != nil {
			return err
		}
	}
	return tx.Model(&ChannelContribution{}).
		Where("id IN ?", contributionIds).
		Updates(map[string]any{
			"status":              ChannelContributionStatusDeleted,
			"pending_revision_id": nil,
			"updated_at":          now,
		}).Error
}

// ResetChannelContributionHealthForRevision removes health state inherited
// from the previously approved revision. Call it while the contribution and
// channel rows are already locked, before rebuilding abilities for the new
// revision.
func ResetChannelContributionHealthForRevision(
	tx *gorm.DB,
	contribution *ChannelContribution,
	revisionId int,
	configHash string,
) error {
	if tx == nil || contribution == nil || contribution.Id <= 0 || revisionId <= 0 || strings.TrimSpace(configHash) == "" {
		return errors.New("invalid channel contribution health reset")
	}
	var revisionCount int64
	if err := tx.Model(&ChannelContributionRevision{}).
		Where("id = ? AND contribution_id = ? AND config_hash = ?", revisionId, contribution.Id, configHash).
		Count(&revisionCount).Error; err != nil {
		return err
	}
	if revisionCount != 1 {
		return ErrStaleChannelContributionHealthProbe
	}
	if tx.Migrator().HasTable(&ChannelContributionModelHealth{}) {
		if err := tx.Where("contribution_id = ?", contribution.Id).Delete(&ChannelContributionModelHealth{}).Error; err != nil {
			return err
		}
	}
	if tx.Migrator().HasTable(&ChannelContributionHealthState{}) {
		if err := tx.Where("contribution_id = ?", contribution.Id).Delete(&ChannelContributionHealthState{}).Error; err != nil {
			return err
		}
	}
	return nil
}
