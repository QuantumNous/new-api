package store

import (
	"os"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/wechat-epay-adapter/internal/config"
	"github.com/QuantumNous/new-api/wechat-epay-adapter/internal/database"
	"github.com/QuantumNous/new-api/wechat-epay-adapter/internal/order"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestMySQLAndPostgresIntegration(t *testing.T) {
	for _, test := range []struct {
		name     string
		typeName string
		dsnEnv   string
	}{
		{name: "mysql", typeName: "mysql", dsnEnv: "WECHAT_EPAY_TEST_MYSQL_DSN"},
		{name: "postgres", typeName: "postgres", dsnEnv: "WECHAT_EPAY_TEST_POSTGRES_DSN"},
	} {
		t.Run(test.name, func(t *testing.T) {
			dsn := os.Getenv(test.dsnEnv)
			if dsn == "" {
				t.Skipf("set %s to run %s integration checks", test.dsnEnv, test.name)
			}
			db, err := database.Open(config.Config{DatabaseType: test.typeName, DatabaseDSN: dsn})
			require.NoError(t, err)
			require.NoError(t, Migrate(db))
			repository := New(db)
			orderRecord := testOrder("integration-" + test.name + "-" + time.Now().UTC().Format("20060102150405.000000000"))
			orderRecord.Status = order.StatusPayable
			require.NoError(t, repository.DB().Create(&orderRecord).Error)

			duplicate := orderRecord
			duplicate.ID += "-duplicate"
			duplicate.GatewayTradeNo += "-duplicate"
			duplicate.CashierTokenHash += "-duplicate"
			err = repository.DB().Create(&duplicate).Error
			require.Error(t, err)

			claimed, found, err := repository.ClaimNotificationTask(time.Now().UTC(), "integration-worker", time.Minute)
			require.NoError(t, err)
			assert.False(t, found)
			assert.Empty(t, claimed.ID)
		})
	}
}
