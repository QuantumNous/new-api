package service

import (
	"testing"

	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting/ratio_setting"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func TestModelMappingTargetChained(t *testing.T) {
	raw := `{"claude-sonnet-4-6":"claude-sonnet-4-6-thinking"}`
	require.Equal(t, "claude-sonnet-4-6-thinking", ModelMappingTarget(&raw, "claude-sonnet-4-6"))
	require.Equal(t, "", ModelMappingTarget(&raw, "claude-opus-4-7"))
}

func TestChannelModelPriceDataUsesModelMapping(t *testing.T) {
	oldDB := model.DB
	t.Cleanup(func() {
		model.DB = oldDB
	})

	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	require.NoError(t, err)
	model.DB = db

	require.NoError(t, db.Exec(`
		CREATE TABLE channels (
			id integer primary key,
			recharge_rate real,
			model_mapping text,
			setting text,
			apimaster_price_ratio real,
			model_price_ratios text
		)
	`).Error)
	require.NoError(t, db.Exec(`
		CREATE TABLE channel_model_pricings (
			id integer primary key,
			channel_id integer not null,
			model_name text not null,
			input_price real,
			output_price real,
			cache_price real,
			cache_creation_price real,
			group_ratio real,
			pricing_source text
		)
	`).Error)
	mapping := `{"claude-sonnet-4-6":"claude-sonnet-4-6-thinking"}`
	require.NoError(t, db.Exec(`INSERT INTO channels (id, recharge_rate, model_mapping) VALUES (20, 1.0, ?)`, mapping).Error)
	require.NoError(t, db.Exec(`
		INSERT INTO channel_model_pricings
			(channel_id, model_name, input_price, output_price, cache_price, cache_creation_price, group_ratio, pricing_source)
		VALUES
			(20, 'claude-sonnet-4-6', 1.0, 2.0, 0, 0, 0.95, 'api'),
			(20, 'claude-sonnet-4-6-thinking', 3.0, 15.0, 0, 0, 0.95, 'api')
	`).Error)

	priceData, ok := ChannelModelPriceData(20, "claude-sonnet-4-6")
	require.True(t, ok)
	require.InDelta(t, 1.5, priceData.ModelRatio, 0.000001) // 3.0 / 2
	require.InDelta(t, 5.0, priceData.CompletionRatio, 0.000001)
}

func TestChannelModelPriceDataWithoutMappingUsesCanonicalPrice(t *testing.T) {
	oldDB := model.DB
	t.Cleanup(func() { model.DB = oldDB })

	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	require.NoError(t, err)
	model.DB = db
	require.NoError(t, db.Exec(`CREATE TABLE channels (id integer primary key, recharge_rate real, model_mapping text, setting text, apimaster_price_ratio real, model_price_ratios text)`).Error)
	require.NoError(t, db.Exec(`CREATE TABLE channel_model_pricings (
		id integer primary key, channel_id integer not null, model_name text not null,
		input_price real, output_price real, cache_price real, cache_creation_price real,
		group_ratio real, pricing_source text)`).Error)
	require.NoError(t, db.Exec(`INSERT INTO channels (id, recharge_rate, model_mapping) VALUES (81, 1, '')`).Error)
	require.NoError(t, db.Exec(`INSERT INTO channel_model_pricings
		(channel_id, model_name, input_price, output_price, group_ratio, pricing_source) VALUES
		(81, 'gpt-image-2', 0.0085, 0, 0.8, 'api'),
		(81, 'gpt-image-2-official', 0.16872, 0, 0.8, 'api')`).Error)

	priceData, ok := ChannelModelPriceData(81, "gpt-image-2")
	require.True(t, ok)
	require.InDelta(t, 0.00425, priceData.ModelRatio, 0.000001)
}

func TestChannelActualPricesResolvedFallsBackToManualPricing(t *testing.T) {
	ratio_setting.InitRatioSettings()

	oldDB := model.DB
	t.Cleanup(func() {
		model.DB = oldDB
	})

	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	require.NoError(t, err)
	model.DB = db

	require.NoError(t, db.Exec(`
		CREATE TABLE channels (
			id integer primary key,
			recharge_rate real,
			apimaster_price_ratio real,
			model_mapping text,
			setting text,
			model_price_ratios text
		)
	`).Error)
	require.NoError(t, db.Exec(`
		CREATE TABLE channel_model_pricings (
			id integer primary key,
			channel_id integer not null,
			model_name text not null,
			input_price real,
			output_price real,
			cache_price real,
			cache_creation_price real,
			group_ratio real,
			pricing_source text
		)
	`).Error)

	setting := `{"manual_group_ratio":2,"model_price_ratio":0.8}`
	require.NoError(t, db.Exec(`
		INSERT INTO channels (id, recharge_rate, apimaster_price_ratio, model_mapping, setting)
		VALUES (50, 1.2, 1.05, '', ?)
	`, setting).Error)

	manual, ok := LookupPublicManualPricing(&setting, "gpt-5")
	require.True(t, ok)
	require.True(t, manual.InputPrice > 0)

	actual, err := ChannelActualPricesResolved(50, "gpt-5")
	require.NoError(t, err)
	require.NotNil(t, actual)
	require.InDelta(t, manual.InputPrice*1.2*1.05, actual.InputPrice, 0.000001)
	require.InDelta(t, manual.OutputPrice*1.2*1.05, actual.OutputPrice, 0.000001)
	require.InDelta(t, manual.CachePrice*1.2*1.05, actual.CachePrice, 0.000001)
	require.InDelta(t, manual.CacheCreationPrice*1.2*1.05, actual.CacheCreationPrice, 0.000001)

	procurement, err := ChannelProcurementPricesResolved(50, "gpt-5")
	require.NoError(t, err)
	require.NotNil(t, procurement)
	require.InDelta(t, manual.InputPrice*1.2, procurement.InputPrice, 0.000001)
	require.InDelta(t, manual.OutputPrice*1.2, procurement.OutputPrice, 0.000001)
	require.InDelta(t, manual.CachePrice*1.2, procurement.CachePrice, 0.000001)
	require.InDelta(t, manual.CacheCreationPrice*1.2, procurement.CacheCreationPrice, 0.000001)
}
