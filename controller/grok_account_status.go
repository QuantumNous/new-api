package controller

import (
	"encoding/json"
	"errors"
	"net/http"
	"strconv"
	"strings"

	"github.com/QuantumNous/new-api/model"
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

// GrokAccountStatusView is a non-secret summary for the admin channel UI.
// It deliberately contains only the persisted auth/billing projection and a
// whitelist of numeric billing-window fields. Channel.Key, leases, and the
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
}

type persistedGrokQuotaSnapshot struct {
	Version int                    `json:"version"`
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

	var snapshot persistedGrokQuotaSnapshot
	if strings.TrimSpace(state.QuotaSnapshot) == "" || json.Unmarshal([]byte(state.QuotaSnapshot), &snapshot) != nil || snapshot.Version != 1 {
		return view
	}
	view.Monthly = &snapshot.Monthly
	view.Weekly = &snapshot.Weekly
	return view
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
