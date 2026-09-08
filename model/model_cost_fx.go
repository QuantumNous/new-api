package model

import (
	"context"
	"errors"
	"fmt"
	"math"
	"strings"
	"sync"

	"github.com/QuantumNous/new-api/common"
	"gorm.io/gorm"
)

var (
	ErrModelCostFXUnavailable     = errors.New("model cost FX snapshot unavailable")
	ErrModelCostFXVersionConflict = errors.New("model cost FX snapshot version conflict")
	ErrModelCostFXStale           = errors.New("model cost FX snapshot is stale")
)

// ModelCostFXRow stores the current market FX publication for model pricing.
// RatesJSON is normalized JSON text.
type ModelCostFXRow struct {
	Source      string `json:"source" gorm:"primaryKey;size:64"`
	EffectiveAt int64  `json:"effective_at"`
	FetchedAt   int64  `json:"fetched_at"`
	Version     int64  `json:"version"`
	RatesJSON   string `json:"rates_json" gorm:"type:text"`
}

func (ModelCostFXRow) TableName() string {
	return "model_cost_fx"
}

// ModelCostFXSnapshot is the validated in-memory representation of a
// publication. Rates are expressed as units of the target currency per one
// unit of the source currency.
type ModelCostFXSnapshot struct {
	Source      string
	EffectiveAt int64
	FetchedAt   int64
	Version     int64
	Rates       map[string]float64
}

var modelCostFXState struct {
	sync.RWMutex
	snapshots map[string]ModelCostFXSnapshot
}

// normalizeModelCostFXSnapshot validates, normalizes currency keys, and returns an owned
// copy. Keeping this at the persistence boundary prevents invalid data from
// reaching either the database or the shared in-memory state.
func normalizeModelCostFXSnapshot(snapshot ModelCostFXSnapshot) (ModelCostFXSnapshot, error) {
	snapshot.Source = strings.ToLower(strings.TrimSpace(snapshot.Source))
	if snapshot.Source == "" {
		return ModelCostFXSnapshot{}, errors.New("model cost FX source is required")
	}
	for _, ch := range snapshot.Source {
		if (ch < 'a' || ch > 'z') && (ch < '0' || ch > '9') && ch != '.' && ch != '_' && ch != '-' {
			return ModelCostFXSnapshot{}, errors.New("model cost FX source must use lowercase ASCII identifier characters")
		}
	}
	if snapshot.EffectiveAt <= 0 || snapshot.FetchedAt <= 0 {
		return ModelCostFXSnapshot{}, errors.New("model cost FX timestamps must be positive")
	}
	if snapshot.Version < 0 {
		return ModelCostFXSnapshot{}, errors.New("model cost FX version must not be negative")
	}
	if len(snapshot.Rates) == 0 {
		return ModelCostFXSnapshot{}, errors.New("model cost FX rates must not be empty")
	}

	rates := make(map[string]float64, len(snapshot.Rates))
	for currency, rate := range snapshot.Rates {
		currency = strings.ToUpper(strings.TrimSpace(currency))
		if currency == "" {
			return ModelCostFXSnapshot{}, errors.New("model cost FX currency is required")
		}
		if _, exists := rates[currency]; exists {
			return ModelCostFXSnapshot{}, fmt.Errorf("duplicate model cost FX currency %q", currency)
		}
		if rate <= 0 || math.IsNaN(rate) || math.IsInf(rate, 0) {
			return ModelCostFXSnapshot{}, fmt.Errorf("invalid model cost FX rate for %q", currency)
		}
		rates[currency] = rate
	}
	snapshot.Rates = rates
	return snapshot, nil
}

func cloneModelCostFXSnapshot(snapshot ModelCostFXSnapshot) ModelCostFXSnapshot {
	copy := snapshot
	copy.Rates = make(map[string]float64, len(snapshot.Rates))
	for currency, rate := range snapshot.Rates {
		copy.Rates[currency] = rate
	}
	return copy
}

func publishModelCostFX(snapshot ModelCostFXSnapshot) {
	modelCostFXState.Lock()
	defer modelCostFXState.Unlock()
	if current, loaded := modelCostFXState.snapshots[snapshot.Source]; loaded &&
		(current.Version > snapshot.Version || (current.Version == snapshot.Version && current.FetchedAt >= snapshot.FetchedAt)) {
		return
	}
	if modelCostFXState.snapshots == nil {
		modelCostFXState.snapshots = make(map[string]ModelCostFXSnapshot)
	}
	modelCostFXState.snapshots[snapshot.Source] = cloneModelCostFXSnapshot(snapshot)
}

// CurrentModelCostFX returns the last successfully loaded publication without
// database or JSON access. The returned map is owned by the caller.
func CurrentModelCostFX(source string) (ModelCostFXSnapshot, error) {
	modelCostFXState.RLock()
	defer modelCostFXState.RUnlock()
	snapshot, loaded := modelCostFXState.snapshots[strings.ToLower(strings.TrimSpace(source))]
	if !loaded {
		return ModelCostFXSnapshot{}, ErrModelCostFXUnavailable
	}
	return cloneModelCostFXSnapshot(snapshot), nil
}

// LoadModelCostFX loads the durable publication and publishes it to RAM only
// after all fields and rates have been validated.
func LoadModelCostFX(ctx context.Context, source string) error {
	if err := ctx.Err(); err != nil {
		return err
	}
	if DB == nil {
		return errors.New("model cost FX database is unavailable")
	}
	var row ModelCostFXRow
	if err := DB.WithContext(ctx).Where("source = ?", strings.ToLower(strings.TrimSpace(source))).First(&row).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return ErrModelCostFXUnavailable
		}
		return fmt.Errorf("load model cost FX snapshot: %w", err)
	}
	var rates map[string]float64
	if err := common.UnmarshalJsonStr(row.RatesJSON, &rates); err != nil {
		return fmt.Errorf("decode model cost FX rates: %w", err)
	}
	snapshot, err := normalizeModelCostFXSnapshot(ModelCostFXSnapshot{
		Source: row.Source, EffectiveAt: row.EffectiveAt, FetchedAt: row.FetchedAt,
		Version: row.Version, Rates: rates,
	})
	if err != nil {
		return fmt.Errorf("validate model cost FX snapshot: %w", err)
	}
	publishModelCostFX(snapshot)
	return nil
}

// SaveModelCostFX conditionally writes one current publication. expectedVersion
// is zero for first creation; successful updates advance the stored version by
// one. RAM is changed only after the transaction commits.
func SaveModelCostFX(ctx context.Context, snapshot ModelCostFXSnapshot, expectedVersion int64) error {
	if err := ctx.Err(); err != nil {
		return err
	}
	if expectedVersion < 0 {
		return ErrModelCostFXVersionConflict
	}
	validated, err := normalizeModelCostFXSnapshot(snapshot)
	if err != nil {
		return err
	}
	if DB == nil {
		return errors.New("model cost FX database is unavailable")
	}

	encoded, err := common.Marshal(validated.Rates)
	if err != nil {
		return fmt.Errorf("encode model cost FX rates: %w", err)
	}
	err = DB.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		var row ModelCostFXRow
		query := lockForUpdate(tx).Where("source = ?", validated.Source).First(&row)
		if errors.Is(query.Error, gorm.ErrRecordNotFound) {
			if expectedVersion != 0 {
				return ErrModelCostFXVersionConflict
			}
			validated.Version = 1
			if createErr := tx.Create(&ModelCostFXRow{Source: validated.Source, EffectiveAt: validated.EffectiveAt, FetchedAt: validated.FetchedAt, Version: validated.Version, RatesJSON: string(encoded)}).Error; createErr != nil {
				return createErr
			}
			return nil
		}
		if query.Error != nil {
			return query.Error
		}
		if row.Version != expectedVersion {
			return ErrModelCostFXVersionConflict
		}
		if validated.EffectiveAt < row.EffectiveAt || (validated.EffectiveAt == row.EffectiveAt && validated.FetchedAt <= row.FetchedAt) {
			return ErrModelCostFXStale
		}
		if row.Version == math.MaxInt64 {
			return errors.New("model cost FX version exhausted")
		}
		validated.Version = row.Version + 1
		result := tx.Model(&ModelCostFXRow{}).Where("source = ? AND version = ?", validated.Source, expectedVersion).Updates(map[string]any{
			"effective_at": validated.EffectiveAt, "fetched_at": validated.FetchedAt,
			"version": validated.Version, "rates_json": string(encoded),
		})
		if result.Error != nil {
			return result.Error
		}
		if result.RowsAffected != 1 {
			return ErrModelCostFXVersionConflict
		}
		return nil
	})
	if err != nil {
		return err
	}
	publishModelCostFX(validated)
	return nil
}
