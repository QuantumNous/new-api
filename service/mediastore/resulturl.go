package mediastore

import (
	"context"
	"strings"

	"github.com/QuantumNous/new-api/common"
)

// OBSScheme DB 中 Task.PrivateData.ResultURL 存储的内部占位符前缀。
// 签名 URL 只在响应序列化时实时生成，永不落库（§5.4）。
const OBSScheme = "obs://"

// WrapKey 把 OBS Key 包装为落库占位符 obs://<key>。
func WrapKey(key string) string {
	return OBSScheme + key
}

// IsOBSRef 判断一个 ResultURL 是否为 obs:// 内部占位符。
func IsOBSRef(raw string) bool {
	return strings.HasPrefix(raw, OBSScheme)
}

// KeyFromRef 从 obs://<key> 取出 key；非 obs 引用返回空串。
func KeyFromRef(raw string) string {
	if !IsOBSRef(raw) {
		return ""
	}
	return strings.TrimPrefix(raw, OBSScheme)
}

// ResolveResultURL 序列化层统一 hook（§5.4）：obs:// 占位符 → 实时签名 URL；
// 其它（上游 URL / 代理 URL）原样返回。签名失败降级返回原始占位符 + 记日志。
func ResolveResultURL(ctx context.Context, raw string) string {
	if !IsOBSRef(raw) {
		return raw
	}
	key := KeyFromRef(raw)
	url, err := Sign(ctx, key)
	if err != nil {
		common.SysError("mediastore: sign result url failed: " + err.Error())
		return raw
	}
	return url
}
