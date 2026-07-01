package common

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
)

// SignMjImage 为 Midjourney 转发图片 URL (/mj/image/:id) 生成短签名。
// 该路由按设计为免鉴权（供外部客户端 <img>/fetch 取图），原实现对任意
// mj_id 无作用域校验，导致未授权跨用户读取他人生成图 (CVE-2026-9306)。
// 通过对 mj_id 附加 HMAC 签名，保留免 token 取图能力的同时杜绝任意 id 枚举/越权。
func SignMjImage(mjId string) string {
	mac := hmac.New(sha256.New, []byte(SessionSecret))
	mac.Write([]byte("mjimg:" + mjId))
	return hex.EncodeToString(mac.Sum(nil))[:16]
}
