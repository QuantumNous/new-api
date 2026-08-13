package model

import (
	"testing"

	"github.com/stretchr/testify/require"
)

func TestReplaceWebsiteFeaturedModelsStoresContinuousOrder(t *testing.T) {
	db, _ := setupModelAccessDB(t)
	require.NoError(t, db.AutoMigrate(&WebsiteFeaturedModel{}))

	require.NoError(t, ReplaceWebsiteFeaturedModels([]string{"gpt-5.5", "claude-opus-4.7"}))
	rows, err := ListWebsiteFeaturedModels()
	require.NoError(t, err)
	require.Equal(t, []string{"gpt-5.5", "claude-opus-4.7"}, websiteFeaturedNames(rows))
	require.Equal(t, []int{0, 1}, websiteFeaturedOrders(rows))
}

func TestReplaceWebsiteFeaturedModelsEmptyClearsRows(t *testing.T) {
	db, _ := setupModelAccessDB(t)
	require.NoError(t, db.AutoMigrate(&WebsiteFeaturedModel{}))

	require.NoError(t, ReplaceWebsiteFeaturedModels([]string{"gpt-5.5"}))
	require.NoError(t, ReplaceWebsiteFeaturedModels(nil))
	rows, err := ListWebsiteFeaturedModels()
	require.NoError(t, err)
	require.Empty(t, rows)
}

func websiteFeaturedNames(rows []WebsiteFeaturedModel) []string {
	names := make([]string, 0, len(rows))
	for _, row := range rows {
		names = append(names, row.ModelName)
	}
	return names
}

func websiteFeaturedOrders(rows []WebsiteFeaturedModel) []int {
	orders := make([]int, 0, len(rows))
	for _, row := range rows {
		orders = append(orders, row.SortOrder)
	}
	return orders
}
