package operation_setting

import (
	"math"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
)

func TestRatioSyncSettingSyncInterval(t *testing.T) {
	maxDuration := time.Duration(maxRatioSyncIntervalMinutes) * time.Minute

	tests := []struct {
		name    string
		minutes int
		want    time.Duration
	}{
		{"zero falls back to default", 0, DefaultRatioSyncIntervalMinutes * time.Minute},
		{"below minimum clamped up", 1, MinRatioSyncIntervalMinutes * time.Minute},
		{"normal value kept", 60, 60 * time.Minute},
		{"maximum representable value kept", maxRatioSyncIntervalMinutes, maxDuration},
		{"above maximum clamped down", maxRatioSyncIntervalMinutes + 1, maxDuration},
		{"int max clamped without overflow", math.MaxInt, maxDuration},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			setting := RatioSyncSetting{IntervalMinutes: tc.minutes}
			got := setting.SyncInterval()
			assert.Equal(t, tc.want, got)
			assert.Positive(t, got)
		})
	}
}
