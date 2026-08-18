package service

import (
	"context"
	"errors"
	"net/url"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"gorm.io/gorm"
)

var ErrAssetSourceURLUnavailable = errors.New("asset source url unavailable")

const modelAPIAssetSourceURLTTL = 12 * time.Hour

func ResolveAssetSourceURLRewriteMap(ctx context.Context, userID int, references AssetReferenceSet, channel *model.Channel, originModel string) (map[string]string, error) {
	if ctx == nil {
		ctx = context.Background()
	}
	if !references.HasReferences() {
		return nil, nil
	}
	if !references.strictCoverage || references.target == nil || strings.TrimSpace(references.scope.ScopeKey) == "" {
		return nil, ErrAssetSourceURLUnavailable
	}
	if channel == nil || !AssetModelChannelUsesSourceURLForChannel(channel) || channel.Status != common.ChannelStatusEnabled {
		return nil, ErrAssetSourceURLUnavailable
	}
	originModel = strings.TrimSpace(originModel)
	if originModel == "" {
		return nil, ErrAssetSourceURLUnavailable
	}
	mappedModel, ok := assetReferenceMappedModel(channel.GetModelMapping(), originModel)
	if !ok || strings.TrimSpace(mappedModel) == "" {
		return nil, ErrAssetSourceURLUnavailable
	}

	distinct, publicIDs, err := distinctAssetSourceURLReferences(references.references)
	if err != nil {
		return nil, err
	}
	items, err := model.GetAssetsWithBindingsByPublicIDsForUser(userID, publicIDs)
	if err != nil {
		return nil, err
	}
	assets := make(map[string]model.Asset, len(items))
	for publicID, item := range items {
		assets[publicID] = item.Asset
	}

	signTargets := make([]model.Asset, 0, len(distinct))
	for _, reference := range distinct {
		asset, ok := assets[reference.PublicID]
		if !ok {
			return nil, ErrAssetSourceURLUnavailable
		}
		if asset.AssetType != reference.ExpectedAssetType || !channelCanConsumeAssetType(channel, asset.AssetType) {
			return nil, ErrAssetSourceURLUnavailable
		}
		if !assetModelSourceRecoverable(asset) {
			return nil, ErrAssetSourceURLUnavailable
		}
		target, row, err := resolveAssetSourceURLTargetReadiness(asset, references.scope, *references.target, originModel)
		if err != nil {
			return nil, err
		}
		if target.ChannelId != channel.Id ||
			strings.TrimSpace(target.MappedModel) != strings.TrimSpace(mappedModel) ||
			!assetModelTargetUsesSourceURL(target) ||
			!assetModelReadinessMatchesTarget(row, target) ||
			row.AssetId != asset.Id ||
			row.Status != model.AssetModelReadinessStatusActive {
			return nil, ErrAssetSourceURLUnavailable
		}
		signTargets = append(signTargets, asset)
	}

	signingConfig := CurrentAssetStorageConfig()
	signingConfig.SignedURLTTL = modelAPIAssetSourceURLTTL
	rewrite := make(map[string]string, len(signTargets))
	for _, asset := range signTargets {
		signed, err := SignAssetSourceURL(ctx, asset, signingConfig)
		if err != nil {
			return nil, err
		}
		parsed, err := url.Parse(signed)
		if err != nil || parsed.Scheme != "https" {
			return nil, ErrAssetSourceURLUnavailable
		}
		rewrite["asset://"+asset.PublicId] = signed
	}
	return rewrite, nil
}

func distinctAssetSourceURLReferences(references []assetReference) ([]assetReference, []string, error) {
	distinct := make([]assetReference, 0, len(references))
	publicIDs := make([]string, 0, len(references))
	seen := make(map[string]assetReference, len(references))
	for _, reference := range references {
		reference.PublicID = strings.TrimSpace(reference.PublicID)
		reference.ExpectedAssetType = strings.TrimSpace(reference.ExpectedAssetType)
		if reference.PublicID == "" || reference.ExpectedAssetType == "" {
			return nil, nil, ErrAssetSourceURLUnavailable
		}
		if existing, ok := seen[reference.PublicID]; ok {
			if existing.ExpectedAssetType != reference.ExpectedAssetType {
				return nil, nil, ErrAssetSourceURLUnavailable
			}
			continue
		}
		seen[reference.PublicID] = reference
		distinct = append(distinct, reference)
		publicIDs = append(publicIDs, reference.PublicID)
	}
	return distinct, publicIDs, nil
}

func resolveAssetSourceURLTargetReadiness(asset model.Asset, scope AssetModelScope, selectedTarget model.AssetModelCoverageTarget, originModel string) (model.AssetModelCoverageTarget, model.AssetModelReadiness, error) {
	if strings.TrimSpace(selectedTarget.ScopeKey) != strings.TrimSpace(scope.ScopeKey) ||
		strings.TrimSpace(selectedTarget.ModelName) != strings.TrimSpace(originModel) ||
		selectedTarget.Status != model.AssetModelTargetStatusActive ||
		selectedTarget.BindingScope != assetModelSourceURLBindingScopeModelAPI ||
		!activeAssetModelTargetForScope(scope, selectedTarget) {
		return model.AssetModelCoverageTarget{}, model.AssetModelReadiness{}, ErrAssetSourceURLUnavailable
	}
	var row model.AssetModelReadiness
	err := model.DB.Where("asset_id = ? AND scope_key = ? AND model_name = ? AND status = ?", asset.Id, selectedTarget.ScopeKey, selectedTarget.ModelName, model.AssetModelReadinessStatusActive).
		Order("updated_at DESC, id DESC").
		First(&row).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return model.AssetModelCoverageTarget{}, model.AssetModelReadiness{}, ErrAssetSourceURLUnavailable
	}
	if err != nil {
		return model.AssetModelCoverageTarget{}, model.AssetModelReadiness{}, err
	}
	target, err := model.GetAssetModelCoverageTarget(selectedTarget.ScopeKey, selectedTarget.ModelName)
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return model.AssetModelCoverageTarget{}, model.AssetModelReadiness{}, ErrAssetSourceURLUnavailable
	}
	if err != nil {
		return model.AssetModelCoverageTarget{}, model.AssetModelReadiness{}, err
	}
	if target == nil ||
		target.Status != model.AssetModelTargetStatusActive ||
		target.Generation != selectedTarget.Generation ||
		target.ChannelId != selectedTarget.ChannelId ||
		target.MappedModel != selectedTarget.MappedModel ||
		target.BindingScope != selectedTarget.BindingScope ||
		target.CredentialIndex != selectedTarget.CredentialIndex {
		return model.AssetModelCoverageTarget{}, model.AssetModelReadiness{}, ErrAssetSourceURLUnavailable
	}
	return *target, row, nil
}
