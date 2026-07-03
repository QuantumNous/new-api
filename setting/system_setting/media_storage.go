package system_setting

import (
	"os"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/setting/config"
)

// MediaStorageSettings 图片/视频统一落盘（OBS）配置。见 docs/media-storage-obs-design.md §10.2。
// 落 options 表（前缀 media_storage.），内存单例，controller/option.go GET/PUT 读写。
// AK/SK 优先取环境变量 OBS_AK/OBS_SK；否则取本结构体字段（加密入库，getter 解密）。
type MediaStorageSettings struct {
	Enabled        bool   `json:"enabled"`
	Provider       string `json:"provider"`        // obs（预留 minio / r2）
	CredentialType string `json:"credential_type"` // static | sts
	Endpoint       string `json:"endpoint"`
	Region         string `json:"region"`
	Bucket         string `json:"bucket"`

	// 凭证：加密入库（common.EncryptOBSSecret）；也可留空走环境变量 OBS_AK/OBS_SK。
	AccessKeyID     string `json:"access_key_id"`
	SecretAccessKey string `json:"secret_access_key"`

	STSTokenEndpoint string `json:"sts_token_endpoint"`
	STSRefreshSec    int    `json:"sts_refresh_sec"`

	SignedURLTTLHours int `json:"signed_url_ttl_hours"` // 签名 URL TTL，图片=视频=7d(168h)
	MaxObjectSizeMB   int `json:"max_object_size_mb"`   // 单文件硬上限，超过直接拒绝
	AsyncWorkerCount  int `json:"async_worker_count"`
	AsyncQueueSize    int `json:"async_queue_size"`

	// nfs_path 入库（自建模型，§5.1/§5.8）
	NFSOutputRoot     string `json:"nfs_output_root"`     // 容器内 SFS 挂载点；只读此前缀下文件
	IngestNFSPath     bool   `json:"ingest_nfs_path"`     // 自建模型 nfs_path 搬 OBS
	IngestUpstreamURL bool   `json:"ingest_upstream_url"` // 第三方上游 URL 搬 OBS
	// 上游 URL 下载的 host 白名单（防 SSRF 纵深），逗号/空白分隔，支持子域匹配
	// （填 example.com 同时放行 cdn.example.com）。留空 = 不限 host，仅做私网 IP/DNS 过滤。
	UpstreamURLAllowedHosts string `json:"upstream_url_allowed_hosts"`

	// 桶级用量监控 & 告警（§5.7）
	StatsSnapshotIntervalMinutes int     `json:"stats_snapshot_interval_minutes"`
	BucketWarnThresholdTB        float64 `json:"bucket_warn_threshold_tb"`
	BucketCriticalThresholdTB    float64 `json:"bucket_critical_threshold_tb"`
	AlertWebhook                 string  `json:"alert_webhook"`
	AlertDedupHours              int     `json:"alert_dedup_hours"`
}

// 默认配置（未在 DB 覆盖时生效）。
var mediaStorageSettings = MediaStorageSettings{
	Enabled:                      false,
	Provider:                     "obs",
	CredentialType:               "static",
	SignedURLTTLHours:            168, // 7d
	MaxObjectSizeMB:              200,
	AsyncWorkerCount:             4,
	AsyncQueueSize:               512,
	NFSOutputRoot:                "/nfs-output",
	IngestNFSPath:                true,
	IngestUpstreamURL:            true,
	StatsSnapshotIntervalMinutes: 60,
	BucketWarnThresholdTB:        2,
	BucketCriticalThresholdTB:    3,
	AlertDedupHours:              24,
	STSRefreshSec:                1800,
}

func init() {
	config.GlobalConfig.Register("media_storage", &mediaStorageSettings)
}

// GetMediaStorageSettings 返回全局单例（config manager 已按 DB 覆盖）。
func GetMediaStorageSettings() *MediaStorageSettings {
	return &mediaStorageSettings
}

// GetAccessKeyID 优先环境变量 OBS_AK；否则解密入库字段（解密失败回退原值，兼容明文迁移期）。
func (s *MediaStorageSettings) GetAccessKeyID() string {
	if v := os.Getenv("OBS_AK"); v != "" {
		return v
	}
	return decryptOrRaw(s.AccessKeyID)
}

// GetSecretAccessKey 优先环境变量 OBS_SK；否则解密入库字段。
func (s *MediaStorageSettings) GetSecretAccessKey() string {
	if v := os.Getenv("OBS_SK"); v != "" {
		return v
	}
	return decryptOrRaw(s.SecretAccessKey)
}

// AllowedUpstreamHosts 解析白名单为 host 列表（逗号/空白分隔，去空段）。
func (s *MediaStorageSettings) AllowedUpstreamHosts() []string {
	fields := strings.FieldsFunc(s.UpstreamURLAllowedHosts, func(r rune) bool {
		return r == ',' || r == ' ' || r == '\t' || r == '\n' || r == '\r'
	})
	hosts := make([]string, 0, len(fields))
	for _, f := range fields {
		if f != "" {
			hosts = append(hosts, f)
		}
	}
	return hosts
}

// NFSRoot 归一化后的挂载根（去尾斜杠，默认 /nfs-output）。
func (s *MediaStorageSettings) NFSRoot() string {
	root := strings.TrimRight(s.NFSOutputRoot, "/")
	if root == "" {
		return "/nfs-output"
	}
	return root
}

func decryptOrRaw(v string) string {
	if v == "" {
		return ""
	}
	plain, err := common.DecryptOBSSecret(v)
	if err == nil {
		return plain
	}
	// 带 obsenc: 标记的值一定是密文：解密失败说明 OBS_ENCRYPT_KEY 缺失/变更，
	// 绝不能把密文当凭证喂给 S3 客户端（否则只会报一堆难懂的签名错误）。
	// 返回空 → newOBSStore 直接报「access key/secret required」，问题可见。
	if common.IsOBSCipher(v) {
		common.SysError("media_storage: OBS 凭证解密失败（OBS_ENCRYPT_KEY 未设置或已变更），请设置正确密钥或在系统设置重新保存 AK/SK: " + err.Error())
		return ""
	}
	// 兼容：无标记的值可能是明文（尚未加密的历史值），直接返回。
	return v
}
