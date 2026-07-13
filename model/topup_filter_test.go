package model

import (
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func TestAdminTopupPaymentMethodFilterMatchesListAndExport(t *testing.T) {
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	require.NoError(t, err)
	require.NoError(t, db.AutoMigrate(&User{}, &TopUp{}))
	DB = db

	require.NoError(t, db.Create(&[]TopUp{
		{UserId: 1, TradeNo: "paypal-success", PaymentMethod: PaymentMethodPayPal, Status: "success", CreateTime: 3},
		{UserId: 1, TradeNo: "stripe-success", PaymentMethod: PaymentMethodStripe, Status: "success", CreateTime: 2},
		{UserId: 1, TradeNo: "paypal-pending", PaymentMethod: PaymentMethodPayPal, Status: "pending", CreateTime: 1},
	}).Error)

	pageInfo := &common.PageInfo{Page: 1, PageSize: 10}
	listed, total, err := GetAllTopUps("success", PaymentMethodPayPal, pageInfo)
	require.NoError(t, err)
	require.EqualValues(t, 1, total)
	require.Equal(t, "paypal-success", listed[0].TradeNo)

	exported, err := ExportAllTopUps("", "success", PaymentMethodPayPal)
	require.NoError(t, err)
	require.Len(t, exported, 1)
	require.Equal(t, listed[0].TradeNo, exported[0].TradeNo)
}
