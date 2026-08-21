package model

import (
	"reflect"
	"strings"
	"testing"

	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

type fakeAssetBindingScopeColumnType struct {
	columnType   string
	databaseType string
	length       int64
	lengthOK     bool
}

func (f fakeAssetBindingScopeColumnType) Name() string { return "binding_scope" }

func (f fakeAssetBindingScopeColumnType) DatabaseTypeName() string { return f.databaseType }

func (f fakeAssetBindingScopeColumnType) ColumnType() (string, bool) {
	return f.columnType, f.columnType != ""
}

func (f fakeAssetBindingScopeColumnType) PrimaryKey() (bool, bool) { return false, false }

func (f fakeAssetBindingScopeColumnType) AutoIncrement() (bool, bool) { return false, false }

func (f fakeAssetBindingScopeColumnType) Length() (int64, bool) { return f.length, f.lengthOK }

func (f fakeAssetBindingScopeColumnType) DecimalSize() (int64, int64, bool) { return 0, 0, false }

func (f fakeAssetBindingScopeColumnType) Nullable() (bool, bool) { return true, true }

func (f fakeAssetBindingScopeColumnType) Unique() (bool, bool) { return false, false }

func (f fakeAssetBindingScopeColumnType) ScanType() reflect.Type { return reflect.TypeOf("") }

func (f fakeAssetBindingScopeColumnType) Comment() (string, bool) { return "", false }

func (f fakeAssetBindingScopeColumnType) DefaultValue() (string, bool) { return "", false }

var _ gorm.ColumnType = fakeAssetBindingScopeColumnType{}

type legacyAssetBindingScopeSchema struct {
	Id           int64  `gorm:"primaryKey"`
	BindingScope string `gorm:"type:varchar(80)"`
}

func (legacyAssetBindingScopeSchema) TableName() string { return "asset_bindings" }

type legacyAssetModelCoverageScopeSchema struct {
	Id           int64  `gorm:"primaryKey"`
	BindingScope string `gorm:"type:varchar(80)"`
}

func (legacyAssetModelCoverageScopeSchema) TableName() string { return "asset_model_coverage_targets" }

type legacyAssetModelReadinessScopeSchema struct {
	Id           int64  `gorm:"primaryKey"`
	BindingScope string `gorm:"type:varchar(80)"`
}

func (legacyAssetModelReadinessScopeSchema) TableName() string { return "asset_model_readinesses" }

func TestAssetBindingScopeColumnIsWideEnough(t *testing.T) {
	cases := []struct {
		name     string
		declared string
		database string
		length   int64
		lengthOK bool
		wantWide bool
	}{
		{name: "legacy varchar", declared: "varchar(80)", length: 80, lengthOK: true, wantWide: false},
		{name: "legacy character varying", declared: "character varying(80)", length: 80, lengthOK: true, wantWide: false},
		{name: "contract varchar", declared: "varchar(128)", length: 128, lengthOK: true, wantWide: true},
		{name: "larger varchar", declared: "varchar(191)", length: 191, lengthOK: true, wantWide: true},
		{name: "text", declared: "text", wantWide: true},
		{name: "clob", declared: "clob", wantWide: true},
		{name: "driver varchar metadata", database: "varchar", length: 80, lengthOK: true, wantWide: false},
		{name: "unknown type", declared: "json", wantWide: true},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			column := fakeAssetBindingScopeColumnType{
				columnType:   tc.declared,
				databaseType: tc.database,
				length:       tc.length,
				lengthOK:     tc.lengthOK,
			}
			require.Equal(t, tc.wantWide, assetBindingScopeColumnIsWideEnough(column))
		})
	}
}

func TestMigrateAssetBindingScopeColumnsWidensLegacyTables(t *testing.T) {
	db := newAssetTestDB(t,
		&legacyAssetBindingScopeSchema{},
		&legacyAssetModelCoverageScopeSchema{},
		&legacyAssetModelReadinessScopeSchema{},
	)
	require.NoError(t, migrateAssetBindingScopeColumns())
	require.NoError(t, migrateAssetBindingScopeColumns())

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
			if strings.EqualFold(column.Name(), "binding_scope") {
				declared, ok := column.ColumnType()
				require.True(t, ok, entry.table)
				require.Equal(t, "varchar(128)", strings.ToLower(declared), entry.table)
				found = true
				break
			}
		}
		require.True(t, found, entry.table)
	}
}
