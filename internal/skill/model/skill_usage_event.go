package skillmodel

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"strconv"
	"time"

	"github.com/QuantumNous/new-api/common"
	enums "github.com/QuantumNous/new-api/internal/skill/enums"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

// SkillUsageEvent records a Tier-1 platform event in skill_usage_events (tasks/03 §4.4).
//
// user_id and tenant_id store platform int64 IDs, not UUIDs (D1 deviation matching UES).
// For V1: tenant_id == user_id (no separate tenant entity). For Kids sessions
// (is_kids_session=true) BOTH user_id AND tenant_id must be nil — since V1 tenant_id
// equals user_id, writing either field persists the real child identifier.
// Use ApplyKidsSessionAnalyticsIdentity to set the HMAC pseudonymous session_id instead.
// event_id is CHAR(36) UUID generated at emit time.
// metadata stores SkillJSONB object; restricted keys (instruction_template, prompt, etc.)
// must never be written here — see spec rule in §4.4.
type SkillUsageEvent struct {
	EventID   string                    `gorm:"column:event_id;type:char(36);primaryKey;not null"`
	EventType enums.SkillUsageEventType `gorm:"column:event_type;type:varchar(64);not null"`
	// OccurredAt is the server-authoritative analytics time (UTC, DR-74 D2/D4).
	// Public / client / SDK / package-supplied timestamps must NEVER be copied into
	// this field; a non-zero value is reserved for trusted backend-internal producers
	// only. BeforeCreate normalizes it to UTC (zero -> time.Now().UTC()).
	OccurredAt time.Time `gorm:"column:occurred_at;not null"`

	UserID    *int64  `gorm:"column:user_id;type:bigint"`
	TenantID  *int64  `gorm:"column:tenant_id;type:bigint"`
	SessionID *string `gorm:"column:session_id;type:varchar(128)"`
	RequestID *string `gorm:"column:request_id;type:varchar(128)"`

	SkillID        *string          `gorm:"column:skill_id;type:char(36)"`
	SkillVersionID *string          `gorm:"column:skill_version_id;type:char(36)"`
	EntryPoint     enums.EntryPoint `gorm:"column:entry_point;type:varchar(64);not null;check:chk_sue_entry_point,entry_point IN ('marketplace_card','skill_detail','my_skills','saved_list','playground_picker','featured','popular','new','recommended','admin_preview','search_results','skill_package')"`

	Plan               *enums.RequiredPlan `gorm:"column:plan;type:varchar(32)"`
	SubscriptionStatus *string             `gorm:"column:subscription_status;type:varchar(32)"`
	Persona            *string             `gorm:"column:persona;type:varchar(64)"`
	PersonaSource      *string             `gorm:"column:persona_source;type:varchar(64)"`

	Model                *string `gorm:"column:model;type:varchar(128)"`
	IsKidsSession        bool    `gorm:"column:is_kids_session;not null;default:false"`
	IsKidsSafeSkill      *bool   `gorm:"column:is_kids_safe_skill"`
	IsKidsExclusiveSkill *bool   `gorm:"column:is_kids_exclusive_skill"`

	InputTokens  *int `gorm:"column:input_tokens;type:integer;check:chk_sue_input_tokens,input_tokens IS NULL OR input_tokens >= 0"`
	OutputTokens *int `gorm:"column:output_tokens;type:integer;check:chk_sue_output_tokens,output_tokens IS NULL OR output_tokens >= 0"`
	TotalTokens  *int `gorm:"column:total_tokens;type:integer;check:chk_sue_total_tokens,total_tokens IS NULL OR total_tokens >= 0"`
	LatencyMS    *int `gorm:"column:latency_ms;type:integer;check:chk_sue_latency_ms,latency_ms IS NULL OR latency_ms >= 0"`

	Success       *bool              `gorm:"column:success"`
	FailureReason *string            `gorm:"column:failure_reason;type:varchar(128)"`
	BlockReason   *enums.BlockReason `gorm:"column:block_reason;type:varchar(64);check:chk_sue_block_reason,block_reason IS NULL OR block_reason IN ('auth_required','skill_not_found','skill_not_published','skill_not_enabled','plan_required','subscription_inactive','quota_exceeded','kids_mode_blocked','context_too_long','rate_limited','timeout','safety_violation','internal_error','evaluation_not_passed')"`
	ErrorCode     *string            `gorm:"column:error_code;type:varchar(64)"`

	TimeoutOccurred         bool `gorm:"column:timeout_occurred;not null;default:false"`
	PromptInjectionDetected bool `gorm:"column:prompt_injection_detected;not null;default:false"`
	SafetyViolationDetected bool `gorm:"column:safety_violation_detected;not null;default:false"`

	Metadata SkillJSONB `gorm:"column:metadata;type:text;not null"`
}

// SkillEventSchemaVersion is the V1 analytics event contract version stamped into
// every skill_usage_events row at metadata.schema_version (DR-74). V1 is single-schema:
// the canonical DDL (tasks/03 §4.4) has no first-class column and there is no
// reader-side multi-version migration, so only this exact value may persist.
const SkillEventSchemaVersion = "1.0"

var restrictedSUEMetadataKeys = map[string]struct{}{
	"instruction_template": {},
	"prompt":               {},
	"system_prompt":        {},
	"raw_messages":         {},
	"provider_payload":     {},
	"kids_raw_input":       {},
	"full_user_input":      {},
	"raw_output":           {},
	"model_output":         {},
}

func (SkillUsageEvent) TableName() string { return "skill_usage_events" }

func (e *SkillUsageEvent) BeforeCreate(tx *gorm.DB) error {
	normalizeSkillJSONBObject(&e.Metadata)
	if err := validateSUEEventMetadata(e.Metadata); err != nil {
		return err
	}
	// DR-74: stamp metadata.schema_version on every event (single choke point).
	// Runs after validateSUEEventMetadata so the metadata is known to be an object.
	stamped, err := ensureMetadataSchemaVersion(e.Metadata)
	if err != nil {
		return err
	}
	e.Metadata = stamped
	if err := validateSUEKidsSessionPrivacy(e); err != nil {
		return err
	}
	// DR-74: occurred_at is server-authoritative UTC. Zero -> now (UTC); a non-zero
	// (trusted server-side producer) timestamp is normalized to UTC. Public/client-facing
	// handlers must never map a client-provided timestamp into OccurredAt (see DR-74 D2/D4).
	if e.OccurredAt.IsZero() {
		e.OccurredAt = time.Now().UTC()
	} else {
		e.OccurredAt = e.OccurredAt.UTC()
	}
	return nil
}

// ensureMetadataSchemaVersion enforces the DR-74 V1 schema_version contract on an
// already-validated metadata object: absent -> set SkillEventSchemaVersion; equal to
// SkillEventSchemaVersion -> keep; empty, non-string, or any other value -> reject.
// V1 is single-schema (no reader-side multi-version migration), so mixed schemas must
// not land in skill_usage_events.
func ensureMetadataSchemaVersion(meta SkillJSONB) (SkillJSONB, error) {
	var obj map[string]any
	if err := common.Unmarshal(meta, &obj); err != nil {
		return nil, fmt.Errorf("skill_usage_events: invalid metadata JSON: %w", err)
	}
	if obj == nil {
		obj = map[string]any{}
	}
	if raw, ok := obj["schema_version"]; ok {
		sv, isStr := raw.(string)
		if !isStr || sv != SkillEventSchemaVersion {
			return nil, fmt.Errorf("skill_usage_events: metadata.schema_version must be %q (V1), got %v", SkillEventSchemaVersion, raw)
		}
		return meta, nil // already the V1 version; no re-marshal needed
	}
	obj["schema_version"] = SkillEventSchemaVersion
	out, err := common.Marshal(obj)
	if err != nil {
		return nil, fmt.Errorf("skill_usage_events: marshal metadata with schema_version: %w", err)
	}
	return SkillJSONB(out), nil
}

// validateSUEEventMetadata is the authoritative recursive guard against restricted
// metadata keys. The DB CHECK constraint (chk_sue_metadata_no_restricted_keys) only
// checks top-level JSON paths; this function must always run first via BeforeCreate.
func validateSUEEventMetadata(metadata SkillJSONB) error {
	var decoded any
	if err := common.Unmarshal(metadata, &decoded); err != nil {
		return fmt.Errorf("skill_usage_events: invalid metadata JSON: %w", err)
	}
	if _, ok := decoded.(map[string]any); !ok {
		return fmt.Errorf("skill_usage_events: metadata must be a JSON object")
	}
	if key, ok := jsonContainsRestrictedMetadataKey(decoded); ok {
		return fmt.Errorf("skill_usage_events: metadata must not contain %s", key)
	}
	return nil
}

func jsonContainsRestrictedMetadataKey(v any) (string, bool) {
	switch typed := v.(type) {
	case map[string]any:
		for k, child := range typed {
			if _, restricted := restrictedSUEMetadataKeys[k]; restricted {
				return k, true
			}
			if key, restricted := jsonContainsRestrictedMetadataKey(child); restricted {
				return key, true
			}
		}
	case []any:
		for _, child := range typed {
			if key, restricted := jsonContainsRestrictedMetadataKey(child); restricted {
				return key, true
			}
		}
	}
	return "", false
}

func validateSUEKidsSessionPrivacy(e *SkillUsageEvent) error {
	if !e.IsKidsSession {
		return nil
	}
	if e.UserID != nil {
		return fmt.Errorf("skill_usage_events: kids session analytics must not store user_id")
	}
	// V1: tenant_id == user_id, so persisting tenant_id leaks the real child identifier.
	if e.TenantID != nil {
		return fmt.Errorf("skill_usage_events: kids session analytics must not store tenant_id")
	}
	if e.SessionID == nil || *e.SessionID == "" {
		return fmt.Errorf("skill_usage_events: kids session analytics requires pseudonymous session_id")
	}
	return nil
}

func KidsSessionPseudoID(userID, tenantID int64, saltVersion string, dailySalt []byte) (string, error) {
	if saltVersion == "" {
		return "", fmt.Errorf("skill_usage_events: kids salt_version is required")
	}
	if len(dailySalt) == 0 {
		return "", fmt.Errorf("skill_usage_events: kids daily_salt is required")
	}
	h := hmac.New(sha256.New, dailySalt)
	h.Write([]byte(strconv.FormatInt(userID, 10)))
	h.Write([]byte(":"))
	h.Write([]byte(strconv.FormatInt(tenantID, 10)))
	h.Write([]byte(":"))
	h.Write([]byte(saltVersion))
	return hex.EncodeToString(h.Sum(nil)), nil
}

// ApplyKidsSessionAnalyticsIdentity anonymizes identity fields for a Kids session event.
// Both user_id and tenant_id are cleared (V1: tenant_id == user_id, so either field
// would persist the real child identifier). The tenantID parameter contributes to the
// HMAC pseudo-ID computation but is never stored directly.
func (e *SkillUsageEvent) ApplyKidsSessionAnalyticsIdentity(realUserID, tenantID int64, saltVersion string, dailySalt []byte) error {
	sessionID, err := KidsSessionPseudoID(realUserID, tenantID, saltVersion, dailySalt)
	if err != nil {
		return err
	}
	e.UserID = nil
	e.TenantID = nil
	e.SessionID = &sessionID
	e.IsKidsSession = true
	return nil
}

// EmitSkillEnabled inserts a skill_enabled event (tasks/03 §4.4, §8.2).
// skillVersionID may be nil until DR-41 (skill_versions) is implemented.
// entryPoint must be a valid enums.EntryPoint string value.
// plan is the runner's resolved plan (free/pro/enterprise) — i.e. the downloading
// user's own plan, NOT the skill's required_plan (see download.go: groupToPlan(group)).
// On error the caller should log but must not block the user-facing response.
// EmitSkillUsageEvent is the common write path for skill_usage_events.
// It fills event_id/occurred_at when absent and relies on BeforeCreate for
// object-shaped metadata normalization, restricted-key validation,
// DR-74 schema_version stamping, and UTC occurred_at normalization.
func EmitSkillUsageEvent(db *gorm.DB, event SkillUsageEvent) error {
	if !event.EventType.Valid() {
		return fmt.Errorf("skill_usage_events: invalid event_type %q", event.EventType)
	}
	if !event.EntryPoint.Valid() {
		return fmt.Errorf("skill_usage_events: invalid entry_point %q", event.EntryPoint)
	}
	if event.Plan != nil && !event.Plan.Valid() {
		return fmt.Errorf("skill_usage_events: invalid plan %q", *event.Plan)
	}
	if event.BlockReason != nil && !event.BlockReason.Valid() {
		return fmt.Errorf("skill_usage_events: invalid block_reason %q", *event.BlockReason)
	}
	if event.EventID == "" {
		event.EventID = uuid.New().String()
	}
	if event.OccurredAt.IsZero() {
		event.OccurredAt = time.Now().UTC()
	}
	return db.Create(&event).Error
}

// EmitSkillEnabled inserts a skill_enabled event.
func EmitSkillEnabled(db *gorm.DB, userID int64, skillID string, skillVersionID *string, entryPoint, plan string) error {
	uid := userID
	resolvedPlan := enums.RequiredPlan(plan)
	successVal := true
	return EmitSkillUsageEvent(db, SkillUsageEvent{
		EventType:      enums.SkillUsageEventTypeEnabled,
		UserID:         &uid,
		TenantID:       &uid,
		SkillID:        &skillID,
		SkillVersionID: skillVersionID,
		EntryPoint:     enums.EntryPoint(entryPoint),
		Plan:           &resolvedPlan,
		IsKidsSession:  false,
		Success:        &successVal,
		Metadata:       SkillJSONB(`{}`),
	})
}
