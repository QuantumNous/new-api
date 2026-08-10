package controller

import (
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/middleware"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/setting"
	"github.com/gin-gonic/gin"
)

// Usage meters power the account portal's usage bars. Every tier is capped by
// a request rate limit, so the requests meter is the one meter common to Free,
// Plus and Pro; Pro layers its metered pool on top.
const (
	UsageMeterRequests = "requests"
	UsageMeterIncluded = "included"
	UsageMeterMonthly  = "monthly"
	UsageMeterImages   = "images"
)

// UsageRequestsUnknown marks a rate-limit counter we could not read — Redis
// evicted the key, or Redis is unavailable.
const UsageRequestsUnknown int64 = -1

type UsageMeter struct {
	Kind    string `json:"kind"`
	Used    int64  `json:"used"`
	Limit   int64  `json:"limit"`
	Percent int    `json:"percent"`
	ResetAt int64  `json:"reset_at,omitempty"`
}

type UsageInputs struct {
	RateLimitEnabled bool
	RequestLimit     int
	RequestsUsed     int64
	WindowStart      int64
	WindowSeconds    int64
	IncludedTotal    int64
	IncludedUsed     int64
	IncludedResetAt  int64
	MonthlyCostUsed  int64
	MonthlyCostLimit int64
	MonthlyResetAt   int64
	ImagesUsed       int
	ImageLimit       int
}

func BuildUsageMeters(in UsageInputs) []UsageMeter {
	meters := make([]UsageMeter, 0, 2)

	// 0 means unlimited in ModelRequestRateLimitGroup, and a bar needs a
	// denominator, so an unlimited group gets no meter rather than an empty one.
	if in.RateLimitEnabled && in.RequestLimit > 0 {
		used := in.RequestsUsed
		resetAt := int64(0)
		if used == UsageRequestsUnknown {
			used = 0
		} else if in.WindowStart > 0 {
			resetAt = in.WindowStart + in.WindowSeconds
		}
		meters = append(meters, UsageMeter{
			Kind:    UsageMeterRequests,
			Used:    used,
			Limit:   int64(in.RequestLimit),
			Percent: percentUsed(used, int64(in.RequestLimit)),
			ResetAt: resetAt,
		})
	}

	if in.MonthlyCostLimit > 0 {
		meters = append(meters, UsageMeter{
			Kind:    UsageMeterMonthly,
			Used:    in.MonthlyCostUsed,
			Limit:   in.MonthlyCostLimit,
			Percent: percentUsed(in.MonthlyCostUsed, in.MonthlyCostLimit),
			ResetAt: in.MonthlyResetAt,
		})
	}
	if in.ImageLimit > 0 {
		meters = append(meters, UsageMeter{
			Kind:    UsageMeterImages,
			Used:    int64(in.ImagesUsed),
			Limit:   int64(in.ImageLimit),
			Percent: percentUsed(int64(in.ImagesUsed), int64(in.ImageLimit)),
			ResetAt: in.MonthlyResetAt,
		})
	}

	// Free and Plus carry no metered pool (total 0, reset period never), so the
	// gate is the data rather than the group name.
	if in.IncludedTotal > 0 {
		meters = append(meters, UsageMeter{
			Kind:    UsageMeterIncluded,
			Used:    in.IncludedUsed,
			Limit:   in.IncludedTotal,
			Percent: percentUsed(in.IncludedUsed, in.IncludedTotal),
			ResetAt: in.IncludedResetAt,
		})
	}

	return meters
}

// percentUsed reports whole percent consumed, clamped to 100. The server lets
// an in-flight task overrun its pool rather than killing it mid-loop, so used
// can legitimately exceed the limit.
func percentUsed(used, limit int64) int {
	if limit <= 0 || used <= 0 {
		return 0
	}
	pct := int((used*100 + limit/2) / limit)
	if pct > 100 {
		return 100
	}
	return pct
}

// GetUserUsage backs the account portal's usage bars. It reports only what the
// caller is actually metered on, so Free and Plus get the requests meter alone
// while Pro also gets its pool.
func GetUserUsage(c *gin.Context) {
	userId := c.GetInt("id")
	in := UsageInputs{}

	// The limiter resolves the token's group first and falls back to the
	// user's. A portal session carries no token, so the user's group is the
	// one that applies.
	group := ""
	if user, err := model.GetUserById(userId, false); err == nil {
		group = user.Group
	}

	if setting.ModelRequestRateLimitEnabled {
		limit := setting.ModelRequestRateLimitSuccessCount
		if _, groupSuccessCount, found := setting.GetGroupRateLimit(group); found {
			limit = groupSuccessCount
		}
		window := time.Duration(setting.ModelRequestRateLimitDurationMinutes) * time.Minute
		used, windowStart, ok := middleware.ReadModelRequestSuccessWindow(c.Request.Context(), userId, window)
		if !ok {
			used = UsageRequestsUnknown
			windowStart = 0
		}
		in.RateLimitEnabled = true
		in.RequestLimit = limit
		in.WindowSeconds = int64(window / time.Second)
		in.RequestsUsed = used
		in.WindowStart = windowStart
	}

	// A missing or unreadable subscription is a user with no pool, not an error
	// worth failing the whole page over.
	var cycleSubs []model.UserSubscription
	if summaries, err := model.GetAllActiveUserSubscriptions(userId); err == nil {
		subs := make([]model.UserSubscription, 0, len(summaries))
		for _, summary := range summaries {
			if summary.Subscription != nil {
				subs = append(subs, *summary.Subscription)
			}
		}
		in.IncludedTotal, in.IncludedUsed, in.IncludedResetAt = service.SumIncludedPools(subs)
		cycleSubs = subs
	}

	cycleStart, resetAt := service.UsageCycle(service.CycleMonth, service.CycleSubscription(cycleSubs), time.Now())
	if cost, _, images, err := model.GetUsage(userId, service.CycleMonth, cycleStart); err == nil {
		in.MonthlyCostUsed = cost
		in.MonthlyCostLimit = setting.GetMonthlyCostLimit(group)
		in.MonthlyResetAt = resetAt
		in.ImagesUsed = images
		// An unconfigured group reports limit 0 here too, same as an explicit
		// 0: BuildUsageMeters already omits the images meter whenever the
		// limit is <= 0, so the two cases render identically (no bar), which
		// is correct — there is nothing to show a meter against either way.
		in.ImageLimit, _ = setting.GetMonthlyImageLimit(group)
	}

	common.ApiSuccess(c, gin.H{"meters": BuildUsageMeters(in)})
}
