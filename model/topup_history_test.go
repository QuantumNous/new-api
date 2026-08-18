package model

import (
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/stretchr/testify/require"
)

func TestUserTopUpHistoryExcludesPendingAndExpiredOrders(t *testing.T) {
	setupTopUpLifecycleTestDB(t, 1)
	require.NoError(t, DB.AutoMigrate(&PaymentInvoice{}))

	user := createLifecycleQuotaTestUser(t, "topup-history-status-filter", 0, 100)
	now := common.GetTimestamp()
	for index, status := range []string{
		common.TopUpStatusPending,
		common.TopUpStatusExpired,
		common.TopUpStatusFailed,
		common.TopUpStatusSuccess,
	} {
		insertTopUpLifecycleOrder(
			t,
			user.Id,
			"history-status-"+status,
			PaymentProviderStripe,
			status,
			now+int64(index),
			0,
		)
	}

	pageInfo := &common.PageInfo{Page: 1, PageSize: 10}
	topUps, total, err := GetUserTopUps(user.Id, pageInfo)
	require.NoError(t, err)
	require.EqualValues(t, 2, total)
	require.Len(t, topUps, 2)
	require.Equal(t, common.TopUpStatusSuccess, topUps[0].Status)
	require.Equal(t, common.TopUpStatusFailed, topUps[1].Status)
}

func TestSearchUserTopUpHistoryExcludesPendingAndExpiredOrders(t *testing.T) {
	setupTopUpLifecycleTestDB(t, 1)
	require.NoError(t, DB.AutoMigrate(&PaymentInvoice{}))

	user := createLifecycleQuotaTestUser(t, "topup-history-search-filter", 0, 100)
	now := common.GetTimestamp()
	for index, status := range []string{
		common.TopUpStatusPending,
		common.TopUpStatusExpired,
		common.TopUpStatusSuccess,
	} {
		insertTopUpLifecycleOrder(
			t,
			user.Id,
			"searchable-history-"+status,
			PaymentProviderStripe,
			status,
			now+int64(index),
			0,
		)
	}

	pageInfo := &common.PageInfo{Page: 1, PageSize: 10}
	topUps, total, err := SearchUserTopUps(user.Id, "%searchable-history%", pageInfo)
	require.NoError(t, err)
	require.EqualValues(t, 1, total)
	require.Len(t, topUps, 1)
	require.Equal(t, common.TopUpStatusSuccess, topUps[0].Status)
}
