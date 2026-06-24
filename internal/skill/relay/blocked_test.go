package skillrelay

import (
	"errors"
	"net/http/httptest"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/internal/skill/enums"
	"github.com/QuantumNous/new-api/internal/skill/errcodes"
	skillmodel "github.com/QuantumNous/new-api/internal/skill/model"
	"github.com/gin-gonic/gin"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

func TestAbortSkillRelayBlocked_MappedErrcodeEmitsOnce(t *testing.T) {
	c := newBlockedTestContext()
	Set(c, &SkillRelayContext{
		RequestID:      "req-skill-1",
		SkillID:        "skill-1",
		SkillVersionID: "ver-1",
		UserID:         42,
		Plan:           enums.RequiredPlanPro,
		EntryPoint:     string(enums.EntryPointSkillPackage),
	})

	var wrote []*skillmodel.SkillUsageEvent
	result := AbortSkillRelayBlocked(c, AbortSkillRelayBlockedInput{
		ErrorCode:  errcodes.ErrSkillNotEnabled,
		EntryPoint: string(enums.EntryPointSkillPackage),
	}, &AbortSkillRelayBlockedDeps{
		Writer: func(_ *gin.Context, event *skillmodel.SkillUsageEvent) error {
			copied := *event
			wrote = append(wrote, &copied)
			return nil
		},
	})

	require.True(t, result.Mapped)
	assert.True(t, result.Emitted)
	assert.False(t, result.Omitted)
	assert.False(t, result.Duplicate)
	assert.False(t, result.WriteFailed)
	assert.Equal(t, "req-skill-1", result.RequestID)
	require.Len(t, wrote, 1)
	assert.Equal(t, enums.SkillUsageEventTypeBlocked, wrote[0].EventType)
	assert.Equal(t, enums.EntryPointSkillPackage, wrote[0].EntryPoint)
	require.NotNil(t, wrote[0].BlockReason)
	assert.Equal(t, enums.BlockReasonSkillNotEnabled, *wrote[0].BlockReason)
	require.NotNil(t, wrote[0].ErrorCode)
	assert.Equal(t, string(errcodes.ErrSkillNotEnabled), *wrote[0].ErrorCode)
	require.NotNil(t, wrote[0].RequestID)
	assert.Equal(t, "req-skill-1", *wrote[0].RequestID)
	require.NotNil(t, wrote[0].SkillID)
	assert.Equal(t, "skill-1", *wrote[0].SkillID)
	require.NotNil(t, wrote[0].SkillVersionID)
	assert.Equal(t, "ver-1", *wrote[0].SkillVersionID)
	require.NotNil(t, wrote[0].UserID)
	assert.Equal(t, int64(42), *wrote[0].UserID)
	require.NotNil(t, wrote[0].TenantID)
	assert.Equal(t, int64(42), *wrote[0].TenantID)
	require.NotNil(t, wrote[0].Plan)
	assert.Equal(t, enums.RequiredPlanPro, *wrote[0].Plan)
	require.NotNil(t, wrote[0].Success)
	assert.False(t, *wrote[0].Success)
	assert.Empty(t, wrote[0].Metadata, "DR-74 stamps metadata.schema_version at the persistence boundary")
	assert.True(t, common.GetContextKeyBool(c, constant.ContextKeySkillBlockedHandled))
	assert.True(t, common.GetContextKeyBool(c, constant.ContextKeySkillBlockedEmitted))
}

func TestAbortSkillRelayBlocked_IdempotencyMarkerPreventsDuplicate(t *testing.T) {
	c := newBlockedTestContext()

	var writes int
	deps := &AbortSkillRelayBlockedDeps{
		Writer: func(_ *gin.Context, event *skillmodel.SkillUsageEvent) error {
			writes++
			return nil
		},
	}

	first := AbortSkillRelayBlocked(c, AbortSkillRelayBlockedInput{
		ErrorCode:  errcodes.ErrSkillNotEnabled,
		EntryPoint: string(enums.EntryPointPlaygroundPicker),
	}, deps)
	second := AbortSkillRelayBlocked(c, AbortSkillRelayBlockedInput{
		ErrorCode:  errcodes.ErrSkillNotEnabled,
		EntryPoint: string(enums.EntryPointPlaygroundPicker),
	}, deps)

	assert.True(t, first.Emitted)
	assert.False(t, first.Duplicate)
	assert.False(t, second.Emitted)
	assert.True(t, second.Duplicate)
	assert.Equal(t, 1, writes)
	require.NotEmpty(t, first.RequestID)
	assert.Equal(t, first.RequestID, second.RequestID)
	assert.Equal(t, first.RequestID, c.GetString(common.RequestIdKey))
	assert.Equal(t, first.RequestID, c.Writer.Header().Get(common.RequestIdKey))
}

func TestAbortSkillRelayBlocked_UnmappedErrcodeDoesNotEmit(t *testing.T) {
	c := newBlockedTestContext()

	cases := []errcodes.ErrorCode{
		errcodes.ErrSkillInternalError,
		errcodes.ErrInvalidRequest,
		errcodes.ErrForbidden,
		errcodes.ErrSkillSafetyViolation,
		errcodes.ErrSkillEvaluationNotPassed,
	}

	for _, code := range cases {
		var writes int
		result := AbortSkillRelayBlocked(c, AbortSkillRelayBlockedInput{
			ErrorCode:  code,
			EntryPoint: string(enums.EntryPointPlaygroundPicker),
		}, &AbortSkillRelayBlockedDeps{
			Writer: func(_ *gin.Context, event *skillmodel.SkillUsageEvent) error {
				writes++
				return nil
			},
		})

		assert.False(t, result.Mapped)
		assert.False(t, result.Emitted)
		assert.False(t, result.Omitted)
		assert.False(t, result.WriteFailed)
		assert.Equal(t, 0, writes)
		assert.True(t, common.GetContextKeyBool(c, constant.ContextKeySkillBlockedHandled))
		assert.False(t, common.GetContextKeyBool(c, constant.ContextKeySkillBlockedEmitted))
		assert.Equal(t, code, result.ErrorCode)

		c = newBlockedTestContext()
	}
}

func TestAbortSkillRelayBlocked_MissingRealEntryPointRecordsOmission(t *testing.T) {
	c := newBlockedTestContext()

	var omissionCalls int
	var writes int
	result := AbortSkillRelayBlocked(c, AbortSkillRelayBlockedInput{
		ErrorCode: errcodes.ErrSkillNotFound,
	}, &AbortSkillRelayBlockedDeps{
		Writer: func(_ *gin.Context, event *skillmodel.SkillUsageEvent) error {
			writes++
			return nil
		},
		OmissionRecorder: func(_ *gin.Context, result AbortSkillRelayBlockedResult) {
			omissionCalls++
			assert.Equal(t, errcodes.ErrSkillNotFound, result.ErrorCode)
			assert.True(t, result.Omitted)
		},
	})

	assert.True(t, result.Mapped)
	assert.False(t, result.Emitted)
	assert.True(t, result.Omitted)
	assert.False(t, result.WriteFailed)
	assert.Equal(t, 0, writes)
	assert.Equal(t, 1, omissionCalls)
	assert.True(t, common.GetContextKeyBool(c, constant.ContextKeySkillBlockedHandled))
	assert.False(t, common.GetContextKeyBool(c, constant.ContextKeySkillBlockedEmitted))
}

func TestAbortSkillRelayBlocked_AnalyticsWriterFailurePreservesAPIError(t *testing.T) {
	c := newBlockedTestContext()

	writeErr := errors.New("writer failed")
	var failureCalls int
	var writes int
	result := AbortSkillRelayBlocked(c, AbortSkillRelayBlockedInput{
		ErrorCode:  errcodes.ErrSkillNotEnabled,
		EntryPoint: string(enums.EntryPointPlaygroundPicker),
	}, &AbortSkillRelayBlockedDeps{
		Writer: func(_ *gin.Context, event *skillmodel.SkillUsageEvent) error {
			writes++
			return writeErr
		},
		FailureRecorder: func(_ *gin.Context, result AbortSkillRelayBlockedResult) {
			failureCalls++
			assert.Equal(t, errcodes.ErrSkillNotEnabled, result.ErrorCode)
			assert.True(t, result.WriteFailed)
			assert.ErrorIs(t, result.WriteError, writeErr)
		},
	})

	assert.True(t, result.Mapped)
	assert.False(t, result.Emitted)
	assert.False(t, result.Omitted)
	assert.True(t, result.WriteFailed)
	assert.ErrorIs(t, result.WriteError, writeErr)
	assert.Equal(t, errcodes.ErrSkillNotEnabled, result.ErrorCode)
	assert.Equal(t, 1, writes)
	assert.Equal(t, 1, failureCalls)
	assert.True(t, common.GetContextKeyBool(c, constant.ContextKeySkillBlockedHandled))
	assert.False(t, common.GetContextKeyBool(c, constant.ContextKeySkillBlockedEmitted))
}

func TestAbortSkillRelayBlocked_NoContextFallsBackToInputSkillID(t *testing.T) {
	c := newBlockedTestContext()
	common.SetContextKey(c, constant.ContextKeyUserId, 7)

	var wrote []*skillmodel.SkillUsageEvent
	result := AbortSkillRelayBlocked(c, AbortSkillRelayBlockedInput{
		ErrorCode:  errcodes.ErrSkillNotFound,
		EntryPoint: string(enums.EntryPointSkillPackage),
		SkillID:    "input-skill-id",
	}, &AbortSkillRelayBlockedDeps{
		Writer: func(_ *gin.Context, event *skillmodel.SkillUsageEvent) error {
			copied := *event
			wrote = append(wrote, &copied)
			return nil
		},
	})

	require.True(t, result.Emitted)
	require.Len(t, wrote, 1)
	require.NotNil(t, wrote[0].SkillID)
	assert.Equal(t, "input-skill-id", *wrote[0].SkillID)
	assert.Nil(t, wrote[0].SkillVersionID)
	require.NotNil(t, wrote[0].UserID)
	assert.Equal(t, int64(7), *wrote[0].UserID)
	require.NotNil(t, wrote[0].TenantID)
	assert.Equal(t, int64(7), *wrote[0].TenantID)
	assert.Nil(t, wrote[0].Plan)
	require.NotNil(t, wrote[0].Success)
	assert.False(t, *wrote[0].Success)
	assert.Empty(t, wrote[0].Metadata, "DR-74 stamps metadata.schema_version at the persistence boundary")
}

func TestAbortSkillRelayBlocked_RequestIDBranches(t *testing.T) {
	t.Run("reuse skill relay context request id", func(t *testing.T) {
		c := newBlockedTestContext()
		Set(c, &SkillRelayContext{RequestID: "req-from-skill-ctx"})

		result := AbortSkillRelayBlocked(c, AbortSkillRelayBlockedInput{
			ErrorCode:  errcodes.ErrSkillNotFound,
			EntryPoint: string(enums.EntryPointSkillPackage),
		}, &AbortSkillRelayBlockedDeps{
			Writer: func(_ *gin.Context, event *skillmodel.SkillUsageEvent) error { return nil },
		})

		assert.Equal(t, "req-from-skill-ctx", result.RequestID)
		assert.Equal(t, "req-from-skill-ctx", c.GetString(common.RequestIdKey))
		assert.Equal(t, "req-from-skill-ctx", c.Writer.Header().Get(common.RequestIdKey))
	})

	t.Run("generate request id without skill relay context", func(t *testing.T) {
		c := newBlockedTestContext()

		result := AbortSkillRelayBlocked(c, AbortSkillRelayBlockedInput{
			ErrorCode:  errcodes.ErrAuthRequired,
			EntryPoint: string(enums.EntryPointPlaygroundPicker),
		}, &AbortSkillRelayBlockedDeps{
			Writer: func(_ *gin.Context, event *skillmodel.SkillUsageEvent) error {
				require.NotNil(t, event.RequestID)
				assert.NotEmpty(t, *event.RequestID)
				return nil
			},
		})

		assert.NotEmpty(t, result.RequestID)
		assert.Equal(t, result.RequestID, c.GetString(common.RequestIdKey))
		assert.Equal(t, result.RequestID, c.Writer.Header().Get(common.RequestIdKey))
		_, hasSkillCtx := Get(c)
		assert.False(t, hasSkillCtx, "generated request_id must not imply a successful SkillRelayContext")
	})

	t.Run("duplicate helper call does not regenerate request id", func(t *testing.T) {
		c := newBlockedTestContext()

		first := AbortSkillRelayBlocked(c, AbortSkillRelayBlockedInput{
			ErrorCode:  errcodes.ErrAuthRequired,
			EntryPoint: string(enums.EntryPointPlaygroundPicker),
		}, &AbortSkillRelayBlockedDeps{
			Writer: func(_ *gin.Context, event *skillmodel.SkillUsageEvent) error { return nil },
		})
		second := AbortSkillRelayBlocked(c, AbortSkillRelayBlockedInput{
			ErrorCode:  errcodes.ErrAuthRequired,
			EntryPoint: string(enums.EntryPointPlaygroundPicker),
		}, &AbortSkillRelayBlockedDeps{
			Writer: func(_ *gin.Context, event *skillmodel.SkillUsageEvent) error { return nil },
		})

		assert.NotEmpty(t, first.RequestID)
		assert.Equal(t, first.RequestID, second.RequestID)
		assert.True(t, second.Duplicate)
		assert.Equal(t, first.RequestID, c.GetString(common.RequestIdKey))
		assert.Equal(t, first.RequestID, c.Writer.Header().Get(common.RequestIdKey))
	})
}

func TestAbortSkillRelayBlocked_KidsSessionPersistsPseudonymousIdentity(t *testing.T) {
	t.Setenv("SKILL_KIDS_ANALYTICS_SALT_VERSION", "2026-06-24")
	t.Setenv("SKILL_KIDS_ANALYTICS_DAILY_SALT", "test-daily-salt")

	database := newBlockedTestDB(t)
	SetDB(database)
	t.Cleanup(func() { SetDB(nil) })

	c := newBlockedTestContext()
	Set(c, &SkillRelayContext{
		RequestID:      "req-kids-1",
		SkillID:        "skill-kids-1",
		SkillVersionID: "ver-kids-1",
		UserID:         42,
		Plan:           enums.RequiredPlanFree,
		EntryPoint:     string(enums.EntryPointSkillPackage),
		IsKidsSession:  true,
	})

	result := AbortSkillRelayBlocked(c, AbortSkillRelayBlockedInput{
		ErrorCode:  errcodes.ErrSkillNotFound,
		EntryPoint: string(enums.EntryPointSkillPackage),
	}, nil)

	require.True(t, result.Emitted)
	require.False(t, result.WriteFailed)

	var events []skillmodel.SkillUsageEvent
	require.NoError(t, database.Where("event_type = ?", enums.SkillUsageEventTypeBlocked).Find(&events).Error)
	require.Len(t, events, 1)
	assert.Nil(t, events[0].UserID, "kids blocked event must not persist real user_id")
	assert.Nil(t, events[0].TenantID, "kids blocked event must not persist real tenant_id")
	assert.True(t, events[0].IsKidsSession)
	require.NotNil(t, events[0].SessionID)
	assert.NotEmpty(t, *events[0].SessionID)
	require.NotNil(t, events[0].BlockReason)
	assert.Equal(t, enums.BlockReasonSkillNotFound, *events[0].BlockReason)
	require.NotNil(t, events[0].ErrorCode)
	assert.Equal(t, string(errcodes.ErrSkillNotFound), *events[0].ErrorCode)
	require.NotNil(t, events[0].RequestID)
	assert.Equal(t, "req-kids-1", *events[0].RequestID)
}

func newBlockedTestContext() *gin.Context {
	gin.SetMode(gin.TestMode)
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = httptest.NewRequest("POST", "/v1/routing/chat/completions", nil)
	return c
}

func newBlockedTestDB(t *testing.T) *gorm.DB {
	t.Helper()
	database, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{
		Logger: logger.Default.LogMode(logger.Silent),
	})
	require.NoError(t, err)
	require.NoError(t, skillmodel.MigrateSkillUsageEvents(database))
	return database
}
