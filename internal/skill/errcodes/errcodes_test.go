package errcodes

import (
	"net/http"
	"testing"

	"github.com/QuantumNous/new-api/internal/skill/enums"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// TestHTTPStatus_AllCodes verifies every ErrorCode maps to the exact HTTP status
// specified in tasks/03 §7.2. Table-driven so additions are obvious.
func TestHTTPStatus_AllCodes(t *testing.T) {
	cases := []struct {
		code   ErrorCode
		status int
	}{
		{ErrInvalidRequest, 400},
		{ErrAuthRequired, 401},
		{ErrForbidden, 403}, // D-45-1: authenticated non-admin, see package doc
		{ErrSkillConflict, 409},
		{ErrSkillNotFound, 404},
		{ErrSkillNotPublished, 403},
		{ErrSkillNotEnabled, 403},
		{ErrSkillPlanRequired, 403},
		{ErrSkillSubscriptionInactive, 403},
		{ErrSkillQuotaExceeded, 429},
		{ErrSkillKidsModeBlocked, 403},
		{ErrSkillContextTooLong, 400},
		{ErrSkillRateLimited, 429},
		{ErrSkillTimeout, 504},
		{ErrSkillSafetyViolation, 403}, // 403, not 200 — see PR description for tasks/01 §8 rationale
		{ErrSkillInternalError, 500},   // 500 is a legitimate catalog value, not a fallback
	}
	for _, tc := range cases {
		assert.Equal(t, tc.status, HTTPStatusFor(tc.code), "HTTPStatusFor(%q)", tc.code)
	}
}

// TestAllErrorCodes_Coverage confirms AllErrorCodes() returns exactly the codes
// in allErrorCodes and that each is registered in httpStatusByCode.
func TestAllErrorCodes_Coverage(t *testing.T) {
	codes := AllErrorCodes()
	assert.Equal(t, len(allErrorCodes), len(codes), "AllErrorCodes length mismatch")
	for _, code := range codes {
		assert.True(t, code.Valid(), "AllErrorCodes() contains invalid code: %q", code)
		_, ok := httpStatusByCode[code]
		assert.True(t, ok, "AllErrorCodes() code %q missing from httpStatusByCode", code)
	}
}

// TestAllErrorCodes_DefensiveCopy confirms that mutating the slice returned by
// AllErrorCodes() does not affect future calls.
func TestAllErrorCodes_DefensiveCopy(t *testing.T) {
	codes := AllErrorCodes()
	codes[0] = "MUTATED"
	fresh := AllErrorCodes()
	assert.Equal(t, ErrInvalidRequest, fresh[0], "AllErrorCodes must return a copy, not the internal slice")
}

// TestHTTPStatusCatalog_DefensiveCopy confirms that mutating the map returned by
// HTTPStatusCatalog() does not affect the internal catalog.
func TestHTTPStatusCatalog_DefensiveCopy(t *testing.T) {
	catalog := HTTPStatusCatalog()
	catalog[ErrSkillPlanRequired] = http.StatusOK // mutate the copy

	assert.Equal(t, http.StatusForbidden, HTTPStatusFor(ErrSkillPlanRequired),
		"HTTPStatusCatalog must return a defensive copy, not the internal map")
}

// TestMapping_RoundTrip verifies BlockReason→ErrorCode→BlockReason round-trips
// correctly for every entry in blockReasonToCode.
func TestMapping_RoundTrip(t *testing.T) {
	for br := range blockReasonToCode {
		code, ok := ErrorCodeFor(br)
		require.True(t, ok, "missing forward mapping for %q", br)
		back, ok := BlockReasonFor(code)
		require.True(t, ok, "missing reverse mapping for %q", code)
		assert.Equal(t, br, back, "round-trip mismatch for %q", br)
	}
}

// TestMapping_UnknownValues confirms safe handling of unknown inputs.
func TestMapping_UnknownValues(t *testing.T) {
	_, ok := ErrorCodeFor("unknown_reason")
	assert.False(t, ok, "unknown block_reason must return false")

	_, ok = BlockReasonFor("UNKNOWN_CODE")
	assert.False(t, ok, "unknown ErrorCode must return false")

	assert.Equal(t, 500, HTTPStatusFor("UNKNOWN_CODE"),
		"unknown ErrorCode must fall back to 500")
}

// TestAllBlockReasons_Coverage confirms every entry in allBlockReasons is a
// valid BlockReason and has a forward mapping in blockReasonToCode.
func TestAllBlockReasons_Coverage(t *testing.T) {
	for _, br := range allBlockReasons {
		assert.True(t, br.Valid(), "allBlockReasons contains invalid BlockReason: %q", br)
		_, ok := blockReasonToCode[br]
		assert.True(t, ok, "allBlockReasons entry %q has no blockReasonToCode entry", br)
	}
}

// TestCatalog_Exhaustiveness ensures no catalog has orphan entries — every slice
// and map must have exactly the same cardinality, and every key/value must be valid.
func TestCatalog_Exhaustiveness(t *testing.T) {
	assert.Equal(t, len(allErrorCodes), len(httpStatusByCode),
		"httpStatusByCode has %d entries but allErrorCodes has %d",
		len(httpStatusByCode), len(allErrorCodes))

	assert.Equal(t, len(allBlockReasons), len(blockReasonToCode),
		"blockReasonToCode has %d entries but allBlockReasons has %d",
		len(blockReasonToCode), len(allBlockReasons))

	assert.Equal(t, len(blockReasonToCode), len(codeToBlockReason),
		"codeToBlockReason size (%d) != blockReasonToCode size (%d)",
		len(codeToBlockReason), len(blockReasonToCode))

	for code := range httpStatusByCode {
		assert.True(t, code.Valid(),
			"httpStatusByCode has key %q that is not Valid()", code)
	}

	for br, code := range blockReasonToCode {
		assert.True(t, code.Valid(),
			"blockReasonToCode[%q] = %q is not a Valid() ErrorCode", br, code)
	}
}

// TestErrorCode_Valid_KnownAndUnknown spot-checks Valid() on known and unknown codes.
func TestErrorCode_Valid_KnownAndUnknown(t *testing.T) {
	assert.True(t, ErrAuthRequired.Valid())
	assert.True(t, ErrSkillInternalError.Valid())
	assert.False(t, ErrorCode("").Valid())
	assert.False(t, ErrorCode("UNKNOWN").Valid())
	assert.False(t, ErrorCode("auth_required").Valid()) // lowercase is not a valid ErrorCode
}

// TestRateLimitedCode confirms the convenience alias equals the actual constant.
func TestRateLimitedCode(t *testing.T) {
	assert.Equal(t, ErrSkillRateLimited, RateLimitedCode)
	assert.Equal(t, http.StatusTooManyRequests, HTTPStatusFor(RateLimitedCode))
}

// TestErrorCodeStringValues verifies all ErrorCode string values verbatim.
func TestErrorCodeStringValues(t *testing.T) {
	assert.Equal(t, "INVALID_REQUEST", string(ErrInvalidRequest))
	assert.Equal(t, "AUTH_REQUIRED", string(ErrAuthRequired))
	assert.Equal(t, "FORBIDDEN", string(ErrForbidden))
	assert.Equal(t, "SKILL_CONFLICT", string(ErrSkillConflict))
	assert.Equal(t, "SKILL_NOT_FOUND", string(ErrSkillNotFound))
	assert.Equal(t, "SKILL_NOT_PUBLISHED", string(ErrSkillNotPublished))
	assert.Equal(t, "SKILL_NOT_ENABLED", string(ErrSkillNotEnabled))
	assert.Equal(t, "SKILL_PLAN_REQUIRED", string(ErrSkillPlanRequired))
	assert.Equal(t, "SKILL_SUBSCRIPTION_INACTIVE", string(ErrSkillSubscriptionInactive))
	assert.Equal(t, "SKILL_EVALUATION_NOT_PASSED", string(ErrSkillEvaluationNotPassed))
	assert.Equal(t, "SKILL_QUOTA_EXCEEDED", string(ErrSkillQuotaExceeded))
	assert.Equal(t, "SKILL_KIDS_MODE_BLOCKED", string(ErrSkillKidsModeBlocked))
	assert.Equal(t, "SKILL_CONTEXT_TOO_LONG", string(ErrSkillContextTooLong))
	assert.Equal(t, "SKILL_RATE_LIMITED", string(ErrSkillRateLimited))
	assert.Equal(t, "SKILL_TIMEOUT", string(ErrSkillTimeout))
	assert.Equal(t, "SKILL_SAFETY_VIOLATION", string(ErrSkillSafetyViolation))
	assert.Equal(t, "SKILL_INTERNAL_ERROR", string(ErrSkillInternalError))
}

// TestBlockReasonMappingSpotCheck verifies selected entries in blockReasonToCode
// where string manipulation would give the wrong result (the key reason the
// explicit map exists).
func TestBlockReasonMappingSpotCheck(t *testing.T) {
	// auth_required -> AUTH_REQUIRED (no SKILL_ prefix on either side)
	code, ok := ErrorCodeFor(enums.BlockReasonAuthRequired)
	require.True(t, ok)
	assert.Equal(t, ErrAuthRequired, code)

	// plan_required -> SKILL_PLAN_REQUIRED (SKILL_ added on error code side)
	code, ok = ErrorCodeFor(enums.BlockReasonPlanRequired)
	require.True(t, ok)
	assert.Equal(t, ErrSkillPlanRequired, code)

	// skill_not_found -> SKILL_NOT_FOUND (both sides have SKILL_ but from different origins)
	code, ok = ErrorCodeFor(enums.BlockReasonSkillNotFound)
	require.True(t, ok)
	assert.Equal(t, ErrSkillNotFound, code)

	code, ok = ErrorCodeFor(enums.BlockReasonEvaluationNotPassed)
	require.True(t, ok)
	assert.Equal(t, ErrSkillEvaluationNotPassed, code)
}
