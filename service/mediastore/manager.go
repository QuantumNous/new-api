package mediastore

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"strings"
	"sync"
	"time"

	"github.com/QuantumNous/new-api/setting/system_setting"
)

// 包级单例。Store 客户端按配置指纹惰性构建，配置变更（系统设置页保存）后自动重建。
var (
	mu          sync.Mutex
	cached      Store
	cachedPrint string
)

// Enabled 媒体存储总开关（系统设置 §10.2）。关闭时调用方回退到透传老行为。
func Enabled() bool {
	return system_setting.GetMediaStorageSettings().Enabled
}

// SignedURLTTL 签名 URL 有效期（图片=视频统一，默认 7d）。
func SignedURLTTL() time.Duration {
	h := system_setting.GetMediaStorageSettings().SignedURLTTLHours
	if h <= 0 {
		h = 168
	}
	return time.Duration(h) * time.Hour
}

// NFSRoot 容器内 SFS 挂载根（§5.8）。
func NFSRoot() string {
	return system_setting.GetMediaStorageSettings().NFSRoot()
}

// currentConfig 从系统设置映射出 obsConfig。
func currentConfig() obsConfig {
	s := system_setting.GetMediaStorageSettings()
	return obsConfig{
		Endpoint:        s.Endpoint,
		Region:          s.Region,
		Bucket:          s.Bucket,
		AccessKeyID:     s.GetAccessKeyID(),
		SecretAccessKey: s.GetSecretAccessKey(),
		NFSRoot:         s.NFSRoot(),
		MaxObjectBytes:  int64(s.MaxObjectSizeMB) * 1024 * 1024,
		AllowedURLHosts: s.AllowedUpstreamHosts(),
	}
}

func fingerprint(c obsConfig) string {
	// AK/SK 取哈希指纹：既能在密钥轮换（哪怕新旧同长度）时感知变更、重建客户端，
	// 又不把明文密钥拼进常驻内存字符串。
	return fmt.Sprintf("%s|%s|%s|%s|%s|%d|%s",
		c.Endpoint, c.Region, c.Bucket,
		credHash(c.AccessKeyID, c.SecretAccessKey), c.NFSRoot, c.MaxObjectBytes,
		strings.Join(c.AllowedURLHosts, ","))
}

func credHash(ak, sk string) string {
	h := sha256.Sum256([]byte(ak + "\x00" + sk))
	return hex.EncodeToString(h[:])
}

// Get 返回当前配置对应的 Store，按需（首次或配置变更）重建底层 S3 客户端。
func Get() (Store, error) {
	cfg := currentConfig()
	print := fingerprint(cfg)

	mu.Lock()
	defer mu.Unlock()
	if cached != nil && print == cachedPrint {
		return cached, nil
	}
	store, err := newOBSStore(cfg)
	if err != nil {
		return nil, err
	}
	cached = store
	cachedPrint = print
	return store, nil
}

// Persist 落盘便捷入口：总开关关闭时返回 ErrNotEnabled。
func Persist(ctx context.Context, key string, src PersistSource, meta map[string]string) error {
	if !Enabled() {
		return ErrNotEnabled
	}
	store, err := Get()
	if err != nil {
		return err
	}
	return store.Persist(ctx, key, src, meta)
}

// Sign 用配置的统一 TTL 为 key 实时签名。
func Sign(ctx context.Context, key string, opts ...SignOption) (string, error) {
	store, err := Get()
	if err != nil {
		return "", err
	}
	return store.Sign(ctx, key, SignedURLTTL(), opts...)
}

// Delete 删除单个对象。
func Delete(ctx context.Context, key string) error {
	store, err := Get()
	if err != nil {
		return err
	}
	return store.Delete(ctx, key)
}

// DeleteObjects 批量删除。
func DeleteObjects(ctx context.Context, keys []string) error {
	store, err := Get()
	if err != nil {
		return err
	}
	return store.DeleteObjects(ctx, keys)
}

// Healthcheck 系统设置保存时校验配置连通性。
func Healthcheck(ctx context.Context) error {
	store, err := Get()
	if err != nil {
		return err
	}
	return store.Healthcheck(ctx)
}
