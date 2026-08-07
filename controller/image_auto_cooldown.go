package controller

import (
	"fmt"
	"net/http"
	"sort"
	"sync"
	"time"

	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/types"
	"github.com/gin-gonic/gin"
)

const (
	// A timeout or server failure can arrive while the provider continues a
	// multi-minute image job. Keep the route out long enough for that upstream
	// work to finish before another user request can select it.
	imageAutoAmbiguousCooldownDuration = 15 * time.Minute
	// A definitive 429 creates no image, so a short route-local cooldown avoids
	// making every request pay the latency of the same rate-limited candidate.
	imageAutoRateLimitCooldownDuration = time.Minute
)

type imageAutoCooldownSnapshot struct {
	ChannelID         int       `json:"channel_id"`
	CooldownStartedAt time.Time `json:"cooldown_started_at"`
	CooldownExpiresAt time.Time `json:"cooldown_expires_at"`
}

type imageAutoCooldownRegistry struct {
	mu      sync.Mutex
	entries map[int]imageAutoCooldownSnapshot
	now     func() time.Time
}

func newImageAutoCooldownRegistry(now func() time.Time) *imageAutoCooldownRegistry {
	if now == nil {
		now = time.Now
	}
	return &imageAutoCooldownRegistry{
		entries: make(map[int]imageAutoCooldownSnapshot),
		now:     now,
	}
}

var imageAutoCooldowns = newImageAutoCooldownRegistry(time.Now)

func (r *imageAutoCooldownRegistry) Record(channelID int, duration time.Duration) {
	if r == nil || channelID <= 0 || duration <= 0 {
		return
	}
	r.mu.Lock()
	defer r.mu.Unlock()
	now := r.now()
	r.pruneLocked(now)
	r.entries[channelID] = imageAutoCooldownSnapshot{
		ChannelID:         channelID,
		CooldownStartedAt: now,
		CooldownExpiresAt: now.Add(duration),
	}
}

func (r *imageAutoCooldownRegistry) IsCooling(channelID int) bool {
	if r == nil || channelID <= 0 {
		return false
	}
	r.mu.Lock()
	defer r.mu.Unlock()
	now := r.now()
	r.pruneLocked(now)
	entry, ok := r.entries[channelID]
	return ok && entry.CooldownExpiresAt.After(now)
}

func (r *imageAutoCooldownRegistry) Snapshot() []imageAutoCooldownSnapshot {
	if r == nil {
		return []imageAutoCooldownSnapshot{}
	}
	r.mu.Lock()
	defer r.mu.Unlock()
	now := r.now()
	r.pruneLocked(now)
	result := make([]imageAutoCooldownSnapshot, 0, len(r.entries))
	for _, entry := range r.entries {
		result = append(result, entry)
	}
	sort.Slice(result, func(i, j int) bool { return result[i].ChannelID < result[j].ChannelID })
	return result
}

func (r *imageAutoCooldownRegistry) pruneLocked(now time.Time) {
	for channelID, entry := range r.entries {
		if !entry.CooldownExpiresAt.After(now) {
			delete(r.entries, channelID)
		}
	}
}

func filterImageAutoPlanCooldowns(plan *types.ImageRoutingPlan, registry *imageAutoCooldownRegistry) (*types.ImageRoutingPlan, error) {
	if plan == nil {
		return nil, fmt.Errorf("image-auto routing plan is unavailable")
	}
	filtered := *plan
	filtered.Routes = make([]types.ImageRoutingRoute, 0, len(plan.Routes))
	filtered.ReserveQuota = 0
	for _, route := range plan.Routes {
		if registry != nil && registry.IsCooling(route.ChannelID) {
			continue
		}
		filtered.Routes = append(filtered.Routes, route)
		quota, err := route.ReserveQuota(plan.Quality, plan.N)
		if err != nil {
			return nil, err
		}
		if quota > filtered.ReserveQuota {
			filtered.ReserveQuota = quota
		}
	}
	if len(filtered.Routes) == 0 {
		return nil, fmt.Errorf("all image-auto routes are in cooldown")
	}
	if filtered.ReserveQuota <= 0 {
		return nil, fmt.Errorf("image-auto routing reserve quota must be positive")
	}
	return &filtered, nil
}

func recordImageAutoCooldown(registry *imageAutoCooldownRegistry, info *relaycommon.RelayInfo, err *types.NewAPIError) bool {
	if registry == nil || info == nil || info.ImageRouting == nil || err == nil || types.IsRequestNotSentError(err) {
		return false
	}
	statusCode := types.ImageRoutingUpstreamStatusCode(err)
	if statusCode == 0 {
		statusCode = err.StatusCode
	}
	duration := time.Duration(0)
	if types.IsImageRoutingUpstreamRejected(err) {
		if statusCode == http.StatusTooManyRequests {
			duration = imageAutoRateLimitCooldownDuration
		}
	} else if statusCode == http.StatusRequestTimeout || statusCode >= 500 {
		duration = imageAutoAmbiguousCooldownDuration
	}
	if duration <= 0 {
		return false
	}
	route, routeErr := info.ImageRouting.ActiveRoute()
	if routeErr != nil || route.ChannelID <= 0 {
		return false
	}
	registry.Record(route.ChannelID, duration)
	return true
}

func GetImageRoutingCooldowns(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data":    imageAutoCooldowns.Snapshot(),
	})
}
