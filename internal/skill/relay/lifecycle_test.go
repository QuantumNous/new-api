package skillrelay

import (
	"testing"

	"github.com/QuantumNous/new-api/internal/skill/enums"
	"github.com/QuantumNous/new-api/internal/skill/errcodes"
	"github.com/stretchr/testify/assert"
)

// ---- lifecycleEnabledDecision: pure-function truth table (DR-66 §4) ----
//
// Coverage: every (status, hasActiveVersion, enabled) combination in both flag
// states. allowDeprecated=false is the live DR-66 behavior; allowDeprecated=true
// is the staged DR-67 seam (deprecated becomes executable for enabled users).

func TestLifecycleEnabledDecision_NoActiveVersion_AlwaysNotPublished(t *testing.T) {
	// hasActiveVersion=false short-circuits regardless of status / enabled / flag.
	for _, status := range []enums.SkillStatus{
		enums.SkillStatusPublished, enums.SkillStatusDeprecated,
		enums.SkillStatusDraft, enums.SkillStatusArchived,
	} {
		for _, enabled := range []bool{true, false} {
			for _, flag := range []bool{true, false} {
				got := lifecycleEnabledDecision(status, false, enabled, flag)
				assert.Equal(t, errcodes.ErrSkillNotPublished, got,
					"status=%s enabled=%v flag=%v with no active version must be NOT_PUBLISHED", status, enabled, flag)
			}
		}
	}
}

func TestLifecycleEnabledDecision_DraftAndArchived_AlwaysNotPublished(t *testing.T) {
	for _, status := range []enums.SkillStatus{enums.SkillStatusDraft, enums.SkillStatusArchived} {
		for _, enabled := range []bool{true, false} {
			got := lifecycleEnabledDecision(status, true, enabled, false)
			assert.Equal(t, errcodes.ErrSkillNotPublished, got,
				"status=%s enabled=%v must be NOT_PUBLISHED", status, enabled)
		}
	}
}

func TestLifecycleEnabledDecision_Published_Enabled_Allows(t *testing.T) {
	got := lifecycleEnabledDecision(enums.SkillStatusPublished, true, true, false)
	assert.Equal(t, errcodes.ErrorCode(""), got, "published + enabled must allow execution")
}

func TestLifecycleEnabledDecision_Published_NotEnabled_NotEnabled(t *testing.T) {
	got := lifecycleEnabledDecision(enums.SkillStatusPublished, true, false, false)
	assert.Equal(t, errcodes.ErrSkillNotEnabled, got, "published + not-enabled must be SKILL_NOT_ENABLED")
}

// ---- deprecated: live (flag=false) fail-closed (D3=b) ----

func TestLifecycleEnabledDecision_Deprecated_FlagOff_AlwaysNotPublished(t *testing.T) {
	// DR-66 keeps deprecated fail-closed: even an enabled user gets NOT_PUBLISHED.
	enabled := lifecycleEnabledDecision(enums.SkillStatusDeprecated, true, true, false)
	assert.Equal(t, errcodes.ErrSkillNotPublished, enabled,
		"deprecated + enabled with flag OFF must be NOT_PUBLISHED (D3=b fail-closed)")

	notEnabled := lifecycleEnabledDecision(enums.SkillStatusDeprecated, true, false, false)
	assert.Equal(t, errcodes.ErrSkillNotPublished, notEnabled,
		"deprecated + not-enabled with flag OFF must be NOT_PUBLISHED")
}

// ---- deprecated: staged DR-67 seam (flag=true) ----

// TestLifecycleEnabledDecision_FutureDR67_DeprecatedEnabledAllowedWhenFlagOn proves
// the open branch is implemented and correct, but it is NOT live: deprecatedRuntimeEnabled
// is false in DR-66. DR-67 flips that constant in the same PR that adds the use-time
// entitlement gate. This is a staged cross-ticket seam, not dead code.
func TestLifecycleEnabledDecision_FutureDR67_DeprecatedEnabledAllowedWhenFlagOn(t *testing.T) {
	allowed := lifecycleEnabledDecision(enums.SkillStatusDeprecated, true, true, true)
	assert.Equal(t, errcodes.ErrorCode(""), allowed,
		"deprecated + enabled with flag ON must allow (DR-67 behavior)")

	stillBlocked := lifecycleEnabledDecision(enums.SkillStatusDeprecated, true, false, true)
	assert.Equal(t, errcodes.ErrSkillNotPublished, stillBlocked,
		"deprecated + not-enabled must stay blocked even with flag ON")
}

// TestDeprecatedRuntimeEnabled_IsFalseInDR66 pins the live flag value so a future
// accidental flip (without DR-67's entitlement gate) is caught by CI.
func TestDeprecatedRuntimeEnabled_IsFalseInDR66(t *testing.T) {
	assert.False(t, deprecatedRuntimeEnabled,
		"DR-66 must ship with deprecatedRuntimeEnabled=false; DR-67 flips it WITH the entitlement gate")
}
