package controller

import (
	"errors"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/i18n"
	"github.com/QuantumNous/new-api/model"
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

// AllowedModelRate describes one entry in the plan's model allow-list.
// Format on the wire (and in the DB): {"model": "gpt-4", "ratio": 1.0}.
type AllowedModelRate struct {
	Model string  `json:"model"`
	Ratio float64 `json:"ratio"`
}

// WindowUsageView mirrors model.WindowUsage for the public API. Keep the
// JSON tags stable — Agent wallet UI reads them directly.
type WindowUsageView struct {
	PeriodType  string `json:"period_type"`
	PeriodStart int64  `json:"period_start"`
	PeriodEnd   int64  `json:"period_end"`
	Used        int64  `json:"used"`
	Limit       int64  `json:"limit"`
	Remaining   int64  `json:"remaining"`
}

// PlanView is the public projection of an agent plan for the wallet UI.
type PlanView struct {
	Id              int                `json:"id"`
	Title           string             `json:"title"`
	Subtitle        string             `json:"subtitle"`
	Currency        string             `json:"currency"`
	PriceAmount     float64            `json:"price_amount"`
	Level           string             `json:"level"`
	EndTime         int64              `json:"end_time"`
	MonthlyLimit    int64              `json:"monthly_limit"`
	FiveHourLimit   int64              `json:"five_hour_limit"`
	WeeklyLimit     int64              `json:"weekly_limit"`
	TotalAmount     int64              `json:"total_amount"`
	AmountUsed      int64              `json:"amount_used"`
	AmountRemaining int64              `json:"amount_remaining"`
	AllowedModels   []AllowedModelRate `json:"allowed_models"`
	FiveHourUsage   *WindowUsageView   `json:"five_hour_usage"`
	WeeklyUsage     *WindowUsageView   `json:"weekly_usage"`
	MonthlyUsage    *WindowUsageView   `json:"monthly_usage"`
}

// UpgradeOption describes a higher-level plan available to the user, with
// the discount (in money) computed from the user's current remaining quota.
type UpgradeOption struct {
	Id            int     `json:"id"`
	Title         string  `json:"title"`
	Level         string  `json:"level"`
	Price         float64 `json:"price"`
	Currency      string  `json:"currency"`
	DiscountMoney float64 `json:"discount_money"`
	NetPrice      float64 `json:"net_price"`
}

// AgentPlanResponse is the shape consumed by the Agent wallet page.
type AgentPlanResponse struct {
	HasActivePlan     bool            `json:"has_active_plan"`
	Plan              *PlanView       `json:"plan,omitempty"`
	Usage             *UsageSummary   `json:"usage"`
	AvailableUpgrades []UpgradeOption `json:"available_upgrades"`
}

type UsageSummary struct {
	FiveHour  *WindowUsageView `json:"five_hour"`
	Weekly    *WindowUsageView `json:"weekly"`
	Monthly   *WindowUsageView `json:"monthly"`
	NextReset struct {
		FiveHour int64 `json:"five_hour"`
		Weekly   int64 `json:"weekly"`
		Monthly  int64 `json:"monthly"`
	} `json:"next_reset"`
}

// GetUserAgentPlan returns the current active agent subscription, the three
// window usage summaries, and the list of higher-level plans available for
// upgrade. Only available when AGENT_MODE is enabled — otherwise returns a
// localized "agent mode not enabled" error.
func GetUserAgentPlan(c *gin.Context) {
	if !common.AgentModeEnabled {
		common.ApiErrorI18n(c, i18n.MsgUserAgentModeRequired)
		return
	}
	userId := c.GetInt("id")
	if userId <= 0 {
		common.ApiErrorI18n(c, i18n.MsgInvalidParams)
		return
	}

	sub, err := model.GetUserActiveAgentSubscription(userId)
	if err != nil {
		common.ApiError(c, err)
		return
	}

	resp := AgentPlanResponse{
		HasActivePlan: sub != nil,
		Plan:          nil,
		Usage:         &UsageSummary{},
	}

	if sub != nil {
		plan, err := model.GetSubscriptionPlanById(sub.PlanId)
		if err != nil {
			common.ApiError(c, err)
			return
		}
		fiveHour, weekly, monthly, err := model.GetUserPlanUsageSummary(sub.Id)
		if err != nil {
			common.ApiError(c, err)
			return
		}
		resp.Plan = buildPlanView(plan, sub, fiveHour, weekly, monthly)
		resp.Usage = buildUsageSummary(fiveHour, weekly, monthly)
	}

	upgrades, err := model.ListUpgradeableAgentPlans(userId)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	for _, p := range upgrades {
		var discount float64
		if sub != nil {
			oldPlan, perr := model.GetSubscriptionPlanById(sub.PlanId)
			if perr == nil {
				d, _ := model.ComputeUpgradeDiscount(sub, oldPlan, &p)
				discount = d
			}
		}
		net := p.PriceAmount - discount
		if net < 0 {
			net = 0
		}
		resp.AvailableUpgrades = append(resp.AvailableUpgrades, UpgradeOption{
			Id:            p.Id,
			Title:         p.Title,
			Level:         p.PlanLevel,
			Price:         p.PriceAmount,
			Currency:      p.Currency,
			DiscountMoney: discount,
			NetPrice:      net,
		})
	}

	common.ApiSuccess(c, resp)
}

func buildPlanView(plan *model.SubscriptionPlan, sub *model.UserSubscription, fiveHour, weekly, monthly *model.WindowUsage) *PlanView {
	view := &PlanView{
		Id:              plan.Id,
		Title:           plan.Title,
		Subtitle:        plan.Subtitle,
		Currency:        plan.Currency,
		PriceAmount:     plan.PriceAmount,
		Level:           plan.PlanLevel,
		EndTime:         sub.EndTime,
		MonthlyLimit:    sub.MonthlyLimitSnap,
		FiveHourLimit:   sub.FiveHourLimitSnap,
		WeeklyLimit:     sub.WeeklyLimitSnap,
		TotalAmount:     sub.AmountTotal,
		AmountUsed:      sub.AmountUsed,
		AmountRemaining: sub.AmountTotal - sub.AmountUsed,
		AllowedModels:   parseAllowedModels(plan.AllowedModels),
		FiveHourUsage:   toWindowView(fiveHour),
		WeeklyUsage:     toWindowView(weekly),
		MonthlyUsage:    toWindowView(monthly),
	}
	if view.AmountRemaining < 0 {
		view.AmountRemaining = 0
	}
	return view
}

func buildUsageSummary(fiveHour, weekly, monthly *model.WindowUsage) *UsageSummary {
	out := &UsageSummary{
		FiveHour: toWindowView(fiveHour),
		Weekly:   toWindowView(weekly),
		Monthly:  toWindowView(monthly),
	}
	if fiveHour != nil {
		out.NextReset.FiveHour = fiveHour.PeriodEnd
	}
	if weekly != nil {
		out.NextReset.Weekly = weekly.PeriodEnd
	}
	if monthly != nil {
		out.NextReset.Monthly = monthly.PeriodEnd
	}
	return out
}

func toWindowView(w *model.WindowUsage) *WindowUsageView {
	if w == nil {
		return nil
	}
	return &WindowUsageView{
		PeriodType:  w.PeriodType,
		PeriodStart: w.PeriodStart,
		PeriodEnd:   w.PeriodEnd,
		Used:        w.Used,
		Limit:       w.Limit,
		Remaining:   w.Remaining,
	}
}

// parseAllowedModels turns the JSON-encoded allow-list blob into a slice.
// Empty input means "no restriction" → return nil so JSON serializes as `null`
// rather than `[]`. Malformed JSON is treated as empty (admin endpoint will
// already have validated on write).
func parseAllowedModels(raw string) []AllowedModelRate {
	if raw == "" {
		return nil
	}
	var out []AllowedModelRate
	if err := common.UnmarshalJsonStr(raw, &out); err != nil {
		common.SysLog("parseAllowedModels: invalid JSON, treating as empty: " + err.Error())
		return nil
	}
	return out
}

// --- Admin: upgrade endpoint ---

type AdminUpgradeSubscriptionRequest struct {
	UserId int `json:"user_id"`
	PlanId int `json:"plan_id"`
	// SourceNote is recorded in the user log for traceability.
	SourceNote string `json:"source_note"`
}

type AdminUpgradeSubscriptionResponse struct {
	OldSubscriptionId int     `json:"old_subscription_id"`
	NewSubscriptionId int     `json:"new_subscription_id"`
	DiscountMoney     float64 `json:"discount_money"`
	NetPrice          float64 `json:"net_price"`
	Currency          string  `json:"currency"`
}

// AdminUpgradeUserSubscription runs UpgradeUserSubscriptionTx on the named
// user's active agent subscription. The caller is responsible for collecting
// the net price from the user — this endpoint only mutates subscription state.
func AdminUpgradeUserSubscription(c *gin.Context) {
	var req AdminUpgradeSubscriptionRequest
	if err := common.DecodeJson(c.Request.Body, &req); err != nil {
		common.ApiError(c, errors.New("invalid request body"))
		return
	}
	if req.UserId <= 0 || req.PlanId <= 0 {
		common.ApiErrorI18n(c, i18n.MsgInvalidParams)
		return
	}
	newPlan, err := model.GetSubscriptionPlanById(req.PlanId)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	if err := model.ValidatePlanLevel(newPlan.PlanLevel); err != nil {
		common.ApiError(c, err)
		return
	}
	oldSub, err := model.GetUserActiveAgentSubscription(req.UserId)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	if oldSub != nil {
		currentRank := model.PlanLevelRank[oldSub.PlanLevel]
		newRank := model.PlanLevelRank[newPlan.PlanLevel]
		if newRank <= currentRank {
			common.ApiErrorI18n(c, i18n.MsgUserAgentDowngradeForbidden)
			return
		}
	}
	var newSub *model.UserSubscription
	err = model.DB.Transaction(func(tx *gorm.DB) error {
		var inner error
		newSub, inner = model.UpgradeUserSubscriptionTx(tx, req.UserId, oldSub, newPlan)
		return inner
	})
	if err != nil {
		common.ApiError(c, err)
		return
	}
	discount := 0.0
	if oldSub != nil {
		oldPlan, perr := model.GetSubscriptionPlanById(oldSub.PlanId)
		if perr == nil {
			discount, _ = model.ComputeUpgradeDiscount(oldSub, oldPlan, newPlan)
		}
	}
	net := newPlan.PriceAmount - discount
	if net < 0 {
		net = 0
	}
	if req.SourceNote != "" {
		model.RecordLog(req.UserId, model.LogTypeTopup, "管理员升级套餐："+req.SourceNote)
	}
	common.ApiSuccess(c, AdminUpgradeSubscriptionResponse{
		OldSubscriptionId: func() int {
			if oldSub != nil {
				return oldSub.Id
			}
			return 0
		}(),
		NewSubscriptionId: newSub.Id,
		DiscountMoney:     discount,
		NetPrice:          net,
		Currency:          newPlan.Currency,
	})
}
