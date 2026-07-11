package modelroute

import (
	"testing"
	"time"

	"github.com/QuantumNous/new-api/model"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestUpdateEMA(t *testing.T) {
	v := UpdateEMA(nil, 10, 0.2)
	require.NotNil(t, v)
	assert.InDelta(t, 10, *v, 1e-9)
	v2 := UpdateEMA(v, 20, 0.2)
	// 0.2*20 + 0.8*10 = 12
	assert.InDelta(t, 12, *v2, 1e-9)
}

func TestComputeExperienceScore(t *testing.T) {
	succ := 1.0
	rl := 0.0
	stream := 0.0
	ttft := 800.0
	m := &model.ChannelModelMetrics{
		ProductionSuccessEMA:  &succ,
		RateLimitEMA:          &rl,
		StreamInterruptionEMA: &stream,
		ProductionTTFTEMAMs:   &ttft,
	}
	// reliability=1, rate=1, stream=1, latency=800/(800+800)=0.5 → 0.5
	assert.InDelta(t, 0.5, ComputeExperienceScore(m, 800), 1e-9)

	succ = 0.0
	assert.InDelta(t, 0.0, ComputeExperienceScore(m, 800), 1e-9)

	succ = 1.0
	rl = 1.0 // rate factor clamp to 0.1
	// 1 * 0.1 * 1 * 0.5 = 0.05
	assert.InDelta(t, 0.05, ComputeExperienceScore(m, 800), 1e-9)
}

func TestPromptTokenBucket(t *testing.T) {
	assert.Equal(t, model.CalibrationBucket0To1k, PromptTokenBucket(0))
	assert.Equal(t, model.CalibrationBucket0To1k, PromptTokenBucket(999))
	assert.Equal(t, model.CalibrationBucket1kTo4k, PromptTokenBucket(1000))
	assert.Equal(t, model.CalibrationBucket4kTo16k, PromptTokenBucket(4000))
	assert.Equal(t, model.CalibrationBucket16kPlus, PromptTokenBucket(16000))
}

func TestCalibrationConfidence(t *testing.T) {
	nowT := time.Unix(1_700_000_000, 0)
	assert.InDelta(t, 1.0, CalibrationConfidence(nowT.Add(-24*time.Hour), nowT), 1e-9)
	assert.InDelta(t, 0.2, CalibrationConfidence(nowT.Add(-40*24*time.Hour), nowT), 1e-9)
	mid := CalibrationConfidence(nowT.Add(-15*24*time.Hour), nowT)
	assert.Greater(t, mid, 0.2)
	assert.Less(t, mid, 1.0)
}

func TestUpdateCalibrationBucketAndEstimate(t *testing.T) {
	withFrozenNow(t, time.Unix(1_700_000_000, 0))
	m := &model.ChannelModelMetrics{ChannelID: 1, EffectiveModel: "m"}
	require.NoError(t, UpdateCalibrationBucket(m, CalibrationSample{
		ProductionTTFT: 200 * time.Millisecond,
		ShadowTTFT:     100 * time.Millisecond,
		PromptTokens:   500,
	}))
	buckets, err := m.ParseShadowCalibration()
	require.NoError(t, err)
	b := buckets[model.CalibrationBucket0To1k]
	assert.InDelta(t, 2.0, b.Ratio, 1e-6)
	assert.Equal(t, int64(1), b.SampleCount)

	est, conf := EstimatedProductionTTFT(m, 100*time.Millisecond, 500)
	assert.InDelta(t, 200.0, float64(est.Milliseconds()), 1e-6)
	assert.InDelta(t, 1.0, conf, 1e-9)
}

func TestMedianFloat64(t *testing.T) {
	assert.InDelta(t, 2.0, MedianFloat64([]float64{1, 2, 3}), 1e-9)
	assert.InDelta(t, 2.5, MedianFloat64([]float64{1, 2, 3, 4}), 1e-9)
	assert.Equal(t, 0.0, MedianFloat64(nil))
}

func TestRefreshExperienceScore(t *testing.T) {
	GlobalMetricsRuntime.Clear()
	succ := 1.0
	m := &model.ChannelModelMetrics{
		ChannelID: 1, EffectiveModel: "m",
		ProductionSuccessEMA: &succ,
	}
	s := RefreshExperienceScore(m)
	require.NotNil(t, m.ExperienceScore)
	assert.Equal(t, s, *m.ExperienceScore)
	assert.Greater(t, s, 0.0)
}
