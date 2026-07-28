/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/
package model

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/QuantumNous/new-api/setting/ratio_setting"
)

func TestLookupOfficialValuePrefersExactThenLeaf(t *testing.T) {
	values := map[string]float64{
		"gpt-5.6":        2.5,
		"Kimi-K3":        1.35,
		"provider/other": 9,
	}

	v, ok := lookupOfficialValue(values, "gpt-5.6")
	require.True(t, ok)
	assert.Equal(t, 2.5, v)

	v, ok = lookupOfficialValue(values, "moonshotai/Kimi-K3")
	require.True(t, ok)
	assert.Equal(t, 1.35, v)

	_, ok = lookupOfficialValue(values, "missing-model")
	assert.False(t, ok)
}

func TestComputeAutoOfficialDiscountRatio(t *testing.T) {
	official := &officialRatioSnapshot{
		modelRatio: map[string]float64{
			"gpt-5.6-sol": 2.5,
			"same-price":  1.0,
			"cheaper-off": 0.5,
		},
		modelPrice: map[string]float64{},
	}

	// 1.25 site vs 2.5 official → 50%
	assert.Equal(t, 50.0, computeAutoOfficialDiscount(0, 1.25, 0, "gpt-5.6-sol", official))

	// Equal or higher site price → no discount badge
	assert.Equal(t, 0.0, computeAutoOfficialDiscount(0, 2.5, 0, "gpt-5.6-sol", official))
	assert.Equal(t, 0.0, computeAutoOfficialDiscount(0, 1.0, 0, "same-price", official))
	assert.Equal(t, 0.0, computeAutoOfficialDiscount(0, 1.0, 0, "cheaper-off", official))

	// Missing official baseline
	assert.Equal(t, 0.0, computeAutoOfficialDiscount(0, 1.0, 0, "unknown", official))
	assert.Equal(t, 0.0, computeAutoOfficialDiscount(0, 1.0, 0, "gpt-5.6-sol", nil))
}

func TestComputeAutoOfficialDiscountPrice(t *testing.T) {
	official := &officialRatioSnapshot{
		modelRatio: map[string]float64{},
		modelPrice: map[string]float64{
			"dall-e-3": 0.04,
		},
	}

	// site 0.02 vs official 0.04 → 50%
	assert.Equal(t, 50.0, computeAutoOfficialDiscount(1, 0, 0.02, "dall-e-3", official))
	assert.Equal(t, 0.0, computeAutoOfficialDiscount(1, 0, 0.04, "dall-e-3", official))
	assert.Equal(t, 0.0, computeAutoOfficialDiscount(1, 0, 0.02, "missing", official))
}

func TestComputeAutoOfficialDiscountRounding(t *testing.T) {
	official := &officialRatioSnapshot{
		modelRatio: map[string]float64{
			"deepseek-v4-pro": 0.7765,
		},
	}
	// 0.174 / 0.7765 ≈ 77.591… → 77.59
	assert.Equal(t, 77.59, computeAutoOfficialDiscount(0, 0.174, 0, "deepseek-v4-pro", official))
}

func TestParseModelsDevSnapshotConvertsUSDPer1M(t *testing.T) {
	// input $0.14/1M → ratio = 0.14 * 500 / 1000 = 0.07
	body := []byte(`{
		"deepseek": {
			"models": {
				"deepseek-v4-flash": { "cost": { "input": 0.14, "output": 0.28 } },
				"free-model": { "cost": { "input": 0, "output": 0 } }
			}
		},
		"openai": {
			"models": {
				"gpt-5.6-sol": { "cost": { "input": 5.0, "output": 30.0 } }
			}
		},
		"other": {
			"models": {
				"gpt-5.6-sol": { "cost": { "input": 4.0, "output": 24.0 } }
			}
		}
	}`)

	snap, err := parseModelsDevSnapshot(body)
	require.NoError(t, err)
	require.NotNil(t, snap)

	// free model skipped
	_, ok := snap.modelRatio["free-model"]
	assert.False(t, ok)

	// deepseek: 0.14 * USD / 1000
	wantFlash := 0.14 * float64(ratio_setting.USD) / modelsDevInputCostRatioBase
	assert.InDelta(t, wantFlash, snap.modelRatio["deepseek-v4-flash"], 1e-9)

	// duplicate gpt-5.6-sol → cheapest input ($4 from "other")
	wantSol := 4.0 * float64(ratio_setting.USD) / modelsDevInputCostRatioBase
	assert.InDelta(t, wantSol, snap.modelRatio["gpt-5.6-sol"], 1e-9)

	// no fixed prices from models.dev
	assert.Empty(t, snap.modelPrice)
}

func TestParseModelsDevSnapshotRejectsEmpty(t *testing.T) {
	_, err := parseModelsDevSnapshot([]byte(`{}`))
	require.Error(t, err)

	_, err = parseModelsDevSnapshot([]byte(`{"p":{"models":{}}}`))
	require.Error(t, err)
}
