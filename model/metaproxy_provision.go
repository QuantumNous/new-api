package model

import (
	"errors"
	"fmt"
	"sync"
	"sync/atomic"

	"github.com/QuantumNous/new-api/common"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

const (
	MetaproxyProvisionManagedTag     = "metaproxy-provision"
	MetaproxyProvisionDigestOption   = "MetaproxyProvisionDigest"
	MetaproxyProvisionRevisionOption = "MetaproxyProvisionRevision"
	MetaproxyProvisionNoDigest       = "none"
)

var (
	ErrMetaproxyProvisionConflict            = errors.New("metaproxy provision revision conflict")
	ErrMetaproxyProvisionRequiresMemoryCache = errors.New("metaproxy provision requires MEMORY_CACHE_ENABLED=true")
	metaproxyProvisionLock                   sync.Mutex
	metaproxyProvisionRuntimeLock            sync.RWMutex
	provisionRuntimeFrozen                   atomic.Bool
)

type MetaproxyProvisionChannel struct {
	Type           int    `json:"type"`
	Key            string `json:"key"`
	Name           string `json:"name"`
	BaseURL        string `json:"base_url"`
	Models         string `json:"models"`
	ModelMapping   string `json:"model_mapping"`
	Group          string `json:"group"`
	Priority       int64  `json:"priority"`
	Weight         uint   `json:"weight"`
	Status         int    `json:"status"`
	TestModel      string `json:"test_model"`
	HeaderOverride string `json:"header_override"`
}

type MetaproxyProvisionOptions struct {
	ModelRatio       string `json:"model_ratio"`
	CompletionRatio  string `json:"completion_ratio"`
	CacheRatio       string `json:"cache_ratio"`
	GroupRatio       string `json:"group_ratio"`
	UserUsableGroups string `json:"user_usable_groups"`
}

func (options MetaproxyProvisionOptions) orderedValues() []Option {
	return []Option{
		{Key: "ModelRatio", Value: options.ModelRatio},
		{Key: "CompletionRatio", Value: options.CompletionRatio},
		{Key: "CacheRatio", Value: options.CacheRatio},
		{Key: "GroupRatio", Value: options.GroupRatio},
		{Key: "UserUsableGroups", Value: options.UserUsableGroups},
	}
}

type MetaproxyProvisionConfig struct {
	Revision string                      `json:"revision"`
	Digest   string                      `json:"digest"`
	Channels []MetaproxyProvisionChannel `json:"channels"`
	Options  MetaproxyProvisionOptions   `json:"options"`
}

type MetaproxyProvisionResult struct {
	AlreadyApplied  bool
	RestartRequired bool
	PreviousDigest  string
}

func IsMetaproxyProvisionRuntimeFrozen() bool {
	return provisionRuntimeFrozen.Load()
}

func RunMetaproxyProvisionSyncIfReady(syncFn func()) bool {
	metaproxyProvisionRuntimeLock.RLock()
	defer metaproxyProvisionRuntimeLock.RUnlock()
	if provisionRuntimeFrozen.Load() {
		return false
	}
	syncFn()
	return true
}

func activeMetaproxyProvisionDigest() string {
	common.OptionMapRWMutex.RLock()
	defer common.OptionMapRWMutex.RUnlock()
	if digest := common.OptionMap[MetaproxyProvisionDigestOption]; digest != "" {
		return digest
	}
	return MetaproxyProvisionNoDigest
}

func provisionOptionValue(tx *gorm.DB, key string) (string, error) {
	var option Option
	err := lockForUpdate(tx).First(&option, &Option{Key: key}).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return MetaproxyProvisionNoDigest, nil
	}
	if err != nil {
		return "", err
	}
	if option.Value == "" {
		return MetaproxyProvisionNoDigest, nil
	}
	return option.Value, nil
}

func optionMatches(tx *gorm.DB, key, value string) (bool, error) {
	var option Option
	err := tx.First(&option, &Option{Key: key}).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return false, nil
	}
	if err != nil {
		return false, err
	}
	return option.Value == value, nil
}

func channelMatches(current Channel, wanted MetaproxyProvisionChannel) bool {
	return current.Type == wanted.Type &&
		current.Key == wanted.Key &&
		current.Name == wanted.Name &&
		valueOrEmpty(current.BaseURL) == wanted.BaseURL &&
		current.Models == wanted.Models &&
		current.GetModelMapping() == wanted.ModelMapping &&
		current.Group == wanted.Group &&
		current.GetPriority() == wanted.Priority &&
		current.GetWeight() == int(wanted.Weight) &&
		current.Status == wanted.Status &&
		valueOrEmpty(current.TestModel) == wanted.TestModel &&
		valueOrEmpty(current.HeaderOverride) == wanted.HeaderOverride
}

func valueOrEmpty(value *string) string {
	if value == nil {
		return ""
	}
	return *value
}

func desiredProvisionAlreadyStored(tx *gorm.DB, config MetaproxyProvisionConfig) (bool, error) {
	var current []Channel
	if err := tx.Where("tag = ?", MetaproxyProvisionManagedTag).Find(&current).Error; err != nil {
		return false, err
	}
	if len(current) != len(config.Channels) {
		return false, nil
	}
	byName := make(map[string]Channel, len(current))
	for _, channel := range current {
		if _, duplicate := byName[channel.Name]; duplicate {
			return false, fmt.Errorf("duplicate managed channel name %q", channel.Name)
		}
		byName[channel.Name] = channel
	}
	for _, wanted := range config.Channels {
		currentChannel, ok := byName[wanted.Name]
		if !ok || !channelMatches(currentChannel, wanted) {
			return false, nil
		}
	}
	for _, option := range config.Options.orderedValues() {
		matches, err := optionMatches(tx, option.Key, option.Value)
		if err != nil || !matches {
			return false, err
		}
	}
	for _, option := range []Option{
		{Key: MetaproxyProvisionDigestOption, Value: config.Digest},
		{Key: MetaproxyProvisionRevisionOption, Value: config.Revision},
	} {
		matches, err := optionMatches(tx, option.Key, option.Value)
		if err != nil || !matches {
			return false, err
		}
	}
	return true, nil
}

func pointer[T any](value T) *T {
	return &value
}

func provisionChannel(wanted MetaproxyProvisionChannel) Channel {
	tag := MetaproxyProvisionManagedTag
	return Channel{
		Type:           wanted.Type,
		Key:            wanted.Key,
		Name:           wanted.Name,
		BaseURL:        pointer(wanted.BaseURL),
		Models:         wanted.Models,
		ModelMapping:   pointer(wanted.ModelMapping),
		Group:          wanted.Group,
		Priority:       pointer(wanted.Priority),
		Weight:         pointer(wanted.Weight),
		Status:         wanted.Status,
		TestModel:      pointer(wanted.TestModel),
		HeaderOverride: pointer(wanted.HeaderOverride),
		Tag:            &tag,
	}
}

func saveProvisionOption(tx *gorm.DB, option Option) error {
	return tx.Clauses(clause.OnConflict{
		Columns:   []clause.Column{{Name: "key"}},
		DoUpdates: clause.AssignmentColumns([]string{"value"}),
	}).Create(&option).Error
}

func replaceManagedProvisionState(tx *gorm.DB, config MetaproxyProvisionConfig) error {
	var current []Channel
	if err := tx.Where("tag = ?", MetaproxyProvisionManagedTag).Find(&current).Error; err != nil {
		return err
	}
	byName := make(map[string]Channel, len(current))
	for _, channel := range current {
		if _, duplicate := byName[channel.Name]; duplicate {
			return fmt.Errorf("duplicate managed channel name %q", channel.Name)
		}
		byName[channel.Name] = channel
	}

	wantedNames := make(map[string]struct{}, len(config.Channels))
	for _, wanted := range config.Channels {
		wantedNames[wanted.Name] = struct{}{}
		desired := provisionChannel(wanted)
		if existing, ok := byName[wanted.Name]; ok {
			desired.Id = existing.Id
			desired.CreatedTime = existing.CreatedTime
			desired.UsedQuota = existing.UsedQuota
			desired.ChannelInfo = existing.ChannelInfo
			if err := tx.Model(&Channel{Id: existing.Id}).Select(
				"type", "key", "name", "base_url", "models", "model_mapping", "group",
				"priority", "weight", "status", "test_model", "header_override", "tag", "channel_info",
			).Updates(&desired).Error; err != nil {
				return err
			}
			if err := desired.UpdateAbilities(tx); err != nil {
				return err
			}
			continue
		}
		desired.CreatedTime = common.GetTimestamp()
		if err := tx.Create(&desired).Error; err != nil {
			return err
		}
		if err := desired.AddAbilities(tx); err != nil {
			return err
		}
	}

	for _, channel := range current {
		if _, keep := wantedNames[channel.Name]; keep {
			continue
		}
		if err := tx.Where("channel_id = ?", channel.Id).Delete(&Ability{}).Error; err != nil {
			return err
		}
		if err := tx.Delete(&Channel{}, channel.Id).Error; err != nil {
			return err
		}
	}

	for _, option := range config.Options.orderedValues() {
		if err := saveProvisionOption(tx, option); err != nil {
			return err
		}
	}
	for _, option := range []Option{
		{Key: MetaproxyProvisionRevisionOption, Value: config.Revision},
		{Key: MetaproxyProvisionDigestOption, Value: config.Digest},
	} {
		if err := saveProvisionOption(tx, option); err != nil {
			return err
		}
	}
	return nil
}

func ApplyMetaproxyProvision(
	config MetaproxyProvisionConfig,
	expectedDigest string,
) (MetaproxyProvisionResult, error) {
	if !common.MemoryCacheEnabled {
		return MetaproxyProvisionResult{}, ErrMetaproxyProvisionRequiresMemoryCache
	}
	metaproxyProvisionLock.Lock()
	defer metaproxyProvisionLock.Unlock()
	metaproxyProvisionRuntimeLock.Lock()
	defer metaproxyProvisionRuntimeLock.Unlock()

	result := MetaproxyProvisionResult{}
	err := DB.Transaction(func(tx *gorm.DB) error {
		currentDigest, err := provisionOptionValue(tx, MetaproxyProvisionDigestOption)
		if err != nil {
			return err
		}
		result.PreviousDigest = currentDigest
		if currentDigest != expectedDigest && currentDigest != config.Digest {
			return fmt.Errorf(
				"%w: expected %q, current %q",
				ErrMetaproxyProvisionConflict,
				expectedDigest,
				currentDigest,
			)
		}

		stored, err := desiredProvisionAlreadyStored(tx, config)
		if err != nil {
			return err
		}
		if stored {
			result.AlreadyApplied = true
			return nil
		}
		return replaceManagedProvisionState(tx, config)
	})
	if err != nil {
		return MetaproxyProvisionResult{}, err
	}

	result.RestartRequired = activeMetaproxyProvisionDigest() != config.Digest
	if result.RestartRequired {
		provisionRuntimeFrozen.Store(true)
	}
	return result, nil
}
