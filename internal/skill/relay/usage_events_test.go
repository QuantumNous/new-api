package skillrelay

import (
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/internal/skill/enums"
	skillmodel "github.com/QuantumNous/new-api/internal/skill/model"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

func newUsageEventTestDB(t *testing.T) *gorm.DB {
	t.Helper()
	database, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{
		Logger: logger.Default.LogMode(logger.Silent),
	})
	require.NoError(t, err)
	require.NoError(t, skillmodel.MigrateSkillUsageEvents(database))
	return database
}

func TestEmitSuccessfulExecution_FirstAndRepeatEvents(t *testing.T) {
	database := newUsageEventTestDB(t)
	ctx := &SkillRelayContext{
		RequestID:      "req-dr69",
		SkillID:        "11111111-1111-4111-8111-111111111111",
		SkillVersionID: "22222222-2222-4222-8222-222222222222",
		UserID:         42,
		Plan:           enums.RequiredPlanPro,
		SubActive:      true,
		EntryPoint:     string(enums.EntryPointSkillPackage),
		Skill: &skillmodel.Skill{
			IsKidsSafe:      true,
			IsKidsExclusive: false,
		},
	}
	usage := &dto.Usage{PromptTokens: 12, CompletionTokens: 8, TotalTokens: 20}

	require.NoError(t, emitSuccessfulExecution(database, SuccessfulExecutionEventInput{
		Context:   ctx,
		Usage:     usage,
		Model:     "approved-model",
		LatencyMS: 1234,
	}))

	var firstRows []skillmodel.SkillUsageEvent
	require.NoError(t, database.Order("event_type").Find(&firstRows).Error)
	require.Len(t, firstRows, 2)
	assertEventTypes(t, firstRows, []enums.SkillUsageEventType{
		enums.SkillUsageEventTypeFirstUse,
		enums.SkillUsageEventTypeUsed,
	})
	for _, event := range firstRows {
		assert.Equal(t, enums.EntryPointSkillPackage, event.EntryPoint)
		require.NotNil(t, event.Success)
		assert.True(t, *event.Success)
		require.NotNil(t, event.SkillID)
		assert.Equal(t, ctx.SkillID, *event.SkillID)
		require.NotNil(t, event.SkillVersionID)
		assert.Equal(t, ctx.SkillVersionID, *event.SkillVersionID)
		require.NotNil(t, event.Model)
		assert.Equal(t, "approved-model", *event.Model)
		require.NotNil(t, event.InputTokens)
		assert.Equal(t, 12, *event.InputTokens)
		require.NotNil(t, event.OutputTokens)
		assert.Equal(t, 8, *event.OutputTokens)
		require.NotNil(t, event.TotalTokens)
		assert.Equal(t, 20, *event.TotalTokens)
		require.NotNil(t, event.LatencyMS)
		assert.Equal(t, 1234, *event.LatencyMS)

		var metadata map[string]any
		require.NoError(t, common.Unmarshal(event.Metadata, &metadata))
		assert.Equal(t, "1.0", metadata["schema_version"])
		assert.Equal(t, "relay", metadata["producer"])
		assert.NotContains(t, metadata, "prompt")
		assert.NotContains(t, metadata, "raw_messages")
		assert.NotContains(t, metadata, "provider_payload")
		assert.NotContains(t, metadata, "model_output")
	}

	require.NoError(t, emitSuccessfulExecution(database, SuccessfulExecutionEventInput{
		Context:   ctx,
		Usage:     usage,
		Model:     "approved-model",
		LatencyMS: 1400,
	}))

	var repeat skillmodel.SkillUsageEvent
	require.NoError(t, database.Where("event_type = ?", enums.SkillUsageEventTypeRepeatUse).Take(&repeat).Error)
	var repeatMetadata map[string]any
	require.NoError(t, common.Unmarshal(repeat.Metadata, &repeatMetadata))
	assert.EqualValues(t, 2, repeatMetadata["repeat_index"])

	var usedCount int64
	require.NoError(t, database.Model(&skillmodel.SkillUsageEvent{}).
		Where("event_type = ? AND user_id = ? AND skill_id = ? AND success = ?", enums.SkillUsageEventTypeUsed, int64(42), ctx.SkillID, true).
		Count(&usedCount).Error)
	assert.EqualValues(t, 2, usedCount)
}

func TestEmitSuccessfulExecution_NormalizesLegacyEntryPointToSkillPackage(t *testing.T) {
	database := newUsageEventTestDB(t)
	ctx := &SkillRelayContext{
		RequestID:      "req-dr69-legacy",
		SkillID:        "33333333-3333-4333-8333-333333333333",
		SkillVersionID: "44444444-4444-4444-8444-444444444444",
		UserID:         7,
		Plan:           enums.RequiredPlanFree,
		SubActive:      true,
		EntryPoint:     string(enums.EntryPointPlaygroundPicker),
	}

	require.NoError(t, emitSuccessfulExecution(database, SuccessfulExecutionEventInput{
		Context:   ctx,
		Usage:     &dto.Usage{InputTokens: 3, OutputTokens: 4},
		Model:     "deeprouter-auto",
		LatencyMS: 10,
	}))

	var events []skillmodel.SkillUsageEvent
	require.NoError(t, database.Find(&events).Error)
	require.Len(t, events, 2)
	for _, event := range events {
		assert.Equal(t, enums.EntryPointSkillPackage, event.EntryPoint)
		require.NotNil(t, event.TotalTokens)
		assert.Equal(t, 7, *event.TotalTokens)
	}
}

func TestEmitSuccessfulExecution_KidsSessionDoesNotPersistRealIdentityWithoutSalt(t *testing.T) {
	database := newUsageEventTestDB(t)
	err := emitSuccessfulExecution(database, SuccessfulExecutionEventInput{
		Context: &SkillRelayContext{
			RequestID:      "req-kids",
			SkillID:        "55555555-5555-4555-8555-555555555555",
			SkillVersionID: "66666666-6666-4666-8666-666666666666",
			UserID:         99,
			IsKidsSession:  true,
			Plan:           enums.RequiredPlanFree,
			SubActive:      true,
		},
		Usage:     &dto.Usage{PromptTokens: 1, CompletionTokens: 1, TotalTokens: 2},
		Model:     "safe-model",
		LatencyMS: 10,
	})
	require.Error(t, err)

	var count int64
	require.NoError(t, database.Model(&skillmodel.SkillUsageEvent{}).Count(&count).Error)
	assert.EqualValues(t, 0, count, "Kids analytics must not persist real user identity when pseudonymous salt is unavailable")
}

func assertEventTypes(t *testing.T, events []skillmodel.SkillUsageEvent, want []enums.SkillUsageEventType) {
	t.Helper()
	got := make([]enums.SkillUsageEventType, 0, len(events))
	for _, event := range events {
		got = append(got, event.EventType)
	}
	assert.ElementsMatch(t, want, got)
}
