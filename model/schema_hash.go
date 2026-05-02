package model

import (
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"reflect"
	"sort"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"gorm.io/gorm"
)

// schemaHashOptionKey is the Option table key under which we store the hash
// of the most recently migrated schema. On startup, we compare the current
// code's computed hash against this stored value to decide whether to call
// AutoMigrate (slow on remote DBs like Neon — 60-90s).
const schemaHashOptionKey = "SchemaMigrationHash"

// migrateModels returns the canonical list of models that participate in
// AutoMigrate. Keep this in sync with migrateDB() and migrateDBFast() in
// main.go — adding a model there but not here will cause unnecessary
// migration calls (annoying but safe); the reverse will skip migrating a
// new model (broken).
func migrateModels() []interface{} {
	return []interface{}{
		&Channel{}, &Token{}, &User{}, &PasskeyCredential{}, &Option{},
		&Redemption{}, &Ability{}, &Log{}, &Midjourney{}, &TopUp{},
		&QuotaData{}, &Task{}, &Model{}, &Vendor{}, &PrefillGroup{},
		&Setup{}, &TwoFA{}, &TwoFABackupCode{}, &Checkin{},
		&SubscriptionOrder{}, &UserSubscription{}, &SubscriptionPreConsumeRecord{},
		&CustomOAuthProvider{}, &UserOAuthBinding{}, &SubscriptionPlan{},
	}
}

// computeSchemaHash returns a stable 16-char hex hash of all migrate-target
// models' schemas. Captures field names, types, and `gorm`/`json` tags.
// Limitation: only walks one level deep — changes to fields inside an
// embedded struct (e.g. ChannelInfo's internal fields) won't trigger a
// hash change. If you change such inner types, run one boot with
// SKIP_AUTO_MIGRATION_HASH_CHECK=true to force re-migration.
func computeSchemaHash() string {
	parts := make([]string, 0, len(migrateModels()))
	for _, m := range migrateModels() {
		parts = append(parts, modelSignature(m))
	}
	sort.Strings(parts)
	sum := sha256.Sum256([]byte(strings.Join(parts, "|")))
	return hex.EncodeToString(sum[:])[:16]
}

func modelSignature(m interface{}) string {
	t := reflect.TypeOf(m)
	if t.Kind() == reflect.Ptr {
		t = t.Elem()
	}
	if t.Kind() != reflect.Struct {
		return t.String()
	}
	fields := make([]string, 0, t.NumField())
	for i := 0; i < t.NumField(); i++ {
		f := t.Field(i)
		gormTag := f.Tag.Get("gorm")
		jsonTag := f.Tag.Get("json")
		fields = append(fields, fmt.Sprintf("%s:%s:gorm=%q:json=%q", f.Name, f.Type.String(), gormTag, jsonTag))
	}
	sort.Strings(fields)
	return t.Name() + "{" + strings.Join(fields, ",") + "}"
}

// loadStoredSchemaHash reads the previously-recorded hash. Returns "" if
// the Option table doesn't exist yet (first boot) or no record is present
// — both treated as "must migrate".
func loadStoredSchemaHash(db *gorm.DB) string {
	var opt Option
	if err := db.Where("key = ?", schemaHashOptionKey).First(&opt).Error; err != nil {
		return ""
	}
	return opt.Value
}

func saveSchemaHash(db *gorm.DB, hash string) error {
	return db.Save(&Option{Key: schemaHashOptionKey, Value: hash}).Error
}

// shouldRunMigration decides whether to call AutoMigrate based on schema
// hash comparison. Side effect: logs the decision.
//
// Override mechanism for forcing/skipping:
//   - SKIP_AUTO_MIGRATION_HASH_CHECK=true → always run migration (safe escape hatch)
//   - FORCE_SKIP_AUTO_MIGRATION=true     → never run migration (ops-managed migration)
func shouldRunMigration(db *gorm.DB) (bool, string) {
	currentHash := computeSchemaHash()

	if common.GetEnvOrDefaultString("FORCE_SKIP_AUTO_MIGRATION", "") == "true" {
		common.SysLog(fmt.Sprintf("FORCE_SKIP_AUTO_MIGRATION=true — skipping migration (current hash: %s)", currentHash))
		return false, currentHash
	}
	if common.GetEnvOrDefaultString("SKIP_AUTO_MIGRATION_HASH_CHECK", "") == "true" {
		common.SysLog("SKIP_AUTO_MIGRATION_HASH_CHECK=true — running migration unconditionally")
		return true, currentHash
	}

	storedHash := loadStoredSchemaHash(db)
	if storedHash == "" {
		common.SysLog(fmt.Sprintf("no stored schema hash found, running migration (current hash: %s)", currentHash))
		return true, currentHash
	}
	if storedHash == currentHash {
		common.SysLog(fmt.Sprintf("schema hash unchanged (%s) — skipping migration", currentHash))
		return false, currentHash
	}
	common.SysLog(fmt.Sprintf("schema hash changed (%s → %s) — running migration", storedHash, currentHash))
	return true, currentHash
}
