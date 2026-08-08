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
		target, targetErr := EnsureAssetModelCoverageTargetContext(ctx, scope, modelName, assetBindingLeaseOwner())
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
	if reopened, reopenErr := reopenStaleAssetModelReadinessRows(asset.Id, rows, targets, now); reopenErr != nil {
		return nil, reopenErr
	} else if reopened {
		rows, err = model.ListAssetModelReadiness(asset.Id, scope.ScopeKey, scope.ModelNames)
		if err != nil {
			return nil, err
		}
	}
	activeBindingKeys, err := loadActiveAssetBindingKeysForTargets(asset.Id, targets)
	if err != nil {
		return nil, err
	}
	strictStatus, err := projectAssetStatusForScope(*asset, scope, rows, targets, activeBindingKeys)
	if err != nil {
		return nil, err
	}
	result.Status = strictStatus
	result.AvailableModels, err = availableAssetModelsForScope(scope, rows, targets, activeBindingKeys)
	if err != nil {
		return nil, err
	}
	return result, nil
}

func ProjectAssetStatusForScope(asset model.Asset, scope AssetModelScope, rows []model.AssetModelReadiness, targets map[string]model.AssetModelCoverageTarget) string {
	activeBindingKeys, err := loadActiveAssetBindingKeysForTargets(asset.Id, targets)
	if err != nil {
		return model.AssetStatusProcessing
	}
	status, err := projectAssetStatusForScope(asset, scope, rows, targets, activeBindingKeys)
	if err != nil {
		return model.AssetStatusProcessing
	}
	return status
}

func projectAssetStatusForScope(asset model.Asset, scope AssetModelScope, rows []model.AssetModelReadiness, targets map[string]model.AssetModelCoverageTarget, activeBindingKeys activeAssetBindingKeySet) (string, error) {
	if sourceStatus := projectAssetSourceStatus(asset); sourceStatus != "" {
		return sourceStatus, nil
	}
	modelNames := normalizedStrings(scope.ModelNames)
	if len(modelNames) == 0 {
		return model.AssetStatusFailed, nil
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
			return model.AssetStatusProcessing, nil
		}
		if row.Status == model.AssetModelReadinessStatusFailed {
			return model.AssetStatusFailed, nil
		}
		target, ok := targets[modelName]
		if !ok || !activeAssetModelTargetForScope(scope, target) {
			return model.AssetStatusProcessing, nil
		}
		switch row.Status {
		case model.AssetModelReadinessStatusFailed:
			return model.AssetStatusFailed, nil
		case model.AssetModelReadinessStatusPending, model.AssetModelReadinessStatusProcessing, model.AssetModelReadinessStatusRetryWaiting:
			return model.AssetStatusProcessing, nil
		case model.AssetModelReadinessStatusActive:
			if row.TargetGeneration != target.Generation ||
				row.ChannelId != target.ChannelId ||
				row.BindingScope != target.BindingScope ||
				!activeBindingKeys.has(target) {
				return model.AssetStatusProcessing, nil
			}
		default:
			return model.AssetStatusProcessing, nil
		}
	}
	return model.AssetStatusActive, nil
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
	active, err := assetHasActiveBindingForTargetStrict(assetID, target)
	return err == nil && active
}

func assetHasActiveBindingForTargetStrict(assetID int64, target model.AssetModelCoverageTarget) (bool, error) {
	var count int64
	if err := model.DB.Model(&model.AssetBinding{}).
		Where("asset_id = ? AND channel_id = ? AND binding_scope = ? AND status = ?", assetID, target.ChannelId, target.BindingScope, model.AssetStatusActive).
		Where("upstream_asset_id <> ?", "").
		Count(&count).Error; err != nil {
		return false, err
	}
	return count > 0, nil
}

type assetBindingTargetKey struct {
	channelID    int
	bindingScope string
}

type activeAssetBindingKeySet map[assetBindingTargetKey]struct{}

func (set activeAssetBindingKeySet) has(target model.AssetModelCoverageTarget) bool {
	if set == nil {
		return false
	}
	_, ok := set[assetBindingKeyForTarget(target)]
	return ok
}

func assetBindingKeyForTarget(target model.AssetModelCoverageTarget) assetBindingTargetKey {
	return assetBindingTargetKey{
		channelID:    target.ChannelId,
		bindingScope: strings.TrimSpace(target.BindingScope),
	}
}

func loadActiveAssetBindingKeysForTargets(assetID int64, targets map[string]model.AssetModelCoverageTarget) (activeAssetBindingKeySet, error) {
	requested := make(activeAssetBindingKeySet, len(targets))
	for _, target := range targets {
		key := assetBindingKeyForTarget(target)
		if key.channelID <= 0 {
			continue
		}
		requested[key] = struct{}{}
	}
	if len(requested) == 0 {
		return activeAssetBindingKeySet{}, nil
	}

	clauses := make([]string, 0, len(requested))
	args := make([]any, 0, len(requested)*2)
	for key := range requested {
		clauses = append(clauses, "(channel_id = ? AND binding_scope = ?)")
		args = append(args, key.channelID, key.bindingScope)
	}

	var bindings []model.AssetBinding
	if err := model.DB.Model(&model.AssetBinding{}).
		Select("channel_id, binding_scope").
		Where("asset_id = ? AND status = ?", assetID, model.AssetStatusActive).
		Where("upstream_asset_id <> ?", "").
		Where("("+strings.Join(clauses, " OR ")+")", args...).
		Find(&bindings).Error; err != nil {
		return nil, err
	}

	active := make(activeAssetBindingKeySet, len(bindings))
	for _, binding := range bindings {
		key := assetBindingTargetKey{channelID: binding.ChannelId, bindingScope: strings.TrimSpace(binding.BindingScope)}
		if _, ok := requested[key]; ok {
			active[key] = struct{}{}
		}
	}
	return active, nil
}

func availableAssetModelsForScope(scope AssetModelScope, rows []model.AssetModelReadiness, targets map[string]model.AssetModelCoverageTarget, activeBindingKeys activeAssetBindingKeySet) ([]string, error) {
	modelNames := normalizedStrings(scope.ModelNames)
	if len(modelNames) == 0 {
		return []string{}, nil
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

	available := make([]string, 0, len(modelNames))
	for _, modelName := range modelNames {
		row, ok := rowsByModel[modelName]
		if !ok || row.Status != model.AssetModelReadinessStatusActive {
			continue
		}
		target, ok := targets[modelName]
		if !ok || !activeAssetModelTargetForScope(scope, target) {
			continue
		}
		if row.TargetGeneration != target.Generation ||
			row.ChannelId != target.ChannelId ||
			row.BindingScope != target.BindingScope {
			continue
		}
		if activeBindingKeys.has(target) {
			available = append(available, modelName)
		}
	}
	return normalizedStrings(available), nil
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

func reopenStaleAssetModelReadinessRows(assetID int64, rows []model.AssetModelReadiness, targets map[string]model.AssetModelCoverageTarget, now int64) (bool, error) {
	reopened := false
	for _, row := range rows {
		if row.Status != model.AssetModelReadinessStatusActive {
			continue
		}
		target, ok := targets[row.ModelName]
		if !ok || assetModelReadinessMatchesTarget(row, target) {
			continue
		}
		result := model.DB.Model(&model.AssetModelReadiness{}).
			Where("asset_id = ? AND scope_key = ? AND model_name = ?", assetID, row.ScopeKey, row.ModelName).
			Where("status = ? AND target_generation = ? AND channel_id = ? AND binding_scope = ?",
				model.AssetModelReadinessStatusActive, row.TargetGeneration, row.ChannelId, row.BindingScope).
			Updates(map[string]any{
				"target_generation":  target.Generation,
				"channel_id":         target.ChannelId,
				"binding_scope":      target.BindingScope,
				"status":             model.AssetModelReadinessStatusPending,
				"error_class":        "",
				"attempt_count":      0,
				"attempt_started_at": int64(0),
				"next_retry_at":      int64(0),
				"lease_owner":        "",
				"lease_expires_at":   int64(0),
				"updated_at":         now,
			})
		if result.Error != nil {
			return false, result.Error
		}
		reopened = reopened || result.RowsAffected == 1
	}
	return reopened, nil
}
