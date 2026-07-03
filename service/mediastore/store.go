// Package mediastore 实现图片/视频统一落盘（OBS）的存储抽象层。
// 设计见 docs/media-storage-obs-design.md。运行时走 S3 兼容 SDK（OBS），
// 便于未来切 MinIO / R2。核心动作：Persist（nfs_path|上游URL → OBS）、
// Sign（实时签名 URL）、Delete/DeleteObjects（用户注销清理）、Healthcheck。
package mediastore

import (
	"context"
	"errors"
	"time"
)

// ErrNotEnabled 表示媒体存储总开关关闭或未配置，调用方应回退到老行为（透传原值）。
var ErrNotEnabled = errors.New("mediastore: not enabled")

// ErrObjectTooLarge 单文件超过 MaxObjectSizeMB 上限。
var ErrObjectTooLarge = errors.New("mediastore: object exceeds size limit")

// ErrInvalidSource Persist 的 src 既无 NFSPath 也无 UpstreamURL，或校验不通过。
var ErrInvalidSource = errors.New("mediastore: invalid persist source")

// PersistSource 落盘来源（NFSPath / UpstreamURL / Data 三选一，按此优先级）。
type PersistSource struct {
	NFSPath     string // 非空：从本机挂载的 SFS 读文件（自建模型，GPUStack）
	UpstreamURL string // 非空：从上游 URL 下载（第三方渠道），host 须命中白名单（防 SSRF）
	Data        []byte // 非空：内存字节直传（如第三方返回的 b64_json 解码后）
	ContentType string // 由扩展名 / 上游 Content-Type 推断，写入 OBS 对象；空则由 key 扩展名推断
}

// SignOptions 控制签名 URL 的可选行为（如强制下载文件名）。
type SignOptions struct {
	DownloadName string // 非空 → 附加 response-content-disposition=attachment;filename=...
}

// SignOption 函数式选项。
type SignOption func(*SignOptions)

// WithDownloadName 让签名 URL 触发浏览器下载并指定文件名（§5.6）。
func WithDownloadName(name string) SignOption {
	return func(o *SignOptions) { o.DownloadName = name }
}

// StorageInfo 桶级用量快照（§5.7；主路走 HCSO CES，此处为 admin 后台兜底）。
type StorageInfo struct {
	TotalBytes   int64
	TotalObjects int64
}

// Store 存储抽象。所有实现须并发安全。
type Store interface {
	// Persist 把 src 指向的一份媒体搬到 OBS 的 key，写入 ContentType 与自定义 metadata。
	Persist(ctx context.Context, key string, src PersistSource, meta map[string]string) error
	// Sign 为 key 实时签发带 Expires 的可访问 URL（永不落库）。
	Sign(ctx context.Context, key string, ttl time.Duration, opts ...SignOption) (string, error)
	// Delete 删除单个对象（幂等）。
	Delete(ctx context.Context, key string) error
	// DeleteObjects 批量删除（单次 ≤1000，幂等）。
	DeleteObjects(ctx context.Context, keys []string) error
	// Healthcheck PutObject + DeleteObject 一个临时小对象，验证鉴权/endpoint/桶可用。
	Healthcheck(ctx context.Context) error
	// StorageInfo 返回桶用量快照（ListObjectsV2 聚合，仅供后台趋势/测试；生产主路走 CES）。
	StorageInfo(ctx context.Context) (StorageInfo, error)
}
