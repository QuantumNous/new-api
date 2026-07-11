package model

import "time"

// PolicyKey identifies a channel×requested_model routing policy (PRD §2.1).
type PolicyKey struct {
	ChannelID      int64
	RequestedModel string
}

func (k PolicyKey) String() string {
	return formatRouteKey(k.ChannelID, k.RequestedModel)
}

// MetricsKey identifies a channel×effective_model metrics row (PRD §2.2).
type MetricsKey struct {
	ChannelID      int64
	EffectiveModel string
}

func (k MetricsKey) String() string {
	return formatRouteKey(k.ChannelID, k.EffectiveModel)
}

func formatRouteKey(channelID int64, model string) string {
	// compact stable key for maps; not persisted
	return itoa64(channelID) + "\x00" + model
}

func itoa64(v int64) string {
	// small local helper avoids strconv import churn at call sites that only need keys
	if v == 0 {
		return "0"
	}
	neg := v < 0
	if neg {
		v = -v
	}
	var buf [20]byte
	i := len(buf)
	for v > 0 {
		i--
		buf[i] = byte('0' + v%10)
		v /= 10
	}
	if neg {
		i--
		buf[i] = '-'
	}
	return string(buf[i:])
}

// CalibrationBucket stores shadow/production TTFT ratio samples for one prompt-size bucket (PRD §16 / §31).
type CalibrationBucket struct {
	Ratio       float64   `json:"ratio"`
	SampleCount int64     `json:"sample_count"`
	UpdatedAt   time.Time `json:"updated_at"`
}

// ResolvedRouteCandidate is the runtime combination of one Policy + shared Metrics (PRD §10.2 / §31).
// ManualPriority always comes from the Policy for the current requested_model, never reverse-looked up from Metrics.
type ResolvedRouteCandidate struct {
	PolicyKey      string
	MetricsKey     string
	ChannelID      int64
	RequestedModel string
	EffectiveModel string
	ManualPriority int
	Metrics        *ChannelModelMetrics
}

// RoutePlan is the process-local primary + overflow chain for one requested_model (PRD §10.4).
type RoutePlan struct {
	RequestedModel string
	Primary        *ResolvedRouteCandidate
	OverflowChain  []*ResolvedRouteCandidate
}

// ProbeQueueItem is a process-local probe-queue entry (PRD §15). Not persisted.
type ProbeQueueItem struct {
	MetricsKey     MetricsKey
	NextProbeAt    time.Time
	ManualPriority int
	BackoffLevel   int
	LastSuccessAt  time.Time
	LastProbeAt    time.Time
}
