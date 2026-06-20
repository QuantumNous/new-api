package skillmodel

import (
	"time"

	enums "github.com/QuantumNous/new-api/internal/skill/enums"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

// SkillVersion stores immutable execution configuration for a Skill.
// instruction_template intentionally lives only on this table, never on skills.
type SkillVersion struct {
	ID      string `gorm:"column:id;type:char(36);primaryKey;not null"`
	SkillID string `gorm:"column:skill_id;type:char(36);not null;uniqueIndex:idx_skill_versions_skill_version"`

	VersionNumber int                      `gorm:"column:version_number;not null;uniqueIndex:idx_skill_versions_skill_version"`
	Status        enums.SkillVersionStatus `gorm:"column:status;type:varchar(32);not null;default:draft;check:chk_skill_versions_status,status IN ('draft','active','inactive','archived')"`

	InstructionTemplate       string `gorm:"column:instruction_template;type:text;not null"`
	InstructionTemplateSHA256 string `gorm:"column:instruction_template_sha256;type:char(64);not null"`

	PromptGuardTemplate *string `gorm:"column:prompt_guard_template;type:text"`
	// OutputSchema is nullable: NULL means "no structured output schema" (PRD §4.2).
	// Callers must handle nil before unmarshaling.
	OutputSchema *SkillJSONB `gorm:"column:output_schema;type:text"`

	ModelWhitelistSnapshot SkillJSONB         `gorm:"column:model_whitelist_snapshot;type:text;not null"`
	RequiredPlanSnapshot   enums.RequiredPlan `gorm:"column:required_plan_snapshot;type:varchar(32);not null;check:chk_skill_versions_required_plan_snapshot,required_plan_snapshot IN ('free','pro','enterprise')"`
	// MonetizationSnapshot is an object (not an array): {} means "no monetization config".
	MonetizationSnapshot   SkillJSONB `gorm:"column:monetization_snapshot;type:text;not null"`
	MaxInputTokensSnapshot *int       `gorm:"column:max_input_tokens_snapshot;type:integer;check:chk_skill_versions_max_input_tokens_snapshot,max_input_tokens_snapshot IS NULL OR max_input_tokens_snapshot > 0"`

	RolloutPercentage int     `gorm:"column:rollout_percentage;not null;default:100;check:chk_skill_versions_rollout_percentage,rollout_percentage BETWEEN 0 AND 100"`
	ExperimentName    *string `gorm:"column:experiment_name;type:varchar(128)"`

	CreatedBy   int64      `gorm:"column:created_by;type:bigint;not null"`
	CreatedAt   time.Time  `gorm:"column:created_at;not null;autoCreateTime"`
	ActivatedAt *time.Time `gorm:"column:activated_at"`
	ArchivedAt  *time.Time `gorm:"column:archived_at"`

	Skill *Skill `gorm:"foreignKey:SkillID;references:ID;constraint:OnUpdate:RESTRICT,OnDelete:RESTRICT"`
}

func (SkillVersion) TableName() string { return "skill_versions" }

func (v *SkillVersion) BeforeCreate(tx *gorm.DB) error {
	if v.ID == "" {
		v.ID = uuid.New().String()
	}
	// output_schema: intentionally not normalized — nil stays nil (NULL in DB = no schema, PRD §4.2)
	normalizeSkillJSONB(&v.ModelWhitelistSnapshot)
	normalizeSkillJSONBObject(&v.MonetizationSnapshot) // object shape, not array
	return nil
}
