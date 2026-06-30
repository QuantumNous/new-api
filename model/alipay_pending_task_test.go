package model

import (
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/stretchr/testify/require"
)

func TestCreateAlipayTopUpWithPendingTask(t *testing.T) {
	truncateTables(t)
	require.NoError(t, DB.AutoMigrate(&User{}, &TopUp{}, &AlipayPendingTask{}))
	require.NoError(t, DB.Create(&User{
		Id:       1,
		Username: "alipay-task-user",
		Status:   common.UserStatusEnabled,
	}).Error)

	topUp := &TopUp{
		UserId:          1,
		Amount:          10,
		Money:           7.3,
		TradeNo:         "ali_ref_task_create",
		PaymentMethod:   PaymentMethodAlipay,
		PaymentProvider: PaymentProviderAlipay,
		Status:          common.TopUpStatusPending,
		CreateTime:      100,
	}
	require.NoError(t, CreateAlipayTopUpWithPendingTask(topUp, 130))

	var storedTopUp TopUp
	require.NoError(t, DB.Where("trade_no = ?", topUp.TradeNo).First(&storedTopUp).Error)

	var task AlipayPendingTask
	require.NoError(t, DB.Where("trade_no = ?", topUp.TradeNo).First(&task).Error)
	require.Equal(t, int64(130), task.NextQueryAt)
	require.Equal(t, 0, task.RetryCount)
	require.Equal(t, AlipayPendingTaskTypeTopUp, task.TradeType)
}

func TestCreateAlipaySubscriptionWithPendingTask(t *testing.T) {
	truncateTables(t)
	require.NoError(t, DB.AutoMigrate(&User{}, &SubscriptionPlan{}, &SubscriptionOrder{}, &TopUp{}, &AlipayPendingTask{}))
	require.NoError(t, DB.Create(&User{
		Id:       2,
		Username: "alipay-sub-task-user",
		Status:   common.UserStatusEnabled,
	}).Error)
	require.NoError(t, DB.Create(&SubscriptionPlan{
		Id:            3,
		Title:         "Task Plan",
		PriceAmount:   9.99,
		Currency:      "USD",
		DurationUnit:  SubscriptionDurationMonth,
		DurationValue: 1,
		Enabled:       true,
		TotalAmount:   100,
	}).Error)

	order := &SubscriptionOrder{
		UserId:          2,
		PlanId:          3,
		Money:           9.99,
		TradeNo:         "sub_ref_task_create",
		PaymentMethod:   PaymentMethodAlipay,
		PaymentProvider: PaymentProviderAlipay,
		Status:          common.TopUpStatusPending,
		CreateTime:      100,
	}
	require.NoError(t, CreateAlipaySubscriptionWithPendingTask(order, 130))

	var storedOrder SubscriptionOrder
	require.NoError(t, DB.Where("trade_no = ?", order.TradeNo).First(&storedOrder).Error)

	var storedTopUp TopUp
	require.NoError(t, DB.Where("trade_no = ?", order.TradeNo).First(&storedTopUp).Error)
	require.Equal(t, common.TopUpStatusPending, storedTopUp.Status)
	require.Equal(t, order.UserId, storedTopUp.UserId)
	require.Equal(t, order.Money, storedTopUp.Money)
	require.Equal(t, order.PaymentMethod, storedTopUp.PaymentMethod)
	require.Equal(t, order.PaymentProvider, storedTopUp.PaymentProvider)

	var task AlipayPendingTask
	require.NoError(t, DB.Where("trade_no = ?", order.TradeNo).First(&task).Error)
	require.Equal(t, int64(130), task.NextQueryAt)
	require.Equal(t, 0, task.RetryCount)
	require.Equal(t, AlipayPendingTaskTypeSubscription, task.TradeType)
}

func TestGetDueAlipayPendingTasks(t *testing.T) {
	truncateTables(t)
	require.NoError(t, DB.AutoMigrate(&AlipayPendingTask{}))
	require.NoError(t, DB.Create(&AlipayPendingTask{
		TradeNo:     "ali_ref_due",
		NextQueryAt: 100,
		CreateTime:  1,
		UpdateTime:  1,
	}).Error)
	require.NoError(t, DB.Create(&AlipayPendingTask{
		TradeNo:     "ali_ref_future",
		NextQueryAt: 200,
		CreateTime:  1,
		UpdateTime:  1,
	}).Error)

	tasks, err := GetDueAlipayPendingTasks(150, 10)
	require.NoError(t, err)
	require.Len(t, tasks, 1)
	require.Equal(t, "ali_ref_due", tasks[0].TradeNo)
}
