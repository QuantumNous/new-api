package service

import (
	"testing"

	"github.com/QuantumNous/new-api/model"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func TestChannelModelPriceDataUsesActualChannelPrices(t *testing.T) {
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
	require.NoError(t, db.Exec(`INSERT INTO channels (id, recharge_rate, model_mapping) VALUES (7, 1.2, '')`).Error)
	require.NoError(t, db.Exec(`
		INSERT INTO channel_model_pricings
			(channel_id, model_name, input_price, output_price, cache_price, cache_creation_price, group_ratio, pricing_source)
		VALUES
			(7, 'priced-model', 3.0, 15.0, 0.3, 3.75, 1.0, 'api')
	`).Error)

	priceData, ok := ChannelModelPriceData(7, "priced-model")
	require.True(t, ok)
	require.InDelta(t, 1.8, priceData.ModelRatio, 0.000001)
	require.InDelta(t, 5.0, priceData.CompletionRatio, 0.000001)
	require.InDelta(t, 0.1, priceData.CacheRatio, 0.000001)
	require.InDelta(t, 1.25, priceData.CacheCreationRatio, 0.000001)
}
