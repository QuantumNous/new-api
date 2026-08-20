package model

import (
	"strings"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestAssetBindingScopeColumnsDeclareFullScopeCapacity(t *testing.T) {
	db := newAssetTestDB(t, &Asset{}, &AssetBinding{}, &AssetModelCoverageTarget{}, &AssetModelReadiness{})
	for _, entry := range []struct {
		model any
		table string
	}{
		{model: &AssetBinding{}, table: "asset_bindings"},
		{model: &AssetModelCoverageTarget{}, table: "asset_model_coverage_targets"},
		{model: &AssetModelReadiness{}, table: "asset_model_readinesses"},
	} {
		columns, err := db.Migrator().ColumnTypes(entry.model)
		require.NoError(t, err, entry.table)

		found := false
		for _, column := range columns {
			if !strings.EqualFold(column.Name(), "binding_scope") {
				continue
			}
			declared, ok := column.ColumnType()
			require.True(t, ok, entry.table)
			require.Equal(t, "varchar(128)", strings.ToLower(declared), entry.table)
			found = true
			break
		}
		require.True(t, found, entry.table)
	}
}
