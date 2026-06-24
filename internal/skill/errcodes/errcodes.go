// Package errcodes defines Skill Marketplace API error codes and their canonical
// HTTP status mappings, plus helpers for translating between the data-model
// BlockReason and the API ErrorCode. Source of truth: tasks/03 §7.2.
//
// DR-45 deviation D-45-1: ErrForbidden ("FORBIDDEN", HTTP 403) is added here to
// satisfy tasks/05 §4.1 (authenticated non-admin -> 403) but is NOT in the
// tasks/03 §7.2 catalog of 14 codes. It has no BlockReason counterpart and is
// intentionally excluded from blockReasonToCode/allBlockReasons. PR description
// for DR-45 must disclose this extension and request reviewer sign-off.
package errcodes

import (
	"net/http"

	"github.com/QuantumNous/new-api/internal/skill/enums"
)

// ErrorCode is the stable uppercase API error code returned in the error envelope
// (tasks/03 §7.1, §7.2). Distinct from enums.BlockReason (lowercase data-model value).
type ErrorCode string

const (
	ErrInvalidRequest ErrorCode = "INVALID_REQUEST"
	ErrAuthRequired   ErrorCode = "AUTH_REQUIRED"
	// ErrForbidden is emitted when a user is authenticated but lacks sufficient
	// role for the endpoint (tasks/05 §4.1). See D-45-1 in the package doc.
	ErrForbidden ErrorCode = "FORBIDDEN"
	// ErrSkillConflict is emitted for stable 409 skill write conflicts such as
	// duplicate slugs or version-number collisions. It has no BlockReason
	// counterpart and is intentionally excluded from DR-70 skill_blocked.
	ErrSkillConflict             ErrorCode = "SKILL_CONFLICT"
	ErrSkillNotFound             ErrorCode = "SKILL_NOT_FOUND"
	ErrSkillNotPublished         ErrorCode = "SKILL_NOT_PUBLISHED"
	ErrSkillNotEnabled           ErrorCode = "SKILL_NOT_ENABLED"
	ErrSkillPlanRequired         ErrorCode = "SKILL_PLAN_REQUIRED"
	ErrSkillSubscriptionInactive ErrorCode = "SKILL_SUBSCRIPTION_INACTIVE"
	ErrSkillEvaluationNotPassed  ErrorCode = "SKILL_EVALUATION_NOT_PASSED"
	ErrSkillQuotaExceeded        ErrorCode = "SKILL_QUOTA_EXCEEDED"
	ErrSkillKidsModeBlocked      ErrorCode = "SKILL_KIDS_MODE_BLOCKED"
	ErrSkillContextTooLong       ErrorCode = "SKILL_CONTEXT_TOO_LONG"
	ErrSkillRateLimited          ErrorCode = "SKILL_RATE_LIMITED"
	ErrSkillTimeout              ErrorCode = "SKILL_TIMEOUT"
	ErrSkillSafetyViolation      ErrorCode = "SKILL_SAFETY_VIOLATION"
	ErrSkillInternalError        ErrorCode = "SKILL_INTERNAL_ERROR"
)

// httpStatusByCode is the unexported catalog mapping each ErrorCode to its
// canonical HTTP status. NOT exported - callers must use HTTPStatusFor() for
// single lookups, HTTPStatusCatalog() for a full copy, or AllErrorCodes() for
// enumeration. Exporting a map would allow mutation and undermine DR-39's goal
// of a stable, immutable single source of truth.
//
// Source: tasks/03_Data_Model_and_API_Spec.md §7.2.
// Note on SKILL_SAFETY_VIOLATION: tasks/01 §8 lists "200 or 403" covering both
// streaming output-replacement (200, streaming-layer behavior) and pre-injection
// blocking (403, error envelope). tasks/03 §7.2 (authoritative API spec) defines
// 403 for the error envelope. See PR description for sign-off.
var httpStatusByCode = map[ErrorCode]int{
	ErrInvalidRequest:            http.StatusBadRequest,          // 400
	ErrAuthRequired:              http.StatusUnauthorized,        // 401
	ErrForbidden:                 http.StatusForbidden,           // 403 - D-45-1, see package doc
	ErrSkillConflict:             http.StatusConflict,            // 409
	ErrSkillNotFound:             http.StatusNotFound,            // 404
	ErrSkillNotPublished:         http.StatusForbidden,           // 403
	ErrSkillNotEnabled:           http.StatusForbidden,           // 403
	ErrSkillPlanRequired:         http.StatusForbidden,           // 403
	ErrSkillSubscriptionInactive: http.StatusForbidden,           // 403
	ErrSkillEvaluationNotPassed:  http.StatusForbidden,           // 403
	ErrSkillQuotaExceeded:        http.StatusTooManyRequests,     // 429
	ErrSkillKidsModeBlocked:      http.StatusForbidden,           // 403
	ErrSkillContextTooLong:       http.StatusBadRequest,          // 400
	ErrSkillRateLimited:          http.StatusTooManyRequests,     // 429
	ErrSkillTimeout:              http.StatusGatewayTimeout,      // 504
	ErrSkillSafetyViolation:      http.StatusForbidden,           // 403
	ErrSkillInternalError:        http.StatusInternalServerError, // 500
}

// allErrorCodes is the ordered catalog of all defined ErrorCodes.
// Used by Valid(), AllErrorCodes(), and exhaustiveness tests.
// Must stay in sync with the const block and httpStatusByCode above.
var allErrorCodes = []ErrorCode{
	ErrInvalidRequest,
	ErrAuthRequired,
	ErrForbidden,
	ErrSkillConflict,
	ErrSkillNotFound,
	ErrSkillNotPublished,
	ErrSkillNotEnabled,
	ErrSkillPlanRequired,
	ErrSkillSubscriptionInactive,
	ErrSkillEvaluationNotPassed,
	ErrSkillQuotaExceeded,
	ErrSkillKidsModeBlocked,
	ErrSkillContextTooLong,
	ErrSkillRateLimited,
	ErrSkillTimeout,
	ErrSkillSafetyViolation,
	ErrSkillInternalError,
}

// Valid reports whether c is a known, catalog-registered ErrorCode.
// Mirrors the Valid() pattern on enum types so callers can validate
// unknown codes received from external sources without a switch.
func (c ErrorCode) Valid() bool {
	_, ok := httpStatusByCode[c]
	return ok
}

// HTTPStatusFor returns the canonical HTTP status for the given error code.
// Returns 500 for unknown codes as a safe default.
func HTTPStatusFor(code ErrorCode) int {
	if status, ok := httpStatusByCode[code]; ok {
		return status
	}
	return http.StatusInternalServerError
}

// AllErrorCodes returns a defensive copy of the full error-code catalog in
// declaration order. Use for exhaustiveness tests and tooling; do not mutate.
func AllErrorCodes() []ErrorCode {
	out := make([]ErrorCode, len(allErrorCodes))
	copy(out, allErrorCodes)
	return out
}

// HTTPStatusCatalog returns a defensive copy of the full code->HTTP-status
// catalog. Use for bulk tooling (e.g. building an error middleware lookup);
// do not mutate the returned map.
func HTTPStatusCatalog() map[ErrorCode]int {
	out := make(map[ErrorCode]int, len(httpStatusByCode))
	for code, status := range httpStatusByCode {
		out[code] = status
	}
	return out
}

// blockReasonToCode is the authoritative bidirectional mapping between the
// lowercase data-model BlockReason and the uppercase API ErrorCode.
//
// This mapping is not a mechanical string transform because:
//   - some block_reason values keep the "skill_" prefix (skill_not_found, etc.)
//     while the corresponding error code uses "SKILL_" prefix differently;
//   - auth_required -> AUTH_REQUIRED (no SKILL_ prefix on either side);
//   - plan_required -> SKILL_PLAN_REQUIRED (SKILL_ added on the error code side).
//
// Always use this table; never reconstruct via string operations.
var blockReasonToCode = map[enums.BlockReason]ErrorCode{
	enums.BlockReasonAuthRequired:         ErrAuthRequired,
	enums.BlockReasonSkillNotFound:        ErrSkillNotFound,
	enums.BlockReasonSkillNotPublished:    ErrSkillNotPublished,
	enums.BlockReasonSkillNotEnabled:      ErrSkillNotEnabled,
	enums.BlockReasonPlanRequired:         ErrSkillPlanRequired,
	enums.BlockReasonSubscriptionInactive: ErrSkillSubscriptionInactive,
	enums.BlockReasonEvaluationNotPassed:  ErrSkillEvaluationNotPassed,
	enums.BlockReasonQuotaExceeded:        ErrSkillQuotaExceeded,
	enums.BlockReasonKidsModeBlocked:      ErrSkillKidsModeBlocked,
	enums.BlockReasonContextTooLong:       ErrSkillContextTooLong,
	enums.BlockReasonRateLimited:          ErrSkillRateLimited,
	enums.BlockReasonTimeout:              ErrSkillTimeout,
	enums.BlockReasonSafetyViolation:      ErrSkillSafetyViolation,
	enums.BlockReasonInternalError:        ErrSkillInternalError,
}

// allBlockReasons mirrors blockReasonToCode's key set in declaration order.
// Used by exhaustiveness tests (len check) and Valid() validation.
// Must stay in sync with blockReasonToCode above. Not exported - if a public
// accessor is ever needed, it should live in the enums package.
var allBlockReasons = []enums.BlockReason{
	enums.BlockReasonAuthRequired,
	enums.BlockReasonSkillNotFound,
	enums.BlockReasonSkillNotPublished,
	enums.BlockReasonSkillNotEnabled,
	enums.BlockReasonPlanRequired,
	enums.BlockReasonSubscriptionInactive,
	enums.BlockReasonEvaluationNotPassed,
	enums.BlockReasonQuotaExceeded,
	enums.BlockReasonKidsModeBlocked,
	enums.BlockReasonContextTooLong,
	enums.BlockReasonRateLimited,
	enums.BlockReasonTimeout,
	enums.BlockReasonSafetyViolation,
	enums.BlockReasonInternalError,
}

// codeToBlockReason is the reverse of blockReasonToCode, built at init time.
var codeToBlockReason map[ErrorCode]enums.BlockReason

// skillBlockedCodeToBlockReason is the DR-70 blocked-event reverse mapping.
// It is narrower than codeToBlockReason: only codes that currently belong to the
// skill_blocked taxonomy by default are included here.
//
// Notably excluded by default:
//   - INVALID_REQUEST: request-validation taxonomy
//   - FORBIDDEN: authz/admin taxonomy extension, not a blocked-event code
//   - SKILL_CONFLICT: write-conflict taxonomy, not a blocked-event code
//   - SKILL_EVALUATION_NOT_PASSED: not part of DR-70's current canonical blocked table
//   - SKILL_INTERNAL_ERROR: operational failure unless a later reviewed mapping is added
//   - SKILL_SAFETY_VIOLATION: separate safety taxonomy unless explicitly reviewed in-scope
var skillBlockedCodeToBlockReason map[ErrorCode]enums.BlockReason

func init() {
	codeToBlockReason = make(map[ErrorCode]enums.BlockReason, len(blockReasonToCode))
	for br, ec := range blockReasonToCode {
		codeToBlockReason[ec] = br
	}

	skillBlockedCodeToBlockReason = map[ErrorCode]enums.BlockReason{
		ErrAuthRequired:              enums.BlockReasonAuthRequired,
		ErrSkillNotFound:             enums.BlockReasonSkillNotFound,
		ErrSkillNotPublished:         enums.BlockReasonSkillNotPublished,
		ErrSkillNotEnabled:           enums.BlockReasonSkillNotEnabled,
		ErrSkillPlanRequired:         enums.BlockReasonPlanRequired,
		ErrSkillSubscriptionInactive: enums.BlockReasonSubscriptionInactive,
		ErrSkillQuotaExceeded:        enums.BlockReasonQuotaExceeded,
		ErrSkillKidsModeBlocked:      enums.BlockReasonKidsModeBlocked,
		ErrSkillContextTooLong:       enums.BlockReasonContextTooLong,
		ErrSkillRateLimited:          enums.BlockReasonRateLimited,
		ErrSkillTimeout:              enums.BlockReasonTimeout,
	}
}

// ErrorCodeFor translates a data-model BlockReason to the API ErrorCode.
// Returns (code, true) when found; ("", false) for unknown reasons.
func ErrorCodeFor(r enums.BlockReason) (ErrorCode, bool) {
	code, ok := blockReasonToCode[r]
	return code, ok
}

// BlockReasonFor translates an API ErrorCode to the data-model BlockReason.
//
// This is the generic reverse translation for the full shared error-code catalog.
// A returned mapping means the code has a canonical lowercase BlockReason
// counterpart somewhere in the shared taxonomy; it does not mean every caller
// should classify that code into DR-70's skill_blocked event family.
func BlockReasonFor(c ErrorCode) (enums.BlockReason, bool) {
	reason, ok := codeToBlockReason[c]
	return reason, ok
}

// SkillBlockedReasonFor translates an API ErrorCode to the DR-70 blocked-event
// BlockReason. It intentionally returns false for codes that are valid shared
// ErrorCodes but are outside the default skill_blocked taxonomy.
//
// A returned mapping still does not imply the runtime currently has a live
// blocked path for that code. For example, SKILL_TIMEOUT remains mapping-only
// until a real pre-injection timeout path exists.
func SkillBlockedReasonFor(c ErrorCode) (enums.BlockReason, bool) {
	reason, ok := skillBlockedCodeToBlockReason[c]
	return reason, ok
}

// RateLimitedCode is syntactic sugar for the one code that requires a
// Retry-After response header (tasks/03 §7.2 note).
const RateLimitedCode = ErrSkillRateLimited
