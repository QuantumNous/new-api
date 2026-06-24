package skillrelay

import (
	"fmt"
	"sync"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	skillanalytics "github.com/QuantumNous/new-api/internal/skill/analytics"
	skillapi "github.com/QuantumNous/new-api/internal/skill/api"
	"github.com/QuantumNous/new-api/internal/skill/enums"
	"github.com/QuantumNous/new-api/internal/skill/errcodes"
	skillmodel "github.com/QuantumNous/new-api/internal/skill/model"
	"github.com/QuantumNous/new-api/logger"
	platformmodel "github.com/QuantumNous/new-api/model"
	"github.com/gin-gonic/gin"
)

var blockedEventWriterMu sync.RWMutex
var blockedEventWriterOverride SkillBlockedWriter

type SkillBlockedWriter func(c *gin.Context, event *skillmodel.SkillUsageEvent) error

type SkillBlockedOmissionRecorder func(c *gin.Context, result AbortSkillRelayBlockedResult)

type SkillBlockedFailureRecorder func(c *gin.Context, result AbortSkillRelayBlockedResult)

type AbortSkillRelayBlockedInput struct {
	ErrorCode  errcodes.ErrorCode
	EntryPoint string
	SkillID    string
}

type AbortSkillRelayBlockedDeps struct {
	Writer           SkillBlockedWriter
	OmissionRecorder SkillBlockedOmissionRecorder
	FailureRecorder  SkillBlockedFailureRecorder
}

type AbortSkillRelayBlockedResult struct {
	ErrorCode   errcodes.ErrorCode
	RequestID   string
	BlockReason enums.BlockReason
	WriteError  error
	Emitted     bool
	Omitted     bool
	Duplicate   bool
	WriteFailed bool
	Mapped      bool
}

// AbortSkillRelayBlocked handles DR-70 blocked-event analytics only:
// mapping, omission, idempotency, request_id reuse/generation, and writer failure.
// It does not own the API error envelope yet; direct/distribute paths continue to
// return the stable user-facing error through their existing response logic until
// Workstream 4/5 wiring proves those paths keep the API error_code unchanged.
func AbortSkillRelayBlocked(c *gin.Context, input AbortSkillRelayBlockedInput, deps *AbortSkillRelayBlockedDeps) AbortSkillRelayBlockedResult {
	resolvedDeps := resolveBlockedDeps(deps)
	result := AbortSkillRelayBlockedResult{
		ErrorCode: input.ErrorCode,
		RequestID: blockedRequestID(c),
	}
	if common.GetContextKeyBool(c, constant.ContextKeySkillBlockedHandled) {
		result.Duplicate = true
		return result
	}
	common.SetContextKey(c, constant.ContextKeySkillBlockedHandled, true)

	blockReason, ok := errcodes.SkillBlockedReasonFor(input.ErrorCode)
	if !ok {
		return result
	}
	result.Mapped = true
	result.BlockReason = blockReason

	entryPoint := enums.EntryPoint(input.EntryPoint)
	if !entryPoint.Valid() {
		result.Omitted = true
		resolvedDeps.OmissionRecorder(c, result)
		return result
	}

	event, err := buildBlockedEvent(c, input, result.RequestID, blockReason, entryPoint)
	if err != nil {
		result.WriteFailed = true
		result.WriteError = err
		resolvedDeps.FailureRecorder(c, result)
		return result
	}
	if err := resolvedDeps.Writer(c, &event); err != nil {
		result.WriteFailed = true
		result.WriteError = err
		resolvedDeps.FailureRecorder(c, result)
		return result
	}

	common.SetContextKey(c, constant.ContextKeySkillBlockedEmitted, true)
	result.Emitted = true
	return result
}

func resolveBlockedDeps(deps *AbortSkillRelayBlockedDeps) AbortSkillRelayBlockedDeps {
	if deps == nil {
		return AbortSkillRelayBlockedDeps{
			Writer:           currentSkillBlockedWriter(),
			OmissionRecorder: defaultSkillBlockedOmissionRecorder,
			FailureRecorder:  defaultSkillBlockedFailureRecorder,
		}
	}
	resolved := *deps
	if resolved.Writer == nil {
		resolved.Writer = currentSkillBlockedWriter()
	}
	if resolved.OmissionRecorder == nil {
		resolved.OmissionRecorder = defaultSkillBlockedOmissionRecorder
	}
	if resolved.FailureRecorder == nil {
		resolved.FailureRecorder = defaultSkillBlockedFailureRecorder
	}
	return resolved
}

// SetBlockedEventWriterForTest is a test hook for cross-package DR-70
// integration tests. Production code must not call it. Tests that use it
// must restore the previous writer with the returned cleanup function.
func SetBlockedEventWriterForTest(writer SkillBlockedWriter) func() {
	blockedEventWriterMu.Lock()
	previous := blockedEventWriterOverride
	blockedEventWriterOverride = writer
	blockedEventWriterMu.Unlock()
	return func() {
		blockedEventWriterMu.Lock()
		blockedEventWriterOverride = previous
		blockedEventWriterMu.Unlock()
	}
}

// blockedRequestID implements DR-70 Workstream 3 ownership:
// reuse SkillRelayContext.RequestID when it already exists; otherwise generate
// a correlation-only request_id through the shared envelope helper path.
// The generated request_id must not imply successful Resolve() or the existence
// of a SkillRelayContext.
func blockedRequestID(c *gin.Context) string {
	if skillCtx, ok := Get(c); ok && skillCtx.RequestID != "" {
		c.Set(common.RequestIdKey, skillCtx.RequestID)
		c.Header(common.RequestIdKey, skillCtx.RequestID)
		return skillCtx.RequestID
	}
	return skillapi.RequestID(c)
}

func buildBlockedEvent(c *gin.Context, input AbortSkillRelayBlockedInput, requestID string, blockReason enums.BlockReason, entryPoint enums.EntryPoint) (skillmodel.SkillUsageEvent, error) {
	event := skillmodel.SkillUsageEvent{
		EventType:  enums.SkillUsageEventTypeBlocked,
		RequestID:  ptr(requestID),
		EntryPoint: entryPoint,
		BlockReason: func() *enums.BlockReason {
			v := blockReason
			return &v
		}(),
		ErrorCode: ptr(string(input.ErrorCode)),
		Success:   ptr(false),
	}

	if skillCtx, ok := Get(c); ok && skillCtx != nil {
		if skillCtx.SkillID != "" {
			event.SkillID = ptr(skillCtx.SkillID)
		}
		if skillCtx.SkillVersionID != "" {
			event.SkillVersionID = ptr(skillCtx.SkillVersionID)
		}
		if skillCtx.UserID > 0 {
			uid := int64(skillCtx.UserID)
			event.UserID = &uid
			event.TenantID = &uid
		}
		if skillCtx.Plan.Valid() {
			plan := skillCtx.Plan
			event.Plan = &plan
		}
		event.IsKidsSession = skillCtx.IsKidsSession
		if skillCtx.IsKidsSession && skillCtx.UserID > 0 {
			if err := skillanalytics.ApplyKidsSessionIdentity(&event, int64(skillCtx.UserID), int64(skillCtx.UserID)); err != nil {
				return event, err
			}
		}
		return event, nil
	}

	if input.SkillID != "" {
		event.SkillID = ptr(input.SkillID)
	}
	if userID := common.GetContextKeyInt(c, constant.ContextKeyUserId); userID > 0 {
		uid := int64(userID)
		event.UserID = &uid
		event.TenantID = &uid
		if airbotixUser, ok := common.GetContextKeyType[*platformmodel.User](c, constant.ContextKeyAirbotixUser); ok && airbotixUser != nil && airbotixUser.KidsMode {
			if err := skillanalytics.ApplyKidsSessionIdentity(&event, uid, uid); err != nil {
				return event, err
			}
		}
	}
	return event, nil
}

func defaultSkillBlockedWriter(_ *gin.Context, event *skillmodel.SkillUsageEvent) error {
	if db == nil {
		return fmt.Errorf("skill_blocked writer: relay db is nil")
	}
	return skillmodel.EmitSkillUsageEvent(db, *event)
}

func currentSkillBlockedWriter() SkillBlockedWriter {
	blockedEventWriterMu.RLock()
	defer blockedEventWriterMu.RUnlock()
	if blockedEventWriterOverride != nil {
		return blockedEventWriterOverride
	}
	return defaultSkillBlockedWriter
}

func defaultSkillBlockedOmissionRecorder(c *gin.Context, result AbortSkillRelayBlockedResult) {
	logger.LogWarn(c, fmt.Sprintf("dr70 skill_blocked omitted: request_id=%s error_code=%s real_entry_point_unavailable", result.RequestID, result.ErrorCode))
}

func defaultSkillBlockedFailureRecorder(c *gin.Context, result AbortSkillRelayBlockedResult) {
	errText := "<nil>"
	if result.WriteError != nil {
		errText = result.WriteError.Error()
	}
	logger.LogError(c, fmt.Sprintf("dr70 skill_blocked write failed: request_id=%s error_code=%s err=%s", result.RequestID, result.ErrorCode, errText))
}

func ptr[T any](v T) *T {
	return &v
}
