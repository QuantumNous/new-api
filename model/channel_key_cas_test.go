package model

import (
	"context"
	"strings"
	"testing"
	"time"

	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/require"
	"gorm.io/driver/mysql"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

type channelKeyCASSQLRecorder struct {
	statements []string
}

func (recorder *channelKeyCASSQLRecorder) LogMode(logger.LogLevel) logger.Interface {
	return recorder
}

func (recorder *channelKeyCASSQLRecorder) Info(context.Context, string, ...any)  {}
func (recorder *channelKeyCASSQLRecorder) Warn(context.Context, string, ...any)  {}
func (recorder *channelKeyCASSQLRecorder) Error(context.Context, string, ...any) {}

func (recorder *channelKeyCASSQLRecorder) Trace(_ context.Context, _ time.Time, fc func() (string, int64), _ error) {
	statement, _ := fc()
	recorder.statements = append(recorder.statements, statement)
}

func (recorder *channelKeyCASSQLRecorder) channelUpdate() string {
	for _, statement := range recorder.statements {
		if strings.Contains(statement, "UPDATE `channels`") {
			return statement
		}
	}
	return ""
}

func TestCompareAndSwapChannelKeyQuotesReservedKeyColumnForMySQL(t *testing.T) {
	backing, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{Logger: logger.Default.LogMode(logger.Silent)})
	require.NoError(t, err)
	sqlDB, err := backing.DB()
	require.NoError(t, err)
	t.Cleanup(func() { _ = sqlDB.Close() })

	recorder := &channelKeyCASSQLRecorder{}
	mysqlDB, err := gorm.Open(mysql.New(mysql.Config{
		Conn:                      sqlDB,
		SkipInitializeWithVersion: true,
	}), &gorm.Config{DryRun: true, DisableAutomaticPing: true, Logger: recorder})
	require.NoError(t, err)

	originalDB, originalKeyCol := DB, commonKeyCol
	DB, commonKeyCol = mysqlDB, "`key`"
	t.Cleanup(func() {
		DB, commonKeyCol = originalDB, originalKeyCol
	})

	swapped, err := CompareAndSwapChannelKey(182, 113, "old", "new")
	require.NoError(t, err)
	require.False(t, swapped)

	statement := recorder.channelUpdate()
	require.NotEmpty(t, statement)
	require.Contains(t, statement, "AND `key` =", "MySQL reserves KEY; the CAS predicate must use the dialect-quoted column")
}
