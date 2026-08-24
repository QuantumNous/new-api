package model

import (
	"errors"
	"time"

	"gorm.io/gorm"
)

// AdPilot: Google Ads automation results surfaced in the ops report's 广告投放
// board. All heavy lifting (Google Ads API sync, rules engine, mutations)
// happens on the ops machine (scripts/adpilot in the flatkey ops repo), which
// pushes results into these tables and pulls back approved proposals to
// execute. The Go app reads them for the admin board and only ever writes one
// thing: the proposal/insight status transitions driven by admin decisions.
// That single write path uses an optimistic status guard, so it is safe under
// multi-node deployment (Rule 11) without extra coordination.

// AdsPilotCampaignDaily is one campaign-day of Google Ads performance joined
// with first-party funnel outcomes (signups → checkout intents → paid). Dates
// are the ads account timezone (US Pacific), same bucketing as the ops report.
type AdsPilotCampaignDaily struct {
	Date         string  `json:"date" gorm:"column:date;primaryKey;size:16"`
	CampaignId   string  `json:"campaign_id" gorm:"column:campaign_id;primaryKey;size:32"`
	CampaignName string  `json:"campaign_name" gorm:"column:campaign_name;size:128"`
	CostUSD      float64 `json:"cost_usd" gorm:"column:cost_usd"`
	Clicks       int     `json:"clicks" gorm:"column:clicks"`
	Impressions  int     `json:"impressions" gorm:"column:impressions"`
	Conversions  float64 `json:"conversions" gorm:"column:conversions"`
	Signups      int     `json:"signups" gorm:"column:signups"`
	Intents      int     `json:"intents" gorm:"column:intents"`
	PaidCount    int     `json:"paid_count" gorm:"column:paid_count"`
	PaidUSD      float64 `json:"paid_usd" gorm:"column:paid_usd"`
	WasteUSD     float64 `json:"waste_usd" gorm:"column:waste_usd"` // spend on search terms with zero conversions in the rule window
	UpdatedAt    int64   `json:"updated_at" gorm:"column:updated_at"`
}

func (AdsPilotCampaignDaily) TableName() string {
	return "ads_pilot_campaign_daily"
}

const (
	AdsPilotInsightOpen  = "open"
	AdsPilotInsightAcked = "acked"

	AdsPilotProposalPending  = "pending"
	AdsPilotProposalApproved = "approved"
	AdsPilotProposalRejected = "rejected"
	AdsPilotProposalExecuted = "executed"
	AdsPilotProposalFailed   = "failed"
)

// AdsPilotInsight is a rule-engine finding that needs eyes but no approval:
// pacing overruns, metric anomalies, disapproved ads, waste summaries.
type AdsPilotInsight struct {
	Id           int    `json:"id"`
	CreatedAt    int64  `json:"created_at" gorm:"index"`
	Severity     string `json:"severity" gorm:"size:16"` // info | warn | alert
	Rule         string `json:"rule" gorm:"size:32"`     // R1..R6
	CampaignId   string `json:"campaign_id" gorm:"size:32"`
	CampaignName string `json:"campaign_name" gorm:"size:128"`
	Title        string `json:"title" gorm:"size:256"`
	Detail       string `json:"detail" gorm:"type:text"`
	// DedupKey lets the pipeline upsert the same finding across runs instead
	// of re-alerting daily (e.g. "R4:cpc:123456").
	DedupKey string `json:"dedup_key" gorm:"size:128;uniqueIndex"`
	Status   string `json:"status" gorm:"size:16;index"` // open | acked
	AckedBy  int    `json:"acked_by"`
	AckedAt  int64  `json:"acked_at"`
}

func (AdsPilotInsight) TableName() string {
	return "ads_pilot_insights"
}

// AdsPilotAction is the audit log of every mutation the pipeline performed
// (auto tier) or executed after approval. Written by the ops machine only.
type AdsPilotAction struct {
	Id           int    `json:"id"`
	CreatedAt    int64  `json:"created_at" gorm:"index"`
	Rule         string `json:"rule" gorm:"size:32"`
	ActionType   string `json:"action_type" gorm:"size:32"` // add_negative | pause_term | lower_budget | ...
	CampaignId   string `json:"campaign_id" gorm:"size:32"`
	CampaignName string `json:"campaign_name" gorm:"size:128"`
	Target       string `json:"target" gorm:"type:text"` // keyword/term/budget the action touched
	Params       string `json:"params" gorm:"type:text"` // JSON blob of the exact mutation
	Mode         string `json:"mode" gorm:"size:16"`     // auto | approved
	Status       string `json:"status" gorm:"size:16"`   // done | failed | reverted
	RevertInfo   string `json:"revert_info" gorm:"type:text"`
}

func (AdsPilotAction) TableName() string {
	return "ads_pilot_actions"
}

// AdsPilotProposal is a money-touching change waiting for an admin decision in
// the console. The pipeline inserts pending rows and later executes approved
// ones; the console only flips pending → approved/rejected.
type AdsPilotProposal struct {
	Id             int    `json:"id"`
	CreatedAt      int64  `json:"created_at" gorm:"index"`
	Rule           string `json:"rule" gorm:"size:32"`
	Kind           string `json:"kind" gorm:"size:32"` // budget | bidding | keyword | copy
	CampaignId     string `json:"campaign_id" gorm:"size:32"`
	CampaignName   string `json:"campaign_name" gorm:"size:128"`
	Title          string `json:"title" gorm:"size:256"`
	Detail         string `json:"detail" gorm:"type:text"`
	ExpectedImpact string `json:"expected_impact" gorm:"type:text"`
	DedupKey       string `json:"dedup_key" gorm:"size:128;uniqueIndex"`
	Status         string `json:"status" gorm:"size:16;index"` // pending | approved | rejected | executed | failed
	DecidedBy      int    `json:"decided_by"`
	DecidedAt      int64  `json:"decided_at"`
	ExecutedAt     int64  `json:"executed_at"`
	Result         string `json:"result" gorm:"type:text"`
}

func (AdsPilotProposal) TableName() string {
	return "ads_pilot_proposals"
}

// AdsPilotMeta is a single-row freshness/health record maintained by the
// pipeline; the board shows a red banner when LastError is set or the data
// goes stale.
type AdsPilotMeta struct {
	Id                int    `json:"id" gorm:"primaryKey"` // always 1
	LastSyncAt        int64  `json:"last_sync_at"`
	LastPushAt        int64  `json:"last_push_at"`
	LastError         string `json:"last_error" gorm:"type:text"`
	ConvUploadFreshAt int64  `json:"conv_upload_fresh_at"`
	KillSwitch        bool   `json:"kill_switch"`
}

func (AdsPilotMeta) TableName() string {
	return "ads_pilot_meta"
}

func GetAdsPilotCampaignDaily(sinceDate string) ([]*AdsPilotCampaignDaily, error) {
	var rows []*AdsPilotCampaignDaily
	err := DB.Where("date >= ?", sinceDate).Order("date").Find(&rows).Error
	return rows, err
}

func GetAdsPilotInsights(status string, limit int) ([]*AdsPilotInsight, error) {
	var rows []*AdsPilotInsight
	q := DB.Order("id DESC").Limit(limit)
	if status != "" {
		q = q.Where("status = ?", status)
	}
	err := q.Find(&rows).Error
	return rows, err
}

func GetAdsPilotActions(limit int) ([]*AdsPilotAction, error) {
	var rows []*AdsPilotAction
	err := DB.Order("id DESC").Limit(limit).Find(&rows).Error
	return rows, err
}

func GetAdsPilotProposals(status string, limit int) ([]*AdsPilotProposal, error) {
	var rows []*AdsPilotProposal
	q := DB.Order("id DESC").Limit(limit)
	if status != "" {
		q = q.Where("status = ?", status)
	}
	err := q.Find(&rows).Error
	return rows, err
}

func GetAdsPilotMeta() (*AdsPilotMeta, error) {
	var meta AdsPilotMeta
	err := DB.Where("id = 1").First(&meta).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, nil
	}
	return &meta, err
}

var ErrAdsPilotProposalDecided = errors.New("proposal is not pending")

// DecideAdsPilotProposal flips a pending proposal to approved/rejected. The
// status guard in the WHERE clause makes concurrent decisions safe across
// nodes: exactly one admin wins, the loser gets ErrAdsPilotProposalDecided.
func DecideAdsPilotProposal(id int, decision string, adminId int) error {
	if decision != AdsPilotProposalApproved && decision != AdsPilotProposalRejected {
		return errors.New("invalid decision")
	}
	res := DB.Model(&AdsPilotProposal{}).
		Where("id = ? AND status = ?", id, AdsPilotProposalPending).
		Updates(map[string]interface{}{
			"status":     decision,
			"decided_by": adminId,
			"decided_at": time.Now().Unix(),
		})
	if res.Error != nil {
		return res.Error
	}
	if res.RowsAffected == 0 {
		return ErrAdsPilotProposalDecided
	}
	return nil
}

// AckAdsPilotInsight marks an open insight as acknowledged; same optimistic
// guard as proposals.
func AckAdsPilotInsight(id int, adminId int) error {
	res := DB.Model(&AdsPilotInsight{}).
		Where("id = ? AND status = ?", id, AdsPilotInsightOpen).
		Updates(map[string]interface{}{
			"status":   AdsPilotInsightAcked,
			"acked_by": adminId,
			"acked_at": time.Now().Unix(),
		})
	if res.Error != nil {
		return res.Error
	}
	if res.RowsAffected == 0 {
		return errors.New("insight is not open")
	}
	return nil
}
