package model

import (
	"database/sql/driver"
	"encoding/json"
	"os"
	"path/filepath"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/driver/mysql"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
)

// 保护契约:PostgreSQL 走 simple protocol(PrepareStmt 关闭)时,driver.Valuer
// 返回 []byte 会被 pgx 按 bytea 十六进制字面量编码,写入 json 列触发
// SQLSTATE 22P02。所有 json 列的 Value() 必须返回 string(或 nil)。
func TestJSONColumnValuersReturnString(t *testing.T) {
	testCases := []struct {
		name   string
		valuer driver.Valuer
		want   string
	}{
		{
			name:   "ChannelInfo",
			valuer: ChannelInfo{IsMultiKey: true, MultiKeySize: 2},
			want:   `{"is_multi_key":true,"multi_key_size":2,"multi_key_status_list":null,"multi_key_polling_index":0,"multi_key_mode":""}`,
		},
		{
			name:   "Properties",
			valuer: Properties{Input: "hello"},
			want:   `{"input":"hello"}`,
		},
		{
			name:   "TaskPrivateData",
			valuer: TaskPrivateData{Key: "k"},
			want:   `{"key":"k"}`,
		},
		{
			name:   "JSONValue",
			valuer: JSONValue(`[{"k":"v"}]`),
			want:   `[{"k":"v"}]`,
		},
	}

	for _, testCase := range testCases {
		t.Run(testCase.name, func(t *testing.T) {
			value, err := testCase.valuer.Value()
			require.NoError(t, err)
			str, ok := value.(string)
			require.True(t, ok, "Value() must return string, got %T", value)
			assert.JSONEq(t, testCase.want, str)
		})
	}
}

// 空值仍返回 nil,保持列的 NULL 语义。
func TestJSONColumnValuersZeroValueIsNil(t *testing.T) {
	for name, valuer := range map[string]driver.Valuer{
		"Properties":      Properties{},
		"TaskPrivateData": TaskPrivateData{},
		"JSONValue":       JSONValue(nil),
	} {
		t.Run(name, func(t *testing.T) {
			value, err := valuer.Value()
			require.NoError(t, err)
			assert.Nil(t, value)
		})
	}
}

// 保护契约:json 列的 Scan 必须同时接受 []byte 与 string——不同驱动/协议
// 模式返回类型不同,静默丢弃 string 会把已有数据清零。
func TestJSONColumnScannersAcceptStringAndBytes(t *testing.T) {
	toInput := func(kind string, payload string) any {
		if kind == "bytes" {
			return []byte(payload)
		}
		return payload
	}

	for _, kind := range []string{"bytes", "string"} {
		t.Run(kind, func(t *testing.T) {
			var info ChannelInfo
			require.NoError(t, info.Scan(toInput(kind, `{"is_multi_key":true,"multi_key_size":2}`)))
			assert.True(t, info.IsMultiKey)
			assert.Equal(t, 2, info.MultiKeySize)

			var props Properties
			require.NoError(t, props.Scan(toInput(kind, `{"input":"hello"}`)))
			assert.Equal(t, "hello", props.Input)

			var private TaskPrivateData
			require.NoError(t, private.Scan(toInput(kind, `{"key":"k"}`)))
			assert.Equal(t, "k", private.Key)
		})
	}
}

func TestJSONColumnDatabaseRoundTrip(t *testing.T) {
	type row struct {
		ID          int `gorm:"primaryKey"`
		Name        string
		Info        ChannelInfo     `gorm:"type:json"`
		Properties  Properties      `gorm:"type:json"`
		PrivateData TaskPrivateData `gorm:"type:json"`
		Payload     JSONValue       `gorm:"type:json"`
		Other       string          `gorm:"type:text"`
	}
	const payload = `{"id":9007199254740993,"count":0,"enabled":false}`
	const logData = `{"content":"\u003ctag\u003e图片","id":9007199254740993}`
	for _, dialect := range []string{"sqlite", "mysql", "postgres"} {
		t.Run(dialect, func(t *testing.T) {
			var driver gorm.Dialector
			switch dialect {
			case "sqlite":
				driver = sqlite.Open(filepath.Join(t.TempDir(), "json.db"))
			case "mysql":
				dsn := os.Getenv("TEST_MYSQL_DSN")
				if dsn == "" {
					t.Skip("TEST_MYSQL_DSN is not configured")
				}
				driver = mysql.Open(dsn)
			case "postgres":
				dsn := os.Getenv("TEST_POSTGRES_DSN")
				if dsn == "" {
					t.Skip("TEST_POSTGRES_DSN is not configured")
				}
				driver = postgres.New(postgres.Config{DSN: dsn, PreferSimpleProtocol: true})
			}
			db, err := gorm.Open(driver, &gorm.Config{})
			require.NoError(t, err)
			sqlDB, err := db.DB()
			require.NoError(t, err)
			sqlDB.SetMaxOpenConns(1)
			t.Cleanup(func() { require.NoError(t, sqlDB.Close()) })
			const tableName = "json_codec_round_trip"
			table := db.Model(&row{}).Table(tableName).Session(&gorm.Session{})
			require.NoError(t, table.AutoMigrate(&row{}))
			t.Cleanup(func() { require.NoError(t, db.Migrator().DropTable(tableName)) })
			var version string
			if dialect == "sqlite" {
				require.NoError(t, db.Raw("select sqlite_version()").Scan(&version).Error)
			} else {
				require.NoError(t, db.Raw("select version()").Scan(&version).Error)
			}
			t.Logf("%s version: %s", dialect, version)
			require.NoError(t, table.Create(map[string]any{
				"name":         "legacy",
				"info":         `{"is_multi_key":true,"multi_key_size":2,"multi_key_status_list":{"0":1,"1":0},"multi_key_polling_index":0,"multi_key_mode":""}`,
				"properties":   `{"input":"\u003cp\u003e图片\u003c/p\u003e"}`,
				"private_data": `{"upstream_task_id":"upstream-1","plugin_state":` + payload + `}`,
				"payload":      payload,
				"other":        logData,
			}).Error)
			require.NoError(t, table.AutoMigrate(&row{}))
			other, err := common.Marshal(map[string]any{"content": "<tag>图片", "id": json.Number("9007199254740993")})
			require.NoError(t, err)
			current := row{
				Name:        "current",
				Info:        ChannelInfo{IsMultiKey: true, MultiKeySize: 2, MultiKeyStatusList: map[int]int{0: 1, 1: 0}},
				Properties:  Properties{Input: "<p>图片</p>"},
				PrivateData: TaskPrivateData{UpstreamTaskID: "upstream-1", PluginState: json.RawMessage(payload)},
				Payload:     JSONValue(payload),
				Other:       string(other),
			}
			require.NoError(t, table.Create(&current).Error)
			for _, name := range []string{"legacy", "current"} {
				t.Run(name, func(t *testing.T) {
					var got row
					require.NoError(t, table.Where("name = ?", name).First(&got).Error)
					assert.Equal(t, current.Info, got.Info)
					assert.Equal(t, current.Properties, got.Properties)
					assert.Equal(t, "upstream-1", got.PrivateData.UpstreamTaskID)
					assert.JSONEq(t, payload, string(got.PrivateData.PluginState))
					assert.Equal(t, logData, got.Other)
					var decoded struct {
						ID      json.Number `json:"id"`
						Count   *int        `json:"count"`
						Enabled *bool       `json:"enabled"`
					}
					require.NoError(t, common.Unmarshal(got.Payload, &decoded))
					assert.Equal(t, json.Number("9007199254740993"), decoded.ID)
					require.NotNil(t, decoded.Count)
					require.NotNil(t, decoded.Enabled)
					assert.Zero(t, *decoded.Count)
					assert.False(t, *decoded.Enabled)
				})
			}
			require.NoError(t, table.Create(&row{Name: "empty"}).Error)
			var empty row
			require.NoError(t, table.Where(map[string]any{
				"name": "empty", "properties": nil, "private_data": nil, "payload": nil,
			}).First(&empty).Error)
			assert.Equal(t, Properties{}, empty.Properties)
			assert.Equal(t, TaskPrivateData{}, empty.PrivateData)
			assert.Nil(t, empty.Payload)
		})
	}
}
