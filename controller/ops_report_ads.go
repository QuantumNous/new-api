package controller

import (
	"errors"
	"net/http"
	"sort"
	"strconv"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"

	"github.com/gin-gonic/gin"
)

// AdPilot board for the ops daily report (管理员 → 运营日报 → 广告投放).
// Pure DB reads over the ads_pilot_* tables maintained by the ops machine's
// pipeline; no Google Ads API access from the Go app. The only writes are the
// admin decisions on proposals/insights, which use optimistic status guards in
// the model layer (multi-node safe, Rule 11).

const (
	adsPilotStaleAfter   = 36 * time.Hour // sync older than this shows a stale warning
	adsPilotListLimit    = 100
	adsPilotPendingLimit = 50
)

type adsPilotCampaignSummary struct {
	CampaignId   string  `json:"campaign_id"`
	CampaignName string  `json:"campaign_name"`
	CostUSD      float64 `json:"cost_usd"`
	Clicks       int     `json:"clicks"`
	Impressions  int     `json:"impressions"`
	Conversions  float64 `json:"conversions"`
	Signups      int     `json:"signups"`
	Intents      int     `json:"intents"`
	PaidCount    int     `json:"paid_count"`
	PaidUSD      float64 `json:"paid_usd"`
	WasteUSD     float64 `json:"waste_usd"`
}

type adsPilotReport struct {
	GeneratedAt int64                          `json:"generated_at"`
	Days        int                            `json:"days"`
	Meta        *model.AdsPilotMeta            `json:"meta"`
	Stale       bool                           `json:"stale"`
	Campaigns   []adsPilotCampaignSummary      `json:"campaigns"`
	Daily       []*model.AdsPilotCampaignDaily `json:"daily"`
	Insights    []*model.AdsPilotInsight       `json:"insights"`
	Actions     []*model.AdsPilotAction        `json:"actions"`
	Proposals   []*model.AdsPilotProposal      `json:"proposals"`
}

// GetOpsAdsPilotReport handles GET /api/data/ops_report_ads?days=N (admin only).
func GetOpsAdsPilotReport(c *gin.Context) {
	days, _ := strconv.Atoi(c.Query("days"))
	if days <= 0 {
		days = opsReportDefaultDays
	}
	if days > opsReportMaxDays {
		days = opsReportMaxDays
	}
	now := time.Now()
	since := opsDay(now.Unix() - int64(days-1)*86400)

	daily, err := model.GetAdsPilotCampaignDaily(since)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	byCampaign := map[string]*adsPilotCampaignSummary{}
	for _, r := range daily {
		s, ok := byCampaign[r.CampaignId]
		if !ok {
			s = &adsPilotCampaignSummary{CampaignId: r.CampaignId, CampaignName: r.CampaignName}
			byCampaign[r.CampaignId] = s
		}
		s.CampaignName = r.CampaignName // latest name wins
		s.CostUSD += r.CostUSD
		s.Clicks += r.Clicks
		s.Impressions += r.Impressions
		s.Conversions += r.Conversions
		s.Signups += r.Signups
		s.Intents += r.Intents
		s.PaidCount += r.PaidCount
		s.PaidUSD += r.PaidUSD
		s.WasteUSD += r.WasteUSD
	}
	campaigns := make([]adsPilotCampaignSummary, 0, len(byCampaign))
	for _, s := range byCampaign {
		campaigns = append(campaigns, *s)
	}
	sort.Slice(campaigns, func(i, j int) bool { return campaigns[i].CostUSD > campaigns[j].CostUSD })

	meta, err := model.GetAdsPilotMeta()
	if err != nil {
		common.ApiError(c, err)
		return
	}
	insights, err := model.GetAdsPilotInsights(model.AdsPilotInsightOpen, adsPilotListLimit)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	actions, err := model.GetAdsPilotActions(adsPilotListLimit)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	// pending first so the approval queue is always visible, then recent history
	pending, err := model.GetAdsPilotProposals(model.AdsPilotProposalPending, adsPilotPendingLimit)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	recent, err := model.GetAdsPilotProposals("", adsPilotListLimit)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	proposals := pending
	seen := map[int]bool{}
	for _, p := range pending {
		seen[p.Id] = true
	}
	for _, p := range recent {
		if !seen[p.Id] {
			proposals = append(proposals, p)
		}
	}

	report := &adsPilotReport{
		GeneratedAt: now.Unix(),
		Days:        days,
		Meta:        meta,
		Stale:       meta == nil || now.Unix()-meta.LastPushAt > int64(adsPilotStaleAfter.Seconds()),
		Campaigns:   campaigns,
		Daily:       daily,
		Insights:    insights,
		Actions:     actions,
		Proposals:   proposals,
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "message": "", "data": report})
}

type adsPilotDecideRequest struct {
	Decision string `json:"decision"` // approve | reject
}

// DecideAdsPilotProposal handles POST /api/ads_pilot/proposals/:id/decide
// (admin only). pending → approved/rejected; the ops machine executes
// approved proposals on its next run and writes back the result.
func DecideAdsPilotProposal(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil || id <= 0 {
		common.ApiError(c, errors.New("invalid proposal id"))
		return
	}
	var req adsPilotDecideRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		common.ApiError(c, err)
		return
	}
	var status string
	switch req.Decision {
	case "approve":
		status = model.AdsPilotProposalApproved
	case "reject":
		status = model.AdsPilotProposalRejected
	default:
		common.ApiError(c, errors.New("decision must be approve or reject"))
		return
	}
	if err := model.DecideAdsPilotProposal(id, status, c.GetInt("id")); err != nil {
		common.ApiError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "message": ""})
}

// AckAdsPilotInsight handles POST /api/ads_pilot/insights/:id/ack (admin only).
func AckAdsPilotInsight(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil || id <= 0 {
		common.ApiError(c, errors.New("invalid insight id"))
		return
	}
	if err := model.AckAdsPilotInsight(id, c.GetInt("id")); err != nil {
		common.ApiError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "message": ""})
}
