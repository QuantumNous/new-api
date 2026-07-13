package controller

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestResolvePolicyEffectiveModel(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name      string
		requested string
		mapping   string
		want      string
	}{
		{name: "identity empty mapping", requested: "dsp", mapping: "", want: "dsp"},
		{name: "identity empty object", requested: "dsp", mapping: "{}", want: "dsp"},
		{name: "simple map", requested: "dsp", mapping: `{"dsp":"real-x"}`, want: "real-x"},
		{name: "chain", requested: "a", mapping: `{"a":"b","b":"c"}`, want: "c"},
		{name: "unrelated key", requested: "other", mapping: `{"dsp":"real-x"}`, want: "other"},
		{name: "invalid json falls back", requested: "dsp", mapping: `{not-json`, want: "dsp"},
		{name: "self map", requested: "dsp", mapping: `{"dsp":"dsp"}`, want: "dsp"},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()
			got := resolvePolicyEffectiveModel(tt.requested, tt.mapping)
			assert.Equal(t, tt.want, got)
		})
	}
}

func TestMetricsViewKey(t *testing.T) {
	t.Parallel()
	require.Equal(t, "12\x00real-x", metricsViewKey(12, "real-x"))
}
