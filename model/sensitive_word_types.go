package model

import (
	"errors"
	"time"

	"github.com/QuantumNous/new-api/common"
	"gorm.io/gorm"
	"gorm.io/gorm/schema"
)

const (
	SensitiveWordScopeGlobal    = "global"
	SensitiveWordScopeGroup     = "group"
	SensitiveWordModeBlock      = "block"
	SensitiveWordModeObserve    = "observe"
	SensitiveWordModeOff        = "off"
	SensitiveWordLogAction      = "sensitive_word_block"
	SensitiveWordBanThreshold   = 50
	SensitiveWordMaxRunes       = 200
	SensitiveWordMaxPromptRunes = 65_536
	SensitiveWordMaxPromptBytes = 512 * 1024
	SensitiveWordMaxRules       = 10_000

	sensitiveWordMigrationKey   = "SensitiveWordRulesMigrationVersion"
	sensitiveWordMigrationValue = "2"
)

var (
	ErrSensitiveWordAuditPersistence  = errors.New("sensitive word audit persistence failed")
	ErrSensitiveWordPolicyUnavailable = errors.New("sensitive word policy unavailable")
)

// SensitiveWordAuditPrompt uses MEDIUMTEXT on MySQL because the configured
// UTF-8 byte ceiling is intentionally larger than a TEXT column.
type SensitiveWordAuditPrompt string

func sensitiveWordAuditPromptDBType(dialect string) string {
	if dialect == string(common.DatabaseTypeMySQL) {
		return "mediumtext"
	}
	return "text"
}

func (SensitiveWordAuditPrompt) GormDBDataType(db *gorm.DB, _ *schema.Field) string {
	if db != nil && db.Dialector != nil {
		return sensitiveWordAuditPromptDBType(db.Dialector.Name())
	}
	return "text"
}

type SensitiveWordRule struct {
	ID   int64  `json:"id" gorm:"primaryKey"`
	Name string `json:"name" gorm:"type:varchar(64);not null;default:'';index"`
	// Word and Enabled are migration-only compatibility columns. Runtime code
	// reads Words and Mode exclusively after the one-way migration marker.
	Word  string `json:"-" gorm:"type:varchar(200);not null"`
	Scope string `json:"scope" gorm:"type:varchar(16);not null;index"`
	// Mode intentionally remains nullable in the schema. A NULL value marks a
	// pre-mode legacy row, which the one-way migration maps from Enabled to its
	// original block/off behavior before any request can use it.
	Mode      string                   `json:"mode" gorm:"type:varchar(16);index"`
	Enabled   bool                     `json:"-" gorm:"not null"`
	CreatedBy int                      `json:"created_by" gorm:"index"`
	Version   int64                    `json:"version" gorm:"not null;default:1"`
	CreatedAt time.Time                `json:"created_at"`
	UpdatedAt time.Time                `json:"updated_at"`
	Groups    []SensitiveWordRuleGroup `json:"groups,omitempty" gorm:"foreignKey:RuleID;constraint:OnDelete:CASCADE"`
	Words     []SensitiveWordRuleWord  `json:"-" gorm:"foreignKey:RuleID;constraint:OnDelete:CASCADE"`
}

type SensitiveWordRuleWord struct {
	ID             int64     `json:"id" gorm:"primaryKey"`
	RuleID         int64     `json:"rule_id" gorm:"not null;index;uniqueIndex:idx_sensitive_rule_word"`
	Word           string    `json:"word" gorm:"type:text;not null"`
	NormalizedHash string    `json:"-" gorm:"type:char(64);not null;uniqueIndex:idx_sensitive_rule_word"`
	CreatedAt      time.Time `json:"created_at"`
}

type SensitiveWordRuleGroup struct {
	RuleID    int64  `json:"rule_id" gorm:"primaryKey"`
	GroupName string `json:"group_name" gorm:"type:varchar(64);primaryKey;index"`
}

type SensitiveWordRuleSummary struct {
	ID        int64     `json:"id"`
	Name      string    `json:"name"`
	Scope     string    `json:"scope"`
	Mode      string    `json:"mode"`
	Groups    []string  `json:"groups"`
	WordCount int       `json:"word_count"`
	CreatedBy int       `json:"created_by"`
	Version   int64     `json:"version"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

type SensitiveWordRuleDetail struct {
	SensitiveWordRuleSummary
	Words []string `json:"words"`
}

type SensitiveWordPolicy struct {
	ID int64 `json:"id" gorm:"primaryKey"`
	// Defaults are materialized by defaultSensitiveWordPolicy. GORM omits a
	// false value on struct Create when a default:true tag is present, which
	// would corrupt an explicitly disabled legacy setting during migration.
	Enabled                 bool      `json:"enabled" gorm:"not null"`
	CheckPrompt             bool      `json:"check_prompt" gorm:"not null"`
	RetainFullPrompt        bool      `json:"retain_full_prompt" gorm:"not null"`
	BlockMessage            string    `json:"block_message" gorm:"type:text;not null"`
	BanThreshold            int       `json:"ban_threshold" gorm:"not null;default:50"`
	FullPromptRetentionDays int       `json:"full_prompt_retention_days" gorm:"not null;default:180"`
	MaxPromptRunes          int       `json:"max_prompt_runes" gorm:"not null;default:65536"`
	Version                 int64     `json:"version" gorm:"not null;default:1"`
	UpdatedBy               int       `json:"updated_by" gorm:"index"`
	CreatedAt               time.Time `json:"created_at"`
	UpdatedAt               time.Time `json:"updated_at"`
}

func (SensitiveWordPolicy) TableName() string { return "sensitive_word_policy" }

type SensitiveWordAuditEvent struct {
	ID                int64                    `json:"id" gorm:"primaryKey"`
	RequestID         string                   `json:"request_id" gorm:"type:varchar(128);index:idx_sensitive_word_audit_request"`
	UserID            int                      `json:"user_id" gorm:"index"`
	UsernameSnapshot  string                   `json:"username_snapshot"`
	TokenID           int                      `json:"token_id" gorm:"index"`
	TokenNameSnapshot string                   `json:"token_name_snapshot"`
	GroupName         string                   `json:"group_name" gorm:"index"`
	ModelName         string                   `json:"model_name" gorm:"index"`
	Endpoint          string                   `json:"endpoint"`
	Protocol          string                   `json:"protocol"`
	PromptHash        string                   `json:"prompt_hash" gorm:"type:char(64);index"`
	RedactedPreview   string                   `json:"redacted_preview" gorm:"type:text"`
	FullPrompt        SensitiveWordAuditPrompt `json:"full_prompt"`
	MatchedRuleIDs    string                   `json:"matched_rule_ids" gorm:"type:text"`
	MatchedRuleNames  string                   `json:"matched_rule_names" gorm:"type:text"`
	MatchedWords      string                   `json:"matched_words" gorm:"type:text"`
	MatchedSnippets   string                   `json:"matched_snippets" gorm:"type:text"`
	MatchedScope      string                   `json:"matched_scope" gorm:"type:varchar(16);index"`
	WhitelistBypassed bool                     `json:"whitelist_bypassed" gorm:"index"`
	Blocked           bool                     `json:"blocked" gorm:"index"`
	ViolationCount    int                      `json:"violation_count"`
	AutoBanned        bool                     `json:"auto_banned"`
	ObserveOnly       bool                     `json:"observe_only"`
	UserStatusBefore  int                      `json:"user_status_before"`
	UserStatusAfter   int                      `json:"user_status_after"`
	QuotaBefore       int                      `json:"quota_before"`
	QuotaAfter        int                      `json:"quota_after"`
	RuleVersion       int64                    `json:"rule_version"`
	CreatedAt         time.Time                `json:"created_at" gorm:"index"`
}

type SensitiveCheckInput struct {
	RequestID string
	UserID    int
	Username  string
	TokenID   int
	TokenName string
	GroupName string
	ModelName string
	Endpoint  string
	Protocol  string
	Prompt    string
}

type SensitiveCheckResult struct {
	Matched           bool
	Blocked           bool
	WhitelistBypassed bool
	AutoBanned        bool
	ViolationCount    int
	MatchedWords      []string
	MatchedRuleIDs    []int64
	MatchedRuleNames  []string
	MatchedScope      string
	AuditID           int64
	Message           string
	UserStatusBefore  int
	UserStatusAfter   int
	QuotaBefore       int
	QuotaAfter        int
	ObserveOnly       bool
	MatchedRuleModes  []string
}

type SensitiveWordEnableResetResult struct {
	UserID               int   `json:"user_id"`
	StatusBefore         int   `json:"status_before"`
	StatusAfter          int   `json:"status_after"`
	ViolationCountBefore int   `json:"violation_count_before"`
	ViolationCountAfter  int   `json:"violation_count_after"`
	AuthVersionBefore    int64 `json:"auth_version_before"`
	AuthVersionAfter     int64 `json:"auth_version_after"`
	QuotaBefore          int   `json:"quota_before"`
	QuotaAfter           int   `json:"quota_after"`
	UsedQuotaBefore      int   `json:"used_quota_before"`
	UsedQuotaAfter       int   `json:"used_quota_after"`
	StatusChanged        bool  `json:"status_changed"`
	ViolationCountReset  bool  `json:"violation_count_reset"`
	SessionsRevoked      int64 `json:"sessions_revoked"`
}

type legacySensitiveWordConfig struct {
	Enabled                 bool   `json:"enabled"`
	CheckPrompt             *bool  `json:"check_prompt"`
	AuditEnabled            bool   `json:"audit_enabled"`
	BlockMessage            string `json:"block_message"`
	BanThreshold            int    `json:"ban_threshold"`
	FullPromptRetentionDays int    `json:"full_prompt_retention_days"`
	MaxPromptRunes          int    `json:"max_prompt_runes"`
	RuleVersion             int64  `json:"rule_version"`
}
