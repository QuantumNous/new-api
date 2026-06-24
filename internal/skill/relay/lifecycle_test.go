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
// states. allowDeprecated=true is the live DR-67 behavior (deprecated becomes
// executable for enabled, still-entitled users); allowDeprecated=false remains
// covered as the old DR-66 fail-closed behavior.

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

// ---- deprecated: old DR-66 fail-closed behavior (flag=false) ----

func TestLifecycleEnabledDecision_Deprecated_FlagOff_AlwaysNotPublished(t *testing.T) {
	enabled := lifecycleEnabledDecision(enums.SkillStatusDeprecated, true, true, false)
	assert.Equal(t, errcodes.ErrSkillNotPublished, enabled,
		"deprecated + enabled with flag OFF must be NOT_PUBLISHED (D3=b fail-closed)")

	notEnabled := lifecycleEnabledDecision(enums.SkillStatusDeprecated, true, false, false)
	assert.Equal(t, errcodes.ErrSkillNotPublished, notEnabled,
		"deprecated + not-enabled with flag OFF must be NOT_PUBLISHED")
}

// ---- deprecated: live DR-67 behavior (flag=true) ----

func TestLifecycleEnabledDecision_DeprecatedEnabledAllowedWhenFlagOn(t *testing.T) {
	allowed := lifecycleEnabledDecision(enums.SkillStatusDeprecated, true, true, true)
	assert.Equal(t, errcodes.ErrorCode(""), allowed,
		"deprecated + enabled with flag ON must allow (DR-67 behavior)")

	stillBlocked := lifecycleEnabledDecision(enums.SkillStatusDeprecated, true, false, true)
	assert.Equal(t, errcodes.ErrSkillNotPublished, stillBlocked,
		"deprecated + not-enabled must stay blocked even with flag ON")
}

// TestDeprecatedRuntimeEnabled_IsTrueInDR67 pins the live flag value together
// with the use-time entitlement gate.
func TestDeprecatedRuntimeEnabled_IsTrueInDR67(t *testing.T) {
	assert.True(t, deprecatedRuntimeEnabled,
		"DR-67 must ship with deprecatedRuntimeEnabled=true together with the entitlement gate")
}
