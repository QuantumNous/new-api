package model

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestGetQuotaDataGroupByUserAddsCurrentDisplayName(t *testing.T) {
	truncateTables(t)
	require.NoError(t, DB.Create(&User{Id: 1, Username: "p_2ff8ed3c", DisplayName: "Alice", AffCode: "aff-1"}).Error)
	require.NoError(t, DB.Create(&User{Id: 2, Username: "svc_10bf2464", DisplayName: "", AffCode: "aff-2"}).Error)
	require.NoError(t, DB.Create(&User{Id: 3, Username: "p_deleted", DisplayName: "Bob", AffCode: "aff-3"}).Error)
	require.NoError(t, DB.Delete(&User{Id: 3}).Error)

	rows := []QuotaData{
		{UserID: 1, Username: "p_2ff8ed3c", ModelName: "gpt-a", CreatedAt: 1000, Count: 1, Quota: 100},
		{UserID: 1, Username: "p_2ff8ed3c", ModelName: "gpt-b", CreatedAt: 1000, Count: 2, Quota: 50},
		{UserID: 2, Username: "svc_10bf2464", ModelName: "gpt-a", CreatedAt: 1000, Count: 1, Quota: 30},
		{UserID: 3, Username: "p_deleted", ModelName: "gpt-a", CreatedAt: 1000, Count: 1, Quota: 20},
		{UserID: 4, Username: "p_unknown", ModelName: "gpt-a", CreatedAt: 1000, Count: 1, Quota: 10},
	}
	for _, row := range rows {
		require.NoError(t, DB.Create(&row).Error)
	}

	data, err := GetQuotaDataGroupByUser(0, 2000)
	require.NoError(t, err)

	got := make(map[string]QuotaData, len(data))
	for _, row := range data {
		got[row.Username] = *row
	}
	require.Len(t, got, 4)
	assert.Equal(t, "Alice", got["p_2ff8ed3c"].DisplayName)
	assert.Equal(t, 150, got["p_2ff8ed3c"].Quota)
	assert.Equal(t, "", got["svc_10bf2464"].DisplayName)
	assert.Equal(t, "Bob", got["p_deleted"].DisplayName)
	assert.Equal(t, "", got["p_unknown"].DisplayName)
}
