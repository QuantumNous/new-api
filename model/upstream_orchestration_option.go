package model

import (
	"errors"
	"fmt"
	"maps"
	"net"
	"slices"
	"strings"
	"sync"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/setting/config"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

const (
	upstreamOrchestrationOptionPrefix          = "upstream_orchestration."
	upstreamOrchestrationStaticEgressOptionKey = upstreamOrchestrationOptionPrefix + "static_egress_ips"
	upstreamOrchestrationPolicyLockOptionKey   = upstreamOrchestrationOptionPrefix + "__policy_lock"
)

var upstreamOrchestrationOptionMutex sync.Mutex

var upstreamOrchestrationPolicyOptionKeys = []string{
	upstreamOrchestrationOptionPrefix + "model_aliases",
	upstreamOrchestrationOptionPrefix + "model_exclusions",
	upstreamOrchestrationOptionPrefix + "protocol_model_exclusions",
	upstreamOrchestrationOptionPrefix + "target_groups",
}

type UpstreamSourceMutation struct {
	SourceID                int64
	Enabled                 *bool
	LowBalanceThreshold     *float64
	StaticEgressIPs         []string
	ModelAliases            map[string]string
	ModelExclusions         map[string][]string
	ProtocolModelExclusions map[string][]string
}

func IsUpstreamOrchestrationPolicyOption(key string) bool {
	return slices.Contains(upstreamOrchestrationPolicyOptionKeys, key)
}

func isUpstreamOrchestrationInternalOption(key string) bool {
	return key == upstreamOrchestrationPolicyLockOptionKey
}

func UpdateUpstreamOrchestrationPolicy(policy operation_setting.UpstreamRoutingPolicy) error {
	normalized, err := operation_setting.NormalizeUpstreamRoutingPolicy(policy)
	if err != nil {
		return err
	}
	upstreamOrchestrationOptionMutex.Lock()
	defer upstreamOrchestrationOptionMutex.Unlock()
	return updateUpstreamOrchestrationPolicyLocked(normalized)
}

func UpdateUpstreamOrchestrationOptions(values map[string]string) error {
	if len(values) == 0 {
		return nil
	}
	normalizedValues, err := normalizeExplicitUpstreamOrchestrationOptions(values)
	if err != nil {
		return err
	}
	upstreamOrchestrationOptionMutex.Lock()
	defer upstreamOrchestrationOptionMutex.Unlock()
	return writeUpstreamOrchestrationOptionsLocked(normalizedValues)
}

// AppendUpstreamModelExclusion serializes health-driven read-modify-write
// updates with controlled policy writes and publishes only committed state.
func AppendUpstreamModelExclusion(
	sourceID int64,
	externalGroupID string,
	modelName string,
) (bool, error) {
	_, added, err := appendUpstreamModelExclusion(0, sourceID, externalGroupID, modelName, nil)
	return added, err
}

// AppendUpstreamModelExclusionForAttachedRoute commits an exclusion only while
// the route is still attached. The returned route identifies a handled route.
func AppendUpstreamModelExclusionForAttachedRoute(
	channelID int,
	modelName string,
) (*UpstreamManagedRoute, bool, error) {
	return MutateUpstreamModelExclusionForAttachedRoute(channelID, modelName, nil)
}

// MutateUpstreamModelExclusionForAttachedRoute commits the exclusion and its
// caller-supplied managed-route mutation atomically, then publishes the option.
func MutateUpstreamModelExclusionForAttachedRoute(
	channelID int,
	modelName string,
	mutate func(*gorm.DB, *UpstreamManagedRoute) error,
) (*UpstreamManagedRoute, bool, error) {
	if channelID <= 0 {
		return nil, false, nil
	}
	return appendUpstreamModelExclusion(channelID, 0, "", modelName, mutate)
}

func appendUpstreamModelExclusion(
	channelID int,
	sourceID int64,
	externalGroupID string,
	modelName string,
	mutate func(*gorm.DB, *UpstreamManagedRoute) error,
) (*UpstreamManagedRoute, bool, error) {
	externalGroupID = strings.TrimSpace(externalGroupID)
	modelName = strings.TrimSpace(modelName)
	if modelName == "" || channelID <= 0 && (sourceID <= 0 || externalGroupID == "") {
		return nil, false, nil
	}

	upstreamOrchestrationOptionMutex.Lock()
	defer upstreamOrchestrationOptionMutex.Unlock()

	var attachedRoute *UpstreamManagedRoute
	var publishedValues map[string]string
	var publishedFields map[string]string
	added := false
	err := runOptionWriteTransaction(DB, func(tx *gorm.DB) error {
		attachedRoute = nil
		publishedValues = nil
		publishedFields = nil
		added = false

		if err := acquireUpstreamPolicyWriteIntentTx(tx); err != nil {
			return err
		}
		if channelID > 0 {
			route, err := GetAttachedUpstreamManagedRouteForUpdate(tx, channelID)
			if errors.Is(err, gorm.ErrRecordNotFound) {
				return nil
			}
			if err != nil {
				return err
			}
			attachedRoute = route
			sourceID = route.SourceID
			externalGroupID = route.ExternalGroupID
		}
		var source UpstreamSource
		if err := lockForUpdate(tx).Select("key").
			Where("id = ?", sourceID).First(&source).Error; err != nil {
			return err
		}
		policy, _, _, err := normalizeUpstreamOrchestrationOptionsTx(tx, nil)
		if err != nil {
			return err
		}
		key := upstreamOrchestrationOptionPrefix + "model_exclusions"
		exclusionKey := strings.ToLower(strings.TrimSpace(source.Key)) + ":" + externalGroupID
		alreadyExcluded := false
		for _, excludedModel := range policy.ModelExclusions[exclusionKey] {
			if strings.TrimSpace(excludedModel) == modelName {
				alreadyExcluded = true
				break
			}
		}
		if !alreadyExcluded {
			policy.ModelExclusions[exclusionKey] = append(policy.ModelExclusions[exclusionKey], modelName)
			normalized, err := operation_setting.NormalizeUpstreamRoutingPolicy(policy)
			if err != nil {
				return err
			}
			allValues, allFields, err := encodeUpstreamOrchestrationPolicy(normalized)
			if err != nil {
				return err
			}
			publishedValues = map[string]string{key: allValues[key]}
			publishedFields = map[string]string{"model_exclusions": allFields["model_exclusions"]}
			if err := saveOptionTx(tx, key, publishedValues[key], optionWriteUpstreamOrchestration); err != nil {
				return err
			}
			added = true
		}
		if mutate != nil {
			return mutate(tx, attachedRoute)
		}
		return nil
	})
	if err != nil || !added {
		return attachedRoute, false, err
	}
	if err := publishUpstreamOrchestrationOptions(publishedValues, publishedFields); err != nil {
		return attachedRoute, false, err
	}
	return attachedRoute, true, nil
}

func acquireUpstreamPolicyWriteIntentTx(tx *gorm.DB) error {
	if common.UsingMainDatabase(common.DatabaseTypeSQLite) {
		if err := tx.Model(&Option{}).
			Where("key = ? AND 1 = 0", upstreamOrchestrationPolicyLockOptionKey).
			UpdateColumn("value", gorm.Expr("value")).Error; err != nil {
			return err
		}
	}
	lockRow := Option{Key: upstreamOrchestrationPolicyLockOptionKey, Value: "1"}
	if err := tx.Clauses(clause.OnConflict{
		Columns:   []clause.Column{{Name: "key"}},
		DoNothing: true,
	}).Create(&lockRow).Error; err != nil {
		return err
	}
	return lockForUpdate(tx).
		Select("key").
		Where(clause.Eq{
			Column: clause.Column{Name: "key"},
			Value:  upstreamOrchestrationPolicyLockOptionKey,
		}).
		First(&lockRow).Error
}

func normalizeExplicitUpstreamOrchestrationOptions(values map[string]string) (map[string]string, error) {
	placeholders, _, err := encodeUpstreamOrchestrationPolicy(
		operation_setting.UpstreamRoutingPolicy{
			TargetGroups:            []string{"validation-placeholder"},
			ModelAliases:            map[string]string{},
			ModelExclusions:         map[string][]string{},
			ProtocolModelExclusions: map[string][]string{},
		},
	)
	if err != nil {
		return nil, err
	}
	for key, value := range values {
		if !IsUpstreamOrchestrationPolicyOption(key) {
			return nil, fmt.Errorf("not an upstream orchestration policy option: %s", key)
		}
		placeholders[key] = value
	}
	policy, err := decodeUpstreamOrchestrationPolicy(placeholders)
	if err != nil {
		return nil, err
	}
	normalized, err := operation_setting.NormalizeUpstreamRoutingPolicy(policy)
	if err != nil {
		return nil, err
	}
	allValues, _, err := encodeUpstreamOrchestrationPolicy(normalized)
	if err != nil {
		return nil, err
	}
	normalizedValues := make(map[string]string, len(values))
	for key := range values {
		normalizedValues[key] = allValues[key]
	}
	return normalizedValues, nil
}

func normalizeUpstreamOrchestrationOptionsTx(
	tx *gorm.DB,
	explicitValues map[string]string,
) (operation_setting.UpstreamRoutingPolicy, map[string]string, map[string]string, error) {
	for key := range explicitValues {
		if !IsUpstreamOrchestrationPolicyOption(key) {
			return operation_setting.UpstreamRoutingPolicy{}, nil, nil,
				fmt.Errorf("not an upstream orchestration policy option: %s", key)
		}
	}

	current := operation_setting.GetUpstreamOrchestrationSetting()
	defaults, _, err := encodeUpstreamOrchestrationPolicy(
		operation_setting.UpstreamRoutingPolicy{
			TargetGroups:            current.TargetGroups,
			ModelAliases:            current.ModelAliases,
			ModelExclusions:         current.ModelExclusions,
			ProtocolModelExclusions: current.ProtocolModelExclusions,
		},
	)
	if err != nil {
		return operation_setting.UpstreamRoutingPolicy{}, nil, nil, err
	}
	if err := acquireUpstreamPolicyWriteIntentTx(tx); err != nil {
		return operation_setting.UpstreamRoutingPolicy{}, nil, nil, err
	}
	keys := slices.Sorted(maps.Keys(defaults))
	keyValues := make([]any, len(keys))
	for index, key := range keys {
		keyValues[index] = key
	}
	var persisted []Option
	if err := lockForUpdate(tx).
		Where(clause.IN{Column: clause.Column{Name: "key"}, Values: keyValues}).
		Order(clause.OrderByColumn{Column: clause.Column{Name: "key"}}).
		Find(&persisted).Error; err != nil {
		return operation_setting.UpstreamRoutingPolicy{}, nil, nil, err
	}
	aggregate := maps.Clone(defaults)
	for _, option := range persisted {
		if IsUpstreamOrchestrationPolicyOption(option.Key) {
			aggregate[option.Key] = option.Value
		}
	}
	maps.Copy(aggregate, explicitValues)
	policy, err := decodeUpstreamOrchestrationPolicy(aggregate)
	if err != nil {
		return operation_setting.UpstreamRoutingPolicy{}, nil, nil, err
	}
	normalized, err := operation_setting.NormalizeUpstreamRoutingPolicy(policy)
	if err != nil {
		return operation_setting.UpstreamRoutingPolicy{}, nil, nil, err
	}
	allValues, allFields, err := encodeUpstreamOrchestrationPolicy(normalized)
	if err != nil {
		return operation_setting.UpstreamRoutingPolicy{}, nil, nil, err
	}
	normalizedValues := make(map[string]string, len(explicitValues))
	fields := make(map[string]string, len(explicitValues))
	for key := range explicitValues {
		field := strings.TrimPrefix(key, upstreamOrchestrationOptionPrefix)
		normalizedValues[key] = allValues[key]
		fields[field] = allFields[field]
	}
	return normalized, normalizedValues, fields, nil
}

func decodeUpstreamOrchestrationPolicy(values map[string]string) (operation_setting.UpstreamRoutingPolicy, error) {
	var policy operation_setting.UpstreamRoutingPolicy
	for key, value := range values {
		switch strings.TrimPrefix(key, upstreamOrchestrationOptionPrefix) {
		case "target_groups":
			var targetGroups []string
			if err := common.Unmarshal([]byte(value), &targetGroups); err != nil {
				return operation_setting.UpstreamRoutingPolicy{}, fmt.Errorf("invalid target_groups")
			}
			policy.TargetGroups = targetGroups
		case "model_aliases":
			var modelAliases map[string]string
			if err := common.Unmarshal([]byte(value), &modelAliases); err != nil {
				return operation_setting.UpstreamRoutingPolicy{}, fmt.Errorf("invalid model_aliases")
			}
			policy.ModelAliases = modelAliases
		case "model_exclusions":
			var modelExclusions map[string][]string
			if err := common.Unmarshal([]byte(value), &modelExclusions); err != nil {
				return operation_setting.UpstreamRoutingPolicy{}, fmt.Errorf("invalid model_exclusions")
			}
			policy.ModelExclusions = modelExclusions
		case "protocol_model_exclusions":
			var protocolModelExclusions map[string][]string
			if err := common.Unmarshal([]byte(value), &protocolModelExclusions); err != nil {
				return operation_setting.UpstreamRoutingPolicy{}, fmt.Errorf("invalid protocol_model_exclusions")
			}
			policy.ProtocolModelExclusions = protocolModelExclusions
		}
	}
	return policy, nil
}

func updateUpstreamOrchestrationPolicyLocked(policy operation_setting.UpstreamRoutingPolicy) error {
	values, _, err := encodeUpstreamOrchestrationPolicy(policy)
	if err != nil {
		return err
	}
	return writeUpstreamOrchestrationOptionsLocked(values)
}

func writeUpstreamOrchestrationOptionsLocked(values map[string]string) error {
	var publishedValues map[string]string
	var publishedFields map[string]string
	if err := runOptionWriteTransaction(DB, func(tx *gorm.DB) error {
		_, normalizedValues, fields, err := normalizeUpstreamOrchestrationOptionsTx(tx, values)
		if err != nil {
			return err
		}
		for _, key := range slices.Sorted(maps.Keys(normalizedValues)) {
			if err := saveOptionTx(tx, key, normalizedValues[key], optionWriteUpstreamOrchestration); err != nil {
				return err
			}
		}
		publishedValues = normalizedValues
		publishedFields = fields
		return nil
	}); err != nil {
		return err
	}
	return publishUpstreamOrchestrationOptions(publishedValues, publishedFields)
}

// reloadUpstreamOrchestrationPolicy publishes every public orchestration field
// from one database snapshot. A remote commit before this snapshot is applied
// here; one after lock release converges on the next periodic reload.
func reloadUpstreamOrchestrationPolicy() error {
	current := operation_setting.GetUpstreamOrchestrationSetting()
	currentFields, err := config.ConfigToMap(current)
	if err != nil {
		return err
	}

	return DB.Transaction(func(tx *gorm.DB) error {
		if err := acquireUpstreamPolicyWriteIntentTx(tx); err != nil {
			return err
		}
		var options []Option
		if err := lockForShare(tx).
			Where(clause.Like{
				Column: clause.Column{Name: "key"},
				Value:  upstreamOrchestrationOptionPrefix + "%",
			}).
			Order(clause.OrderByColumn{Column: clause.Column{Name: "key"}}).
			Find(&options).Error; err != nil {
			return err
		}
		fields := maps.Clone(currentFields)
		values := make(map[string]string, len(currentFields))
		for field, value := range currentFields {
			values[upstreamOrchestrationOptionPrefix+field] = value
		}
		for _, option := range options {
			if isUpstreamOrchestrationInternalOption(option.Key) {
				continue
			}
			field, ok := strings.CutPrefix(option.Key, upstreamOrchestrationOptionPrefix)
			if !ok {
				continue
			}
			fields[field] = option.Value
			values[option.Key] = option.Value
		}
		policyValues := make(map[string]string, len(upstreamOrchestrationPolicyOptionKeys))
		for _, key := range upstreamOrchestrationPolicyOptionKeys {
			policyValues[key] = fields[strings.TrimPrefix(key, upstreamOrchestrationOptionPrefix)]
		}
		policy, err := decodeUpstreamOrchestrationPolicy(policyValues)
		if err != nil {
			return err
		}
		normalized, err := operation_setting.NormalizeUpstreamRoutingPolicy(policy)
		if err != nil {
			return err
		}
		_, policyFields, err := encodeUpstreamOrchestrationPolicy(normalized)
		if err != nil {
			return err
		}
		maps.Copy(fields, policyFields)

		candidate := *current
		if err := config.UpdateConfigFromMap(&candidate, fields); err != nil {
			return err
		}
		normalizedFields, err := config.ConfigToMap(&candidate)
		if err != nil {
			return err
		}
		for field, value := range normalizedFields {
			values[upstreamOrchestrationOptionPrefix+field] = value
		}
		return publishUpstreamOrchestrationOptions(values, normalizedFields)
	})
}

func publishUpstreamOrchestrationOptions(values, fields map[string]string) error {
	common.OptionMapRWMutex.Lock()
	defer common.OptionMapRWMutex.Unlock()
	updated, err := config.GlobalConfig.UpdateFromMap("upstream_orchestration", fields)
	if err != nil || !updated {
		return fmt.Errorf("failed to publish upstream orchestration policy")
	}
	if common.OptionMap == nil {
		common.OptionMap = make(map[string]string)
	}
	maps.Copy(common.OptionMap, values)
	return nil
}

func UpdateUpstreamSourceWithOptions(mutation UpstreamSourceMutation) error {
	if mutation.SourceID <= 0 {
		return fmt.Errorf("invalid source id")
	}
	if mutation.LowBalanceThreshold != nil && *mutation.LowBalanceThreshold < 0 {
		return fmt.Errorf("low balance threshold must be non-negative")
	}
	staticEgressIPs := slices.Clone(mutation.StaticEgressIPs)
	if mutation.StaticEgressIPs != nil {
		for index, value := range staticEgressIPs {
			staticEgressIPs[index] = strings.TrimSpace(value)
			if net.ParseIP(staticEgressIPs[index]) == nil {
				return fmt.Errorf("invalid egress IP")
			}
		}
	}

	rawPolicyValues := make(map[string]string, 3)
	if mutation.ModelAliases != nil {
		encoded, err := common.Marshal(mutation.ModelAliases)
		if err != nil {
			return err
		}
		rawPolicyValues[upstreamOrchestrationOptionPrefix+"model_aliases"] = string(encoded)
	}
	if mutation.ModelExclusions != nil {
		encoded, err := common.Marshal(mutation.ModelExclusions)
		if err != nil {
			return err
		}
		rawPolicyValues[upstreamOrchestrationOptionPrefix+"model_exclusions"] = string(encoded)
	}
	if mutation.ProtocolModelExclusions != nil {
		encoded, err := common.Marshal(mutation.ProtocolModelExclusions)
		if err != nil {
			return err
		}
		rawPolicyValues[upstreamOrchestrationOptionPrefix+"protocol_model_exclusions"] = string(encoded)
	}
	if len(rawPolicyValues) > 0 {
		normalizedValues, err := normalizeExplicitUpstreamOrchestrationOptions(rawPolicyValues)
		if err != nil {
			return err
		}
		rawPolicyValues = normalizedValues
	}
	sourceUpdates := map[string]any{"updated_at": common.GetTimestamp()}
	if mutation.Enabled != nil {
		sourceUpdates["enabled"] = *mutation.Enabled
	}
	if mutation.LowBalanceThreshold != nil {
		sourceUpdates["low_balance_threshold"] = *mutation.LowBalanceThreshold
	}

	upstreamOrchestrationOptionMutex.Lock()
	defer upstreamOrchestrationOptionMutex.Unlock()

	var publishedValues map[string]string
	var publishedFields map[string]string
	err := runOptionWriteTransaction(DB, func(tx *gorm.DB) error {
		publishedValues = make(map[string]string)
		publishedFields = make(map[string]string)
		if err := acquireUpstreamPolicyWriteIntentTx(tx); err != nil {
			return err
		}
		var source UpstreamSource
		if err := lockForUpdate(tx).Where("id = ?", mutation.SourceID).First(&source).Error; err != nil {
			return err
		}
		if mutation.StaticEgressIPs != nil {
			option, err := lockOptionForWriteTx(
				tx,
				upstreamOrchestrationStaticEgressOptionKey,
				"{}",
				optionWriteUpstreamOrchestration,
			)
			if err != nil {
				return err
			}
			var staticEgressBySource map[string][]string
			if err := common.Unmarshal([]byte(option.Value), &staticEgressBySource); err != nil ||
				staticEgressBySource == nil {
				return fmt.Errorf("invalid persisted static egress IPs")
			}
			staticEgressBySource[source.Key] = slices.Clone(staticEgressIPs)
			encoded, err := common.Marshal(staticEgressBySource)
			if err != nil {
				return err
			}
			option.Value = string(encoded)
			if err := tx.Save(&option).Error; err != nil {
				return err
			}
			publishedValues[upstreamOrchestrationStaticEgressOptionKey] = option.Value
			publishedFields["static_egress_ips"] = option.Value
		}
		if len(rawPolicyValues) > 0 {
			_, policyValues, policyFields, err := normalizeUpstreamOrchestrationOptionsTx(tx, rawPolicyValues)
			if err != nil {
				return err
			}
			for _, key := range slices.Sorted(maps.Keys(policyValues)) {
				if err := saveOptionTx(tx, key, policyValues[key], optionWriteUpstreamOrchestration); err != nil {
					return err
				}
			}
			maps.Copy(publishedValues, policyValues)
			maps.Copy(publishedFields, policyFields)
		}
		return tx.Model(&source).Updates(sourceUpdates).Error
	})
	if err != nil {
		return err
	}
	if len(publishedValues) == 0 {
		return nil
	}
	return publishUpstreamOrchestrationOptions(publishedValues, publishedFields)
}

func encodeUpstreamOrchestrationPolicy(policy operation_setting.UpstreamRoutingPolicy) (map[string]string, map[string]string, error) {
	raw := map[string]any{
		"target_groups":             policy.TargetGroups,
		"model_aliases":             policy.ModelAliases,
		"model_exclusions":          policy.ModelExclusions,
		"protocol_model_exclusions": policy.ProtocolModelExclusions,
	}
	values := make(map[string]string, len(raw))
	fields := make(map[string]string, len(raw))
	for key, value := range raw {
		encoded, err := common.Marshal(value)
		if err != nil {
			return nil, nil, err
		}
		fields[key] = string(encoded)
		values[upstreamOrchestrationOptionPrefix+key] = string(encoded)
	}
	return values, fields, nil
}
