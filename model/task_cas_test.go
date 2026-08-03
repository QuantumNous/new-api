package model

import (
	"encoding/json"
	"fmt"
	"net"
	"os"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/glebarez/sqlite"
	mysqlDriver "github.com/go-sql-driver/mysql"
	"github.com/jackc/pgx/v5"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func validateDisposableMySQLTestDB(dsn string, confirmedDB string) error {
	if dsn == "" {
		return fmt.Errorf("SQL_DSN is required")
	}
	if confirmedDB == "" {
		return fmt.Errorf("ENTITLEMENT_TEST_MYSQL_DISPOSABLE_DB is required")
	}

	config, err := mysqlDriver.ParseDSN(dsn)
	if err != nil {
		return fmt.Errorf("invalid SQL_DSN: %w", err)
	}
	if config.Net != "tcp" {
		return fmt.Errorf("MySQL test database must use a local TCP connection")
	}
	host, _, err := net.SplitHostPort(config.Addr)
	if err != nil {
		return fmt.Errorf("invalid MySQL test address: %w", err)
	}
	if host != "127.0.0.1" && host != "localhost" && host != "::1" {
		return fmt.Errorf("MySQL test database host must be local")
	}
	if config.DBName != confirmedDB {
		return fmt.Errorf("confirmed disposable database does not match SQL_DSN database")
	}
	if !strings.HasPrefix(config.DBName, "p1verify") {
		return fmt.Errorf("MySQL test database name must start with p1verify")
	}
	return nil
}

func validateDisposablePostgreSQLTestDB(dsn string, confirmedDB string) error {
	if dsn == "" {
		return fmt.Errorf("SQL_DSN is required")
	}
	if confirmedDB == "" {
		return fmt.Errorf("ENTITLEMENT_TEST_POSTGRES_DISPOSABLE_DB is required")
	}

	config, err := pgx.ParseConfig(dsn)
	if err != nil {
		return fmt.Errorf("invalid SQL_DSN: %w", err)
	}
	if config.Host != "/tmp" && config.Host != "127.0.0.1" && config.Host != "localhost" && config.Host != "::1" {
		return fmt.Errorf("PostgreSQL test database host must be local")
	}
	if config.Database != confirmedDB {
		return fmt.Errorf("confirmed disposable database does not match SQL_DSN database")
	}
	if !strings.HasPrefix(config.Database, "p1verify") {
		return fmt.Errorf("PostgreSQL test database name must start with p1verify")
	}
	return nil
}

func TestMain(m *testing.M) {
	if os.Getenv("ENTITLEMENT_TEST_POSTGRES") == "1" {
		if os.Getenv("ENTITLEMENT_TEST_MYSQL") == "1" {
			panic("ENTITLEMENT_TEST_POSTGRES and ENTITLEMENT_TEST_MYSQL cannot both be enabled")
		}
		if err := validateDisposablePostgreSQLTestDB(
			os.Getenv("SQL_DSN"),
			os.Getenv("ENTITLEMENT_TEST_POSTGRES_DISPOSABLE_DB"),
		); err != nil {
			panic("refusing unsafe entitlement PostgreSQL test target: " + err.Error())
		}
		if os.Getenv("LOG_SQL_DSN") != "" {
			panic("refusing entitlement PostgreSQL tests with LOG_SQL_DSN set; log writes must share the validated disposable database")
		}
		common.UsingSQLite = false
		common.UsingMySQL = false
		common.UsingPostgreSQL = false
		common.IsMasterNode = true
		common.RedisEnabled = false
		common.BatchUpdateEnabled = false
		common.LogConsumeEnabled = true
		if err := InitDB(); err != nil {
			panic("failed to initialize PostgreSQL test db: " + err.Error())
		}
		if !common.UsingPostgreSQL {
			panic("ENTITLEMENT_TEST_POSTGRES=1 did not initialize a PostgreSQL database")
		}
		LOG_DB = DB
		sqlDB, err := DB.DB()
		if err != nil {
			panic("failed to get sql.DB: " + err.Error())
		}
		sqlDB.SetMaxOpenConns(20)
		exitCode := m.Run()
		_ = sqlDB.Close()
		os.Exit(exitCode)
	}
	if os.Getenv("ENTITLEMENT_TEST_MYSQL") == "1" {
		if err := validateDisposableMySQLTestDB(
			os.Getenv("SQL_DSN"),
			os.Getenv("ENTITLEMENT_TEST_MYSQL_DISPOSABLE_DB"),
		); err != nil {
			panic("refusing unsafe entitlement MySQL test target: " + err.Error())
		}
		if os.Getenv("LOG_SQL_DSN") != "" {
			panic("refusing entitlement MySQL tests with LOG_SQL_DSN set; log writes must share the validated disposable database")
		}
		common.UsingSQLite = false
		common.UsingMySQL = false
		common.UsingPostgreSQL = false
		common.IsMasterNode = true
		common.RedisEnabled = false
		common.BatchUpdateEnabled = false
		common.LogConsumeEnabled = true
		if err := InitDB(); err != nil {
			panic("failed to initialize MySQL test db: " + err.Error())
		}
		if !common.UsingMySQL {
			panic("ENTITLEMENT_TEST_MYSQL=1 did not initialize a MySQL database")
		}
		LOG_DB = DB
		sqlDB, err := DB.DB()
		if err != nil {
			panic("failed to get MySQL test db: " + err.Error())
		}
		sqlDB.SetMaxOpenConns(20)
		exitCode := m.Run()
		_ = sqlDB.Close()
		os.Exit(exitCode)
	}

	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	if err != nil {
		panic("failed to open test db: " + err.Error())
	}
	DB = db
	LOG_DB = db

	common.UsingSQLite = true
	common.RedisEnabled = false
	common.BatchUpdateEnabled = false
	common.LogConsumeEnabled = true

	sqlDB, err := db.DB()
	if err != nil {
		panic("failed to get sql.DB: " + err.Error())
	}
	sqlDB.SetMaxOpenConns(1)

	if err := db.AutoMigrate(
		&Task{},
		&User{},
		&Token{},
		&Log{},
		&Channel{},
		&TopUp{},
		&SubscriptionPlan{},
		&SubscriptionOrder{},
		&UserSubscription{},
	); err != nil {
		panic("failed to migrate: " + err.Error())
	}

	os.Exit(m.Run())
}

func TestValidateDisposableMySQLTestDB(t *testing.T) {
	t.Parallel()

	validDSN := "root:local-only@tcp(127.0.0.1:13382)/p1verify_review?parseTime=true"
	require.NoError(t, validateDisposableMySQLTestDB(validDSN, "p1verify_review"))

	tests := []struct {
		name        string
		dsn         string
		confirmedDB string
	}{
		{name: "missing dsn", confirmedDB: "p1verify_review"},
		{name: "missing confirmation", dsn: validDSN},
		{
			name:        "remote host",
			dsn:         "root:local-only@tcp(db.example.com:3306)/p1verify_review?parseTime=true",
			confirmedDB: "p1verify_review",
		},
		{
			name:        "unix socket",
			dsn:         "root:local-only@unix(/tmp/mysql.sock)/p1verify_review?parseTime=true",
			confirmedDB: "p1verify_review",
		},
		{
			name:        "confirmation mismatch",
			dsn:         validDSN,
			confirmedDB: "p1verify_other",
		},
		{
			name:        "database without disposable prefix",
			dsn:         "root:local-only@tcp(127.0.0.1:13382)/production?parseTime=true",
			confirmedDB: "production",
		},
	}

	for _, test := range tests {
		test := test
		t.Run(test.name, func(t *testing.T) {
			t.Parallel()
			require.Error(t, validateDisposableMySQLTestDB(test.dsn, test.confirmedDB))
		})
	}
}

func TestValidateDisposablePostgreSQLTestDB(t *testing.T) {
	t.Parallel()

	validDSN := "postgresql://dc@/p1verify_review?host=/tmp&sslmode=disable"
	require.NoError(t, validateDisposablePostgreSQLTestDB(validDSN, "p1verify_review"))

	tests := []struct {
		name        string
		dsn         string
		confirmedDB string
	}{
		{name: "missing dsn", confirmedDB: "p1verify_review"},
		{name: "missing confirmation", dsn: validDSN},
		{
			name:        "remote host",
			dsn:         "postgresql://dc@db.example/p1verify_review?sslmode=disable",
			confirmedDB: "p1verify_review",
		},
		{
			name:        "confirmation mismatch",
			dsn:         validDSN,
			confirmedDB: "p1verify_other",
		},
		{
			name:        "database without disposable prefix",
			dsn:         "postgresql://dc@/production?host=/tmp&sslmode=disable",
			confirmedDB: "production",
		},
	}

	for _, test := range tests {
		test := test
		t.Run(test.name, func(t *testing.T) {
			t.Parallel()
			require.Error(t, validateDisposablePostgreSQLTestDB(test.dsn, test.confirmedDB))
		})
	}
}
func truncateTables(t *testing.T) {
	t.Helper()
	t.Cleanup(func() {
		DB.Exec("DELETE FROM tasks")
		DB.Exec("DELETE FROM users")
		DB.Exec("DELETE FROM tokens")
		DB.Exec("DELETE FROM logs")
		DB.Exec("DELETE FROM channels")
		DB.Exec("DELETE FROM top_ups")
		DB.Exec("DELETE FROM subscription_orders")
		DB.Exec("DELETE FROM subscription_plans")
		DB.Exec("DELETE FROM user_subscriptions")
	})
}

func insertTask(t *testing.T, task *Task) {
	t.Helper()
	task.CreatedAt = time.Now().Unix()
	task.UpdatedAt = time.Now().Unix()
	require.NoError(t, DB.Create(task).Error)
}

// ---------------------------------------------------------------------------
// Snapshot / Equal — pure logic tests (no DB)
// ---------------------------------------------------------------------------

func TestSnapshotEqual_Same(t *testing.T) {
	s := taskSnapshot{
		Status:     TaskStatusInProgress,
		Progress:   "50%",
		StartTime:  1000,
		FinishTime: 0,
		FailReason: "",
		ResultURL:  "",
		Data:       json.RawMessage(`{"key":"value"}`),
	}
	assert.True(t, s.Equal(s))
}

func TestSnapshotEqual_DifferentStatus(t *testing.T) {
	a := taskSnapshot{Status: TaskStatusInProgress, Data: json.RawMessage(`{}`)}
	b := taskSnapshot{Status: TaskStatusSuccess, Data: json.RawMessage(`{}`)}
	assert.False(t, a.Equal(b))
}

func TestSnapshotEqual_DifferentProgress(t *testing.T) {
	a := taskSnapshot{Status: TaskStatusInProgress, Progress: "30%", Data: json.RawMessage(`{}`)}
	b := taskSnapshot{Status: TaskStatusInProgress, Progress: "60%", Data: json.RawMessage(`{}`)}
	assert.False(t, a.Equal(b))
}

func TestSnapshotEqual_DifferentData(t *testing.T) {
	a := taskSnapshot{Status: TaskStatusInProgress, Data: json.RawMessage(`{"a":1}`)}
	b := taskSnapshot{Status: TaskStatusInProgress, Data: json.RawMessage(`{"a":2}`)}
	assert.False(t, a.Equal(b))
}

func TestSnapshotEqual_NilVsEmpty(t *testing.T) {
	a := taskSnapshot{Status: TaskStatusInProgress, Data: nil}
	b := taskSnapshot{Status: TaskStatusInProgress, Data: json.RawMessage{}}
	// bytes.Equal(nil, []byte{}) == true
	assert.True(t, a.Equal(b))
}

func TestSnapshot_Roundtrip(t *testing.T) {
	task := &Task{
		Status:     TaskStatusInProgress,
		Progress:   "42%",
		StartTime:  1234,
		FinishTime: 5678,
		FailReason: "timeout",
		PrivateData: TaskPrivateData{
			ResultURL: "https://example.com/result.mp4",
		},
		Data: json.RawMessage(`{"model":"test-model"}`),
	}
	snap := task.Snapshot()
	assert.Equal(t, task.Status, snap.Status)
	assert.Equal(t, task.Progress, snap.Progress)
	assert.Equal(t, task.StartTime, snap.StartTime)
	assert.Equal(t, task.FinishTime, snap.FinishTime)
	assert.Equal(t, task.FailReason, snap.FailReason)
	assert.Equal(t, task.PrivateData.ResultURL, snap.ResultURL)
	assert.JSONEq(t, string(task.Data), string(snap.Data))
}

// ---------------------------------------------------------------------------
// UpdateWithStatus CAS — DB integration tests
// ---------------------------------------------------------------------------

func TestUpdateWithStatus_Win(t *testing.T) {
	truncateTables(t)

	task := &Task{
		TaskID:   "task_cas_win",
		Status:   TaskStatusInProgress,
		Progress: "50%",
		Data:     json.RawMessage(`{}`),
	}
	insertTask(t, task)

	task.Status = TaskStatusSuccess
	task.Progress = "100%"
	won, err := task.UpdateWithStatus(TaskStatusInProgress)
	require.NoError(t, err)
	assert.True(t, won)

	var reloaded Task
	require.NoError(t, DB.First(&reloaded, task.ID).Error)
	assert.EqualValues(t, TaskStatusSuccess, reloaded.Status)
	assert.Equal(t, "100%", reloaded.Progress)
}

func TestUpdateWithStatus_Lose(t *testing.T) {
	truncateTables(t)

	task := &Task{
		TaskID: "task_cas_lose",
		Status: TaskStatusFailure,
		Data:   json.RawMessage(`{}`),
	}
	insertTask(t, task)

	task.Status = TaskStatusSuccess
	won, err := task.UpdateWithStatus(TaskStatusInProgress) // wrong fromStatus
	require.NoError(t, err)
	assert.False(t, won)

	var reloaded Task
	require.NoError(t, DB.First(&reloaded, task.ID).Error)
	assert.EqualValues(t, TaskStatusFailure, reloaded.Status) // unchanged
}

func TestUpdateWithStatus_ConcurrentWinner(t *testing.T) {
	truncateTables(t)

	task := &Task{
		TaskID: "task_cas_race",
		Status: TaskStatusInProgress,
		Quota:  1000,
		Data:   json.RawMessage(`{}`),
	}
	insertTask(t, task)

	const goroutines = 5
	wins := make([]bool, goroutines)
	var wg sync.WaitGroup
	wg.Add(goroutines)

	for i := 0; i < goroutines; i++ {
		go func(idx int) {
			defer wg.Done()
			t := &Task{}
			*t = Task{
				ID:       task.ID,
				TaskID:   task.TaskID,
				Status:   TaskStatusSuccess,
				Progress: "100%",
				Quota:    task.Quota,
				Data:     json.RawMessage(`{}`),
			}
			t.CreatedAt = task.CreatedAt
			t.UpdatedAt = time.Now().Unix()
			won, err := t.UpdateWithStatus(TaskStatusInProgress)
			if err == nil {
				wins[idx] = won
			}
		}(i)
	}
	wg.Wait()

	winCount := 0
	for _, w := range wins {
		if w {
			winCount++
		}
	}
	assert.Equal(t, 1, winCount, "exactly one goroutine should win the CAS")
}
