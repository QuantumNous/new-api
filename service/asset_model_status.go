package service

import (
	"context"
	"errors"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"gorm.io/gorm"
)

var AssetModelCoverageStrictEnabled = common.GetEnvOrDefaultBool("ASSET_MODEL_COVERAGE_STRICT_ENABLED", false)

func ReconcileAssetForScope(ctx context.Context, userID int, publicID string, scope AssetModelScope) (*AssetResult, error) {
	publicID = strings.TrimSpace(publicID)
	if publicID == "" {
		return nil, ErrAssetUploadNotFound
	}
	asset, err := model.GetAssetByPublicIDForUser(userID, publicID)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrAssetUploadNotFound
		}
		return nil, err
	}
	result := publicResultFromAsset(asset)
	if sourceStatus := projectAssetSourceStatus(*asset); sourceStatus != "" {
		result.Status = sourceStatus
		return result, nil
	}

	scope.ModelNames = normalizedStrings(scope.ModelNames)
	if strings.TrimSpace(scope.ScopeKey) == "" {
		var keyErr error
		scope.ScopeKey, keyErr = assetModelScopeKey(scope)
		if keyErr != nil {
			return nil, keyErr
		}
	}
	if len(scope.ModelNames) == 0 {
		result.Status = model.AssetStatusFailed
		return result, nil
	}

	now, err := model.GetDBTimestampWithContext(ctx)
	if err != nil {
		return nil, err
	}
	if err := model.EnsureAssetModelReadiness(asset.Id, scope.ScopeKey, scope.ModelNames, now); err != nil {
		return nil, err
	}

	targets := make(map[string]model.AssetModelCoverageTarget, len(scope.ModelNames))
	for _, modelName := range scope.ModelNames {
		target, targetErr := EnsureAssetModelCoverageTarget(scope, modelName, assetBindingLeaseOwner(), assetNow())
		if targetErr != nil {
			if errors.Is(targetErr, ErrAssetBindingUnavailable) {
				if failErr := markAssetModelReadinessFailed(asset.Id, scope.ScopeKey, modelName, now); failErr != nil {
					return nil, failErr
				}
				continue
			}
			if errors.Is(targetErr, ErrAssetBindingInitializing) {
				continue
			}
			return nil, targetErr
		}
		if target != nil {
			targets[modelName] = *target
		}
	}

	rows, err := model.ListAssetModelReadiness(asset.Id, scope.ScopeKey, scope.ModelNames)
	if err != nil {
		return nil, err
	}
	strictStatus := ProjectAssetStatusForScope(*asset, scope, rows, targets)
	if AssetModelCoverageStrictEnabled {
		result.Status = strictStatus
	} else {
		result.Status = projectedAssetStatus(asset)
	}
	return result, nil
}

func ProjectAssetStatusForScope(asset model.Asset, scope AssetModelScope, rows []model.AssetModelReadiness, targets map[string]model.AssetModelCoverageTarget) string {
	if sourceStatus := projectAssetSourceStatus(asset); sourceStatus != "" {
		return sourceStatus
	}
	modelNames := normalizedStrings(scope.ModelNames)
	if len(modelNames) == 0 {
		return model.AssetStatusFailed
	}

	rowsByModel := make(map[string]model.AssetModelReadiness, len(rows))
	for _, row := range rows {
		name := strings.TrimSpace(row.ModelName)
		if name == "" {
			continue
		}
		if existing, ok := rowsByModel[name]; !ok || row.UpdatedAt > existing.UpdatedAt || row.Id > existing.Id {
			rowsByModel[name] = row
		}
	}

	for _, modelName := range modelNames {
		row, ok := rowsByModel[modelName]
		if !ok {
			return model.AssetStatusProcessing
		}
		if row.Status == model.AssetModelReadinessStatusFailed {
			return model.AssetStatusFailed
		}
		target, ok := targets[modelName]
		if !ok || !activeAssetModelTargetForScope(scope, target) {
			return model.AssetStatusProcessing
		}
		switch row.Status {
		case model.AssetModelReadinessStatusFailed:
			return model.AssetStatusFailed
		case model.AssetModelReadinessStatusPending, model.AssetModelReadinessStatusProcessing, model.AssetModelReadinessStatusRetryWaiting:
			return model.AssetStatusProcessing
		case model.AssetModelReadinessStatusActive:
			if row.TargetGeneration != target.Generation ||
				row.ChannelId != target.ChannelId ||
				row.BindingScope != target.BindingScope ||
				!assetHasActiveBindingForTarget(asset.Id, target) {
				return model.AssetStatusProcessing
			}
		default:
			return model.AssetStatusProcessing
		}
	}
	return model.AssetStatusActive
}

func projectAssetSourceStatus(asset model.Asset) string {
	switch asset.Status {
	case model.AssetStatusCreating, model.AssetStatusFailed, model.AssetStatusExpired:
		return asset.Status
	}
	switch asset.SourceStatus {
	case model.AssetSourceStatusAvailable:
		return ""
	case model.AssetSourceStatusExpired:
		return model.AssetStatusExpired
	case model.AssetSourceStatusUnavailable, model.AssetSourceStatusCleanupPending:
		return model.AssetStatusFailed
	}
	if asset.Status != "" && asset.Status != model.AssetStatusActive {
		return asset.Status
	}
	return ""
}

func activeAssetModelTargetForScope(scope AssetModelScope, target model.AssetModelCoverageTarget) bool {
	return target.Status == model.AssetModelTargetStatusActive &&
		strings.TrimSpace(target.ScopeKey) == strings.TrimSpace(scope.ScopeKey) &&
		assetModelScopeContainsModel(scope, target.ModelName) &&
		target.ChannelId > 0 &&
		target.SpecificChannelId == scope.SpecificChannelID &&
		target.RoutingGroups == assetModelRoutingGroups(scope.Groups)
}

func assetHasActiveBindingForTarget(assetID int64, target model.AssetModelCoverageTarget) bool {
	var count int64
	if err := model.DB.Model(&model.AssetBinding{}).
		Where("asset_id = ? AND channel_id = ? AND binding_scope = ? AND status = ?", assetID, target.ChannelId, target.BindingScope, model.AssetStatusActive).
		Where("upstream_asset_id <> ?", "").
		Count(&count).Error; err != nil {
		return false
	}
	return count > 0
}

func markAssetModelReadinessFailed(assetID int64, scopeKey, modelName string, now int64) error {
	return model.DB.Model(&model.AssetModelReadiness{}).
		Where("asset_id = ? AND scope_key = ? AND model_name = ?", assetID, strings.TrimSpace(scopeKey), strings.TrimSpace(modelName)).
		Updates(map[string]any{
			"status":      model.AssetModelReadinessStatusFailed,
			"error_class": "target_unavailable",
			"updated_at":  now,
		}).Error
}
