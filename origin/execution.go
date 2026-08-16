package origin

import (
	"sync"

	"github.com/QuantumNous/new-api/model"
	"github.com/gin-gonic/gin"
)

const (
	executionContextKey = "origin_ai_execution"
	telemetryContextKey = "origin_ai_attempt_telemetry"
)

type Execution struct {
	Grant     AdmissionGrant
	ChannelID int
}

func SetExecution(c *gin.Context, execution Execution) {
	c.Set(executionContextKey, execution)
}

func ExecutionFromContext(c *gin.Context) (Execution, bool) {
	if c == nil {
		return Execution{}, false
	}
	value, ok := c.Get(executionContextKey)
	if !ok {
		return Execution{}, false
	}
	execution, ok := value.(Execution)
	return execution, ok
}

type AttemptTelemetry struct {
	mu                sync.Mutex
	Attempt           model.OriginRequestAttempt
	ContactState      string
	ProviderRequestID string
	Usage             *UsageObservation
	TerminalStatus    string
	ErrorCategory     string
}

func BeginAttempt(c *gin.Context, attempt model.OriginRequestAttempt) {
	c.Set(telemetryContextKey, &AttemptTelemetry{
		Attempt:      attempt,
		ContactState: model.OriginContactNotContacted,
	})
}

func MarkUpstreamContacted(c *gin.Context, providerRequestID string) {
	telemetry := telemetryFromContext(c)
	if telemetry == nil {
		return
	}
	telemetry.mu.Lock()
	telemetry.ContactState = model.OriginContactContacted
	if providerRequestID != "" {
		telemetry.ProviderRequestID = providerRequestID
	}
	telemetry.mu.Unlock()
}

func MarkUpstreamOutcomeUnknown(c *gin.Context) {
	telemetry := telemetryFromContext(c)
	if telemetry == nil {
		return
	}
	telemetry.mu.Lock()
	telemetry.ContactState = model.OriginContactUnknown
	telemetry.mu.Unlock()
}

func MarkUpstreamCompleted(c *gin.Context, providerRequestID string) {
	telemetry := telemetryFromContext(c)
	if telemetry == nil {
		return
	}
	telemetry.mu.Lock()
	telemetry.ContactState = model.OriginContactCompleted
	if providerRequestID != "" {
		telemetry.ProviderRequestID = providerRequestID
	}
	telemetry.mu.Unlock()
}

func MarkUpstreamFailed(c *gin.Context, providerRequestID string) {
	telemetry := telemetryFromContext(c)
	if telemetry == nil {
		return
	}
	telemetry.mu.Lock()
	telemetry.ContactState = model.OriginContactCompleted
	telemetry.TerminalStatus = "UPSTREAM_ERROR"
	telemetry.ErrorCategory = "upstream_error"
	if providerRequestID != "" {
		telemetry.ProviderRequestID = providerRequestID
	}
	telemetry.mu.Unlock()
}

func MarkUpstreamContentFilteredOutput(c *gin.Context, providerRequestID string) {
	telemetry := telemetryFromContext(c)
	if telemetry == nil {
		return
	}
	telemetry.mu.Lock()
	telemetry.ContactState = model.OriginContactCompleted
	telemetry.TerminalStatus = "CONTENT_FILTERED_OUTPUT"
	if providerRequestID != "" {
		telemetry.ProviderRequestID = providerRequestID
	}
	telemetry.mu.Unlock()
}

func ObserveProviderUsage(c *gin.Context, usage UsageObservation) {
	telemetry := telemetryFromContext(c)
	if telemetry == nil {
		return
	}
	telemetry.mu.Lock()
	telemetry.ContactState = model.OriginContactCompleted
	if usage.ProviderRequestID == "" {
		usage.ProviderRequestID = telemetry.ProviderRequestID
	}
	telemetry.ProviderRequestID = usage.ProviderRequestID
	copy := usage
	telemetry.Usage = &copy
	telemetry.mu.Unlock()
}

func AttemptTelemetrySnapshot(c *gin.Context) (model.OriginRequestAttempt, AttemptOutcome, bool) {
	telemetry := telemetryFromContext(c)
	if telemetry == nil {
		return model.OriginRequestAttempt{}, AttemptOutcome{}, false
	}
	telemetry.mu.Lock()
	defer telemetry.mu.Unlock()
	outcome := AttemptOutcome{
		TerminalStatus:    telemetry.TerminalStatus,
		ContactState:      telemetry.ContactState,
		ProviderRequestID: telemetry.ProviderRequestID,
		ErrorCategory:     telemetry.ErrorCategory,
	}
	if telemetry.Usage != nil {
		copy := *telemetry.Usage
		outcome.Usage = &copy
	}
	return telemetry.Attempt, outcome, true
}

func telemetryFromContext(c *gin.Context) *AttemptTelemetry {
	if c == nil {
		return nil
	}
	value, ok := c.Get(telemetryContextKey)
	if !ok {
		return nil
	}
	telemetry, _ := value.(*AttemptTelemetry)
	return telemetry
}
