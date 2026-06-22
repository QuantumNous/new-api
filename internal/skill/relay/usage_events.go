package skillrelay

import (
	"fmt"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/internal/skill/enums"
	skillmodel "github.com/QuantumNous/new-api/internal/skill/model"
	"gorm.io/gorm"
)

const (
	AIDisclosureHeader = "X-DeepRouter-AI-Disclosure"
	AIDisclosureText   = "AI-generated content. Review before use."
)

type SuccessfulExecutionEventInput struct {
	Context   *SkillRelayContext
	Usage     *dto.Usage
	Model     string
	LatencyMS int
}

func EmitSuccessfulExecution(input SuccessfulExecutionEventInput) error {
	return emitSuccessfulExecution(db, input)
}

func emitSuccessfulExecution(database *gorm.DB, input SuccessfulExecutionEventInput) error {
	if database == nil {
		return fmt.Errorf("skill_usage_events: database is not configured")
	}
	if input.Context == nil {
		return fmt.Errorf("skill_usage_events: skill relay context is required")
	}
	if input.Context.SkillID == "" {
		return fmt.Errorf("skill_usage_events: skill_id is required")
	}
	if input.Context.SkillVersionID == "" {
		return fmt.Errorf("skill_usage_events: skill_version_id is required")
	}
	if input.Context.IsKidsSession {
		return fmt.Errorf("skill_usage_events: kids pseudonymous analytics salt is not configured")
	}

	return database.Transaction(func(tx *gorm.DB) error {
		usedBefore, err := successfulUseCount(tx, input.Context)
		if err != nil {
			return err
		}

		if err := skillmodel.EmitSkillUsageEvent(tx, buildSuccessfulExecutionEvent(
			input,
			enums.SkillUsageEventTypeUsed,
			nil,
		)); err != nil {
			return err
		}

		if usedBefore == 0 {
			return skillmodel.EmitSkillUsageEvent(tx, buildSuccessfulExecutionEvent(
				input,
				enums.SkillUsageEventTypeFirstUse,
				nil,
			))
		}

		repeatIndex := int(usedBefore) + 1
		return skillmodel.EmitSkillUsageEvent(tx, buildSuccessfulExecutionEvent(
			input,
			enums.SkillUsageEventTypeRepeatUse,
			&repeatIndex,
		))
	})
}

func successfulUseCount(tx *gorm.DB, ctx *SkillRelayContext) (int64, error) {
	var count int64
	if err := tx.Model(&skillmodel.SkillUsageEvent{}).
		Where("event_type = ? AND user_id = ? AND skill_id = ? AND success = ?", enums.SkillUsageEventTypeUsed, ctx.UserID, ctx.SkillID, true).
		Count(&count).Error; err != nil {
		return 0, err
	}
	return count, nil
}

func buildSuccessfulExecutionEvent(input SuccessfulExecutionEventInput, eventType enums.SkillUsageEventType, repeatIndex *int) skillmodel.SkillUsageEvent {
	ctx := input.Context
	userID := int64(ctx.UserID)
	skillID := ctx.SkillID
	skillVersionID := ctx.SkillVersionID
	requestID := ctx.RequestID
	entryPoint := normalizedSuccessEntryPoint(ctx.EntryPoint)
	plan := ctx.Plan
	success := true
	subscriptionStatus := "inactive"
	if ctx.SubActive {
		subscriptionStatus = "active"
	}
	isKidsSafeSkill := false
	isKidsExclusiveSkill := false
	if ctx.Skill != nil {
		isKidsSafeSkill = ctx.Skill.IsKidsSafe
		isKidsExclusiveSkill = ctx.Skill.IsKidsExclusive
	}

	inputTokens, outputTokens, totalTokens := tokenCounts(input.Usage)
	latencyMS := input.LatencyMS
	if latencyMS < 0 {
		latencyMS = 0
	}
	modelName := input.Model

	return skillmodel.SkillUsageEvent{
		EventType:            eventType,
		OccurredAt:           time.Now().UTC(),
		UserID:               &userID,
		TenantID:             &userID,
		RequestID:            stringPtrOrNil(requestID),
		SkillID:              &skillID,
		SkillVersionID:       &skillVersionID,
		EntryPoint:           entryPoint,
		Plan:                 &plan,
		SubscriptionStatus:   &subscriptionStatus,
		Model:                stringPtrOrNil(modelName),
		IsKidsSession:        false,
		IsKidsSafeSkill:      &isKidsSafeSkill,
		IsKidsExclusiveSkill: &isKidsExclusiveSkill,
		InputTokens:          inputTokens,
		OutputTokens:         outputTokens,
		TotalTokens:          totalTokens,
		LatencyMS:            &latencyMS,
		Success:              &success,
		Metadata:             successMetadata(repeatIndex),
	}
}

func normalizedSuccessEntryPoint(entryPoint string) enums.EntryPoint {
	// DR-73: new R2 execution events must emit skill_package. The legacy
	// playground_picker value remains parseable for historical rows only.
	if entryPoint == "" || enums.EntryPoint(entryPoint) == enums.EntryPointPlaygroundPicker {
		return enums.EntryPointSkillPackage
	}
	return enums.EntryPoint(entryPoint)
}

func tokenCounts(usage *dto.Usage) (*int, *int, *int) {
	if usage == nil {
		return nil, nil, nil
	}
	inputTokens := usage.PromptTokens
	if inputTokens == 0 {
		inputTokens = usage.InputTokens
	}
	outputTokens := usage.CompletionTokens
	if outputTokens == 0 {
		outputTokens = usage.OutputTokens
	}
	totalTokens := usage.TotalTokens
	if totalTokens == 0 && (inputTokens != 0 || outputTokens != 0) {
		totalTokens = inputTokens + outputTokens
	}
	return &inputTokens, &outputTokens, &totalTokens
}

func successMetadata(repeatIndex *int) skillmodel.SkillJSONB {
	metadata := map[string]any{
		"schema_version": "1.0",
		"producer":       "relay",
	}
	if repeatIndex != nil {
		metadata["repeat_index"] = *repeatIndex
	}
	data, err := common.Marshal(metadata)
	if err != nil {
		return skillmodel.SkillJSONB(`{"schema_version":"1.0","producer":"relay"}`)
	}
	return skillmodel.SkillJSONB(data)
}

func stringPtrOrNil(value string) *string {
	if value == "" {
		return nil
	}
	return &value
}
