package controller

import (
	"math"
	"testing"

	"github.com/QuantumNous/new-api/setting"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestMezonDongToQuotaAmount_OneToOne(t *testing.T) {
	// 1 dong = 1 mzđ credit (raw units, no QPU).
	quota, overflow := mezonDongToQuotaAmount(1, 1)
	require.False(t, overflow)
	assert.Equal(t, 1, quota)

	quota, overflow = mezonDongToQuotaAmount(10, 1)
	require.False(t, overflow)
	assert.Equal(t, 10, quota)
}

func TestMezonDongToQuotaAmount_LargeOneToOne(t *testing.T) {
	// 100000 dong → 100000 mzđ credit.
	quota, overflow := mezonDongToQuotaAmount(100_000, 1)
	require.False(t, overflow)
	assert.Equal(t, 100_000, quota)

	// 1e9 still fits in int32.
	quota, overflow = mezonDongToQuotaAmount(1_000_000_000, 1)
	require.False(t, overflow)
	assert.Equal(t, 1_000_000_000, quota)
}

func TestMezonDongToQuotaAmount_GroupRatio(t *testing.T) {
	// Group ratio 2 ⇒ half credit per dong.
	quota, overflow := mezonDongToQuotaAmount(10, 2)
	require.False(t, overflow)
	assert.Equal(t, 5, quota)
}

func TestMezonDongToQuotaAmount_Overflow(t *testing.T) {
	// Above int32 max must reject (same limit as manual credit).
	quota, overflow := mezonDongToQuotaAmount(int64(math.MaxInt32)+1, 1)
	require.True(t, overflow)
	assert.Equal(t, 0, quota)
}

func TestMezonDongToQuotaAmount_InvalidInputs(t *testing.T) {
	quota, overflow := mezonDongToQuotaAmount(0, 1)
	assert.False(t, overflow)
	assert.Equal(t, 0, quota)

	quota, overflow = mezonDongToQuotaAmount(-1, 1)
	assert.False(t, overflow)
	assert.Equal(t, 0, quota)

	quota, overflow = mezonDongToQuotaAmount(1, 0)
	assert.False(t, overflow)
	assert.Equal(t, 0, quota)
}

func TestIsMezonTopUpEnabledRequiresProviderAndTreasury(t *testing.T) {
	prev := setting.MezonPayment
	t.Cleanup(func() { setting.MezonPayment = prev })

	setting.MezonPayment.Enabled = true
	setting.MezonPayment.ProviderId = 0
	setting.MezonPayment.TreasuryAddress = "9boK1HQDiKJ922j3HetRkFszX873q6B1xSZDqmDSoQro"
	assert.False(t, IsMezonTopUpEnabled())

	setting.MezonPayment.ProviderId = 1
	setting.MezonPayment.TreasuryAddress = ""
	assert.False(t, IsMezonTopUpEnabled())

	setting.MezonPayment.ProviderId = 1
	setting.MezonPayment.TreasuryAddress = "9boK1HQDiKJ922j3HetRkFszX873q6B1xSZDqmDSoQro"
	assert.True(t, IsMezonTopUpEnabled())

	setting.MezonPayment.Enabled = false
	assert.False(t, IsMezonTopUpEnabled())
}
