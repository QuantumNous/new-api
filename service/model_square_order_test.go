package service

import (
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func TestBuildModelSquareOrder(t *testing.T) {
	database, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	require.NoError(t, err)
	sqlDB, err := database.DB()
	require.NoError(t, err)
	sqlDB.SetMaxOpenConns(1)
	require.NoError(t, database.AutoMigrate(&model.QuotaData{}))
	previousDB := model.DB
	previousOrder := *operation_setting.GetModelSquareSetting()
	previousDataExport := common.DataExportEnabled
	model.DB = database
	t.Cleanup(func() {
		model.DB = previousDB
		*operation_setting.GetModelSquareSetting() = previousOrder
		common.DataExportEnabled = previousDataExport
		modelUsageCache = map[int]modelUsageCacheItem{}
		_ = sqlDB.Close()
	})

	hourAgo := time.Now().Add(-time.Hour).Unix()
	require.NoError(t, database.Create(&[]model.QuotaData{
		{ModelName: "gamma", CreatedAt: hourAgo, Count: 5, TokenUsed: 900},
		// Ties with gamma: byte order puts upper case first.
		{ModelName: "Kappa", CreatedAt: hourAgo, Count: 5, TokenUsed: 900},
		{ModelName: "beta", CreatedAt: hourAgo, Count: 9, TokenUsed: 100},
		{ModelName: "beta", CreatedAt: hourAgo - 3600, Count: 1, TokenUsed: 50},
		// Per-call models can have requests without tokens.
		{ModelName: "delta", CreatedAt: hourAgo, Count: 3},
		{ModelName: "alpha", CreatedAt: hourAgo - 10*24*3600, Count: 99, TokenUsed: 9999},
		{ModelName: "retired", CreatedAt: hourAgo, Count: 50, TokenUsed: 5000},
	}).Error)
	pricing := []model.Pricing{{ModelName: "alpha"}, {ModelName: "beta"}, {ModelName: "delta"}, {ModelName: "gamma"}, {ModelName: "Kappa"}, {ModelName: "zeta"}}
	requests := []string{"beta", "Kappa", "gamma", "delta"}
	tokens := []string{"Kappa", "gamma", "beta"}

	for _, tc := range []struct {
		name       string
		setting    operation_setting.ModelSquareSetting
		dataExport bool
		want       ModelSquareOrder
	}{
		{
			name:       "no config keeps name order",
			setting:    operation_setting.ModelSquareSetting{SortMode: "manual", SortMetric: "tokens", SortDays: 7, SortModels: []string{}},
			dataExport: true,
			want:       ModelSquareOrder{Recommended: []string{}, Requests: requests, Tokens: tokens},
		},
		{
			name:       "manual drops unlisted and repeated names",
			setting:    operation_setting.ModelSquareSetting{SortMode: "manual", SortMetric: "tokens", SortDays: 7, SortModels: []string{"zeta", "retired", "alpha", "zeta"}},
			dataExport: true,
			want:       ModelSquareOrder{Recommended: []string{"zeta", "alpha"}, Requests: requests, Tokens: tokens},
		},
		{
			name:       "most requests",
			setting:    operation_setting.ModelSquareSetting{SortMode: "usage", SortMetric: "requests", SortDays: 7},
			dataExport: true,
			want:       ModelSquareOrder{Recommended: requests, Requests: requests, Tokens: tokens},
		},
		{
			name:       "most tokens leaves models without tokens to the name tail",
			setting:    operation_setting.ModelSquareSetting{SortMode: "usage", SortMetric: "tokens", SortDays: 7},
			dataExport: true,
			want:       ModelSquareOrder{Recommended: tokens, Requests: requests, Tokens: tokens},
		},
		{
			name:       "pinned models come before the most used",
			setting:    operation_setting.ModelSquareSetting{SortMode: "mixed", SortMetric: "tokens", SortDays: 7, SortModels: []string{"delta", "retired", "beta"}},
			dataExport: true,
			want:       ModelSquareOrder{Recommended: []string{"delta", "beta", "Kappa", "gamma"}, Requests: requests, Tokens: tokens},
		},
		{
			name:       "longer period counts older usage",
			setting:    operation_setting.ModelSquareSetting{SortMode: "usage", SortMetric: "tokens", SortDays: 30},
			dataExport: true,
			want:       ModelSquareOrder{Recommended: []string{"alpha", "Kappa", "gamma", "beta"}, Requests: []string{"alpha", "beta", "Kappa", "gamma", "delta"}, Tokens: []string{"alpha", "Kappa", "gamma", "beta"}},
		},
		{
			name:    "without dashboard data usage sorts fall back to names",
			setting: operation_setting.ModelSquareSetting{SortMode: "mixed", SortMetric: "requests", SortDays: 7, SortModels: []string{"gamma"}},
			want:    ModelSquareOrder{Recommended: []string{"gamma"}, Requests: []string{}, Tokens: []string{}},
		},
	} {
		t.Run(tc.name, func(t *testing.T) {
			*operation_setting.GetModelSquareSetting() = tc.setting
			common.DataExportEnabled = tc.dataExport
			modelUsageCache = map[int]modelUsageCacheItem{}

			assert.Equal(t, tc.want, BuildModelSquareOrder(pricing))
		})
	}

	// The public model square gets names only, never usage figures.
	*operation_setting.GetModelSquareSetting() = operation_setting.ModelSquareSetting{SortMode: "usage", SortMetric: "requests", SortDays: 7}
	common.DataExportEnabled = true
	encoded, err := common.Marshal(BuildModelSquareOrder(pricing))
	require.NoError(t, err)
	assert.JSONEq(t, `{"recommended":["beta","Kappa","gamma","delta"],"requests":["beta","Kappa","gamma","delta"],"tokens":["Kappa","gamma","beta"]}`, string(encoded))
}
