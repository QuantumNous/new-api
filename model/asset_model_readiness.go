package model

import (
	"sort"
	"strings"
	"unicode"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

const (
	AssetModelTargetStatusSelecting   = "Selecting"
	AssetModelTargetStatusActive      = "Active"
	AssetModelTargetStatusRotating    = "Rotating"
	AssetModelTargetStatusUnavailable = "Unavailable"

	AssetModelReadinessStatusPending      = "Pending"
	AssetModelReadinessStatusProcessing   = "Processing"
	AssetModelReadinessStatusRetryWaiting = "RetryWaiting"
	AssetModelReadinessStatusActive       = "Active"
	AssetModelReadinessStatusFailed       = "Failed"
)

const (
	defaultAssetModelReadinessDueLimit = 100
	maxAssetModelReadinessDueLimit     = 500
)

type AssetModelCoverageTarget struct {
	Id                int64  `json:"-" gorm:"primaryKey"`
	ScopeKey          string `json:"-" gorm:"type:varchar(64);uniqueIndex:idx_asset_model_target_scope_model"`
	ModelName         string `json:"-" gorm:"type:varchar(191);uniqueIndex:idx_asset_model_target_scope_model"`
	RoutingGroups     string `json:"-" gorm:"type:text"`
	SpecificChannelId int    `json:"-" gorm:"index"`
	ChannelId         int    `json:"-" gorm:"index"`
	MappedModel       string `json:"-" gorm:"type:varchar(191)"`
	BindingScope      string `json:"-" gorm:"type:varchar(128)"`
	CredentialIndex   int    `json:"-"`
	CandidateIndex    int    `json:"-"`
	Generation        int64  `json:"-"`
	Status            string `json:"-" gorm:"type:varchar(24);index"`
	LeaseOwner        string `json:"-" gorm:"type:varchar(64);index"`
	LeaseExpiresAt    int64  `json:"-" gorm:"index"`
	CreatedAt         int64  `json:"-"`
	UpdatedAt         int64  `json:"-"`
}

type AssetModelReadiness struct {
	Id               int64  `json:"-" gorm:"primaryKey"`
	AssetId          int64  `json:"-" gorm:"uniqueIndex:idx_asset_model_readiness_identity"`
	ScopeKey         string `json:"-" gorm:"type:varchar(64);uniqueIndex:idx_asset_model_readiness_identity"`
	ModelName        string `json:"-" gorm:"type:varchar(191);uniqueIndex:idx_asset_model_readiness_identity"`
	TargetGeneration int64  `json:"-" gorm:"index"`
	ChannelId        int    `json:"-" gorm:"index"`
	BindingScope     string `json:"-" gorm:"type:varchar(128)"`
	Status           string `json:"-" gorm:"type:varchar(24);index"`
	ErrorClass       string `json:"-" gorm:"type:varchar(48);index"`
	AttemptCount     int    `json:"-"`
	AttemptStartedAt int64  `json:"-" gorm:"index"`
	NextRetryAt      int64  `json:"-" gorm:"index"`
	LeaseOwner       string `json:"-" gorm:"type:varchar(64);index"`
	LeaseExpiresAt   int64  `json:"-" gorm:"index"`
	CreatedAt        int64  `json:"-"`
	UpdatedAt        int64  `json:"-"`
}

type AssetModelReadinessTransition struct {
	AssetId                int64
	ScopeKey               string
	ModelName              string
	TargetGeneration       int64
	ChannelId              int
	BindingScope           string
	LeaseOwner             string
	ExpectedAttemptCount   int
	ExpectedLeaseExpiresAt int64
	Now                    int64
}

func EnsureAssetModelReadiness(assetID int64, scopeKey string, modelNames []string, now int64) error {
	scopeKey = strings.TrimSpace(scopeKey)
	names := canonicalAssetModelNames(modelNames)
	if DB == nil || assetID <= 0 || scopeKey == "" || len(names) == 0 {
		return nil
	}

	rows := make([]AssetModelReadiness, 0, len(names))
	for _, name := range names {
		rows = append(rows, AssetModelReadiness{
			AssetId:   assetID,
			ScopeKey:  scopeKey,
			ModelName: name,
			Status:    AssetModelReadinessStatusPending,
			CreatedAt: now,
			UpdatedAt: now,
		})
	}
	return DB.Clauses(clause.OnConflict{DoNothing: true}).Create(&rows).Error
}

func GetAssetModelCoverageTarget(scopeKey, modelName string) (*AssetModelCoverageTarget, error) {
	scopeKey = strings.TrimSpace(scopeKey)
	modelName = strings.TrimSpace(modelName)
	if DB == nil || scopeKey == "" || modelName == "" {
		return nil, gorm.ErrRecordNotFound
	}

	var target AssetModelCoverageTarget
	if err := DB.Where("scope_key = ? AND model_name = ?", scopeKey, modelName).First(&target).Error; err != nil {
		return nil, err
	}
	return &target, nil
}

func ListAssetModelReadiness(assetID int64, scopeKey string, modelNames []string) ([]AssetModelReadiness, error) {
	scopeKey = strings.TrimSpace(scopeKey)
	names := canonicalAssetModelNames(modelNames)
	if DB == nil || assetID <= 0 || scopeKey == "" || len(names) == 0 {
		return []AssetModelReadiness{}, nil
	}

	var rows []AssetModelReadiness
	if err := DB.Where("asset_id = ? AND scope_key = ? AND model_name IN ?", assetID, scopeKey, names).
		Order("model_name ASC, id ASC").
		Find(&rows).Error; err != nil {
		return nil, err
	}
	return rows, nil
}

func ListDueAssetModelReadiness(now int64, limit int) ([]AssetModelReadiness, error) {
	if DB == nil {
		return []AssetModelReadiness{}, nil
	}
	if limit <= 0 {
		limit = defaultAssetModelReadinessDueLimit
	}
	if limit > maxAssetModelReadinessDueLimit {
		limit = maxAssetModelReadinessDueLimit
	}

	var rows []AssetModelReadiness
	if err := DB.Where(
		"(status = ? AND (lease_owner = '' OR lease_expires_at <= ?)) OR "+
			"(status = ? AND next_retry_at <= ? AND (lease_owner = '' OR lease_expires_at <= ?)) OR "+
			"(status = ? AND lease_expires_at <= ?)",
		AssetModelReadinessStatusPending, now,
		AssetModelReadinessStatusRetryWaiting, now, now,
		AssetModelReadinessStatusProcessing, now,
	).
		Order("next_retry_at ASC, updated_at ASC, id ASC").
		Limit(limit).
		Find(&rows).Error; err != nil {
		return nil, err
	}
	return rows, nil
}

func ClaimAssetModelReadinessLease(id int64, owner string, now, leaseExpiresAt int64) (bool, error) {
	owner = strings.TrimSpace(owner)
	if DB == nil || id <= 0 || owner == "" {
		return false, nil
	}

	result := DB.Model(&AssetModelReadiness{}).
		Where("id = ?", id).
		Where(
			"(status = ? AND (lease_owner = '' OR lease_expires_at <= ?)) OR "+
				"(status = ? AND next_retry_at <= ? AND (lease_owner = '' OR lease_expires_at <= ?)) OR "+
				"(status = ? AND lease_expires_at <= ?)",
			AssetModelReadinessStatusPending, now,
			AssetModelReadinessStatusRetryWaiting, now, now,
			AssetModelReadinessStatusProcessing, now,
		).
		Updates(map[string]any{
			"status":             AssetModelReadinessStatusProcessing,
			"lease_owner":        owner,
			"lease_expires_at":   leaseExpiresAt,
			"attempt_started_at": gorm.Expr("CASE WHEN attempt_started_at = 0 THEN ? ELSE attempt_started_at END", now),
			"attempt_count":      gorm.Expr("attempt_count + ?", 1),
			"updated_at":         now,
		})
	if result.Error != nil {
		return false, result.Error
	}
	return result.RowsAffected == 1, nil
}

func ResetAssetModelReadinessForTargetCAS(id int64, owner string, expectedAttemptCount int, expectedLeaseExpiresAt int64, target AssetModelCoverageTarget, now int64) (bool, error) {
	owner = strings.TrimSpace(owner)
	target.ScopeKey = strings.TrimSpace(target.ScopeKey)
	target.ModelName = strings.TrimSpace(target.ModelName)
	if DB == nil || id <= 0 || owner == "" {
		return false, nil
	}

	result := DB.Model(&AssetModelReadiness{}).
		Where("id = ? AND scope_key = ? AND model_name = ?", id, target.ScopeKey, target.ModelName).
		Where("status = ? AND lease_owner = ? AND attempt_count = ? AND lease_expires_at = ? AND lease_expires_at > ?",
			AssetModelReadinessStatusProcessing, owner, expectedAttemptCount, expectedLeaseExpiresAt, now).
		Updates(map[string]any{
			"target_generation":  target.Generation,
			"channel_id":         target.ChannelId,
			"binding_scope":      target.BindingScope,
			"status":             AssetModelReadinessStatusPending,
			"error_class":        "",
			"next_retry_at":      int64(0),
			"lease_owner":        "",
			"lease_expires_at":   int64(0),
			"attempt_count":      gorm.Expr("CASE WHEN target_generation <> ? THEN 0 ELSE attempt_count END", target.Generation),
			"attempt_started_at": gorm.Expr("CASE WHEN target_generation <> ? THEN 0 ELSE attempt_started_at END", target.Generation),
			"updated_at":         now,
		})
	if result.Error != nil {
		return false, result.Error
	}
	return result.RowsAffected == 1, nil
}

func ScheduleAssetModelReadinessRetryCAS(transition AssetModelReadinessTransition, errorClass string, nextRetryAt int64) (bool, error) {
	return finishAssetModelReadinessCAS(transition, AssetModelReadinessStatusRetryWaiting, sanitizeAssetModelErrorClass(errorClass), nextRetryAt)
}

func ActivateAssetModelReadinessCAS(transition AssetModelReadinessTransition) (bool, error) {
	return finishAssetModelReadinessCAS(transition, AssetModelReadinessStatusActive, "", 0)
}

func ActivateAssetModelReadinessBindingSetCAS(transition AssetModelReadinessTransition) (int64, error) {
	transition.ScopeKey = strings.TrimSpace(transition.ScopeKey)
	transition.ModelName = strings.TrimSpace(transition.ModelName)
	transition.LeaseOwner = strings.TrimSpace(transition.LeaseOwner)
	if DB == nil ||
		transition.AssetId <= 0 ||
		transition.ScopeKey == "" ||
		transition.ModelName == "" ||
		transition.LeaseOwner == "" {
		return 0, nil
	}

	var activated int64
	err := DB.Transaction(func(tx *gorm.DB) error {
		var targets []AssetModelCoverageTarget
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).
			Where("scope_key = ? AND status = ? AND channel_id = ? AND binding_scope = ?",
				transition.ScopeKey, AssetModelTargetStatusActive, transition.ChannelId, transition.BindingScope).
			Order("model_name ASC").
			Find(&targets).Error; err != nil {
			return err
		}

		foundDriver := false
		for _, target := range targets {
			if target.ModelName == transition.ModelName && target.Generation == transition.TargetGeneration {
				foundDriver = true
				break
			}
		}
		if !foundDriver {
			return nil
		}

		ok, err := finishAssetModelReadinessCASWithDB(tx, transition, AssetModelReadinessStatusActive, "", 0)
		if err != nil {
			return err
		}
		if !ok {
			return nil
		}
		activated = 1

		for _, target := range targets {
			if target.ModelName == transition.ModelName {
				continue
			}
			result := tx.Model(&AssetModelReadiness{}).
				Where("asset_id = ? AND scope_key = ? AND model_name = ?",
					transition.AssetId, transition.ScopeKey, target.ModelName).
				Where("target_generation = ? AND channel_id = ? AND binding_scope = ?",
					target.Generation, target.ChannelId, target.BindingScope).
				Where("status IN ?", []string{
					AssetModelReadinessStatusPending,
					AssetModelReadinessStatusProcessing,
					AssetModelReadinessStatusRetryWaiting,
				}).
				Updates(map[string]any{
					"status":           AssetModelReadinessStatusActive,
					"error_class":      "",
					"next_retry_at":    int64(0),
					"lease_owner":      "",
					"lease_expires_at": int64(0),
					"updated_at":       transition.Now,
				})
			if result.Error != nil {
				return result.Error
			}
			activated += result.RowsAffected
		}

		return nil
	})
	if err != nil {
		return 0, err
	}
	return activated, nil
}

func FailAssetModelReadinessCAS(transition AssetModelReadinessTransition, errorClass string) (bool, error) {
	return finishAssetModelReadinessCAS(transition, AssetModelReadinessStatusFailed, sanitizeAssetModelErrorClass(errorClass), 0)
}

func ClaimAssetModelTargetLease(scopeKey, modelName, owner string, now, leaseExpiresAt int64) (bool, error) {
	scopeKey = strings.TrimSpace(scopeKey)
	modelName = strings.TrimSpace(modelName)
	owner = strings.TrimSpace(owner)
	if DB == nil || scopeKey == "" || modelName == "" || owner == "" {
		return false, nil
	}

	seed := AssetModelCoverageTarget{
		ScopeKey:        scopeKey,
		ModelName:       modelName,
		Status:          AssetModelTargetStatusSelecting,
		Generation:      0,
		CandidateIndex:  -1,
		CredentialIndex: -1,
		CreatedAt:       now,
		UpdatedAt:       now,
	}
	if err := DB.Clauses(clause.OnConflict{DoNothing: true}).Create(&seed).Error; err != nil {
		return false, err
	}

	result := DB.Model(&AssetModelCoverageTarget{}).
		Where("scope_key = ? AND model_name = ?", scopeKey, modelName).
		Where("lease_owner = ? OR lease_owner = '' OR lease_expires_at <= ?", owner, now).
		Updates(map[string]any{
			"lease_owner":      owner,
			"lease_expires_at": leaseExpiresAt,
			"updated_at":       now,
		})
	if result.Error != nil {
		return false, result.Error
	}
	return result.RowsAffected == 1, nil
}

func PublishAssetModelTargetCAS(scopeKey, modelName, owner string, expectedGeneration int64, expectedLeaseExpiresAt int64, candidate AssetModelCoverageTarget, now int64) (bool, error) {
	scopeKey = strings.TrimSpace(scopeKey)
	modelName = strings.TrimSpace(modelName)
	owner = strings.TrimSpace(owner)
	if DB == nil || scopeKey == "" || modelName == "" || owner == "" {
		return false, nil
	}

	result := DB.Model(&AssetModelCoverageTarget{}).
		Where("scope_key = ? AND model_name = ? AND generation = ?", scopeKey, modelName, expectedGeneration).
		Where("lease_owner = ? AND lease_expires_at = ? AND lease_expires_at > ?", owner, expectedLeaseExpiresAt, now).
		Updates(map[string]any{
			"routing_groups":      candidate.RoutingGroups,
			"specific_channel_id": candidate.SpecificChannelId,
			"channel_id":          candidate.ChannelId,
			"mapped_model":        candidate.MappedModel,
			"binding_scope":       candidate.BindingScope,
			"credential_index":    candidate.CredentialIndex,
			"candidate_index":     candidate.CandidateIndex,
			"status":              AssetModelTargetStatusActive,
			"generation":          gorm.Expr("generation + ?", 1),
			"lease_owner":         "",
			"lease_expires_at":    int64(0),
			"updated_at":          now,
		})
	if result.Error != nil {
		return false, result.Error
	}
	return result.RowsAffected == 1, nil
}

func ReleaseAssetModelTargetLeaseCAS(scopeKey, modelName, owner string, expectedGeneration int64, expectedLeaseExpiresAt int64, now int64) (bool, error) {
	scopeKey = strings.TrimSpace(scopeKey)
	modelName = strings.TrimSpace(modelName)
	owner = strings.TrimSpace(owner)
	if DB == nil || scopeKey == "" || modelName == "" || owner == "" {
		return false, nil
	}

	result := DB.Model(&AssetModelCoverageTarget{}).
		Where("scope_key = ? AND model_name = ?", scopeKey, modelName).
		Where("status = ? AND generation = ?", AssetModelTargetStatusActive, expectedGeneration).
		Where("lease_owner = ? AND lease_expires_at = ? AND lease_expires_at > ?", owner, expectedLeaseExpiresAt, now).
		Updates(map[string]any{
			"lease_owner":      "",
			"lease_expires_at": int64(0),
			"updated_at":       now,
		})
	if result.Error != nil {
		return false, result.Error
	}
	return result.RowsAffected == 1, nil
}

func RotateAssetModelTargetCAS(scopeKey, modelName string, expectedGeneration int64, _ string, now int64) (bool, error) {
	scopeKey = strings.TrimSpace(scopeKey)
	modelName = strings.TrimSpace(modelName)
	if DB == nil || scopeKey == "" || modelName == "" {
		return false, nil
	}

	result := DB.Model(&AssetModelCoverageTarget{}).
		Where("scope_key = ? AND model_name = ? AND status = ? AND generation = ?", scopeKey, modelName, AssetModelTargetStatusActive, expectedGeneration).
		Where("lease_owner = '' OR lease_expires_at <= ?", now).
		Updates(map[string]any{
			"routing_groups":      "",
			"specific_channel_id": 0,
			"channel_id":          0,
			"mapped_model":        "",
			"binding_scope":       "",
			"credential_index":    -1,
			"candidate_index":     -1,
			"status":              AssetModelTargetStatusRotating,
			"generation":          gorm.Expr("generation + ?", 1),
			"lease_owner":         "",
			"lease_expires_at":    int64(0),
			"updated_at":          now,
		})
	if result.Error != nil {
		return false, result.Error
	}
	return result.RowsAffected == 1, nil
}

func finishAssetModelReadinessCAS(transition AssetModelReadinessTransition, status string, errorClass string, nextRetryAt int64) (bool, error) {
	return finishAssetModelReadinessCASWithDB(DB, transition, status, errorClass, nextRetryAt)
}

func finishAssetModelReadinessCASWithDB(db *gorm.DB, transition AssetModelReadinessTransition, status string, errorClass string, nextRetryAt int64) (bool, error) {
	transition.ScopeKey = strings.TrimSpace(transition.ScopeKey)
	transition.ModelName = strings.TrimSpace(transition.ModelName)
	transition.LeaseOwner = strings.TrimSpace(transition.LeaseOwner)
	if db == nil ||
		transition.AssetId <= 0 ||
		transition.ScopeKey == "" ||
		transition.ModelName == "" ||
		transition.LeaseOwner == "" {
		return false, nil
	}

	result := db.Model(&AssetModelReadiness{}).
		Where("asset_id = ? AND scope_key = ? AND model_name = ?", transition.AssetId, transition.ScopeKey, transition.ModelName).
		Where("status = ? AND lease_owner = ? AND attempt_count = ? AND lease_expires_at = ? AND lease_expires_at > ?",
			AssetModelReadinessStatusProcessing, transition.LeaseOwner, transition.ExpectedAttemptCount, transition.ExpectedLeaseExpiresAt, transition.Now).
		Where("target_generation = ? AND channel_id = ? AND binding_scope = ?", transition.TargetGeneration, transition.ChannelId, transition.BindingScope).
		Updates(map[string]any{
			"status":           status,
			"error_class":      errorClass,
			"next_retry_at":    nextRetryAt,
			"lease_owner":      "",
			"lease_expires_at": int64(0),
			"updated_at":       transition.Now,
		})
	if result.Error != nil {
		return false, result.Error
	}
	return result.RowsAffected == 1, nil
}

func canonicalAssetModelNames(modelNames []string) []string {
	seen := make(map[string]struct{}, len(modelNames))
	names := make([]string, 0, len(modelNames))
	for _, name := range modelNames {
		name = strings.TrimSpace(name)
		if name == "" {
			continue
		}
		if _, ok := seen[name]; ok {
			continue
		}
		seen[name] = struct{}{}
		names = append(names, name)
	}
	sort.Strings(names)
	return names
}

func sanitizeAssetModelErrorClass(errorClass string) string {
	errorClass = strings.TrimSpace(strings.ToLower(errorClass))
	if errorClass == "" {
		return "unknown"
	}
	var builder strings.Builder
	previousUnderscore := false
	for _, r := range errorClass {
		if unicode.IsLetter(r) || unicode.IsDigit(r) {
			builder.WriteRune(r)
			previousUnderscore = false
			continue
		}
		if !previousUnderscore {
			builder.WriteByte('_')
			previousUnderscore = true
		}
	}
	sanitized := strings.Trim(builder.String(), "_")
	if sanitized == "" {
		return "unknown"
	}
	if len(sanitized) > 48 {
		sanitized = sanitized[:48]
	}
	return sanitized
}
