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
