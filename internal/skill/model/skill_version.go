package skillmodel

import (
	"crypto/sha256"
	"encoding/hex"
	"time"

	"github.com/QuantumNous/new-api/common"
	enums "github.com/QuantumNous/new-api/internal/skill/enums"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

// SkillVersion is the DB model for the skill_versions table (DR-47, spec §4.2).
// It stores the immutable execution configuration for one version of a Skill.
//
// Schema deviations follow the same fork conventions as Skill (DR-40):
//   - id / skill_id: CHAR(36) not PG uuid (D1)
//   - JSON-like columns use SkillJSONB: TEXT on all DBs (these columns are not
//     queried by JSON content, so the PG jsonb upgrade applied to skills is not
//     needed here — kept as TEXT cross-DB for a leaner migration)
//   - created_by: BIGINT to match platform users.id (D3)
//
// R2/D-09: the published instruction_template is distributable (ships in the
// download package) and is NOT a confidentiality boundary. instruction_template_sha256
// is retained as a package/version integrity check, not a secrecy measure.
type SkillVersion struct {
	ID            string                   `gorm:"column:id;type:char(36);primaryKey;not null"`
	SkillID       string                   `gorm:"column:skill_id;type:char(36);not null;uniqueIndex:idx_skill_versions_skill_version,priority:1"`
	VersionNumber int                      `gorm:"column:version_number;not null;uniqueIndex:idx_skill_versions_skill_version,priority:2"`
	Status        enums.SkillVersionStatus `gorm:"column:status;type:varchar(32);not null;default:draft;check:chk_skill_versions_status,status IN ('draft','active','inactive','archived')"`

	InstructionTemplate       string  `gorm:"column:instruction_template;type:text;not null"`
	InstructionTemplateSHA256 string  `gorm:"column:instruction_template_sha256;type:char(64);not null"`
	PromptGuardTemplate       *string `gorm:"column:prompt_guard_template;type:text"`

	OutputSchema           SkillJSONB `gorm:"column:output_schema;type:text;not null"`
	ModelWhitelistSnapshot SkillJSONB `gorm:"column:model_whitelist_snapshot;type:text;not null"`
	RequiredPlanSnapshot   string     `gorm:"column:required_plan_snapshot;type:varchar(32);not null"`
	MonetizationSnapshot   SkillJSONB `gorm:"column:monetization_snapshot;type:text;not null"`
	MaxInputTokensSnapshot *int       `gorm:"column:max_input_tokens_snapshot;type:integer;check:chk_skill_versions_max_input_tokens,max_input_tokens_snapshot IS NULL OR max_input_tokens_snapshot > 0"`

	RolloutPercentage int     `gorm:"column:rollout_percentage;not null;default:100;check:chk_skill_versions_rollout,rollout_percentage BETWEEN 0 AND 100"`
	ExperimentName    *string `gorm:"column:experiment_name;type:varchar(128)"`

	CreatedBy   int64      `gorm:"column:created_by;type:bigint;not null"`
	CreatedAt   time.Time  `gorm:"column:created_at;not null;autoCreateTime"`
	ActivatedAt *time.Time `gorm:"column:activated_at"`
	ArchivedAt  *time.Time `gorm:"column:archived_at"`
}

func (SkillVersion) TableName() string { return "skill_versions" }

func (v *SkillVersion) BeforeCreate(tx *gorm.DB) error {
	if v.ID == "" {
		v.ID = uuid.New().String()
	}
	if v.InstructionTemplateSHA256 == "" {
		v.InstructionTemplateSHA256 = ComputeTemplateSHA256(v.InstructionTemplate)
	}
	// Object-shaped JSON columns must not canonicalize to "[]" (the array
	// default); seed them to "{}" when empty so the stored value is a valid
	// (empty) object rather than an empty array.
	normalizeSkillJSONBObject(&v.OutputSchema)
	normalizeSkillJSONBObject(&v.MonetizationSnapshot)
	normalizeSkillJSONB(&v.ModelWhitelistSnapshot)
	return nil
}

// normalizeSkillJSONBObject canonicalizes an empty object-shaped JSON column to
// "{}" (the SkillJSONB array default "[]" is wrong for object fields).
func normalizeSkillJSONBObject(j *SkillJSONB) {
	if len(*j) == 0 {
		*j = SkillJSONB("{}")
	}
}

// ComputeTemplateSHA256 returns the lowercase hex SHA-256 of the instruction
// template. Used by version creation (DR-47) and verified by the download
// package as an integrity check (R2/D-09).
func ComputeTemplateSHA256(template string) string {
	sum := sha256.Sum256([]byte(template))
	return hex.EncodeToString(sum[:])
}

// MonetizationSnapshotJSON builds the canonical monetization snapshot object
// captured on a Skill version (spec §10.4: snapshot monetization settings).
func MonetizationSnapshotJSON(monetizationType string, priceMarkup float64, freeQuotaPerMonth *int) SkillJSONB {
	payload := map[string]any{
		"monetization_type": monetizationType,
		"price_markup":      priceMarkup,
	}
	if freeQuotaPerMonth != nil {
		payload["free_quota_per_month"] = *freeQuotaPerMonth
	}
	b, err := common.Marshal(payload)
	if err != nil {
		return SkillJSONB("{}")
	}
	return SkillJSONB(b)
}
