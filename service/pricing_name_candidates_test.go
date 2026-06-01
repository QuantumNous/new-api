package service

import (
	"testing"

	"github.com/QuantumNous/new-api/model"
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
			model_mapping text
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
			(20, 'claude-sonnet-4-6-thinking', 3.0, 15.0, 0, 0, 0.95, 'api')
	`).Error)

	priceData, ok := ChannelModelPriceData(20, "claude-sonnet-4-6")
	require.True(t, ok)
	require.InDelta(t, 1.5, priceData.ModelRatio, 0.000001) // 3.0 / 2
	require.InDelta(t, 5.0, priceData.CompletionRatio, 0.000001)
}
