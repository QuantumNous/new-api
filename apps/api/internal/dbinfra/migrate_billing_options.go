package dbinfra

import (
	"errors"
	"fmt"
	"strings"

	"github.com/QuantumNous/new-api/internal/common"
	"github.com/QuantumNous/new-api/internal/common/dbx"
	"gorm.io/gorm"
)

// Legacy top-level option keys that stored tiered billing configuration
// before the settings flattening moved it under billing_setting.*. Rows
// written by older builds under these keys are invisible to the current
// backend: the pricing editor reads the flattened keys, and tiered billing
// silently falls back to ratio billing without them.
const (
	legacyBillingModeOptionKey = "ModelBillingMode"
	legacyBillingExprOptionKey = "ModelBillingExpr"
)

// MigrateLegacyBillingOptions copies tiered billing maps persisted under the
// legacy ModelBillingMode/ModelBillingExpr option keys into the flattened
// billing_setting.billing_mode / billing_setting.billing_expr keys.
//
// Models already present in the flattened map keep the newer value; only
// models missing from it are copied over, so an instance that already saved
// new-style pricing never loses data. Unlike the retired frontend options
// migration, legacy rows are kept instead of deleted so a rollback to a build
// that still reads the old keys keeps working.
//
// Rollback caveat (kept rows are a tradeoff, not a free lunch): while an
// instance runs a pre-flattening binary it reads the stale legacy rows, and
// pricing edits made in that window are only imported for models missing
// from the flattened map (target values win). After any rollback, re-verify
// pricing in the editor before trusting tiered billing.
//
// Runs once at startup on the master node, before InitOptionMap loads rows
// into memory. Idempotent: a second run finds nothing new to copy.
func MigrateLegacyBillingOptions() error {
	if dbx.DB == nil {
		return errors.New("database is not initialized")
	}
	var errs []error
	if err := migrateLegacyBillingMap(
		"billing_setting.billing_mode", legacyBillingModeOptionKey,
	); err != nil {
		errs = append(errs, fmt.Errorf("billing mode: %w", err))
	}
	if err := migrateLegacyBillingMap(
		"billing_setting.billing_expr", legacyBillingExprOptionKey,
	); err != nil {
		errs = append(errs, fmt.Errorf("billing expression: %w", err))
	}
	return errors.Join(errs...)
}

func migrateLegacyBillingMap(targetKey, legacyKey string) error {
	return dbx.DB.Transaction(func(tx *gorm.DB) error {
		legacy, err := findOptionRow(tx, legacyKey, false)
		if err != nil {
			return err
		}
		if legacy == nil {
			return nil
		}
		legacyMap, err := parseStringMapOption(legacy.Value)
		if err != nil {
			// Malformed legacy data must not block startup; the row stays
			// for manual recovery.
			common.SysError(fmt.Sprintf(
				"legacy option %s was not migrated: %v", legacyKey, err))
			return nil
		}
		// An empty value is "not configured" at runtime (GetBillingMode
		// defaults to ratio, HasModelBillingConfig requires a non-blank
		// expression), so importing no-op entries would only pollute the
		// flattened map.
		dropEmptyMapEntries(legacyMap)
		if len(legacyMap) == 0 {
			return nil
		}
		return mergeLegacyIntoTarget(tx, targetKey, legacyKey, legacyMap)
	})
}

func mergeLegacyIntoTarget(
	tx *gorm.DB, targetKey, legacyKey string, legacyMap map[string]string,
) error {
	// Lock the target row (no-op on SQLite) so the read-modify-write
	// serializes against option PUTs that slave nodes commit against the
	// shared database while the master is still booting.
	target, err := findOptionRow(tx, targetKey, true)
	if err != nil {
		return err
	}
	targetMap, err := optionStringMap(target)
	if err != nil {
		// A corrupt target is newer than the legacy row; never let legacy
		// data overwrite it.
		common.SysError(fmt.Sprintf(
			"target option %s was not merged with legacy %s: %v",
			targetKey, legacyKey, err))
		return nil
	}

	merged := make(map[string]string, len(targetMap)+len(legacyMap))
	for model, value := range legacyMap {
		merged[model] = value
	}
	for model, value := range targetMap {
		merged[model] = value // newer values win over legacy ones
	}
	if len(merged) == len(targetMap) {
		return nil // legacy holds nothing the target lacks
	}
	return saveMergedOption(tx, target, targetKey, merged)
}

func saveMergedOption(
	tx *gorm.DB, target *Option, targetKey string, merged map[string]string,
) error {
	encoded, err := common.Marshal(merged)
	if err != nil {
		return fmt.Errorf("encode merged option %s: %w", targetKey, err)
	}
	row := target
	if row == nil {
		row = &Option{Key: targetKey}
	}
	row.Value = string(encoded)
	if err := tx.Save(row).Error; err != nil {
		return fmt.Errorf("write target option %s: %w", targetKey, err)
	}
	return nil
}

// findOptionRow returns the option row, or nil when absent. When lock is
// true the read takes a row lock (FOR UPDATE on MySQL/PostgreSQL, skipped on
// SQLite) that is held until the surrounding transaction ends.
func findOptionRow(tx *gorm.DB, key string, lock bool) (*Option, error) {
	query := tx.Where(&Option{Key: key})
	if lock {
		query = dbx.LockForUpdate(query)
	}
	var row Option
	err := query.First(&row).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("read option %s: %w", key, err)
	}
	return &row, nil
}

// optionStringMap parses an option row's value as a string map. A missing
// or blank value is an empty map rather than an error: the console PUT
// route applies no billing_setting validation, so an operator can persist
// an empty string, and that must not permanently block the legacy import.
func optionStringMap(row *Option) (map[string]string, error) {
	if row == nil || strings.TrimSpace(row.Value) == "" {
		return map[string]string{}, nil
	}
	return parseStringMapOption(row.Value)
}

func parseStringMapOption(value string) (map[string]string, error) {
	m := map[string]string{}
	if err := common.Unmarshal([]byte(value), &m); err != nil {
		return nil, err
	}
	return m, nil
}

func dropEmptyMapEntries(m map[string]string) {
	for key, value := range m {
		if value == "" {
			delete(m, key)
		}
	}
}
