package controller

import (
	"encoding/json"
	"fmt"
	"net/http/httptest"
	"os"
	"strconv"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/gin-gonic/gin"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/driver/clickhouse"
	"gorm.io/driver/mysql"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
)

// tokenLogTestRow 仅定义分页和脱敏需要的日志字段，避免测试依赖无关业务数据
type tokenLogTestRow struct {
	ID          int `gorm:"primaryKey;autoIncrement:false"`
	TokenID     int
	CreatedAt   int64
	RequestID   string
	Content     string
	ChannelName string
	Other       string
}

// TestGetLogByKeyPagination 验证令牌日志接口的兼容性、分页和隔离；t 为测试上下文，无返回值
func TestGetLogByKeyPagination(t *testing.T) {
	gin.SetMode(gin.TestMode)
	// 1. 未指定自定义上限的接口仍限制为每页 100 条
	ctx, _ := gin.CreateTestContext(httptest.NewRecorder())
	ctx.Request = httptest.NewRequest("GET", "/api/log?page_size=1000", nil)
	assert.Equal(t, 100, common.GetPageQuery(ctx).PageSize)
	for _, dialect := range []string{"sqlite", "mysql", "postgres", "clickhouse"} {
		t.Run(dialect, func(t *testing.T) {
			// 1. 外部数据库必须显式配置，且不能覆盖已有日志表
			var driver gorm.Dialector
			switch dialect {
			case "sqlite":
				driver = sqlite.Open(":memory:")
			case "mysql":
				dsn := os.Getenv("TEST_MYSQL_DSN")
				if dsn == "" {
					t.Skip("未配置 TEST_MYSQL_DSN")
				}
				driver = mysql.Open(dsn)
			case "postgres":
				dsn := os.Getenv("TEST_POSTGRES_DSN")
				if dsn == "" {
					t.Skip("未配置 TEST_POSTGRES_DSN")
				}
				driver = postgres.Open(dsn)
			case "clickhouse":
				dsn := os.Getenv("TEST_CLICKHOUSE_DSN")
				if dsn == "" {
					t.Skip("未配置 TEST_CLICKHOUSE_DSN")
				}
				driver = clickhouse.Open(dsn)
			}
			db, err := gorm.Open(driver, &gorm.Config{})
			require.NoError(t, err)
			sqlDB, err := db.DB()
			require.NoError(t, err)
			t.Cleanup(func() { assert.NoError(t, sqlDB.Close()) })
			require.False(t, db.Migrator().HasTable("logs"), "测试数据库必须不含 logs 表")
			table := db.Table("logs")
			if dialect == "clickhouse" {
				table = table.Set("gorm:table_options", "ENGINE = MergeTree() ORDER BY (created_at, request_id)")
			}
			require.NoError(t, table.Migrator().CreateTable(&tokenLogTestRow{}))
			t.Cleanup(func() { assert.NoError(t, db.Migrator().DropTable("logs")) })
			previousDB, previousType := model.LOG_DB, common.LogDatabaseType()
			model.LOG_DB = db
			common.SetLogDatabaseType(common.DatabaseType(dialect))
			t.Cleanup(func() {
				model.LOG_DB = previousDB
				common.SetLogDatabaseType(previousType)
			})
			if dialect == "sqlite" {
				var version string
				require.NoError(t, db.Raw("SELECT sqlite_version()").Scan(&version).Error)
				t.Logf("SQLite %s", version)
			}

			// 2. 固定数据覆盖旧版上限之外的历史记录，并穿插另一令牌的数据
			rows := make([]tokenLogTestRow, 1006)
			for i := range rows {
				rows[i] = tokenLogTestRow{ID: i + 1, TokenID: 7, CreatedAt: int64(i/2 + 1), RequestID: fmt.Sprintf("request-%04d", i+1), Content: strconv.Itoa(i + 1), ChannelName: "private", Other: `{"admin_info":{"secret":"hidden"},"root_info":{"secret":"hidden"}}`}
				if dialect == "clickhouse" {
					// ClickHouse 按时间及请求 ID 排序，数据库 ID 故意与时间顺序相反
					rows[i].ID = len(rows) - i
				}
			}
			rows[1005].TokenID = 8
			require.NoError(t, db.Table("logs").Create(&rows).Error)

			// 3. 同一组 HTTP 断言验证所有数据库的实际查询结果
			for _, tc := range []struct {
				name, query                     string
				token, page, size, count, first int
				legacy, failure                 bool
			}{
				{name: "legacy", token: 7, count: 1000, first: 1005, legacy: true},
				{name: "unrelated_parameter", query: "?token_id=8", token: 7, count: 1000, first: 1005, legacy: true},
				{name: "first_page", query: "?p=1&page_size=2&token_id=8", token: 7, page: 1, size: 2, count: 2, first: 1005},
				{name: "second_page", query: "?p=2&page_size=2", token: 7, page: 2, size: 2, count: 2, first: 1003},
				{name: "older_history", query: "?p=101&page_size=10", token: 7, page: 101, size: 10, count: 5, first: 5},
				{name: "empty_page", query: "?p=102&page_size=10", token: 7, page: 102, size: 10},
				{name: "default_size", query: "?p=1", token: 7, page: 1, size: 10, count: 10, first: 1005},
				{name: "ps_alias", query: "?ps=2", token: 7, page: 1, size: 2, count: 2, first: 1005},
				{name: "size_alias", query: "?size=2", token: 7, page: 1, size: 2, count: 2, first: 1005},
				{name: "thousand_items", query: "?page_size=1000", token: 7, page: 1, size: 1000, count: 1000, first: 1005},
				{name: "limit", query: "?page_size=1001", token: 7, page: 1, size: 1000, count: 1000, first: 1005},
				{name: "negative", query: "?p=-2&page_size=-1", token: 7, page: 1, size: 10, count: 10, first: 1005},
				{name: "invalid", query: "?p=bad&page_size=bad", token: 7, page: 1, size: 10, count: 10, first: 1005},
				{name: "zero", query: "?p=0&page_size=0", token: 7, page: 1, size: 10, count: 10, first: 1005},
				{name: "empty_parameter", query: "?p=", token: 7, page: 1, size: 10, count: 10, first: 1005},
				{name: "unknown_token", query: "?p=1", token: 9, page: 1, size: 10},
				{name: "missing_token", query: "?p=1", failure: true},
				{name: "overflow", query: "?p=" + strconv.Itoa(int(^uint(0)>>1)) + "&page_size=100", token: 7, failure: true},
			} {
				t.Run(tc.name, func(t *testing.T) {
					recorder := httptest.NewRecorder()
					ctx, _ := gin.CreateTestContext(recorder)
					ctx.Request = httptest.NewRequest("GET", "/api/log/token"+tc.query, nil)
					ctx.Set("token_id", tc.token)
					GetLogByKey(ctx)
					var response struct {
						Success bool            `json:"success"`
						Data    json.RawMessage `json:"data"`
					}
					require.NoError(t, common.Unmarshal(recorder.Body.Bytes(), &response))
					require.Equal(t, !tc.failure, response.Success)
					if tc.failure {
						return
					}
					var logs []model.Log
					if tc.legacy {
						require.NoError(t, common.Unmarshal(response.Data, &logs))
					} else {
						var page struct {
							Page     int         `json:"page"`
							PageSize int         `json:"page_size"`
							Total    int         `json:"total"`
							Items    []model.Log `json:"items"`
						}
						require.NoError(t, common.Unmarshal(response.Data, &page))
						assert.Equal(t, tc.page, page.Page)
						assert.Equal(t, tc.size, page.PageSize)
						total := 1005
						if tc.token == 9 {
							total = 0
						}
						assert.Equal(t, total, page.Total)
						require.NotNil(t, page.Items)
						logs = page.Items
					}
					require.Len(t, logs, tc.count)
					for i, log := range logs {
						assert.Equal(t, tc.token, log.TokenId)
						assert.Equal(t, strconv.Itoa(tc.first-i), log.Content)
						assert.Equal(t, max(0, tc.page-1)*tc.size+i+1, log.Id)
						assert.Empty(t, log.ChannelName)
						assert.NotContains(t, log.Other, "hidden")
					}
				})
			}
			// 4. 查询和计数失败都不能返回成功响应
			require.NoError(t, db.Migrator().DropTable("logs"))
			for _, query := range []string{"", "?p=1"} {
				recorder := httptest.NewRecorder()
				ctx, _ := gin.CreateTestContext(recorder)
				ctx.Request = httptest.NewRequest("GET", "/api/log/token"+query, nil)
				ctx.Set("token_id", 7)
				GetLogByKey(ctx)
				var response struct {
					Success bool `json:"success"`
				}
				require.NoError(t, common.Unmarshal(recorder.Body.Bytes(), &response))
				assert.False(t, response.Success)
			}
		})
	}
}
