package model

import (
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestGetTopUpAnalysisData(t *testing.T) {
	truncateTables(t)

	require.NoError(t, DB.Create(&User{
		Id:       701,
		Username: "topup_analysis_user",
		AffCode:  "topup_analysis_user_code",
		Status:   common.UserStatusEnabled,
	}).Error)
	require.NoError(t, DB.Create(&User{
		Id:       702,
		Username: "topup_analysis_other",
		AffCode:  "topup_analysis_other_code",
		Status:   common.UserStatusEnabled,
	}).Error)

	require.NoError(t, DB.Create(&[]TopUp{
		{
			UserId:          701,
			Amount:          10,
			Money:           12.5,
			TradeNo:         "topup-analysis-balance",
			PaymentMethod:   PaymentMethodStripe,
			PaymentProvider: PaymentProviderStripe,
			CreateTime:      1700000000,
			CompleteTime:    1700000123,
			Status:          common.TopUpStatusSuccess,
		},
		{
			UserId:          701,
			Amount:          0,
			Money:           29.9,
			TradeNo:         "topup-analysis-subscription",
			PaymentMethod:   PaymentMethodStripe,
			PaymentProvider: "",
			CreateTime:      1700000200,
			CompleteTime:    1700000345,
			Status:          common.TopUpStatusSuccess,
		},
		{
			UserId:          701,
			Amount:          10,
			Money:           99,
			TradeNo:         "topup-analysis-pending",
			PaymentMethod:   PaymentMethodStripe,
			PaymentProvider: PaymentProviderStripe,
			CreateTime:      1700000000,
			CompleteTime:    1700000123,
			Status:          common.TopUpStatusPending,
		},
		{
			UserId:          702,
			Amount:          10,
			Money:           8,
			TradeNo:         "topup-analysis-other-user",
			PaymentMethod:   PaymentMethodCreem,
			PaymentProvider: PaymentProviderCreem,
			CreateTime:      1700000000,
			CompleteTime:    1700000456,
			Status:          common.TopUpStatusSuccess,
		},
	}).Error)

	items, err := GetTopUpAnalysisData(1700000000, 1700003600, "topup_analysis_user")
	require.NoError(t, err)
	require.Len(t, items, 2)

	var total float64
	var count int64
	for _, item := range items {
		assert.Equal(t, int64(1699999200), item.CreatedAt)
		total += item.Money
		count += item.Count
	}
	assert.InDelta(t, 42.4, total, 0.0001)
	assert.Equal(t, int64(2), count)
}
