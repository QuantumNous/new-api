package service

import (
	"context"
	"errors"
	"sort"
	"strconv"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/model"
	"gorm.io/gorm"
)

type AssetModelTargetCandidate struct {
	ChannelID       int
	ChannelType     int
	Priority        int64
	Weight          int
	MappedModel     string
	BindingScope    string
	CredentialIndex int
}

func AssetModelTargetCandidates(scope AssetModelScope, modelName string) ([]AssetModelTargetCandidate, error) {
	modelName = strings.TrimSpace(modelName)
	if modelName == "" || len(scope.Groups) == 0 {
		return []AssetModelTargetCandidate{}, nil
	}
	if !assetModelScopeContainsModel(scope, modelName) {
		return []AssetModelTargetCandidate{}, nil
	}
	seen := make(map[string]struct{})
	candidates := make([]AssetModelTargetCandidate, 0)
	for _, group := range normalizedStrings(scope.Groups) {
		for retry := 0; ; retry++ {
			channels, err := model.GetChannelCandidatesWithFilter(group, modelName, retry, nil)
			if err != nil {
				return nil, err
			}
			if len(channels) == 0 {
				break
			}
			for _, channel := range channels {
				if !assetModelChannelEligible(scope, channel) {
					continue
				}
				expanded := assetModelCandidatesForChannel(channel, modelName)
				for _, candidate := range expanded {
					key := assetModelCandidateKey(candidate)
					if _, ok := seen[key]; ok {
						continue
					}
					seen[key] = struct{}{}
					candidates = append(candidates, candidate)
				}
			}
		}
	}
	sortAssetModelTargetCandidates(candidates)
	return candidates, nil
}

func assetModelChannelEligible(scope AssetModelScope, channel *model.Channel) bool {
	if channel == nil || channel.Status != common.ChannelStatusEnabled {
		return false
	}
	if scope.SpecificChannelID > 0 && channel.Id != scope.SpecificChannelID {
		return false
	}
	if _, ok := assetMaterializerForChannel(channel.Type); !ok {
		return false
	}
	return channelCanConsumeAssetType(channel, "Image") || channelCanConsumeAssetType(channel, "Video")
}

func assetModelCandidatesForChannel(channel *model.Channel, modelName string) []AssetModelTargetCandidate {
	if channel == nil {
		return nil
	}
	mappedModel, ok := assetReferenceMappedModel(channel.GetModelMapping(), modelName)
	if !ok {
		return nil
	}
	if channel.Type != constant.ChannelTypeTechMobiVideo {
		scope, err := assetBindingScope(channel.Type, AssetMaterializeOptions{Model: mappedModel})
		if err != nil {
			return nil
		}
		return []AssetModelTargetCandidate{{
			ChannelID:       channel.Id,
			ChannelType:     channel.Type,
			Priority:        channel.GetPriority(),
			Weight:          channel.GetWeight(),
			MappedModel:     mappedModel,
			BindingScope:    scope,
			CredentialIndex: -1,
		}}
	}
	keys := enabledAssetMaterializeKeys(channel)
	candidates := make([]AssetModelTargetCandidate, 0, len(keys))
	for _, key := range keys {
		scope, err := assetBindingScope(channel.Type, AssetMaterializeOptions{Model: mappedModel, APIKey: key.key})
		if err != nil {
			continue
		}
		candidates = append(candidates, AssetModelTargetCandidate{
			ChannelID:       channel.Id,
			ChannelType:     channel.Type,
			Priority:        channel.GetPriority(),
			Weight:          channel.GetWeight(),
			MappedModel:     mappedModel,
			BindingScope:    scope,
			CredentialIndex: key.index,
		})
	}
	return candidates
}

func sortAssetModelTargetCandidates(candidates []AssetModelTargetCandidate) {
	sort.SliceStable(candidates, func(i, j int) bool {
		if candidates[i].Priority != candidates[j].Priority {
			return candidates[i].Priority > candidates[j].Priority
		}
		if candidates[i].Weight != candidates[j].Weight {
			return candidates[i].Weight > candidates[j].Weight
		}
		if candidates[i].ChannelID != candidates[j].ChannelID {
			return candidates[i].ChannelID < candidates[j].ChannelID
		}
		return candidates[i].CredentialIndex < candidates[j].CredentialIndex
	})
}

func assetModelCandidateKey(candidate AssetModelTargetCandidate) string {
	return strings.Join([]string{
		strconv.Itoa(candidate.ChannelID),
		candidate.MappedModel,
		candidate.BindingScope,
	}, "\x00")
}

func EnsureAssetModelCoverageTarget(scope AssetModelScope, modelName string, owner string, _ time.Time) (*model.AssetModelCoverageTarget, error) {
	return EnsureAssetModelCoverageTargetContext(context.Background(), scope, modelName, owner)
}

func EnsureAssetModelCoverageTargetContext(ctx context.Context, scope AssetModelScope, modelName string, owner string) (*model.AssetModelCoverageTarget, error) {
	nowUnix, err := model.GetDBTimestampWithContext(ctx)
	if err != nil {
		return nil, err
	}
	return ensureAssetModelCoverageTargetAt(scope, modelName, owner, nowUnix)
}

func ensureAssetModelCoverageTargetAt(scope AssetModelScope, modelName string, owner string, nowUnix int64) (*model.AssetModelCoverageTarget, error) {
	scope.ScopeKey = strings.TrimSpace(scope.ScopeKey)
	modelName = strings.TrimSpace(modelName)
	owner = strings.TrimSpace(owner)
	if scope.ScopeKey == "" || modelName == "" || owner == "" {
		return nil, ErrAssetBindingUnavailable
	}
	if !assetModelScopeContainsModel(scope, modelName) {
		return nil, ErrAssetBindingUnavailable
	}
	if existing, err := model.GetAssetModelCoverageTarget(scope.ScopeKey, modelName); err == nil {
		eligible, eligibleErr := AssetModelTargetIsEligible(scope, *existing)
		if eligibleErr != nil {
			return nil, eligibleErr
		}
		if eligible {
			return existing, nil
		}
	} else if !errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, err
	}

	candidates, err := AssetModelTargetCandidates(scope, modelName)
	if err != nil {
		return nil, err
	}
	if len(candidates) == 0 {
		return nil, ErrAssetBindingUnavailable
	}

	leaseExpiresAt := nowUnix + int64(assetBindingDefaultLeaseTTL.Seconds())
	claimed, err := model.ClaimAssetModelTargetLease(scope.ScopeKey, modelName, owner, nowUnix, leaseExpiresAt)
	if err != nil {
		return nil, err
	}
	if !claimed {
		return nil, ErrAssetBindingInitializing
	}
	current, err := model.GetAssetModelCoverageTarget(scope.ScopeKey, modelName)
	if err != nil {
		return nil, err
	}
	candidate := assetModelCoverageTargetFromCandidate(scope, modelName, candidates[0], 0)
	published, err := model.PublishAssetModelTargetCAS(scope.ScopeKey, modelName, owner, current.Generation, leaseExpiresAt, candidate, nowUnix)
	if err != nil {
		return nil, err
	}
	if !published {
		return nil, ErrAssetBindingInitializing
	}
	return model.GetAssetModelCoverageTarget(scope.ScopeKey, modelName)
}

func AssetModelTargetIsEligible(scope AssetModelScope, target model.AssetModelCoverageTarget) (bool, error) {
	if strings.TrimSpace(scope.ScopeKey) == "" ||
		strings.TrimSpace(target.ScopeKey) != strings.TrimSpace(scope.ScopeKey) ||
		!assetModelScopeContainsModel(scope, target.ModelName) ||
		target.Status != model.AssetModelTargetStatusActive ||
		target.ChannelId <= 0 ||
		strings.TrimSpace(target.MappedModel) == "" ||
		target.SpecificChannelId != scope.SpecificChannelID ||
		target.RoutingGroups != assetModelRoutingGroups(scope.Groups) {
		return false, nil
	}
	candidates, err := AssetModelTargetCandidates(scope, target.ModelName)
	if err != nil {
		return false, err
	}
	for _, candidate := range candidates {
		if candidate.ChannelID == target.ChannelId &&
			candidate.MappedModel == target.MappedModel &&
			candidate.BindingScope == target.BindingScope &&
			candidate.CredentialIndex == target.CredentialIndex {
			return true, nil
		}
	}
	return false, nil
}

func assetModelScopeContainsModel(scope AssetModelScope, modelName string) bool {
	modelName = strings.TrimSpace(modelName)
	if modelName == "" {
		return false
	}
	for _, scopedModel := range scope.ModelNames {
		if strings.TrimSpace(scopedModel) == modelName {
			return true
		}
	}
	return false
}

func ResolveAssetModelTargetOptions(target model.AssetModelCoverageTarget, channel *model.Channel) (AssetMaterializeOptions, int, error) {
	if channel == nil || channel.Id != target.ChannelId {
		return AssetMaterializeOptions{}, -1, ErrAssetBindingUnavailable
	}
	options := AssetMaterializeOptions{Model: strings.TrimSpace(target.MappedModel)}
	if channel.Type != constant.ChannelTypeTechMobiVideo {
		return options, -1, nil
	}
	keys := enabledAssetMaterializeKeys(channel)
	for _, key := range keys {
		if key.index != target.CredentialIndex {
			continue
		}
		options.APIKey = key.key
		scope, err := assetBindingScope(channel.Type, options)
		if err != nil {
			return AssetMaterializeOptions{}, -1, err
		}
		if scope != target.BindingScope {
			return AssetMaterializeOptions{}, -1, ErrAssetBindingUnavailable
		}
		return options, key.index, nil
	}
	return AssetMaterializeOptions{}, -1, ErrAssetBindingUnavailable
}

func assetModelCoverageTargetFromCandidate(scope AssetModelScope, modelName string, candidate AssetModelTargetCandidate, candidateIndex int) model.AssetModelCoverageTarget {
	return model.AssetModelCoverageTarget{
		ScopeKey:          scope.ScopeKey,
		ModelName:         modelName,
		RoutingGroups:     assetModelRoutingGroups(scope.Groups),
		SpecificChannelId: scope.SpecificChannelID,
		ChannelId:         candidate.ChannelID,
		MappedModel:       candidate.MappedModel,
		BindingScope:      candidate.BindingScope,
		CredentialIndex:   candidate.CredentialIndex,
		CandidateIndex:    candidateIndex,
	}
}
