package model

import (
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestGetQuotaDataGroupByUserReturnsDisplayName(t *testing.T) {
	truncateTables(t)

	alice := User{
		Id:          1,
		Username:    "alice",
		Password:    "password123",
		DisplayName: "Alice Chen",
		Role:        common.RoleCommonUser,
		Status:      common.UserStatusEnabled,
		Group:       "default",
		AffCode:     "aff-alice",
	}
	bob := User{
		Id:          2,
		Username:    "bob",
		Password:    "password123",
		DisplayName: "",
		Role:        common.RoleCommonUser,
		Status:      common.UserStatusEnabled,
		Group:       "default",
		AffCode:     "aff-bob",
	}
	require.NoError(t, DB.Create(&alice).Error)
	require.NoError(t, DB.Create(&bob).Error)

	require.NoError(t, DB.Create(&QuotaData{
		UserID:    1,
		Username:  "alice",
		ModelName: "gpt-4",
		CreatedAt: 1000,
		Count:     2,
		Quota:     80,
		TokenUsed: 40,
	}).Error)
	require.NoError(t, DB.Create(&QuotaData{
		UserID:    1,
		Username:  "alice",
		ModelName: "gpt-4",
		CreatedAt: 1000,
		Count:     1,
		Quota:     20,
		TokenUsed: 10,
	}).Error)
	require.NoError(t, DB.Create(&QuotaData{
		UserID:    2,
		Username:  "bob",
		ModelName: "gpt-4",
		CreatedAt: 1100,
		Count:     1,
		Quota:     50,
		TokenUsed: 25,
	}).Error)

	rows, err := GetQuotaDataGroupByUser(900, 2000)
	require.NoError(t, err)
	require.Len(t, rows, 2)

	byUser := make(map[string]*QuotaData, len(rows))
	for _, row := range rows {
		byUser[row.Username] = row
	}

	require.Contains(t, byUser, "alice")
	require.Contains(t, byUser, "bob")
	assert.Equal(t, "Alice Chen", byUser["alice"].DisplayName)
	assert.Equal(t, 100, byUser["alice"].Quota)
	assert.Equal(t, 3, byUser["alice"].Count)
	assert.Equal(t, "", byUser["bob"].DisplayName)
	assert.Equal(t, 50, byUser["bob"].Quota)
}
