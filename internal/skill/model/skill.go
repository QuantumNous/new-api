package skillmodel

import (
	"database/sql/driver"
	"encoding/json"
	"fmt"
	"time"

	enums "github.com/QuantumNous/new-api/internal/skill/enums"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

// SkillJSONB is a []byte that serializes as a JSON string in the DB.
// PG columns are upgraded to jsonb post-migrate; MySQL/SQLite keep TEXT.
// Empty value canonicalizes to "[]". V1 validates JSON syntax only —
// top-level array shape is NOT enforced (D6 disclosure).
type SkillJSONB []byte

func (j SkillJSONB) Value() (driver.Value, error) {
	if len(j) == 0 {
		return "[]", nil
	}
	if !json.Valid(j) {
		return nil, fmt.Errorf("SkillJSONB: invalid JSON")
	}
	return string(j), nil
}

func (j *SkillJSONB) Scan(value any) error {
	var raw []byte
	switch v := value.(type) {
	case []byte:
		raw = append(raw, v...)
	case string:
		raw = []byte(v)
	case nil:
		*j = []byte("[]")
		return nil
	default:
		return fmt.Errorf("SkillJSONB: unsupported scan type %T", value)
	}
	if len(raw) == 0 {
		raw = []byte("[]")
	}
	if !json.Valid(raw) {
		return fmt.Errorf("SkillJSONB: invalid JSON from DB")
	}
	*j = raw
	return nil
}

func normalizeSkillJSONB(j *SkillJSONB) {
	if len(*j) == 0 {
		*j = SkillJSONB("[]")
	}
}

// normalizeSkillJSONBObject sets j to {} if nil or empty — for object-shaped columns.
func normalizeSkillJSONBObject(j *SkillJSONB) {
	if len(*j) == 0 {
		*j = SkillJSONB("{}")
	}
}

// Skill is the DB model for the skills table.
// Schema deviations from PRD (see DR-40-PR-description.md §D1-D8):
//   - id: CHAR(36) not PG uuid (D1)
//   - JSON-like columns: TEXT on MySQL/SQLite, jsonb on PG post-migrate (D2)
//   - actor IDs: BIGINT not UUID (D3)
//   - instruction_template is NOT stored here (separate skill_versions table, DR-41)
type Skill struct {
	ID            string            `gorm:"column:id;type:char(36);primaryKey;not null"`
	Slug          string            `gorm:"column:slug;type:varchar(128);not null;uniqueIndex"`
	Status        enums.SkillStatus `gorm:"column:status;type:varchar(32);not null;default:draft;check:chk_skills_status,status IN ('draft','published','deprecated','archived')"`
	Category      string            `gorm:"column:category;type:varchar(64);not null"`
	Tags          SkillJSONB        `gorm:"column:tags;type:text;not null"`
	IconURL       *string           `gorm:"column:icon_url;type:text"`
	DefaultLocale string            `gorm:"column:default_locale;type:varchar(16);not null;default:en"`

	Name             string `gorm:"column:name;type:varchar(160);not null"`
	ShortDescription string `gorm:"column:short_description;type:varchar(280);not null"`
	Description      string `gorm:"column:description;type:text;not null"`

	InputHints     SkillJSONB `gorm:"column:input_hints;type:text;not null"`
	ExampleInputs  SkillJSONB `gorm:"column:example_inputs;type:text;not null"`
	ExampleOutputs SkillJSONB `gorm:"column:example_outputs;type:text;not null"`

	RequiredPlan      enums.RequiredPlan     `gorm:"column:required_plan;type:varchar(32);not null;check:chk_skills_required_plan,required_plan IN ('free','pro','enterprise')"`
	MonetizationType  enums.MonetizationType `gorm:"column:monetization_type;type:varchar(32);not null;check:chk_skills_monetization_type,monetization_type IN ('free','plan_included','token_markup')"`
	PriceMarkup       float64                `gorm:"column:price_markup;type:decimal(10,4);not null;default:0"`
	FreeQuotaPerMonth *int                   `gorm:"column:free_quota_per_month;type:integer;check:chk_skills_free_quota,free_quota_per_month IS NULL OR free_quota_per_month >= 0"`
	MaxInputTokens    *int                   `gorm:"column:max_input_tokens;type:integer;check:chk_skills_max_input_tokens,max_input_tokens IS NULL OR max_input_tokens > 0"`

	ModelWhitelist SkillJSONB `gorm:"column:model_whitelist;type:text;not null"`

	TimeoutSeconds int  `gorm:"column:timeout_seconds;not null;default:45;check:chk_skills_timeout_seconds,timeout_seconds BETWEEN 1 AND 120"`
	TimeoutRisk    bool `gorm:"column:timeout_risk;not null;default:false"`

	IsKidsSafe      bool `gorm:"column:is_kids_safe;not null;default:false"`
	IsKidsExclusive bool `gorm:"column:is_kids_exclusive;not null;default:false;check:chk_skills_kids_exclusive_requires_safe,is_kids_exclusive = false OR is_kids_safe = true"`

	KidsApprovalStatus             enums.KidsApprovalStatus `gorm:"column:kids_approval_status;type:varchar(32);not null;default:not_required;check:chk_skills_kids_approval_status,kids_approval_status IN ('not_required','pending','approved','emergency_approved','rejected','revoked')"`
	KidsApprovalActorID            *int64                   `gorm:"column:kids_approval_actor_id;type:bigint"`
	KidsApprovalAt                 *time.Time               `gorm:"column:kids_approval_at"`
	KidsEmergencyApprovalExpiresAt *time.Time               `gorm:"column:kids_emergency_approval_expires_at"`

	// AIDisclosureRequired default:true is declared as DB DDL.
	// Tests must use db.Omit("AIDisclosureRequired").Create() to verify the DB default,
	// not a Go zero-value struct (Go bool zero = false, which would override the DB default).
	AIDisclosureRequired bool `gorm:"column:ai_disclosure_required;not null;default:true"`

	FeaturedFlag bool `gorm:"column:featured_flag;not null;default:false"`
	FeaturedRank *int `gorm:"column:featured_rank;type:integer;check:chk_skills_featured_rank,featured_rank IS NULL OR featured_rank >= 0"`

	// ActiveVersionID references skill_versions.id (CHAR(36)) but carries no FK constraint (DR-41).
	ActiveVersionID *string `gorm:"column:active_version_id;type:char(36)"`

	// Actor IDs are BIGINT to match platform users.Id (int), not UUID (D3).
	CreatedBy int64  `gorm:"column:created_by;type:bigint;not null"`
	UpdatedBy *int64 `gorm:"column:updated_by;type:bigint"`

	CreatedAt    time.Time  `gorm:"column:created_at;not null;autoCreateTime"`
	UpdatedAt    time.Time  `gorm:"column:updated_at;not null;autoUpdateTime"`
	PublishedAt  *time.Time `gorm:"column:published_at"`
	DeprecatedAt *time.Time `gorm:"column:deprecated_at"`
	ArchivedAt   *time.Time `gorm:"column:archived_at"`
}

func (Skill) TableName() string { return "skills" }

func (s *Skill) BeforeCreate(tx *gorm.DB) error {
	if s.ID == "" {
		s.ID = uuid.New().String()
	}
	normalizeSkillJSONB(&s.Tags)
	normalizeSkillJSONB(&s.InputHints)
	normalizeSkillJSONB(&s.ExampleInputs)
	normalizeSkillJSONB(&s.ExampleOutputs)
	normalizeSkillJSONB(&s.ModelWhitelist)
	return nil
}
