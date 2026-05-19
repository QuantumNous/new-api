package model

import (
	"bytes"
	"testing"
	"time"

	mysqldrv "github.com/go-sql-driver/mysql"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
)

// 不带任何参数的 MySQL DSN 应该被补上 dial/read/write 三个默认 timeout
// 以及 parseTime=true。这是防 batchUpdate 死锁的核心：read 永远 wait 时
// 30s 后会 timeout，goroutine 不会再卡死。
func TestEnsureMySQLDSNDefaults_AppliesDefaultTimeouts(t *testing.T) {
	raw := "user:pwd@tcp(127.0.0.1:3306)/newapi"

	got := ensureMySQLDSNDefaults(raw)

	cfg, err := mysqldrv.ParseDSN(got)
	require.NoError(t, err)
	require.Equal(t, 10*time.Second, cfg.Timeout, "dial timeout should default to 10s")
	require.Equal(t, 30*time.Second, cfg.ReadTimeout, "read timeout should default to 30s")
	require.Equal(t, 10*time.Second, cfg.WriteTimeout, "write timeout should default to 10s")
	require.True(t, cfg.ParseTime, "ParseTime should be true (gorm requires)")
}

// 用户在 DSN 里显式配置的 timeout 应该被原样保留，不能被默认值覆盖。
// 否则操作者无法在特殊场景（如内网零延迟、跨区域大延迟）下调整超时。
func TestEnsureMySQLDSNDefaults_PreservesUserValues(t *testing.T) {
	raw := "user:pwd@tcp(127.0.0.1:3306)/newapi?timeout=2s&readTimeout=5s&writeTimeout=3s"

	got := ensureMySQLDSNDefaults(raw)

	cfg, err := mysqldrv.ParseDSN(got)
	require.NoError(t, err)
	require.Equal(t, 2*time.Second, cfg.Timeout, "user-set Timeout must be preserved")
	require.Equal(t, 5*time.Second, cfg.ReadTimeout, "user-set ReadTimeout must be preserved")
	require.Equal(t, 3*time.Second, cfg.WriteTimeout, "user-set WriteTimeout must be preserved")
}

// 无效 DSN 时不能 panic，应该原样返回 raw 字符串，让 gorm.Open 那一层
// 自己抛连接错误（保留原有的错误处理路径）。
func TestEnsureMySQLDSNDefaults_ReturnsRawOnParseError(t *testing.T) {
	raw := "this-is-not-a-valid-dsn"

	require.NotPanics(t, func() {
		got := ensureMySQLDSNDefaults(raw)
		require.Equal(t, raw, got, "should return raw DSN unchanged when parsing fails")
	})
}

// 运维需要在跨区域 / 内网零延迟等场景调整 timeout，
// 默认值不应该硬编码——通过 SQL_*_TIMEOUT 环境变量可覆盖。
func TestEnsureMySQLDSNDefaults_HonorsSQLReadTimeoutEnv(t *testing.T) {
	t.Setenv("SQL_READ_TIMEOUT", "5")

	got := ensureMySQLDSNDefaults("user:pwd@tcp(host)/db")

	cfg, err := mysqldrv.ParseDSN(got)
	require.NoError(t, err)
	require.Equal(t, 5*time.Second, cfg.ReadTimeout,
		"SQL_READ_TIMEOUT env should override the 30s default")
}

func TestEnsureMySQLDSNDefaults_HonorsSQLWriteTimeoutEnv(t *testing.T) {
	t.Setenv("SQL_WRITE_TIMEOUT", "3")

	got := ensureMySQLDSNDefaults("user:pwd@tcp(host)/db")

	cfg, err := mysqldrv.ParseDSN(got)
	require.NoError(t, err)
	require.Equal(t, 3*time.Second, cfg.WriteTimeout,
		"SQL_WRITE_TIMEOUT env should override the 10s default")
}

func TestEnsureMySQLDSNDefaults_HonorsSQLDialTimeoutEnv(t *testing.T) {
	t.Setenv("SQL_DIAL_TIMEOUT", "2")

	got := ensureMySQLDSNDefaults("user:pwd@tcp(host)/db")

	cfg, err := mysqldrv.ParseDSN(got)
	require.NoError(t, err)
	require.Equal(t, 2*time.Second, cfg.Timeout,
		"SQL_DIAL_TIMEOUT env should override the 10s default")
}

// DSN 配错时静默 fallback 会让运维很难定位（"为啥我配的 readTimeout 没生效"）。
// 必须把解析错误记到错误日志，方便发现配错。
func TestEnsureMySQLDSNDefaults_LogsErrorOnParseFailure(t *testing.T) {
	var buf bytes.Buffer
	orig := gin.DefaultErrorWriter
	gin.DefaultErrorWriter = &buf
	t.Cleanup(func() { gin.DefaultErrorWriter = orig })

	ensureMySQLDSNDefaults("garbage-dsn-without-at-sign")

	require.Contains(t, buf.String(), "failed to parse MySQL DSN",
		"DSN parse failure must be logged via common.SysError")
}
