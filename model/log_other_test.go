package model

import (
	"net/http/httptest"
	"os"
	"strings"
	"testing"
	"unicode/utf8"

	"github.com/QuantumNous/new-api/common"
	"github.com/gin-gonic/gin"
	"github.com/glebarez/sqlite"
	"gorm.io/driver/mysql"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/schema"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestLogRequestHeaders(t *testing.T) {
	assert.Nil(t, CaptureLogRequestHeaders(nil))
	request := httptest.NewRequest("POST", "/v1/chat/completions", nil)
	assert.Nil(t, CaptureLogRequestHeaders(request))
	request.Header.Set("User-Agent", strings.Repeat("客", 4097))
	request.Header.Add("X-Forwarded-For", "203.0.113.10, 2001:db8::1")
	request.Header.Add("X-Forwarded-For", "192.0.2.20")
	request.Header.Set("Authorization", "Bearer must-not-be-logged")
	headers := CaptureLogRequestHeaders(request)
	require.NotNil(t, headers)
	assert.Equal(t, strings.Repeat("客", 4096), headers.UserAgent)
	assert.True(t, utf8.ValidString(headers.UserAgent))
	assert.Equal(t, "203.0.113.10, 2001:db8::1, 192.0.2.20", headers.XForwardedFor)
	request.Header.Set("X-Forwarded-For", strings.Repeat("1", 4097))
	assert.Len(t, CaptureLogRequestHeaders(request).XForwardedFor, 4096)
	other := NewLogOther()
	other.SetRequestHeaders(headers)
	other.SetRequestHeaders(nil)
	assert.NotContains(t, other.JSONString(), "must-not-be-logged")
	assert.Equal(t, headers.XForwardedFor, other.Snapshot()["x_forwarded_for"])
}

func TestRequestHeadersLogDatabaseMatrix(t *testing.T) {
	for _, dialect := range []string{"sqlite", "mysql", "postgres"} {
		t.Run(dialect, func(t *testing.T) {
			var driver gorm.Dialector
			switch dialect {
			case "sqlite":
				driver = sqlite.Open(":memory:")
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
				driver = postgres.Open(dsn)
			}
			db, err := gorm.Open(driver, &gorm.Config{NamingStrategy: schema.NamingStrategy{TablePrefix: "request_headers_test_"}})
			require.NoError(t, err)
			sqlDB, err := db.DB()
			require.NoError(t, err)
			previousDB, previousLogDB := DB, LOG_DB
			previousMainType, previousLogType := common.MainDatabaseType(), common.LogDatabaseType()
			previousRedis, previousExport, previousConsume := common.RedisEnabled, common.DataExportEnabled, common.LogConsumeEnabled
			DB, LOG_DB = db, db
			common.SetDatabaseTypes(common.DatabaseType(dialect), common.DatabaseType(dialect))
			common.RedisEnabled, common.DataExportEnabled, common.LogConsumeEnabled = false, false, true
			t.Cleanup(func() {
				assert.NoError(t, db.Migrator().DropTable(&Log{}, &User{}, &Task{}))
				assert.NoError(t, sqlDB.Close())
				DB, LOG_DB = previousDB, previousLogDB
				common.SetDatabaseTypes(previousMainType, previousLogType)
				common.RedisEnabled, common.DataExportEnabled, common.LogConsumeEnabled = previousRedis, previousExport, previousConsume
			})
			require.NoError(t, db.AutoMigrate(&Log{}, &User{}, &Task{}))
			versionQuery := "SELECT version()"
			if dialect == "sqlite" {
				versionQuery = "SELECT sqlite_version()"
			}
			var version string
			require.NoError(t, db.Raw(versionQuery).Scan(&version).Error)
			t.Logf("database version: %s", version)
			user := &User{Username: "request-headers", Setting: `{"record_ip_log":false}`}
			require.NoError(t, db.Create(user).Error)
			for _, kind := range []string{"consume", "error"} {
				for _, withHeaders := range []bool{false, true} {
					c, _ := gin.CreateTestContext(httptest.NewRecorder())
					c.Request = httptest.NewRequest("POST", "/v1/chat/completions", nil)
					c.Set("username", user.Username)
					c.Set(common.RequestIdKey, kind)
					var other *LogOther
					if withHeaders {
						c.Request.Header.Set("User-Agent", "headers-test/1.0")
						c.Request.Header.Set("X-Forwarded-For", "203.0.113.10, 2001:db8::1")
						other = NewLogOther()
						other.SetPublic("request_path", "/v1/chat/completions")
						other.SetAdmin("diagnostic", "preserved")
					}
					if kind == "consume" {
						RecordConsumeLog(c, user.Id, RecordConsumeLogParams{Other: other})
					} else {
						RecordErrorLog(c, user.Id, 0, "test", "test", "upstream failed", 0, 0, false, "default", other)
					}
					var stored Log
					require.NoError(t, db.Order("id DESC").First(&stored).Error)
					assert.Equal(t, kind, stored.RequestId)
					assert.Empty(t, stored.Ip, "recording request headers must not enable the IP column")
					formatUserLogs([]*Log{&stored}, 0)
					metadata, err := common.StrToMap(stored.Other)
					require.NoError(t, err)
					if withHeaders {
						assert.Equal(t, "headers-test/1.0", metadata["user_agent"])
						assert.Equal(t, "203.0.113.10, 2001:db8::1", metadata["x_forwarded_for"])
						assert.Equal(t, "/v1/chat/completions", metadata["request_path"])
						assert.NotContains(t, metadata, "admin_info")
					} else {
						assert.NotContains(t, metadata, "user_agent")
						assert.NotContains(t, metadata, "x_forwarded_for")
					}
				}
			}
			task := &Task{TaskID: "headers-task", PrivateData: TaskPrivateData{Execution: &TaskExecutionSnapshot{
				RequestHeaders: &LogRequestHeaders{UserAgent: "task-test/1.0", XForwardedFor: "2001:db8::1"},
			}}}
			require.NoError(t, db.Create(task).Error)
			var loaded Task
			require.NoError(t, db.First(&loaded, task.ID).Error)
			require.NotNil(t, loaded.PrivateData.Execution)
			assert.Equal(t, task.PrivateData.Execution.RequestHeaders, loaded.PrivateData.Execution.RequestHeaders)
		})
	}
}

func TestLogOtherScopesAndMerges(t *testing.T) {
	var other LogOther

	assert.True(t, other.SetPublic("request_path", "/v1/chat/completions"))
	other.MergePublic(map[string]any{
		"zero": 0,
	})
	assert.True(t, other.SetAdmin("use_channel", []string{"channel-a"}))
	other.MergeAdmin(map[string]any{
		"rejected": false,
	})
	assert.True(t, other.SetRoot("upstream_request_id", "upstream-private"))
	other.MergeRoot(map[string]any{
		"generation": 0,
	})
	assert.True(t, other.SetAudit("method", "POST"))
	other.MergeAudit(map[string]any{
		"success": false,
	})

	require.JSONEq(t, `{
		"request_path": "/v1/chat/completions",
		"zero": 0,
		"admin_info": {
			"use_channel": ["channel-a"],
			"rejected": false
		},
		"root_info": {
			"upstream_request_id": "upstream-private",
			"generation": 0
		},
		"audit_info": {
			"method": "POST",
			"success": false
		}
	}`, other.JSONString())
}

func TestLogOtherRejectsSensitivePublicFields(t *testing.T) {
	other := NewLogOther()

	for _, key := range []string{
		"admin_info",
		"root_info",
		"audit_info",
		"channel_id",
		"channel_name",
		"channel_type",
		"reject_reason",
	} {
		assert.False(t, other.SetPublic(key, "must-not-leak"), key)
	}
	other.MergePublic(map[string]any{
		"request_path": "/v1/responses",
		"channel_name": "still-must-not-leak",
		"admin_info":   map[string]any{"secret": true},
	})

	require.JSONEq(t, `{"request_path":"/v1/responses"}`, other.JSONString())
	require.JSONEq(t, `{}`, NewLogOther().JSONString())
}

func TestLogOtherJSONStringDoesNotMutateReceiver(t *testing.T) {
	other := NewLogOther()
	require.True(t, other.SetPublic("request_path", "/v1/chat/completions"))
	require.True(t, other.SetAdmin("rejected", false))

	before := other.Snapshot()
	first := other.JSONString()
	after := other.Snapshot()
	second := other.JSONString()

	require.Equal(t, before, after)
	require.Equal(t, first, second)
}
