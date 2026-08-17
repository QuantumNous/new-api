// Code generated from origin-contracts at CONTRACTS_SHA. DO NOT EDIT.

package origin

const (
	ContractsSHA                             = "1e34df23e450e9a2326772b3fea4e5c923d621be"
	ContractsSourceSHA256                    = "8207d66fc947531556f8f67fab921ee07023c7f85d78e7f897b232499ee71b8e"
	DataPlaneControlContractVersion          = "1.2.0"
	AnthropicCompatibleContractVersion       = "1.0.0-draft"
	CatalogExecutionSnapshotEventVersion     = 1
	MeteringUsageEventVersion                = 2
	CatalogExecutionSnapshotSchemaSourceHash = "8eb5f7f381a46cefa9f2b04cee59005769b4f40544d2d7eec13cb91e21ea5096"
	MeteringUsageSchemaSourceHash            = "7b6778982727a15a02a7d7b79c823352f61aeac40f0009ff5d1a5810ddf9758b"
)

type AdmissionRequest struct {
	RequestID             string   `json:"request_id"`
	PlatformModel         string   `json:"platform_model"`
	Operation             string   `json:"operation"`
	CatalogVersion        int64    `json:"catalog_version"`
	InputTokenEstimate    int64    `json:"input_token_estimate"`
	MaxOutputTokens       int      `json:"max_output_tokens"`
	Stream                bool     `json:"stream"`
	RequestedCapabilities []string `json:"requested_capabilities"`
}

type AdmissionResult struct {
	RequestID              string `json:"request_id"`
	TenantID               string `json:"tenant_id"`
	ProjectID              string `json:"project_id"`
	APIKeyID               string `json:"api_key_id"`
	ReservationID          string `json:"reservation_id"`
	ApprovedCatalogVersion int64  `json:"approved_catalog_version"`
	RouteID                string `json:"route_id"`
	ExpiresAt              string `json:"expires_at"`
}

type OriginModelList struct {
	RequestID      string   `json:"request_id"`
	TenantID       string   `json:"tenant_id"`
	ProjectID      string   `json:"project_id"`
	APIKeyID       string   `json:"api_key_id"`
	CatalogVersion int64    `json:"catalog_version"`
	Models         []string `json:"models"`
}

type AdmissionError struct {
	Code                  string `json:"code"`
	Message               string `json:"message"`
	Retryable             bool   `json:"retryable"`
	RetryAfterMS          *int   `json:"retry_after_ms,omitempty"`
	CurrentCatalogVersion *int64 `json:"current_catalog_version,omitempty"`
}

type AdmissionErrorEnvelope struct {
	Error     AdmissionError `json:"error"`
	RequestID string         `json:"request_id"`
}

type CatalogCapabilities struct {
	Streaming       bool `json:"streaming"`
	FunctionTools   bool `json:"function_tools"`
	Reasoning       bool `json:"reasoning"`
	MaxInputTokens  int  `json:"max_input_tokens"`
	MaxOutputTokens int  `json:"max_output_tokens"`
}

type CatalogExecutionRoute struct {
	RouteID           string              `json:"route_id"`
	PlatformModel     string              `json:"platform_model"`
	Operation         string              `json:"operation"`
	Capabilities      CatalogCapabilities `json:"capabilities"`
	ApprovedChannelID string              `json:"approved_channel_id"`
	UpstreamModelID   string              `json:"upstream_model_id"`
	UpstreamProtocol  string              `json:"upstream_protocol"`
	Status            string              `json:"status"`
}

type CatalogExecutionSnapshot struct {
	SnapshotVersion         int64                   `json:"snapshot_version"`
	PreviousSnapshotVersion *int64                  `json:"previous_snapshot_version"`
	FullSnapshot            bool                    `json:"full_snapshot"`
	PublishedAt             string                  `json:"published_at"`
	ExpiresAt               string                  `json:"expires_at"`
	Routes                  []CatalogExecutionRoute `json:"routes"`
	ContentSHA256           string                  `json:"content_sha256"`
}

type CatalogMetadata struct {
	Environment string `json:"environment,omitempty"`
	Region      string `json:"region,omitempty"`
}

type CatalogExecutionSnapshotPublishedV1 struct {
	EventID      string                   `json:"event_id"`
	EventType    string                   `json:"event_type"`
	EventVersion int                      `json:"event_version"`
	OccurredAt   string                   `json:"occurred_at"`
	ProducedAt   string                   `json:"produced_at"`
	Producer     string                   `json:"producer"`
	PartitionKey string                   `json:"partition_key"`
	Payload      CatalogExecutionSnapshot `json:"payload"`
	Metadata     CatalogMetadata          `json:"metadata"`
}

type UpstreamEvidence struct {
	ContactState      string  `json:"contact_state"`
	Provider          string  `json:"provider"`
	UpstreamModelID   string  `json:"upstream_model_id"`
	ProviderRequestID *string `json:"provider_request_id"`
}

type MeteringItem struct {
	MeterType     string  `json:"meter_type"`
	Quantity      string  `json:"quantity"`
	Unit          string  `json:"unit"`
	Source        string  `json:"source"`
	ProviderValue *string `json:"provider_value,omitempty"`
}

type Reconciliation struct {
	Status string  `json:"status"`
	Reason *string `json:"reason"`
}

type MeteringUsageRecordedV2 struct {
	EventID           string           `json:"event_id"`
	EventType         string           `json:"event_type"`
	EventVersion      int              `json:"event_version"`
	OccurredAt        string           `json:"occurred_at"`
	ProducedAt        string           `json:"produced_at"`
	Producer          string           `json:"producer"`
	PartitionKey      string           `json:"partition_key"`
	RequestID         string           `json:"request_id"`
	RequestAttemptID  string           `json:"request_attempt_id"`
	ReservationID     string           `json:"reservation_id"`
	OutcomeVersion    int64            `json:"outcome_version"`
	TenantID          string           `json:"tenant_id"`
	ProjectID         string           `json:"project_id"`
	APIKeyID          string           `json:"api_key_id"`
	Source            string           `json:"source"`
	Operation         string           `json:"operation"`
	PlatformModel     string           `json:"platform_model"`
	CatalogVersion    int64            `json:"catalog_version"`
	RouteID           string           `json:"route_id"`
	Upstream          UpstreamEvidence `json:"upstream"`
	TerminalStatus    string           `json:"terminal_status"`
	StartedAt         string           `json:"started_at"`
	CompletedAt       string           `json:"completed_at"`
	UsageStatus       string           `json:"usage_status"`
	UsageSource       *string          `json:"usage_source"`
	Items             []MeteringItem   `json:"items"`
	ReservationAction string           `json:"reservation_action"`
	Reconciliation    Reconciliation   `json:"reconciliation"`
	ErrorCategory     *string          `json:"error_category"`
}
