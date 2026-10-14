package model

import (
	"errors"
	"strings"

	"github.com/QuantumNous/new-api/common"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

const (
	UpstreamProtocolOpenAI    = "openai"
	UpstreamProtocolAnthropic = "anthropic"

	UpstreamRouteStateShadow      = "shadow"
	UpstreamRouteStateActive      = "active"
	UpstreamRouteStateQuarantined = "quarantined"
	UpstreamRouteStateLongRed     = "long_red"
	UpstreamRouteStatePaused      = "manual_pause"
	UpstreamRouteStateDetached    = "detached"
	UpstreamRouteStateRetained    = "retained"
)

type UpstreamManagedRoute struct {
	ID                   int64   `json:"id" gorm:"primaryKey"`
	SourceID             int64   `json:"source_id" gorm:"not null;uniqueIndex:idx_upstream_route_identity,priority:1;index"`
	ExternalGroupID      string  `json:"external_group_id" gorm:"type:varchar(128);not null;uniqueIndex:idx_upstream_route_identity,priority:2"`
	Platform             string  `json:"platform" gorm:"type:varchar(32);not null;uniqueIndex:idx_upstream_route_identity,priority:3;index"`
	Protocol             string  `json:"protocol" gorm:"type:varchar(32);not null;uniqueIndex:idx_upstream_route_identity,priority:4;index"`
	ChannelID            int     `json:"channel_id" gorm:"not null;uniqueIndex"`
	ExternalKeyID        string  `json:"external_key_id,omitempty" gorm:"type:varchar(128)"`
	KeyFingerprint       string  `json:"key_fingerprint,omitempty" gorm:"type:char(64);index"`
	State                string  `json:"state" gorm:"type:varchar(32);not null;index"`
	Rank                 int     `json:"rank" gorm:"not null"`
	EffectiveMultiplier  float64 `json:"effective_multiplier" gorm:"not null;index"`
	ConsecutiveFailures  int     `json:"consecutive_failures" gorm:"not null"`
	ConsecutiveSuccesses int     `json:"consecutive_successes" gorm:"not null"`
	FailureWindowStart   int64   `json:"failure_window_start,omitempty" gorm:"bigint"`
	LastFailureAt        int64   `json:"last_failure_at,omitempty" gorm:"bigint"`
	LastSuccessAt        int64   `json:"last_success_at,omitempty" gorm:"bigint;index"`
	LastProbeAt          int64   `json:"last_probe_at,omitempty" gorm:"bigint"`
	LastLatencyMS        int64   `json:"last_latency_ms,omitempty" gorm:"bigint"`
	RecoveryAttempts     int     `json:"recovery_attempts" gorm:"not null"`
	NextProbeAt          int64   `json:"next_probe_at,omitempty" gorm:"bigint;index"`
	RedSince             int64   `json:"red_since,omitempty" gorm:"bigint;index"`
	ManualPauseUntil     int64   `json:"manual_pause_until,omitempty" gorm:"bigint;index"`
	Detached             bool    `json:"detached" gorm:"not null;index"`
	LastReason           string  `json:"last_reason,omitempty" gorm:"type:text"`
	CreatedAt            int64   `json:"created_at" gorm:"bigint;index"`
	UpdatedAt            int64   `json:"updated_at" gorm:"bigint;index"`
}

func (UpstreamManagedRoute) TableName() string {
	return "upstream_managed_routes"
}

func (route *UpstreamManagedRoute) BeforeCreate(_ *gorm.DB) error {
	now := common.GetTimestamp()
	route.ExternalGroupID = strings.TrimSpace(route.ExternalGroupID)
	route.Platform = strings.ToLower(strings.TrimSpace(route.Platform))
	route.Protocol = strings.ToLower(strings.TrimSpace(route.Protocol))
	if route.State == "" {
		route.State = UpstreamRouteStateShadow
	}
	if route.CreatedAt == 0 {
		route.CreatedAt = now
	}
	if route.UpdatedAt == 0 {
		route.UpdatedAt = now
	}
	return nil
}

func UpsertUpstreamManagedRoute(route *UpstreamManagedRoute) error {
	if route == nil {
		return nil
	}
	route.UpdatedAt = common.GetTimestamp()
	return DB.Clauses(clause.OnConflict{
		Columns: []clause.Column{
			{Name: "source_id"},
			{Name: "external_group_id"},
			{Name: "platform"},
			{Name: "protocol"},
		},
		DoUpdates: clause.AssignmentColumns([]string{
			"channel_id",
			"external_key_id",
			"key_fingerprint",
			"state",
			"rank",
			"effective_multiplier",
			"consecutive_failures",
			"consecutive_successes",
			"failure_window_start",
			"last_failure_at",
			"last_success_at",
			"last_probe_at",
			"last_latency_ms",
			"recovery_attempts",
			"next_probe_at",
			"red_since",
			"manual_pause_until",
			"detached",
			"last_reason",
			"updated_at",
		}),
	}).Create(route).Error
}

func GetUpstreamManagedRouteByChannelID(channelID int) (*UpstreamManagedRoute, error) {
	var route UpstreamManagedRoute
	if err := DB.Where("channel_id = ?", channelID).First(&route).Error; err != nil {
		return nil, err
	}
	return &route, nil
}

func acquireUpstreamManagedRouteWriteIntentTx(tx *gorm.DB) error {
	if !common.UsingMainDatabase(common.DatabaseTypeSQLite) {
		return nil
	}
	return tx.Model(&UpstreamManagedRoute{}).
		Where("1 = 0").
		UpdateColumn("updated_at", gorm.Expr("updated_at")).Error
}

func GetAttachedUpstreamManagedRouteForUpdate(tx *gorm.DB, channelID int) (*UpstreamManagedRoute, error) {
	if err := acquireUpstreamManagedRouteWriteIntentTx(tx); err != nil {
		return nil, err
	}
	var route UpstreamManagedRoute
	if err := lockForUpdate(tx).
		Where("channel_id = ? AND detached = ?", channelID, false).
		First(&route).Error; err != nil {
		return nil, err
	}
	return &route, nil
}

func GetAttachedUpstreamManagedRouteByIDForUpdate(tx *gorm.DB, routeID int64) (*UpstreamManagedRoute, error) {
	if err := acquireUpstreamManagedRouteWriteIntentTx(tx); err != nil {
		return nil, err
	}
	var route UpstreamManagedRoute
	if err := lockForUpdate(tx).
		Where("id = ? AND detached = ?", routeID, false).
		First(&route).Error; err != nil {
		return nil, err
	}
	return &route, nil
}

func ListUpstreamManagedRoutes() ([]UpstreamManagedRoute, error) {
	var routes []UpstreamManagedRoute
	err := DB.Order("rank asc, id asc").Find(&routes).Error
	return routes, err
}

func RecordUpstreamRouteFailure(channelID int, now int64, windowSeconds int64, threshold int, reason string) (*UpstreamManagedRoute, bool, error) {
	var route *UpstreamManagedRoute
	var quarantine bool
	err := DB.Transaction(func(tx *gorm.DB) error {
		var err error
		route, quarantine, err = RecordUpstreamRouteFailureTx(
			tx, channelID, now, windowSeconds, threshold, reason,
		)
		return err
	})
	if err != nil {
		return nil, false, err
	}
	return route, quarantine, nil
}

func RecordUpstreamRouteFailureTx(
	tx *gorm.DB,
	channelID int,
	now int64,
	windowSeconds int64,
	threshold int,
	reason string,
) (*UpstreamManagedRoute, bool, error) {
	route, err := GetAttachedUpstreamManagedRouteForUpdate(tx, channelID)
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, false, nil
	}
	if err != nil {
		return nil, false, err
	}
	if route.FailureWindowStart == 0 || now-route.FailureWindowStart > windowSeconds {
		route.FailureWindowStart = now
		route.ConsecutiveFailures = 1
	} else {
		route.ConsecutiveFailures++
	}
	route.LastFailureAt = now
	route.LastReason = strings.TrimSpace(reason)
	quarantine := route.ConsecutiveFailures >= threshold
	if quarantine {
		route.State = UpstreamRouteStateQuarantined
		route.RecoveryAttempts = 0
		route.NextProbeAt = now
	}
	route.UpdatedAt = now
	if err := tx.Model(&UpstreamManagedRoute{}).Where("id = ?", route.ID).Updates(map[string]any{
		"state":                 route.State,
		"consecutive_failures":  route.ConsecutiveFailures,
		"consecutive_successes": 0,
		"failure_window_start":  route.FailureWindowStart,
		"last_failure_at":       route.LastFailureAt,
		"last_reason":           route.LastReason,
		"recovery_attempts":     route.RecoveryAttempts,
		"next_probe_at":         route.NextProbeAt,
		"updated_at":            route.UpdatedAt,
	}).Error; err != nil {
		return nil, false, err
	}
	return route, quarantine, nil
}

func RecordUpstreamRouteSuccess(channelID int, now int64, latencyMS int64) (*UpstreamManagedRoute, error) {
	var route UpstreamManagedRoute
	err := DB.Transaction(func(tx *gorm.DB) error {
		if err := lockForUpdate(tx).Where("channel_id = ? AND detached = ?", channelID, false).First(&route).Error; err != nil {
			return err
		}
		route.ConsecutiveFailures = 0
		route.ConsecutiveSuccesses++
		route.FailureWindowStart = 0
		route.LastSuccessAt = now
		route.LastLatencyMS = latencyMS
		route.LastReason = ""
		route.UpdatedAt = now
		return tx.Model(&UpstreamManagedRoute{}).Where("id = ?", route.ID).Updates(map[string]any{
			"consecutive_failures":  0,
			"consecutive_successes": route.ConsecutiveSuccesses,
			"failure_window_start":  int64(0),
			"last_success_at":       now,
			"last_latency_ms":       latencyMS,
			"last_reason":           "",
			"updated_at":            now,
		}).Error
	})
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, nil
	}
	return &route, err
}
