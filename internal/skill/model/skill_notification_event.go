package skillmodel

import (
	"fmt"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/internal/skill/enums"
	"gorm.io/gorm"
)

func EmitSkillNotificationEvent(db *gorm.DB, userID int64, skillID *string, eventType enums.SkillUsageEventType, entryPoint enums.EntryPoint, metadata map[string]any) error {
	if eventType != enums.SkillUsageEventTypeNotificationSent &&
		eventType != enums.SkillUsageEventTypeNotificationOpened &&
		eventType != enums.SkillUsageEventTypeNotificationClicked {
		return fmt.Errorf("skill_usage_events: invalid notification event_type %q", eventType)
	}
	if entryPoint != enums.EntryPointDigest && entryPoint != enums.EntryPointReengage {
		return fmt.Errorf("skill_usage_events: invalid notification entry_point %q", entryPoint)
	}
	if metadata == nil {
		metadata = map[string]any{}
	}
	meta, err := common.Marshal(metadata)
	if err != nil {
		return err
	}
	success := true
	return EmitSkillUsageEvent(db, SkillUsageEvent{
		EventType:  eventType,
		UserID:     &userID,
		TenantID:   &userID,
		SkillID:    skillID,
		EntryPoint: entryPoint,
		Success:    &success,
		Metadata:   SkillJSONB(meta),
	})
}
