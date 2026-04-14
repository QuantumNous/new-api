package model

import (
	"bytes"
	"log"
	"testing"

	"github.com/DATA-DOG/go-sqlmock"
	"github.com/stretchr/testify/require"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	gormlogger "gorm.io/gorm/logger"
)

func TestGetUserByIdDoesNotIssueExtraAllowRechargeQueryOnPostgres(t *testing.T) {
	sqlDB, mock, err := sqlmock.New()
	require.NoError(t, err)
	defer sqlDB.Close()

	var logBuffer bytes.Buffer
	gormDB, err := gorm.Open(postgres.New(postgres.Config{Conn: sqlDB}), &gorm.Config{
		Logger: gormlogger.New(
			log.New(&logBuffer, "", 0),
			gormlogger.Config{
				LogLevel: gormlogger.Error,
				Colorful: false,
			},
		),
	})
	require.NoError(t, err)

	originalDB := DB
	DB = gormDB
	defer func() {
		DB = originalDB
	}()

	rows := sqlmock.NewRows([]string{
		"id",
		"username",
		"password",
		"display_name",
		"role",
		"status",
		"group",
		"allow_recharge",
	}).AddRow(7, "pg-user", "secret", "PG User", 1, 1, "default", false)

	mock.ExpectQuery(`SELECT \* FROM "users" WHERE id = \$1 AND "users"\."deleted_at" IS NULL ORDER BY "users"\."id" LIMIT 1`).
		WithArgs(7).
		WillReturnRows(rows)

	user, err := GetUserById(7, false)
	require.NoError(t, err)
	require.NotNil(t, user)
	require.False(t, user.AllowRecharge)
	require.Empty(t, user.Password)
	require.NoError(t, mock.ExpectationsWereMet())
	require.NotContains(t, logBuffer.String(), "SELECT allow_recharge FROM users")
}
