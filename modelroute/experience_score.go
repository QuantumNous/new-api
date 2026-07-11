package modelroute

import (
	"math"
	"sort"
	"time"

	"github.com/QuantumNous/new-api/model"
)

// UpdateEMA applies EMA: α·sample + (1-α)·prev. Nil prev uses sample as seed.
func UpdateEMA(prev *float64, sample, alpha float64) *float64 {
	if math.IsNaN(sample) || math.IsInf(sample, 0) {
		return prev
	}
	if prev == nil {
		v := sample
		return &v
	}
	v := alpha*sample + (1-alpha)*(*prev)
	return &v
}

// RecordProductionSuccessSample updates production success EMA (1.0) and sample count (PRD §33 α=0.10).
func RecordProductionSuccessSample(m *model.ChannelModelMetrics) {
	if m == nil {
		return
	}
	m.ProductionSampleCount++
	m.ProductionSuccessEMA = UpdateEMA(m.ProductionSuccessEMA, 1.0, model.DefaultSuccessEMAAlpha)
	GlobalMetricsRuntime.Put(m)
}

// RecordProductionFailureSample updates production success EMA (0.0).
func RecordProductionFailureSample(m *model.ChannelModelMetrics) {
	if m == nil {
		return
	}
	m.ProductionSampleCount++
	m.ProductionSuccessEMA = UpdateEMA(m.ProductionSuccessEMA, 0.0, model.DefaultSuccessEMAAlpha)
	GlobalMetricsRuntime.Put(m)
}

// RecordTemporaryErrorSample updates temporary_error_ema (PRD α=0.25).
func RecordTemporaryErrorSample(m *model.ChannelModelMetrics, isTemp bool) {
	if m == nil {
		return
	}
	sample := 0.0
	if isTemp {
		sample = 1.0
	}
	m.TemporaryErrorEMA = UpdateEMA(m.TemporaryErrorEMA, sample, model.DefaultTemporaryErrorEMAAlpha)
	GlobalMetricsRuntime.Put(m)
}

// RecordRateLimitSample updates rate_limit_ema (PRD α=0.30).
func RecordRateLimitSample(m *model.ChannelModelMetrics, hit bool) {
	if m == nil {
		return
	}
	sample := 0.0
	if hit {
		sample = 1.0
	}
	m.RateLimitEMA = UpdateEMA(m.RateLimitEMA, sample, model.DefaultRateLimitEMAAlpha)
	GlobalMetricsRuntime.Put(m)
}

// RecordStreamInterruptionSample updates stream_interruption_ema (PRD α=0.30).
func RecordStreamInterruptionSample(m *model.ChannelModelMetrics, interrupted bool) {
	if m == nil {
		return
	}
	sample := 0.0
	if interrupted {
		sample = 1.0
	}
	m.StreamInterruptionEMA = UpdateEMA(m.StreamInterruptionEMA, sample, model.DefaultStreamInterruptionEMAAlpha)
	GlobalMetricsRuntime.Put(m)
}

// RecordProductionTTFT updates production_ttft_ema_ms (PRD α=0.20).
func RecordProductionTTFT(m *model.ChannelModelMetrics, ttft time.Duration) {
	if m == nil || ttft <= 0 {
		return
	}
	ms := float64(ttft.Milliseconds())
	m.ProductionTTFTEMAMs = UpdateEMA(m.ProductionTTFTEMAMs, ms, model.DefaultTTFTEMAAlpha)
	GlobalMetricsRuntime.Put(m)
}

// RecordShadowTTFT updates shadow_ttft_ema_ms.
func RecordShadowTTFT(m *model.ChannelModelMetrics, ttft time.Duration) {
	if m == nil || ttft <= 0 {
		return
	}
	ms := float64(ttft.Milliseconds())
	m.ShadowTTFTEMAMs = UpdateEMA(m.ShadowTTFTEMAMs, ms, model.DefaultTTFTEMAAlpha)
	GlobalMetricsRuntime.Put(m)
}

func f64or(p *float64, def float64) float64 {
	if p == nil {
		return def
	}
	return *p
}

// clamp01 bounds v into [lo, hi].
func clamp(v, lo, hi float64) float64 {
	if v < lo {
		return lo
	}
	if v > hi {
		return hi
	}
	return v
}

// DefaultTargetTTFTMs is the latency_factor reference target (ms) when no config.
const DefaultTargetTTFTMs = 800.0

// ComputeExperienceScore implements 4-factor product (PRD §20). Capacity excluded.
//
//	reliability = success_ema ^ 4
//	rate_limit  = clamp(1 - rate_limit_ema × 1.5, 0.1, 1)
//	stream      = 1 - stream_interruption_ema
//	latency     = target / (target + effective_ttft)
func ComputeExperienceScore(m *model.ChannelModelMetrics, targetTTFTms float64) float64 {
	if m == nil {
		return 0
	}
	if targetTTFTms <= 0 {
		targetTTFTms = DefaultTargetTTFTMs
	}
	success := f64or(m.ProductionSuccessEMA, 0.5) // neutral prior when unknown
	success = clamp(success, 0, 1)
	reliability := math.Pow(success, 4)

	rl := f64or(m.RateLimitEMA, 0)
	rateLimitFactor := clamp(1-rl*1.5, 0.1, 1)

	streamFactor := clamp(1-f64or(m.StreamInterruptionEMA, 0), 0, 1)

	ttft := f64or(m.ProductionTTFTEMAMs, targetTTFTms)
	if ttft < 0 {
		ttft = targetTTFTms
	}
	latencyFactor := targetTTFTms / (targetTTFTms + ttft)

	score := reliability * rateLimitFactor * streamFactor * latencyFactor
	if math.IsNaN(score) || math.IsInf(score, 0) {
		return 0
	}
	return score
}

// RefreshExperienceScore computes and stores experience_score on metrics.
func RefreshExperienceScore(m *model.ChannelModelMetrics) float64 {
	s := ComputeExperienceScore(m, DefaultTargetTTFTMs)
	if m != nil {
		m.ExperienceScore = &s
		GlobalMetricsRuntime.Put(m)
	}
	return s
}

// PromptTokenBucket returns calibration bucket label for prompt token count (PRD §16).
func PromptTokenBucket(promptTokens int) string {
	switch {
	case promptTokens < 1000:
		return model.CalibrationBucket0To1k
	case promptTokens < 4000:
		return model.CalibrationBucket1kTo4k
	case promptTokens < 16000:
		return model.CalibrationBucket4kTo16k
	default:
		return model.CalibrationBucket16kPlus
	}
}

// EstimatedProductionTTFT returns shadow_ttft × ratio when calibrated, else shadow_ttft with low confidence.
func EstimatedProductionTTFT(m *model.ChannelModelMetrics, shadowTTFT time.Duration, promptTokens int) (est time.Duration, confidence float64) {
	if shadowTTFT <= 0 {
		if m != nil && m.ProductionTTFTEMAMs != nil {
			return time.Duration(*m.ProductionTTFTEMAMs) * time.Millisecond, 0.5
		}
		return 0, 0
	}
	bucket := PromptTokenBucket(promptTokens)
	ratio := 1.0
	confidence = 0.3 // no calibration → weak
	if m != nil {
		buckets, err := m.ParseShadowCalibration()
		if err == nil {
			if b, ok := buckets[bucket]; ok && b.SampleCount > 0 && b.Ratio > 0 {
				ratio = b.Ratio
				confidence = CalibrationConfidence(b.UpdatedAt, now())
			}
		}
	}
	ms := float64(shadowTTFT.Milliseconds()) * ratio
	return time.Duration(ms) * time.Millisecond, confidence
}

// CalibrationConfidence ages sample confidence (PRD §17): 7d full, 7–30d reduced, >30d weak.
func CalibrationConfidence(updatedAt, nowT time.Time) float64 {
	if updatedAt.IsZero() {
		return 0.2
	}
	age := nowT.Sub(updatedAt)
	full := time.Duration(model.DefaultCalibrationFullConfidenceDays) * 24 * time.Hour
	expire := time.Duration(model.DefaultCalibrationExpireDays) * 24 * time.Hour
	if age <= full {
		return 1.0
	}
	if age >= expire {
		return 0.2
	}
	// linear decay 1.0 → 0.2 between full and expire
	span := expire - full
	if span <= 0 {
		return 0.2
	}
	t := float64(age-full) / float64(span)
	return 1.0 - t*0.8
}

// CalibrationSample is one paired production/shadow TTFT observation.
type CalibrationSample struct {
	ProductionTTFT time.Duration
	ShadowTTFT     time.Duration
	PromptTokens   int
}

// UpdateCalibrationBucket merges one sample into shadow_calibration_json via median ratio (PRD §16).
// Uses running online approximation: new_ratio = median of last ratios stored as single EMA-like update
// when only aggregate is kept — here we update ratio as weighted toward new pair ratio.
func UpdateCalibrationBucket(m *model.ChannelModelMetrics, sample CalibrationSample) error {
	if m == nil || sample.ShadowTTFT <= 0 || sample.ProductionTTFT <= 0 {
		return nil
	}
	bucket := PromptTokenBucket(sample.PromptTokens)
	ratio := float64(sample.ProductionTTFT) / float64(sample.ShadowTTFT)
	if ratio <= 0 || math.IsNaN(ratio) || math.IsInf(ratio, 0) {
		return nil
	}
	buckets, err := m.ParseShadowCalibration()
	if err != nil {
		buckets = make(map[string]model.CalibrationBucket)
	}
	b := buckets[bucket]
	// online median-ish: average toward new sample with weight by sample_count
	if b.SampleCount == 0 {
		b.Ratio = ratio
	} else {
		// blend: keep stability
		w := 1.0 / float64(b.SampleCount+1)
		b.Ratio = b.Ratio*(1-w) + ratio*w
	}
	b.SampleCount++
	b.UpdatedAt = now()
	buckets[bucket] = b
	if err := m.SetShadowCalibration(buckets); err != nil {
		return err
	}
	GlobalMetricsRuntime.Put(m)
	return nil
}

// MedianFloat64 computes median of a float slice (for tests / offline recompute).
func MedianFloat64(xs []float64) float64 {
	if len(xs) == 0 {
		return 0
	}
	cp := append([]float64(nil), xs...)
	sort.Float64s(cp)
	n := len(cp)
	if n%2 == 1 {
		return cp[n/2]
	}
	return (cp[n/2-1] + cp[n/2]) / 2
}
