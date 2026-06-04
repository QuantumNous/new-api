package model

import "gorm.io/gorm"

const (
	AffiliateProfileStatusActive   = "active"
	AffiliateProfileStatusDisabled = "disabled"

	AffiliateRuleSetStatusDraft     = "draft"
	AffiliateRuleSetStatusPublished = "published"
	AffiliateRuleSetStatusArchived  = "archived"

	AffiliateEventStatusPending = "pending"
	AffiliateEventStatusReady   = "ready"
	AffiliateEventStatusSettled = "settled"
	AffiliateEventStatusVoid    = "void"

	AffiliateSettlementStatusDraft  = "draft"
	AffiliateSettlementStatusFrozen = "frozen"
	AffiliateSettlementStatusPaid   = "paid"
	AffiliateSettlementStatusVoid   = "void"

	AffiliateJobRunTypeSettlementPipeline = "settlement_pipeline"
	AffiliateJobRunTypeSettlementGenerate = "settlement_generate"

	AffiliateJobRunStatusRunning   = "running"
	AffiliateJobRunStatusSucceeded = "succeeded"
	AffiliateJobRunStatusFailed    = "failed"
)

type affiliateTableNamer interface {
	TableName() string
}

// AffiliateSidecarModels returns the native affiliate sidecar models.
// Do not add these to AutoMigrate until a local PostgreSQL baseline schema
// snapshot has been exported and schema impact review is ready.
func AffiliateSidecarModels() []interface{} {
	return []interface{}{
		&AffiliateProfile{},
		&AffiliateRelation{},
		&AffiliateInviteEvent{},
		&AffiliateAuditLog{},
		&AffiliateRuleSet{},
		&AffiliateCommissionRule{},
		&AffiliateCommissionTier{},
		&AffiliateKPITier{},
		&AffiliateHeadFeeRule{},
		&AffiliateRiskRule{},
		&AffiliateCommissionEvent{},
		&AffiliateHeadFeeEvent{},
		&AffiliateKPISnapshot{},
		&AffiliateSettlement{},
		&AffiliateJobRun{},
		&AffiliateConfigAuditLog{},
	}
}

func AffiliateSidecarTableNames() []string {
	models := AffiliateSidecarModels()
	names := make([]string, 0, len(models))
	for _, model := range models {
		if namer, ok := model.(affiliateTableNamer); ok {
			names = append(names, namer.TableName())
		}
	}
	return names
}

type AffiliateProfile struct {
	Id             int            `json:"id"`
	UserId         int            `json:"user_id" gorm:"uniqueIndex;not null"`
	Username       string         `json:"username" gorm:"-"`
	ParentUsername string         `json:"parent_username" gorm:"-"`
	Level          int            `json:"level" gorm:"type:int;not null;default:0;index"`
	Status         string         `json:"status" gorm:"type:varchar(32);not null;default:'active';index"`
	ParentUserId   int            `json:"parent_user_id" gorm:"type:int;not null;default:0;index"`
	InviteCode     string         `json:"invite_code" gorm:"type:varchar(32);default:'';index"`
	DisplayName    string         `json:"display_name" gorm:"type:varchar(64);default:''"`
	Remark         string         `json:"remark" gorm:"type:varchar(255);default:''"`
	ActivatedAt    int64          `json:"activated_at" gorm:"bigint;not null;default:0"`
	DisabledAt     int64          `json:"disabled_at" gorm:"bigint;not null;default:0"`
	CreatedAt      int64          `json:"created_at" gorm:"autoCreateTime;column:created_at"`
	UpdatedAt      int64          `json:"updated_at" gorm:"autoUpdateTime;column:updated_at"`
	DeletedAt      gorm.DeletedAt `json:"-" gorm:"index"`
}

func (AffiliateProfile) TableName() string {
	return "affiliate_profiles"
}

type AffiliateRelation struct {
	Id               int            `json:"id"`
	AncestorUserId   int            `json:"ancestor_user_id" gorm:"not null;index;uniqueIndex:idx_affiliate_relation_path,priority:1"`
	DescendantUserId int            `json:"descendant_user_id" gorm:"not null;index;uniqueIndex:idx_affiliate_relation_path,priority:2"`
	Depth            int            `json:"depth" gorm:"type:int;not null;default:1;index;uniqueIndex:idx_affiliate_relation_path,priority:3"`
	DirectInviterId  int            `json:"direct_inviter_id" gorm:"type:int;not null;default:0;index"`
	InviteEventId    int            `json:"invite_event_id" gorm:"type:int;not null;default:0;index"`
	Status           string         `json:"status" gorm:"type:varchar(32);not null;default:'active';index"`
	Source           string         `json:"source" gorm:"type:varchar(32);not null;default:'';index"`
	EffectiveAt      int64          `json:"effective_at" gorm:"bigint;not null;default:0;index"`
	EndedAt          int64          `json:"ended_at" gorm:"bigint;not null;default:0;index"`
	CreatedAt        int64          `json:"created_at" gorm:"autoCreateTime;column:created_at"`
	UpdatedAt        int64          `json:"updated_at" gorm:"autoUpdateTime;column:updated_at"`
	DeletedAt        gorm.DeletedAt `json:"-" gorm:"index"`
}

func (AffiliateRelation) TableName() string {
	return "affiliate_relations"
}

type AffiliateInviteEvent struct {
	Id                 int    `json:"id"`
	InviteeUserId      int    `json:"invitee_user_id" gorm:"not null;uniqueIndex"`
	InviterUserId      int    `json:"inviter_user_id" gorm:"not null;default:0;index"`
	InviteCode         string `json:"invite_code" gorm:"type:varchar(32);not null;default:'';index"`
	InviteSource       string `json:"invite_source" gorm:"type:varchar(32);not null;default:'none';index"`
	RegisterMethod     string `json:"register_method" gorm:"type:varchar(32);not null;default:'';index"`
	Provider           string `json:"provider" gorm:"type:varchar(64);not null;default:'';index"`
	RuleSetId          int    `json:"rule_set_id" gorm:"type:int;not null;default:0;index"`
	InitialQuota       int64  `json:"initial_quota" gorm:"bigint;not null;default:0"`
	InitialAmountCents int64  `json:"initial_amount_cents" gorm:"bigint;not null;default:0"`
	InitialQuotaRule   string `json:"initial_quota_rule" gorm:"type:varchar(64);not null;default:''"`
	Status             string `json:"status" gorm:"type:varchar(32);not null;default:'ready';index"`
	Metadata           string `json:"metadata" gorm:"type:text"`
	CreatedAt          int64  `json:"created_at" gorm:"autoCreateTime;column:created_at;index"`
}

func (AffiliateInviteEvent) TableName() string {
	return "affiliate_invite_events"
}

type AffiliateAuditLog struct {
	Id             int    `json:"id"`
	ActorUserId    int    `json:"actor_user_id" gorm:"not null;default:0;index"`
	TargetUserId   int    `json:"target_user_id" gorm:"not null;default:0;index"`
	TargetType     string `json:"target_type" gorm:"type:varchar(64);not null;default:'';index"`
	TargetId       int    `json:"target_id" gorm:"type:int;not null;default:0;index"`
	Action         string `json:"action" gorm:"type:varchar(64);not null;index"`
	BeforeSnapshot string `json:"before_snapshot" gorm:"type:text"`
	AfterSnapshot  string `json:"after_snapshot" gorm:"type:text"`
	Reason         string `json:"reason" gorm:"type:varchar(255);not null;default:''"`
	RequestId      string `json:"request_id" gorm:"type:varchar(64);not null;default:'';index"`
	Ip             string `json:"ip" gorm:"type:varchar(64);not null;default:''"`
	CreatedAt      int64  `json:"created_at" gorm:"autoCreateTime;column:created_at;index"`
}

func (AffiliateAuditLog) TableName() string {
	return "affiliate_audit_logs"
}

type AffiliateRuleSet struct {
	Id              int            `json:"id"`
	Version         string         `json:"version" gorm:"type:varchar(64);not null;uniqueIndex"`
	Name            string         `json:"name" gorm:"type:varchar(128);not null;default:''"`
	Status          string         `json:"status" gorm:"type:varchar(32);not null;default:'draft';index"`
	EffectiveStart  int64          `json:"effective_start" gorm:"bigint;not null;default:0;index"`
	EffectiveEnd    int64          `json:"effective_end" gorm:"bigint;not null;default:0;index"`
	PublishedAt     int64          `json:"published_at" gorm:"bigint;not null;default:0"`
	CreatedByUserId int            `json:"created_by_user_id" gorm:"type:int;not null;default:0;index"`
	UpdatedByUserId int            `json:"updated_by_user_id" gorm:"type:int;not null;default:0;index"`
	ConfigSnapshot  string         `json:"config_snapshot" gorm:"type:text"`
	CreatedAt       int64          `json:"created_at" gorm:"autoCreateTime;column:created_at"`
	UpdatedAt       int64          `json:"updated_at" gorm:"autoUpdateTime;column:updated_at"`
	DeletedAt       gorm.DeletedAt `json:"-" gorm:"index"`
}

func (AffiliateRuleSet) TableName() string {
	return "affiliate_rule_sets"
}

type AffiliateCommissionTier struct {
	Id                     int   `json:"id"`
	RuleSetId              int   `json:"rule_set_id" gorm:"not null;index;uniqueIndex:idx_affiliate_commission_tier,priority:1"`
	AffiliateLevel         int   `json:"affiliate_level" gorm:"type:int;not null;index;uniqueIndex:idx_affiliate_commission_tier,priority:2"`
	MinNetPaidAmountCents  int64 `json:"min_net_paid_amount_cents" gorm:"bigint;not null;default:0;uniqueIndex:idx_affiliate_commission_tier,priority:3"`
	MaxNetPaidAmountCents  int64 `json:"max_net_paid_amount_cents" gorm:"bigint;not null;default:0"`
	BaseRateBps            int   `json:"base_rate_bps" gorm:"type:int;not null;default:0"`
	CapRateBps             int   `json:"cap_rate_bps" gorm:"type:int;not null;default:0"`
	RequiresManualApproval bool  `json:"requires_manual_approval" gorm:"not null;default:false"`
	SortOrder              int   `json:"sort_order" gorm:"type:int;not null;default:0"`
	CreatedAt              int64 `json:"created_at" gorm:"autoCreateTime;column:created_at"`
	UpdatedAt              int64 `json:"updated_at" gorm:"autoUpdateTime;column:updated_at"`
}

type AffiliateCommissionRule struct {
	Id                       int    `json:"id"`
	RuleSetId                int    `json:"rule_set_id" gorm:"not null;index;uniqueIndex:idx_affiliate_commission_rule,priority:1"`
	AffiliateLevel           int    `json:"affiliate_level" gorm:"type:int;not null;index;uniqueIndex:idx_affiliate_commission_rule,priority:2"`
	Name                     string `json:"name" gorm:"type:varchar(64);not null;default:''"`
	Status                   string `json:"status" gorm:"type:varchar(32);not null;default:'active';index"`
	Currency                 string `json:"currency" gorm:"type:varchar(8);not null;default:'CNY'"`
	CalculationMode          string `json:"calculation_mode" gorm:"type:varchar(64);not null;default:'single_user_net_paid_tier'"`
	DefaultRateBps           int    `json:"default_rate_bps" gorm:"type:int;not null;default:0"`
	DefaultCapRateBps        int    `json:"default_cap_rate_bps" gorm:"type:int;not null;default:0"`
	AllowManualApprovalRate  bool   `json:"allow_manual_approval_rate" gorm:"not null;default:false"`
	MinSettlementAmountCents int64  `json:"min_settlement_amount_cents" gorm:"bigint;not null;default:0"`
	Metadata                 string `json:"metadata" gorm:"type:text"`
	CreatedAt                int64  `json:"created_at" gorm:"autoCreateTime;column:created_at"`
	UpdatedAt                int64  `json:"updated_at" gorm:"autoUpdateTime;column:updated_at"`
}

func (AffiliateCommissionRule) TableName() string {
	return "affiliate_commission_rules"
}

func (AffiliateCommissionTier) TableName() string {
	return "affiliate_commission_tiers"
}

type AffiliateKPITier struct {
	Id                       int    `json:"id"`
	RuleSetId                int    `json:"rule_set_id" gorm:"not null;index;uniqueIndex:idx_affiliate_kpi_tier,priority:1"`
	AffiliateLevel           int    `json:"affiliate_level" gorm:"type:int;not null;index;uniqueIndex:idx_affiliate_kpi_tier,priority:2"`
	Code                     string `json:"code" gorm:"type:varchar(32);not null;uniqueIndex:idx_affiliate_kpi_tier,priority:3"`
	Name                     string `json:"name" gorm:"type:varchar(64);not null;default:''"`
	MinEffectiveNewUsers     int    `json:"min_effective_new_users" gorm:"type:int;not null;default:0"`
	MinNetPaidAmountCents    int64  `json:"min_net_paid_amount_cents" gorm:"bigint;not null;default:0"`
	CoefficientBps           int    `json:"coefficient_bps" gorm:"type:int;not null;default:10000"`
	MaxGiftOnlyRatioBps      int    `json:"max_gift_only_ratio_bps" gorm:"type:int;not null;default:0"`
	MaxAbnormalRatioBps      int    `json:"max_abnormal_ratio_bps" gorm:"type:int;not null;default:0"`
	MinSecondPaymentRatioBps int    `json:"min_second_payment_ratio_bps" gorm:"type:int;not null;default:0"`
	SortOrder                int    `json:"sort_order" gorm:"type:int;not null;default:0"`
	CreatedAt                int64  `json:"created_at" gorm:"autoCreateTime;column:created_at"`
	UpdatedAt                int64  `json:"updated_at" gorm:"autoUpdateTime;column:updated_at"`
}

func (AffiliateKPITier) TableName() string {
	return "affiliate_kpi_tiers"
}

type AffiliateHeadFeeRule struct {
	Id                    int    `json:"id"`
	RuleSetId             int    `json:"rule_set_id" gorm:"not null;index;uniqueIndex:idx_affiliate_head_fee_rule,priority:1"`
	AffiliateLevel        int    `json:"affiliate_level" gorm:"type:int;not null;index;uniqueIndex:idx_affiliate_head_fee_rule,priority:2"`
	KPITierCode           string `json:"kpi_tier_code" gorm:"type:varchar(32);not null;uniqueIndex:idx_affiliate_head_fee_rule,priority:3"`
	Status                string `json:"status" gorm:"type:varchar(32);not null;default:'active';index"`
	AmountCents           int64  `json:"amount_cents" gorm:"bigint;not null;default:0"`
	FirstRechargeMinCents int64  `json:"first_recharge_min_cents" gorm:"bigint;not null;default:0"`
	PeriodNetPaidMinCents int64  `json:"period_net_paid_min_cents" gorm:"bigint;not null;default:0"`
	QualificationDays     int    `json:"qualification_days" gorm:"type:int;not null;default:14"`
	UnlockDelayDays       int    `json:"unlock_delay_days" gorm:"type:int;not null;default:7"`
	CreatedAt             int64  `json:"created_at" gorm:"autoCreateTime;column:created_at"`
	UpdatedAt             int64  `json:"updated_at" gorm:"autoUpdateTime;column:updated_at"`
}

func (AffiliateHeadFeeRule) TableName() string {
	return "affiliate_head_fee_rules"
}

type AffiliateRiskRule struct {
	Id                       int    `json:"id"`
	RuleSetId                int    `json:"rule_set_id" gorm:"not null;index;uniqueIndex:idx_affiliate_risk_rule,priority:1"`
	AffiliateLevel           int    `json:"affiliate_level" gorm:"type:int;not null;index;uniqueIndex:idx_affiliate_risk_rule,priority:2"`
	Code                     string `json:"code" gorm:"type:varchar(64);not null;uniqueIndex:idx_affiliate_risk_rule,priority:3"`
	MaxGiftOnlyRatioBps      int    `json:"max_gift_only_ratio_bps" gorm:"type:int;not null;default:0"`
	MaxAbnormalRatioBps      int    `json:"max_abnormal_ratio_bps" gorm:"type:int;not null;default:0"`
	MaxRefundRatioBps        int    `json:"max_refund_ratio_bps" gorm:"type:int;not null;default:0"`
	MinSecondPaymentRatioBps int    `json:"min_second_payment_ratio_bps" gorm:"type:int;not null;default:0"`
	SelfBrushStrategy        string `json:"self_brush_strategy" gorm:"type:varchar(64);not null;default:'exclude'"`
	BulkAbuseStrategy        string `json:"bulk_abuse_strategy" gorm:"type:varchar(64);not null;default:'manual_review'"`
	Action                   string `json:"action" gorm:"type:varchar(64);not null;default:'manual_review'"`
	Metadata                 string `json:"metadata" gorm:"type:text"`
	CreatedAt                int64  `json:"created_at" gorm:"autoCreateTime;column:created_at"`
	UpdatedAt                int64  `json:"updated_at" gorm:"autoUpdateTime;column:updated_at"`
}

func (AffiliateRiskRule) TableName() string {
	return "affiliate_risk_rules"
}

type AffiliateCommissionEvent struct {
	Id                               int    `json:"id"`
	AffiliateUserId                  int    `json:"affiliate_user_id" gorm:"not null;index"`
	DownstreamUserId                 int    `json:"downstream_user_id" gorm:"not null;index"`
	SourceLogId                      int    `json:"source_log_id" gorm:"type:int;not null;default:0;index"`
	SourceTopUpId                    int    `json:"source_top_up_id" gorm:"type:int;not null;default:0;index"`
	Kind                             string `json:"kind" gorm:"type:varchar(32);not null;default:'accrual';index"`
	Status                           string `json:"status" gorm:"type:varchar(32);not null;default:'pending';index"`
	RuleSetId                        int    `json:"rule_set_id" gorm:"not null;index"`
	KPISnapshotId                    int    `json:"kpi_snapshot_id" gorm:"type:int;not null;default:0;index"`
	SettlementId                     int    `json:"settlement_id" gorm:"type:int;not null;default:0;index"`
	PeriodStart                      int64  `json:"period_start" gorm:"bigint;not null;default:0;index"`
	PeriodEnd                        int64  `json:"period_end" gorm:"bigint;not null;default:0;index"`
	NetPaidConsumptionCents          int64  `json:"net_paid_consumption_cents" gorm:"bigint;not null;default:0"`
	RawQuota                         int64  `json:"raw_quota" gorm:"bigint;not null;default:0"`
	UserCumulativeNetPaidBeforeCents int64  `json:"user_cumulative_net_paid_before_cents" gorm:"bigint;not null;default:0"`
	UserCumulativeNetPaidAfterCents  int64  `json:"user_cumulative_net_paid_after_cents" gorm:"bigint;not null;default:0"`
	BaseRateBps                      int    `json:"base_rate_bps" gorm:"type:int;not null;default:0"`
	CapRateBps                       int    `json:"cap_rate_bps" gorm:"type:int;not null;default:0"`
	KPICoefficientBps                int    `json:"kpi_coefficient_bps" gorm:"type:int;not null;default:10000"`
	FinalRateBps                     int    `json:"final_rate_bps" gorm:"type:int;not null;default:0"`
	CommissionCents                  int64  `json:"commission_cents" gorm:"bigint;not null;default:0"`
	ClawbackOfEventId                int    `json:"clawback_of_event_id" gorm:"type:int;not null;default:0;index"`
	SyntheticMarker                  string `json:"synthetic_marker" gorm:"type:varchar(64);not null;default:'';index"`
	Metadata                         string `json:"metadata" gorm:"type:text"`
	CreatedAt                        int64  `json:"created_at" gorm:"autoCreateTime;column:created_at;index"`
	UpdatedAt                        int64  `json:"updated_at" gorm:"autoUpdateTime;column:updated_at"`
}

func (AffiliateCommissionEvent) TableName() string {
	return "affiliate_commission_events"
}

type AffiliateHeadFeeEvent struct {
	Id                 int    `json:"id"`
	AffiliateUserId    int    `json:"affiliate_user_id" gorm:"not null;index"`
	DownstreamUserId   int    `json:"downstream_user_id" gorm:"not null;index"`
	InviteEventId      int    `json:"invite_event_id" gorm:"type:int;not null;default:0;index"`
	RuleSetId          int    `json:"rule_set_id" gorm:"not null;index"`
	KPISnapshotId      int    `json:"kpi_snapshot_id" gorm:"type:int;not null;default:0;index"`
	SettlementId       int    `json:"settlement_id" gorm:"type:int;not null;default:0;index"`
	Status             string `json:"status" gorm:"type:varchar(32);not null;default:'pending';index"`
	AmountCents        int64  `json:"amount_cents" gorm:"bigint;not null;default:0"`
	FirstRechargeCents int64  `json:"first_recharge_cents" gorm:"bigint;not null;default:0"`
	NetPaidCents       int64  `json:"net_paid_cents" gorm:"bigint;not null;default:0"`
	QualificationDays  int    `json:"qualification_days" gorm:"type:int;not null;default:14"`
	SyntheticMarker    string `json:"synthetic_marker" gorm:"type:varchar(64);not null;default:'';index"`
	Metadata           string `json:"metadata" gorm:"type:text"`
	CreatedAt          int64  `json:"created_at" gorm:"autoCreateTime;column:created_at;index"`
	UpdatedAt          int64  `json:"updated_at" gorm:"autoUpdateTime;column:updated_at"`
}

func (AffiliateHeadFeeEvent) TableName() string {
	return "affiliate_head_fee_events"
}

type AffiliateKPISnapshot struct {
	Id                      int    `json:"id"`
	AffiliateUserId         int    `json:"affiliate_user_id" gorm:"not null;index;uniqueIndex:idx_affiliate_kpi_snapshot,priority:1"`
	RuleSetId               int    `json:"rule_set_id" gorm:"not null;index;uniqueIndex:idx_affiliate_kpi_snapshot,priority:4"`
	PeriodStart             int64  `json:"period_start" gorm:"bigint;not null;default:0;index;uniqueIndex:idx_affiliate_kpi_snapshot,priority:2"`
	PeriodEnd               int64  `json:"period_end" gorm:"bigint;not null;default:0;index;uniqueIndex:idx_affiliate_kpi_snapshot,priority:3"`
	EffectiveNewUserCount   int    `json:"effective_new_user_count" gorm:"type:int;not null;default:0"`
	NetPaidConsumptionCents int64  `json:"net_paid_consumption_cents" gorm:"bigint;not null;default:0"`
	PaidConsumptionRawQuota int64  `json:"paid_consumption_raw_quota" gorm:"bigint;not null;default:0"`
	GiftOnlyUserCount       int    `json:"gift_only_user_count" gorm:"type:int;not null;default:0"`
	AbnormalUserCount       int    `json:"abnormal_user_count" gorm:"type:int;not null;default:0"`
	GiftOnlyRatioBps        int    `json:"gift_only_ratio_bps" gorm:"type:int;not null;default:0"`
	AbnormalRatioBps        int    `json:"abnormal_ratio_bps" gorm:"type:int;not null;default:0"`
	SecondPaymentRatioBps   int    `json:"second_payment_ratio_bps" gorm:"type:int;not null;default:0"`
	TierCode                string `json:"tier_code" gorm:"type:varchar(32);not null;default:'';index"`
	CoefficientBps          int    `json:"coefficient_bps" gorm:"type:int;not null;default:10000"`
	Snapshot                string `json:"snapshot" gorm:"type:text"`
	SyntheticMarker         string `json:"synthetic_marker" gorm:"type:varchar(64);not null;default:'';index"`
	CreatedAt               int64  `json:"created_at" gorm:"autoCreateTime;column:created_at;index"`
	UpdatedAt               int64  `json:"updated_at" gorm:"autoUpdateTime;column:updated_at"`
}

func (AffiliateKPISnapshot) TableName() string {
	return "affiliate_kpi_snapshots"
}

type AffiliateSettlement struct {
	Id               int            `json:"id"`
	AffiliateUserId  int            `json:"affiliate_user_id" gorm:"not null;index;uniqueIndex:idx_affiliate_settlement_period,priority:1"`
	RuleSetId        int            `json:"rule_set_id" gorm:"not null;index;uniqueIndex:idx_affiliate_settlement_period,priority:4"`
	PeriodStart      int64          `json:"period_start" gorm:"bigint;not null;default:0;index;uniqueIndex:idx_affiliate_settlement_period,priority:2"`
	PeriodEnd        int64          `json:"period_end" gorm:"bigint;not null;default:0;index;uniqueIndex:idx_affiliate_settlement_period,priority:3"`
	Status           string         `json:"status" gorm:"type:varchar(32);not null;default:'draft';index"`
	CommissionCents  int64          `json:"commission_cents" gorm:"bigint;not null;default:0"`
	HeadFeeCents     int64          `json:"head_fee_cents" gorm:"bigint;not null;default:0"`
	DeductionCents   int64          `json:"deduction_cents" gorm:"bigint;not null;default:0"`
	PayableCents     int64          `json:"payable_cents" gorm:"bigint;not null;default:0"`
	FrozenUntil      int64          `json:"frozen_until" gorm:"bigint;not null;default:0;index"`
	PaidAt           int64          `json:"paid_at" gorm:"bigint;not null;default:0;index"`
	PaidByUserId     int            `json:"paid_by_user_id" gorm:"type:int;not null;default:0;index"`
	PaymentReference string         `json:"payment_reference" gorm:"type:varchar(128);not null;default:''"`
	Snapshot         string         `json:"snapshot" gorm:"type:text"`
	CreatedAt        int64          `json:"created_at" gorm:"autoCreateTime;column:created_at"`
	UpdatedAt        int64          `json:"updated_at" gorm:"autoUpdateTime;column:updated_at"`
	DeletedAt        gorm.DeletedAt `json:"-" gorm:"index"`
}

func (AffiliateSettlement) TableName() string {
	return "affiliate_settlements"
}

type AffiliateJobRun struct {
	Id                   int    `json:"id"`
	JobType              string `json:"job_type" gorm:"type:varchar(64);not null;default:'';index"`
	Status               string `json:"status" gorm:"type:varchar(32);not null;default:'running';index"`
	IdempotencyKey       string `json:"idempotency_key" gorm:"type:varchar(96);not null;default:'';index"`
	RuleSetId            int    `json:"rule_set_id" gorm:"type:int;not null;default:0;index"`
	PeriodStart          int64  `json:"period_start" gorm:"bigint;not null;default:0;index"`
	PeriodEnd            int64  `json:"period_end" gorm:"bigint;not null;default:0;index"`
	ActorUserId          int    `json:"actor_user_id" gorm:"type:int;not null;default:0;index"`
	CurrentStage         string `json:"current_stage" gorm:"type:varchar(64);not null;default:'';index"`
	LastCursorCreatedAt  int64  `json:"last_cursor_created_at" gorm:"bigint;not null;default:0"`
	LastCursorId         int    `json:"last_cursor_id" gorm:"type:int;not null;default:0"`
	KPISnapshotCount     int    `json:"kpi_snapshot_count" gorm:"type:int;not null;default:0"`
	CommissionEventCount int    `json:"commission_event_count" gorm:"type:int;not null;default:0"`
	HeadFeeEventCount    int    `json:"head_fee_event_count" gorm:"type:int;not null;default:0"`
	SettlementCount      int    `json:"settlement_count" gorm:"type:int;not null;default:0"`
	InputSnapshot        string `json:"input_snapshot" gorm:"type:text"`
	ResultSnapshot       string `json:"result_snapshot" gorm:"type:text"`
	ErrorMessage         string `json:"error_message" gorm:"type:text"`
	StartedAt            int64  `json:"started_at" gorm:"bigint;not null;default:0;index"`
	FinishedAt           int64  `json:"finished_at" gorm:"bigint;not null;default:0;index"`
	CreatedAt            int64  `json:"created_at" gorm:"autoCreateTime;column:created_at;index"`
	UpdatedAt            int64  `json:"updated_at" gorm:"autoUpdateTime;column:updated_at"`
}

func (AffiliateJobRun) TableName() string {
	return "affiliate_job_runs"
}

type AffiliateConfigAuditLog struct {
	Id             int    `json:"id"`
	ActorUserId    int    `json:"actor_user_id" gorm:"not null;default:0;index"`
	RuleSetId      int    `json:"rule_set_id" gorm:"type:int;not null;default:0;index"`
	Action         string `json:"action" gorm:"type:varchar(64);not null;index"`
	BeforeSnapshot string `json:"before_snapshot" gorm:"type:text"`
	AfterSnapshot  string `json:"after_snapshot" gorm:"type:text"`
	Reason         string `json:"reason" gorm:"type:varchar(255);not null;default:''"`
	RequestId      string `json:"request_id" gorm:"type:varchar(64);not null;default:'';index"`
	CreatedAt      int64  `json:"created_at" gorm:"autoCreateTime;column:created_at;index"`
}

func (AffiliateConfigAuditLog) TableName() string {
	return "affiliate_config_audit_logs"
}
