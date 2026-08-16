package origin

import (
	"errors"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

const UsageTopic = "metering.usage-recorded.v2"

// RecoverStaleAttempts conservatively marks interrupted in-flight attempts for
// reconciliation. A process crash cannot prove whether BeeNex received the
// request, so it must never release the Platform reservation automatically.
func RecoverStaleAttempts(db *gorm.DB, staleBefore, recoveredAt time.Time, limit int) (int, error) {
	attempts, err := model.ListStaleOriginRequestAttempts(db, staleBefore, limit)
	if err != nil {
		return 0, err
	}
	recovered := 0
	for _, attempt := range attempts {
		completedAt := recoveredAt.UTC()
		if completedAt.Before(attempt.StartedAt) {
			completedAt = attempt.StartedAt
		}
		eventID := uuid.NewString()
		event, buildErr := BuildUsageEvent(eventID, int64(attempt.AttemptNumber), attempt, AttemptOutcome{
			TerminalStatus: "UPSTREAM_ERROR",
			ContactState:   model.OriginContactUnknown,
			ErrorCategory:  "process_interrupted",
		}, completedAt, recoveredAt.UTC(), attempt.Stream)
		if buildErr != nil {
			return recovered, buildErr
		}
		payload, marshalErr := common.Marshal(event)
		if marshalErr != nil {
			return recovered, marshalErr
		}
		outbox := &model.OriginUsageOutbox{
			ID:            eventID,
			AttemptID:     attempt.ID,
			RequestID:     attempt.RequestID,
			ReservationID: attempt.ReservationID,
			Topic:         UsageTopic,
			PartitionKey:  event.PartitionKey,
			Payload:       string(payload),
			Status:        model.OriginOutboxPending,
		}
		finalizeErr := model.FinalizeOriginRequestAttempt(db, attempt.ID, model.OriginAttemptReconciliation, model.OriginContactUnknown, completedAt, outbox)
		if errors.Is(finalizeErr, model.ErrOriginAttemptNotInProgress) {
			continue
		}
		if finalizeErr != nil {
			return recovered, finalizeErr
		}
		recovered++
	}
	return recovered, nil
}
