package model

import (
	"bytes"
	"fmt"
	"io"
	"os"
	"testing"

	"github.com/ClickHouse/clickhouse-go/v2/lib/proto"
	"github.com/QuantumNous/new-api/common"
	"github.com/glebarez/sqlite"
	"github.com/go-sql-driver/mysql"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func TestSanitizeDBErrorStripsDriverMessage(t *testing.T) {
	tests := []struct {
		name   string
		err    error
		want   string
		leaked string
	}{
		{
			name:   "mysql duplicate entry",
			err:    &mysql.MySQLError{Number: 1062, Message: "Duplicate entry 'test-secret' for key 'users.idx'"},
			want:   "mysql error 1062",
			leaked: "test-secret",
		},
		{
			name:   "postgres unique violation",
			err:    &pgconn.PgError{Code: "23505", Message: "duplicate key value", Detail: "Key (k)=(test-secret) already exists."},
			want:   "postgres error SQLSTATE 23505",
			leaked: "test-secret",
		},
		{
			name:   "clickhouse exception",
			err:    &proto.Exception{Code: 241, Message: "Memory limit exceeded while processing 'test-secret'"},
			want:   "clickhouse error 241",
			leaked: "test-secret",
		},
		{
			name:   "wrapped driver error",
			err:    fmt.Errorf("exec failed: %w", &mysql.MySQLError{Number: 1064, Message: "syntax error near 'test-secret'"}),
			want:   "mysql error 1064",
			leaked: "test-secret",
		},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			got := sanitizeDBError(test.err)
			require.Error(t, got)
			assert.Equal(t, test.want, got.Error())
			assert.NotContains(t, got.Error(), test.leaked)
		})
	}
}

func TestSanitizeDBErrorSQLiteDriver(t *testing.T) {
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{Logger: newGormLogger(io.Discard)})
	require.NoError(t, err)
	execErr := db.Exec("INSERT INTO missing_table (k) VALUES (?)", "test-secret").Error
	require.Error(t, execErr)

	got := sanitizeDBError(execErr)
	assert.Regexp(t, `^sqlite error \d+$`, got.Error())
	assert.NotContains(t, got.Error(), "test-secret")
}

func TestSanitizeDBErrorKeepsNonDriverErrors(t *testing.T) {
	err := fmt.Errorf("dial tcp 127.0.0.1:3306: connect: connection refused")
	assert.Equal(t, err, sanitizeDBError(err))
}

func TestGormLoggerEndToEndSanitizedOutput(t *testing.T) {
	previousDebug := common.DebugEnabled
	t.Cleanup(func() { common.DebugEnabled = previousDebug })

	execQuery := func() string {
		var buf bytes.Buffer
		db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{Logger: newGormLogger(&buf)})
		require.NoError(t, err)
		db.Exec("SELECT * FROM missing_table WHERE k = ?", "test-secret")
		return buf.String()
	}

	common.DebugEnabled = false
	out := execQuery()
	assert.Contains(t, out, "k = ?")
	assert.NotContains(t, out, "test-secret")
	assert.Contains(t, out, "sqlite error")
	assert.Contains(t, out, "gorm_logger_test.go")

	common.DebugEnabled = true
	debugOutput := execQuery()
	assert.Contains(t, debugOutput, "test-secret")
	assert.Contains(t, debugOutput, "no such table")
}

func TestGormLoggerSlowThresholdBounds(t *testing.T) {
	previous, hadPrevious := os.LookupEnv("SQL_SLOW_THRESHOLD_MS")
	t.Cleanup(func() {
		if hadPrevious {
			require.NoError(t, os.Setenv("SQL_SLOW_THRESHOLD_MS", previous))
		} else {
			require.NoError(t, os.Unsetenv("SQL_SLOW_THRESHOLD_MS"))
		}
	})

	for _, value := range []string{"0", "3600000", "-1", "3600001", "not-a-number"} {
		require.NoError(t, os.Setenv("SQL_SLOW_THRESHOLD_MS", value))
		assert.NotNil(t, newGormLogger(io.Discard))
	}
}
