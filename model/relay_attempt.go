package model

// RelayAttempt records one relay attempt against one upstream channel.
//
// One row per (request_id, attempt_index): a request retried across N channels
// produces N rows sharing a request_id, ordered by attempt_index from 0. The
// table is append-only, which is why it is safe to point LOG_SQL_DSN at
// ClickHouse and use this table as a training data source.
//
// Pointer columns mean "not observed", which is deliberately distinct from a
// zero value. A nil Temperature means the client never sent one; a zero
// Temperature means the client explicitly asked for deterministic sampling.
// A nil TtftMs means no content chunk ever arrived, which for a stream is a
// finding rather than missing data: the upstream sent only openers, pings or
// usage. Anything consuming this table for training must not conflate the two.
type RelayAttempt struct {
	Id        int64 `json:"id" gorm:"primaryKey"`
	CreatedAt int64 `json:"created_at" gorm:"bigint;index:idx_relay_attempts_created_at"`

	/* request identity */
	AttemptId    string `json:"attempt_id" gorm:"type:varchar(32);index:idx_relay_attempts_attempt_id"`
	RequestId    string `json:"request_id" gorm:"type:varchar(64);index:idx_relay_attempts_request_id"`
	AttemptIndex int    `json:"attempt_index"`

	/* channel identity */
	ChannelId         int    `json:"channel_id" gorm:"index:idx_relay_attempts_channel_id"`
	ChannelType       int    `json:"channel_type"`
	ModelName         string `json:"model_name" gorm:"type:varchar(255);index:idx_relay_attempts_model_name"`
	UpstreamModelName string `json:"upstream_model_name" gorm:"type:varchar(255)"`
	UsingGroup        string `json:"using_group" gorm:"type:varchar(64)"`

	/* request-side features */
	InputTokensEst int      `json:"input_tokens_est"`
	CharsLatin     int      `json:"chars_latin"`
	CharsHan       int      `json:"chars_han"`
	CharsOther     int      `json:"chars_other"`
	MaxTokensReq   *int32   `json:"max_tokens_req"`
	IsStream       bool     `json:"is_stream"`
	HasTools       bool     `json:"has_tools"`
	ToolsCount     int      `json:"tools_count"`
	Temperature    *float64 `json:"temperature"`
	TenantId       int      `json:"tenant_id" gorm:"index:idx_relay_attempts_tenant_id"`
	TokenId        int      `json:"token_id"`
	RelayFormat    string   `json:"relay_format" gorm:"type:varchar(32)"`
	RequestPath    string   `json:"request_path" gorm:"type:varchar(255)"`

	/* prefix features (populated from PR2) */
	PrefixHashSystem string `json:"prefix_hash_system" gorm:"type:varchar(32)"`
	PrefixHashTools  string `json:"prefix_hash_tools" gorm:"type:varchar(32)"`
	PrefixHashPrefix string `json:"prefix_hash_prefix" gorm:"type:text"`
	TaskTypeGuess    string `json:"task_type_guess" gorm:"type:varchar(32)"`
	TaskTypeGuessVer int    `json:"task_type_guess_ver"`

	/* pricing, as the ratios this gateway actually bills on.
	   price_in/price_out below stay null: billing here is a per-model-name ratio,
	   not a per-token unit price, so a unit price cannot be derived honestly. */
	ModelRatio      *float64 `json:"model_ratio"`
	CompletionRatio *float64 `json:"completion_ratio"`
	GroupRatio      *float64 `json:"group_ratio"`
	CacheRatio      *float64 `json:"cache_ratio"`
	ModelPrice      *float64 `json:"model_price"`

	/* result timing, all monotonic-derived milliseconds rather than the
	   whole-second use_time on the logs table */
	TsStart      int64  `json:"ts_start" gorm:"bigint"`
	TsFirstToken *int64 `json:"ts_first_token" gorm:"bigint"`
	TsEnd        int64  `json:"ts_end" gorm:"bigint"`

	TtftMs            *int64 `json:"ttft_ms"`
	TotalMs           int64  `json:"total_ms"`
	UpstreamMs        *int64 `json:"upstream_ms"`
	GatewayOverheadMs *int64 `json:"gateway_overhead_ms"`

	/* result labels */
	Ok              bool   `json:"ok"`
	OutcomeCode     string `json:"outcome_code" gorm:"type:varchar(32);index:idx_relay_attempts_outcome_code"`
	HttpStatus      *int32 `json:"http_status"`
	UpstreamErrHash string `json:"upstream_err_hash" gorm:"type:varchar(16);index:idx_relay_attempts_err_hash"`
	TerminatedBy    string `json:"terminated_by" gorm:"type:varchar(16)"`
	RetryAfterHint  *int32 `json:"retry_after_hint"`

	// InternalErrCode is this gateway's own error code, kept alongside
	// OutcomeCode so a misclassification can be traced back to its source.
	InternalErrCode string `json:"internal_err_code" gorm:"type:varchar(64)"`
	StreamEndReason string `json:"stream_end_reason" gorm:"type:varchar(16)"`

	/* usage and cost */
	InputTokensActual  *int32   `json:"input_tokens_actual"`
	OutputTokensActual *int32   `json:"output_tokens_actual"`
	CachedTokens       *int32   `json:"cached_tokens"`
	ReasoningTokens    *int32   `json:"reasoning_tokens"`
	FinishReason       string   `json:"finish_reason" gorm:"type:varchar(32)"`
	CostActual         *int32   `json:"cost_actual"`
	TpsActual          *float64 `json:"tps_actual"`
	StreamChunks       *int32   `json:"stream_chunks"`
}

func (RelayAttempt) TableName() string {
	return "relay_attempts"
}

// BatchInsertRelayAttempts appends a batch of attempt records to the log
// database. Callers are expected to be the async writer in pkg/attemptlog, not
// the relay hot path.
func BatchInsertRelayAttempts(attempts []*RelayAttempt) error {
	if len(attempts) == 0 {
		return nil
	}
	return LOG_DB.CreateInBatches(attempts, len(attempts)).Error
}
