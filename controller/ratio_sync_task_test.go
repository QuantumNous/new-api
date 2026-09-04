package controller

import (
	"math"
	"testing"

	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func allFieldsPolicy() pricingSyncPolicy {
	policy := pricingSyncPolicy{
		fields:           make(map[string]bool),
		allowList:        map[string]bool{},
		blockList:        map[string]bool{},
		thresholdPercent: 100,
		addNewModels:     false,
	}
	for _, field := range pricingSyncNumericFieldOrder {
		policy.fields[field] = true
	}
	return policy
}

func differenceOf(model, field string, current any, upstreams map[string]any, confidence map[string]bool) map[string]map[string]dto.DifferenceItem {
	if confidence == nil {
		confidence = make(map[string]bool)
		for name := range upstreams {
			confidence[name] = true
		}
	}
	return map[string]map[string]dto.DifferenceItem{
		model: {
			field: {Current: current, Upstreams: upstreams, Confidence: confidence},
		},
	}
}

func TestBuildPricingSyncPlanAppliesAndSkips(t *testing.T) {
	priority := []string{"primary(1)", "secondary(2)"}
	localData := map[string]any{
		"model_ratio": map[string]any{"gpt-x": 2.0},
	}

	tests := []struct {
		name           string
		differences    map[string]map[string]dto.DifferenceItem
		localData      map[string]any
		policy         func() pricingSyncPolicy
		wantApplied    map[string]map[string]float64
		wantSkipReason string
	}{
		{
			name:        "decrease always applied",
			differences: differenceOf("gpt-x", "model_ratio", 2.0, map[string]any{"primary(1)": 1.0}, nil),
			localData:   localData,
			policy:      allFieldsPolicy,
			wantApplied: map[string]map[string]float64{"model_ratio": {"gpt-x": 1.0}},
		},
		{
			name:        "increase within threshold applied",
			differences: differenceOf("gpt-x", "model_ratio", 2.0, map[string]any{"primary(1)": 3.9}, nil),
			localData:   localData,
			policy:      allFieldsPolicy,
			wantApplied: map[string]map[string]float64{"model_ratio": {"gpt-x": 3.9}},
		},
		{
			name:           "increase just over threshold skipped",
			differences:    differenceOf("gpt-x", "model_ratio", 2.0, map[string]any{"primary(1)": 4.1}, nil),
			localData:      localData,
			policy:         allFieldsPolicy,
			wantSkipReason: pricingSyncSkipThresholdExceeded,
		},
		{
			name:           "increase from zero always skipped",
			differences:    differenceOf("free-model", "model_ratio", 0.0, map[string]any{"primary(1)": 0.5}, nil),
			localData:      map[string]any{"model_ratio": map[string]any{"free-model": 0.0}},
			policy:         allFieldsPolicy,
			wantSkipReason: pricingSyncSkipThresholdExceeded,
		},
		{
			name: "low confidence value skipped",
			differences: differenceOf("gpt-x", "model_ratio", 2.0,
				map[string]any{"primary(1)": 1.5},
				map[string]bool{"primary(1)": false}),
			localData:      localData,
			policy:         allFieldsPolicy,
			wantSkipReason: pricingSyncSkipLowConfidence,
		},
		{
			name:        "blocklisted model ignored silently",
			differences: differenceOf("gpt-x", "model_ratio", 2.0, map[string]any{"primary(1)": 1.0}, nil),
			localData:   localData,
			policy: func() pricingSyncPolicy {
				policy := allFieldsPolicy()
				policy.blockList["gpt-x"] = true
				return policy
			},
		},
		{
			name:        "model outside allow list ignored silently",
			differences: differenceOf("gpt-x", "model_ratio", 2.0, map[string]any{"primary(1)": 1.0}, nil),
			localData:   localData,
			policy: func() pricingSyncPolicy {
				policy := allFieldsPolicy()
				policy.allowList["other-model"] = true
				return policy
			},
		},
		{
			name:        "unselected field ignored silently",
			differences: differenceOf("gpt-x", "model_ratio", 2.0, map[string]any{"primary(1)": 1.0}, nil),
			localData:   localData,
			policy: func() pricingSyncPolicy {
				policy := allFieldsPolicy()
				delete(policy.fields, "model_ratio")
				return policy
			},
		},
		{
			name: "ratio for per-call priced model skipped",
			differences: differenceOf("paid-model", "model_ratio", nil,
				map[string]any{"primary(1)": 1.0}, nil),
			localData:      map[string]any{"model_price": map[string]any{"paid-model": 0.1}},
			policy:         allFieldsPolicy,
			wantSkipReason: pricingSyncSkipBillingTypeConflict,
		},
		{
			name: "price for ratio-priced model skipped",
			differences: differenceOf("gpt-x", "model_price", nil,
				map[string]any{"primary(1)": 0.1}, nil),
			localData:      localData,
			policy:         allFieldsPolicy,
			wantSkipReason: pricingSyncSkipBillingTypeConflict,
		},
		{
			name: "new model skipped by default",
			differences: differenceOf("brand-new", "model_ratio", nil,
				map[string]any{"primary(1)": 1.0}, nil),
			localData:      localData,
			policy:         allFieldsPolicy,
			wantSkipReason: pricingSyncSkipNewModel,
		},
		{
			name: "new model applied when enabled",
			differences: differenceOf("brand-new", "model_ratio", nil,
				map[string]any{"primary(1)": 1.0}, nil),
			localData: localData,
			policy: func() pricingSyncPolicy {
				policy := allFieldsPolicy()
				policy.addNewModels = true
				return policy
			},
			wantApplied: map[string]map[string]float64{"model_ratio": {"brand-new": 1.0}},
		},
		{
			name: "missing field on existing model applied",
			differences: differenceOf("gpt-x", "completion_ratio", nil,
				map[string]any{"primary(1)": 4.0}, nil),
			localData:   localData,
			policy:      allFieldsPolicy,
			wantApplied: map[string]map[string]float64{"completion_ratio": {"gpt-x": 4.0}},
		},
		{
			name: "non-numeric upstream value ignored",
			differences: differenceOf("gpt-x", "model_ratio", 2.0,
				map[string]any{"primary(1)": "oops"}, nil),
			localData: localData,
			policy:    allFieldsPolicy,
		},
		{
			name: "negative upstream value ignored",
			differences: differenceOf("gpt-x", "model_ratio", 2.0,
				map[string]any{"primary(1)": -1.0}, nil),
			localData: localData,
			policy:    allFieldsPolicy,
		},
		{
			name: "non-finite upstream value ignored",
			differences: differenceOf("gpt-x", "model_ratio", 2.0,
				map[string]any{"primary(1)": math.Inf(1)}, nil),
			localData: localData,
			policy:    allFieldsPolicy,
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			plan := buildPricingSyncPlan(tc.differences, tc.localData, tc.policy(), priority)
			if tc.wantApplied == nil {
				assert.Empty(t, plan.changes)
			} else {
				assert.Equal(t, tc.wantApplied, plan.changes)
			}
			if tc.wantSkipReason == "" {
				assert.Empty(t, plan.skipped)
			} else {
				require.Len(t, plan.skipped, 1)
				assert.Equal(t, tc.wantSkipReason, plan.skipped[0].Reason)
			}
		})
	}
}

func TestBuildPricingSyncPlanUpstreamPriority(t *testing.T) {
	priority := []string{"primary(1)", "secondary(2)"}
	localData := map[string]any{"model_ratio": map[string]any{"gpt-x": 2.0}}

	t.Run("first upstream with concrete value wins", func(t *testing.T) {
		differences := differenceOf("gpt-x", "model_ratio", 2.0,
			map[string]any{"primary(1)": 1.5, "secondary(2)": 1.0}, nil)
		plan := buildPricingSyncPlan(differences, localData, allFieldsPolicy(), priority)
		require.Len(t, plan.applied, 1)
		assert.Equal(t, 1.5, plan.applied[0].New)
		assert.Equal(t, "primary(1)", plan.applied[0].Source)
	})

	t.Run("same on first falls through to second", func(t *testing.T) {
		differences := differenceOf("gpt-x", "model_ratio", 2.0,
			map[string]any{"primary(1)": "same", "secondary(2)": 1.0}, nil)
		plan := buildPricingSyncPlan(differences, localData, allFieldsPolicy(), priority)
		require.Len(t, plan.applied, 1)
		assert.Equal(t, 1.0, plan.applied[0].New)
		assert.Equal(t, "secondary(2)", plan.applied[0].Source)
	})

	t.Run("low confidence first falls through to confident second", func(t *testing.T) {
		differences := differenceOf("gpt-x", "model_ratio", 2.0,
			map[string]any{"primary(1)": 1.5, "secondary(2)": 1.0},
			map[string]bool{"primary(1)": false, "secondary(2)": true})
		plan := buildPricingSyncPlan(differences, localData, allFieldsPolicy(), priority)
		require.Len(t, plan.applied, 1)
		assert.Equal(t, 1.0, plan.applied[0].New)
		assert.Empty(t, plan.skipped)
	})
}

func TestBuildPricingSyncPolicy(t *testing.T) {
	t.Run("empty fields config selects all numeric fields", func(t *testing.T) {
		policy, err := buildPricingSyncPolicy(&operation_setting.RatioSyncSetting{})
		require.NoError(t, err)
		assert.Len(t, policy.fields, len(pricingSyncNumericFieldOrder))
	})

	t.Run("explicit fields config filters to known fields", func(t *testing.T) {
		policy, err := buildPricingSyncPolicy(&operation_setting.RatioSyncSetting{
			SyncFields: `["model_ratio", "billing_mode"]`,
		})
		require.NoError(t, err)
		assert.Equal(t, map[string]bool{"model_ratio": true}, policy.fields)
	})

	t.Run("fields config without syncable field rejected", func(t *testing.T) {
		_, err := buildPricingSyncPolicy(&operation_setting.RatioSyncSetting{
			SyncFields: `["billing_mode"]`,
		})
		require.Error(t, err)
	})

	t.Run("negative threshold clamped to zero", func(t *testing.T) {
		policy, err := buildPricingSyncPolicy(&operation_setting.RatioSyncSetting{
			IncreaseThresholdPercent: -5,
		})
		require.NoError(t, err)
		assert.Equal(t, 0.0, policy.thresholdPercent)
	})

	t.Run("lists split on newline and comma", func(t *testing.T) {
		policy, err := buildPricingSyncPolicy(&operation_setting.RatioSyncSetting{
			ModelAllowList: "a\nb, c",
		})
		require.NoError(t, err)
		assert.Equal(t, map[string]bool{"a": true, "b": true, "c": true}, policy.allowList)
	})
}

func TestParseRatioSyncUpstreams(t *testing.T) {
	t.Run("valid config with preset and channel", func(t *testing.T) {
		upstreams, err := operation_setting.ParseRatioSyncUpstreams(
			`[{"id":-100},{"id":12,"endpoint":"/api/ratio_config"}]`)
		require.NoError(t, err)
		require.Len(t, upstreams, 2)
		assert.Equal(t, -100, upstreams[0].ID)
		assert.Equal(t, "/api/ratio_config", upstreams[1].Endpoint)
	})

	t.Run("empty config", func(t *testing.T) {
		upstreams, err := operation_setting.ParseRatioSyncUpstreams("")
		require.NoError(t, err)
		assert.Empty(t, upstreams)
	})

	t.Run("malformed config rejected", func(t *testing.T) {
		_, err := operation_setting.ParseRatioSyncUpstreams("{not json")
		require.Error(t, err)
	})

	t.Run("zero channel id rejected", func(t *testing.T) {
		_, err := operation_setting.ParseRatioSyncUpstreams(`[{"id":0}]`)
		require.Error(t, err)
	})
}
