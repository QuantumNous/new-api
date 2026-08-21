package controller

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"sort"
	"sync"
	"time"

	"github.com/QuantumNous/new-api/common"
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

// imageAutoCooldownRedisNamespace is the Redis key namespace for image-auto
// route cooldowns. Versioning the namespace lets a future breaker redesign
// change the key layout without colliding with stale entries from an older
// build.
const imageAutoCooldownRedisNamespace = "new-api:image_auto_cooldown:v1"

func imageAutoCooldownRedisKey(channelID int) string {
	return fmt.Sprintf("%s:%d", imageAutoCooldownRedisNamespace, channelID)
}

type imageAutoCooldownSnapshot struct {
	ChannelID         int       `json:"channel_id"`
	CooldownStartedAt time.Time `json:"cooldown_started_at"`
	CooldownExpiresAt time.Time `json:"cooldown_expires_at"`
}

// imageAutoCooldownRedisBackend is the narrow Redis surface the registry needs.
// It is an interface so tests can substitute miniredis without hard-wiring the
// shared client, and so the registry degrades to process-local when Redis is
// absent.
type imageAutoCooldownRedisBackend interface {
	Record(snapshot imageAutoCooldownSnapshot)
	IsCooling(channelID int) (imageAutoCooldownSnapshot, bool)
	Snapshot() []imageAutoCooldownSnapshot
}

// imageAutoCooldownRedis stores cooldowns in the shared Redis instance so a
// route tripped on one replica is excluded on every replica and survives a
// process restart. Every key carries a TTL equal to its cooldown duration, so
// expiry is handled by Redis itself. It reads common.RDB at call time, which
// lets the global registry be constructed before Redis is initialized and
// simply no-op until it is.
type imageAutoCooldownRedis struct{}

func (imageAutoCooldownRedis) Record(snapshot imageAutoCooldownSnapshot) {
	if common.RDB == nil || snapshot.ChannelID <= 0 {
		return
	}
	ttl := snapshot.CooldownExpiresAt.Sub(snapshot.CooldownStartedAt)
	if ttl <= 0 {
		return
	}
	payload, err := json.Marshal(snapshot)
	if err != nil {
		return
	}
	ctx, cancel := context.WithTimeout(context.Background(), time.Second)
	defer cancel()
	_ = common.RDB.Set(ctx, imageAutoCooldownRedisKey(snapshot.ChannelID), string(payload), ttl).Err()
}

func (imageAutoCooldownRedis) IsCooling(channelID int) (imageAutoCooldownSnapshot, bool) {
	if common.RDB == nil || channelID <= 0 {
		return imageAutoCooldownSnapshot{}, false
	}
	ctx, cancel := context.WithTimeout(context.Background(), time.Second)
	defer cancel()
	raw, err := common.RDB.Get(ctx, imageAutoCooldownRedisKey(channelID)).Result()
	if err != nil {
		return imageAutoCooldownSnapshot{}, false
	}
	var snapshot imageAutoCooldownSnapshot
	if err := json.Unmarshal([]byte(raw), &snapshot); err != nil {
		return imageAutoCooldownSnapshot{}, false
	}
	if snapshot.ChannelID <= 0 || !snapshot.CooldownExpiresAt.After(snapshot.CooldownStartedAt) {
		return imageAutoCooldownSnapshot{}, false
	}
	return snapshot, true
}

func (imageAutoCooldownRedis) Snapshot() []imageAutoCooldownSnapshot {
	if common.RDB == nil {
		return []imageAutoCooldownSnapshot{}
	}
	ctx, cancel := context.WithTimeout(context.Background(), time.Second)
	defer cancel()
	// The cooldown namespace is bounded by the number of channels, and this is
	// an admin-only, low-frequency listing, so KEYS is acceptable here.
	keys, err := common.RDB.Keys(ctx, imageAutoCooldownRedisNamespace+":*").Result()
	if err != nil {
		return []imageAutoCooldownSnapshot{}
	}
	result := make([]imageAutoCooldownSnapshot, 0, len(keys))
	for _, key := range keys {
		raw, err := common.RDB.Get(ctx, key).Result()
		if err != nil {
			continue
		}
		var snapshot imageAutoCooldownSnapshot
		if json.Unmarshal([]byte(raw), &snapshot) == nil &&
			snapshot.ChannelID > 0 &&
			snapshot.CooldownExpiresAt.After(snapshot.CooldownStartedAt) {
			result = append(result, snapshot)
		}
	}
	sort.Slice(result, func(i, j int) bool { return result[i].ChannelID < result[j].ChannelID })
	return result
}

type imageAutoCooldownRegistry struct {
	mu      sync.Mutex
	entries map[int]imageAutoCooldownSnapshot
	now     func() time.Time
	// redis optionally shares cooldown state across gateway replicas. A nil
	// backend keeps the registry in the legacy process-local mode.
	redis imageAutoCooldownRedisBackend
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

// newImageAutoCooldownRegistryWithRedis wires a Redis backend into the registry
// so routes cooled down on one replica are excluded on every replica.
func newImageAutoCooldownRegistryWithRedis(now func() time.Time, redis imageAutoCooldownRedisBackend) *imageAutoCooldownRegistry {
	registry := newImageAutoCooldownRegistry(now)
	registry.redis = redis
	return registry
}

// imageAutoCooldowns is the shared registry. It always carries a Redis backend,
// which no-ops until common.RDB is initialized, preserving the pre-Redis
// process-local behavior when Redis is disabled.
var imageAutoCooldowns = newImageAutoCooldownRegistryWithRedis(time.Now, imageAutoCooldownRedis{})

func (r *imageAutoCooldownRegistry) Record(channelID int, duration time.Duration) {
	if r == nil || channelID <= 0 || duration <= 0 {
		return
	}
	var snapshot imageAutoCooldownSnapshot
	r.mu.Lock()
	now := r.now()
	r.pruneLocked(now)
	snapshot = imageAutoCooldownSnapshot{
		ChannelID:         channelID,
		CooldownStartedAt: now,
		CooldownExpiresAt: now.Add(duration),
	}
	r.entries[channelID] = snapshot
	r.mu.Unlock()

	// Publish to Redis outside the lock: the shared write is best-effort and
	// must not serialize or block other in-process cooldown checks.
	if r.redis != nil {
		r.redis.Record(snapshot)
	}
}

func (r *imageAutoCooldownRegistry) IsCooling(channelID int) bool {
	if r == nil || channelID <= 0 {
		return false
	}

	// Fast path: process-local knowledge, no Redis round-trip.
	r.mu.Lock()
	now := r.now()
	r.pruneLocked(now)
	entry, ok := r.entries[channelID]
	r.mu.Unlock()
	if ok && entry.CooldownExpiresAt.After(now) {
		return true
	}

	if r.redis == nil {
		return false
	}
	shared, ok := r.redis.IsCooling(channelID)
	if !ok || !shared.CooldownExpiresAt.After(r.now()) {
		return false
	}
	// Backfill local memory so subsequent checks on this replica stay on the
	// fast path while the shared cooldown is active.
	r.mu.Lock()
	if shared.CooldownExpiresAt.After(r.now()) {
		r.entries[channelID] = shared
	}
	r.mu.Unlock()
	return true
}

func (r *imageAutoCooldownRegistry) Snapshot() []imageAutoCooldownSnapshot {
	if r == nil {
		return []imageAutoCooldownSnapshot{}
	}

	r.mu.Lock()
	now := r.now()
	r.pruneLocked(now)
	local := make([]imageAutoCooldownSnapshot, 0, len(r.entries))
	for _, entry := range r.entries {
		if entry.CooldownExpiresAt.After(now) {
			local = append(local, entry)
		}
	}
	r.mu.Unlock()

	merged := make(map[int]imageAutoCooldownSnapshot, len(local))
	for _, entry := range local {
		merged[entry.ChannelID] = entry
	}
	if r.redis != nil {
		for _, shared := range r.redis.Snapshot() {
			if !shared.CooldownExpiresAt.After(now) {
				continue
			}
			if existing, ok := merged[shared.ChannelID]; !ok || shared.CooldownExpiresAt.After(existing.CooldownExpiresAt) {
				merged[shared.ChannelID] = shared
			}
		}
	}
	result := make([]imageAutoCooldownSnapshot, 0, len(merged))
	for _, entry := range merged {
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
	if registry == nil || info == nil || info.ImageRouting == nil || err == nil ||
		types.IsRequestNotSentError(err) || types.IsClientAbortedError(err) {
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
