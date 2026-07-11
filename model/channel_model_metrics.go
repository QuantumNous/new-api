package model

import (
	"errors"
	"time"

	"github.com/QuantumNous/new-api/common"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

// ChannelModelMetrics is the persisted health & experience metrics for channel_id × effective_model (PRD §31 / §32).
// Runtime-only fields (Role, lease, concurrency, probe queue) are not columns.
type ChannelModelMetrics struct {
	ChannelID      int64  `json:"channel_id" gorm:"primaryKey;autoIncrement:false"`
	EffectiveModel string `json:"effective_model" gorm:"size:191;primaryKey;autoIncrement:false"`

	RouteState     string `json:"route_state" gorm:"column:route_state;size:32;not null;default:UNKNOWN"`
	LastErrorClass string `json:"last_error_class" gorm:"size:16"`
	CooldownUntil  *int64 `json:"cooldown_until" gorm:"bigint"`
	BackoffLevel   int    `json:"backoff_level" gorm:"not null;default:0"`

	ProductionSampleCount int64 `json:"production_sample_count" gorm:"not null;default:0"`
	ShadowSampleCount     int64 `json:"shadow_sample_count" gorm:"not null;default:0"`

	ProductionSuccessEMA      *float64 `json:"production_success_ema" gorm:"column:production_success_ema"`
	ShadowTransportSuccessEMA *float64 `json:"shadow_transport_success_ema" gorm:"column:shadow_transport_success_ema"`
	TemporaryErrorEMA         *float64 `json:"temporary_error_ema" gorm:"column:temporary_error_ema"`
	RateLimitEMA              *float64 `json:"rate_limit_ema" gorm:"column:rate_limit_ema"`
	TimeoutEMA                *float64 `json:"timeout_ema" gorm:"column:timeout_ema"`
	StreamInterruptionEMA     *float64 `json:"stream_interruption_ema" gorm:"column:stream_interruption_ema"`

	ProductionTTFTEMAMs         *float64 `json:"production_ttft_ema_ms" gorm:"column:production_ttft_ema_ms"`
	ShadowTTFTEMAMs             *float64 `json:"shadow_ttft_ema_ms" gorm:"column:shadow_ttft_ema_ms"`
	ProductionTotalLatencyEMAMs *float64 `json:"production_total_latency_ema_ms" gorm:"column:production_total_latency_ema_ms"`
	ShadowTotalLatencyEMAMs     *float64 `json:"shadow_total_latency_ema_ms" gorm:"column:shadow_total_latency_ema_ms"`
	ProductionTokensPerSecEMA   *float64 `json:"production_tokens_per_second_ema" gorm:"column:production_tokens_per_second_ema"`

	ShadowCalibrationJSON string   `json:"shadow_calibration_json" gorm:"type:text"`
	ExperienceScore       *float64 `json:"experience_score"`

	// Runtime counters not all in SQL schema of §32 — kept in-memory via runtime cache;
	// consecutive/recover/takeover are process-local and reset on restart unless later persisted.
	ConsecutiveFailures   int `json:"consecutive_failures" gorm:"-"`
	RecoverSuccessCount   int `json:"recover_success_count" gorm:"-"`
	TakeoverConfirmations int `json:"takeover_confirmations" gorm:"-"`

	LastRequestAt *int64 `json:"last_request_at" gorm:"bigint"`
	LastSuccessAt *int64 `json:"last_success_at" gorm:"bigint"`
	LastFailureAt *int64 `json:"last_failure_at" gorm:"bigint"`
	LastProbeAt   *int64 `json:"last_probe_at" gorm:"bigint"`

	CreatedAt int64 `json:"created_at" gorm:"bigint;not null"`
	UpdatedAt int64 `json:"updated_at" gorm:"bigint;not null"`
}

func (ChannelModelMetrics) TableName() string {
	return "channel_model_metrics"
}

func (m *ChannelModelMetrics) BeforeCreate(_ *gorm.DB) error {
	now := common.GetTimestamp()
	if m.CreatedAt == 0 {
		m.CreatedAt = now
	}
	if m.UpdatedAt == 0 {
		m.UpdatedAt = now
	}
	if m.RouteState == "" {
		m.RouteState = string(RouteUnknown)
	}
	return nil
}

func (m *ChannelModelMetrics) BeforeUpdate(_ *gorm.DB) error {
	m.UpdatedAt = common.GetTimestamp()
	return nil
}

func (m *ChannelModelMetrics) MetricsKey() MetricsKey {
	return MetricsKey{ChannelID: m.ChannelID, EffectiveModel: m.EffectiveModel}
}

func (m *ChannelModelMetrics) State() RouteState {
	if m == nil || m.RouteState == "" {
		return RouteUnknown
	}
	return RouteState(m.RouteState)
}

func (m *ChannelModelMetrics) SetState(state RouteState) {
	if m == nil {
		return
	}
	m.RouteState = string(state)
}

func (m *ChannelModelMetrics) GetLastErrorClass() ErrorClass {
	if m == nil {
		return ""
	}
	return ErrorClass(m.LastErrorClass)
}

func (m *ChannelModelMetrics) SetLastErrorClass(c ErrorClass) {
	if m == nil {
		return
	}
	m.LastErrorClass = string(c)
}

func (m *ChannelModelMetrics) CooldownUntilTime() time.Time {
	if m == nil || m.CooldownUntil == nil || *m.CooldownUntil == 0 {
		return time.Time{}
	}
	return time.Unix(*m.CooldownUntil, 0)
}

func (m *ChannelModelMetrics) SetCooldownUntil(t time.Time) {
	if m == nil {
		return
	}
	if t.IsZero() {
		m.CooldownUntil = nil
		return
	}
	v := t.Unix()
	m.CooldownUntil = &v
}

// ParseShadowCalibration unmarshals shadow_calibration_json into bucket map.
func (m *ChannelModelMetrics) ParseShadowCalibration() (map[string]CalibrationBucket, error) {
	out := make(map[string]CalibrationBucket)
	if m == nil || m.ShadowCalibrationJSON == "" {
		return out, nil
	}
	if err := common.UnmarshalJsonStr(m.ShadowCalibrationJSON, &out); err != nil {
		return nil, err
	}
	return out, nil
}

// SetShadowCalibration marshals bucket map into shadow_calibration_json.
func (m *ChannelModelMetrics) SetShadowCalibration(buckets map[string]CalibrationBucket) error {
	if m == nil {
		return errors.New("nil metrics")
	}
	if buckets == nil {
		m.ShadowCalibrationJSON = ""
		return nil
	}
	b, err := common.Marshal(buckets)
	if err != nil {
		return err
	}
	m.ShadowCalibrationJSON = string(b)
	return nil
}

// GetChannelModelMetrics loads one metrics row.
func GetChannelModelMetrics(channelID int64, effectiveModel string) (*ChannelModelMetrics, error) {
	var m ChannelModelMetrics
	err := DB.Where("channel_id = ? AND effective_model = ?", channelID, effectiveModel).First(&m).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &m, nil
}

// ListChannelModelMetricsByChannel returns all metrics for a channel.
func ListChannelModelMetricsByChannel(channelID int64) ([]ChannelModelMetrics, error) {
	var rows []ChannelModelMetrics
	err := DB.Where("channel_id = ?", channelID).Find(&rows).Error
	return rows, err
}

// ListAllChannelModelMetrics returns every metrics row.
func ListAllChannelModelMetrics() ([]ChannelModelMetrics, error) {
	var rows []ChannelModelMetrics
	err := DB.Find(&rows).Error
	return rows, err
}

// metricsSnapshotUpdateColumns are columns updated on periodic / critical snapshot upsert (PRD §17).
var metricsSnapshotUpdateColumns = []string{
	"route_state",
	"last_error_class",
	"cooldown_until",
	"backoff_level",
	"production_sample_count",
	"shadow_sample_count",
	"production_success_ema",
	"shadow_transport_success_ema",
	"temporary_error_ema",
	"rate_limit_ema",
	"timeout_ema",
	"stream_interruption_ema",
	"production_ttft_ema_ms",
	"shadow_ttft_ema_ms",
	"production_total_latency_ema_ms",
	"shadow_total_latency_ema_ms",
	"production_tokens_per_second_ema",
	"shadow_calibration_json",
	"experience_score",
	"last_request_at",
	"last_success_at",
	"last_failure_at",
	"last_probe_at",
	"updated_at",
}

// UpsertChannelModelMetrics inserts or overwrites metrics snapshot by primary key.
func UpsertChannelModelMetrics(m *ChannelModelMetrics) error {
	if m == nil {
		return errors.New("nil channel model metrics")
	}
	now := common.GetTimestamp()
	if m.CreatedAt == 0 {
		m.CreatedAt = now
	}
	m.UpdatedAt = now
	if m.RouteState == "" {
		m.RouteState = string(RouteUnknown)
	}
	return DB.Clauses(clause.OnConflict{
		Columns: []clause.Column{
			{Name: "channel_id"},
			{Name: "effective_model"},
		},
		DoUpdates: clause.AssignmentColumns(metricsSnapshotUpdateColumns),
	}).Create(m).Error
}

// UpsertChannelModelMetricsBatch batch-upserts metrics snapshots (PRD §17).
func UpsertChannelModelMetricsBatch(rows []ChannelModelMetrics) error {
	if len(rows) == 0 {
		return nil
	}
	now := common.GetTimestamp()
	for i := range rows {
		if rows[i].CreatedAt == 0 {
			rows[i].CreatedAt = now
		}
		rows[i].UpdatedAt = now
		if rows[i].RouteState == "" {
			rows[i].RouteState = string(RouteUnknown)
		}
	}
	return DB.Clauses(clause.OnConflict{
		Columns: []clause.Column{
			{Name: "channel_id"},
			{Name: "effective_model"},
		},
		DoUpdates: clause.AssignmentColumns(metricsSnapshotUpdateColumns),
	}).CreateInBatches(rows, 50).Error
}

// EnsureChannelModelMetrics returns existing metrics or creates UNKNOWN defaults (PRD §5.3).
func EnsureChannelModelMetrics(channelID int64, effectiveModel string) (*ChannelModelMetrics, error) {
	existing, err := GetChannelModelMetrics(channelID, effectiveModel)
	if err != nil {
		return nil, err
	}
	if existing != nil {
		return existing, nil
	}
	m := &ChannelModelMetrics{
		ChannelID:      channelID,
		EffectiveModel: effectiveModel,
		RouteState:     string(RouteUnknown),
	}
	if err := UpsertChannelModelMetrics(m); err != nil {
		return GetChannelModelMetrics(channelID, effectiveModel)
	}
	return m, nil
}

// ResetChannelModelMetricsRuntime clears short-term learning fields, keeps calibration (PRD §18.1).
func ResetChannelModelMetricsRuntime(channelID int64, effectiveModel string) error {
	return DB.Model(&ChannelModelMetrics{}).
		Where("channel_id = ? AND effective_model = ?", channelID, effectiveModel).
		Updates(map[string]interface{}{
			"production_sample_count":           0,
			"shadow_sample_count":               0,
			"production_success_ema":            nil,
			"shadow_transport_success_ema":      nil,
			"temporary_error_ema":               nil,
			"rate_limit_ema":                    nil,
			"timeout_ema":                       nil,
			"stream_interruption_ema":           nil,
			"production_ttft_ema_ms":            nil,
			"shadow_ttft_ema_ms":                nil,
			"production_total_latency_ema_ms":   nil,
			"shadow_total_latency_ema_ms":       nil,
			"production_tokens_per_second_ema":  nil,
			"experience_score":                  nil,
			"updated_at":                        common.GetTimestamp(),
		}).Error
}

// ResetChannelModelMetricsAll clears short-term metrics and calibration (PRD §18.2).
func ResetChannelModelMetricsAll(channelID int64, effectiveModel string) error {
	return DB.Model(&ChannelModelMetrics{}).
		Where("channel_id = ? AND effective_model = ?", channelID, effectiveModel).
		Updates(map[string]interface{}{
			"production_sample_count":          0,
			"shadow_sample_count":              0,
			"production_success_ema":           nil,
			"shadow_transport_success_ema":     nil,
			"temporary_error_ema":              nil,
			"rate_limit_ema":                   nil,
			"timeout_ema":                      nil,
			"stream_interruption_ema":          nil,
			"production_ttft_ema_ms":           nil,
			"shadow_ttft_ema_ms":               nil,
			"production_total_latency_ema_ms":  nil,
			"shadow_total_latency_ema_ms":      nil,
			"production_tokens_per_second_ema": nil,
			"experience_score":                 nil,
			"shadow_calibration_json":          "",
			"updated_at":                       common.GetTimestamp(),
		}).Error
}

// DeleteChannelModelMetrics removes one metrics row.
func DeleteChannelModelMetrics(channelID int64, effectiveModel string) error {
	return DB.Where("channel_id = ? AND effective_model = ?", channelID, effectiveModel).
		Delete(&ChannelModelMetrics{}).Error
}
