package analytics

import (
	"os"

	skillmodel "github.com/QuantumNous/new-api/internal/skill/model"
)

const (
	kidsAnalyticsDailySaltEnv   = "SKILL_KIDS_ANALYTICS_DAILY_SALT"
	kidsAnalyticsSaltVersionEnv = "SKILL_KIDS_ANALYTICS_SALT_VERSION"
)

// ApplyKidsSessionIdentity applies the shared pseudonymous identity policy for
// kids-session skill analytics events. It clears real user/tenant identifiers
// and sets the HMAC-backed session_id used by the existing analytics pipeline.
func ApplyKidsSessionIdentity(event *skillmodel.SkillUsageEvent, realUserID, tenantID int64) error {
	return event.ApplyKidsSessionAnalyticsIdentity(
		realUserID,
		tenantID,
		os.Getenv(kidsAnalyticsSaltVersionEnv),
		[]byte(os.Getenv(kidsAnalyticsDailySaltEnv)),
	)
}
