package controller

import (
	"bytes"
	"encoding/json"
	"errors"
	"io"
	"math"
	"net/http"
	"strconv"
	"strings"

	"github.com/QuantumNous/new-api/model"
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

// GrokAccountStatusView is a non-secret summary for the admin channel UI.
// It deliberately contains only the persisted auth/billing projection and a
// whitelist of billing-window fields. Channel.Key, leases, and the
// raw upstream/error payload are never serialized here.
type GrokAccountStatusView struct {
	ChannelID         int                     `json:"channel_id"`
	AuthStatus        string                  `json:"auth_status"`
	BillingPlan       string                  `json:"billing_plan,omitempty"`
	TierRaw           string                  `json:"tier_raw,omitempty"`
	BillingObservedAt int64                   `json:"billing_observed_at,omitempty"`
	LastRefreshAt     int64                   `json:"last_refresh_at,omitempty"`
	Monthly           *GrokAccountQuotaWindow `json:"monthly,omitempty"`
	Weekly            *GrokAccountQuotaWindow `json:"weekly,omitempty"`
}

// GrokAccountQuotaWindow is the safe subset of one persisted billing window.
type GrokAccountQuotaWindow struct {
	StatusCode        int      `json:"status_code"`
	UsagePercent      *float64 `json:"usage_percent,omitempty"`
	UsedPercent       *float64 `json:"used_percent,omitempty"`
	MonthlyLimitCents *int64   `json:"monthly_limit_cents,omitempty"`
	Limit             *float64 `json:"limit,omitempty"`
	Used              *float64 `json:"used,omitempty"`
	Remaining         *float64 `json:"remaining,omitempty"`
	Unit              string   `json:"unit,omitempty"`
	PeriodType        string   `json:"period_type,omitempty"`
	PeriodStart       string   `json:"period_start,omitempty"`
	PeriodEnd         string   `json:"period_end,omitempty"`
	OnDemandCap       *float64 `json:"on_demand_cap,omitempty"`
	OnDemandUsed      *float64 `json:"on_demand_used,omitempty"`
	OnDemandRemaining *float64 `json:"on_demand_remaining,omitempty"`
	PrepaidBalance    *float64 `json:"prepaid_balance,omitempty"`
}

type persistedGrokQuotaSnapshot struct {
	Version int                    `json:"version"`
	Plan    string                 `json:"plan,omitempty"`
	Tier    string                 `json:"tier,omitempty"`
	Monthly GrokAccountQuotaWindow `json:"monthly"`
	Weekly  GrokAccountQuotaWindow `json:"weekly"`
}

func grokAccountStatusView(channelID int, state *model.GrokChannelState) *GrokAccountStatusView {
	view := &GrokAccountStatusView{ChannelID: channelID, AuthStatus: model.GrokAuthStatusPending}
	if state == nil {
		return view
	}
	view.AuthStatus = state.AuthStatus
	view.BillingPlan = strings.TrimSpace(state.BillingPlan)
	view.TierRaw = strings.TrimSpace(state.TierRaw)
	view.BillingObservedAt = state.BillingObservedAt
	view.LastRefreshAt = state.LastRefreshAt

	snapshot, ok := parsePersistedGrokQuotaSnapshot(state.QuotaSnapshot)
	if !ok {
		return view
	}
	view.Monthly = &snapshot.Monthly
	view.Weekly = &snapshot.Weekly
	return view
}

func parsePersistedGrokQuotaSnapshot(raw string) (persistedGrokQuotaSnapshot, bool) {
	var snapshot persistedGrokQuotaSnapshot
	if strings.TrimSpace(raw) == "" {
		return snapshot, false
	}
	dec := json.NewDecoder(bytes.NewReader([]byte(raw)))
	dec.DisallowUnknownFields()
	if err := dec.Decode(&snapshot); err != nil {
		return persistedGrokQuotaSnapshot{}, false
	}
	var extra any
	if err := dec.Decode(&extra); err != io.EOF {
		return persistedGrokQuotaSnapshot{}, false
	}
	monthly, monthlyOK := sanitizeGrokQuotaWindow(snapshot.Monthly)
	weekly, weeklyOK := sanitizeGrokQuotaWindow(snapshot.Weekly)
	if snapshot.Version != 1 || !monthlyOK || !weeklyOK {
		return persistedGrokQuotaSnapshot{}, false
	}
	snapshot.Monthly = monthly
	snapshot.Weekly = weekly
	return snapshot, true
}

func sanitizeGrokQuotaWindow(window GrokAccountQuotaWindow) (GrokAccountQuotaWindow, bool) {
	for _, value := range []*float64{
		window.UsagePercent,
		window.UsedPercent,
		window.Limit,
		window.Used,
		window.Remaining,
		window.OnDemandCap,
		window.OnDemandUsed,
		window.OnDemandRemaining,
		window.PrepaidBalance,
	} {
		if value == nil {
			continue
		}
		if math.IsNaN(*value) || math.IsInf(*value, 0) {
			return GrokAccountQuotaWindow{}, false
		}
		if *value < 0 {
			return GrokAccountQuotaWindow{}, false
		}
	}
	if window.UsagePercent != nil && *window.UsagePercent > 100 {
		clamped := 100.0
		window.UsagePercent = &clamped
	}
	if window.UsedPercent != nil && *window.UsedPercent > 100 {
		clamped := 100.0
		window.UsedPercent = &clamped
	}
	if window.MonthlyLimitCents != nil && *window.MonthlyLimitCents < 0 {
		return GrokAccountQuotaWindow{}, false
	}
	return window, true
}

// GrokAccountStatusHandler returns the persisted, non-secret Grok account
// summary. It is intentionally read-only; the explicit UI refresh action uses
// GrokRefreshHandler and then reads this projection again.
func GrokAccountStatusHandler(c *gin.Context) {
	grokAuthNoStore(c)
	channelID, err := strconv.Atoi(c.Param("id"))
	if err != nil || channelID <= 0 {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "channel_id is required"})
		return
	}
	if !requireGrokChannel(c, channelID) {
		return
	}

	state, err := model.GetGrokChannelState(channelID)
	if err != nil && !errors.Is(err, gorm.ErrRecordNotFound) {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": "failed to load Grok account status"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "data": grokAccountStatusView(channelID, state)})
}
