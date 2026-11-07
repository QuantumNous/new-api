package model

import (
	"os"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/driver/mysql"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
)

func TestUserQuotaDisplayNamesDatabaseMatrix(t *testing.T) {
	for _, dialect := range []string{"sqlite", "mysql", "postgres"} {
		t.Run(dialect, func(t *testing.T) {
			var driver gorm.Dialector
			switch dialect {
			case "sqlite":
				driver = sqlite.Open(":memory:")
			case "mysql":
				dsn := os.Getenv("TEST_MYSQL_DSN")
				if dsn == "" {
					t.Skip("TEST_MYSQL_DSN not configured")
				}
				driver = mysql.Open(dsn)
			case "postgres":
				dsn := os.Getenv("TEST_POSTGRES_DSN")
				if dsn == "" {
					t.Skip("TEST_POSTGRES_DSN not configured")
				}
				driver = postgres.Open(dsn)
			}
			db, err := gorm.Open(driver, &gorm.Config{})
			require.NoError(t, err)
			sqlDB, err := db.DB()
			require.NoError(t, err)
			sqlDB.SetMaxOpenConns(1)
			if dialect != "sqlite" && (db.Migrator().HasTable(&User{}) || db.Migrator().HasTable(&QuotaData{})) {
				require.NoError(t, sqlDB.Close())
				t.Skip("test database must not contain users or quota_data tables")
			}
			previousDB, previousType := DB, common.MainDatabaseType()
			DB = db
			common.SetMainDatabaseType(common.DatabaseType(dialect))
			initCol()
			t.Cleanup(func() {
				assert.NoError(t, db.Migrator().DropTable(&QuotaData{}, &User{}))
				DB = previousDB
				common.SetMainDatabaseType(previousType)
				initCol()
				assert.NoError(t, sqlDB.Close())
			})
			require.NoError(t, db.AutoMigrate(&User{}, &QuotaData{}))
			var version string
			query := "SELECT version()"
			if dialect == "sqlite" {
				query = "SELECT sqlite_version()"
			}
			require.NoError(t, db.Raw(query).Scan(&version).Error)
			t.Logf("database version: %s", version)

			users := []User{
				{Id: 1, AffCode: "one", Username: "current-login", DisplayName: "Same Name"},
				{Id: 2, AffCode: "two", Username: "other-login", DisplayName: "Same Name"},
				{Id: 3, Username: "no-display-name", AffCode: "three"},
				{Id: 4, AffCode: "four", Username: "deleted-login", DisplayName: "Deleted Name"},
			}
			require.NoError(t, db.Create(&users).Error)
			require.NoError(t, db.Delete(&User{}, 4).Error)
			rows := []QuotaData{
				{UserID: 1, Username: "old-login", CreatedAt: 3600, Quota: 50, Count: 1, TokenUsed: 5, CacheReadTokens: 2, CacheCreationTokens: 1},
				{UserID: 1, Username: "current-login", CreatedAt: 3600, Quota: 30, Count: 2, TokenUsed: 3},
				{UserID: 2, Username: "other-login", CreatedAt: 3600, Quota: 20, Count: 1},
				{UserID: 3, Username: "no-display-name", CreatedAt: 3600, Quota: 0, TokenUsed: 1000, Count: 9},
				{UserID: 4, Username: "deleted-login", CreatedAt: 3600, Quota: 9},
				{UserID: 99, Username: "missing-login", CreatedAt: 3600, Quota: 8},
				{Username: "legacy-a", CreatedAt: 3600, Quota: 7},
				{Username: "legacy-b", CreatedAt: 3600, Quota: 6},
				{UserID: 1, Username: "current-login", CreatedAt: 7200, Quota: 999},
			}
			for i := range rows {
				rows[i].UseGroup = "default"
			}
			require.NoError(t, db.Create(&rows).Error)
			got, err := GetQuotaDataGroupByUser(3600, 3600)
			require.NoError(t, err)
			require.Len(t, got, 8)
			var renamedTotal, total, count, tokens int
			var cacheRead, cacheCreation int64
			legacy := map[string]int{}
			for _, row := range got {
				total += row.Quota
				count += row.Count
				tokens += row.TokenUsed
				cacheRead += row.CacheReadTokens
				cacheCreation += row.CacheCreationTokens
				switch row.UserID {
				case 1:
					assert.Equal(t, "current-login", row.Username)
					assert.Equal(t, "Same Name", row.DisplayName)
					renamedTotal += row.Quota
				case 2:
					assert.Equal(t, "Same Name", row.DisplayName)
				default:
					assert.Empty(t, row.DisplayName)
				}
				if row.UserID == 0 {
					legacy[row.Username] = row.Quota
				}
			}
			assert.Equal(t, 80, renamedTotal)
			assert.Equal(t, 130, total)
			assert.Equal(t, 13, count)
			assert.Equal(t, 1008, tokens)
			assert.Equal(t, int64(2), cacheRead)
			assert.Equal(t, int64(1), cacheCreation)
			assert.Equal(t, map[string]int{"legacy-a": 7, "legacy-b": 6}, legacy)
			for _, role := range []int{common.RoleAdminUser, common.RoleRootUser} {
				flow, err := GetFlowQuotaData(3600, 3600, "", 1, role)
				require.NoError(t, err)
				require.Len(t, flow, 8)
				var flowQuota, flowTokens, flowCount int
				for _, row := range flow {
					flowQuota += row.Quota
					flowTokens += row.TokenUsed
					flowCount += row.Count
					switch row.UserID {
					case 1:
						assert.Equal(t, "current-login", row.Username)
						assert.Equal(t, "Same Name", row.DisplayName)
					case 2:
						assert.Equal(t, "Same Name", row.DisplayName)
					default:
						assert.Empty(t, row.DisplayName)
					}
				}
				assert.Equal(t, total, flowQuota)
				assert.Equal(t, tokens, flowTokens)
				assert.Equal(t, count, flowCount)
			}
			self, err := GetFlowQuotaData(3600, 3600, "", 1, common.RoleCommonUser)
			require.NoError(t, err)
			require.Len(t, self, 1)
			assert.Zero(t, self[0].UserID)
			assert.Empty(t, self[0].Username)
			assert.Empty(t, self[0].DisplayName)
			assert.Equal(t, 80, self[0].Quota)
			assert.Equal(t, 8, self[0].TokenUsed)

			var unchanged QuotaData
			require.NoError(t, db.First(&unchanged, rows[0].Id).Error)
			assert.Equal(t, "old-login", unchanged.Username)
			empty, err := GetQuotaDataGroupByUser(9000, 10000)
			require.NoError(t, err)
			assert.Empty(t, empty)
		})
	}
}
