package api

type Protocol string

const (
	ProtocolChat       Protocol = "chat"
	ProtocolResponses  Protocol = "responses"
	ProtocolMessages   Protocol = "messages"
	ProtocolTaskBridge Protocol = "task_bridge"
)

type Outcome string

const MaximumRetryAfterMS int64 = 24 * 60 * 60 * 1000

const (
	OutcomeSuccess           Outcome = "success"
	OutcomeAuth401           Outcome = "auth_401"
	OutcomeRateLimited429    Outcome = "rate_limited_429"
	OutcomeUpstream5xx       Outcome = "upstream_5xx"
	OutcomeClient4xx         Outcome = "client_4xx"
	OutcomeTransportPreWrite Outcome = "transport_pre_write"
	OutcomeWriteUnknown      Outcome = "write_unknown"
	OutcomeResponseCommitted Outcome = "response_committed"
)

type ErrorCode string

const (
	ErrorInvalidRequest      ErrorCode = "invalid_request"
	ErrorContractMismatch    ErrorCode = "contract_mismatch"
	ErrorSnapshotUnavailable ErrorCode = "snapshot_unavailable"
	ErrorSnapshotExpired     ErrorCode = "snapshot_expired"
	ErrorSignatureInvalid    ErrorCode = "signature_invalid"
	ErrorBindingUnavailable  ErrorCode = "binding_unavailable"
	ErrorOutcomeConflict     ErrorCode = "outcome_conflict"
)

type Binding struct {
	BindingID      string `json:"binding_id"`
	ProtocolPlugin string `json:"protocol_plugin"`
	Rank           int    `json:"rank"`
	CostMicrounits int64  `json:"cost_microunits,omitempty"`
}

type RouteRequest struct {
	Kind             string    `json:"kind"`
	SchemaVersion    int       `json:"schema_version"`
	RequestID        string    `json:"request_id"`
	Group            string    `json:"group"`
	Model            string    `json:"model"`
	Protocol         Protocol  `json:"protocol"`
	AttemptLimit     int       `json:"attempt_limit"`
	SnapshotRevision string    `json:"snapshot_revision,omitempty"`
	Bindings         []Binding `json:"bindings,omitempty"`
}

type RouteResponse struct {
	Kind             string    `json:"kind"`
	SchemaVersion    int       `json:"schema_version"`
	RequestID        string    `json:"request_id"`
	SnapshotRevision string    `json:"snapshot_revision"`
	ExpiresAt        int64     `json:"expires_at"`
	Bindings         []Binding `json:"bindings"`
	Signature        string    `json:"signature"`
}

type SnapshotRoute struct {
	Group    string    `json:"group"`
	Model    string    `json:"model"`
	Protocol Protocol  `json:"protocol"`
	Bindings []Binding `json:"bindings"`
}

type SignedSnapshot struct {
	Kind                 string          `json:"kind"`
	SchemaVersion        int             `json:"schema_version"`
	Revision             string          `json:"revision"`
	IssuedAt             int64           `json:"issued_at"`
	ExpiresAt            int64           `json:"expires_at"`
	ConfigSHA256         string          `json:"config_sha256"`
	PluginManifestSHA256 string          `json:"plugin_manifest_sha256"`
	Routes               []SnapshotRoute `json:"routes"`
	Signature            string          `json:"signature"`
}

type AttemptOutcome struct {
	Kind          string   `json:"kind"`
	SchemaVersion int      `json:"schema_version"`
	EventID       string   `json:"event_id"`
	RequestID     string   `json:"request_id"`
	BindingID     string   `json:"binding_id"`
	Protocol      Protocol `json:"protocol"`
	Outcome       Outcome  `json:"outcome"`
	LatencyMS     int64    `json:"latency_ms,omitempty"`
	TTFTMS        int64    `json:"ttft_ms,omitempty"`
	RetryAfterMS  int64    `json:"retry_after_ms,omitempty"`
}

type ContractError struct {
	Kind          string    `json:"kind"`
	SchemaVersion int       `json:"schema_version"`
	Code          ErrorCode `json:"code"`
	Retryable     bool      `json:"retryable"`
	RequestID     string    `json:"request_id,omitempty"`
	Message       string    `json:"message,omitempty"`
}

func (e ContractError) Error() string {
	if e.Message != "" {
		return string(e.Code) + ": " + e.Message
	}
	return string(e.Code)
}

type Validatable interface {
	Validate() error
}
