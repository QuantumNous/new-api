package origin

import (
	"errors"
	"strconv"
	"time"

	"github.com/QuantumNous/new-api/model"
	"github.com/google/uuid"
)

type UsageObservation struct {
	InputTokens       int
	OutputTokens      int
	CachedTokens      int
	ReasoningTokens   int
	ProviderRequestID string
}

type AttemptOutcome struct {
	TerminalStatus    string
	ContactState      string
	Usage             *UsageObservation
	ProviderRequestID string
	ErrorCategory     string
}

func BuildUsageEvent(eventID string, outcomeVersion int64, attempt model.OriginRequestAttempt, outcome AttemptOutcome, completedAt, producedAt time.Time, stream bool) (MeteringUsageRecordedV2, error) {
	if _, err := uuid.Parse(eventID); err != nil || outcomeVersion < 1 {
		return MeteringUsageRecordedV2{}, errors.New("invalid Origin usage event identity")
	}
	for _, value := range []string{attempt.ID, attempt.RequestID, attempt.ReservationID, attempt.TenantID, attempt.ProjectID, attempt.APIKeyID} {
		if _, err := uuid.Parse(value); err != nil {
			return MeteringUsageRecordedV2{}, errors.New("invalid Origin usage correlation identity")
		}
	}
	if attempt.CatalogVersion < 1 || attempt.RouteID == "" || attempt.PlatformModel == "" || attempt.UpstreamModelID == "" || attempt.StartedAt.IsZero() || completedAt.Before(attempt.StartedAt) {
		return MeteringUsageRecordedV2{}, errors.New("invalid Origin usage attempt")
	}
	if !allowedTerminalStatus(outcome.TerminalStatus) || !allowedContactState(outcome.ContactState) {
		return MeteringUsageRecordedV2{}, errors.New("invalid Origin usage outcome")
	}
	if outcome.ErrorCategory != "" && !catalogIdentifierPattern.MatchString(outcome.ErrorCategory) {
		return MeteringUsageRecordedV2{}, errors.New("invalid Origin usage error category")
	}

	baseOperation := attempt.Operation
	if baseOperation == "" {
		baseOperation = "responses"
	}
	if baseOperation != "responses" && baseOperation != "messages" {
		return MeteringUsageRecordedV2{}, errors.New("invalid Origin usage operation")
	}
	operation := baseOperation
	if stream {
		operation += "_stream"
	}
	event := MeteringUsageRecordedV2{
		EventID:          eventID,
		EventType:        "metering.usage_recorded.v2",
		EventVersion:     MeteringUsageEventVersion,
		OccurredAt:       completedAt.UTC().Format(time.RFC3339Nano),
		ProducedAt:       producedAt.UTC().Format(time.RFC3339Nano),
		Producer:         "new-api",
		PartitionKey:     "reservation:" + attempt.ReservationID,
		RequestID:        attempt.RequestID,
		RequestAttemptID: attempt.ID,
		ReservationID:    attempt.ReservationID,
		OutcomeVersion:   outcomeVersion,
		TenantID:         attempt.TenantID,
		ProjectID:        attempt.ProjectID,
		APIKeyID:         attempt.APIKeyID,
		Source:           "api",
		Operation:        operation,
		PlatformModel:    attempt.PlatformModel,
		CatalogVersion:   attempt.CatalogVersion,
		RouteID:          attempt.RouteID,
		Upstream: UpstreamEvidence{
			ContactState:      outcome.ContactState,
			Provider:          "beenex",
			UpstreamModelID:   attempt.UpstreamModelID,
			ProviderRequestID: stringPointerIfNotEmpty(outcome.ProviderRequestID),
		},
		TerminalStatus: outcome.TerminalStatus,
		StartedAt:      attempt.StartedAt.UTC().Format(time.RFC3339Nano),
		CompletedAt:    completedAt.UTC().Format(time.RFC3339Nano),
		Items:          []MeteringItem{},
		ErrorCategory:  stringPointerIfNotEmpty(outcome.ErrorCategory),
	}
	if outcome.Usage != nil {
		if outcome.Usage.InputTokens < 0 || outcome.Usage.OutputTokens < 0 || outcome.Usage.CachedTokens < 0 || outcome.Usage.ReasoningTokens < 0 ||
			(outcome.ContactState != "CONTACTED" && outcome.ContactState != "COMPLETED") {
			return MeteringUsageRecordedV2{}, errors.New("invalid Origin provider usage")
		}
		source := "PROVIDER"
		event.UsageStatus = "REPORTED"
		event.UsageSource = &source
		event.ReservationAction = "SETTLE"
		event.Reconciliation = Reconciliation{Status: "NOT_REQUIRED"}
		if outcome.Usage.ProviderRequestID != "" {
			event.Upstream.ProviderRequestID = stringPointerIfNotEmpty(outcome.Usage.ProviderRequestID)
		}
		event.Items = append(event.Items,
			providerMeteringItem("INPUT_TOKEN", outcome.Usage.InputTokens),
			providerMeteringItem("OUTPUT_TOKEN", outcome.Usage.OutputTokens),
		)
		if outcome.Usage.CachedTokens > 0 {
			event.Items = append(event.Items, providerMeteringItem("CACHED_TOKEN", outcome.Usage.CachedTokens))
		}
		if outcome.Usage.ReasoningTokens > 0 {
			event.Items = append(event.Items, providerMeteringItem("REASONING_TOKEN", outcome.Usage.ReasoningTokens))
		}
		return event, nil
	}

	event.UsageSource = nil
	if outcome.ContactState == "NOT_CONTACTED" {
		event.UsageStatus = "NOT_APPLICABLE"
		event.ReservationAction = "RELEASE"
		event.Reconciliation = Reconciliation{Status: "NOT_REQUIRED"}
		return event, nil
	}
	event.UsageStatus = "MISSING"
	event.ReservationAction = "RECONCILE"
	reason := "USAGE_MISSING"
	if outcome.TerminalStatus == "CLIENT_DISCONNECTED" {
		reason = "CLIENT_DISCONNECTED"
	} else if outcome.ContactState == "OUTCOME_UNKNOWN" {
		reason = "UPSTREAM_OUTCOME_UNKNOWN"
	}
	event.Reconciliation = Reconciliation{Status: "REQUIRED", Reason: &reason}
	return event, nil
}

func providerMeteringItem(meterType string, quantity int) MeteringItem {
	value := strconv.Itoa(quantity)
	return MeteringItem{
		MeterType:     meterType,
		Quantity:      value,
		Unit:          "token",
		Source:        "PROVIDER",
		ProviderValue: &value,
	}
}

func stringPointerIfNotEmpty(value string) *string {
	if value == "" {
		return nil
	}
	return &value
}

func allowedTerminalStatus(status string) bool {
	switch status {
	case "SUCCESS", "CLIENT_DISCONNECTED", "CONTENT_FILTERED_OUTPUT", "UPSTREAM_ERROR", "UPSTREAM_TIMEOUT", "CONTENT_FILTERED_INPUT", "GATEWAY_REJECTED":
		return true
	default:
		return false
	}
}

func allowedContactState(state string) bool {
	switch state {
	case "NOT_CONTACTED", "CONTACTED", "OUTCOME_UNKNOWN", "COMPLETED":
		return true
	default:
		return false
	}
}
