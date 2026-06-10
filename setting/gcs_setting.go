package setting

import (
	"fmt"
	"os"
	"strconv"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
)

// GCS 视频任务结果转存配置（环境变量驱动，进程启动时经 InitGCSSettings 一次性加载）。
// 设计文档：gcs-video-transfer-design.md 4.6。
//
// 配置约束（见设计文档 4.4 重试模型 / 风险 4）：
//   - GCSTransferDeadline 必须远大于 GCSTransferTimeout 与最坏排队时间，且小于各渠道直链最短时效；
//   - TASK_TIMEOUT_MINUTES 必须显著大于「最长上游生成时间 + GCSTransferDeadline」，
//     否则全局 sweep 会先于 transferDeadline 误杀在途转存。
var (
	// GCSTransferEnabled 紧急开关：关闭后回退直链透传（GCS 故障时止血，切换语义见设计文档 4.6）
	GCSTransferEnabled bool
	// GCSResultBucket 转存目标 bucket
	GCSResultBucket string
	// GCSResultPrefix 对象前缀（首尾不含斜杠）
	GCSResultPrefix string
	// GCSSignedURLTTL V4 签名链接有效期（V4 上限 7 天）
	GCSSignedURLTTL time.Duration
	// GCSResultRetentionDays 结果保留期（天），必须与 bucket 生命周期规则保持一致；
	// 读取侧据此判过期，属对外 API 契约的一部分
	GCSResultRetentionDays int
	// GCSTransferDeadline 转存墙钟截止：now - UpstreamDoneAt 超过该值，
	// 轮询侧 CAS 翻 FAILURE、CAS 赢才退款
	GCSTransferDeadline time.Duration
	// GCSTransferConcurrency worker 并发转存数
	GCSTransferConcurrency int
	// GCSTransferTimeout 单次转存（整任务全部对象）超时，必须经 context 强制
	GCSTransferTimeout time.Duration
	// GCSMaxObjectSize 单对象体积上限（字节）
	GCSMaxObjectSize int64
	// GCSSignCacheTTL 签名缓存 TTL（Workload Identity/SignBlob 路径防止高频轮询放大签名调用）
	GCSSignCacheTTL time.Duration
)

// InitGCSSettings 从环境变量加载 GCS 转存配置，必须在 common.InitEnv 之后、
// service.InitGCSStorage 之前调用（见 main.go InitResources）。
func InitGCSSettings() {
	GCSTransferEnabled = common.GetEnvOrDefaultBool("GCS_TRANSFER_ENABLED", false)
	GCSResultBucket = common.GetEnvOrDefaultString("GCS_RESULT_BUCKET", "taluna-api-result")
	GCSResultPrefix = strings.Trim(common.GetEnvOrDefaultString("GCS_RESULT_PREFIX", "api/video"), "/")
	GCSSignedURLTTL = getEnvDuration("GCS_SIGNED_URL_TTL", 12*time.Hour)
	GCSResultRetentionDays = common.GetEnvOrDefault("GCS_RESULT_RETENTION_DAYS", 30)
	GCSTransferDeadline = getEnvDuration("GCS_TRANSFER_DEADLINE", 2*time.Hour)
	GCSTransferConcurrency = common.GetEnvOrDefault("GCS_TRANSFER_CONCURRENCY", 4)
	GCSTransferTimeout = getEnvDuration("GCS_TRANSFER_TIMEOUT", 10*time.Minute)
	GCSMaxObjectSize = getEnvByteSize("GCS_MAX_OBJECT_SIZE", 2<<30) // 2 GiB
	GCSSignCacheTTL = getEnvDuration("GCS_SIGN_CACHE_TTL", 10*time.Minute)
}

// getEnvDuration 解析 time.ParseDuration 格式的环境变量（如 "12h"、"10m"），
// 解析失败时记录错误并使用默认值（与 common.GetEnvOrDefault 行为一致）。
func getEnvDuration(env string, defaultValue time.Duration) time.Duration {
	raw := os.Getenv(env)
	if raw == "" {
		return defaultValue
	}
	d, err := time.ParseDuration(raw)
	if err != nil || d <= 0 {
		common.SysError(fmt.Sprintf("failed to parse %s: %q is not a valid positive duration, using default value: %s", env, raw, defaultValue))
		return defaultValue
	}
	return d
}

// getEnvByteSize 解析体积环境变量，支持纯字节数或 KiB/MiB/GiB/KB/MB/GB 后缀（如 "2GiB"、"512MiB"），
// 解析失败时记录错误并使用默认值。
func getEnvByteSize(env string, defaultValue int64) int64 {
	raw := strings.TrimSpace(os.Getenv(env))
	if raw == "" {
		return defaultValue
	}
	n, err := parseByteSize(raw)
	if err != nil || n <= 0 {
		common.SysError(fmt.Sprintf("failed to parse %s: %q is not a valid positive byte size, using default value: %d", env, raw, defaultValue))
		return defaultValue
	}
	return n
}

func parseByteSize(s string) (int64, error) {
	upper := strings.ToUpper(strings.TrimSpace(s))
	multiplier := int64(1)
	for _, unit := range []struct {
		suffix string
		factor int64
	}{
		{"GIB", 1 << 30}, {"GB", 1 << 30},
		{"MIB", 1 << 20}, {"MB", 1 << 20},
		{"KIB", 1 << 10}, {"KB", 1 << 10},
		{"B", 1},
	} {
		if strings.HasSuffix(upper, unit.suffix) {
			multiplier = unit.factor
			upper = strings.TrimSpace(strings.TrimSuffix(upper, unit.suffix))
			break
		}
	}
	num, err := strconv.ParseInt(upper, 10, 64)
	if err != nil {
		return 0, err
	}
	return num * multiplier, nil
}
